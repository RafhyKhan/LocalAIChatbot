"""
FastAPI backend — the central hub of the app.

Request flow for each chat message:
  1. Build context   → system prompt + semantic memory (ChromaDB) + recent messages
  2. Tool-call loop  → Gemma decides whether to call web_search() and/or calculate()
                       Loop runs non-streaming until Gemma stops calling tools
  3. Stream response → final answer streamed to the frontend
  4. Persist result  → SQLite + ChromaDB + .txt file
  5. Title           → generated after the very first exchange

Available tools Gemma can call:
  web_search(query)     — queries SearXNG for real-time information
  calculate(expression) — evaluates math accurately via SymPy
"""

import asyncio
import json
import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

import conversations as conv_store
import memory
import database as db
import search as searcher
import calculator as calc
import datetool
import unittool
import browsertool
import weathertool
import dashboard as dash_data
import google_calendar as gcal

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()

client = AsyncOpenAI(
    base_url="http://localhost:12434/v1",
    api_key="not-needed",
)
MODEL = "docker.io/ai/gemma4:E2B"

#The recent window, is its direct memory. Token usage has to fit the RECENTMEMORY number of messages. 
RECENT_WINDOW = 16
SEMANTIC_K    = 5

#More Str Information Vairables
CURRENT_LOCATION = "Calgary, Alberta, Canada"

# All tools available to Gemma — combined into one list for the API call
# Update the static tool list in frontend/src/components/Sidebar.tsx when adding/removing tools here
ALL_TOOLS = searcher.SEARCH_TOOLS + calc.CALCULATOR_TOOLS + datetool.DATETOOL_TOOLS + unittool.UNITTOOL_TOOLS + browsertool.BROWSERTOOL_TOOLS + weathertool.WEATHER_TOOLS

# System prompt — tells Gemma upfront what it can do and how to behave
SYSTEM_PROMPT = (
    "Your name is RainAI. You are a helpful, concise personal AI assistant built exclusively for and by Rafhy Khan."
    "You are in Calgary, Alberta, Canada."
    "\n\n"
    "You have access to real-time web search."
    "When asked about current events, news, prices, sports, or anything "
    "that requires up-to-date information, you will search the web automatically. "
    "Never say you cannot access the internet or that your knowledge has a cutoff — "
    "you can and should search the web when needed. "
    "If you searched, mention what you found. "
    "\n\n"
    "You have a get_weather tool that provides real-time weather from wttr.in. "
    "ALWAYS use this tool for ANY weather-related question — current conditions, "
    "temperature, feels-like, humidity, wind, UV index, or forecast. "
    "NEVER search the web for weather; the get_weather tool is faster and always accurate. "
    "If the user does not specify a location, default to Calgary, Alberta."
    "\n\n"
    "You also have access to a precise calculator tool. "
    "ALWAYS use the calculator tool for any mathematical computation — "
    "never attempt arithmetic, algebra, or numerical reasoning yourself. "
    "You make math errors; the calculator does not."
    "\n\n"
    "You have a date_diff tool. "
    "ALWAYS use it for any calculation involving the difference between two dates — "
    "never compute date gaps yourself."
    "\n\n"
    "You have a convert_units tool. "
    "ALWAYS use it for any unit conversion — never estimate conversions yourself."
    "\n\n"
    "You are a helpful assistant, not an authoritative source of truth. "
    "You can and do make mistakes. When uncertain, say so clearly. "
    "Always distinguish between what you know from training and what you found via web search. "
    "Encourage Rafhy to verify important information independently."
)


class ChatRequest(BaseModel):
    conversation_id: str
    message: str


class WordItem(BaseModel):
    word:         str
    phonetic:     str = ""
    partOfSpeech: str = ""
    definition:   str = ""
    example:      str = ""


class TaskItem(BaseModel):
    label:    str
    category: str  # "work" | "activity" | "eat" | "read" | "workout"


