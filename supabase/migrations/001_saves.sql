-- Millionaire City: one cloud save per authenticated user
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "saves_select_own" on public.saves
  for select using (auth.uid() = user_id);

create policy "saves_insert_own" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "saves_update_own" on public.saves
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saves_delete_own" on public.saves
  for delete using (auth.uid() = user_id);
