"""
FastAPI backend — the central hub of the app.

Request flow for each chat message:
  1. Build context     → system prompt + semantic memory (ChromaDB) + recent messages
  2. Tool-call check   → send to Gemma WITH web_search tool defined (non-streaming)
                         Gemma decides itself whether to call web_search()
  3. Execute search    → if Gemma called the tool, run SearXNG and return results
  4. Stream response   → final answer streamed back to the frontend
  5. Persist result    → SQLite + ChromaDB + .txt file
  6. Title             → generated after the very first exchange
"""

import asyncio
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

import conversations as conv_store   # coordinates all three storage layers
import memory                         # ChromaDB semantic search + FlashRank reranking
import database as db                 # SQLite structured storage
import search as searcher             # SearXNG client + SEARCH_TOOLS definition

app = FastAPI()

# Allow the React frontend (Vite dev server on 5173) to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite tables on startup (safe — uses IF NOT EXISTS)
db.init_db()

# Gemma 4 running locally via Docker Desktop AI — OpenAI-compatible endpoint
client = AsyncOpenAI(
    base_url="http://localhost:12434/v1",
    api_key="not-needed",
)
MODEL = "docker.io/ai/gemma4:E2B"

RECENT_WINDOW = 8   # last N messages always included verbatim in context
SEMANTIC_K    = 5   # top-K results from ChromaDB after FlashRank reranking

# System prompt — sent with every request.
# Explicitly declares web search capability upfront so Gemma doesn't refuse.
# Uses the user's exact wording to be as direct as possible.
SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "You have access to real-time web search. "
    "When asked about current events, news, prices, sports, weather, or anything "
    "that requires up-to-date information, you will search the web automatically. "
    "Never say you cannot access the internet or that your knowledge has a cutoff — "
    "you can and should search when needed. "
    "If you searched, mention what you found."
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


# ── Title generation ──────────────────────────────────────────────

async def _generate_title(conv_id: str, user_message: str, assistant_reply: str):
    """
    Fire-and-forget: generates a short conversation title after the first exchange.
    Passes both sides of the conversation so the title reflects the actual topic
    rather than just rephrasing the opening question.
    """
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
        pass  # non-critical — skip silently on failure


# ── Context builder ───────────────────────────────────────────────

def _build_base_messages(conv_id: str, user_message: str) -> list[dict]:
    """
    Build the base message list: system prompt + semantic memory + recent window.
    Web search is NOT handled here — it's handled via tool calling in chat().

    Layers:
      1. System prompt  — declares capabilities, sets behaviour
      2. Semantic memory — top-K relevant past messages from ChromaDB (reranked)
      3. Recent window   — last RECENT_WINDOW messages verbatim
      4. User message    — the new message, appended last
    """

    # Recent messages from SQLite — always included verbatim ("working memory")
    recent = conv_store.get_recent_messages(conv_id, limit=RECENT_WINDOW)

    # SQLite IDs of recent messages — used to exclude them from ChromaDB results
    # so the same message isn't injected twice
    recent_ids = {m["id"] for m in recent}

    # Semantic recall: ANN retrieval → distance filter → FlashRank reranking → top-K
    relevant = memory.search(
        query=user_message,
        n_results=SEMANTIC_K,
        exclude_msg_ids=recent_ids,
    )

    # Start with the base system prompt
    system_parts = [SYSTEM_PROMPT]

    if relevant:
        # Tag each snippet with its origin (this conversation vs. past conversation)
        snippets = []
        for r in relevant:
            label = "User" if r["role"] == "user" else "Assistant"
            tag = "(this conversation)" if r["conversation_id"] == conv_id else "(past conversation)"
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


# ── Chat endpoint ─────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    data = conv_store.get_conversation(req.conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_first = len(data["messages"]) == 0

    # Build base context before persisting user message to avoid including it
    # in the recent window or ChromaDB lookup
    base_messages = _build_base_messages(req.conversation_id, req.message)

    # Persist user message to SQLite + txt + ChromaDB
    conv_store.add_message(req.conversation_id, "user", req.message)

    async def stream():
        """
        Tool-calling chat flow:

        Step 1 — Send base messages to Gemma WITH the web_search tool defined.
                  Gemma decides itself whether to call the tool.
                  This call is NON-streaming so we can inspect the response.

        Step 2 — If Gemma emitted a tool_call:
                    a. Notify frontend ("Searching the web...")
                    b. Execute web_search() against SearXNG
                    c. Append the tool result to the message list
                    d. Stream the final response (Gemma now has the search results)

        Step 3 — If no tool_call:
                    Yield the response content directly — no second API call needed.
        """
        full = ""
        try:
            # ── Step 1: Tool-call check (non-streaming) ───────────────
            # Sending SEARCH_TOOLS lets Gemma call web_search() if it decides to.
            # tool_choice="auto" lets Gemma decide freely — it won't be forced.
            tool_response = await client.chat.completions.create(
                model=MODEL,
                messages=base_messages,
                tools=searcher.SEARCH_TOOLS,
                tool_choice="auto",
                stream=False,
            )

            tool_calls = tool_response.choices[0].message.tool_calls

            if tool_calls:
                # ── Step 2: Gemma chose to search ────────────────────
                yield f"data: {json.dumps({'searching': True})}\n\n"

                # Build the follow-up message list:
                # original messages + Gemma's tool_call message + our tool result
                follow_up = list(base_messages)

                # Append Gemma's assistant message (contains the tool_call request)
                follow_up.append({
                    "role": "assistant",
                    "content": tool_response.choices[0].message.content or "",
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

                # Execute each tool call and append the result as a tool message
                for tc in tool_calls:
                    if tc.function.name == "web_search":
                        args  = json.loads(tc.function.arguments)
                        query = args.get("query", req.message)
                        results = await searcher.web_search(query)

                        # Tool result sent back to Gemma — must reference the tool_call_id
                        follow_up.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": results,
                        })

                # Stream the final response — Gemma now has the search results in context
                final = await client.chat.completions.create(
                    model=MODEL,
                    messages=follow_up,
                    stream=True,
                )
                async for chunk in final:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full += delta
                        yield f"data: {json.dumps({'delta': delta})}\n\n"

            else:
                # ── Step 3: No search needed — yield response directly ─
                # Gemma already generated the full response in Step 1.
                # Yield it as a single delta so the frontend renders it immediately.
                content = tool_response.choices[0].message.content or ""
                full = content
                if full:
                    yield f"data: {json.dumps({'delta': full})}\n\n"

            # Persist the assistant response to all three stores
            conv_store.add_message(req.conversation_id, "assistant", full)

            # Fire-and-forget title generation after the first exchange
            if is_first:
                asyncio.create_task(
                    _generate_title(req.conversation_id, req.message, full)
                )

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
