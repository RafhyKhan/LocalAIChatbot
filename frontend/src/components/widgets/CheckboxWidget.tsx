/**
 * CheckboxWidget — gamified task tracker.
 *
 * Collapsed (default): fixed height, scrollable, newest tasks on top.
 *   Click label → rename. ∨ button → expand.
 *
 * Expanded: full height, all tasks visible, drag-to-reorder.
 *   Click + drag label → reorder. ∧ button → collapse.
 *
 * Per task: ☆ favourite star (yellow when active) · × delete.
 * Submit requires ≥ 5 checked. Only checked boxes reset on submit.
 * Gold bar: lifetime % 100 → 🏆 counter grows at each 100 milestone.
 */
import { useRef, useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 10;
const MIN_SUBMIT  = 5;

const LABELS_KEY    = "rainai_checkbox_labels";
const CHECKED_KEY   = "rainai_checkbox_checked";
const LIFETIME_KEY  = "rainai_checkbox_lifetime";
const TASKCOUNT_KEY = "rainai_checkbox_taskcount";
const FAVS_KEY      = "rainai_checkbox_favs";

function defaultLabel(i: number) { return `Task ${i + 1}`; }

// ── Loaders ───────────────────────────────────────────────────────────────────

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
function loadFavs(count: number): boolean[] {
  try {
    const raw = localStorage.getItem(FAVS_KEY);
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

// ── Sortable task row (expanded mode) ─────────────────────────────────────────

function SortableTaskRow({
  id,
  children,
}: {
  id: string;
  children: (listeners: Record<string, unknown> | undefined) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity:  isDragging ? 0.4 : 1,
        zIndex:   isDragging ? 999 : undefined,
        position: "relative",
      }}
      {...attributes}
    >
      {children(listeners as Record<string, unknown> | undefined)}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckboxWidget() {
  const initCount = loadTaskCount();
  const [taskCount,    setTaskCount]    = useState(initCount);
  const [labels,       setLabels]       = useState(() => loadLabels(initCount));
  const [checked,      setChecked]      = useState(() => loadChecked(initCount));
  const [favourites,   setFavourites]   = useState(() => loadFavs(initCount));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue,    setEditValue]    = useState("");
  const [lifetime,     setLifetime]     = useState(loadLifetime);
  const [expanded,     setExpanded]     = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Derived
  const checkedCount = checked.filter(Boolean).length;
  const canSubmit    = checkedCount >= MIN_SUBMIT;
  const goldProgress = lifetime % 100;
  const finishes     = Math.floor(lifetime / 100);

  function isRenamed(i: number) {
    return labels[i].trim() !== "" && labels[i] !== defaultLabel(i);
  }

  // ── Toggle ────────────────────────────────────────────────────────────────

  function toggle(i: number) {
    if (!isRenamed(i)) return;
    const next = checked.map((v, idx) => idx === i ? !v : v);
    setChecked(next);
    localStorage.setItem(CHECKED_KEY, JSON.stringify(next));
  }

  // ── Favourite ─────────────────────────────────────────────────────────────

  function toggleFav(i: number) {
    if (!favourites[i]) {
      // Starring — move item to last index so it appears at top in reversed view
      const lastIdx    = taskCount - 1;
      const newLabels  = arrayMove(labels,     i, lastIdx);
      const newChecked = arrayMove(checked,    i, lastIdx);
      const newFavs    = arrayMove(favourites, i, lastIdx);
      newFavs[lastIdx] = true;
      setLabels(newLabels);
      setChecked(newChecked);
      setFavourites(newFavs);
      localStorage.setItem(LABELS_KEY,  JSON.stringify(newLabels));
      localStorage.setItem(CHECKED_KEY, JSON.stringify(newChecked));
      localStorage.setItem(FAVS_KEY,    JSON.stringify(newFavs));
    } else {
      // Unstarring — just clear the flag, keep position
      const next = favourites.map((v, idx) => idx === i ? false : v);
      setFavourites(next);
      localStorage.setItem(FAVS_KEY, JSON.stringify(next));
    }
  }

  // ── Rename (collapsed only) ───────────────────────────────────────────────

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

  // ── Remove ────────────────────────────────────────────────────────────────

  function removeTask(i: number) {
    const newLabels = labels
      .filter((_, idx) => idx !== i)
      .map((label, newIdx) => {
        const oldIdx = newIdx >= i ? newIdx + 1 : newIdx;
        return label === defaultLabel(oldIdx) ? defaultLabel(newIdx) : label;
      });
    const newChecked = checked.filter((_, idx) => idx !== i);
    const newFavs    = favourites.filter((_, idx) => idx !== i);
    const newCount   = taskCount - 1;
    setLabels(newLabels);
    setChecked(newChecked);
    setFavourites(newFavs);
    setTaskCount(newCount);
    localStorage.setItem(LABELS_KEY,    JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY,   JSON.stringify(newChecked));
    localStorage.setItem(FAVS_KEY,      JSON.stringify(newFavs));
    localStorage.setItem(TASKCOUNT_KEY, String(newCount));
    if (editingIndex === i) setEditingIndex(null);
  }

  // ── Add page ──────────────────────────────────────────────────────────────

  function addPage() {
    const newCount   = taskCount + PAGE_SIZE;
    const newLabels  = [...labels,     ...Array.from({ length: PAGE_SIZE }, (_, i) => defaultLabel(taskCount + i))];
    const newChecked = [...checked,    ...Array(PAGE_SIZE).fill(false)];
    const newFavs    = [...favourites, ...Array(PAGE_SIZE).fill(false)];
    setTaskCount(newCount);
    setLabels(newLabels);
    setChecked(newChecked);
    setFavourites(newFavs);
    localStorage.setItem(TASKCOUNT_KEY, String(newCount));
    localStorage.setItem(LABELS_KEY,    JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY,   JSON.stringify(newChecked));
    localStorage.setItem(FAVS_KEY,      JSON.stringify(newFavs));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!canSubmit) return;
    const nextLifetime = lifetime + checkedCount;
    setLifetime(nextLifetime);
    localStorage.setItem(LIFETIME_KEY, String(nextLifetime));
    const newLabels  = labels.map((label, i) => checked[i] ? defaultLabel(i) : label);
    const newChecked = Array(taskCount).fill(false);
    const newFavs    = favourites.map((fav, i) => checked[i] ? false : fav);
    setLabels(newLabels);
    setChecked(newChecked);
    setFavourites(newFavs);
    localStorage.setItem(LABELS_KEY,  JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY, JSON.stringify(newChecked));
    localStorage.setItem(FAVS_KEY,    JSON.stringify(newFavs));
  }

  // ── Drag end (expanded mode) ──────────────────────────────────────────────

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = parseInt(active.id as string);
    const to   = parseInt(over.id  as string);
    const newLabels  = arrayMove(labels,     from, to);
    const newChecked = arrayMove(checked,    from, to);
    const newFavs    = arrayMove(favourites, from, to);
    setLabels(newLabels);
    setChecked(newChecked);
    setFavourites(newFavs);
    localStorage.setItem(LABELS_KEY,  JSON.stringify(newLabels));
    localStorage.setItem(CHECKED_KEY, JSON.stringify(newChecked));
    localStorage.setItem(FAVS_KEY,    JSON.stringify(newFavs));
  }

  // ── Shared task row content ───────────────────────────────────────────────

  function taskRowContent(
    i: number,
    dragListeners?: Record<string, unknown>
  ) {
    const renamed   = isRenamed(i);
    const isChecked = checked[i];
    const isFav     = favourites[i];
    const isEditing = editingIndex === i;

    return (
      <div
        className={[
          "checkbox-item",
          isChecked ? "checkbox-item-checked" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Checkbox */}
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

        {/* Star — expanded: fully interactive. Collapsed: only shown if already starred (read-only) */}
        {expanded ? (
          <button
            className={`checkbox-star-btn${isFav ? " checkbox-star-active" : ""}`}
            onClick={() => toggleFav(i)}
            title={isFav ? "Unfavourite" : "Mark as favourite"}
          >
            {isFav ? "★" : "☆"}
          </button>
        ) : isFav ? (
          <span className="checkbox-star-indicator">★</span>
        ) : null}

        {/* Label — rename in collapsed, drag handle in expanded */}
        {!expanded && isEditing ? (
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
            className={[
              "checkbox-item-label",
              !renamed        ? "checkbox-label-default" : "",
              expanded        ? "checkbox-label-draggable" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => !expanded && !isChecked && startEdit(i)}
            title={expanded ? "Drag to reorder" : isChecked ? "" : "Click to rename"}
            {...(expanded ? dragListeners : {})}
          >
            {labels[i]}
          </span>
        )}

        {/* Star */}
        {/* Delete */}
        <button
          className="checkbox-delete-btn"
          onClick={() => removeTask(i)}
          title="Remove task"
        >
          ×
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Both modes render reversed — highest index at top, so order is consistent
  const reversedIds = labels.map((_, i) => String(i)).reverse();

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

      {/* Gold bar */}
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

      {/* Task list */}
      {expanded ? (
        // ── Expanded: full height, drag-to-reorder, same reversed order ──
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={reversedIds} strategy={rectSortingStrategy}>
            <div className="checkbox-list checkbox-list-expanded">
              {reversedIds.map(id => {
                const i = parseInt(id);
                return (
                  <SortableTaskRow key={id} id={id}>
                    {(listeners) => taskRowContent(i, listeners)}
                  </SortableTaskRow>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        // ── Collapsed: scrollable, same reversed order, rename on click ──
        <div className="checkbox-list">
          {reversedIds.map(id => {
            const i = parseInt(id);
            return <div key={id}>{taskRowContent(i)}</div>;
          })}
        </div>
      )}

      {/* Footer: + 10 | Submit */}
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

      {/* Expand / collapse arrow */}
      <div className="checkbox-expand-row">
        <button
          className="checkbox-expand-btn"
          onClick={() => { setExpanded(v => !v); setEditingIndex(null); }}
          title={expanded ? "Collapse" : "Expand to show all tasks"}
        >
          {expanded ? "∧" : "∨"}
        </button>
      </div>

    </div>
  );
}
