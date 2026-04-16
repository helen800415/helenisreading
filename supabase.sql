create extension if not exists pgcrypto;

create table if not exists public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('book', 'movie', 'series')),
  title text not null,
  creator text not null default '',
  cover_url text not null default '',
  date date not null,
  rating integer not null check (rating between 1 and 5),
  tags jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_timeline_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_timeline_entries_updated_at on public.timeline_entries;

create trigger set_timeline_entries_updated_at
before update on public.timeline_entries
for each row
execute procedure public.set_timeline_entries_updated_at();

alter table public.timeline_entries enable row level security;

drop policy if exists "timeline entries are publicly readable" on public.timeline_entries;
create policy "timeline entries are publicly readable"
on public.timeline_entries
for select
to anon, authenticated
using (true);

drop policy if exists "timeline entries are writable by authenticated users" on public.timeline_entries;
create policy "timeline entries are writable by authenticated users"
on public.timeline_entries
for all
to authenticated
using (true)
with check (true);
