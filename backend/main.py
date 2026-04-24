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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

import conversations as conv_store
import memory
import database as db
import search as searcher
import calculator as calc

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

RECENT_WINDOW = 8
SEMANTIC_K    = 5

# All tools available to Gemma — combined into one list for the API call
ALL_TOOLS = searcher.SEARCH_TOOLS + calc.CALCULATOR_TOOLS

# System prompt — tells Gemma upfront what it can do and how to behave
SYSTEM_PROMPT = (
    "You are a helpful, concise assistant, to Rafhy Khan."
    "You are in Calgary, Alberta, Canada."
    "\n\n"
    "You have access to real-time web search."
    "When asked about current events, news, prices, sports, weather, or anything "
    "that requires up-to-date information, you will search the web automatically. "
    "Never say you cannot access the internet or that your knowledge has a cutoff — "
    "you can and should search the web when needed. "
    "If you searched, mention what you found. "
    "\n\n"
    "You also have access to a precise calculator tool. "
    "ALWAYS use the calculator tool for any mathematical computation — "
    "never attempt arithmetic, algebra, or numerical reasoning yourself. "
    "You make math errors; the calculator does not."
)


class ChatRequest(BaseModel):
    conversation_id: str
    message: str


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

    system_parts = [SYSTEM_PROMPT]

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

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
