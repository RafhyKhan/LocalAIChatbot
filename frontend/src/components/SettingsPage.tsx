/**
 * SettingsPage — personal profile editor + Live Data preview.
 *
 * Personal Profile: freeform text (max 150 chars) included in every
 * Live Data Update message sent to RainAI.
 *
 * Live Data Preview: shows exactly what gets sent to the AI when
 * you press "📡 Live Data Update" in the sidebar.
 */

import { useEffect, useState } from "react";
import type { Conversation } from "../types";
import { fetchProfile, saveProfile, fetchContextPreview, fetchArchivedConversations, restoreConversation } from "../api";

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
