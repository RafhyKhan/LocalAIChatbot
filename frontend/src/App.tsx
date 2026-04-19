import { useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "./types";
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  deleteConversation,
  streamChat,
} from "./api";
import Sidebar from "./components/Sidebar";
import ChatMessage from "./components/ChatMessage";
import InputArea from "./components/InputArea";
import "./index.css";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadList(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText]);

  async function loadList() {
    setConversations(await fetchConversations());
  }

  async function selectConv(id: string) {
    const data = await fetchConversation(id);
    setActiveId(id);
    setMessages(data.messages ?? []);
    setStreamText("");
  }

  async function newConv() {
    const c = await createConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setMessages([]);
    setStreamText("");
  }

  async function deleteConv(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  function send(message: string) {
    if (!activeId) return;

    // Optimistically show user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, created_at: new Date().toISOString() },
    ]);
    setStreaming(true);
    setStreamText("");
    setSearching(false);

    streamChat(
      activeId,
      message,
      (d) => { setSearching(false); setStreamText((t) => t + d); },
      async () => {
        setStreaming(false);
        setSearching(false);
        // Reload from file to get persisted state
        const data = await fetchConversation(activeId!);
        setMessages(data.messages ?? []);
        setStreamText("");
        loadList(); // refresh titles + order
      },
      (err) => { console.error(err); setStreaming(false); setStreamText(""); setSearching(false); },
      () => setSearching(true)
    );
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConv}
        onNew={newConv}
        onDelete={deleteConv}
      />

      <main className="chat-main">
        {!activeId ? (
          <div className="welcome">
            <h1 className="welcome-heading">What can I help with?</h1>
            <p className="welcome-sub">Powered by Gemma 4 · Running locally via Docker</p>
            <button className="welcome-btn" onClick={newConv}>New conversation</button>
          </div>
        ) : (
          <>
            <div className="messages">
              {messages.map((m, i) => <ChatMessage key={i} message={m} />)}

              {searching && (
                <div className="msg-row msg-assistant">
                  <div className="bubble-assistant">
                    <span className="search-indicator">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Searching the web...
                    </span>
                  </div>
                </div>
              )}
              {streaming && !streamText && !searching && (
                <div className="msg-row msg-assistant">
                  <div className="bubble-assistant">
                    <span className="dots"><span /><span /><span /></span>
                  </div>
                </div>
              )}
              {streaming && streamText && (
                <div className="msg-row msg-assistant">
                  <div className="bubble-assistant" style={{ whiteSpace: "pre-wrap" }}>
                    {streamText}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <InputArea onSend={send} disabled={streaming} />
          </>
        )}
      </main>
    </div>
  );
}
