import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message as Msg } from '../types'

interface Props {
  message: Msg
  isStreaming?: boolean
  streamContent?: string
}

export default function Message({ message, isStreaming, streamContent }: Props) {
  const isUser = message.role === 'user'
  const content = isStreaming ? (streamContent ?? '') : message.content

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 20,
      padding: '0 24px',
    }}>
      <div style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        marginBottom: 4,
        paddingLeft: isUser ? 0 : 4,
        paddingRight: isUser ? 4 : 0,
      }}>
        {isUser ? 'You' : 'Assistant'}
      </div>

      {isUser && message.image_data && (
        <img
          src={message.image_data}
          alt="uploaded"
          style={{ maxWidth: 280, maxHeight: 200, borderRadius: 8, marginBottom: 6, objectFit: 'contain' }}
        />
      )}

      <div style={{
        maxWidth: '78%',
        padding: isUser ? '10px 14px' : '2px 0',
        background: isUser ? 'var(--user-msg-bg)' : 'transparent',
        borderRadius: isUser ? 12 : 0,
        fontSize: 14,
        lineHeight: 1.65,
        color: 'var(--text)',
      }}>
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>
        ) : (
          <div className="assistant-content" style={{ wordBreak: 'break-word' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {isStreaming && <span className="cursor" />}
          </div>
        )}
      </div>
    </div>
  )
}
