'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Subtask, TodoFilter, TodoSort, Priority } from '@/types'
import { TodoItem } from '@/components/todos/TodoItem'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Plus, CheckSquare, Filter, SortAsc, Calendar, Flag,
  ChevronDown, X, Mic,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, PRIORITY_COLORS, isOverdue } from '@/lib/utils'
import { isToday, isFuture } from 'date-fns'
import { VoiceDictationModal } from '@/components/todos/VoiceDictationModal'

export default function TodosPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')

  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [sort, setSort] = useState<TodoSort>('manual')
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<Priority>('medium')
  const [newTodoDueDate, setNewTodoDueDate] = useState('')
  const [showNewTodoForm, setShowNewTodoForm] = useState(false)
  const [showVoice, setShowVoice] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadTodos = useCallback(async () => {
    let query = supabase
      .from('todos')
      .select('*, subtasks(*)')
      .eq('is_trashed', false)
      .order('sort_order')
      .order('created_at', { ascending: false })

    if (projectId) query = query.eq('project_id', projectId)
    else query = query.is('project_id', null)

    const { data } = await query
    if (data) setTodos(data as Todo[])
    setLoading(false)
  }, [supabase, projectId])

  useEffect(() => {
    setLoading(true)
    loadTodos()
  }, [loadTodos])

  async function createTodo() {
    if (!newTodoTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
    const { data, error } = await supabase.from('todos').insert({
      user_id: user.id,
      project_id: projectId || null,
      title: newTodoTitle.trim(),
      priority: newTodoPriority,
      due_date: newTodoDueDate || null,
      sort_order: maxOrder,
    }).select('*, subtasks(*)').single()

    if (error) { toast.error('Failed to create todo'); return }
    if (data) {
      setTodos(prev => [...prev, data as Todo])
      setNewTodoTitle('')
      setNewTodoDueDate('')
      setNewTodoPriority('medium')
      setShowNewTodoForm(false)
    }
  }

  async function saveVoiceTasks(tasks: { title: string; priority: Priority }[]) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order), -1)
    const inserts = tasks.map(t => ({
      user_id: user.id,
      project_id: projectId || null,
      title: t.title,
      priority: t.priority,
      sort_order: ++maxOrder,
    }))
    const { data, error } = await supabase.from('todos').insert(inserts).select('*, subtasks(*)')
    if (error) { toast.error('Failed to save tasks'); return }
    if (data) {
      setTodos(prev => [...prev, ...(data as Todo[])])
      toast.success(`${data.length} task${data.length !== 1 ? 's' : ''} created`)
    }
  }

  function handleUpdate(id: string, updates: Partial<Todo>) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  function handleDelete(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function handleSubtaskChange(todoId: string, subtasks: Subtask[]) {
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, subtasks } : t))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = todos.findIndex(t => t.id === active.id)
    const newIndex = todos.findIndex(t => t.id === over.id)
    const reordered = arrayMove(todos, oldIndex, newIndex)
    setTodos(reordered)

    // Persist sort_order
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }))
    for (const u of updates) {
      await supabase.from('todos').update({ sort_order: u.sort_order }).eq('id', u.id)
    }
  }

  const filteredTodos = todos.filter(todo => {
    if (todo.is_trashed) return false
    switch (filter) {
      case 'active': return !todo.is_completed
      case 'completed': return todo.is_completed
      case 'overdue': return isOverdue(todo.due_date) && !todo.is_completed
      case 'today': return todo.due_date ? isToday(new Date(todo.due_date)) : false
      case 'upcoming': return todo.due_date ? isFuture(new Date(todo.due_date)) && !isToday(new Date(todo.due_date)) : false
      default: return true
    }
  })

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (sort === 'manual') return a.sort_order - b.sort_order
    if (sort === 'due_date') {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (sort === 'priority') {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    }
    if (sort === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return 0
  })

  const activeTodos = sortedTodos.filter(t => !t.is_completed)
  const completedTodos = sortedTodos.filter(t => t.is_completed)

  const FILTERS: { value: TodoFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
  ]

  const SORTS: { value: TodoSort; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'due_date', label: 'Due date' },
    { value: 'priority', label: 'Priority' },
    { value: 'created_at', label: 'Date created' },
  ]

  const totalActive = todos.filter(t => !t.is_completed && !t.is_trashed).length
  const totalCompleted = todos.filter(t => t.is_completed && !t.is_trashed).length
  const totalOverdue = todos.filter(t => isOverdue(t.due_date) && !t.is_completed && !t.is_trashed).length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {projectId ? 'Project' : 'All Todos'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400">{totalActive} active</span>
            {totalCompleted > 0 && <span className="text-xs text-gray-400">{totalCompleted} done</span>}
            {totalOverdue > 0 && <span className="text-xs text-red-500 font-medium">{totalOverdue} overdue</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowFilter(!showFilter); setShowSort(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border',
                filter !== 'all' ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <Filter size={13} />
              {FILTERS.find(f => f.value === filter)?.label}
              <ChevronDown size={12} />
            </button>
            {showFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-40">
                  {FILTERS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => { setFilter(f.value); setShowFilter(false) }}
                      className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50', filter === f.value && 'text-blue-600 font-medium')}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowSort(!showSort); setShowFilter(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border',
                sort !== 'manual' ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <SortAsc size={13} />
              {SORTS.find(s => s.value === sort)?.label}
              <ChevronDown size={12} />
            </button>
            {showSort && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-36">
                  {SORTS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => { setSort(s.value); setShowSort(false) }}
                      className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50', sort === s.value && 'text-blue-600 font-medium')}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowVoice(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            title="Voice dictation"
          >
            <Mic size={14} />
          </button>
          <button
            onClick={() => setShowNewTodoForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} />
            New todo
          </button>
        </div>
      </div>

      {/* New todo form */}
      {showNewTodoForm && (
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <input
              autoFocus
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createTodo(); if (e.key === 'Escape') setShowNewTodoForm(false) }}
              placeholder="Todo title…"
              className="w-full text-sm font-medium outline-none text-gray-900 placeholder:text-gray-400 mb-2"
            />
            <div className="flex items-center gap-3">
              {/* Priority selector */}
              <div className="flex items-center gap-1">
                <Flag size={12} className="text-gray-400" />
                {(['high', 'medium', 'low'] as Priority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setNewTodoPriority(p)}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium border',
                      newTodoPriority === p
                        ? cn(PRIORITY_COLORS[p].bg, PRIORITY_COLORS[p].text, PRIORITY_COLORS[p].border)
                        : 'text-gray-400 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {/* Due date */}
              <div className="flex items-center gap-1">
                <Calendar size={12} className="text-gray-400" />
                <input
                  type="date"
                  value={newTodoDueDate}
                  onChange={(e) => setNewTodoDueDate(e.target.value)}
                  className="text-xs text-gray-600 outline-none border border-gray-200 rounded px-1.5 py-0.5"
                />
              </div>
              <div className="flex-1" />
              <button onClick={() => setShowNewTodoForm(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                <X size={14} />
              </button>
              <button
                onClick={createTodo}
                disabled={!newTodoTitle.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedTodos.length === 0 ? (
          <EmptyState
            icon={<CheckSquare size={40} />}
            title="No todos"
            description={filter === 'all' ? 'Create your first todo to get started.' : `No todos match the current filter.`}
            action={filter === 'all' ? (
              <button
                onClick={() => setShowNewTodoForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                New todo
              </button>
            ) : (
              <button
                onClick={() => setFilter('all')}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Clear filter
              </button>
            )}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {/* Active todos */}
              {activeTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onSubtaskChange={handleSubtaskChange}
                />
              ))}

              {/* Completed todos (collapsed) */}
              {completedTodos.length > 0 && (
                <details className="mt-4" open={filter === 'completed'}>
                  <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 hover:text-gray-600 list-none">
                    <ChevronDown size={12} />
                    Completed ({completedTodos.length})
                  </summary>
                  <div className="mt-2">
                    {completedTodos.map(todo => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onSubtaskChange={handleSubtaskChange}
                      />
                    ))}
                  </div>
                </details>
              )}
            </SortableContext>
          </DndContext>
        )}
      </div>
      <VoiceDictationModal
        open={showVoice}
        onClose={() => setShowVoice(false)}
        onSave={saveVoiceTasks}
      />
    </div>
  )
}
