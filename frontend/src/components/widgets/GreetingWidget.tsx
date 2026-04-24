/**
 * GreetingWidget — personalised greeting + a random quote from Firebase.
 *
 * ── Customise here ────────────────────────────────────────────────────────────
 *
 *   GREETING   → the name / text shown at the top of the card
 *   QUOTE_URL  → Firebase (or any JSON endpoint) that returns quote objects
 *   REFRESH    → set to true to re-roll the quote every time the dashboard loads
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

// ── Customise ─────────────────────────────────────────────────────────────────

const GREETING  = "Hi Rafhy Khan!";   // ← change greeting text here

const QUOTE_URL = "https://react-http-57c1f-default-rtdb.firebaseio.com/quotes.json";
//                 ↑ swap this URL to point at a different quotes endpoint

const REFRESH   = true;
//                ↑ true  = new random quote every page load
//                  false = same quote until you manually refresh the page

// ── Types ─────────────────────────────────────────────────────────────────────

interface Quote {
  text:   string;
  author: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GreetingWidget() {
  const [quote,   setQuote]   = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    fetch(QUOTE_URL)
      .then((r) => {
        if (!r.ok) throw new Error("Network error");
        return r.json();
      })
      .then((data: Record<string, Quote>) => {
        // Firebase returns an object keyed by push IDs — convert to array
        const all = Object.values(data).filter(
          (q) => q && typeof q.text === "string" && typeof q.author === "string"
        );
        if (all.length === 0) throw new Error("No quotes found");

        // Pick a random quote
        const picked = all[Math.floor(Math.random() * all.length)];
        setQuote(picked);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // re-runs each mount when REFRESH = true

  return (
    <div className="widget greeting-widget">

      {/* ── Greeting ── */}
      <div className="greeting-text">
        {GREETING}
        {/* ↑ The greeting renders here — change GREETING at the top of the file */}
      </div>

      {/* ── Quote ── */}
      {loading && <div className="widget-placeholder">Loading quote…</div>}

      {!loading && error && (
        <div className="widget-placeholder">Could not load quote.</div>
      )}

      {!loading && !error && quote && (
        <div className="greeting-quote">
          {/* ── Quote text ── */}
          <p className="greeting-quote-text">"{quote.text}"</p>

          {/* ── Author ── */}
          <p className="greeting-quote-author">— {quote.author}</p>
        </div>
      )}
    </div>
  );
}
