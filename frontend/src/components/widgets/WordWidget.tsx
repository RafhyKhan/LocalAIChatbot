/**
 * WordWidget — picks a random word on page load and fetches its full
 * dictionary definition from dictionaryapi.dev (free, no API key).
 *
 * Never auto-refreshes — only changes on page reload.
 *
 * ── Customise ────────────────────────────────────────────────────────────────
 *   WORDS  → add/remove words from the pool below
 *            any standard English word that dictionaryapi.dev knows will work
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

// ── Word pool — edit this list freely ────────────────────────────────────────

/*
const WORDS = [
  "ephemeral",    "serendipity",  "eloquent",     "melancholy",   "resilience",
  "perspicacious","loquacious",   "sanguine",     "plethora",     "ubiquitous",
  "luminous",     "cacophony",    "ethereal",     "gregarious",   "tenacious",
  "arduous",      "benevolent",   "capricious",   "diligent",     "ebullient",
  "fastidious",   "garrulous",    "halcyon",      "inscrutable",  "juxtapose",
  "kaleidoscope", "laconic",      "magnanimous",  "nefarious",    "oblivious",
  "paradox",      "quixotic",     "recalcitrant", "stoic",        "truculent",
  "umbrage",      "venerate",     "whimsical",    "zealous",      "acumen",
  "blithe",       "candor",       "deft",         "enigmatic",    "fervent",
  "gilded",       "hapless",      "intrepid",     "jovial",       "keen",
  "languid",      "mirth",        "nascent",      "opulent",      "pellucid",
  "querulous",    "ruminate",     "sagacious",    "taciturn",     "uncanny",
  "vivacious",    "wistful",      "xenial",       "yearning",     "zenith",
];
*/


const WORDS = [
  "longing",      "grief",        "tenderness",   "anguish",      "euphoria",
  "nostalgia",    "dread",        "serenity",     "despair",      "elation",
  "yearning",     "remorse",      "tranquil",     "forlorn",      "ardor",
  "melancholy",   "solace",       "wistful",      "desolate",     "rapture",
  "bittersweet",  "pensive",      "restless",     "content",      "hollow",
  "fervent",      "somber",       "wretched",     "bliss",        "torment",
  "apathy",       "reverence",    "sullen",       "giddy",        "numb",
  "vulnerable",   "overwhelmed",  "detached",     "grateful",     "raw",
  "brooding",     "catharsis",    "sorrow",       "elusive",      "hopeful",
  "wounded",      "serene",       "turbulent",    "cherish",      "lament",
  "resigned",     "flustered",    "adrift",       "awakened",     "haunted",
  "enchanted",    "shattered",    "fleeting",     "consumed",     "starved",
  "fractured",    "luminous",     "smoldering",   "unburdened",   "severed",
];


// ── Types ─────────────────────────────────────────────────────────────────────

interface WordEntry {
  word:        string;
  phonetic:    string;
  partOfSpeech:string;
  definition:  string;
  example:     string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WordWidget() {
  const [entry,   setEntry]   = useState<WordEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    // Pick a random word from the pool
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        const entry    = data[0];
        const meaning  = entry.meanings?.[0];
        const defObj   = meaning?.definitions?.[0];

        // Phonetic: try top-level first, then search phonetics array
        const phonetic =
          entry.phonetic ||
          entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
          "";

        setEntry({
          word:         entry.word,
          phonetic,
          partOfSpeech: meaning?.partOfSpeech ?? "",
          definition:   defObj?.definition    ?? "No definition available.",
          example:      defObj?.example       ?? "",
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []); // ← runs once on mount, never auto-refreshes

  return (
    <div className="widget word-widget">

      {loading && <div className="widget-placeholder">Looking up a word…</div>}

      {!loading && error && (
        <div className="widget-placeholder">Could not load definition.</div>
      )}

      {!loading && entry && (
        <>
          {/* Label */}
          <div className="fact-label">📖 Word of the Load</div>

          {/* Word + phonetic */}
          <div className="word-title">
            <span className="word-name">{entry.word}</span>
            {entry.phonetic && (
              <span className="word-phonetic">{entry.phonetic}</span>
            )}
          </div>

          {/* Part of speech */}
          {entry.partOfSpeech && (
            <div className="word-pos">{entry.partOfSpeech}</div>
          )}

          {/* Definition */}
          <p className="word-definition">{entry.definition}</p>

          {/* Example sentence */}
          {entry.example && (
            <p className="word-example">"{entry.example}"</p>
          )}

          <span className="fact-source">via dictionaryapi.dev</span>
        </>
      )}
    </div>
  );
}
