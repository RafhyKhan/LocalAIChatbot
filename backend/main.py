import asyncio
import io
import json
from pathlib import Path
from typing import AsyncGenerator, Optional

import pdfplumber
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from database import (
    init_db,
    create_conversation,
    get_conversations,
    get_conversation,
    delete_conversation,
    update_conversation_title,
    add_message,
    get_messages,
    get_recent_messages,
    get_settings,
    save_settings,
    backup_conversation,
)
from memory import add_message_to_chroma, semantic_search, rerank
from search import web_search, format_search_results

MODEL = "docker.io/ai/gemma3:latest"
BASE_URL = "http://localhost:12434/engines/llama.cpp/v1"

ai = AsyncOpenAI(base_url=BASE_URL, api_key="unused")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cancel_events: dict[str, asyncio.Event] = {}


@app.on_event("startup")
async def startup():
    init_db()


# ── Pydantic models ──────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    request_id: str
    image_data: Optional[str] = None
    image_mime: Optional[str] = None


class SettingsUpdate(BaseModel):
    user_profile: str
    behavior_instructions: str


class PDFChunk(BaseModel):
    text: str
    chunk_index: int


# ── Conversation routes ───────────────────────────────────────────────────────

@app.get("/api/conversations")
async def list_conversations():
    return get_conversations()


@app.post("/api/conversations")
async def new_conversation(body: ConversationCreate):
    return create_conversation(body.title)


@app.get("/api/conversations/{conv_id}")
async def get_conv(conv_id: str):
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    messages = get_messages(conv_id)
    return {**conv, "messages": messages}


@app.delete("/api/conversations/{conv_id}")
async def del_conversation(conv_id: str):
    delete_conversation(conv_id)
    return {"ok": True}


@app.get("/api/conversations/{conv_id}/export")
async def export_conversation(conv_id: str):
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    messages = get_messages(conv_id)
    lines = [f"# {conv['title']}", f"*Created: {conv['created_at']}*", ""]
    for msg in messages:
        role = "**User**" if msg["role"] == "user" else "**Assistant**"
        lines += [f"{role} · {msg['created_at']}", "", msg["content"], "", "---", ""]
    content = "\n".join(lines)
    safe_title = "".join(c for c in conv["title"][:40] if c.isalnum() or c in " _-")
    return StreamingResponse(
        iter([content]),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.md"'},
    )


# ── Settings routes ───────────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_app_settings():
    return get_settings()


@app.post("/api/settings")
async def update_settings(body: SettingsUpdate):
    save_settings("user_profile", body.user_profile)
    save_settings("behavior_instructions", body.behavior_instructions)
    return {"ok": True}


# ── Upload routes ─────────────────────────────────────────────────────────────

@app.post("/api/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    content = await file.read()
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n\n".join(
                (page.extract_text() or "") for page in pdf.pages
            ).strip()
    except Exception as e:
        raise HTTPException(400, f"PDF parse error: {e}")

    if len(text) <= 6000:
        return {"mode": "full", "text": text, "length": len(text)}

    chunk_size = 800
    overlap = 150
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + chunk_size])
        i += chunk_size - overlap
    return {"mode": "chunked", "chunks": chunks, "length": len(text)}


# ── Cancel route ──────────────────────────────────────────────────────────────

@app.post("/api/cancel/{request_id}")
async def cancel_stream(request_id: str):
    ev = cancel_events.get(request_id)
    if ev:
        ev.set()
    return {"ok": True}


# ── Chat helpers ──────────────────────────────────────────────────────────────

async def _classify_for_search(message: str) -> bool:
    try:
        resp = await ai.chat.completions.create(
            model=MODEL,
            messages=[{
                "role": "user",
                "content": (
                    "Classify this message as SEARCH or SKIP.\n"
                    "SEARCH: needs current/real-time info, recent news, live data, specific facts.\n"
                    "SKIP: casual chat, math, coding, creative writing, follow-ups, opinions.\n\n"
                    f"Message: {message}\n\nReply with only SEARCH or SKIP."
                ),
            }],
            max_tokens=5,
            stream=False,
        )
        return "SEARCH" in resp.choices[0].message.content.upper()
    except Exception as e:
        print(f"[chat] classify error: {e}")
        return False


