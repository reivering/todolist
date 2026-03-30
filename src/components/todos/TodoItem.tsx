'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Todo, Subtask, Priority } from '@/types'
import { cn, PRIORITY_COLORS, formatDate, isOverdue } from '@/lib/utils'
import { GripVertical, ChevronDown, ChevronRight, Trash2, Calendar, Plus, Check, MoreHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface TodoItemProps {
  todo: Todo
  onUpdate: (id: string, updates: Partial<Todo>) => void
  onDelete: (id: string) => void
  onSubtaskChange: (todoId: string, subtasks: Subtask[]) => void
}

const PRIORITY_BORDER = {
  high: 'border-l-red-400',
  medium: 'border-l-amber-400',
  low: 'border-l-emerald-400',
}

const PRIORITY_LABEL = {
  high: { label: 'High', cls: 'bg-red-50 text-red-600 border border-red-100' },
  medium: { label: 'Med', cls: 'bg-amber-50 text-amber-600 border border-amber-100' },
  low: { label: 'Low', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
}

export function TodoItem({ todo, onUpdate, onDelete, onSubtaskChange }: TodoItemProps) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [newSubtask, setNewSubtask] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  function openMenu() {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setShowMenu(s => !s)
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const overdue = isOverdue(todo.due_date)
  const subtasks = todo.subtasks || []
  const completedSubtasks = subtasks.filter(s => s.is_completed).length
  const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0

  async function toggleComplete() {
    const newVal = !todo.is_completed
    await supabase.from('todos').update({ is_completed: newVal }).eq('id', todo.id)
    onUpdate(todo.id, { is_completed: newVal })
  }

  async function saveTitle() {
    if (!title.trim()) { setTitle(todo.title); setEditingTitle(false); return }
    await supabase.from('todos').update({ title: title.trim() }).eq('id', todo.id)
    onUpdate(todo.id, { title: title.trim() })
    setEditingTitle(false)
  }

  async function updatePriority(priority: Priority) {
    await supabase.from('todos').update({ priority }).eq('id', todo.id)
    onUpdate(todo.id, { priority })
    setShowMenu(false)
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return
    const { data } = await supabase.from('subtasks').insert({
      todo_id: todo.id, title: newSubtask.trim(), sort_order: subtasks.length,
    }).select().single()
    if (data) { onSubtaskChange(todo.id, [...subtasks, data]); setNewSubtask('') }
  }

  async function toggleSubtask(subtask: Subtask) {
    const newVal = !subtask.is_completed
    await supabase.from('subtasks').update({ is_completed: newVal }).eq('id', subtask.id)
    onSubtaskChange(todo.id, subtasks.map(s => s.id === subtask.id ? { ...s, is_completed: newVal } : s))
  }

  async function deleteSubtask(id: string) {
    await supabase.from('subtasks').delete().eq('id', id)
    onSubtaskChange(todo.id, subtasks.filter(s => s.id !== id))
  }

  async function trashTodo() {
    await supabase.from('todos').update({ is_trashed: true }).eq('id', todo.id)
    toast.success('Moved to trash')
    onDelete(todo.id)
    setShowMenu(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-white border border-gray-200 rounded-xl mb-2 overflow-hidden border-l-[3px] transition-shadow',
        PRIORITY_BORDER[todo.priority],
        isDragging ? 'shadow-xl ring-2 ring-blue-200' : 'hover:shadow-sm',
        todo.is_completed && 'opacity-55'
      )}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        {/* Drag */}
        <button {...attributes} {...listeners}
          className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 flex-shrink-0 touch-none">
          <GripVertical size={14} />
        </button>

        {/* Check */}
        <button
          onClick={toggleComplete}
          className={cn(
            'mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0',
            todo.is_completed ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'
          )}
        >
          {todo.is_completed && <Check size={9} className="text-white" strokeWidth={3} />}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {editingTitle ? (
              <input autoFocus value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(todo.title); setEditingTitle(false) } }}
                className="flex-1 text-sm font-medium text-gray-900 outline-none bg-transparent border-b-2 border-blue-400"
              />
            ) : (
              <span
                className={cn('flex-1 text-sm font-medium cursor-text', todo.is_completed ? 'line-through text-gray-400' : 'text-gray-800')}
                onClick={() => setEditingTitle(true)}
              >
                {todo.title}
              </span>
            )}
            {/* Priority badge */}
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0', PRIORITY_LABEL[todo.priority].cls)}>
              {PRIORITY_LABEL[todo.priority].label}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {todo.due_date && (
              <span className={cn(
                'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md',
                overdue ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-400'
              )}>
                <Calendar size={10} />
                {formatDate(todo.due_date)}{overdue && ' · Overdue'}
              </span>
            )}
            {subtasks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-gray-400">{completedSubtasks}/{subtasks.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <div className="relative">
            <button ref={menuBtnRef} onClick={openMenu} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
              <MoreHorizontal size={13} />
            </button>
            {showMenu && typeof document !== 'undefined' && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  className="fixed z-50 bg-white rounded-2xl border border-gray-200/80 p-2 w-48"
                  style={{
                    top: menuPos.top,
                    right: menuPos.right,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  <p className="px-2 pt-1 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Priority</p>
                  {([
                    { p: 'high',   label: 'High',   bg: 'hover:bg-red-50',    active: 'bg-red-50 ring-1 ring-red-200',    dot: 'bg-red-500',    text: 'text-red-700'    },
                    { p: 'medium', label: 'Medium', bg: 'hover:bg-amber-50',  active: 'bg-amber-50 ring-1 ring-amber-200',dot: 'bg-amber-400',  text: 'text-amber-700'  },
                    { p: 'low',    label: 'Low',    bg: 'hover:bg-green-50',  active: 'bg-green-50 ring-1 ring-green-200',dot: 'bg-emerald-500',text: 'text-emerald-700'},
                  ] as const).map(({ p, label, bg, active, dot, text }) => (
                    <button key={p} onClick={() => updatePriority(p as Priority)}
                      className={cn('w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors', todo.priority === p ? active : bg)}
                    >
                      <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dot)} />
                      <span className={cn('font-medium', todo.priority === p ? text : 'text-gray-700')}>{label}</span>
                      {todo.priority === p && <Check size={13} className={cn('ml-auto', text)} strokeWidth={2.5} />}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-2 pt-2">
                    <button onClick={trashTodo} className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                      <Trash2 size={13} /> Move to trash
                    </button>
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-10 pb-3 pt-0 border-t border-gray-50 bg-gray-50/40 space-y-3">
          <DescriptionField todoId={todo.id} description={todo.description} onUpdate={onUpdate} />

          {/* Subtasks */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Subtasks</p>
            <div className="space-y-1">
              {subtasks.map(subtask => (
                <div key={subtask.id} className="group/sub flex items-center gap-2 py-0.5">
                  <button onClick={() => toggleSubtask(subtask)}
                    className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                      subtask.is_completed ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400')}
                  >
                    {subtask.is_completed && <Check size={9} className="text-white" strokeWidth={3} />}
                  </button>
                  <span className={cn('flex-1 text-sm', subtask.is_completed && 'line-through text-gray-400')}>
                    {subtask.title}
                  </span>
                  <button onClick={() => deleteSubtask(subtask.id)}
                    className="opacity-0 group-hover/sub:opacity-100 p-0.5 hover:text-red-400 text-gray-300">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
              <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add subtask…"
                className="flex-1 text-sm outline-none bg-transparent text-gray-600 placeholder:text-gray-300"
              />
              <button onClick={addSubtask} className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0">
                <Plus size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DescriptionField({ todoId, description, onUpdate }: {
  todoId: string; description: string | null; onUpdate: (id: string, updates: Partial<Todo>) => void
}) {
  const supabase = createClient()
  const [value, setValue] = useState(description || '')
  const [editing, setEditing] = useState(false)

  async function save() {
    await supabase.from('todos').update({ description: value }).eq('id', todoId)
    onUpdate(todoId, { description: value })
    setEditing(false)
  }

  return editing ? (
    <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={save}
      rows={2} placeholder="Add a description…"
      className="w-full text-sm text-gray-600 outline-none bg-white rounded-lg p-2 resize-none border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    />
  ) : (
    <button onClick={() => setEditing(true)} className="w-full text-left text-sm text-gray-500 hover:text-gray-700 py-1 mt-1 min-h-[20px]">
      {value || <span className="text-gray-300 italic text-xs">Add description…</span>}
    </button>
  )
}
