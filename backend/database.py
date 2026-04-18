import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "chat.db"
CONVERSATIONS_DIR = Path(__file__).parent / "conversations"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    CONVERSATIONS_DIR.mkdir(exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            image_data TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        INSERT OR IGNORE INTO settings (key, value) VALUES ('user_profile', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('behavior_instructions', '');
    """)
    conn.commit()
    conn.close()


def create_conversation(title: str = "New Conversation") -> dict:
    conn = get_db()
    conv_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (conv_id, title, now, now),
    )
    conn.commit()
    conn.close()
    return {"id": conv_id, "title": title, "created_at": now, "updated_at": now}


def get_conversations() -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_conversation(conv_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_conversation(conv_id: str):
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()
    txt = CONVERSATIONS_DIR / f"{conv_id}.txt"
    if txt.exists():
        txt.unlink()


def update_conversation_title(conv_id: str, title: str):
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        (title, now, conv_id),
    )
    conn.commit()
    conn.close()


def touch_conversation(conv_id: str):
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
    conn.commit()
    conn.close()


def add_message(conv_id: str, role: str, content: str, image_data: str = None) -> dict:
    conn = get_db()
    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, image_data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (msg_id, conv_id, role, content, image_data, now),
    )
    conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (now, conv_id),
    )
    conn.commit()
    conn.close()
    return {"id": msg_id, "conversation_id": conv_id, "role": role, "content": content, "image_data": image_data, "created_at": now}


def get_messages(conv_id: str) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_messages(conv_id: str, limit: int = 8) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
        (conv_id, limit),
    ).fetchall()
    conn.close()
    return list(reversed([dict(r) for r in rows]))


def get_settings() -> dict:
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def save_settings(key: str, value: str):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()


def backup_conversation(conv_id: str):
    conv = get_conversation(conv_id)
    messages = get_messages(conv_id)
    if not conv or not messages:
        return
    lines = [
        f"Conversation: {conv['title']}",
        f"Created: {conv['created_at']}",
        "=" * 60,
        "",
    ]
    for msg in messages:
        lines.append(f"[{msg['role'].upper()}] {msg['created_at']}")
        lines.append(msg["content"])
        lines.append("")
    (CONVERSATIONS_DIR / f"{conv_id}.txt").write_text("\n".join(lines), encoding="utf-8")
