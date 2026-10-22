-- Printable quotes: a quote number, the quote's wording, and your business details (set once, used on every quote).
-- Run once in Supabase → SQL Editor (after 0001–0005).
alter table public.quotes
  add column if not exists number text not null default '',
  add column if not exists doc    jsonb not null default '{}'::jsonb;
create unique index if not exists quotes_number_key on public.quotes (number) where number <> '';

-- Small key/value store for things like your business details. Stays in the database, never in the code.
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);
alter table public.settings enable row level security;
create policy "team all" on public.settings for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.settings from anon;
