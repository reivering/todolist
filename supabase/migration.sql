-- ============================================================
-- Notes & Todo App — Supabase Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- FOLDERS (for notes)
-- ============================================================
create table if not exists folders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  sort_order int default 0,
  created_at timestamptz default now() not null
);

alter table folders enable row level security;

create policy "Users can manage own folders"
  on folders for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_folders_user_id on folders(user_id);
create index idx_folders_parent_id on folders(parent_id);

-- ============================================================
-- NOTE TAGS
-- ============================================================
create table if not exists note_tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

alter table note_tags enable row level security;

create policy "Users can manage own note_tags"
  on note_tags for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_note_tags_user_id on note_tags(user_id);

-- ============================================================
-- NOTES
-- ============================================================
create table if not exists notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  folder_id uuid references folders(id) on delete set null,
  title text not null default 'Untitled',
  content jsonb default '{}'::jsonb,
  is_pinned boolean default false,
  is_trashed boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table notes enable row level security;

create policy "Users can manage own notes"
  on notes for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_notes_user_id on notes(user_id);
create index idx_notes_folder_id on notes(folder_id);
create index idx_notes_is_pinned on notes(user_id, is_pinned);
create index idx_notes_is_trashed on notes(user_id, is_trashed);

-- Full-text search index for notes
create index idx_notes_fts on notes
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content::text, '')));

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

-- ============================================================
-- NOTE TAG RELATIONS
-- ============================================================
create table if not exists note_tag_relations (
  note_id uuid references notes(id) on delete cascade not null,
  tag_id uuid references note_tags(id) on delete cascade not null,
  primary key (note_id, tag_id)
);

alter table note_tag_relations enable row level security;

create policy "Users can manage own note_tag_relations"
  on note_tag_relations for all
  using (
    exists (select 1 from notes where notes.id = note_tag_relations.note_id and notes.user_id = auth.uid())
  )
  with check (
    exists (select 1 from notes where notes.id = note_tag_relations.note_id and notes.user_id = auth.uid())
  );

create index idx_note_tag_relations_note_id on note_tag_relations(note_id);
create index idx_note_tag_relations_tag_id on note_tag_relations(tag_id);

-- ============================================================
-- PROJECTS (for todos)
-- ============================================================
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now() not null
);

alter table projects enable row level security;

create policy "Users can manage own projects"
  on projects for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_projects_user_id on projects(user_id);

-- ============================================================
-- TODOS
-- ============================================================
create type priority_level as enum ('low', 'medium', 'high');

create table if not exists todos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority priority_level default 'medium',
  is_completed boolean default false,
  is_trashed boolean default false,
  sort_order int default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table todos enable row level security;

create policy "Users can manage own todos"
  on todos for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_todos_user_id on todos(user_id);
create index idx_todos_project_id on todos(project_id);
create index idx_todos_is_completed on todos(user_id, is_completed);
create index idx_todos_is_trashed on todos(user_id, is_trashed);
create index idx_todos_due_date on todos(user_id, due_date);

-- Full-text search for todos
create index idx_todos_fts on todos
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

create trigger todos_updated_at
  before update on todos
  for each row execute function update_updated_at();

-- ============================================================
-- SUBTASKS
-- ============================================================
create table if not exists subtasks (
  id uuid default uuid_generate_v4() primary key,
  todo_id uuid references todos(id) on delete cascade not null,
  title text not null,
  is_completed boolean default false,
  sort_order int default 0,
  created_at timestamptz default now() not null
);

alter table subtasks enable row level security;

create policy "Users can manage own subtasks"
  on subtasks for all
  using (
    exists (select 1 from todos where todos.id = subtasks.todo_id and todos.user_id = auth.uid())
  )
  with check (
    exists (select 1 from todos where todos.id = subtasks.todo_id and todos.user_id = auth.uid())
  );

create index idx_subtasks_todo_id on subtasks(todo_id);
