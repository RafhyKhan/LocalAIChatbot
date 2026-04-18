import type { Conversation, Message, Settings } from '../types'

const BASE = ''

export async function fetchConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/api/conversations`)
  if (!r.ok) throw new Error('Failed to fetch conversations')
  return r.json()
}

export async function createConversation(title = 'New Conversation'): Promise<Conversation> {
  const r = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!r.ok) throw new Error('Failed to create conversation')
  return r.json()
}

export async function fetchConversation(id: string): Promise<Conversation & { messages: Message[] }> {
  const r = await fetch(`${BASE}/api/conversations/${id}`)
  if (!r.ok) throw new Error('Failed to fetch conversation')
  return r.json()
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE}/api/conversations/${id}`, { method: 'DELETE' })
}

export async function exportConversation(id: string, title: string): Promise<void> {
  const r = await fetch(`${BASE}/api/conversations/${id}/export`)
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.slice(0, 40)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchSettings(): Promise<Settings> {
  const r = await fetch(`${BASE}/api/settings`)
  if (!r.ok) throw new Error('Failed to fetch settings')
  return r.json()
}

export async function saveSettings(settings: Settings): Promise<void> {
  await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}

export async function cancelStream(requestId: string): Promise<void> {
  await fetch(`${BASE}/api/cancel/${requestId}`, { method: 'POST' })
}

export async function uploadPDF(file: File): Promise<{ mode: string; text?: string; chunks?: string[]; length: number }> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/api/upload/pdf`, { method: 'POST', body: form })
  if (!r.ok) throw new Error('PDF upload failed')
  return r.json()
}

export interface StreamCallbacks {
  onMeta: (searching: boolean) => void
  onToken: (token: string) => void
  onDone: () => void
  onError: (msg: string) => void
}

export async function sendMessage(
  conversationId: string,
  message: string,
  requestId: string,
  callbacks: StreamCallbacks,
  imageData?: string,
  imageMime?: string,
): Promise<void> {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
      request_id: requestId,
      image_data: imageData ?? null,
      image_mime: imageMime ?? null,
    }),
  })

  if (!r.ok || !r.body) {
    callbacks.onError('Connection failed')
    return
  }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        if (data.type === 'meta') callbacks.onMeta(data.searching)
        else if (data.type === 'token') callbacks.onToken(data.content)
        else if (data.type === 'done') callbacks.onDone()
        else if (data.type === 'error') callbacks.onError(data.message)
      } catch {
        // skip malformed chunk
      }
    }
  }
}
