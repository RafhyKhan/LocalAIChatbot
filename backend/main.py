"""
FastAPI backend — application entry point.

Request flow for each chat message:
  1. Build context   → system prompt + semantic memory (ChromaDB) + recent messages
  2. Tool-call loop  → Gemma decides whether to call web_search() and/or calculate()
                       Loop runs non-streaming until Gemma stops calling tools
  3. Stream response → final answer streamed to the frontend
  4. Persist result  → SQLite + ChromaDB + .txt file
  5. Title           → generated after the very first exchange

Routers (see backend/routers/):
  conversations  — CRUD for conversations
  dashboard      — weather, news, words, tasks, bookmarks
  checklist      — checklist load/save
  profile        — personal profile + context preview
  calendar       — Google Calendar integration
  chat           — streaming chat + token count
"""

from dotenv import load_dotenv
load_dotenv()  # must run before shared.py is imported (it reads env vars at module level)

import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database as db
from shared import MODEL

# ── Logging ───────────────────────────────────────────────────────────────────

_LOG_DIR = Path(__file__).parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[
        logging.FileHandler(_LOG_DIR / "app.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)
logger.info("RainAI backend starting up")

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()

# ── Routers ───────────────────────────────────────────────────────────────────

from routers import conversations, dashboard, checklist, profile, calendar, chat

app.include_router(conversations.router)
app.include_router(dashboard.router)
app.include_router(checklist.router)
app.include_router(profile.router)
app.include_router(calendar.router)
app.include_router(chat.router)

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    """Quick liveness check — returns 200 when the backend is running."""
    return {
        "status":    "ok",
        "model":     MODEL,
        "timestamp": datetime.now().isoformat(),
    }
