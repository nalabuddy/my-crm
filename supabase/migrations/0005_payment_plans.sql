-- Payment plans: when each part of an invoice is expected to be paid.
-- Run once in Supabase → SQL Editor (after 0001–0004).
create table public.installments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  due_on      date not null,
  -- what had already been paid on the invoice when the plan was made, so earlier payments don't tick these off
  paid_before numeric(12,2) not null default 0 check (paid_before >= 0),
  created_at  timestamptz not null default now()
);
create index on public.installments (invoice_id);
create index on public.installments (due_on);

alter table public.installments enable row level security;
create policy "team all" on public.installments for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.installments from anon;
