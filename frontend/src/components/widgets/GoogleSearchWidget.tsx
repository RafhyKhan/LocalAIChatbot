/**
 * GoogleSearchWidget — compact search bar with Chrome bookmark autocomplete.
 * - Type to search Google or filter saved bookmarks
 * - Click a bookmark suggestion to open it directly
 * - BG toggle: queue multiple searches, open all at once
 */
import { useState, useEffect, useRef } from "react";
import { BASE } from "../../api";

interface Bookmark {
  title: string;
  url:   string;
}

export default function GoogleSearchWidget() {
  const [query,         setQuery]         = useState("");
  const [queueMode,     setQueueMode]     = useState(false);
  const [queued,        setQueued]        = useState<string[]>([]);
  const [bmMode,        setBmMode]        = useState(false);  // bookmark search toggle — default off
  const [bookmarks,     setBookmarks]     = useState<Bookmark[]>([]);
  const [suggestions,   setSuggestions]   = useState<Bookmark[]>([]);
  const [showDrop,      setShowDrop]      = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load bookmarks only when BM mode is first enabled
  useEffect(() => {
    if (!bmMode || bookmarks.length > 0) return;
    fetch(`${BASE}/api/bookmarks`)
      .then((r) => r.json())
      .then((d) => setBookmarks(d.bookmarks ?? []))
      .catch(() => {});
  }, [bmMode]);

  // Filter bookmarks as user types (only when BM mode is on)
  useEffect(() => {
    if (!bmMode) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }
    const matches = bookmarks
      .filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q)
      )
      .slice(0, 6);
    setSuggestions(matches);
    setShowDrop(matches.length > 0);
  }, [query, bookmarks, bmMode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleEnter() {
    const q = query.trim();
    if (!q) return;
    setShowDrop(false);

    if (queueMode) {
      setQueued((prev) => [...prev, q]);
      setQuery("");
    } else {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank");
      setQuery("");
    }
  }

  function openBookmark(url: string) {
    window.open(url, "_blank");
    setQuery("");
    setShowDrop(false);
  }

  function openAll() {
    if (queued.length === 0) return;
    queued.forEach((q) =>
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank")
    );
    setQueued([]);
    setQueueMode(false);
  }

  function removeQueued(idx: number) {
    setQueued((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleQueueMode() {
    setQueueMode((v) => {
      if (v) setQueued([]);
      return !v;
    });
  }

  // Shorten URL for display
  function shortUrl(url: string) {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
  }

  return (
    <div className="widget google-search-widget" ref={wrapRef}>
      <div className="google-search-row">
        <svg className="google-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="google-search-input"
          placeholder={queueMode ? "Add to queue, press Enter…" : "Search Google or bookmarks…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDrop(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEnter();
            if (e.key === "Escape") setShowDrop(false);
          }}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          autoComplete="off"
        />
        <button
          className="google-search-btn"
          onClick={queueMode ? openAll : handleEnter}
          disabled={queueMode ? queued.length === 0 : !query.trim()}
          title={queueMode ? `Open all ${queued.length} tabs` : "Search"}
        >
          {queueMode ? `Go (${queued.length})` : "Go"}
        </button>
        <button
          className={`google-bg-toggle${queueMode ? " google-bg-toggle-on" : ""}`}
          onClick={toggleQueueMode}
          title={queueMode ? "Queue mode ON — click to cancel" : "Queue mode OFF — click to enable"}
        >
          BG
        </button>
        <button
          className={`google-bg-toggle${bmMode ? " google-bg-toggle-on" : ""}`}
          onClick={() => setBmMode((v) => !v)}
          title={bmMode ? "Bookmark search ON — click to disable" : "Bookmark search OFF — click to enable"}
        >
          🔖
        </button>
      </div>

      {/* Bookmark suggestions dropdown */}
      {showDrop && suggestions.length > 0 && (
        <div className="google-suggestions">
          {suggestions.map((b, i) => (
            <button
              key={i}
              className="google-suggestion-item"
              onClick={() => openBookmark(b.url)}
            >
              <span className="google-suggestion-icon">🔖</span>
              <span className="google-suggestion-title">{b.title}</span>
              <span className="google-suggestion-url">{shortUrl(b.url)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Queue pills */}
      {queued.length > 0 && (
        <div className="google-queue">
          {queued.map((q, i) => (
            <span key={i} className="google-queue-pill">
              {q}
              <button className="google-queue-remove" onClick={() => removeQueued(i)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
