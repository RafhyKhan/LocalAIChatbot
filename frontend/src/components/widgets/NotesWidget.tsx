/**
 * NotesWidget — a single persistent scratchpad.
 * Content is stored in localStorage so it survives page refreshes,
 * browser restarts, and computer restarts.
 * Auto-saves 500ms after you stop typing.
 */
import "./NotesWidget.css";
import { useState, useRef, useCallback } from "react";

const STORAGE_KEY = "rainai_notes";

function loadNote(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export default function NotesWidget() {
  const [text, setText]     = useState<string>(loadNote);
  const saveTimer           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    // Debounce: save 500ms after the user stops typing
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, value);
    }, 500);
  }, []);

  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const charCount = text.length;

  return (
    <div className="widget notes-widget">
      <div className="widget-header">
        <span className="widget-title">📝 Notes</span>
        <span className="notes-counts">{wordCount}w · {charCount}c</span>
      </div>

      <textarea
        className="notes-textarea"
        placeholder="Start typing…"
        value={text}
        onChange={handleChange}
        spellCheck
      />
    </div>
  );
}
