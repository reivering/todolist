'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/types'
import { cn } from '@/lib/utils'
import { X, Search, Check, BookMarked } from 'lucide-react'

interface CreateBriefingModalProps {
  open: boolean
  onClose: () => void
  onCreated: (briefingId: string) => void
}

export function CreateBriefingModal({ open, onClose, onCreated }: CreateBriefingModalProps) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(''); setDescription(''); setSelected(new Set()); setSearch('')
    supabase
      .from('notes')
      .select('id, title, updated_at, folder:folders(id, name)')
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setNotes(data as unknown as Note[]) })
  }, [open, supabase])

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function handleCreate() {
    if (!title.trim() || selected.size === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data: briefing, error } = await supabase
      .from('briefings')
      .insert({ user_id: user.id, title: title.trim(), description: description.trim() || null })
      .select()
      .single()

    if (error || !briefing) { setSaving(false); return }

    const noteInserts = [...selected].map((noteId, i) => ({
      briefing_id: briefing.id,
      note_id: noteId,
      sort_order: i,
    }))
    await supabase.from('briefing_notes').insert(noteInserts)

    setSaving(false)
    onCreated(briefing.id)
    onClose()
  }

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BookMarked size={15} className="text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100">New Briefing</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 Review, Week 2 Study…"
              className="mt-1.5 w-full px-3 py-2 text-sm border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description <span className="font-normal normal-case text-slate-500">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this briefing about?"
              rows={2}
              className="mt-1.5 w-full px-3 py-2 text-sm border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
            />
          </div>

          {/* Note picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select Notes
              </label>
              {selected.size > 0 && (
                <span className="text-xs text-indigo-600 font-medium">{selected.size} selected</span>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-2.5 py-1.5 mb-2 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-transparent focus-within:bg-slate-900">
              <Search size={13} className="text-slate-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-slate-200 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No notes found</p>
              ) : (
                filtered.map(note => {
                  const isSelected = selected.has(note.id)
                  return (
                    <button
                      key={note.id}
                      onClick={() => toggle(note.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-900/50 border border-transparent'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border',
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                      )}>
                        {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200 truncate">{note.title}</p>
                        {note.folder && (
                          <p className="text-xs text-slate-500 truncate">{(note.folder as { name: string }).name}</p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || selected.size === 0 || saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : `Create briefing`}
          </button>
        </div>
      </div>
    </div>
  )
}
