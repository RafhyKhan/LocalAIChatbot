/**
 * CheckboxWidget — gamified task tracker.
 *
 * 10 renameable tasks. Rename a task to unlock its checkbox.
 * Check all 10 → Submit → lifetime checks +10, labels + boxes reset.
 *
 * Green bar : current round progress (0–10).
 * Gold bar  : progress toward next 100 lifetime checks (lifetime % 100).
 * Finishes  : how many times lifetime checks has crossed a multiple of 100.
 *
 * All state persisted to localStorage.
 */
import { useRef, useState } from "react";

const TOTAL = 10;
const DEFAULT_LABELS = Array.from({ length: TOTAL }, (_, i) => `Task ${i + 1}`);

const LABELS_KEY   = "rainai_checkbox_labels";
const CHECKED_KEY  = "rainai_checkbox_checked";
const LIFETIME_KEY = "rainai_checkbox_lifetime";

function loadLabels(): string[] {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === TOTAL) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_LABELS];
}

function loadChecked(): boolean[] {
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === TOTAL) return parsed;
    }
  } catch { /* ignore */ }
  return Array(TOTAL).fill(false);
}

function loadLifetime(): number {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw !== null) return parseInt(raw, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

export default function CheckboxWidget() {
  const [labels,       setLabels]       = useState<string[]>(loadLabels);
  const [checked,      setChecked]      = useState<boolean[]>(loadChecked);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue,    setEditValue]    = useState("");
  const [lifetime,     setLifetime]     = useState(loadLifetime);

  const inputRef = useRef<HTMLInputElement>(null);

  // Derived
  const checkedCount = checked.filter(Boolean).length;
  const allChecked   = checkedCount === TOTAL;
  const goldProgress = lifetime % 100;
  const finishes     = Math.floor(lifetime / 100);

  function isRenamed(i: number) {
    return labels[i].trim() !== "" && labels[i] !== DEFAULT_LABELS[i];
  }

  // ── Toggle ────────────────────────────────────────────────────────────────

  function toggle(i: number) {
    if (!isRenamed(i)) return;
    const next = checked.map((v, idx) => idx === i ? !v : v);
    setChecked(next);
    localStorage.setItem(CHECKED_KEY, JSON.stringify(next));
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  function startEdit(i: number) {
    if (editingIndex !== null && editingIndex !== i) commitEdit(editingIndex);
    setEditingIndex(i);
    setEditValue(labels[i] === DEFAULT_LABELS[i] ? "" : labels[i]);
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  function commitEdit(i: number) {
    const val  = editValue.trim();
    const next = [...labels];
    next[i]    = val || DEFAULT_LABELS[i];
    setLabels(next);
    localStorage.setItem(LABELS_KEY, JSON.stringify(next));
    // If reverted to default, uncheck that box
    if (!val) {
      const nextChecked = [...checked];
      nextChecked[i] = false;
      setChecked(nextChecked);
      localStorage.setItem(CHECKED_KEY, JSON.stringify(nextChecked));
    }
    setEditingIndex(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!allChecked) return;
    const nextLifetime = lifetime + TOTAL;
    setLifetime(nextLifetime);
    localStorage.setItem(LIFETIME_KEY, String(nextLifetime));
    const reset = Array(TOTAL).fill(false);
    setChecked(reset);
    localStorage.setItem(CHECKED_KEY, JSON.stringify(reset));
    setLabels([...DEFAULT_LABELS]);
    localStorage.setItem(LABELS_KEY, JSON.stringify(DEFAULT_LABELS));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="widget checkbox-widget">

      {/* Header */}
      <div className="widget-header">
        <span className="widget-title">✅ Checklist</span>
        <div className="checkbox-header-right">
          <span className="checkbox-lifetime-label">Lifetime</span>
          <span className="checkbox-lifetime-num">{lifetime}</span>
        </div>
      </div>

      {/* Green progress bar — current round */}
      <div className="checkbox-progress-bar">
        <div className="checkbox-progress-fill" style={{ width: `${(checkedCount / TOTAL) * 100}%` }} />
      </div>
      <div className="checkbox-progress-label">{checkedCount} / {TOTAL}</div>

      {/* Task grid */}
      <div className="checkbox-list">
        {labels.map((label, i) => {
          const renamed   = isRenamed(i);
          const isChecked = checked[i];
          const isEditing = editingIndex === i;

          return (
            <div
              key={i}
              className={[
                "checkbox-item",
                isChecked ? "checkbox-item-checked" : "",
                !renamed  ? "checkbox-item-locked"  : "",
              ].filter(Boolean).join(" ")}
            >
              {/* Checkbox button */}
              <button
                className="checkbox-box"
                onClick={() => toggle(i)}
                disabled={!renamed}
                tabIndex={renamed ? 0 : -1}
                title={renamed ? "Toggle" : "Rename task to unlock"}
              >
                {isChecked && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Label / inline editor */}
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="checkbox-edit-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter")  commitEdit(i);
                    if (e.key === "Escape") { setEditValue(labels[i]); setEditingIndex(null); }
                  }}
                  onBlur={() => commitEdit(i)}
                  placeholder="Task name…"
                />
              ) : (
                <span
                  className={`checkbox-item-label${!renamed ? " checkbox-label-default" : ""}`}
                  onClick={() => !isChecked && startEdit(i)}
                  title={isChecked ? "" : "Click to rename"}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="checkbox-footer">
        <button
          className={`checkbox-submit${allChecked ? " checkbox-submit-ready" : ""}`}
          onClick={handleSubmit}
          disabled={!allChecked}
          title={allChecked ? "Submit and reset" : `Complete all ${TOTAL} tasks first`}
        >
          Submit
        </button>
      </div>

      {/* Gold bar — lifetime progress */}
      <div className="checkbox-gold-section">
        <div className="checkbox-gold-bar">
          <div className="checkbox-gold-fill" style={{ width: `${goldProgress}%` }} />
        </div>
        <div className="checkbox-gold-row">
          <span className="checkbox-gold-label">{goldProgress} / 100</span>
          <span className="checkbox-finishes">
            🏆 <span className="checkbox-finishes-num">{finishes}</span>
          </span>
        </div>
      </div>

    </div>
  );
}
