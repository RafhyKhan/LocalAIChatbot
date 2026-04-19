"""
SQLite layer — structured storage for conversations and messages.

Why SQLite?
  - Survives server restarts (persistent on disk).
  - Fast for the queries we need: list by recency, fetch by ID, get last N messages.
  - No extra server process required — the file lives next to the backend code.

Schema:
  conversations — one row per conversation (id, title, timestamps)
  messages      — one row per message, foreign-keyed to conversations with CASCADE delete

Note on IDs:
  - conversation id: short 8-char UUID string (e.g. "a1b2c3d4"), generated in conversations.py
  - message id:      SQLite auto-increment integer — also stored in ChromaDB metadata
                     so memory.py can exclude recent messages from semantic search.
"""

import sqlite3
import os
from datetime import datetime, timezone

# The database file lives in the same folder as the backend Python files
DB_PATH = os.path.join(os.path.dirname(__file__), "chat.db")


def get_db():
    """
    Open a SQLite connection with Row factory enabled.
    Row factory lets us access columns by name (row["title"]) instead of index.
    Foreign key support is explicitly enabled — SQLite disables it by default.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row    # enables dict-like column access
    conn.execute("PRAGMA foreign_keys = ON")  # enforce ON DELETE CASCADE
    return conn


def init_db():
    """
    Create the tables if they don't already exist. Safe to call on every startup.
    The foreign key on messages.conversation_id uses ON DELETE CASCADE so that
    deleting a conversation automatically removes all its messages.
    """
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New Conversation',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


def _now():
    """Return the current UTC time as an ISO 8601 string (no microseconds)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


# ── Conversations ─────────────────────────────────────────────────

def create_conversation(conv_id: str, title: str = "New Conversation") -> dict:
    """
    Insert a new conversation row. INSERT OR IGNORE means calling this twice
    with the same ID is safe — it just silently skips the second insert.
    Returns the conversation as a dict.
    """
    now = _now()
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (conv_id, title, now, now),
    )
    conn.commit()
    conn.close()
    return {"id": conv_id, "title": title, "created_at": now, "updated_at": now}


def list_conversations() -> list[dict]:
    """
    Return all conversations sorted by updated_at descending (most recent first).
    This is what populates the sidebar in the frontend.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]  # convert Row objects to plain dicts


def get_conversation(conv_id: str) -> dict | None:
    """Fetch a single conversation by its ID. Returns None if not found."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM conversations WHERE id = ?", (conv_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_title(conv_id: str, title: str):
    """Update the display title for a conversation (called after Gemma generates one)."""
    conn = get_db()
    conn.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id))
    conn.commit()
    conn.close()


def delete_conversation(conv_id: str):
    """
    Delete a conversation row. Because of ON DELETE CASCADE, all messages
    belonging to this conversation are automatically deleted too.
    """
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()


# ── Messages ──────────────────────────────────────────────────────

def add_message(conv_id: str, role: str, content: str) -> tuple[int, str]:
    """
    Insert a message and update the parent conversation's updated_at timestamp.
    Updating updated_at ensures the conversation bubbles to the top of the sidebar.

    Returns (message_id, timestamp):
      - message_id  is the SQLite autoincrement integer — also stored in ChromaDB metadata.
      - timestamp   is the UTC string used to keep the .txt file in sync.
    """
    now = _now()
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (conv_id, role, content, now),
    )
    # Keep the conversation's updated_at current so it sorts correctly in the sidebar
    conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id)
    )
    conn.commit()
    msg_id = cur.lastrowid  # the auto-generated integer ID for this row
    conn.close()
    return msg_id, now


def get_messages(conv_id: str) -> list[dict]:
    """
    Return all messages for a conversation in chronological order (oldest first).
    Used when loading a conversation to display the full history in the UI.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_messages(conv_id: str, limit: int = 8) -> list[dict]:
    """
    Return the last `limit` messages in chronological order.

    Why DESC then reverse?
      - ORDER BY created_at DESC LIMIT N gives us the N most recent rows efficiently.
      - We then reverse the list so Gemma receives them oldest-first (natural reading order).
    Used by main.py to build the "recent window" portion of Gemma's context.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
        (conv_id, limit),
    ).fetchall()
    conn.close()
    # Reverse to restore chronological order after the DESC fetch
    return list(reversed([dict(r) for r in rows]))
