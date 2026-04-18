import { useState, useEffect } from 'react'
import type { Settings } from '../types'
import { fetchSettings, saveSettings } from '../api/client'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({ user_profile: '', behavior_instructions: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings().then(setSettings).catch(console.error)
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 28,
        width: 480,
        maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <Label text="User Profile" hint="Who you are — prepended to every conversation" />
        <textarea
          value={settings.user_profile}
          onChange={e => setSettings(s => ({ ...s, user_profile: e.target.value }))}
          placeholder="e.g. I'm a software engineer who prefers concise answers..."
          rows={4}
          style={textareaStyle}
        />

        <Label text="Behavior Instructions" hint="How the assistant should act" />
        <textarea
          value={settings.behavior_instructions}
          onChange={e => setSettings(s => ({ ...s, behavior_instructions: e.target.value }))}
          placeholder="e.g. Always reply in bullet points. Be direct and technical."
          rows={4}
          style={textareaStyle}
        />

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          Combined profile + instructions are capped at ~360 chars to avoid token overhead.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={primaryBtn}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ text, hint }: { text: string; hint: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{text}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{hint}</span>
    </div>
  )
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  padding: '8px 10px',
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
  outline: 'none',
  marginBottom: 16,
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  borderRadius: 8,
  padding: '7px 18px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}

const secondaryBtn: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '7px 18px',
  cursor: 'pointer',
  fontSize: 13,
}
