"""
RAG (Retrieval Augmented Generation) — PDF document indexing and retrieval.

Drop PDF files into backend/docs/ and trigger indexing via the API or on startup.
Documents are chunked, embedded with the same bi-encoder as memory.py (all-MiniLM-L6-v2),
and stored in a separate ChromaDB collection ("rag_docs") — completely isolated from
conversation memory so RAG operations never affect chat history.

Pipeline:
  index_document(path)  → extract text → chunk → embed → store in ChromaDB
  query_rag(query)      → embed query → ANN search → filter by distance → return chunks
  get_indexed_documents() → list all indexed files + chunk counts
  delete_document(name) → remove all chunks for a file
"""

import hashlib
import os
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

# ── Config ─────────────────────────────────────────────────────────────────────

CHROMA_DIR  = os.path.join(os.path.dirname(__file__), "chroma_db")
DOCS_DIR    = Path(__file__).parent / "docs"
DOCS_DIR.mkdir(exist_ok=True)

EMBED_MODEL        = "all-MiniLM-L6-v2"   # same model as memory.py — already cached
CHUNK_SIZE         = 1200                  # characters per chunk (~300 tokens)
CHUNK_OVERLAP      = 200                   # overlap between consecutive chunks
DISTANCE_THRESHOLD = 0.55                  # cosine distance cutoff — higher = stricter
TOP_K              = 4                     # max chunks injected per query

# ── Singletons ─────────────────────────────────────────────────────────────────

_embed_model: SentenceTransformer | None = None
_collection  = None


def _get_embed_model() -> SentenceTransformer:
    """Reuse the bi-encoder already loaded by memory.py if available."""
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL)
    return _embed_model


def _get_collection():
    """Lazy-load the rag_docs ChromaDB collection (separate from 'messages')."""
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = client.get_or_create_collection(
            name="rag_docs",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ── Text helpers ───────────────────────────────────────────────────────────────

def _extract_pdf_text(path: Path) -> str:
    """Extract all text from a PDF using PyMuPDF (fitz)."""
    import fitz  # PyMuPDF — imported lazily so startup isn't blocked if missing
    doc  = fitz.open(str(path))
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping fixed-size chunks."""
    chunks = []
    start  = 0
    while start < len(text):
        chunk = text[start : start + CHUNK_SIZE].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def _file_hash(path: Path) -> str:
    """MD5 of file bytes — used to skip re-indexing unchanged files."""
    return hashlib.md5(path.read_bytes()).hexdigest()


# ── Indexing ───────────────────────────────────────────────────────────────────

def index_document(path: Path) -> dict:
    """
    Index a single PDF file into the rag_docs collection.

    Returns a status dict:
      { name, status: "indexed"|"skipped"|"error", chunks?, error? }

    Skips if the file hash hasn't changed since last index.
    Re-indexes if the file has been updated (deletes old chunks first).
    """
    col       = _get_collection()
    name      = path.name
    file_hash = _file_hash(path)

    # Check for existing chunks from this file
    existing = col.get(where={"source": name})
    if existing["ids"]:
        if existing["metadatas"][0].get("hash") == file_hash:
            return {"name": name, "status": "skipped", "chunks": len(existing["ids"])}
        # File changed — wipe old chunks and re-index
        col.delete(ids=existing["ids"])

    # Extract text
    try:
        text = _extract_pdf_text(path)
    except Exception as e:
        return {"name": name, "status": "error", "error": str(e)}

    if not text.strip():
        return {
            "name": name, "status": "error",
            "error": "No text extracted — file may be a scanned image PDF (needs OCR)"
        }

    # Chunk + embed + store
    chunks     = _chunk_text(text)
    model      = _get_embed_model()
    embeddings = model.encode(chunks, show_progress_bar=False, batch_size=32).tolist()

    ids       = [f"{name}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"source": name, "chunk_index": i, "hash": file_hash}
                 for i in range(len(chunks))]

    # ChromaDB has a max batch size (~5461) — split large documents into batches
    BATCH = 5000
    for start in range(0, len(chunks), BATCH):
        end = start + BATCH
        col.add(
            ids        = ids[start:end],
            embeddings = embeddings[start:end],
            documents  = chunks[start:end],
            metadatas  = metadatas[start:end],
        )
    return {"name": name, "status": "indexed", "chunks": len(chunks)}


def index_folder() -> list[dict]:
    """Index every PDF in DOCS_DIR. Returns per-file status list."""
    results = []
    pdfs    = sorted(DOCS_DIR.glob("*.pdf"))
    if not pdfs:
        return []
    for path in pdfs:
        results.append(index_document(path))
    return results


# ── Query ──────────────────────────────────────────────────────────────────────

def query_rag(query: str) -> list[tuple[str, str]]:
    """
    Retrieve the most relevant document chunks for a user query.

    Returns a list of (source_filename, chunk_text) tuples, sorted by relevance.
    Returns an empty list if no documents are indexed or nothing is relevant enough.
    """
    col = _get_collection()
    if col.count() == 0:
        return []

    model     = _get_embed_model()
    embedding = model.encode(query, show_progress_bar=False).tolist()
    fetch     = min(col.count(), TOP_K * 3)  # over-fetch then filter

    results = col.query(query_embeddings=[embedding], n_results=fetch)

    hits = []
    for i, doc in enumerate(results["documents"][0]):
        distance = results["distances"][0][i]
        if distance > DISTANCE_THRESHOLD:
            continue
        source = results["metadatas"][0][i].get("source", "unknown")
        hits.append((distance, source, doc))

    hits.sort(key=lambda x: x[0])  # best first
    return [(src, text) for _, src, text in hits[:TOP_K]]


# ── Management ─────────────────────────────────────────────────────────────────

def get_indexed_documents() -> list[dict]:
    """Return all indexed documents with their chunk counts."""
    col = _get_collection()
    if col.count() == 0:
        return []

    all_meta = col.get()["metadatas"]
    counts: dict[str, int] = {}
    for m in all_meta:
        src = m.get("source", "unknown")
        counts[src] = counts.get(src, 0) + 1

    return [{"name": k, "chunks": v} for k, v in sorted(counts.items())]


def delete_document(name: str) -> bool:
    """Remove all indexed chunks for a given filename. Returns False if not found."""
    col      = _get_collection()
    existing = col.get(where={"source": name})
    if not existing["ids"]:
        return False
    col.delete(ids=existing["ids"])
    return True
