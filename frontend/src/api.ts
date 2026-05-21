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

export async function renameConversation(id: string, title: string): Promise<void> {
  await fetch(`${BASE}/api/conversations/${id}/title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function fetchArchivedConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/api/conversations/archived`);
  return r.json();
}

export async function restoreConversation(id: string): Promise<void> {
  await fetch(`${BASE}/api/conversations/${id}/restore`, { method: "POST" });
}

export async function fetchTokens(id: string): Promise<{ used: number; limit: number; remaining: number }> {
  const r = await fetch(`${BASE}/api/conversations/${id}/tokens`);
  return r.json();
}

export async function fetchProfile(): Promise<string> {
  const r = await fetch(`${BASE}/api/profile`);
  const d = await r.json();
  return d.content ?? "";
}

export async function saveProfile(content: string): Promise<void> {
  await fetch(`${BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function fetchContextPreview(): Promise<string> {
  const r = await fetch(`${BASE}/api/context-preview`);
  const d = await r.json();
  return d.text ?? "";
}

export interface RagDocument {
  name:   string;
  chunks: number;
}

export async function fetchRagDocuments(): Promise<RagDocument[]> {
  const r = await fetch(`${BASE}/api/rag/documents`);
  const d = await r.json();
  return d.documents ?? [];
}

export async function triggerRagIndex(): Promise<{ started: boolean; message: string }> {
  const r = await fetch(`${BASE}/api/rag/index`, { method: "POST" });
  return r.json();
}

export async function fetchRagIndexStatus(): Promise<{
  running: boolean;
  results: { name: string; status: string; chunks?: number; error?: string }[];
}> {
  const r = await fetch(`${BASE}/api/rag/index/status`);
  return r.json();
}

export async function deleteRagDocument(filename: string): Promise<void> {
  const r = await fetch(`${BASE}/api/rag/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail ?? `Delete failed (${r.status})`);
  }
}

export interface ImageAttachment {
  data: string;  // base64, no data-URI prefix
  mime: string;  // e.g. "image/jpeg"
}

export function streamChat(
  conversationId: string,
  message: string,
  image: ImageAttachment | null,
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
      const body: Record<string, unknown> = { conversation_id: conversationId, message };
      if (image) { body.image_data = image.data; body.image_mime = image.mime; }

      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
