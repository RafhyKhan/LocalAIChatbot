/**
 * CheckboxWidget — gamified task tracker with sections.
 *
 * Collapsed: height-capped + scrollable. Task labels are editable (click to rename).
 *            Section titles are NOT editable. No drag handles shown.
 *
 * Expanded:  Full height. Task labels are drag handles (not editable).
 *            Section titles ARE editable (click to rename, except Favourites).
 *            ≡ handle on sections to drag-reorder sections.
 *            Tasks can be dragged between sections (not into Favourites).
 *
 * Sections:
 *   ⭐ Favourites — auto-created/removed by starring. Always pinned top. No drop allowed.
 *   Unsorted     — auto-created when needed (section delete or unstar). Regular section.
 *   Custom       — user-created via "+ Add Section".
 *
 * +10 button — draggable. Drop on a section body to add 10 tasks. Green highlight on hover.
 *              Cannot drop on Favourites.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { BASE } from "../../api";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, DragOverEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id:      string;
  label:   string;
  checked: boolean;
}

interface Section {
  id:    string;
  type:  "favourites" | "unsorted" | "custom";
  title: string;
  tasks: Task[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE  = 10;
const MIN_SUBMIT = 5;

function defaultLabel(n: number) { return `Task ${n}`; }
function newTask(n: number): Task {
  return { id: crypto.randomUUID(), label: defaultLabel(n), checked: false };
}
function isRenamed(t: Task): boolean {
  return t.label.trim() !== "" && !/^Task \d+$/.test(t.label.trim());
}

// ── +10 draggable button ──────────────────────────────────────────────────────

function Add10Button() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   "add-10",
    data: { type: "add10" },
  });
  return (
    <button
      ref={setNodeRef}
      className={`cb-add-10-btn${isDragging ? " cb-add-10-btn--dragging" : ""}`}
      style={transform ? { transform: `translate(${transform.x}px,${transform.y}px)` } : undefined}
      title="Drag onto a section to add 10 tasks"
      {...listeners}
      {...attributes}
    >
      + 10
    </button>
  );
}

// ── Section droppable body ────────────────────────────────────────────────────

function SectionDropBody({
  sectionId,
  isFav,
  activeType,
  children,
}: {
  sectionId:  string;
  isFav:      boolean;
  activeType: string | null;
  children:   React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id:       `secbody-${sectionId}`,
    data:     { type: "secbody", sectionId },
    disabled: isFav,
  });
  const highlight = !isFav && activeType === "add10" && isOver;
  return (
    <div
      ref={setNodeRef}
      className={`cb-section-body${highlight ? " cb-section-body--add10-over" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Sortable task row ─────────────────────────────────────────────────────────

function SortableTask({
  task,
  sectionId,
  expanded,
  editTaskId,
  editTaskVal,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onToggle,
  onDelete,
  onStar,      // only non-null in non-fav sections
  isFavSection,
}: {
  task:         Task;
  sectionId:    string;
  expanded:     boolean;
  editTaskId:   string | null;
  editTaskVal:  string;
  onStartEdit:  (t: Task) => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onToggle:     (t: Task) => void;
  onDelete:     (t: Task) => void;
  onStar:       ((t: Task) => void) | null;
  isFavSection: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id:       `task-${task.id}`,
      data:     { type: "task", sectionId, taskId: task.id },
      disabled: !expanded,
    });

  const isEditing  = editTaskId === task.id;
  const renamed    = isRenamed(task);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus(), 20);
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
      {...attributes}
      className={`checkbox-item${task.checked ? " checkbox-item-checked" : ""}`}
    >
      {/* Checkbox */}
      <button
        className="checkbox-box"
        onClick={() => onToggle(task)}
        disabled={!renamed}
        title={renamed ? "Toggle" : "Rename task to unlock"}
      >
        {task.checked && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Star — fav section: always interactive unstar. Non-fav expanded: interactive star. Non-fav collapsed: hidden placeholder */}
      {isFavSection ? (
        <button className="checkbox-star-btn checkbox-star-active" onClick={() => onStar && onStar(task)} title="Unfavourite">★</button>
      ) : expanded && onStar ? (
        <button className="checkbox-star-btn" onClick={() => onStar(task)} title="Mark as favourite">☆</button>
      ) : (
        <span className="checkbox-star-indicator" style={{ visibility: "hidden" }}>★</span>
      )}

      {/* Label — rename via double-click in expanded mode only */}
      {expanded && isEditing ? (
        <input
          ref={inputRef}
          className="checkbox-edit-input"
          value={editTaskVal}
          onChange={e => onEditChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") onCommitEdit(); }}
          onBlur={onCommitEdit}
          placeholder="Task name…"
        />
      ) : (
        <span
          className={[
            "checkbox-item-label",
            !renamed ? "checkbox-label-default"   : "",
            expanded ? "checkbox-label-draggable" : "",
          ].filter(Boolean).join(" ")}
          onDoubleClick={() => expanded && !task.checked && onStartEdit(task)}
          title={expanded ? "Drag · double-click to rename" : ""}
          {...(expanded ? listeners : {})}
        >
          {task.label}
        </span>
      )}

      {/* Delete */}
      <button className="checkbox-delete-btn" onClick={() => onDelete(task)} title="Remove task">×</button>
    </div>
  );
}

