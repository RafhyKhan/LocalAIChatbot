/**
 * SortableWidget — wraps any widget with @dnd-kit sortable behaviour.
 * In edit mode  : shows a drag handle; the whole card becomes draggable.
 * Outside edit  : renders children with zero overhead (disabled hook).
 */
import type { ReactNode, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS }         from "@dnd-kit/utilities";

interface Props {
  id:         string;
  colSpan:    number;   // how many grid columns this widget spans
  editMode:   boolean;
  isDragging: boolean;  // true while THIS widget is the active dragged item
  children:   ReactNode;
}

export default function SortableWidget({ id, colSpan, editMode, isDragging, children }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !editMode });

  const style: CSSProperties = {
    gridColumn:  `span ${colSpan}`,
    transform:   CSS.Transform.toString(transform),
    transition,
    opacity:     isDragging ? 0.35 : 1,
    position:    "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "sortable-widget",
        editMode   ? "sortable-editable" : "",
        isDragging ? "sortable-dragging" : "",
      ].join(" ").trim()}
    >
      {/* Drag handle — only visible in edit mode */}
      {editMode && (
        <div className="drag-handle" {...listeners} {...attributes} title="Drag to reposition">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            {/* 6-dot grip icon */}
            <circle cx="7"  cy="4"  r="1.6"/>
            <circle cx="13" cy="4"  r="1.6"/>
            <circle cx="7"  cy="10" r="1.6"/>
            <circle cx="13" cy="10" r="1.6"/>
            <circle cx="7"  cy="16" r="1.6"/>
            <circle cx="13" cy="16" r="1.6"/>
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
