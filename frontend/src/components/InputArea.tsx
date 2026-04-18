import { useRef, useState, useCallback } from 'react'
import { uploadPDF } from '../api/client'

interface Props {
  onSend: (message: string, imageData?: string, imageMime?: string, pdfContext?: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled: boolean
}

export default function InputArea({ onSend, onStop, isStreaming, disabled }: Props) {
  const [text, setText] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pdfContext, setPdfContext] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const msg = text.trim()
    if (!msg && !pdfContext) return
    onSend(msg, imageData ?? undefined, imageMime ?? undefined, pdfContext ?? undefined)
    setText('')
    setImageData(null)
    setImageMime(null)
    setImagePreview(null)
    setPdfContext(null)
    setPdfName(null)
  }, [text, imageData, imageMime, pdfContext, onSend])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming) handleSend()
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type === 'application/pdf') {
      setUploading(true)
      try {
        const result = await uploadPDF(file)
        if (result.mode === 'full' && result.text) {
          setPdfContext(`[PDF: ${file.name}]\n${result.text}`)
        } else if (result.mode === 'chunked' && result.chunks) {
          setPdfContext(`[PDF: ${file.name}]\n${result.chunks.join('\n---\n')}`)
        }
        setPdfName(file.name)
      } catch {
        alert('Failed to process PDF')
      } finally {
        setUploading(false)
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        const base64 = dataUrl.split(',')[1]
        setImageData(base64)
        setImageMime(file.type)
        setImagePreview(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)' }}>
      {(imagePreview || pdfName) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {imagePreview && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="preview" style={{ height: 60, borderRadius: 6, objectFit: 'cover' }} />
              <button
                onClick={() => { setImageData(null); setImageMime(null); setImagePreview(null) }}
                style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: '#fff', fontSize: 11, lineHeight: '18px', textAlign: 'center' }}
              >×</button>
            </div>
          )}
          {pdfName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', padding: '4px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              PDF: {pdfName}
              <button onClick={() => { setPdfContext(null); setPdfName(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>×</button>
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: 8,
        background: 'var(--input-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '8px 10px',
        alignItems: 'flex-end',
      }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach PDF or image"
          disabled={uploading}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            padding: '2px 4px',
            lineHeight: 1,
            opacity: uploading ? 0.4 : 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = uploading ? '0.4' : '0.7')}
        >
          {uploading ? '...' : '📎'}
        </button>

        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14,
            resize: 'none',
            lineHeight: 1.6,
            maxHeight: 160,
            overflowY: 'auto',
            fontFamily: 'inherit',
          }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 160) + 'px'
          }}
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !pdfContext)}
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: (disabled || (!text.trim() && !pdfContext)) ? 0.4 : 1,
              transition: 'opacity 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            Send
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
