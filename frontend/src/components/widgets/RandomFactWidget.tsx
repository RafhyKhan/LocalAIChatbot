/**
 * RandomFactWidget — picks one random source on page load and fetches a fact/joke.
 * Never auto-refreshes; only changes when the page is reloaded.
 *
 * Sources (picked randomly each load):
 *   😂  Dad Joke      — icanhazdadjoke.com
 *   🐱  Cat Fact      — catfact.ninja
 *   🐶  Dog Fact      — dogapi.dog
 *   📜  Poetry        — poetrydb.org
 *   🚀  SpaceX        — api.spacexdata.com (random rocket description)
 *   🤠  Chuck Norris  — api.chucknorris.io
 *   🤯  Useless Fact  — uselessfacts.jsph.pl
 *
 * To add a new source: add a Fetcher entry to the FETCHERS array below.
 * To remove a source: delete its entry from FETCHERS.
 */

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Fact {
  label:   string;   // emoji + category name shown at the top
  content: string;   // the actual fact / joke / excerpt
  source:  string;   // credit shown at the bottom
}

type Fetcher = () => Promise<Fact>;

// ── Source fetchers ───────────────────────────────────────────────────────────

const FETCHERS: Fetcher[] = [

  // 😂 Dad Joke
  async () => {
    const r = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "application/json" },
    });
    const d = await r.json();
    return { label: "😂 Dad Joke", content: d.joke, source: "icanhazdadjoke.com" };
  },

  // 🐱 Cat Fact
  async () => {
    const r = await fetch("https://catfact.ninja/fact");
    const d = await r.json();
    return { label: "🐱 Cat Fact", content: d.fact, source: "catfact.ninja" };
  },

  // 🐶 Dog Fact
  async () => {
    const r = await fetch("https://dogapi.dog/api/v2/facts?limit=1");
    const d = await r.json();
    return { label: "🐶 Dog Fact", content: d.data[0].attributes.body, source: "dogapi.dog" };
  },

  // 📜 Poetry — first 4 lines of a random poem
  async () => {
    const r = await fetch("https://poetrydb.org/random/1");
    const d = await r.json();
    const poem  = d[0];
    const lines = poem.lines.slice(0, 4).join("\n");
    return {
      label:   "📜 Poetry",
      content: `${lines}\n\n— ${poem.title}, ${poem.author}`,
      source:  "poetrydb.org",
    };
  },

  // 🚀 SpaceX — random rocket description
  async () => {
    const r       = await fetch("https://api.spacexdata.com/v4/rockets");
    const rockets = await r.json();
    const rocket  = rockets[Math.floor(Math.random() * rockets.length)];
    return {
      label:   "🚀 SpaceX",
      content: `${rocket.name} — ${rocket.description}`,
      source:  "spacexdata.com",
    };
  },

  // 🤠 Chuck Norris joke
  async () => {
    const r = await fetch("https://api.chucknorris.io/jokes/random");
    const d = await r.json();
    return { label: "🤠 Chuck Norris", content: d.value, source: "chucknorris.io" };
  },

  // 🤯 Useless Fact
  async () => {
    const r = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random");
    const d = await r.json();
    return { label: "🤯 Useless Fact", content: d.text, source: "uselessfacts.jsph.pl" };
  },

];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RandomFactWidget() {
  const [fact,    setFact]    = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Shuffle all fetchers, try each in order until one succeeds
    const sources = shuffle(FETCHERS);

    (async () => {
      for (const fetch of sources) {
        try {
          setFact(await fetch());
          return; // stop as soon as one succeeds
        } catch {
          // source failed — try the next one
        }
      }
      // All sources failed
      setFact({
        label:   "😅 Offline",
        content: "Could not load a fact right now. Check your connection and refresh.",
        source:  "",
      });
    })().finally(() => setLoading(false));
  }, []); // ← empty array = runs once on mount only, never auto-refreshes

  return (
    <div className="widget fact-widget">
      {loading && <div className="widget-placeholder">Loading something interesting…</div>}

      {!loading && fact && (
        <>
          <div className="fact-label">{fact.label}</div>
          <p className="fact-content">{fact.content}</p>
          {fact.source && <span className="fact-source">via {fact.source}</span>}
        </>
      )}
    </div>
  );
}
