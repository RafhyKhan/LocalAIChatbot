import { useRef, useState } from "react";

interface TokenInfo {
  used: number;
  limit: number;
  remaining: number;
}

export default function InputArea({
  onSend,
  onStop,
  disabled,
  tokenInfo,
}: {
  onSend: (msg: string) => void;
  onStop?: () => void;
  disabled: boolean;
  tokenInfo: TokenInfo | null;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function send() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  }

  // Colour the token count: green → yellow → red as it fills up
  function tokenColour(used: number, limit: number): string {
    const pct = used / limit;
    if (pct < 0.65) return "var(--dim)";
    if (pct < 0.85) return "#f59e0b";
    return "#f87171";
  }

  return (
    <div className="input-wrap">
      <div className="input-box">
        <textarea
          ref={ref}
          className="input-ta"
          placeholder="Message RainAI..."
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        {disabled ? (
          <button className="stop-btn" onClick={onStop} title="Stop generating">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="0" y="0" width="12" height="12" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            className={`send-btn${text.trim() ? " send-active" : ""}`}
            onClick={send}
            disabled={!text.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
      <div className="input-footer">
        <p className="input-hint">Enter to send · Shift+Enter for new line</p>
        {tokenInfo && (
          <p
            className="token-counter"
            style={{ color: tokenColour(tokenInfo.used, tokenInfo.limit) }}
            title="Estimated tokens in context (system prompt + last 8 messages)"
          >
            ~{tokenInfo.used.toLocaleString()} / {tokenInfo.limit.toLocaleString()} estimated tokens
          </p>
        )}
      </div>
    </div>
  );
}
