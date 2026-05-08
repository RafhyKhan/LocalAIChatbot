/**
 * PhilosopherWidget — latest Philosopher of the Month posts from OUP Blog.
 * Proxied through the backend (/api/philosopher) to avoid CORS restrictions.
 * Shows the most recent post prominently, with 2 previous posts below.
 *
 * Source: https://blog.oup.com/category/arts_and_humanities/philosopher-of-the-month/
 */

import "./PhilosopherWidget.css";
import { useEffect, useState } from "react";
import { BASE } from "../../api";

interface PhilosopherPost {
  title:    string;
  link:     string;
  pub_date: string;
  excerpt:  string;
}

function formatPubDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString([], { year: "numeric", month: "long" });
  } catch {
    return raw;
  }
}

export default function PhilosopherWidget() {
  const [posts,   setPosts]   = useState<PhilosopherPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/philosopher`)
      .then((r) => r.json())
      .then((d) => setPosts(d.items ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  // Show nothing if feed couldn't be reached
  if (!loading && posts.length === 0) return null;

  const [latest, ...previous] = posts;

  return (
    <div className="widget philosopher-widget">
      <div className="widget-header">
        <span className="widget-title">🏛 Philosopher of the Month</span>
        <a
          className="widget-subtitle phil-source-link"
          href="https://blog.oup.com/category/arts_and_humanities/philosopher-of-the-month/"
          target="_blank"
          rel="noopener noreferrer"
        >
          OUP Blog ↗
        </a>
      </div>

      {loading && <div className="widget-placeholder">Loading…</div>}

      {!loading && latest && (
        <>
          {/* Latest post — prominent */}
          <a
            className="phil-latest"
            href={latest.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="phil-date">{formatPubDate(latest.pub_date)}</span>
            <span className="phil-title">{latest.title}</span>
            {latest.excerpt && (
              <span className="phil-excerpt">{latest.excerpt}</span>
            )}
          </a>

          {/* Previous posts — compact links */}
          {previous.length > 0 && (
            <div className="phil-previous">
              <p className="phil-previous-label">Previous</p>
              {previous.map((p, i) => (
                <a
                  key={i}
                  className="phil-prev-item"
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="phil-prev-date">{formatPubDate(p.pub_date)}</span>
                  <span className="phil-prev-title">{p.title}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