class CalendarEventItem(BaseModel):
    title: str
    date:  str          # "YYYY-MM-DD"
    start: str = ""     # "HH:MM" or empty for all-day
    end:   str = ""     # "HH:MM" or empty for all-day


class AgendaItem(BaseModel):
    date: str   # "YYYY-MM-DD"
    text: str


class ChecklistTaskItem(BaseModel):
    id:      str
    label:   str
    checked: bool

class ChecklistSectionItem(BaseModel):
    id:    str
    type:  str   # "favourites" | "unsorted" | "custom"
    title: str
    tasks: list[ChecklistTaskItem]

class ChecklistStateV2(BaseModel):
    sections: list[ChecklistSectionItem]
    lifetime: int


# ── Word list helpers (words.json) ────────────────────────────────────────────

_WORDS_FILE = Path(__file__).parent / "words.json"


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


# ── Task list helpers (tasks.json) ────────────────────────────────────────────

_TASKS_FILE = Path(__file__).parent / "tasks.json"

# ── Checklist helpers (checklist.json) ────────────────────────────────────────

_CHECKLIST_FILE         = Path(__file__).parent / "checklist.json"
_CHECKLIST_INITIAL_FILE = Path(__file__).parent / "checklist-initial.json"

def _migrate_old_checklist(data: dict) -> dict:
    """Convert flat-array format to sections format. Backs up old file first."""
    labels     = data.get("labels", [])
    checked    = data.get("checked", [])
    favourites = data.get("favourites", [])
    lifetime   = data.get("lifetime", 0)

    # Starred tasks → Favourites section; rest → Unsorted section
    fav_tasks      = []
    unsorted_tasks = []
    for i, label in enumerate(labels):
        task = {
            "id":      str(uuid4()),
            "label":   label,
            "checked": checked[i] if i < len(checked) else False,
        }
        if i < len(favourites) and favourites[i]:
            fav_tasks.append(task)
        else:
            unsorted_tasks.append(task)

    sections = []
    if fav_tasks:
        sections.append({"id": "favourites", "type": "favourites",
                         "title": "⭐ Favourites", "tasks": fav_tasks})
    if unsorted_tasks:
        sections.append({"id": str(uuid4()), "type": "unsorted",
                         "title": "Unsorted", "tasks": unsorted_tasks})

    new_data = {"sections": sections, "lifetime": lifetime}
    _CHECKLIST_FILE.write_text(json.dumps(new_data, indent=2, ensure_ascii=False), encoding="utf-8")
    return new_data

def _load_checklist() -> dict:
    if not _CHECKLIST_FILE.exists():
        return {"sections": [], "lifetime": 0}
    try:
        data = json.loads(_CHECKLIST_FILE.read_text(encoding="utf-8"))
        if "labels" in data:          # old flat format — migrate
            return _migrate_old_checklist(data)
        return data
    except Exception:
        return {"sections": [], "lifetime": 0}

