-- Briefings: named collections of notes, used to study flashcards as a set

create table if not exists briefings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists briefing_notes (
  id uuid default uuid_generate_v4() primary key,
  briefing_id uuid references briefings(id) on delete cascade not null,
  note_id uuid references notes(id) on delete cascade not null,
  sort_order int default 0 not null,
  created_at timestamptz default now() not null,
  unique(briefing_id, note_id)
);

alter table briefings enable row level security;
alter table briefing_notes enable row level security;

create policy "Users can manage own briefings"
  on briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own briefing notes"
  on briefing_notes for all
  using (
    exists (
      select 1 from briefings where id = briefing_id and user_id = auth.uid()
    )
  );

-- updated_at trigger (create function if not already defined)
create or replace function update_updated_at_column()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_briefings_updated_at
  before update on briefings
  for each row execute function update_updated_at_column();
