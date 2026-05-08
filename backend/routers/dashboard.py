"""
Dashboard data endpoints: weather, news, words, tasks, bookmarks.
"""
import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter
from shared import BASE_DIR
from models import WordItem, TaskItem
import dashboard as dash_data

logger = logging.getLogger(__name__)
router = APIRouter()

# ── File helpers ──────────────────────────────────────────────────────────────

_WORDS_FILE = BASE_DIR / "words.json"
_TASKS_FILE = BASE_DIR / "tasks.json"


def _load_words() -> list:
    if not _WORDS_FILE.exists():
        return []
    try:
        return json.loads(_WORDS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_words(words: list) -> None:
    _WORDS_FILE.write_text(
        json.dumps(words, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _load_tasks() -> list:
    if not _TASKS_FILE.exists():
        return []
    try:
        return json.loads(_TASKS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_tasks(tasks: list) -> None:
    _TASKS_FILE.write_text(
        json.dumps(tasks, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/weather")
def get_weather_forecast():
    """7-day local forecast from Open-Meteo (used by the dashboard widget)."""
    return dash_data.get_forecast()


@router.get("/api/news")
def get_news_feed():
    """Latest BBC News headlines from RSS (used by the dashboard widget)."""
    return dash_data.get_news()


@router.get("/api/multinews/{source}")
def get_multi_news(source: str):
    """Fetch RSS headlines for a given news source key."""
    return dash_data.get_multi_news(source)


@router.get("/api/philosopher")
def get_philosopher_feed():
    """Latest Philosopher of the Month posts from OUP Blog RSS."""
    return dash_data.get_philosopher()


@router.get("/api/bookmarks")
def get_bookmarks():
    """Parse Chrome bookmarks HTML and return [{title, url}] list."""
    bookmarks_file = BASE_DIR.parent / "frontend" / "src" / "data" / "bookmarksApril26.html"
    if not bookmarks_file.exists():
        return {"bookmarks": []}
    try:
        raw = bookmarks_file.read_text(encoding="utf-8", errors="ignore")
        pattern = re.compile(r'<A\s+HREF="([^"]+)"[^>]*>([^<]+)</A>', re.IGNORECASE)
        bookmarks = [
            {"title": m.group(2).strip(), "url": m.group(1).strip()}
            for m in pattern.finditer(raw)
            if m.group(1).startswith("http")
        ]
        return {"bookmarks": bookmarks}
    except Exception:
        return {"bookmarks": []}


@router.get("/api/words")
def get_word_list():
    """Return the user's personal saved word list."""
    return {"words": _load_words()}


@router.post("/api/words")
def add_word(item: WordItem):
    """Add a word to the saved list (no-op if already present)."""
    words = _load_words()
    if not any(w.get("word") == item.word for w in words):
        words.append(item.model_dump())
        _save_words(words)
    return {"ok": True}


@router.delete("/api/words/{word}")
def delete_word(word: str):
    """Remove a word from the saved list."""
    words = _load_words()
    words = [w for w in words if w.get("word") != word]
    _save_words(words)
    return {"ok": True}


@router.get("/api/tasks")
def get_tasks():
    """Return the user's personal task pool for schedule assignment."""
    return {"tasks": _load_tasks()}


@router.post("/api/tasks")
def add_task(item: TaskItem):
    """Add a task to the pool (no-op if label+category already present)."""
    tasks = _load_tasks()
    if not any(t.get("label") == item.label and t.get("category") == item.category for t in tasks):
        tasks.append(item.model_dump())
        _save_tasks(tasks)
    return {"ok": True}


@router.delete("/api/tasks/{label}")
def delete_task(label: str):
    """Remove all tasks with the given label from the pool."""
    tasks = _load_tasks()
    tasks = [t for t in tasks if t.get("label") != label]
    _save_tasks(tasks)
    return {"ok": True}
