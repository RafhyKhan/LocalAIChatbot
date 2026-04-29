/**
 * Dashboard — home page with drag-and-drop widget grid + widget directory.
 *
 * Edit mode (✏ pencil, top-right):
 *   - Drag handles and remove buttons appear on every active widget.
 *   - Drag to swap/reorder; × to remove back to the directory.
 *   - Layout saved to localStorage automatically.
 *
 * Widget directory (⊞ grid icon, left of edit button):
 *   - Shows all registered widgets NOT currently on the dashboard.
 *   - Click "Add" to place a widget at the end of the grid.
 *   - Adding a widget automatically enters edit mode so you can reposition it.
 *
 * Adding a new widget type:
 *   1. Add its entry to WIDGET_REGISTRY.
 *   2. Add a case to renderWidget().
 *   Nothing else changes.
 */
import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import SortableWidget   from "./SortableWidget";
import WeatherWidget    from "./widgets/WeatherWidget";
import NewsWidget       from "./widgets/NewsWidget";
import BookmarksWidget  from "./widgets/BookmarksWidget";
import QuoteWidget       from "./widgets/QuoteWidget";
import RandomFactWidget  from "./widgets/RandomFactWidget";
import WordWidget         from "./widgets/WordWidget";
import PhilosopherWidget  from "./widgets/PhilosopherWidget";
import ScheduleWidget    from "./widgets/ScheduleWidget";
import NotesWidget         from "./widgets/NotesWidget";
import GoogleSearchWidget  from "./widgets/GoogleSearchWidget";
import MultiNewsWidget     from "./widgets/MultiNewsWidget";
import CalendarWidget     from "./widgets/CalendarWidget";
import CheckboxWidget     from "./widgets/CheckboxWidget";

// ── Widget registry ───────────────────────────────────────────────────────────

interface WidgetDef {
  id:          string;
  icon:        string;
  label:       string;
  description: string;
  colSpan:     number;  // columns it occupies in a 2-col grid
}

/** Master list of every widget the app knows about. */
const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "weather",   icon: "🌤",  label: "Weather",   description: "7-day Calgary forecast from Open-Meteo", colSpan: 2 },
  { id: "news",      icon: "📰",  label: "BBC News",  description: "Latest headlines from BBC RSS",          colSpan: 1 },
  { id: "bookmarks", icon: "🔖",  label: "Bookmarks", description: "Personal URL bookmarks (localStorage)",  colSpan: 1 },
  { id: "quote",      icon: "💬",  label: "Quote",     description: "Random quote of the day",               colSpan: 1 },
  { id: "randomfact", icon: "🎲", label: "Random Fact", description: "Dad jokes, facts, poetry & more",        colSpan: 1 },
  { id: "word",        icon: "📖", label: "Word of the Day",       description: "Random word + dictionary definition",        colSpan: 1 },
  { id: "philosopher", icon: "🏛", label: "Philosopher of the Month", description: "Latest posts from OUP Blog",             colSpan: 1 },
  { id: "schedule",    icon: "🗓", label: "Daily Schedule",           description: "Live schedule with current slot tracker", colSpan: 1 },
  { id: "notes",        icon: "📝", label: "Notes",         description: "Persistent scratchpad (auto-saves locally)",  colSpan: 1 },
  { id: "googlesearch", icon: "🔍", label: "Google Search", description: "Quick Google search bar",                      colSpan: 2 },
  { id: "multinews",   icon: "🌍", label: "World News",    description: "BBC, Reuters, AP, Al Jazeera, CBC, CTV, Calgary Herald", colSpan: 1 },
  { id: "calendar",    icon: "📅", label: "Google Calendar", description: "Google Calendar events + daily weather + agenda", colSpan: 2 },
  { id: "checkbox",    icon: "✅", label: "Checklist",       description: "10 checkboxes with a persistent completion counter", colSpan: 1 },
];

function renderWidget(id: string) {
  switch (id) {
    case "weather":   return <WeatherWidget />;
    case "news":      return <NewsWidget />;
    case "bookmarks": return <BookmarksWidget />;
    case "quote":       return <QuoteWidget />;
    case "randomfact": return <RandomFactWidget />;
    case "word":        return <WordWidget />;
    case "philosopher": return <PhilosopherWidget />;
    case "schedule":    return <ScheduleWidget />;
    case "notes":        return <NotesWidget />;
    case "googlesearch": return <GoogleSearchWidget />;
    case "multinews":    return <MultiNewsWidget />;
    case "calendar":     return <CalendarWidget />;
    case "checkbox":     return <CheckboxWidget />;
    default:             return null;
  }
}

