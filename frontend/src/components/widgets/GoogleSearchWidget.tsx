/**
 * GoogleSearchWidget — compact search bar that opens Google in a new tab.
 * Queue mode: toggle BG to queue multiple searches, then Go opens all at once.
 * No backend, no API. Pure frontend.
 */
import { useState } from "react";

export default function GoogleSearchWidget() {
  const [query,     setQuery]     = useState("");
  const [queueMode, setQueueMode] = useState(false);
  const [queued,    setQueued]    = useState<string[]>([]);

  function handleEnter() {
    const q = query.trim();
    if (!q) return;

    if (queueMode) {
      // Add to queue instead of opening
      setQueued((prev) => [...prev, q]);
      setQuery("");
    } else {
      // Open immediately
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank");
      setQuery("");
    }
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
      if (v) {
        // Turning off — clear queue without opening
        setQueued([]);
      }
      return !v;
    });
  }

  return (
    <div className="widget google-search-widget">
      <div className="google-search-row">
        <svg className="google-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="google-search-input"
          placeholder={queueMode ? "Add to queue, press Enter…" : "Search Google…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnter()}
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
      </div>

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
