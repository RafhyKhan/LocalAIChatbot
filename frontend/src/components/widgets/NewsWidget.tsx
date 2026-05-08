/**
 * NewsWidget — Latest BBC News headlines from RSS via /api/news.
 * If BBC is unreachable the widget renders nothing (no error shown).
 * Self-contained: fetches its own data, handles loading + empty states.
 */
import "./NewsWidget.css";
import { useEffect, useState } from "react";
import { BASE } from "../../api";
import type { NewsItem, NewsData } from "../../widgetTypes";

export default function NewsWidget() {
  const [data, setData]       = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/news`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ items: [], source: "BBC News" }))
      .finally(() => setLoading(false));
  }, []);

  // Show nothing if BBC feed couldn't be reached
  if (!loading && (!data || data.items.length === 0)) return null;

  return (
    <div className="widget news-widget">
      <div className="widget-header">
        <span className="widget-title">📰 BBC News</span>
        <span className="widget-subtitle">Latest Headlines</span>
      </div>

      {loading && <div className="widget-placeholder">Loading headlines…</div>}

      {!loading && data && data.items.length > 0 && (
        <div className="news-list">
          {data.items.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
            >
              <span className="news-title">{item.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
