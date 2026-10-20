-- Structured columns for the cold-call list, so a big lead sheet can be filtered and sorted.
-- Run once in Supabase → SQL Editor (after 0001-0003).
alter table public.call_leads
  add column assigned_to text not null default '',
  add column niche       text not null default '',
  add column tier        text not null default '' check (tier in ('', 'A', 'B', 'C')),
  add column city        text not null default '',
  add column lead_code   text not null default '';
create index on public.call_leads (assigned_to);
create index on public.call_leads (niche);
