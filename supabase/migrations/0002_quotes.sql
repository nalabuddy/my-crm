-- Quotes: track what you offered, and turn an accepted quote into invoice(s) in one atomic step.
-- Run once in Supabase → SQL Editor (after 0001_init.sql).

create table public.quotes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  deal_id    uuid references public.deals(id) on delete set null,
  label      text not null check (length(trim(label)) > 0),
  amount     numeric(12,2) not null check (amount > 0),
  status     text not null default 'Draft' check (status in ('Draft','Sent','Accepted','Declined')),
  sent_on    date,
  notes      text not null default '',
  invoiced   boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.quotes (client_id);
create index on public.quotes (deal_id);

alter table public.quotes enable row level security;
create policy "team all" on public.quotes for all to authenticated
  using (public.is_team()) with check (public.is_team());
revoke all on public.quotes from anon;

-- Accepted quote → invoice (or deposit + final invoice). Runs as the caller, so Row Level Security applies.
create function public.convert_quote(p_quote uuid, p_deposit_pct numeric default 0)
returns void language plpgsql security invoker set search_path = public as $$
declare q public.quotes; dep numeric(12,2) := 0;
begin
  select * into q from public.quotes where id = p_quote for update;
  if not found then raise exception 'Quote not found'; end if;
  if q.invoiced then raise exception 'This quote has already been turned into an invoice'; end if;
  if q.status = 'Declined' then raise exception 'A declined quote cannot be invoiced'; end if;
  if p_deposit_pct < 0 or p_deposit_pct >= 100 then raise exception 'Deposit must be between 0 and 99 percent'; end if;

  if p_deposit_pct > 0 then
    dep := round(q.amount * p_deposit_pct / 100, 2);
    insert into public.invoices (client_id, label, kind, amount)
      values (q.client_id, q.label || ' (deposit)', 'Deposit', dep);
    insert into public.invoices (client_id, label, kind, amount)
      values (q.client_id, q.label, 'Invoice', q.amount - dep);
  else
    insert into public.invoices (client_id, label, kind, amount)
      values (q.client_id, q.label, 'Invoice', q.amount);
  end if;

  update public.quotes set status = 'Accepted', invoiced = true where id = q.id;

  -- Move the linked deal forward only (never backwards)
  if q.deal_id is not null then
    update public.deals
       set stage = case when dep > 0 then 'Awaiting deposit' else 'In progress' end
     where id = q.deal_id and stage in ('Lead', 'Quote sent');
  end if;
end $$;
revoke all on function public.convert_quote(uuid, numeric) from public, anon;
grant execute on function public.convert_quote(uuid, numeric) to authenticated;
