import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