// ── Layout persistence ────────────────────────────────────────────────────────

const ORDER_KEY     = "rainai_widget_order";
const DEFAULT_ORDER = ["weather", "news", "bookmarks"];

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate: old "greeting" (colSpan 2) → new "quote" (colSpan 1)
        return parsed.map((id: string) => id === "greeting" ? "quote" : id);
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

// ── Toolbar greeting helpers ──────────────────────────────────────────────────

function getGreeting(d: Date): string {
  const h = d.getHours();
  if (h >= 5  && h < 12) return "Good Morning, Rafhy!";
  if (h >= 12 && h < 17) return "Good Afternoon, Rafhy!";
  if (h >= 17 && h < 21) return "Good Evening, Rafhy!";
  return "Good Night, Rafhy!";
}

function formatToolbarTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatToolbarDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function persistOrder(order: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [order,         setOrder]         = useState<string[]>(loadOrder);
  const [editMode,      setEditMode]      = useState(false);
  const [dirOpen,       setDirOpen]       = useState(false);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [now,           setNow]           = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Widgets not yet on the dashboard
  const available = WIDGET_REGISTRY.filter((w) => !order.includes(w.id));

  // Derive per-widget metadata quickly
  const defMap = Object.fromEntries(WIDGET_REGISTRY.map((w) => [w.id, w]));

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function toggleEdit() { setEditMode((v) => !v); }

  function addWidget(id: string) {
    setOrder((prev) => {
      const next = [...prev, id];
      persistOrder(next);
      return next;
    });
    setDirOpen(false);
    setEditMode(true); // enter edit mode so user can immediately reposition
  }

  function removeWidget(id: string) {
    setOrder((prev) => {
      const next = prev.filter((w) => w !== id);
      persistOrder(next);
      return next;
    });
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) { setActiveId(active.id as string); }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
      persistOrder(next);
      return next;
    });
  }

  function onDragCancel() { setActiveId(null); }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard">

      {/* ── Toolbar ── */}
      <div className="dashboard-toolbar">

        {/* Greeting — left side */}
        <div className="toolbar-greeting">
          <span className="toolbar-greeting-text">{getGreeting(now)}</span>
        </div>

        {/* Datetime + Buttons — right side */}
        <div className="toolbar-actions">
          <span className="toolbar-datetime">{formatToolbarDate(now)} · {formatToolbarTime(now)}</span>
          <div className="toolbar-sep" />
          <button
            className={`dir-btn${dirOpen ? " dir-btn-active" : ""}`}
            onClick={() => setDirOpen((v) => !v)}
            title="Widget directory"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Widgets
          </button>

          <button
            className={`edit-toggle${editMode ? " edit-toggle-active" : ""}`}
            onClick={toggleEdit}
            title={editMode ? "Done editing" : "Edit layout"}
          >
            {editMode ? (
              <span className="edit-done-label">Done</span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Widget directory panel ── */}
      {dirOpen && (
        <div className="widget-directory">
          <div className="dir-header">
            <span className="dir-title">Widget Directory</span>
            <button className="dir-close" onClick={() => setDirOpen(false)} title="Close">×</button>
          </div>

          {available.length === 0 ? (
            <p className="dir-empty">All widgets are on your dashboard.</p>
          ) : (
            <div className="dir-list">
              {available.map((w) => (
                <div key={w.id} className="dir-item">
                  <span className="dir-item-icon">{w.icon}</span>
                  <div className="dir-item-info">
                    <span className="dir-item-label">{w.label}</span>
                    <span className="dir-item-desc">{w.description}</span>
                  </div>
                  <button className="dir-add-btn" onClick={() => addWidget(w.id)}>
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit-mode banner ── */}
      {editMode && (
        <div className="edit-banner">
          Drag widgets to rearrange · click <strong>×</strong> to remove · click <strong>Done</strong> when finished
        </div>
      )}

      {/* ── Widget grid ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className={`dashboard-grid${editMode ? " dashboard-edit-mode" : ""}`}>
            {order.map((id) => (
              <SortableWidget
                key={id}
                id={id}
                colSpan={defMap[id]?.colSpan ?? 1}
                editMode={editMode}
                isDragging={activeId === id}
                onRemove={() => removeWidget(id)}
              >
                {renderWidget(id)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>

        {/* Lightweight ghost while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeId && (
            <div className="drag-ghost">
              {defMap[activeId]?.icon} {defMap[activeId]?.label ?? activeId}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
