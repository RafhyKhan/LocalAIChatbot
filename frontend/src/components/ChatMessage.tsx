import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Message } from "../types";

export default function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="msg-row msg-user">
        <div className="bubble-user">{message.content}</div>
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
