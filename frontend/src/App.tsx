import { useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "./types";
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  deleteConversation,
  fetchTokens,
  fetchContextPreview,
  streamChat,
} from "./api";
import type { ImageAttachment } from "./api";
import Sidebar      from "./components/Sidebar";
import Dashboard     from "./components/Dashboard";
import ChatMessage   from "./components/ChatMessage";
import InputArea     from "./components/InputArea";
import SettingsPage  from "./components/SettingsPage";
import Overlay       from "./components/Overlay";
import "./index.css";

export default function App() {
  const [page, setPage]           = useState<"dashboard" | "chat" | "settings">("dashboard");
  const [overlayVisible, setOverlayVisible] = useState(true); // always starts visible
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [searching, setSearching] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [sessionImages, setSessionImages] = useState<Record<number, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<(() => void) | null>(null);

  useEffect(() => { loadList(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText]);

  // ── Idle overlay ──────────────────────────────────────────────────────────
  useEffect(() => {
    const minutes = parseFloat(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? "5");
    const ms      = minutes * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => setOverlayVisible(true), ms);
    }

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer on mount

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, []);

  async function loadList() {
    setConversations(await fetchConversations());
  }

  async function selectConv(id: string) {
    const data = await fetchConversation(id);
    setActiveId(id);
    setMessages(data.messages ?? []);
    setStreamText("");
    setSessionImages({});
    setTokenInfo(await fetchTokens(id));
    setPage("chat"); // clicking a conversation always goes to chat
  }

  async function newConv() {
    const c = await createConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setMessages([]);
    setStreamText("");
    setTokenInfo(null);
  }

  async function deleteConv(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  function send(message: string, image: ImageAttachment | null = null, previewUrl?: string) {
    if (!activeId) return;

    // Store preview URL keyed by the index this message will occupy
    if (previewUrl) {
      setMessages(prev => {
        setSessionImages(imgs => ({ ...imgs, [prev.length]: previewUrl }));
        return prev;
      });
    }

    // Optimistically show user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, created_at: new Date().toISOString() },
    ]);
    setStreaming(true);
    setStreamText("");
    setSearching(false);
    setCalculating(false);
    setSources([]);

    const abort = streamChat(
      activeId,
      message,
      image,
      (d) => { setSearching(false); setCalculating(false); setStreamText((t) => t + d); },
      async () => {
        abortRef.current = null;
        setStreaming(false);
        setSearching(false);
        setCalculating(false);
        // Reload from file to get persisted state
        const data = await fetchConversation(activeId!);
        setMessages(data.messages ?? []);
        setStreamText("");
        loadList(); // refresh titles + order
        setTokenInfo(await fetchTokens(activeId!));
      },
      (err) => { abortRef.current = null; console.error(err); setStreaming(false); setStreamText(""); setSearching(false); setCalculating(false); },
      () => setSearching(true),
      () => setCalculating(true),
      (urls) => setSources(urls)
    );
    abortRef.current = abort;
  }

  async function handleLiveUpdate() {
    if (!activeId || streaming) return;
    const text = await fetchContextPreview();
    send(text);
  }

  function handleStop() {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
    setStreamText("");
    setSearching(false);
    setCalculating(false);
  }

  return (
    <div className="app">

      {/* ── Overlay — always in DOM, CSS transition handles show/hide ── */}
      <Overlay visible={overlayVisible} onDismiss={() => setOverlayVisible(false)} />

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConv}
        onNew={newConv}
        onDelete={deleteConv}
        page={page}
        onPageChange={setPage}
        onLiveUpdate={handleLiveUpdate}
        onOpenSettings={() => setPage("settings")}
      />

      {page === "settings" ? (
        <SettingsPage onBack={() => setPage("dashboard")} />
      ) : page === "dashboard" ? (
        <Dashboard onShowOverlay={() => setOverlayVisible(true)} />
      ) : (
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
              {messages.map((m, i) => (
                <ChatMessage key={i} message={m} imagePreviewUrl={m.role === "user" ? sessionImages[i] : undefined} />
              ))}

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
              {calculating && (
                <div className="msg-row msg-assistant">
                  <div className="bubble-assistant">
                    <span className="search-indicator">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15" x2="11" y2="15"/></svg>
                      Calculating...
                    </span>
                  </div>
                </div>
              )}
              {streaming && !streamText && !searching && !calculating && (
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
              {!streaming && sources.length > 0 && (
                <div className="msg-row msg-assistant">
                  <div className="bubble-assistant">
                    <div className="source-list">
                      <p className="source-list-label">Sources</p>
                      {sources.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">{url}</a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <InputArea onSend={(msg, img, url) => send(msg, img ?? null, url)} onStop={handleStop} disabled={streaming} tokenInfo={tokenInfo} />
          </>
        )}
      </main>
      )}
    </div>
  );
}
