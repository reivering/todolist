'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Note, Todo } from '@/types'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Trash2, RotateCcw, FileText, CheckSquare, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatRelativeDate, PRIORITY_COLORS } from '@/lib/utils'

type Tab = 'notes' | 'todos'

export default function TrashPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null)
  const [confirmDeleteTodo, setConfirmDeleteTodo] = useState<string | null>(null)

  const loadTrash = useCallback(async () => {
    const [notesRes, todosRes] = await Promise.all([
      supabase.from('notes').select('*').eq('is_trashed', true).order('updated_at', { ascending: false }),
      supabase.from('todos').select('*').eq('is_trashed', true).order('updated_at', { ascending: false }),
    ])
    if (notesRes.data) setNotes(notesRes.data as unknown as Note[])
    if (todosRes.data) setTodos(todosRes.data as unknown as Todo[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadTrash() }, [loadTrash])

  async function restoreNote(id: string) {
    await supabase.from('notes').update({ is_trashed: false }).eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    toast.success('Note restored')
  }

  async function restoreTodo(id: string) {
    await supabase.from('todos').update({ is_trashed: false }).eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
    toast.success('Todo restored')
  }

  async function permanentDeleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    toast.success('Note permanently deleted')
    setConfirmDeleteNote(null)
  }

  async function permanentDeleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
    toast.success('Todo permanently deleted')
    setConfirmDeleteTodo(null)
  }

  async function emptyTrash() {
    await Promise.all([
      supabase.from('notes').delete().eq('is_trashed', true),
      supabase.from('todos').delete().eq('is_trashed', true),
    ])
    setNotes([])
    setTodos([])
    toast.success('Trash emptied')
    setConfirmEmpty(false)
  }

  const total = notes.length + todos.length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Trash2 size={18} className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">Trash</h1>
          {total > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{total}</span>
          )}
        </div>
        {total > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
          >
            <AlertTriangle size={13} />
            Empty trash
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-gray-100">
        <button
          onClick={() => setTab('notes')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px',
            tab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <FileText size={14} />
          Notes {notes.length > 0 && `(${notes.length})`}
        </button>
        <button
          onClick={() => setTab('todos')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px',
            tab === 'todos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <CheckSquare size={14} />
          Todos {todos.length > 0 && `(${todos.length})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'notes' ? (
          notes.length === 0 ? (
            <EmptyState icon={<FileText size={36} />} title="No notes in trash" description="Deleted notes will appear here." />
          ) : (
            <div className="space-y-2">
              {notes.map(note => (
                <div key={note.id} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 group">
                  <FileText size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{note.title || 'Untitled'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Deleted {formatRelativeDate(note.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => restoreNote(note.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:bg-white rounded-lg border border-gray-200"
                      title="Restore"
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmDeleteNote(note.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                      title="Delete forever"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          todos.length === 0 ? (
            <EmptyState icon={<CheckSquare size={36} />} title="No todos in trash" description="Deleted todos will appear here." />
          ) : (
            <div className="space-y-2">
              {todos.map(todo => (
                <div key={todo.id} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 group">
                  <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0', PRIORITY_COLORS[todo.priority].border)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{todo.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Deleted {formatRelativeDate(todo.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => restoreTodo(todo.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:bg-white rounded-lg border border-gray-200"
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTodo(todo.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <ConfirmModal
        open={!!confirmDeleteNote}
        title="Permanently delete note?"
        description="This action cannot be undone."
        confirmLabel="Delete forever"
        danger
        onConfirm={() => confirmDeleteNote && permanentDeleteNote(confirmDeleteNote)}
        onCancel={() => setConfirmDeleteNote(null)}
      />
      <ConfirmModal
        open={!!confirmDeleteTodo}
        title="Permanently delete todo?"
        description="This action cannot be undone."
        confirmLabel="Delete forever"
        danger
        onConfirm={() => confirmDeleteTodo && permanentDeleteTodo(confirmDeleteTodo)}
        onCancel={() => setConfirmDeleteTodo(null)}
      />
      <ConfirmModal
        open={confirmEmpty}
        title="Empty trash?"
        description="All items in trash will be permanently deleted. This cannot be undone."
        confirmLabel="Empty trash"
        danger
        onConfirm={emptyTrash}
        onCancel={() => setConfirmEmpty(false)}
      />
    </div>
  )
}
