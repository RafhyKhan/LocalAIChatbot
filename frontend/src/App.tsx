import { useState, useEffect, useRef, useCallback } from 'react'
import type { Conversation, Message } from './types'
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  sendMessage,
  cancelStream,
} from './api/client'
import Sidebar from './components/Sidebar'
import Message_ from './components/Message'
import InputArea from './components/InputArea'
import SettingsPanel from './components/SettingsPanel'
import './App.css'

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const convs = await fetchConversations()
      setConversations(convs)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  async function selectConversation(id: string) {
    setSelectedId(id)
    setLoading(true)
    try {
      const conv = await fetchConversation(id)
      setMessages(conv.messages ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleNew() {
    const conv = await createConversation()
    setConversations(prev => [conv, ...prev])
    setSelectedId(conv.id)
    setMessages([])
  }

  function handleDeleted(id: string) {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      setMessages([])
    }
  }

  async function handleSend(text: string, imageData?: string, imageMime?: string, pdfContext?: string) {
    if (!selectedId || isStreaming) return

    const finalMessage = pdfContext ? `${text}\n\n${pdfContext}` : text

    const optimisticUser: Message = {
      id: crypto.randomUUID(),
      conversation_id: selectedId,
      role: 'user',
      content: text,
      image_data: imageData ? `data:${imageMime};base64,${imageData}` : null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticUser])

    const reqId = crypto.randomUUID()
    requestIdRef.current = reqId
    setIsStreaming(true)
    setStreamContent('')
    setIsSearching(false)

    let accumulated = ''

    await sendMessage(selectedId, finalMessage, reqId, {
      onMeta: (searching) => setIsSearching(searching),
      onToken: (token) => {
        accumulated += token
        setStreamContent(accumulated)
      },
      onDone: () => {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          conversation_id: selectedId,
          role: 'assistant',
          content: accumulated,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev.filter(m => m.id !== optimisticUser.id), optimisticUser, assistantMsg])
        setIsStreaming(false)
        setStreamContent('')
        setIsSearching(false)
        requestIdRef.current = null
        loadConversations()
      },
      onError: (err) => {
        console.error('Stream error:', err)
        setIsStreaming(false)
        setStreamContent('')
        setIsSearching(false)
      },
    }, imageData, imageMime)
  }

  async function handleStop() {
    if (requestIdRef.current) {
      await cancelStream(requestIdRef.current)
      requestIdRef.current = null
    }
    setIsStreaming(false)
    if (streamContent) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: selectedId ?? '',
        role: 'assistant',
        content: streamContent + ' [stopped]',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    }
    setStreamContent('')
    setIsSearching(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={selectConversation}
        onNew={handleNew}
        onDeleted={handleDeleted}
        onRefresh={loadConversations}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 52,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {selectedId
              ? (conversations.find(c => c.id === selectedId)?.title || 'Chat')
              : 'Local AI Chat'}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              opacity: 0.6,
              transition: 'opacity 0.15s',
              lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
          >
            ⚙
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20 }}>
          {!selectedId && (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Local AI Chat</div>
              <div style={{ fontSize: 13 }}>Select a conversation or start a new one</div>
            </div>
          )}

          {selectedId && loading && (
            <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {selectedId && !loading && messages.length === 0 && !isStreaming && (
            <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
              Start the conversation
            </div>
          )}

          {messages.map(msg => (
            <Message_ key={msg.id} message={msg} />
          ))}

          {isSearching && (
            <div style={{ padding: '4px 24px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>
                Searching the web…
              </span>
              <span className="search-dots" />
            </div>
          )}

          {isStreaming && streamContent !== undefined && (
            <Message_
              message={{
                id: '__streaming__',
                conversation_id: selectedId ?? '',
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
              }}
              isStreaming
              streamContent={streamContent}
            />
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {selectedId && (
          <InputArea
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={!selectedId}
          />
        )}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
