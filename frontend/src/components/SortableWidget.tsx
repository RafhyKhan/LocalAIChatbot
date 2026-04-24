/**
 * SortableWidget — wraps any widget with @dnd-kit sortable behaviour.
 * In edit mode  : drag handle (top-right) + remove button (top-left).
 * Outside edit  : renders children with zero overhead (hook disabled).
 */
import type { ReactNode, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS }         from "@dnd-kit/utilities";

interface Props {
  id:         string;
  colSpan:    number;
  editMode:   boolean;
  isDragging: boolean;
  onRemove:   () => void;
  children:   ReactNode;
}

export default function SortableWidget({ id, colSpan, editMode, isDragging, onRemove, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id, disabled: !editMode });

  const style: CSSProperties = {
    gridColumn: `span ${colSpan}`,
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.35 : 1,
    position:   "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "sortable-widget",
        editMode   ? "sortable-editable" : "",
        isDragging ? "sortable-dragging"  : "",
      ].join(" ").trim()}
    >
      {editMode && (
        <>
          {/* Remove button — top-left */}
          <button className="widget-remove" onClick={onRemove} title="Remove widget">×</button>

          {/* Drag handle — top-right */}
          <div className="drag-handle" {...listeners} {...attributes} title="Drag to reposition">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="7"  cy="4"  r="1.6"/>
              <circle cx="13" cy="4"  r="1.6"/>
              <circle cx="7"  cy="10" r="1.6"/>
              <circle cx="13" cy="10" r="1.6"/>
              <circle cx="7"  cy="16" r="1.6"/>
              <circle cx="13" cy="16" r="1.6"/>
            </svg>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
