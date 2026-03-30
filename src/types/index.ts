export type Priority = 'low' | 'medium' | 'high'

export interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
  children?: Folder[]
}

export interface NoteTag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  content: Record<string, unknown> | null
  is_pinned: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
  tags?: NoteTag[]
  folder?: Folder
}

export interface Project {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Todo {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  is_completed: boolean
  is_trashed: boolean
  sort_order: number
  created_at: string
  updated_at: string
  subtasks?: Subtask[]
  project?: Project
}

export interface Subtask {
  id: string
  todo_id: string
  title: string
  is_completed: boolean
  sort_order: number
  created_at: string
}

export interface Flashcard {
  id: string
  user_id: string
  note_id: string
  front: string
  back: string
  sort_order: number
  created_at: string
}

export interface Briefing {
  id: string
  user_id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
  notes?: Note[]
}

export interface BriefingNote {
  id: string
  briefing_id: string
  note_id: string
  sort_order: number
  created_at: string
}

export type TodoFilter = 'all' | 'active' | 'completed' | 'overdue' | 'today' | 'upcoming'
export type TodoSort = 'manual' | 'due_date' | 'priority' | 'created_at'
export type NoteView = 'list' | 'grid'
