'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn, getContentPreview } from '@/lib/utils'
import type { Note } from '@/types'
import { Pin, Folder } from 'lucide-react'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { NoteContentRenderer } from '@/components/notes/NoteContentRenderer'

interface NoteListProps {
  notes: Note[]
  selectedId: string | null
  onSelect: (note: Note) => void
}

function smartDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEE')
  return format(d, 'MMM d')
}

export function NoteList({ notes, selectedId, onSelect }: NoteListProps) {
  const pinned = notes.filter(n => n.is_pinned)
  const unpinned = notes.filter(n => !n.is_pinned)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {pinned.length > 0 && (
        <>
          <GroupLabel label="Pinned" />
          {pinned.map(note => (
            <NoteItem key={note.id} note={note} selected={selectedId === note.id} onSelect={onSelect} />
          ))}
        </>
      )}
      {unpinned.length > 0 && (
        <>
          {pinned.length > 0 && <GroupLabel label="Notes" />}
          {unpinned.map(note => (
            <NoteItem key={note.id} note={note} selected={selectedId === note.id} onSelect={onSelect} />
          ))}
        </>
      )}
    </div>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1.5">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  )
}

function NoteItem({ note, selected, onSelect }: { note: Note; selected: boolean; onSelect: (n: Note) => void }) {
  const preview = getContentPreview(note.content)
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setHoverPos({ top: r.top, left: r.right + 8 })
    }, 400)
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHoverPos(null)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <>
    <button
      ref={btnRef}
      onClick={() => onSelect(note)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('noteId', note.id)
        e.dataTransfer.setData('noteTitle', note.title)
        e.dataTransfer.effectAllowed = 'move'
        handleMouseLeave()
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'w-full text-left px-4 py-3.5 border-b border-slate-800 relative group transition-colors cursor-grab active:cursor-grabbing',
        selected
          ? 'bg-violet-50 border-l-[3px] border-l-violet-500'
          : 'hover:bg-slate-900/50 border-l-[3px] border-l-transparent'
      )}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={cn(
          'text-[13px] font-semibold truncate flex-1 leading-tight',
          selected ? 'text-violet-900' : 'text-slate-200'
        )}>
          {note.title || 'Untitled'}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {note.is_pinned && <Pin size={10} className="text-violet-400 fill-violet-400" />}
          <span className="text-[11px] text-slate-500 tabular-nums">
            {smartDate(note.updated_at)}
          </span>
        </div>
      </div>

      {/* Preview */}
      {preview ? (
        <p className="text-xs text-slate-500 truncate leading-relaxed">{preview}</p>
      ) : (
        <p className="text-xs text-slate-600 italic">No content</p>
      )}

      {/* Footer: folder + tags */}
      {(note.folder || (note.tags && note.tags.length > 0)) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {note.folder && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Folder size={10} className="text-amber-400" />
              {note.folder.name}
            </span>
          )}
          {note.tags && note.tags.slice(0, 2).map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: tag.color + '18', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {note.tags && note.tags.length > 2 && (
            <span className="text-[10px] text-slate-500">+{note.tags.length - 2}</span>
          )}
        </div>
      )}
    </button>

    {/* Hover preview portal */}
    {hoverPos && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden pointer-events-none"
        style={{
          top: Math.min(hoverPos.top, window.innerHeight - 340),
          left: hoverPos.left,
          maxHeight: 320,
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-800">
          <p className="text-sm font-semibold text-slate-100 leading-snug">{note.title || 'Untitled'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {note.folder && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Folder size={10} className="text-amber-400" /> {note.folder.name}
              </span>
            )}
            {note.tags?.slice(0, 3).map(tag => (
              <span key={tag.id} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        </div>
        {/* Content preview */}
        <div className="px-4 py-3 overflow-hidden" style={{ maxHeight: 220 }}>
          {note.content
            ? <NoteContentRenderer content={note.content} className="text-xs text-slate-300 line-clamp-[10]" />
            : <p className="text-xs text-slate-600 italic">No content</p>
          }
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