def _save_checklist(state: dict) -> None:
    _CHECKLIST_FILE.write_text(
        json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8"
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


# ── REST endpoints ────────────────────────────────────────────────

@app.get("/api/conversations")
def list_conversations():
    return conv_store.list_conversations()


@app.post("/api/conversations")
def create_conversation():
    return conv_store.create_conversation()


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    data = conv_store.get_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    conv_store.delete_conversation(conv_id)
    return {"ok": True}


@app.get("/api/weather")
def get_weather_forecast():
    """7-day Calgary forecast from Open-Meteo (used by the dashboard widget)."""
    return dash_data.get_forecast()


@app.get("/api/news")
def get_news_feed():
    """Latest BBC News headlines from RSS (used by the dashboard widget)."""
    return dash_data.get_news()


@app.get("/api/multinews/{source}")
def get_multi_news(source: str):
    """Fetch RSS headlines for a given news source key."""
    return dash_data.get_multi_news(source)


@app.get("/api/philosopher")
def get_philosopher_feed():
    """Latest Philosopher of the Month posts from OUP Blog RSS."""
    return dash_data.get_philosopher()


@app.get("/api/words")
def get_word_list():
    """Return the user's personal saved word list."""
    return {"words": _load_words()}


@app.post("/api/words")
def add_word(item: WordItem):
    """Add a word to the saved list (no-op if already present)."""
    words = _load_words()
    if not any(w.get("word") == item.word for w in words):
        words.append(item.model_dump())
        _save_words(words)
    return {"ok": True}


@app.delete("/api/words/{word}")
def delete_word(word: str):
    """Remove a word from the saved list."""
    words = _load_words()
    words = [w for w in words if w.get("word") != word]
    _save_words(words)
    return {"ok": True}


@app.get("/api/tasks")
def get_tasks():
    """Return the user's personal task pool for schedule assignment."""
    return {"tasks": _load_tasks()}


@app.post("/api/tasks")
def add_task(item: TaskItem):
    """Add a task to the pool (no-op if label+category already present)."""
    tasks = _load_tasks()
    if not any(t.get("label") == item.label and t.get("category") == item.category for t in tasks):
        tasks.append(item.model_dump())
        _save_tasks(tasks)
    return {"ok": True}


@app.delete("/api/tasks/{label}")
def delete_task(label: str):
    """Remove all tasks with the given label from the pool."""
    tasks = _load_tasks()
    tasks = [t for t in tasks if t.get("label") != label]
    _save_tasks(tasks)
    return {"ok": True}


@app.get("/api/checklist")
def get_checklist():
    """Return the full checklist state from disk (migrates old format on first call)."""
    return _load_checklist()


@app.post("/api/checklist")
def save_checklist(item: ChecklistStateV2):
    """Persist the full checklist state (sections format) to disk."""
    _save_checklist(item.model_dump())
    return {"ok": True}


@app.get("/api/bookmarks")
def get_bookmarks():
    """Parse Chrome bookmarks HTML and return [{title, url}] list."""
    import re
    bookmarks_file = Path(__file__).parent.parent / "frontend" / "src" / "data" / "bookmarksApril26.html"
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


@app.get("/api/calendar/auth")
def calendar_auth_status():
    """Return { connected, auth_url? } — widget polls this every 3s until connected."""
    connected = gcal.is_connected()
    if connected:
        return {"connected": True}
    return {"connected": False, "auth_url": gcal.get_auth_url()}


@app.get("/api/calendar/callback")
def calendar_callback(code: str, state: str = ""):
    """
    OAuth redirect target. Exchanges code for tokens, then returns a
    self-closing HTML page so the popup tab disappears automatically.
    """
    try:
        gcal.exchange_code(code)
        html = """<!doctype html>
<html><head><title>Connected</title></head>
<body style="font-family:sans-serif;background:#212121;color:#ececec;
             display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center">
    <div style="font-size:48px;margin-bottom:12px">✅</div>
    <p style="font-size:18px;font-weight:600">Google Calendar connected!</p>
    <p style="color:#8e8ea0;margin-top:6px">You can close this tab.</p>
  </div>
  <script>setTimeout(()=>window.close(),1500);</script>
</body></html>"""
    except Exception as exc:
        html = f"""<!doctype html>
<html><head><title>Error</title></head>
<body style="font-family:sans-serif;background:#212121;color:#ececec;
             display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center">
    <div style="font-size:48px;margin-bottom:12px">❌</div>
    <p style="font-size:18px;font-weight:600">Connection failed</p>
    <p style="color:#8e8ea0;margin-top:6px">{exc}</p>
    <p style="color:#8e8ea0;margin-top:6px">Close this tab and try again.</p>
  </div>
</body></html>"""
    return HTMLResponse(content=html)


@app.get("/api/calendar/events")
def get_calendar_events(start_date: str = None, days_ahead: int = 7):
    """Return { days: [...] } for any 7-day window. Defaults to today."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return {"days": gcal.get_events(days_ahead=days_ahead, start_date=start_date)}


@app.post("/api/calendar/events")
def create_calendar_event(item: CalendarEventItem):
    """Create a Google Calendar event."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return gcal.create_event(item.title, item.date, item.start, item.end)


@app.post("/api/calendar/agenda")
def save_calendar_agenda(item: AgendaItem):
    """Save agenda text to the '📋 Agenda' all-day event for a given date."""
    if not gcal.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Calendar.")
    return gcal.save_agenda(item.date, item.text)


@app.get("/api/conversations/{conv_id}/tokens")
def get_token_count(conv_id: str):
    """
    Estimate the number of tokens currently used by this conversation's context.
    Uses a chars÷4 approximation (close enough for Gemma, no extra dependencies).
    Counts: system prompt + last RECENT_WINDOW messages.
    """
    data = conv_store.get_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")

    recent = conv_store.get_recent_messages(conv_id, limit=RECENT_WINDOW)
    total_chars = len(SYSTEM_PROMPT) + sum(len(m["content"]) for m in recent)
    used  = total_chars // 4
    limit = 8192

    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}


