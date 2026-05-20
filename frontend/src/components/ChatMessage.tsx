import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Message } from "../types";

export default function ChatMessage({ message, imagePreviewUrl }: { message: Message; imagePreviewUrl?: string }) {
  if (message.role === "user") {
    const hasImage = imagePreviewUrl !== undefined;
    // imagePreviewUrl is an object URL (in-session only) or undefined (past session = placeholder)
    // We detect "past session" as: no previewUrl but content might be empty (image-only send)
    return (
      <div className="msg-row msg-user">
        <div className="bubble-user">
          {/* Image attachment — thumbnail + download, or placeholder */}
          {hasImage && (
            <div className="msg-img-wrap">
              <img src={imagePreviewUrl} alt="Attached image" className="msg-img-thumb" />
              <a
                href={imagePreviewUrl}
                download="image"
                className="msg-img-download"
                title="Download image"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
            </div>
          )}
          {message.content && <span>{message.content}</span>}
          {!hasImage && !message.content && <span className="msg-img-placeholder">📷 Image attached</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-row msg-assistant">
      <div className="bubble-assistant">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
