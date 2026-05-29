/**
 * ProphetWidget — full Ibn Kathir "Stories of the Prophets" reader.
 *
 * • 459 sections across 29 prophets, extracted verbatim from the PDF.
 * • Randomises prophet on mount (or ↻ button); restores saved position per prophet.
 * • ← / → navigate sections; pressing → marks current section as read.
 * • 📖 opens a progress overlay with per-prophet completion and section navigation.
 * • All state persisted to localStorage — no backend.
 */

import { useState, useEffect } from "react";
import prophetsData from "../../data/prophets.json";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chunk {
  index:   number;
  section: string;
  text:    string;
}

interface Prophet {
  id:                  string;
  name:                string;
  bio?:                string;
  region?:             string;
  era?:                string;
  keyFigures?:         string[];
  connectedProphets?:  string[];
  chunks:              Chunk[];
}

type Tab = "story" | "figures";

// ── Data ──────────────────────────────────────────────────────────────────────

const PROPHETS: Prophet[]            = prophetsData as Prophet[];
const PROPHET_MAP: Record<string, Prophet> =
  Object.fromEntries(PROPHETS.map(p => [p.id, p]));

const TOTAL_CHUNKS = PROPHETS.reduce((s, p) => s + p.chunks.length, 0);

// ── localStorage keys ─────────────────────────────────────────────────────────

const PROGRESS_KEY = "prophet_reading_progress";   // { [id]: chunkIndex }
const READ_KEY     = "prophet_read_sections";       // { [id]: number[] }

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
  catch { return {}; }
}

function saveProgress(pid: string, idx: number) {
  const p = loadProgress(); p[pid] = idx;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

function loadReadMap(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || "{}"); }
  catch { return {}; }
}

function saveReadMap(map: Record<string, number[]>) {
  localStorage.setItem(READ_KEY, JSON.stringify(map));
}

function markRead(pid: string, idx: number, map: Record<string, number[]>): Record<string, number[]> {
  const next   = { ...map };
  const set    = new Set(next[pid] || []);
  set.add(idx);
  next[pid]    = Array.from(set);
  saveReadMap(next);
  return next;
}

function isRead(pid: string, idx: number, map: Record<string, number[]>): boolean {
  return (map[pid] || []).includes(idx);
}

function readCount(pid: string, map: Record<string, number[]>): number {
  return (map[pid] || []).length;
}

// ── Pick helpers ──────────────────────────────────────────────────────────────

