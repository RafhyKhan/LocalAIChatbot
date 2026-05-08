/**
 * BookmarksWidget — personal URL bookmarks stored in localStorage.
 * No backend, no AI. Paste a URL, press Add (or Enter), it persists forever.
 * Self-contained: all state lives in this component + localStorage.
 */
import "./BookmarksWidget.css";
import { useState } from "react";

interface Bookmark {
  url: string;
  label: string;
}

const STORAGE_KEY = "rainai_bookmarks";

function loadBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveBookmarks(bm: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bm));
}

export default function BookmarksWidget() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [input, setInput]         = useState("");

  function add() {
    const raw = input.trim();
    if (!raw) return;
    const url   = raw.startsWith("http") ? raw : `https://${raw}`;
    const label = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const next  = [...bookmarks, { url, label }];
    setBookmarks(next);
    saveBookmarks(next);
    setInput("");
  }

  function remove(idx: number) {
    const next = bookmarks.filter((_, i) => i !== idx);
    setBookmarks(next);
    saveBookmarks(next);
  }

  return (
    <div className="widget bookmarks-widget">
      <div className="widget-header">
        <span className="widget-title">🔖 Bookmarks</span>
      </div>

      <div className="bookmark-input-row">
        <input
          className="bookmark-input"
          placeholder="Paste a URL and press Enter…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="bookmark-add" onClick={add}>Add</button>
      </div>

      <div className="bookmark-list">
        {bookmarks.length === 0 && (
          <p className="bookmark-empty">No bookmarks yet.</p>
        )}
        {bookmarks.map((b, i) => (
          <div key={i} className="bookmark-item">
            <a
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bookmark-link"
              title={b.url}
            >
              {b.label}
            </a>
            <button
              className="bookmark-remove"
              onClick={() => remove(i)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
