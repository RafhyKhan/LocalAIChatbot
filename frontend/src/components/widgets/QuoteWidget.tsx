/**
 * QuoteWidget — random quote from Firebase, colSpan 1.
 * Fetches from VITE_QUOTE_URL (expects a Firebase object keyed by push IDs).
 * The greeting + clock live in the Dashboard toolbar.
 */
import "./QuoteWidget.css";
import { useEffect, useState } from "react";
import type { Quote } from "../../widgetTypes";

const QUOTE_URL = import.meta.env.VITE_QUOTE_URL ?? "";

export default function QuoteWidget() {
  const [quote,   setQuote]   = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    fetch(QUOTE_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Record<string, Quote>) => {
        const all = Object.values(data).filter(
          q => q && typeof q.text === "string" && typeof q.author === "string"
        );
        if (all.length === 0) throw new Error();
        setQuote(all[Math.floor(Math.random() * all.length)]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="widget quote-widget">
      <div className="widget-header">
        <span className="widget-title">💬 Quote</span>
      </div>

      {loading && <div className="widget-placeholder">Loading quote…</div>}
      {!loading && error && <div className="widget-placeholder">Could not load quote.</div>}

      {!loading && !error && quote && (
        <div className="quote-card">
          <p className="quote-text">{quote.text}</p>
          <p className="quote-author">— {quote.author}</p>
        </div>
      )}
    </div>
  );
}
