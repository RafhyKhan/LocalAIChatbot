import asyncio
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI
import conversations as conv_store

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI(
    base_url="http://localhost:12434/v1",
    api_key="not-needed",
)
MODEL = "docker.io/ai/gemma4:E2B"


class ChatRequest(BaseModel):
    conversation_id: str
    message: str


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


async def _generate_title(conv_id: str, first_message: str):
    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Generate a short title (under 50 chars, no quotes) "
                        "summarising the user's message in one phrase."
                    ),
                },
                {"role": "user", "content": first_message},
            ],
            max_tokens=20,
            stream=False,
        )
        title = resp.choices[0].message.content.strip().strip('"').strip("'")
        if title:
            conv_store.update_title(conv_id, title[:60])
    except Exception:
        pass


@app.post("/api/chat")
async def chat(req: ChatRequest):
    data = conv_store.get_conversation(req.conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_first = len(data["messages"]) == 0

    # Build history for the model
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in data["messages"]
    ]
    history.append({"role": "user", "content": req.message})

    # Save the user message to file
    conv_store.append_message(req.conversation_id, "user", req.message)

    async def stream():
        full = ""
        try:
            stream = await client.chat.completions.create(
                model=MODEL,
                messages=history,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full += delta
                    yield f"data: {json.dumps({'delta': delta})}\n\n"

            conv_store.append_message(req.conversation_id, "assistant", full)

            if is_first:
                asyncio.create_task(_generate_title(req.conversation_id, req.message))

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
