"""
ChromaDB vector store for semantic message retrieval, with FlashRank reranking.

Why two models?
  - Bi-encoder (SentenceTransformer): fast, encodes each text independently.
    Used for ANN (approximate nearest neighbour) retrieval in ChromaDB.
  - Cross-encoder (FlashRank): slower but more accurate — reads the query and
    each candidate together to score true relevance.
    Used after retrieval to rerank the shortlist.

Full pipeline per search() call:
  1. Embed the query with the bi-encoder.
  2. Retrieve top K*5 candidates from ChromaDB via ANN (fast, approximate).
  3. Filter by cosine distance threshold — drop anything too dissimilar.
  4. Filter by exclude_msg_ids — skip messages already in the recent window.
  5. Rerank remaining candidates with FlashRank cross-encoder (accurate).
  6. Return top N after reranking to main.py for context injection.
"""

import logging
import os
import chromadb
from sentence_transformers import SentenceTransformer
from flashrank import Ranker, RerankRequest

logger = logging.getLogger(__name__)

# ChromaDB stores its index on disk so embeddings survive server restarts
CHROMA_DIR   = os.path.join(os.path.dirname(__file__), "chroma_db")

# Bi-encoder: ~80 MB, fast to run — used for ANN retrieval
EMBED_MODEL  = "all-MiniLM-L6-v2"

# Cross-encoder: small but accurate — used for reranking the retrieved candidates
RERANK_MODEL = "ms-marco-MiniLM-L-12-v2"

# Singletons — loaded once on first use, then reused for every request
_embed_model: SentenceTransformer | None = None
_ranker: Ranker | None = None
_collection = None


def _get_embed_model() -> SentenceTransformer:
    """Lazy-load the bi-encoder. Downloads the model on first call (~80 MB)."""
    global _embed_model
    if _embed_model is None:
        logger.info("Loading bi-encoder model: %s", EMBED_MODEL)
        _embed_model = SentenceTransformer(EMBED_MODEL)
        logger.info("Bi-encoder loaded")
    return _embed_model


def _get_ranker() -> Ranker:
    """Lazy-load the FlashRank cross-encoder. Downloads on first call."""
    global _ranker
    if _ranker is None:
        logger.info("Loading FlashRank reranker: %s", RERANK_MODEL)
        _ranker = Ranker(model_name=RERANK_MODEL)
        logger.info("FlashRank reranker loaded")
    return _ranker


def _get_collection():
    """Lazy-load the ChromaDB collection. Creates it if it doesn't exist yet."""
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = client.get_or_create_collection(
            name="messages",
            metadata={"hnsw:space": "cosine"},  # use cosine distance for similarity
        )
    return _collection


def add_message(conv_id: str, msg_id: int, role: str, content: str):
    """
    Embed a message with the bi-encoder and store it in ChromaDB.

    The ChromaDB document ID is "{conv_id}_{msg_id}" — combining both ensures
    uniqueness across conversations. The SQLite msg_id is stored in metadata
    so we can exclude recent messages from search results later.
    """
    col = _get_collection()
    embedding = _get_embed_model().encode(content, show_progress_bar=False).tolist()
    col.add(
        ids=[f"{conv_id}_{msg_id}"],       # unique doc ID across all conversations
        embeddings=[embedding],             # pre-computed bi-encoder vector
        documents=[content],               # raw text (returned by search queries)
        metadatas=[{
            "conversation_id": conv_id,    # which conversation this belongs to
            "role": role,                  # "user" or "assistant"
            "msg_id": msg_id,             # SQLite row ID — used for deduplication
        }],
    )


def search(query: str, n_results: int = 5, exclude_msg_ids: set | None = None) -> list[dict]:
    """
    Retrieve and rerank the most relevant past messages for a given query.

    Args:
        query:           The user's current message — used as the search query.
        n_results:       How many results to return after reranking.
        exclude_msg_ids: Set of SQLite message IDs to skip (the recent window,
                         already included verbatim in the context).

    Returns:
        List of dicts with keys: content, role, conversation_id, msg_id.
        Sorted by FlashRank relevance score (best first).
    """
    col = _get_collection()

    # Nothing to search if the collection is empty (first run)
    if col.count() == 0:
        return []

    # ── Step 1: ANN retrieval ─────────────────────────────────────
    # Embed the query with the bi-encoder, then ask ChromaDB for approximate
    # nearest neighbours. We fetch n_results*5 so we have plenty of candidates
    # to filter and rerank down to n_results.
    embedding = _get_embed_model().encode(query, show_progress_bar=False).tolist()
    fetch = min(col.count(), n_results * 5)  # don't ask for more than exist
    results = col.query(query_embeddings=[embedding], n_results=fetch)

    # ── Step 2: Filter ────────────────────────────────────────────
    candidates = []
    for i, doc in enumerate(results["documents"][0]):
        meta     = results["metadatas"][0][i]
        distance = results["distances"][0][i]  # cosine distance: 0=identical, 1=opposite

        # Drop anything with cosine distance > 0.6 (similarity < 0.4 — too weak to be useful)
        if distance > 0.6:
            continue

        # Skip messages that are already in the recent window to avoid duplication.
        # msg_id in metadata == the SQLite "id" column stored when the message was added.
        if exclude_msg_ids and meta["msg_id"] in exclude_msg_ids:
            continue

        candidates.append({
            "content":         doc,
            "role":            meta["role"],
            "conversation_id": meta["conversation_id"],
            "msg_id":          meta["msg_id"],
        })

    if not candidates:
        return []

    # ── Step 3: FlashRank reranking ───────────────────────────────
    # Only rerank if we have more than one candidate — single results need no sorting.
    # FlashRank passages must be dicts with "id" (int index) and "text" (string).
    # We use the list index as the ID so we can map results back to our candidate dicts.
    if len(candidates) > 1:
        passages = [
            {"id": i, "text": c["content"]}
            for i, c in enumerate(candidates)
        ]
        reranked = _get_ranker().rerank(RerankRequest(query=query, passages=passages))
        # reranked is sorted by relevance score descending.
        # r["id"] is the original list index — use it to recover the full candidate dict.
        candidates = [candidates[r["id"]] for r in reranked]

    # ── Step 4: Return top-N ──────────────────────────────────────
    return candidates[:n_results]


def delete_conversation(conv_id: str):
    """
    Remove all ChromaDB embeddings that belong to a deleted conversation.
    Called from conversations.delete_conversation() as part of the three-way cleanup.
    """
    col = _get_collection()
    # Fetch all doc IDs where the metadata conversation_id matches
    existing = col.get(where={"conversation_id": conv_id})
    if existing["ids"]:
        col.delete(ids=existing["ids"])
