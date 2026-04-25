/**
 * WordWidget — personal vocabulary card.
 *
 * Main card: a randomly selected word from your saved list, with full
 * dictionary definition. Shuffle button picks a different one.
 *
 * Search bar: look up any word via dictionaryapi.dev (free, no key).
 * Hit Enter or "Go" → definition appears with a + button to save it.
 *
 * My Words: collapsible list of every word you've saved, with × to remove.
 * All words persisted in backend/words.json via the FastAPI endpoints.
 */

import { useEffect, useRef, useState } from "react";
import { BASE } from "../../api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedWord {
  word:         string;
  phonetic:     string;
  partOfSpeech: string;
  definition:   string;
  example:      string;
}

// ── Dictionary fetch helper ───────────────────────────────────────────────────

async function fetchDefinition(word: string): Promise<SavedWord | null> {
  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`
    );
    if (!r.ok) return null;
    const data  = await r.json();
    const entry  = data[0];
    const meaning = entry.meanings?.[0];
    const defObj  = meaning?.definitions?.[0];
    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
      "";
    return {
      word:         entry.word,
      phonetic,
      partOfSpeech: meaning?.partOfSpeech ?? "",
      definition:   defObj?.definition    ?? "No definition available.",
      example:      defObj?.example       ?? "",
    };
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WordWidget() {
  const [wordList,       setWordList]       = useState<SavedWord[]>([]);
  const [displayEntry,   setDisplayEntry]   = useState<SavedWord | null>(null);
  const [loadingInit,    setLoadingInit]    = useState(true);

  const [searchTerm,     setSearchTerm]     = useState("");
  const [searchResult,   setSearchResult]   = useState<SavedWord | null>(null);
  const [searching,      setSearching]      = useState(false);
  const [searchError,    setSearchError]    = useState(false);

  const [saving,         setSaving]         = useState(false);
  const [listOpen,       setListOpen]       = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load list + pick a random word on mount ──────────────────────────────

  useEffect(() => {
    fetch(`${BASE}/api/words`)
      .then((r) => r.json())
      .then((d) => {
        const list: SavedWord[] = d.words ?? [];
        setWordList(list);
        if (list.length > 0) {
          setDisplayEntry(list[Math.floor(Math.random() * list.length)]);
        }
      })
      .catch(() => {/* keep empty list */})
      .finally(() => setLoadingInit(false));
  }, []);

  // ── Shuffle: pick a different word from the list ─────────────────────────

  function shuffle() {
    if (wordList.length === 0) return;
    const others = wordList.filter((w) => w.word !== displayEntry?.word);
    const pool   = others.length > 0 ? others : wordList;
    setDisplayEntry(pool[Math.floor(Math.random() * pool.length)]);
    setSearchResult(null);
    setSearchTerm("");
    setSearchError(false);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async function doSearch() {
    const term = searchTerm.trim();
    if (!term) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError(false);
    const result = await fetchDefinition(term);
    if (result) {
      setSearchResult(result);
    } else {
      setSearchError(true);
    }
    setSearching(false);
  }

  function clearSearch() {
    setSearchResult(null);
    setSearchTerm("");
    setSearchError(false);
    inputRef.current?.focus();
  }

  // ── Save word to backend ──────────────────────────────────────────────────

  async function saveWord(w: SavedWord) {
    setSaving(true);
    try {
      await fetch(`${BASE}/api/words`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(w),
      });
      setWordList((prev) => {
        if (prev.some((p) => p.word === w.word)) return prev;
        return [...prev, w];
      });
      // If list was empty, promote this word to the main card
      if (wordList.length === 0) setDisplayEntry(w);
    } finally {
      setSaving(false);
      setSearchResult(null);
      setSearchTerm("");
    }
  }

  // ── Remove word from backend ──────────────────────────────────────────────

  async function removeWord(word: string) {
    await fetch(`${BASE}/api/words/${encodeURIComponent(word)}`, {
      method: "DELETE",
    });
    setWordList((prev) => {
      const next = prev.filter((w) => w.word !== word);
      if (displayEntry?.word === word) {
        setDisplayEntry(
          next.length > 0
            ? next[Math.floor(Math.random() * next.length)]
            : null
        );
      }
      return next;
    });
  }

  const alreadySaved = searchResult
    ? wordList.some((w) => w.word === searchResult.word)
    : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="widget word-widget">

      {/* Header */}
      <div className="widget-header">
        <span className="widget-title">📖 Word of the Day</span>
        {wordList.length > 1 && (
          <button className="word-shuffle-btn" onClick={shuffle} title="Shuffle word">
            🔀
          </button>
        )}
      </div>

      {/* ── Main display card ── */}
      {loadingInit && (
        <div className="widget-placeholder">Loading…</div>
      )}

      {!loadingInit && wordList.length === 0 && !searchResult && (
        <div className="word-empty-state">
          <p>Your word list is empty.</p>
          <p>Search for a word below to start building it.</p>
        </div>
      )}

      {!loadingInit && displayEntry && !searchResult && (
        <div className="word-display">
          <div className="word-title">
            <span className="word-name">{displayEntry.word}</span>
            {displayEntry.phonetic && (
              <span className="word-phonetic">{displayEntry.phonetic}</span>
            )}
          </div>
          {displayEntry.partOfSpeech && (
            <div className="word-pos">{displayEntry.partOfSpeech}</div>
          )}
          <p className="word-definition">{displayEntry.definition}</p>
          {displayEntry.example && (
            <p className="word-example">"{displayEntry.example}"</p>
          )}
        </div>
      )}

      {/* ── Search result (overlays main card) ── */}
      {searchResult && (
        <div className="word-search-result">
          <div className="word-title">
            <span className="word-name">{searchResult.word}</span>
            {searchResult.phonetic && (
              <span className="word-phonetic">{searchResult.phonetic}</span>
            )}
            <button
              className={`word-save-btn${alreadySaved ? " word-save-btn-saved" : ""}`}
              onClick={() => !alreadySaved && saveWord(searchResult)}
              disabled={saving || alreadySaved}
              title={alreadySaved ? "Already saved" : "Save to My Words"}
            >
              {alreadySaved ? "✓" : saving ? "…" : "+"}
            </button>
          </div>
          {searchResult.partOfSpeech && (
            <div className="word-pos">{searchResult.partOfSpeech}</div>
          )}
          <p className="word-definition">{searchResult.definition}</p>
          {searchResult.example && (
            <p className="word-example">"{searchResult.example}"</p>
          )}
          <button className="word-back-btn" onClick={clearSearch}>
            ← Back to my word
          </button>
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="word-search-bar">
        <input
          ref={inputRef}
          className="word-search-input"
          placeholder="Search a word…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSearchError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
        />
        <button
          className="word-search-go"
          onClick={doSearch}
          disabled={searching || !searchTerm.trim()}
        >
          {searching ? "…" : "Go"}
        </button>
      </div>
      {searchError && (
        <p className="word-search-error">Word not found. Try another.</p>
      )}

      {/* ── My Words collapsible list ── */}
      <div className="word-list-section">
        <button
          className="word-list-toggle"
          onClick={() => setListOpen((v) => !v)}
        >
          My Words ({wordList.length}) {listOpen ? "▲" : "▾"}
        </button>

        {listOpen && (
          <div className="word-list">
            {wordList.length === 0 && (
              <p className="word-list-empty">No words saved yet.</p>
            )}
            {wordList.map((w) => (
              <div key={w.word} className="word-list-item">
                <div className="word-list-info">
                  <span className="word-list-word">{w.word}</span>
                  <span className="word-list-def">{w.definition}</span>
                </div>
                <button
                  className="word-list-remove"
                  onClick={() => removeWord(w.word)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
