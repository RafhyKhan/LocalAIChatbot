/**
 * CounterWidget — simple named counter.
 * + and - buttons, supports negatives, name is click-to-edit.
 * Both name and count persist in localStorage.
 */
import { useState, useRef, useEffect } from "react";
import "./CounterWidget.css";

const STORAGE_KEY = "rainai_counter";

function load(): { name: string; count: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { name: "Counter", count: 0 };
}

function save(name: string, count: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, count }));
}

export default function CounterWidget() {
  const [count,     setCount]     = useState(() => load().count);
  const [name,      setName]      = useState(() => load().name);
  const [editingName, setEditingName] = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Persist on every change
  useEffect(() => { save(name, count); }, [name, count]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  function increment() { setCount(c => c + 1); }
  function decrement() { setCount(c => c - 1); }

  function startEditName() {
    setDraftName(name);
    setEditingName(true);
  }

  function commitName() {
    const trimmed = draftName.trim();
    if (trimmed) setName(trimmed);
    setEditingName(false);
  }

  function onNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") setEditingName(false);
  }

  return (
    <div className="widget counter-widget">

      {/* ── Header ── */}
      <div className="widget-header">
        {editingName ? (
          <input
            ref={nameInputRef}
            className="counter-name-input"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={onNameKeyDown}
            maxLength={32}
          />
        ) : (
          <span
            className="widget-title counter-name"
            onClick={startEditName}
            title="Click to rename"
          >
            {name}
          </span>
        )}
        <span className="widget-subtitle">click name to rename</span>
      </div>

      {/* ── Counter display ── */}
      <div className="counter-body">
        <button className="counter-btn counter-btn-minus" onClick={decrement}>−</button>
        <span className={`counter-value${count < 0 ? " counter-value--negative" : ""}`}>
          {count}
        </span>
        <button className="counter-btn counter-btn-plus" onClick={increment}>+</button>
      </div>

    </div>
  );
}
