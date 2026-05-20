/**
 * SettingsPage — personal profile editor + Live Data preview.
 *
 * Personal Profile: freeform text (max 150 chars) included in every
 * Live Data Update message sent to RainAI.
 *
 * Live Data Preview: shows exactly what gets sent to the AI when
 * you press "📡 Live Data Update" in the sidebar.
 */

import { useEffect, useRef, useState } from "react";
import type { Conversation } from "../types";
import { fetchProfile, saveProfile, fetchContextPreview, fetchArchivedConversations, restoreConversation, fetchRagDocuments, triggerRagIndex, fetchRagIndexStatus, deleteRagDocument } from "../api";
import type { RagDocument } from "../api";

const MAX_CHARS = 150;

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [content,        setContent]        = useState("");
  const [previewText,    setPreviewText]    = useState("");
  const [loading,        setLoading]        = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [saving,         setSaving]         = useState(false);

  const [archived,       setArchived]       = useState<Conversation[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [restoringId,    setRestoringId]    = useState<string | null>(null);

  const [ragDocs,      setRagDocs]      = useState<RagDocument[]>([]);
  const [ragLoading,   setRagLoading]   = useState(true);
  const [ragIndexing,  setRagIndexing]  = useState(false);
  const [ragResults,   setRagResults]   = useState<{ name: string; status: string; chunks?: number; error?: string }[]>([]);
  const [deletingDoc,  setDeletingDoc]  = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchContextPreview()])
      .then(([profile, preview]) => {
        setContent(profile);
        setPreviewText(preview);
      })
      .catch(() => {/* keep defaults */})
      .finally(() => setLoading(false));

    fetchArchivedConversations()
      .then(setArchived)
      .catch(() => setArchived([]))
      .finally(() => setArchiveLoading(false));

    fetchRagDocuments()
      .then(setRagDocs)
      .catch(() => setRagDocs([]))
      .finally(() => setRagLoading(false));

    // Resume polling if indexing was already running
    fetchRagIndexStatus().then(status => {
      if (status.running) {
        setRagIndexing(true);
        pollRef.current = setInterval(async () => {
          try {
            const s = await fetchRagIndexStatus();
            if (!s.running) {
              clearInterval(pollRef.current!);
              pollRef.current = null;
              setRagResults(s.results);
              setRagDocs(await fetchRagDocuments());
              setRagIndexing(false);
            }
          } catch {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setRagIndexing(false);
          }
        }, 3000);
      }
    }).catch(() => {});
  }, []);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreConversation(id);
      setArchived((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setRestoringId(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveProfile(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function refreshPreview() {
    setPreviewLoading(true);
    try {
      setPreviewText(await fetchContextPreview());
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRagIndex() {
    setRagIndexing(true);
    setRagResults([]);
    try {
      await triggerRagIndex();
    } catch {
      setRagIndexing(false);
      return;
    }
    // Poll until background indexing completes
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchRagIndexStatus();
        if (!status.running) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setRagResults(status.results);
          setRagDocs(await fetchRagDocuments());
          setRagIndexing(false);
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setRagIndexing(false);
      }
    }, 3000);
  }

  // Clean up poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleDeleteDoc(name: string) {
    setDeletingDoc(name);
    try {
      await deleteRagDocument(name);
      setRagDocs(prev => prev.filter(d => d.name !== name));
    } finally {
      setDeletingDoc(null);
    }
  }

  const charCount   = content.length;
  const counterRed  = charCount > 130;

  return (
    <div className="settings-page">

      {/* Header */}
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h2 className="settings-title">Settings</h2>
      </div>

      {/* ── Personal Profile ── */}
      <section className="settings-section">
        <h3 className="settings-section-title">Personal Profile</h3>
        <p className="settings-hint">
          A short description of yourself — included in every{" "}
          <strong>📡 Live Data Update</strong> message. Max {MAX_CHARS} characters.
        </p>
        <p className="settings-example">
          Example:{" "}
          <em>
            "{import.meta.env.VITE_USER_NAME || "Your Name"}, 2nd year Computer Science student. Goal: graduate with honours.
            Morning focus, prefers concise answers."
          </em>
        </p>

        {loading ? (
          <div className="settings-loading">Loading…</div>
        ) : (
          <>
            <textarea
              className="settings-profile-input"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Write your personal profile here…"
              rows={4}
              spellCheck
              maxLength={MAX_CHARS}
            />
            <div className="settings-profile-footer">
              <span
                className="settings-char-counter"
                style={{ color: counterRed ? "#f87171" : undefined }}
              >
                {charCount} / {MAX_CHARS}
              </span>
              <button
                className="settings-save-btn"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Live Data Preview ── */}
      <section className="settings-section">
        <div className="settings-preview-header">
          <h3 className="settings-section-title">Live Data Preview</h3>
          <button
            className="settings-preview-refresh"
            onClick={refreshPreview}
            disabled={previewLoading}
            title="Refresh preview"
          >
            {previewLoading ? "…" : "🔄 Refresh"}
          </button>
        </div>
        <p className="settings-hint">
          This is exactly what gets sent to RainAI when you press{" "}
          <strong>📡 Live Data Update</strong>.
        </p>
        <pre className="settings-preview-block">
          {loading || previewLoading
            ? "Loading…"
            : previewText || "(no data — connect Google Calendar or add checklist tasks)"}
        </pre>
      </section>

      {/* ── Document Library (RAG) ── */}
      <section className="settings-section">
        <div className="settings-preview-header">
          <h3 className="settings-section-title">Document Library</h3>
          <button
            className="settings-preview-refresh"
            onClick={handleRagIndex}
            disabled={ragIndexing}
            title="Index all PDFs in backend/docs/"
          >
            {ragIndexing ? "Indexing…" : "🔄 Index Documents"}
          </button>
        </div>
        <p className="settings-hint">
          Drop PDF files into <code className="settings-code">backend/docs/</code> then click
          {" "}<strong>Index Documents</strong>. RainAI will reference them automatically when relevant.
        </p>
        {ragIndexing && (
          <p className="settings-hint" style={{ color: "#facc15" }}>
            ⏳ Indexing in background — large PDFs may take a few minutes…
          </p>
        )}

        {/* Index results */}
        {ragResults.length > 0 && (
          <div className="rag-results">
            {ragResults.map(r => (
              <div key={r.name} className={`rag-result-item rag-result-${r.status}`}>
                <span className="rag-result-name">{r.name}</span>
                <span className="rag-result-status">
                  {r.status === "indexed"  && `✓ ${r.chunks} chunks`}
                  {r.status === "skipped"  && `— unchanged (${r.chunks} chunks)`}
                  {r.status === "error"    && `✗ ${r.error}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Indexed documents list */}
        {ragLoading ? (
          <div className="settings-loading">Loading…</div>
        ) : ragDocs.length === 0 ? (
          <p className="settings-archive-empty">No documents indexed yet.</p>
        ) : (
          <div className="rag-doc-list">
            {ragDocs.map(doc => (
              <div key={doc.name} className="rag-doc-item">
                <div className="rag-doc-info">
                  <span className="rag-doc-name">{doc.name}</span>
                  <span className="rag-doc-chunks">{doc.chunks} chunks</span>
                </div>
                <button
                  className="rag-doc-delete"
                  onClick={() => handleDeleteDoc(doc.name)}
                  disabled={deletingDoc === doc.name}
                  title="Remove from index"
                >
                  {deletingDoc === doc.name ? "…" : "×"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Archived Chats ── */}
      <section className="settings-section">
        <h3 className="settings-section-title">Archived Chats</h3>
        <p className="settings-hint">
          Conversations removed from the sidebar. All data is preserved — restore any time.
        </p>

        {archiveLoading ? (
          <div className="settings-loading">Loading…</div>
        ) : archived.length === 0 ? (
          <p className="settings-archive-empty">No archived conversations.</p>
        ) : (
          <div className="settings-archive-list">
            {archived.map((c) => (
              <div key={c.id} className="settings-archive-item">
                <div className="settings-archive-info">
                  <span className="settings-archive-title">{c.title}</span>
                  <span className="settings-archive-date">
                    {new Date(c.updated_at + "Z").toLocaleDateString("en-CA", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </span>
                </div>
                <button
                  className="settings-restore-btn"
                  onClick={() => handleRestore(c.id)}
                  disabled={restoringId === c.id}
                >
                  {restoringId === c.id ? "…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
