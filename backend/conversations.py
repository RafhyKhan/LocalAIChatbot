"""
Thin coordination layer — the single entry point for all conversation operations.

Every operation writes to up to three places:
  Primary store : SQLite  (via database.py)  — fast queries, structured data, survives restarts.
  Vector store  : ChromaDB (via memory.py)   — semantic similarity search across all messages.
  Side effect   : one .txt file per conversation — plain text log you can open in any editor.

The .txt file is the human-readable record. SQLite is the working database.
ChromaDB holds embeddings only — it never stores raw text as the source of truth.

Txt file format:
    TITLE: <title>
    ID: <id>
    CREATED: <timestamp>

    [USER 2026-04-18T12:00:00]
    message content

    [ASSISTANT 2026-04-18T12:00:05]
    response content
"""

import os
import re
import uuid
import database as db   # SQLite layer
import memory           # ChromaDB vector layer

# All conversation .txt files live in this folder, one file per conversation
CONV_DIR = os.path.join(os.path.dirname(__file__), "conversations")
os.makedirs(CONV_DIR, exist_ok=True)  # create on startup if it doesn't exist yet


# ── Txt file helpers ──────────────────────────────────────────────
# These functions only touch the .txt files — SQLite/ChromaDB are handled separately.

def _txt_path(conv_id: str) -> str:
    """Return the full path to a conversation's .txt log file."""
    return os.path.join(CONV_DIR, f"{conv_id}.txt")


def _txt_init(conv_id: str, created_at: str):
    """Create a new .txt file with the header block (title, id, timestamp)."""
    with open(_txt_path(conv_id), "w", encoding="utf-8") as f:
        f.write(f"TITLE: New Conversation\nID: {conv_id}\nCREATED: {created_at}\n")


def _txt_append(conv_id: str, role: str, content: str, timestamp: str):
    """Append a single message to the .txt file in the readable [ROLE timestamp] format."""
    label = "USER" if role == "user" else "ASSISTANT"
    with open(_txt_path(conv_id), "a", encoding="utf-8") as f:
        f.write(f"\n[{label} {timestamp}]\n{content}\n")


def _txt_update_title(conv_id: str, title: str):
    """
    Rewrite just the TITLE line in the .txt file using a regex substitution.
    Reads the whole file, replaces the first TITLE: line, writes it back.
    """
    path = _txt_path(conv_id)
    if not os.path.exists(path):
        return  # nothing to update if the file was somehow removed
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    # Replace only the first occurrence of "TITLE: ..." — count=1 prevents
    # accidentally replacing a title that appears in message content
    raw = re.sub(r"^TITLE: .+", f"TITLE: {title}", raw, count=1, flags=re.MULTILINE)
    with open(path, "w", encoding="utf-8") as f:
        f.write(raw)


# ── Public API ────────────────────────────────────────────────────

def create_conversation() -> dict:
    """
    Create a new conversation in all stores.
    Generates a short 8-char UUID as the conversation ID, then:
      1. Inserts a row into SQLite.
      2. Creates the .txt log file with the header.
    Returns the new conversation dict (id, title, created_at, updated_at).
    """
    conv_id = str(uuid.uuid4())[:8]       # e.g. "a1b2c3d4"
    conv = db.create_conversation(conv_id) # write to SQLite
    _txt_init(conv_id, conv["created_at"]) # create .txt file
    return conv


def list_conversations() -> list[dict]:
    """Return all conversations from SQLite, sorted newest first."""
    return db.list_conversations()


def get_conversation(conv_id: str) -> dict | None:
    """
    Fetch a conversation and all its messages from SQLite.
    Returns None if the conversation doesn't exist.
    The returned dict includes a "messages" key with the full message list.
    """
    conv = db.get_conversation(conv_id)
    if not conv:
        return None
    # Merge the conversation metadata with its message list into one dict
    return {**conv, "messages": db.get_messages(conv_id)}


def add_message(conv_id: str, role: str, content: str) -> int:
    """
    Persist a single message to all three stores in order:
      1. SQLite  — structured storage, returns (msg_id, timestamp)
      2. .txt    — append to the human-readable log
      3. ChromaDB — embed and index for semantic search

    Returns the SQLite message ID. This ID is stored in ChromaDB metadata
    so that recent messages can be excluded from semantic search results later.
    """
    # SQLite first — it generates the canonical msg_id and timestamp
    msg_id, timestamp = db.add_message(conv_id, role, content)

    # Use the same timestamp from SQLite to keep all stores in sync
    _txt_append(conv_id, role, content, timestamp)

    # Embed and store in ChromaDB — msg_id links back to the SQLite row
    memory.add_message(conv_id, msg_id, role, content)

    return msg_id


def update_title(conv_id: str, title: str):
    """Update the conversation title in both SQLite and the .txt file."""
    db.update_title(conv_id, title)
    _txt_update_title(conv_id, title)


def delete_conversation(conv_id: str):
    """
    Delete a conversation from all three stores:
      1. SQLite  — cascades to delete all messages for this conversation
      2. ChromaDB — removes all embeddings for this conversation
      3. .txt    — deletes the log file from disk
    """
    db.delete_conversation(conv_id)          # cascades to messages table
    memory.delete_conversation(conv_id)      # removes all ChromaDB embeddings
    path = _txt_path(conv_id)
    if os.path.exists(path):
        os.remove(path)


def get_recent_messages(conv_id: str, limit: int = 8) -> list[dict]:
    """
    Return the last `limit` messages for a conversation in chronological order.
    Used by main.py to populate the "recent window" portion of Gemma's context.
    """
    return db.get_recent_messages(conv_id, limit)
