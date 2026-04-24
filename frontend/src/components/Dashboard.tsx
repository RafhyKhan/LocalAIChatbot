/**
 * Dashboard — home page with a drag-and-drop widget grid.
 *
 * Edit mode (pencil icon, top-right):
 *   - Drag handles appear on every widget.
 *   - Drag a widget over another to swap/reorder positions.
 *   - Layout is snapped to a 2-column CSS grid automatically.
 *   - Order is saved to localStorage so it persists between sessions.
 *
 * Widget registry:
 *   To add a new widget: add its id to DEFAULT_ORDER, add its colSpan to
 *   WIDGET_COLSPANS, and add a case to renderWidget(). Nothing else changes.
 */
import { useState }         from "react";
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

import SortableWidget  from "./SortableWidget";
import WeatherWidget   from "./widgets/WeatherWidget";
import NewsWidget      from "./widgets/NewsWidget";
import BookmarksWidget from "./widgets/BookmarksWidget";

// ── Widget registry ───────────────────────────────────────────────────────────

/** How many grid columns (out of 2) each widget spans. */
const WIDGET_COLSPANS: Record<string, number> = {
  weather:   2,
  news:      1,
  bookmarks: 1,
};

/** Human-readable label shown in the drag overlay ghost. */
const WIDGET_LABELS: Record<string, string> = {
  weather:   "🌤 Weather",
  news:      "📰 BBC News",
  bookmarks: "🔖 Bookmarks",
};

function renderWidget(id: string) {
  switch (id) {
    case "weather":   return <WeatherWidget />;
    case "news":      return <NewsWidget />;
    case "bookmarks": return <BookmarksWidget />;
    default:          return null;
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

function persistOrder(order: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

// ── Dashboard component ───────────────────────────────────────────────────────

export default function Dashboard() {
  const [order,    setOrder]    = useState<string[]>(loadOrder);
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Require a small drag distance before activating — prevents accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
      persistOrder(next);
      return next;
    });
  }

  function onDragCancel() {
    setActiveId(null);
  }

  function toggleEdit() {
    setEditMode((v) => !v);
  }

  return (
    <div className="dashboard">
      {/* Toolbar — edit toggle lives top-right */}
      <div className="dashboard-toolbar">
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

      {/* Edit-mode banner */}
      {editMode && (
        <div className="edit-banner">
          Drag widgets to rearrange — click <strong>Done</strong> when finished
        </div>
      )}

      {/* DnD context wraps the grid */}
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
                colSpan={WIDGET_COLSPANS[id] ?? 1}
                editMode={editMode}
                isDragging={activeId === id}
              >
                {renderWidget(id)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>

        {/* Ghost shown while dragging — lightweight, doesn't re-fetch data */}
        <DragOverlay dropAnimation={null}>
          {activeId && (
            <div className="drag-ghost">
              {WIDGET_LABELS[activeId] ?? activeId}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