function pickRandomProphet(excludeId?: string): Prophet {
  const pool = excludeId ? PROPHETS.filter(p => p.id !== excludeId) : PROPHETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickStartChunk(p: Prophet): number {
  const saved = loadProgress()[p.id];
  if (saved !== undefined) return Math.min(saved, Math.max(0, p.chunks.length - 1));
  if (p.chunks.length === 0) return 0;
  return Math.floor(Math.random() * p.chunks.length);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProphetWidget() {
  const [prophet,       setProphet]       = useState<Prophet>(pickRandomProphet);
  const [chunkIndex,    setChunkIndex]    = useState<number>(() => pickStartChunk(pickRandomProphet()));
  const [readMap,       setReadMap]       = useState<Record<string, number[]>>(loadReadMap);
  const [overlayOpen,   setOverlayOpen]   = useState(false);
  const [overlayProphet, setOverlayProphet] = useState<string | null>(null);
  const [tab,           setTab]           = useState<Tab>("story");

  // Initialise consistently (avoids useState double-call drift)
  useEffect(() => {
    const p   = pickRandomProphet();
    const idx = pickStartChunk(p);
    setProphet(p);
    setChunkIndex(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes overlay
  useEffect(() => {
    if (!overlayOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlayOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [overlayOpen]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function goNext() {
    const updated = markRead(prophet.id, chunkIndex, readMap);
    setReadMap(updated);
    const next = Math.min(chunkIndex + 1, prophet.chunks.length - 1);
    setChunkIndex(next);
    saveProgress(prophet.id, next);
  }

  function goPrev() {
    const prev = Math.max(chunkIndex - 1, 0);
    setChunkIndex(prev);
    saveProgress(prophet.id, prev);
  }

  function switchProphet() {
    saveProgress(prophet.id, chunkIndex);
    const next = pickRandomProphet(prophet.id);
    const idx  = pickStartChunk(next);
    setProphet(next);
    setChunkIndex(idx);
    setTab("story");
  }

  function openOverlay() {
    setReadMap(loadReadMap()); // refresh from storage
    setOverlayOpen(true);
    setOverlayProphet(null);
  }

  function navigateTo(p: Prophet, idx: number) {
    saveProgress(prophet.id, chunkIndex);
    setProphet(p);
    setChunkIndex(idx);
    setTab("story");
    setOverlayOpen(false);
    setOverlayProphet(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const chunk    = prophet.chunks[chunkIndex];
  const hasExtra = (prophet.keyFigures?.length ?? 0) > 0 ||
                   (prophet.connectedProphets?.length ?? 0) > 0;
  const totalRead = PROPHETS.reduce((s, p) => s + readCount(p.id, readMap), 0);
  const overallPct = Math.round((totalRead / Math.max(TOTAL_CHUNKS, 1)) * 100);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Widget card ── */}
      <div className="widget prophet-widget">

        {/* Header row */}
        <div className="widget-header">
          <span className="widget-title">🕌 Prophet Story</span>
          <div className="prophet-header-btns">
            <button
              className="prophet-icon-btn"
              onClick={openOverlay}
              title="Reading progress"
            >
              📖
            </button>
            <button
              className="prophet-icon-btn"
              onClick={switchProphet}
              title="Random prophet"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Name + chunk counter */}
        <div className="prophet-name-row">
          <div className="prophet-name">{prophet.name}</div>
          {prophet.chunks.length > 0 && (
            <span className="prophet-chunk-progress">
              {chunkIndex + 1} / {prophet.chunks.length}
            </span>
          )}
        </div>

        {/* Meta: region · era */}
        {(prophet.region || prophet.era) && (
          <div className="prophet-meta">
            {prophet.region && (
              <span className="prophet-meta-item">
                <span className="prophet-meta-icon">📍</span>{prophet.region}
              </span>
            )}
            {prophet.era && (
              <span className="prophet-meta-item">
                <span className="prophet-meta-icon">🕰</span>{prophet.era}
              </span>
            )}
          </div>
        )}

        {/* Bio */}
        {prophet.bio && <div className="prophet-bio">{prophet.bio}</div>}

        {/* Section heading */}
        {chunk && (
          <div className="prophet-section-title">{chunk.section}</div>
        )}

        {/* Tab bar (only when key figures exist) */}
        {hasExtra && (
          <div className="prophet-tabs">
            <button
              className={`prophet-tab${tab === "story" ? " prophet-tab-active" : ""}`}
              onClick={() => setTab("story")}
            >Story</button>
            <button
              className={`prophet-tab${tab === "figures" ? " prophet-tab-active" : ""}`}
              onClick={() => setTab("figures")}
            >Key Figures</button>
          </div>
        )}

        {/* Story text */}
        {(tab === "story" || !hasExtra) && chunk && (
          <div className="prophet-story">{chunk.text}</div>
        )}

        {/* Key Figures panel */}
        {tab === "figures" && (
          <div className="prophet-figures">
            {(prophet.keyFigures?.length ?? 0) > 0 && (
              <div className="prophet-figures-group">
                <div className="prophet-figures-label">People in this story</div>
                <ul className="prophet-figures-list">
                  {prophet.keyFigures!.map((f, i) => (
                    <li key={i} className="prophet-figures-item">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {(prophet.connectedProphets?.length ?? 0) > 0 && (
              <div className="prophet-figures-group">
                <div className="prophet-figures-label">Connected Prophets</div>
                <ul className="prophet-figures-list">
                  {prophet.connectedProphets!.map((p, i) => (
                    <li key={i} className="prophet-figures-item prophet-figures-prophet">{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="prophet-nav">
          <button
            className="prophet-nav-btn"
            onClick={goPrev}
            disabled={chunkIndex === 0}
            title="Previous section"
          >← Prev</button>

          <span className="prophet-source">— Ibn Kathir</span>

          <button
            className="prophet-nav-btn"
            onClick={goNext}
            disabled={chunkIndex >= prophet.chunks.length - 1}
            title="Next section (marks current as read)"
          >Next →</button>
        </div>
      </div>

      {/* ── Progress Overlay ── */}
      {overlayOpen && (
        <div className="po-backdrop" onClick={() => setOverlayOpen(false)}>
          <div className="po-panel" onClick={e => e.stopPropagation()}>

            {/* Overlay header */}
            <div className="po-header">
              {overlayProphet ? (
                <button className="po-back-btn" onClick={() => setOverlayProphet(null)}>‹ Back</button>
              ) : (
                <div style={{ width: 48 }} />
              )}
              <span className="po-title">
                {overlayProphet
                  ? PROPHET_MAP[overlayProphet]?.name
                  : "Reading Progress"}
              </span>
              <button className="po-close-btn" onClick={() => setOverlayOpen(false)}>×</button>
            </div>

            {/* ── Prophet list view ── */}
            {!overlayProphet && (
              <>
                {/* Overall bar */}
                <div className="po-overall">
                  <div className="po-overall-label">
                    <span>Overall</span>
                    <span className="po-overall-count">
                      {totalRead} / {TOTAL_CHUNKS} sections · {overallPct}%
                    </span>
                  </div>
                  <div className="po-bar-track">
                    <div className="po-bar-fill" style={{ width: `${overallPct}%` }} />
                  </div>
                </div>

                {/* Prophet rows */}
                <div className="po-prophet-list">
                  {PROPHETS.map(p => {
                    const cnt = readCount(p.id, readMap);
                    const tot = p.chunks.length;
                    const pct = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
                    return (
                      <div
                        key={p.id}
                        className={`po-prophet-row${p.id === prophet.id ? " po-prophet-current" : ""}`}
                        onClick={() => setOverlayProphet(p.id)}
                      >
                        <div className="po-prophet-info">
                          <span className="po-prophet-name">{p.name}</span>
                          <span className="po-prophet-count">{cnt}/{tot}</span>
                        </div>
                        <div className="po-mini-track">
                          <div className="po-mini-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="po-chevron">›</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Section detail view ── */}
            {overlayProphet && (() => {
              const p = PROPHET_MAP[overlayProphet];
              if (!p) return null;
              const cnt = readCount(p.id, readMap);
              return (
                <>
                  <div className="po-detail-summary">
                    {cnt} of {p.chunks.length} sections read
                    {p.id === prophet.id && (
                      <span className="po-currently-reading"> · currently reading</span>
                    )}
                  </div>
                  <div className="po-section-list">
                    {p.chunks.map(ch => {
                      const read     = isRead(p.id, ch.index, readMap);
                      const isActive = p.id === prophet.id && ch.index === chunkIndex;
                      return (
                        <div
                          key={ch.index}
                          className={`po-section-row${read ? " po-section-read" : ""}${isActive ? " po-section-active" : ""}`}
                          onClick={() => navigateTo(p, ch.index)}
                          title="Click to navigate here"
                        >
                          <span className="po-check">{read ? "✓" : "☐"}</span>
                          <span className="po-section-name">{ch.section}</span>
                          <span className="po-section-idx">#{ch.index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}
    </>
  );
}
