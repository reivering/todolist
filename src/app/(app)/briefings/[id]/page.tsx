'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Briefing, Note, Flashcard } from '@/types'
import { BriefingStudyModal } from '@/components/briefings/BriefingStudyModal'
import { FlashcardModal } from '@/components/notes/FlashcardModal'
import { NoteContentRenderer } from '@/components/notes/NoteContentRenderer'
import {
  BookMarked, Sparkles, ChevronLeft, FileText, Layers,
  Trash2, Plus, Pencil, Check, X, ChevronDown,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function BriefingDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [allCards, setAllCards] = useState<Flashcard[]>([])
  const [userId, setUserId] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [showStudy, setShowStudy] = useState(false)
  const [flashcardNote, setFlashcardNote] = useState<Note | null>(null)

  // Inline editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data: b } = await supabase
      .from('briefings')
      .select('*')
      .eq('id', id)
      .single()
    if (!b) { setLoading(false); return }
    setBriefing(b as Briefing)

    const { data: bnotes } = await supabase
      .from('briefing_notes')
      .select('note_id, sort_order')
      .eq('briefing_id', id)
      .order('sort_order')

    if (!bnotes || bnotes.length === 0) { setLoading(false); return }

    const noteIds = bnotes.map(r => r.note_id)
    const { data: noteRows } = await supabase
      .from('notes')
      .select('*, folder:folders(id, name)')
      .in('id', noteIds)
      .eq('is_trashed', false)

    if (noteRows) {
      // Preserve briefing_notes sort order
      const notesArray = noteRows as Note[]
      const ordered = bnotes
        .map(bn => notesArray.find(n => n.id === bn.note_id))
        .filter((n): n is Note => n !== undefined)
      setNotes(ordered)
      // Expand all notes by default so user can read them
      setExpandedNotes(new Set(ordered.map(n => n.id)))

      const { data: cards } = await supabase
        .from('flashcards')
        .select('*')
        .in('note_id', noteIds)
        .order('sort_order')
        .order('created_at')
      setAllCards((cards ?? []) as Flashcard[])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveTitle() {
    if (!draftTitle.trim() || !briefing) { setEditingTitle(false); return }
    const newTitle = draftTitle.trim()
    await supabase.from('briefings').update({ title: newTitle }).eq('id', id)
    setBriefing(prev => prev ? { ...prev, title: newTitle } : prev)
    setEditingTitle(false)
    toast.success('Briefing renamed')
  }

  async function removeNote(noteId: string) {
    await supabase
      .from('briefing_notes')
      .delete()
      .eq('briefing_id', id)
      .eq('note_id', noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
    setAllCards(prev => prev.filter(c => c.note_id !== noteId))
    toast.success('Note removed from briefing')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!briefing) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Briefing not found.
      </div>
    )
  }

  const cardsByNote = (noteId: string) => allCards.filter(c => c.note_id === noteId)

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/40">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <button
          onClick={() => router.push('/briefings')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
        >
          <ChevronLeft size={13} /> All briefings
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookMarked size={18} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                    className="text-xl font-bold text-gray-900 bg-transparent border-b-2 border-indigo-400 outline-none flex-1"
                  />
                  <button onClick={saveTitle} className="p-1 hover:bg-green-50 rounded text-green-500"><Check size={15} /></button>
                  <button onClick={() => setEditingTitle(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400"><X size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl font-bold text-gray-900 truncate">{briefing.title}</h1>
                  <button
                    onClick={() => { setDraftTitle(briefing.title); setEditingTitle(true) }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded text-gray-400"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
              {briefing.description && (
                <p className="text-sm text-gray-400 mt-0.5">{briefing.description}</p>
              )}
              <p className="text-xs text-gray-300 mt-1">
                {notes.length} note{notes.length !== 1 ? 's' : ''} · {allCards.length} flashcard{allCards.length !== 1 ? 's' : ''} · Updated {formatDate(briefing.updated_at)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowStudy(true)}
              disabled={allCards.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Sparkles size={14} /> Study flashcards
            </button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-8">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-400">All notes have been removed from this briefing.</p>
            <button onClick={() => router.push('/briefings')} className="mt-3 text-sm text-indigo-500 hover:underline">
              Back to briefings
            </button>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            {notes.map((note, i) => {
              const cards = cardsByNote(note.id)
              const expanded = expandedNotes.has(note.id)
              function toggleExpand() {
                setExpandedNotes(prev => {
                  const n = new Set(prev); n.has(note.id) ? n.delete(note.id) : n.add(note.id); return n
                })
              }
              return (
                <div key={note.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Note header — click to collapse/expand */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={toggleExpand}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-300 tabular-nums w-5 flex-shrink-0">{i + 1}</span>
                      <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText size={13} className="text-violet-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{note.title}</p>
                        {note.folder && (
                          <p className="text-xs text-gray-400">{(note.folder as { name: string }).name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setFlashcardNote(note)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-600 hover:bg-violet-50 rounded-lg border border-violet-200"
                      >
                        <Layers size={12} />
                        {cards.length} card{cards.length !== 1 ? 's' : ''}
                      </button>
                      <button
                        onClick={() => removeNote(note.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400"
                        title="Remove from briefing"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronDown size={14} className={cn('text-gray-400 transition-transform', expanded && 'rotate-180')} />
                    </div>
                  </div>

                  {/* Note content (the actual briefing material) */}
                  {expanded && (
                    <div className="px-8 py-5 border-t border-gray-100">
                      <NoteContentRenderer content={note.content} />
                    </div>
                  )}

                  {/* Flashcard strip */}
                  <div className={cn('border-t border-gray-100 px-5 py-3', expanded && 'bg-gray-50/60')}>
                    {cards.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400 font-medium">Cards:</span>
                        {cards.slice(0, 4).map(card => (
                          <span key={card.id} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 rounded-lg px-2 py-0.5 truncate max-w-[180px]">
                            {card.front}
                          </span>
                        ))}
                        {cards.length > 4 && <span className="text-xs text-gray-400">+{cards.length - 4} more</span>}
                        <button onClick={() => setFlashcardNote(note)} className="text-xs text-violet-500 hover:text-violet-700 ml-auto">
                          Edit cards →
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFlashcardNote(note)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600"
                      >
                        <Plus size={12} /> Add flashcards to this note
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <BriefingStudyModal
        open={showStudy}
        briefingTitle={briefing.title}
        notes={notes}
        cards={allCards}
        onClose={() => setShowStudy(false)}
      />

      {flashcardNote && (
        <FlashcardModal
          note={flashcardNote}
          userId={userId}
          open={true}
          onClose={() => { setFlashcardNote(null); load() }}
        />
      )}
    </div>
  )
}
