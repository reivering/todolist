-- Run this in the Supabase SQL Editor to add flashcard support

create table if not exists flashcards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  note_id uuid references notes(id) on delete cascade not null,
  front text not null,
  back text not null,
  sort_order int default 0,
  created_at timestamptz default now() not null
);

alter table flashcards enable row level security;

create policy "Users can manage own flashcards"
  on flashcards for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_flashcards_note_id on flashcards(note_id);
create index idx_flashcards_user_id on flashcards(user_id);
