/**
 * ScheduleWidget — live daily schedule with task assignment.
 *
 * Each slot that has a category (work / activity / eat / read / workout)
 * can have a specific task assigned to it from your personal task pool.
 *
 * ⚙ button → Manage Tasks popup: add/remove tasks per category.
 * Click a slot's "+ pick" → inline picker filtered to that category.
 * Assignments saved to localStorage keyed by today's date (auto-fresh daily).
 * Task pool saved to backend (tasks.json) for long-term persistence.
 *
 * ── Customise schedule ───────────────────────────────────────────────────────
 *   Edit the SCHEDULE array below. Times are minutes from midnight.
 *   Helper: H*60+M  (e.g. 3:30 PM → 15*60+30 = 930)
 *   Set category: null for fixed slots (Shower, Agenda) that need no assignment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";
import { BASE } from "../../api";

// ── Schedule definition ───────────────────────────────────────────────────────

type Category = "work" | "activity" | "eat" | "read" | "workout" | null;

interface SlotDef {
  startMin: number;
  endMin:   number;
  label:    string;
  category: Category;
}

const SCHEDULE: SlotDef[] = [
  { startMin:  7*60,     endMin:  7*60+30,  label: "Shower + Wake up",                          category: null       },
  { startMin:  7*60+30,  endMin:  8*60,     label: "Eat 1 (Breakfast)",                         category: "eat"      },
  { startMin:  8*60,     endMin: 12*60,     label: "Work 1",                                    category: "work"     },
  { startMin: 12*60,     endMin: 12*60+30,  label: "Eat 2 (Lunch)",                             category: "eat"      },
  { startMin: 12*60+30,  endMin: 15*60+30,  label: "Work 2",                                    category: "work"     },
  { startMin: 15*60+30,  endMin: 16*60,     label: "Eat 3 (Dinner)",                            category: "eat"      },
  { startMin: 16*60,     endMin: 18*60,     label: "Activity 1",                                category: "activity" },
  { startMin: 18*60,     endMin: 18*60+30,  label: "Eat 4 (Late Dinner)",                       category: "eat"      },
  { startMin: 18*60+30,  endMin: 21*60,     label: "Activity 2",                                category: "activity" },
  { startMin: 21*60,     endMin: 21*60+30,  label: "Eat 5 (Night Dinner)",                      category: "eat"      },
  { startMin: 21*60+30,  endMin: 22*60,     label: "Agenda + Vocabulary",                       category: null       },
  { startMin: 22*60,     endMin: 23*60,     label: "Workout",                                   category: "workout"  },
  { startMin: 23*60,     endMin: 24*60,     label: "Read + Sleep",                                      category: "read"     },
];

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: "work",     label: "Work"     },
  { value: "activity", label: "Activity" },
  { value: "eat",      label: "Eat"      },
  { value: "read",     label: "Read"     },
  { value: "workout",  label: "Workout"  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  label:    string;
  category: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowInMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function fmt(minutes: number): string {
  const h24  = Math.floor(minutes / 60) % 24;
  const m    = minutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12  = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Fixed key — assignments persist until manually cleared
const ASSIGNMENTS_KEY = "rainai_schedule_assignments";

function loadAssignments(): Record<number, string> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function persistAssignments(a: Record<number, string>) {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(a));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleWidget() {
  const [now,         setNow]         = useState(nowInMinutes);
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>(loadAssignments);
  const [manageOpen,  setManageOpen]  = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [newLabel,    setNewLabel]    = useState("");
  const [newCat,      setNewCat]      = useState("work");

  const activeRef  = useRef<HTMLDivElement>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);

  // Load task pool from backend on mount
  useEffect(() => {
    fetch(`${BASE}/api/tasks`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => {});
  }, []);

  // Tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(nowInMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll active slot into view when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [now]);

  // Focus input when manage popup opens
  useEffect(() => {
    if (manageOpen) setTimeout(() => newLabelRef.current?.focus(), 50);
  }, [manageOpen]);

  const activeIndex = SCHEDULE.findIndex(
    (s) => now >= s.startMin && now < s.endMin
  );

  // ── Assignment actions ──────────────────────────────────────────────────────

  function assign(index: number, taskLabel: string) {
    const next = { ...assignments, [index]: taskLabel };
    setAssignments(next);
    persistAssignments(next);
    setPickerIndex(null);
  }

  function clearAssignment(index: number) {
    const next = { ...assignments };
    delete next[index];
    setAssignments(next);
    persistAssignments(next);
  }

  function togglePicker(index: number) {
    setPickerIndex((prev) => (prev === index ? null : index));
  }

  // ── Task pool actions ───────────────────────────────────────────────────────

  async function addTask() {
    const label = newLabel.trim();
    if (!label) return;
    await fetch(`${BASE}/api/tasks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ label, category: newCat }),
    });
    setTasks((prev) => {
      if (prev.some((t) => t.label === label && t.category === newCat)) return prev;
      return [...prev, { label, category: newCat }];
    });
    setNewLabel("");
    newLabelRef.current?.focus();
  }

  async function removeTask(label: string) {
    await fetch(`${BASE}/api/tasks/${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    setTasks((prev) => prev.filter((t) => t.label !== label));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="widget schedule-widget">

      {/* Header */}
      <div className="widget-header">
        <span className="widget-title">🗓 Daily Schedule</span>
        <div className="schedule-header-right">
          {activeIndex >= 0 && (
            <span className="widget-subtitle">{SCHEDULE[activeIndex].label}</span>
          )}
          <button
            className="schedule-manage-btn"
            onClick={() => { setManageOpen(true); setPickerIndex(null); }}
            title="Manage tasks"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Schedule list */}
      <div className="schedule-list">
        {SCHEDULE.map((item, i) => {
          const isActive   = i === activeIndex;
          const isPast     = activeIndex >= 0 ? i < activeIndex : now >= item.endMin;
          const assigned   = assignments[i];
          const catTasks   = item.category
            ? tasks.filter((t) => t.category === item.category)
            : [];
          const showPicker = pickerIndex === i;

          return (
            <div key={i}>
              <div
                ref={isActive ? activeRef : null}
                className={[
                  "schedule-item",
                  isActive ? "schedule-active" : "",
                  isPast   ? "schedule-past"   : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="schedule-check">{isActive ? "✓" : ""}</span>
                <span className="schedule-time">
                  {fmt(item.startMin)} – {fmt(item.endMin)}
                </span>

                <div className="schedule-label-col">
                  <span className="schedule-label">{item.label}</span>

                  {/* Assignment row — only for slots with a category */}
                  {item.category && (
                    <div className="schedule-assignment-row">
                      {assigned ? (
                        <>
                          <button
                            className="schedule-assigned-tag"
                            onClick={() => togglePicker(i)}
                            title="Click to change"
                          >
                            {assigned}
                          </button>
                          <button
                            className="schedule-clear-btn"
                            onClick={() => clearAssignment(i)}
                            title="Clear assignment"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <button
                          className="schedule-pick-btn"
                          onClick={() => catTasks.length > 0 && togglePicker(i)}
                          style={{ opacity: catTasks.length === 0 ? 0.4 : 1 }}
                          title={catTasks.length === 0 ? "No tasks yet — open ⚙ to add some" : "Pick a task"}
                        >
                          {catTasks.length === 0 ? "no tasks" : "+ pick"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Inline task picker */}
              {showPicker && catTasks.length > 0 && (
                <div className="schedule-picker">
                  {catTasks.map((t) => (
                    <button
                      key={t.label}
                      className={`schedule-picker-item${assigned === t.label ? " schedule-picker-active" : ""}`}
                      onClick={() => assign(i, t.label)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Manage Tasks popup */}
      {manageOpen && (
        <div
          className="schedule-manage-overlay"
          onClick={() => setManageOpen(false)}
        >
          <div
            className="schedule-manage-popup"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup header */}
            <div className="schedule-manage-header">
              <span className="schedule-manage-title">Manage Tasks</span>
              <button
                className="schedule-manage-close"
                onClick={() => setManageOpen(false)}
              >
                ×
              </button>
            </div>

            {/* Add form */}
            <div className="schedule-manage-form">
              <input
                ref={newLabelRef}
                className="schedule-manage-input"
                placeholder="Task name…"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <select
                className="schedule-manage-select"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button className="schedule-manage-add" onClick={addTask}>
                Add
              </button>
            </div>

            {/* Task list grouped by category */}
            <div className="schedule-manage-list">
              {tasks.length === 0 && (
                <p className="schedule-manage-empty">
                  No tasks yet. Add one above.
                </p>
              )}
              {CATEGORIES.map((cat) => {
                const catTasks = tasks.filter((t) => t.category === cat.value);
                if (catTasks.length === 0) return null;
                return (
                  <div key={cat.value} className="schedule-manage-group">
                    <span className="schedule-manage-cat-label">
                      {cat.label}
                    </span>
                    <div className="schedule-manage-items">
                      {catTasks.map((t) => (
                        <div key={t.label} className="schedule-manage-item">
                          <span className="schedule-manage-item-label">
                            {t.label}
                          </span>
                          <button
                            className="schedule-manage-remove"
                            onClick={() => removeTask(t.label)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
