/**
 * MultiNewsWidget — accordion news reader.
 * Click a source name to expand its RSS headlines.
 * Click again to collapse. Only one source open at a time.
 */
import "./MultiNewsWidget.css";
import { useState } from "react";
import { BASE } from "../../api";
import type { NewsItem } from "../../widgetTypes";

interface SourceState {
  items:   NewsItem[];
  loading: boolean;
  loaded:  boolean;
  error:   boolean;
}

const SOURCES = [
  { key: "bbc",       label: "BBC News",          url: "https://www.bbc.com/news"          },
  { key: "reuters",   label: "Reuters",            url: "https://www.reuters.com"           },
  { key: "ap",        label: "Associated Press",   url: "https://apnews.com"                },
  { key: "aljazeera", label: "Al Jazeera",         url: "https://www.aljazeera.com"         },
  { key: "cbc",       label: "CBC News",           url: "https://www.cbc.ca/news"           },
  { key: "ctv",       label: "CTV News",           url: "https://www.ctvnews.ca"            },
  { key: "calgary",   label: import.meta.env.VITE_LOCAL_NEWS_LABEL || "Local News", url: import.meta.env.VITE_LOCAL_NEWS_URL || "" },
];

export default function MultiNewsWidget() {
  const [open,   setOpen]   = useState<string | null>(null);
  const [cache,  setCache]  = useState<Record<string, SourceState>>({});

  function toggle(key: string) {
    // Collapse if already open
    if (open === key) {
      setOpen(null);
      return;
    }

    setOpen(key);

    // Already loaded — just show cached
    if (cache[key]?.loaded) return;

    // Mark as loading
    setCache((prev) => ({
      ...prev,
      [key]: { items: [], loading: true, loaded: false, error: false },
    }));

    fetch(`${BASE}/api/multinews/${key}`)
      .then((r) => r.json())
      .then((d) => setCache((prev) => ({
        ...prev,
        [key]: { items: d.items ?? [], loading: false, loaded: true, error: false },
      })))
      .catch(() => setCache((prev) => ({
        ...prev,
        [key]: { items: [], loading: false, loaded: true, error: true },
      })));
  }

  return (
    <div className="widget mnews-widget">
      <div className="widget-header">
        <span className="widget-title">🌍 World News</span>
        <span className="widget-subtitle">Select a source</span>
      </div>

      <div className="mnews-list">
        {SOURCES.map((src) => {
          const isOpen = open === src.key;
          const state  = cache[src.key];

          return (
            <div key={src.key} className="mnews-source">

              {/* Source row — always visible */}
              <button
                className={`mnews-source-row${isOpen ? " mnews-source-open" : ""}`}
                onClick={() => toggle(src.key)}
              >
                <span className="mnews-source-label">{src.label}</span>
                <div className="mnews-source-right">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mnews-source-link"
                    title={`Visit ${src.label}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                  <span className="mnews-source-chevron">{isOpen ? "▾" : "›"}</span>
                </div>
              </button>

              {/* Expanded headlines */}
              {isOpen && (
                <div className="mnews-headlines">
                  {state?.loading && (
                    <div className="mnews-loading">Loading…</div>
                  )}
                  {state?.error && (
                    <div className="mnews-error">Could not load feed.</div>
                  )}
                  {state?.loaded && !state.error && state.items.length === 0 && (
                    <div className="mnews-error">No RSS Feed available.</div>
                  )}
                  {state?.items.map((item, i) => (
                    <a
                      key={i}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mnews-item"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
