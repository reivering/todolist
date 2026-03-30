'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note, Folder, NoteTag, Briefing } from '@/types'
import { NoteList } from '@/components/notes/NoteList'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { NoteTagManager } from '@/components/notes/NoteTagManager'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Plus, Pin, PinOff, Trash2, FolderInput, FileText, MoreHorizontal,
  ChevronDown, Layers, BookMarked
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { FlashcardModal } from '@/components/notes/FlashcardModal'

export default function NotesPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const folderId = searchParams.get('folder')
  const tagId = searchParams.get('tag')

  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [allTags, setAllTags] = useState<NoteTag[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [showBriefingMenu, setShowBriefingMenu] = useState(false)
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [userId, setUserId] = useState('')
  const [showNotesList, setShowNotesList] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id) })
  }, [supabase])

  const selectedNoteRef = useRef(selectedNote)
  selectedNoteRef.current = selectedNote

  const loadNotes = useCallback(async () => {
    let query = supabase
      .from('notes')
      .select('*, folder:folders(id, name), tags:note_tags!note_tag_relations(id, name, color, user_id, created_at)')
      .eq('is_trashed', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (folderId) query = query.eq('folder_id', folderId)
    if (tagId) {
      // Filter by tag via junction
      const { data: relations } = await supabase
        .from('note_tag_relations')
        .select('note_id')
        .eq('tag_id', tagId)
      if (relations) {
        const ids = relations.map(r => r.note_id)
        query = ids.length > 0 ? query.in('id', ids) : query.eq('id', '00000000-0000-0000-0000-000000000000')
      }
    }

    const { data } = await query
    if (data) {
      setNotes(data as Note[])
      if (!selectedNoteRef.current && data.length > 0) setSelectedNote(data[0] as Note)
    }
    setLoading(false)
  }, [supabase, folderId, tagId])

  useEffect(() => {
    setLoading(true)
    setSelectedNote(null)
    loadNotes()
  }, [loadNotes])

  // Refresh when a note is moved to a folder via sidebar drag-and-drop
  useEffect(() => {
    const handler = () => loadNotes()
    window.addEventListener('note-folder-changed', handler)
    return () => window.removeEventListener('note-folder-changed', handler)
  }, [loadNotes])

  useEffect(() => {
    supabase.from('folders').select('*').order('name').then(({ data }) => {
      if (data) setFolders(data)
    })
    supabase.from('note_tags').select('*').order('name').then(({ data }) => {
      if (data) setAllTags(data)
    })
    supabase.from('briefings').select('*').order('title').then(({ data }) => {
      if (data) setBriefings(data as Briefing[])
    })
  }, [supabase])

  async function createNote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('notes').insert({
      user_id: user.id,
      title: 'Untitled',
      folder_id: folderId || null,
    }).select('*, folder:folders(id, name)').single()
    if (error) { toast.error('Failed to create note'); return }
    if (data) {
      const newNote: Note = { ...(data as unknown as Note), tags: [] }
      setNotes(prev => [newNote, ...prev])
      setSelectedNote(newNote)
    }
  }

  const handleSave = useCallback(async (title: string, content: Record<string, unknown>) => {
    const note = selectedNoteRef.current
    if (!note) return
    const { data } = await supabase.from('notes').update({ title, content: content as unknown as import('@/types/database').Json, updated_at: new Date().toISOString() })
      .eq('id', note.id).select().single()
    if (data) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, title, content, updated_at: (data as { updated_at: string }).updated_at } : n))
      setSelectedNote(prev => prev ? { ...prev, title, content, updated_at: (data as { updated_at: string }).updated_at } : prev)
    }
  }, [supabase])

  async function togglePin() {
    if (!selectedNote) return
    const newVal = !selectedNote.is_pinned
    await supabase.from('notes').update({ is_pinned: newVal }).eq('id', selectedNote.id)
    const updated = { ...selectedNote, is_pinned: newVal }
    setSelectedNote(updated)
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? updated : n))
    toast.success(newVal ? 'Note pinned' : 'Note unpinned')
    setShowActionsMenu(false)
  }

  async function moveToFolder(fId: string | null) {
    if (!selectedNote) return
    const folder = fId ? folders.find(f => f.id === fId) : null
    await supabase.from('notes').update({ folder_id: fId }).eq('id', selectedNote.id)
    const updated = { ...selectedNote, folder_id: fId, folder: folder || undefined }
    setSelectedNote(updated)
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? updated : n))
    toast.success(folder ? `Moved to ${folder.name}` : 'Removed from folder')
    setShowMoveMenu(false)
  }

  async function addToBriefing(briefingId: string) {
    if (!selectedNote) return
    const briefing = briefings.find(b => b.id === briefingId)
    const { error } = await supabase.from('briefing_notes').insert({
      briefing_id: briefingId, note_id: selectedNote.id, sort_order: 0,
    })
    if (error?.code === '23505') toast.error('Note already in this briefing')
    else toast.success(`Added to "${briefing?.title}"`)
    setShowBriefingMenu(false)
    setShowActionsMenu(false)
  }

  async function trashNote() {
    if (!selectedNote) return
    await supabase.from('notes').update({ is_trashed: true }).eq('id', selectedNote.id)
    toast.success('Note moved to trash')
    const remaining = notes.filter(n => n.id !== selectedNote.id)
    setNotes(remaining)
    setSelectedNote(remaining[0] || null)
    setConfirmDelete(false)
  }

  const title = folderId
    ? (folders.find(f => f.id === folderId)?.name ?? 'Folder')
    : tagId
    ? (allTags.find(t => t.id === tagId)?.name ?? 'Tag')
    : 'All Notes'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Notes list panel */}
      <div className="hidden sm:flex w-64 flex-col border-r border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {notes.length > 0 && <p className="text-xs text-slate-500 mt-0.5">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>}
          </div>
          <button
            onClick={createNote}
            className="p-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 shadow-lg"
            title="New note (⌘N)"
          >
            <Plus size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="No notes yet"
            description="Create your first note to get started."
            action={
              <button onClick={createNote} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                New note
              </button>
            }
          />
        ) : (
          <NoteList notes={notes} selectedId={selectedNote?.id ?? null} onSelect={setSelectedNote} />
        )}
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
        {selectedNote ? (
          <>
            {/* Note toolbar */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-slate-800 relative z-10 bg-slate-900">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotesList(!showNotesList)}
                  className="sm:hidden p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg"
                  title="Show notes list"
                >
                  <FileText size={16} />
                </button>
                <NoteTagManager
                  noteId={selectedNote.id}
                  userId={''}
                  allTags={allTags}
                  noteTags={selectedNote.tags || []}
                  onTagsChange={(tags) => {
                    setSelectedNote(prev => prev ? { ...prev, tags } : prev)
                    setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, tags } : n))
                  }}
                  onTagsListChange={setAllTags}
                />
              </div>
              <div className="flex items-center gap-1 relative">
                {/* Flashcards */}
                <button
                  onClick={() => setShowFlashcards(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-violet-300 hover:text-violet-200 hover:bg-violet-600/20 rounded-lg border border-violet-600/40 transition-colors"
                  title="Flashcards for this note"
                >
                  <Layers size={13} />
                  <span>Flashcards</span>
                </button>

                {/* Move to folder */}
                <div className="relative">
                  <button
                    onClick={() => { setShowMoveMenu(!showMoveMenu); setShowActionsMenu(false) }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded-lg border border-slate-600/40 transition-colors"
                    title="Move to folder"
                  >
                    <FolderInput size={13} />
                    <span>Move</span>
                    <ChevronDown size={11} />
                  </button>
                  {showMoveMenu && (
                    <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 rounded-xl shadow-lg border border-slate-700 py-1 w-48">
                      <button
                        onClick={() => moveToFolder(null)}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50"
                      >
                        No folder
                      </button>
                      {folders.map(f => (
                        <button
                          key={f.id}
                          onClick={() => moveToFolder(f.id)}
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50"
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions menu */}
                <div className="relative">
                  <button
                    onClick={() => { setShowActionsMenu(!showActionsMenu); setShowMoveMenu(false) }}
                    className="p-1.5 text-slate-500 hover:bg-slate-800 rounded-lg"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {showActionsMenu && (
                    <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 rounded-xl shadow-lg border border-slate-700 py-1 w-52">
                      <button
                        onClick={togglePin}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50 flex items-center gap-2"
                      >
                        {selectedNote.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        {selectedNote.is_pinned ? 'Unpin' : 'Pin note'}
                      </button>

                      {/* Add to briefing submenu */}
                      {briefings.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowBriefingMenu(b => !b)}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/50 flex items-center gap-2"
                          >
                            <BookMarked size={14} />
                            Add to briefing
                            <ChevronDown size={11} className={cn('ml-auto transition-transform', showBriefingMenu && 'rotate-180')} />
                          </button>
                          {showBriefingMenu && (
                            <div className="border-t border-slate-800 bg-slate-900/60 py-1">
                              {briefings.map(b => (
                                <button
                                  key={b.id}
                                  onClick={() => addToBriefing(b.id)}
                                  className="w-full text-left px-5 py-1.5 text-sm text-slate-300 hover:bg-slate-800 truncate"
                                >
                                  {b.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-t border-slate-800 mt-1 pt-1">
                        <button
                          onClick={() => { setConfirmDelete(true); setShowActionsMenu(false) }}
                          className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-600/20 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 size={14} />
                          Move to trash
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <NoteEditor key={selectedNote.id} note={selectedNote} onSave={handleSave} />
          </>
        ) : (
          <EmptyState
            icon={<FileText size={48} />}
            title="Select a note or create a new one"
            description="Your notes will appear here."
          />
        )}
      </div>

      {selectedNote && (
        <FlashcardModal
          note={selectedNote}
          userId={userId}
          open={showFlashcards}
          onClose={() => setShowFlashcards(false)}
        />
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Move to trash?"
        description="You can restore this note from the trash later."
        confirmLabel="Move to trash"
        danger
        onConfirm={trashNote}
        onCancel={() => setConfirmDelete(false)}
      />

      
      {/* Notes list modal on mobile */}
      {showNotesList && (
        <>
          <div
            className="sm:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setShowNotesList(false)}
          />
          <div className="sm:hidden fixed inset-y-0 left-0 w-64 z-40 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
              <button
                onClick={() => setShowNotesList(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-500"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">No notes</div>
              ) : (
                <NoteList notes={notes} selectedId={selectedNote?.id ?? null} onSelect={(note) => { setSelectedNote(note); setShowNotesList(false) }} />
              )}
            </div>
          </div>
        </>
      )}

      {/* Close dropdowns on click outside */}
      {(showMoveMenu || showActionsMenu) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setShowMoveMenu(false); setShowActionsMenu(false); setShowBriefingMenu(false) }}
        />
      )}
    </div>
  )
}