// ── Sortable section wrapper ──────────────────────────────────────────────────

function SortableSection({
  section,
  expanded,
  activeType,
  editTaskId,
  editTaskVal,
  editSecId,
  editSecVal,
  onStartEditTask,
  onEditTaskChange,
  onCommitEditTask,
  onToggleTask,
  onDeleteTask,
  onStarTask,
  onUnstarTask,
  onDeleteSection,
  onStartEditSec,
  onEditSecChange,
  onCommitEditSec,
}: {
  section:          Section;
  expanded:         boolean;
  activeType:       string | null;
  editTaskId:       string | null;
  editTaskVal:      string;
  editSecId:        string | null;
  editSecVal:       string;
  onStartEditTask:  (t: Task) => void;
  onEditTaskChange: (v: string) => void;
  onCommitEditTask: () => void;
  onToggleTask:     (t: Task) => void;
  onDeleteTask:     (t: Task) => void;
  onStarTask:       (t: Task) => void;
  onUnstarTask:     (t: Task) => void;
  onDeleteSection:  (s: Section) => void;
  onStartEditSec:   (s: Section) => void;
  onEditSecChange:  (v: string) => void;
  onCommitEditSec:  () => void;
}) {
  const isFav = section.type === "favourites";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id:       `sec-${section.id}`,
      data:     { type: "section", sectionId: section.id },
      disabled: isFav || !expanded,
    });

  const secInputRef = useRef<HTMLInputElement>(null);
  const isEditingSec = editSecId === section.id;
  useEffect(() => {
    if (isEditingSec) setTimeout(() => secInputRef.current?.focus(), 20);
  }, [isEditingSec]);

  const taskIds = section.tasks.map(t => `task-${t.id}`);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`cb-section${isFav ? " cb-section-fav" : ""}`}
    >
      {/* Section header */}
      <div className="cb-section-header">
        {/* Drag handle — only in expanded, not for Favourites */}
        {expanded && !isFav ? (
          <span className="cb-section-handle" {...listeners} {...attributes} title="Drag to reorder section">≡</span>
        ) : (
          <span className="cb-section-handle cb-section-handle--hidden" />
        )}

        {/* Title */}
        {expanded && !isFav && isEditingSec ? (
          <input
            ref={secInputRef}
            className="cb-section-title-input"
            value={editSecVal}
            onChange={e => onEditSecChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") onCommitEditSec(); }}
            onBlur={onCommitEditSec}
          />
        ) : (
          <span
            className="cb-section-title"
            onClick={() => expanded && !isFav && onStartEditSec(section)}
            title={expanded && !isFav ? "Click to rename section" : undefined}
          >
            {section.title}
          </span>
        )}

        {/* Delete section — not for Favourites */}
        {!isFav && (
          <button className="cb-section-delete" onClick={() => onDeleteSection(section)} title="Delete section">×</button>
        )}
      </div>

      {/* Section body — droppable for task cross-section + +10 */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <SectionDropBody sectionId={section.id} isFav={isFav} activeType={activeType}>
          <div className="cb-section-task-grid">
            {section.tasks.map(task => (
              <SortableTask
                key={task.id}
                task={task}
                sectionId={section.id}
                expanded={expanded}
                editTaskId={editTaskId}
                editTaskVal={editTaskVal}
                onStartEdit={onStartEditTask}
                onEditChange={onEditTaskChange}
                onCommitEdit={onCommitEditTask}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
                onStar={isFav ? onUnstarTask : onStarTask}
                isFavSection={isFav}
              />
            ))}
            {section.tasks.length === 0 && (
              <p className="cb-section-empty">Empty section</p>
            )}
          </div>
        </SectionDropBody>
      </SortableContext>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CheckboxWidget() {
  const [sections,    setSections]    = useState<Section[]>([]);
  const [lifetime,    setLifetime]    = useState(0);
  const [expanded,    setExpanded]    = useState(false);
  const [editTaskId,  setEditTaskId]  = useState<string | null>(null);
  const [editTaskVal, setEditTaskVal] = useState("");
  const [editSecId,   setEditSecId]   = useState<string | null>(null);
  const [editSecVal,  setEditSecVal]  = useState("");
  const [activeType,  setActiveType]  = useState<string | null>(null);

  const syncedRef    = useRef(false);
  const sectionsRef  = useRef<Section[]>([]);  // stable ref for drag handlers
  sectionsRef.current = sections;

  // ── Backend load ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${BASE}/api/checklist`)
      .then(r => r.json())
      .then(data => {
        if (data.sections && Array.isArray(data.sections)) {
          setSections(data.sections);
          setLifetime(data.lifetime ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => { syncedRef.current = true; });
  }, []);

  // ── Debounced sync ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!syncedRef.current) return;
    const t = setTimeout(() => {
      fetch(`${BASE}/api/checklist`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sections, lifetime }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [sections, lifetime]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const allTasks    = sections.flatMap(s => s.tasks);
  const checkedCount = allTasks.filter(t => t.checked).length;
  const canSubmit   = checkedCount >= MIN_SUBMIT;
  const goldProgress = lifetime % 100;
  const finishes     = Math.floor(lifetime / 100);

  // ── Section helpers ────────────────────────────────────────────────────────

  const getFavIndex = (secs: Section[]) => secs.findIndex(s => s.type === "favourites");
  const newSectionInsertIndex = (secs: Section[]) => {
    const fi = getFavIndex(secs);
    return fi === -1 ? 0 : fi + 1;
  };

  function getOrCreateUnsorted(secs: Section[]): [Section[], Section] {
    const existing = secs.find(s => s.type === "unsorted");
    if (existing) return [secs, existing];
    const unsorted: Section = { id: crypto.randomUUID(), type: "unsorted", title: "Unsorted", tasks: [] };
    const idx = newSectionInsertIndex(secs);
    const next = [...secs.slice(0, idx), unsorted, ...secs.slice(idx)];
    return [next, unsorted];
  }

  function updateSections(updater: (s: Section[]) => Section[]) {
    setSections(prev => updater(prev));
  }

  // ── Task operations ────────────────────────────────────────────────────────

  const onToggleTask = useCallback((task: Task) => {
    if (!isRenamed(task)) return;
    updateSections(secs => secs.map(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, checked: !t.checked } : t),
    })));
  }, []);

  const onDeleteTask = useCallback((task: Task) => {
    updateSections(secs => secs.map(s => ({
      ...s, tasks: s.tasks.filter(t => t.id !== task.id),
    })));
  }, []);

  const onStarTask = useCallback((task: Task) => {
    // Remove from current section, prepend to Favourites (create if needed)
    updateSections(secs => {
      const withoutTask = secs.map(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== task.id) }));
      const fi = getFavIndex(withoutTask);
      if (fi === -1) {
        const favSection: Section = { id: "favourites", type: "favourites", title: "⭐ Current", tasks: [task] };
        return [favSection, ...withoutTask];
      }
      return withoutTask.map((s, i) => i === fi ? { ...s, tasks: [task, ...s.tasks] } : s);
    });
  }, []);

  const onUnstarTask = useCallback((task: Task) => {
    // Remove from Favourites, move to Unsorted; remove Favourites if now empty
    updateSections(secs => {
      const withoutTask = secs.map(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== task.id) }));
      const fi = getFavIndex(withoutTask);
      let next = withoutTask;
      if (fi !== -1 && withoutTask[fi].tasks.length === 0) {
        next = withoutTask.filter(s => s.type !== "favourites");
      }
      const [withUnsorted, unsorted] = getOrCreateUnsorted(next);
      return withUnsorted.map(s => s.id === unsorted.id ? { ...s, tasks: [...s.tasks, task] } : s);
    });
  }, []);

  // ── Rename task (collapsed only) ───────────────────────────────────────────

  const onStartEditTask = useCallback((task: Task) => {
    setEditTaskId(task.id);
    setEditTaskVal(isRenamed(task) ? task.label : "");
  }, []);

  const onCommitEditTask = useCallback(() => {
    if (!editTaskId) return;
    const val = editTaskVal.trim();
    updateSections(secs => secs.map(s => ({
      ...s,
      tasks: s.tasks.map(t => {
        if (t.id !== editTaskId) return t;
        const newLabel = val || t.label;
        return { ...t, label: newLabel, checked: val ? t.checked : false };
      }),
    })));
    setEditTaskId(null);
  }, [editTaskId, editTaskVal]);

  // ── Rename section (expanded only) ────────────────────────────────────────

  const onStartEditSec = useCallback((s: Section) => {
    setEditSecId(s.id);
    setEditSecVal(s.title);
  }, []);

  const onCommitEditSec = useCallback(() => {
    if (!editSecId) return;
    const val = editSecVal.trim();
    if (val) {
      updateSections(secs => secs.map(s => s.id === editSecId ? { ...s, title: val } : s));
    }
    setEditSecId(null);
  }, [editSecId, editSecVal]);

  // ── Delete section ────────────────────────────────────────────────────────

  const onDeleteSection = useCallback((section: Section) => {
    if (!window.confirm(`Delete section "${section.title}"?`)) return;
    updateSections(secs => {
      const withoutSec = secs.filter(s => s.id !== section.id);
      if (section.tasks.length === 0) return withoutSec;
      // Move orphaned tasks to Unsorted
      const [withUnsorted, unsorted] = getOrCreateUnsorted(withoutSec);
      return withUnsorted.map(s => s.id === unsorted.id
        ? { ...s, tasks: [...s.tasks, ...section.tasks] }
        : s
      );
    });
  }, []);

  // ── Add section ───────────────────────────────────────────────────────────

  function addSection() {
    const newSec: Section = {
      id:    crypto.randomUUID(),
      type:  "custom",
      title: "New Section",
      tasks: [],
    };
    setSections(prev => {
      const idx = newSectionInsertIndex(prev);
      return [...prev.slice(0, idx), newSec, ...prev.slice(idx)];
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!canSubmit) return;
    const nextLifetime = lifetime + checkedCount;
    setLifetime(nextLifetime);
    setSections(prev => prev.map(s => ({
      ...s,
      tasks: s.tasks.map(t => t.checked ? { ...t, checked: false } : t),
    })));
  }

  // ── DnD ───────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart({ active }: DragStartEvent) {
    setActiveType(active.data.current?.type ?? null);
  }

  // Track which section a task is currently over (for cross-section preview)
  const [overId, setOverId] = useState<string | null>(null);

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) { setOverId(null); return; }
    const aType = active.data.current?.type;
    if (aType === "task") setOverId(over.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const aType = active.data.current?.type;
    setActiveType(null);
    setOverId(null);

    if (aType === "add10") {
      if (!over) return;
      const ovData = over.data.current;
      // Accept drop on secbody or another task within a non-fav section
      let targetSectionId: string | null = null;
      if (ovData?.type === "secbody") targetSectionId = ovData.sectionId;
      else if (ovData?.type === "task") targetSectionId = ovData.sectionId;
      if (!targetSectionId) return;
      // Block Favourites
      const sec = sectionsRef.current.find(s => s.id === targetSectionId);
      if (!sec || sec.type === "favourites") return;
      // Add 10 tasks
      const startN = sec.tasks.length + 1;
      const newTasks = Array.from({ length: PAGE_SIZE }, (_, i) => newTask(startN + i));
      setSections(prev => prev.map(s => s.id === targetSectionId
        ? { ...s, tasks: [...s.tasks, ...newTasks] }
        : s
      ));
      return;
    }

    if (aType === "section") {
      if (!over || active.id === over.id) return;
      setSections(prev => {
        const ids     = prev.map(s => `sec-${s.id}`);
        const fromIdx = ids.indexOf(active.id as string);
        const toIdx   = ids.indexOf(over.id   as string);
        if (fromIdx === -1 || toIdx === -1) return prev;
        // Don't move Favourites
        if (prev[fromIdx]?.type === "favourites") return prev;
        // Don't move before Favourites
        const favIdx = getFavIndex(prev);
        const safeToIdx = favIdx !== -1 ? Math.max(toIdx, favIdx + 1) : toIdx;
        return arrayMove(prev, fromIdx, safeToIdx);
      });
      return;
    }

    if (aType === "task") {
      if (!over || active.id === over.id) return;
      const activeTaskId = active.data.current?.taskId as string;
      const activeSecId  = active.data.current?.sectionId as string;

      // Determine destination section and position
      let destSectionId: string | null = null;
      let destTaskId:    string | null = null;

      if (over.data.current?.type === "secbody") {
        destSectionId = over.data.current.sectionId;
      } else if (over.data.current?.type === "task") {
        destSectionId = over.data.current.sectionId;
        destTaskId    = over.data.current.taskId;
      }

      if (!destSectionId) return;
      // Block drop into Favourites
      const destSec = sectionsRef.current.find(s => s.id === destSectionId);
      if (!destSec || destSec.type === "favourites") return;

      setSections(prev => {
        // Remove task from source
        let movedTask: Task | null = null;
        let next = prev.map(s => {
          if (s.id !== activeSecId) return s;
          const t = s.tasks.find(t => t.id === activeTaskId);
          if (t) movedTask = t;
          return { ...s, tasks: s.tasks.filter(t => t.id !== activeTaskId) };
        });
        if (!movedTask) return prev;

        // Insert into destination
        next = next.map(s => {
          if (s.id !== destSectionId) return s;
          if (!destTaskId) return { ...s, tasks: [...s.tasks, movedTask!] };
          const destIdx = s.tasks.findIndex(t => t.id === destTaskId);
          const tasks   = [...s.tasks];
          tasks.splice(destIdx === -1 ? tasks.length : destIdx, 0, movedTask!);
          return { ...s, tasks };
        });
        return next;
      });
    }
  }

  function onDragCancel() {
    setActiveType(null);
    setOverId(null);
  }

  // ── Section id list for section-level sortable ────────────────────────────

  const sectionSortIds = sections.map(s => `sec-${s.id}`);

  // ── Collapsed view — Favourites section only ──────────────────────────────

  const favSection = sections.find(s => s.type === "favourites") ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <span className="checkbox-finishes">🏆 <span className="checkbox-finishes-num">{finishes}</span></span>
        </div>
      </div>

      {/* Expand / collapse — below gold bar, above content */}
      <div className="checkbox-expand-row">
        <button
          className="checkbox-expand-btn"
          onClick={() => { setExpanded(v => !v); setEditTaskId(null); setEditSecId(null); }}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "∧" : "∨"}
        </button>
      </div>

      {/* ── Collapsed: only Favourites section, stars interactive ── */}
      {!expanded && favSection && (
        <div className="cb-sections">
          <SortableSection
            key={favSection.id}
            section={favSection}
            expanded={false}
            activeType={null}
            editTaskId={null}
            editTaskVal=""
            editSecId={null}
            editSecVal=""
            onStartEditTask={() => {}}
            onEditTaskChange={() => {}}
            onCommitEditTask={() => {}}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onStarTask={onStarTask}
            onUnstarTask={onUnstarTask}
            onDeleteSection={() => {}}
            onStartEditSec={() => {}}
            onEditSecChange={() => {}}
            onCommitEditSec={() => {}}
          />
        </div>
      )}

      {/* ── Expanded: controls + all sections ── */}
      {expanded && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="cb-controls">
            <button className="cb-add-section-btn" onClick={addSection}>+ Add Section</button>
            <Add10Button />
          </div>

          <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
            <div className="cb-sections">
              {sections.map(section => (
                <SortableSection
                  key={section.id}
                  section={section}
                  expanded={true}
                  activeType={activeType}
                  editTaskId={editTaskId}
                  editTaskVal={editTaskVal}
                  editSecId={editSecId}
                  editSecVal={editSecVal}
                  onStartEditTask={onStartEditTask}
                  onEditTaskChange={setEditTaskVal}
                  onCommitEditTask={onCommitEditTask}
                  onToggleTask={onToggleTask}
                  onDeleteTask={onDeleteTask}
                  onStarTask={onStarTask}
                  onUnstarTask={onUnstarTask}
                  onDeleteSection={onDeleteSection}
                  onStartEditSec={onStartEditSec}
                  onEditSecChange={setEditSecVal}
                  onCommitEditSec={onCommitEditSec}
                />
              ))}
              {sections.length === 0 && (
                <p className="cb-empty-state">No sections yet. Add one above.</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Footer — Submit (only in expanded) */}
      {expanded && (
        <div className="checkbox-footer">
          <button
            className={`checkbox-submit${canSubmit ? " checkbox-submit-ready" : ""}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={canSubmit ? "Submit and reset checked tasks" : `Check at least ${MIN_SUBMIT} tasks to submit`}
          >
            Submit ({checkedCount})
          </button>
        </div>
      )}

    </div>
  );
}