# ── Title generation ──────────────────────────────────────────────

async def _generate_title(conv_id: str, user_message: str, assistant_reply: str):
    """Fire-and-forget: short descriptive title based on the first full exchange."""
    try:
        exchange = f"User: {user_message}\nAssistant: {assistant_reply[:300]}"
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Generate a short title (under 55 chars, no quotes, no punctuation at the end) "
                        "that summarises what this conversation is about. "
                        "Base it on both the user's question and the assistant's response. "
                        "Write a brief descriptive phrase, not a question."
                    ),
                },
                {"role": "user", "content": exchange},
            ],
            max_tokens=20,
            stream=False,
        )
        title = resp.choices[0].message.content.strip().strip('"').strip("'")
        if title:
            conv_store.update_title(conv_id, title[:60])
    except Exception:
        pass


# ── Context builder ───────────────────────────────────────────────

def _build_base_messages(conv_id: str, user_message: str) -> list[dict]:
    """
    Build the starting message list for each request:
      system prompt → semantic memory snippets → recent conversation → user message

    Web search and calculation are NOT done here — Gemma decides via tool calling.
    """
    recent     = conv_store.get_recent_messages(conv_id, limit=RECENT_WINDOW)
    recent_ids = {m["id"] for m in recent}

    # Semantic recall: ANN retrieval → distance filter → FlashRank reranking → top-K
    relevant = memory.search(
        query=user_message,
        n_results=SEMANTIC_K,
        exclude_msg_ids=recent_ids,
    )

    # Inject exact current Calgary time so Gemma can answer time questions accurately
    # and judge the freshness of web search results without relying on a search lookup
    now = datetime.now(ZoneInfo("America/Edmonton"))
    time_str = now.strftime("%A, %B %d, %Y · %I:%M %p %Z")
    system_parts = [
        SYSTEM_PROMPT,
        (
            f"\nThe current date and time in Calgary is: {time_str}. "
            "This is exact and authoritative — do NOT search the web for the current time or date. "
            "Use this value directly when asked."
        ),
    ]

    if relevant:
        snippets = []
        for r in relevant:
            label = "User" if r["role"] == "user" else "Assistant"
            tag   = "(this conversation)" if r["conversation_id"] == conv_id else "(past conversation)"
            snippets.append(f"[{label} {tag}]: {r['content']}")
        system_parts.append(
            "\nRelevant context recalled from memory:\n"
            + "\n\n".join(snippets)
            + "\n\nUse this context if relevant, but do not repeat it verbatim."
        )

    messages = [{"role": "system", "content": "\n".join(system_parts)}]
    for m in recent:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


# ── Tool executor ─────────────────────────────────────────────────

