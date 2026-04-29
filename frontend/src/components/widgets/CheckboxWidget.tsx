/**
 * CheckboxWidget — gamified task tracker.
 *
 * Tasks start at 10, expandable by +10 pages via the + button.
 * Rename a task label to unlock its checkbox.
 * Submit requires ≥ 5 checked. Only checked boxes reset on submit;
 * unchecked boxes keep their names and state.
 *
 * Gold bar: lifetime % 100 → fills toward next 100 milestone.
 * Finishes: how many times lifetime has crossed a multiple of 100.
 *
 * All state persisted to localStorage.
 */
import { useRef, useState } from "react";

const PAGE_SIZE    = 10;
const MIN_SUBMIT   = 5;

const LABELS_KEY     = "rainai_checkbox_labels";
const CHECKED_KEY    = "rainai_checkbox_checked";
const LIFETIME_KEY   = "rainai_checkbox_lifetime";
const TASKCOUNT_KEY  = "rainai_checkbox_taskcount";

function defaultLabel(i: number) { return `Task ${i + 1}`; }

function loadTaskCount(): number {
  try {
    const raw = localStorage.getItem(TASKCOUNT_KEY);
    if (raw !== null) return Math.max(PAGE_SIZE, parseInt(raw, 10) || PAGE_SIZE);
  } catch { /* ignore */ }
  return PAGE_SIZE;
}

function loadLabels(count: number): string[] {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === count) return parsed;
    }
  } catch { /* ignore */ }
  return Array.from({ length: count }, (_, i) => defaultLabel(i));
}

function loadChecked(count: number): boolean[] {
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === count) return parsed;
    }
  } catch { /* ignore */ }
  return Array(count).fill(false);
}

function loadLifetime(): number {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw !== null) return parseInt(raw, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

export default function CheckboxWidget() {
  const initCount = loadTaskCount();
  const [taskCount,    setTaskCount]    = useState(initCount);
  const [labels,       setLabels]       = useState(() => loadLabels(initCount));
  const [checked,      setChecked]      = useState(() => loadChecked(initCount));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue,    setEditValue]    = useState("");
  const [lifetime,     setLifetime]     = useState(loadLifetime);

  const inputRef   = useRef<HTMLInputElement>(null);

  // Derived
  const checkedCount = checked.filter(Boolean).length;
  const canSubmit    = checkedCount >= MIN_SUBMIT;
  const goldProgress = lifetime % 100;
  const finishes     = Math.floor(lifetime / 100);

  function isRenamed(i: number) {
    return labels[i].trim() !== "" && labels[i] !== defaultLabel(i);
  }

  // ── Remove task ───────────────────────────────────────────────────────────

  function removeTask(i: number) {
    const newLabels  = labels
      .filter((_, idx) => idx !== i)
      .map((label, newIdx) => {
        const oldIdx = newIdx >= i ? newIdx + 1 : newIdx;
        return label === defaultLabel(oldIdx) ? defaultLabel(newIdx) : label;
      });
    const newChecked = checked.filter((_, idx) => idx !== i);
    const newCount   = taskCount - 1;
    setLabels(newLabels);
    setChecked(newChecked);
    setTaskCount(newCount);
    localStorage.setItem(LABELS_KEY,    JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY,   JSON.stringify(newChecked));
    localStorage.setItem(TASKCOUNT_KEY, String(newCount));
    if (editingIndex === i) setEditingIndex(null);
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
    setEditValue(labels[i] === defaultLabel(i) ? "" : labels[i]);
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  function commitEdit(i: number) {
    const val  = editValue.trim();
    const next = [...labels];
    next[i]    = val || defaultLabel(i);
    setLabels(next);
    localStorage.setItem(LABELS_KEY, JSON.stringify(next));
    if (!val) {
      const nextChecked = [...checked];
      nextChecked[i] = false;
      setChecked(nextChecked);
      localStorage.setItem(CHECKED_KEY, JSON.stringify(nextChecked));
    }
    setEditingIndex(null);
  }

  // ── Add page ──────────────────────────────────────────────────────────────

  function addPage() {
    const newCount   = taskCount + PAGE_SIZE;
    const newLabels  = [...labels,  ...Array.from({ length: PAGE_SIZE }, (_, i) => defaultLabel(taskCount + i))];
    const newChecked = [...checked, ...Array(PAGE_SIZE).fill(false)];
    setTaskCount(newCount);
    setLabels(newLabels);
    setChecked(newChecked);
    localStorage.setItem(TASKCOUNT_KEY, String(newCount));
    localStorage.setItem(LABELS_KEY,    JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY,   JSON.stringify(newChecked));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!canSubmit) return;
    const nextLifetime = lifetime + checkedCount;
    setLifetime(nextLifetime);
    localStorage.setItem(LIFETIME_KEY, String(nextLifetime));
    // Only reset checked boxes — unchecked keep their names
    const newLabels  = labels.map((label, i) => checked[i] ? defaultLabel(i) : label);
    const newChecked = Array(taskCount).fill(false);
    setLabels(newLabels);
    setChecked(newChecked);
    localStorage.setItem(LABELS_KEY,  JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY, JSON.stringify(newChecked));
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

      {/* Gold bar — lifetime milestones */}
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

      {/* Scrollable task grid — rendered top-to-bottom newest first */}
      <div className="checkbox-list">
        {labels.map((label, i) => ({ label, i })).reverse().map(({ label, i }) => {
          const renamed   = isRenamed(i);
          const isChecked = checked[i];
          const isEditing = editingIndex === i;

          return (
            <div
              key={i}
              className={[
                "checkbox-item",
                isChecked ? "checkbox-item-checked" : "",
              ].filter(Boolean).join(" ")}
            >
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

              <button
                className="checkbox-delete-btn"
                onClick={() => removeTask(i)}
                title="Remove task"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Add page + Submit row */}
      <div className="checkbox-footer">
        <button className="checkbox-add-btn" onClick={addPage} title="Add 10 more tasks">
          + 10
        </button>
        <button
          className={`checkbox-submit${canSubmit ? " checkbox-submit-ready" : ""}`}
          onClick={handleSubmit}
          disabled={!canSubmit}
          title={canSubmit ? "Submit and reset checked tasks" : `Check at least ${MIN_SUBMIT} tasks to submit`}
        >
          Submit ({checkedCount})
        </button>
      </div>

    </div>
  );
}
