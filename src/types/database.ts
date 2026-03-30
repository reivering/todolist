export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string }
        Insert: { id: string; display_name?: string | null; created_at?: string }
        Update: { display_name?: string | null }
        Relationships: []
      }
      folders: {
        Row: { id: string; user_id: string; name: string; parent_id: string | null; sort_order: number; created_at: string }
        Insert: { id?: string; user_id: string; name: string; parent_id?: string | null; sort_order?: number; created_at?: string }
        Update: { name?: string; parent_id?: string | null; sort_order?: number }
        Relationships: []
      }
      note_tags: {
        Row: { id: string; user_id: string; name: string; color: string; created_at: string }
        Insert: { id?: string; user_id: string; name: string; color?: string; created_at?: string }
        Update: { name?: string; color?: string }
        Relationships: []
      }
      notes: {
        Row: { id: string; user_id: string; folder_id: string | null; title: string; content: Json; is_pinned: boolean; is_trashed: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; folder_id?: string | null; title?: string; content?: Json; is_pinned?: boolean; is_trashed?: boolean; created_at?: string; updated_at?: string }
        Update: { folder_id?: string | null; title?: string; content?: Json; is_pinned?: boolean; is_trashed?: boolean; updated_at?: string }
        Relationships: []
      }
      note_tag_relations: {
        Row: { note_id: string; tag_id: string }
        Insert: { note_id: string; tag_id: string }
        Update: Record<string, never>
        Relationships: []
      }
      projects: {
        Row: { id: string; user_id: string; name: string; sort_order: number; created_at: string }
        Insert: { id?: string; user_id: string; name: string; sort_order?: number; created_at?: string }
        Update: { name?: string; sort_order?: number }
        Relationships: []
      }
      todos: {
        Row: { id: string; user_id: string; project_id: string | null; title: string; description: string | null; due_date: string | null; priority: 'low' | 'medium' | 'high'; is_completed: boolean; is_trashed: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; project_id?: string | null; title: string; description?: string | null; due_date?: string | null; priority?: 'low' | 'medium' | 'high'; is_completed?: boolean; is_trashed?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { project_id?: string | null; title?: string; description?: string | null; due_date?: string | null; priority?: 'low' | 'medium' | 'high'; is_completed?: boolean; is_trashed?: boolean; sort_order?: number; updated_at?: string }
        Relationships: []
      }
      subtasks: {
        Row: { id: string; todo_id: string; title: string; is_completed: boolean; sort_order: number; created_at: string }
        Insert: { id?: string; todo_id: string; title: string; is_completed?: boolean; sort_order?: number; created_at?: string }
        Update: { title?: string; is_completed?: boolean; sort_order?: number }
        Relationships: []
      }
      flashcards: {
        Row: { id: string; user_id: string; note_id: string; front: string; back: string; sort_order: number; created_at: string }
        Insert: { id?: string; user_id: string; note_id: string; front: string; back: string; sort_order?: number; created_at?: string }
        Update: { front?: string; back?: string; sort_order?: number }
        Relationships: []
      }
      briefings: {
        Row: { id: string; user_id: string; title: string; description: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; title: string; description?: string | null; created_at?: string; updated_at?: string }
        Update: { title?: string; description?: string | null; updated_at?: string }
        Relationships: []
      }
      briefing_notes: {
        Row: { id: string; briefing_id: string; note_id: string; sort_order: number; created_at: string }
        Insert: { id?: string; briefing_id: string; note_id: string; sort_order?: number; created_at?: string }
        Update: { sort_order?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