async def _execute_tool(name: str, arguments: str) -> str:
    """
    Dispatch a tool call by name and return its string result.
    Adding a new tool only requires adding a branch here and to ALL_TOOLS.
    """
    args = json.loads(arguments)

    if name == "web_search":
        return await searcher.web_search(args.get("query", ""))

    if name == "calculate":
        # SymPy is synchronous — runs instantly, no await needed
        return calc.calculate(args.get("expression", ""))

    if name == "date_diff":
        return datetool.date_diff(args.get("date1", ""), args.get("date2", ""))

    if name == "convert_units":
        return unittool.convert_units(
            args.get("value", 0),
            args.get("from_unit", ""),
            args.get("to_unit", ""),
        )

    if name == "open_url":
        return browsertool.open_url(args.get("url", ""))

    if name == "get_weather":
        return weathertool.get_weather(args.get("location", "Calgary, Alberta"))

    return f"Unknown tool: {name}"


# ── Chat endpoint ─────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    data = conv_store.get_conversation(req.conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_first = len(data["messages"]) == 0

    # Build base context before persisting so the new message isn't in the window
    messages = _build_base_messages(req.conversation_id, req.message)

    # Persist user message to SQLite + txt + ChromaDB
    conv_store.add_message(req.conversation_id, "user", req.message)

    async def stream():
        """
        Tool-calling loop, then stream the final response.

        Loop (non-streaming):
          1. Call Gemma with ALL_TOOLS defined.
          2. If Gemma emits tool_calls:
               - notify frontend (searching / calculating indicator)
               - execute each tool
               - append [assistant tool_call msg] + [tool result msg] to messages
               - go back to step 1 with updated messages
          3. If no tool_calls: break out of the loop.

        After loop: stream the final response (Gemma has all tool results in context).
        If Gemma never called a tool, its first response is already the final answer —
        yield it directly as a single delta (no second API call needed).
        """
        full          = ""
        used_search   = False
        used_calc     = False
        final_content = None  # set if Gemma answered without any tool calls
        all_sources: list[str] = []  # URLs collected from web_search results

        try:
            # ── Tool-calling loop ─────────────────────────────────
            while True:
                response = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=ALL_TOOLS,
                    tool_choice="auto",
                    stream=False,
                )

                tool_calls = response.choices[0].message.tool_calls

                if not tool_calls:
                    # Gemma is done calling tools — its response is the final answer
                    final_content = response.choices[0].message.content or ""
                    break

                # Append Gemma's assistant message (contains the tool_call requests)
                messages.append({
                    "role": "assistant",
                    "content": response.choices[0].message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                })

                # Execute each tool call and append results
                for tc in tool_calls:
                    name = tc.function.name

                    # Notify the frontend what's happening
                    if name == "web_search":
                        used_search = True
                        yield f"data: {json.dumps({'searching': True})}\n\n"
                    elif name == "calculate":
                        used_calc = True
                        yield f"data: {json.dumps({'calculating': True})}\n\n"

                    result = await _execute_tool(name, tc.function.arguments)

                    # Collect source URLs from web search results
                    if name == "web_search":
                        all_sources.extend(re.findall(r'https?://[^\s]+', result))

                    # Tool result — must reference the tool_call_id Gemma sent
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })

                # Loop back: Gemma may call more tools after seeing the results

            # ── Stream (or yield) final response ──────────────────
            if final_content is not None:
                # Gemma never called a tool — answer came from the first response.
                # Yield as a single delta (appears instantly — no waiting for a stream).
                full = final_content
                if full:
                    yield f"data: {json.dumps({'delta': full})}\n\n"
            else:
                # Gemma used tools — stream the follow-up response so the user
                # sees it generating in real-time (results can be lengthy)
                stream_resp = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=True,
                )
                async for chunk in stream_resp:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full += delta
                        yield f"data: {json.dumps({'delta': delta})}\n\n"

            # Persist the complete assistant response
            conv_store.add_message(req.conversation_id, "assistant", full)

            if is_first:
                asyncio.create_task(
                    _generate_title(req.conversation_id, req.message, full)
                )

            yield f"data: {json.dumps({'done': True, 'sources': all_sources})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
