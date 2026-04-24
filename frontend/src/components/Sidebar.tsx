import type { Conversation } from "../types";
import { APP_NAME } from "../config";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  page: "dashboard" | "chat";
  onPageChange: (p: "dashboard" | "chat") => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso + "Z").getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, page, onPageChange }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {/* Page toggle: dashboard ⇄ chat */}
        <div className="page-toggle" title="Switch page">
          <button
            className={`page-toggle-btn${page === "dashboard" ? " active" : ""}`}
            onClick={() => onPageChange("dashboard")}
            title="Dashboard"
          >
            {/* Grid icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button
            className={`page-toggle-btn${page === "chat" ? " active" : ""}`}
            onClick={() => onPageChange("chat")}
            title="Chat"
          >
            {/* Chat bubble icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-brand">{APP_NAME}</div>
        <button className="icon-btn" onClick={onNew} title="New chat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <p className="sidebar-label">Recents</p>

      <div className="conv-list">
        {conversations.length === 0 && (
          <p className="conv-empty">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item${c.id === activeId ? " conv-active" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="conv-info">
              <span className="conv-title">{c.title}</span>
              <span className="conv-time">{timeAgo(c.updated_at)}</span>
            </div>
            <button
              className="conv-delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="tool-list">
          <p className="tool-list-label">Tools & APIs</p>
          {/* Update this list manually when tools are added/removed in backend/main.py ALL_TOOLS */}
          <div className="tool-items">
            <span className="tool-item">🌐 web_search</span>
            <span className="tool-item">⚡ calculate</span>
            <span className="tool-item">📅 date_diff</span>
            <span className="tool-item">📐 convert_units</span>
            <span className="tool-item">🔗 open_url</span>
            <span className="tool-item">🌤 get_weather</span>
          </div>
        </div>
        <span className="model-tag">Gemma 4 · Docker</span>
      </div>
    </aside>
  );
}
