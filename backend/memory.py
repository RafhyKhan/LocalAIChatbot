import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer
from flashrank import Ranker, RerankRequest

CHROMA_PATH = Path(__file__).parent / "chroma_db"
FLASHRANK_CACHE = Path(__file__).parent / "flashrank_cache"

_embed_model: SentenceTransformer | None = None
_chroma_client: chromadb.PersistentClient | None = None
_collection = None
_ranker: Ranker | None = None
_executor = ThreadPoolExecutor(max_workers=2)


def _get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model


def _get_collection():
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_PATH))
        _collection = _chroma_client.get_or_create_collection(
            "messages",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _get_ranker() -> Ranker:
    global _ranker
    if _ranker is None:
        FLASHRANK_CACHE.mkdir(exist_ok=True)
        _ranker = Ranker(
            model_name="ms-marco-MiniLM-L-12-v2",
            cache_dir=str(FLASHRANK_CACHE),
        )
    return _ranker


def _embed(text: str) -> list[float]:
    return _get_embed_model().encode(text).tolist()


def add_message_to_chroma(msg_id: str, content: str, conv_id: str, role: str, created_at: str):
    try:
        col = _get_collection()
        embedding = _embed(content)
        col.upsert(
            ids=[msg_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[{"conversation_id": conv_id, "role": role, "created_at": created_at}],
        )
    except Exception as e:
        print(f"[memory] ChromaDB upsert error: {e}")


def _sync_semantic_search(query: str, exclude_ids: list[str], n_results: int) -> list[dict]:
    try:
        col = _get_collection()
        count = col.count()
        if count == 0:
            return []
        embedding = _embed(query)
        results = col.query(
            query_embeddings=[embedding],
            n_results=min(n_results, count),
        )
        hits = []
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        ids = results.get("ids", [[]])[0]
        for doc, meta, rid in zip(docs, metas, ids):
            if rid not in exclude_ids:
                hits.append({"id": rid, "text": doc, "meta": meta})
        return hits
    except Exception as e:
        print(f"[memory] ChromaDB query error: {e}")
        return []


async def semantic_search(query: str, exclude_ids: list[str], n_results: int = 10) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor, _sync_semantic_search, query, exclude_ids, n_results
    )


def rerank(query: str, passages: list[dict], top_k: int = 5) -> list[dict]:
    if not passages:
        return []
    try:
        ranker = _get_ranker()
        rerank_input = [{"id": i, "text": p["text"]} for i, p in enumerate(passages)]
        req = RerankRequest(query=query, passages=rerank_input)
        results = ranker.rerank(req)
        return [passages[r["id"]] for r in results[:top_k]]
    except Exception as e:
        print(f"[memory] FlashRank error: {e}")
        return passages[:top_k]
