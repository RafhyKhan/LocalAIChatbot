import type { Conversation, ConversationDetail } from "./types";

export const BASE = "http://localhost:8000";

export async function fetchConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/api/conversations`);
  return r.json();
}

export async function createConversation(): Promise<Conversation> {
  const r = await fetch(`${BASE}/api/conversations`, { method: "POST" });
  return r.json();
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  const r = await fetch(`${BASE}/api/conversations/${id}`);
  return r.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE}/api/conversations/${id}`, { method: "DELETE" });
}

export async function fetchTokens(id: string): Promise<{ used: number; limit: number; remaining: number }> {
  const r = await fetch(`${BASE}/api/conversations/${id}/tokens`);
  return r.json();
}

export function streamChat(
  conversationId: string,
  message: string,
  onDelta: (d: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
  onSearching?: () => void,
  onCalculating?: () => void,
  onSources?: (urls: string[]) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const dec = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.delta)       onDelta(data.delta);
          else if (data.done)   { if (onSources && data.sources?.length) onSources(data.sources); onDone(); }
          else if (data.error)  onError(data.error);
          else if (data.searching   && onSearching)   onSearching();
          else if (data.calculating && onCalculating) onCalculating();
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") onError(e.message);
    }
  })();

  return () => controller.abort();
}
