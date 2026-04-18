import { useMemo } from 'react'
import type { Conversation } from '../types'
import { deleteConversation, exportConversation } from '../api/client'

interface Props {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDeleted: (id: string) => void
  onRefresh: () => void
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const c of conversations) {
    const d = new Date(c.updated_at)
    if (d >= todayStart) groups[0].items.push(c)
    else if (d >= yesterdayStart) groups[1].items.push(c)
    else if (d >= weekStart) groups[2].items.push(c)
    else groups[3].items.push(c)
  }

  return groups.filter(g => g.items.length > 0)
}

export default function Sidebar({ conversations, selectedId, onSelect, onNew, onDeleted, onRefresh }: Props) {
  const groups = useMemo(() => groupConversations(conversations), [conversations])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return
    await deleteConversation(id)
    onDeleted(id)
  }

  async function handleExport(e: React.MouseEvent, conv: Conversation) {
    e.stopPropagation()
    await exportConversation(conv.id, conv.title)
  }

  return (
    <aside style={{
      width: 260,
      minWidth: 260,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onNew} style={{
          width: '100%',
          padding: '9px 12px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: 0.2,
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          + New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {conversations.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            No conversations yet
          </p>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              padding: '8px 8px 4px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {group.label}
            </div>
            {group.items.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onSelect={() => onSelect(conv.id)}
                onDelete={e => handleDelete(e, conv.id)}
                onExport={e => handleExport(e, conv)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}

function ConvItem({ conv, selected, onSelect, onDelete, onExport }: {
  conv: Conversation
  selected: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onExport: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '7px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        background: selected ? 'var(--surface2)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        marginBottom: 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
        color: selected ? 'var(--text)' : 'var(--text-muted)',
      }}>
        {conv.title || 'Untitled'}
      </span>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <IconBtn title="Export" onClick={onExport}>↓</IconBtn>
        <IconBtn title="Delete" onClick={onDelete} danger>×</IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: danger ? 'var(--danger)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        padding: '2px 4px',
        borderRadius: 4,
        opacity: 0.7,
        transition: 'opacity 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
    >
      {children}
    </button>
  )
}
