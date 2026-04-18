"""
Conversations are stored as plain .txt files, one per conversation.
Format:
    TITLE: <title>
    ID: <uuid>
    CREATED: <iso timestamp>

    [USER 2026-04-18T12:00:00]
    message content here

    [ASSISTANT 2026-04-18T12:00:05]
    response content here

"""

import os
import re
import uuid
from datetime import datetime, timezone

CONV_DIR = os.path.join(os.path.dirname(__file__), "conversations")
os.makedirs(CONV_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _filepath(conv_id: str) -> str:
    return os.path.join(CONV_DIR, f"{conv_id}.txt")


def _parse_file(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()

    lines = raw.splitlines()
    title = "New Conversation"
    conv_id = ""
    created = ""

    for line in lines:
        if line.startswith("TITLE: "):
            title = line[7:]
        elif line.startswith("ID: "):
            conv_id = line[4:]
        elif line.startswith("CREATED: "):
            created = line[9:]

    # Parse messages by splitting on [USER ...] / [ASSISTANT ...] markers
    messages = []
    pattern = re.compile(r"^\[(USER|ASSISTANT) ([^\]]+)\]$", re.MULTILINE)
    matches = list(pattern.finditer(raw))

    for i, match in enumerate(matches):
        role = match.group(1).lower()  # "user" or "assistant"
        timestamp = match.group(2)
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        content = raw[start:end].strip()
        messages.append({"role": role, "content": content, "created_at": timestamp})

    return {
        "id": conv_id,
        "title": title,
        "created_at": created,
        "updated_at": created if not messages else messages[-1]["created_at"],
        "messages": messages,
    }


def list_conversations() -> list[dict]:
    convs = []
    for fname in os.listdir(CONV_DIR):
        if not fname.endswith(".txt"):
            continue
        path = os.path.join(CONV_DIR, fname)
        try:
            data = _parse_file(path)
            convs.append({k: v for k, v in data.items() if k != "messages"})
        except Exception:
            pass
    convs.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return convs


def create_conversation() -> dict:
    conv_id = str(uuid.uuid4())[:8]
    now = _now()
    path = _filepath(conv_id)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"TITLE: New Conversation\n")
        f.write(f"ID: {conv_id}\n")
        f.write(f"CREATED: {now}\n")
    return {"id": conv_id, "title": "New Conversation", "created_at": now, "updated_at": now}


def get_conversation(conv_id: str) -> dict | None:
    path = _filepath(conv_id)
    if not os.path.exists(path):
        return None
    return _parse_file(path)


def append_message(conv_id: str, role: str, content: str):
    path = _filepath(conv_id)
    now = _now()
    label = "USER" if role == "user" else "ASSISTANT"
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"\n[{label} {now}]\n{content}\n")


def update_title(conv_id: str, title: str):
    path = _filepath(conv_id)
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    raw = re.sub(r"^TITLE: .+", f"TITLE: {title}", raw, count=1, flags=re.MULTILINE)
    with open(path, "w", encoding="utf-8") as f:
        f.write(raw)


def delete_conversation(conv_id: str):
    path = _filepath(conv_id)
    if os.path.exists(path):
        os.remove(path)
