"""
Chat endpoint: streaming response with tool-call loop.
Also hosts the token-count endpoint (depends on RECENT_WINDOW + SYSTEM_PROMPT).
"""
import asyncio
import json
import logging
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from shared import (
    client, MODEL, ALL_TOOLS, SYSTEM_PROMPT,
    RECENT_WINDOW, SEMANTIC_K, CURRENT_LOCATION,
)
from models import ChatRequest
import conversations as conv_store
import memory
import search    as searcher
import calculator as calc
import datetool
import unittool
import browsertool
import weathertool

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Title generation ──────────────────────────────────────────────────────────

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


# ── Context builder ───────────────────────────────────────────────────────────

def _build_base_messages(conv_id: str, user_message: str) -> list[dict]:
    """
    Build the starting message list for each request:
      system prompt → current time → semantic memory → recent conversation → user message

    Web search and calculation are NOT done here — Gemma decides via tool calling.
    """
    recent     = conv_store.get_recent_messages(conv_id, limit=RECENT_WINDOW)
    recent_ids = {m["id"] for m in recent}

    relevant = memory.search(
        query=user_message,
        n_results=SEMANTIC_K,
        exclude_msg_ids=recent_ids,
    )

    _tz      = os.getenv("USER_TIMEZONE", "UTC")
    _loc     = os.getenv("USER_LOCATION_SHORT", CURRENT_LOCATION)
    now      = datetime.now(ZoneInfo(_tz))
    time_str = now.strftime("%A, %B %d, %Y · %I:%M %p %Z")
    system_parts = [SYSTEM_PROMPT]

    system_parts.append(
        f"\nThe current date and time in {_loc} is: {time_str}. "
        "This is exact and authoritative — do NOT search the web for the current time or date. "
        "Use this value directly when asked."
    )

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


# ── Tool executor ─────────────────────────────────────────────────────────────

async def _execute_tool(name: str, arguments: str) -> str:
    """
    Dispatch a tool call by name and return its string result.
    Adding a new tool only requires adding a branch here and to ALL_TOOLS in shared.py.
    """
    args = json.loads(arguments)

    if name == "web_search":
        return await searcher.web_search(args.get("query", ""))

    if name == "calculate":
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
        return weathertool.get_weather(args.get("location", CURRENT_LOCATION))

    return f"Unknown tool: {name}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/conversations/{conv_id}/tokens")
def get_token_count(conv_id: str):
    """
    Estimate the number of tokens currently used by this conversation's context.
    Uses a chars÷4 approximation. Counts: system prompt + last RECENT_WINDOW messages.
    """
    data = conv_store.get_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")

    recent = conv_store.get_recent_messages(conv_id, limit=RECENT_WINDOW)
    total_chars = len(SYSTEM_PROMPT) + sum(len(m["content"]) for m in recent)
    used  = total_chars // 4
    limit = 32000
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}


@router.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    data = conv_store.get_conversation(req.conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_first = len(data["messages"]) == 0
    messages = _build_base_messages(req.conversation_id, req.message)
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
        all_sources: list[str] = []

        try:
            while True:
                response = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=ALL_TOOLS,
                    tool_choice="auto",
                    stream=False,
                    extra_body={"num_ctx": 32768},
                )

                tool_calls = response.choices[0].message.tool_calls

                if not tool_calls:
                    final_content = response.choices[0].message.content or ""
                    break

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

                for tc in tool_calls:
                    name = tc.function.name

                    if name == "web_search":
                        yield f"data: {json.dumps({'searching': True})}\n\n"
                    elif name == "calculate":
                        yield f"data: {json.dumps({'calculating': True})}\n\n"

                    result = await _execute_tool(name, tc.function.arguments)

                    if name == "web_search":
                        all_sources.extend(re.findall(r'https?://[^\s]+', result))

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })

                if await request.is_disconnected():
                    return

            # ── Stream final response ─────────────────────────────
            if final_content is not None:
                full = final_content
                if full:
                    yield f"data: {json.dumps({'delta': full})}\n\n"
            else:
                stream_resp = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=True,
                    extra_body={"num_ctx": 32768},
                )
                async for chunk in stream_resp:
                    if await request.is_disconnected():
                        return
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full += delta
                        yield f"data: {json.dumps({'delta': delta})}\n\n"

            conv_store.add_message(req.conversation_id, "assistant", full)

            if is_first:
                asyncio.create_task(
                    _generate_title(req.conversation_id, req.message, full)
                )

            yield f"data: {json.dumps({'done': True, 'sources': all_sources})}\n\n"

        except Exception as e:
            logger.exception("Error during chat stream for conversation %s", req.conversation_id)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