async def _get_rag_context(query: str, exclude_ids: list[str]) -> str:
    hits = await semantic_search(query, exclude_ids=exclude_ids, n_results=10)
    if not hits:
        return ""
    ranked = rerank(query, hits, top_k=4)
    if not ranked:
        return ""
    lines = ["[Relevant context from memory]"]
    for h in ranked:
        lines.append(f"- {h['text'][:350]}")
    return "\n".join(lines)


def _build_system_prompt(settings: dict) -> str:
    parts = ["You are a helpful AI assistant."]
    profile = (settings.get("user_profile") or "").strip()
    behavior = (settings.get("behavior_instructions") or "").strip()
    if profile:
        parts.append(f"User profile: {profile[:180]}")
    if behavior:
        parts.append(f"Behavior instructions: {behavior[:180]}")
    return "\n".join(parts)


def _build_api_messages(system: str, rag: str, search: str, history: list, current_msg: str, image_data: str | None, image_mime: str | None) -> list:
    api_msgs = [{"role": "system", "content": system}]
    if rag:
        api_msgs.append({"role": "system", "content": rag})
    if search:
        api_msgs.append({"role": "system", "content": search})
    for msg in history:
        if msg["image_data"] and msg["role"] == "user":
            api_msgs.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": msg["content"]},
                    {"type": "image_url", "image_url": {"url": msg["image_data"]}},
                ],
            })
        else:
            api_msgs.append({"role": msg["role"], "content": msg["content"]})
    if image_data and image_mime:
        api_msgs.append({
            "role": "user",
            "content": [
                {"type": "text", "text": current_msg},
                {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{image_data}"}},
            ],
        })
    else:
        api_msgs.append({"role": "user", "content": current_msg})
    return api_msgs


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    cancel_ev = asyncio.Event()
    cancel_events[req.request_id] = cancel_ev

    settings = get_settings()
    recent = get_recent_messages(req.conversation_id, limit=8)
    recent_ids = [m["id"] for m in recent]

    needs_search, rag = await asyncio.gather(
        _classify_for_search(req.message),
        _get_rag_context(req.message, recent_ids),
    )

    search_text = ""
    if needs_search:
        results = await web_search(req.message)
        search_text = format_search_results(results)

    system = _build_system_prompt(settings)
    api_msgs = _build_api_messages(
        system, rag, search_text, recent,
        req.message, req.image_data, req.image_mime,
    )

    image_url = (
        f"data:{req.image_mime};base64,{req.image_data}"
        if req.image_data and req.image_mime
        else None
    )
    user_msg = add_message(req.conversation_id, "user", req.message, image_url)

    all_msgs = get_messages(req.conversation_id)
    if len(all_msgs) == 1:
        update_conversation_title(req.conversation_id, req.message[:60])

    async def generate() -> AsyncGenerator[str, None]:
        full_response = ""
        try:
            yield f"data: {json.dumps({'type': 'meta', 'searching': needs_search})}\n\n"

            stream = await ai.chat.completions.create(
                model=MODEL,
                messages=api_msgs,
                stream=True,
                max_tokens=2048,
            )
            async for chunk in stream:
                if cancel_ev.is_set():
                    break
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_response += delta
                    yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        finally:
            cancel_events.pop(req.request_id, None)
            if full_response:
                asst_msg = add_message(req.conversation_id, "assistant", full_response)
                loop = asyncio.get_event_loop()
                loop.run_in_executor(None, _save_to_chroma, user_msg, req.message, asst_msg, full_response, req.conversation_id)
                loop.run_in_executor(None, backup_conversation, req.conversation_id)

    return StreamingResponse(generate(), media_type="text/event-stream")


def _save_to_chroma(user_msg: dict, user_text: str, asst_msg: dict, asst_text: str, conv_id: str):
    add_message_to_chroma(user_msg["id"], user_text, conv_id, "user", user_msg["created_at"])
    add_message_to_chroma(asst_msg["id"], asst_text, conv_id, "assistant", asst_msg["created_at"])
