import { useRef, useState } from "react";
import type { ImageAttachment } from "../api";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

interface TokenInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface ImagePreview {
  attachment: ImageAttachment;
  previewUrl: string;  // object URL for thumbnail display
  name: string;
}

export default function InputArea({
  onSend,
  onStop,
  disabled,
  tokenInfo,
}: {
  onSend: (msg: string, image?: ImageAttachment, previewUrl?: string) => void;
  onStop?: () => void;
  disabled: boolean;
  tokenInfo: TokenInfo | null;
}) {
  const [text,    setText]    = useState("");
  const [imgPrev, setImgPrev] = useState<ImagePreview | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function send() {
    const t = text.trim();
    if ((!t && !imgPrev) || disabled) return;
    onSend(t, imgPrev?.attachment, imgPrev?.previewUrl);
    setText("");
    setImgPrev(null);
    if (textRef.current) textRef.current.style.height = "auto";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // allow re-selecting same file
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      alert(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:<mime>;base64,<data>" — split off the prefix
      const comma = dataUrl.indexOf(",");
      const mime  = dataUrl.slice(5, dataUrl.indexOf(";"));
      const data  = dataUrl.slice(comma + 1);
      setImgPrev({
        attachment: { data, mime },
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    if (imgPrev) URL.revokeObjectURL(imgPrev.previewUrl);
    setImgPrev(null);
  }

  // Colour the token count: dim → yellow → red as it fills up
  function tokenColour(used: number, limit: number): string {
    const pct = used / limit;
    if (pct < 0.65) return "var(--dim)";
    if (pct < 0.85) return "#f59e0b";
    return "#f87171";
  }

  return (
    <div className="input-wrap">

      {/* Image thumbnail preview — shown above the input box */}
      {imgPrev && (
        <div className="input-img-preview">
          <img src={imgPrev.previewUrl} alt={imgPrev.name} className="input-img-thumb" />
          <button className="input-img-remove" onClick={removeImage} title="Remove image">×</button>
        </div>
      )}

      <div className="input-box">
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Attach image button */}
        {!disabled && (
          <button
            className="attach-btn"
            onClick={() => fileRef.current?.click()}
            title="Attach image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        )}

        <textarea
          ref={textRef}
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
            className={`send-btn${(text.trim() || imgPrev) ? " send-active" : ""}`}
            onClick={send}
            disabled={!text.trim() && !imgPrev}
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
