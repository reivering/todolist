'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note, Todo } from '@/types'
import { Search, FileText, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { cn, formatRelativeDate, getContentPreview, PRIORITY_COLORS } from '@/lib/utils'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  const [search, setSearch] = useState(query)
  const [notes, setNotes] = useState<Note[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSearch(query)
    if (!query.trim()) return
    setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('notes')
        .select('*, folder:folders(id, name), tags:note_tags!note_tag_relations(id, name, color, user_id, created_at)')
        .eq('is_trashed', false)
        .or(`title.ilike.%${query}%,content.cs.{"type":"doc"}`)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase.from('todos')
        .select('*')
        .eq('is_trashed', false)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(20),
    ]).then(([notesRes, todosRes]) => {
      const filteredNotes = (notesRes.data || []).filter((n: Note) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        getContentPreview(n.content).toLowerCase().includes(query.toLowerCase())
      )
      setNotes(filteredNotes as Note[])
      setTodos((todosRes.data || []) as Todo[])
      setLoading(false)
    })
  }, [query])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`)
  }

  const total = notes.length + todos.length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900">
      <div className="px-8 py-5 border-b border-slate-800">
        <form onSubmit={handleSearch} className="flex items-center gap-3 max-w-xl">
          <div className="flex-1 flex items-center gap-2.5 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <Search size={16} className="text-slate-500" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes and todos…"
              className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {!query && (
          <p className="text-sm text-slate-500 text-center mt-16">Type to search your notes and todos</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && query && total === 0 && (
          <div className="text-center mt-16">
            <Search size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-xs text-slate-500 mt-1">Try different keywords</p>
          </div>
        )}

        {!loading && notes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={12} />
              Notes ({notes.length})
            </h3>
            <div className="space-y-1">
              {notes.map(note => (
                <Link
                  key={note.id}
                  href={`/notes?open=${note.id}${note.folder_id ? `&folder=${note.folder_id}` : ''}`}
                  className="flex items-start gap-3 p-3 hover:bg-slate-900/50 rounded-xl group"
                >
                  <FileText size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{note.title || 'Untitled'}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">{formatRelativeDate(note.updated_at)}</span>
                    </div>
                    {getContentPreview(note.content) && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{getContentPreview(note.content)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && todos.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CheckSquare size={12} />
              Todos ({todos.length})
            </h3>
            <div className="space-y-1">
              {todos.map(todo => (
                <Link
                  key={todo.id}
                  href={`/todos${todo.project_id ? `?project=${todo.project_id}` : ''}`}
                  className="flex items-start gap-3 p-3 hover:bg-slate-900/50 rounded-xl"
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center',
                    todo.is_completed ? 'bg-violet-600 border-blue-600' : 'border-gray-300'
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium', todo.is_completed && 'line-through text-slate-500')}>
                        {todo.title}
                      </span>
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_COLORS[todo.priority].dot)} />
                    </div>
                    {todo.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{todo.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
