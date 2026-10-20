-- Cold-call list, expenses (for profit) and a monthly revenue target.
-- Run once in Supabase → SQL Editor (after 0001 and 0002).

create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  spent_on   date not null default current_date,
  amount     numeric(12,2) not null check (amount > 0),
  category   text not null default 'General' check (length(trim(category)) > 0),
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index on public.expenses (spent_on);

-- 'default' = the target used for every month
create table public.revenue_targets (
  month  text primary key check (month = 'default' or month ~ '^\d{4}-\d{2}$'),
  amount numeric(12,2) not null check (amount >= 0)
);

create table public.call_leads (
  id             uuid primary key default gen_random_uuid(),
  business       text not null check (length(trim(business)) > 0),
  contact        text not null default '',
  phone          text not null default '',
  notes          text not null default '',
  outcome        text not null default 'Not called'
                 check (outcome in ('Not called','No answer','Call back later','Meeting booked','Interested','Not interested')),
  callback_on    date,
  attempts       int not null default 0,
  last_called_on date,
  called_by      text check (called_by in ('Michael','Trevor')),
  client_id      uuid references public.clients(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.call_leads (outcome);
create index on public.call_leads (client_id);

alter table public.expenses        enable row level security;
alter table public.revenue_targets enable row level security;
alter table public.call_leads      enable row level security;
do $$ declare t text; begin
  foreach t in array array['expenses','revenue_targets','call_leads'] loop
    execute format('create policy "team all" on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- "Interested": make them a client (source Cold call), log the call, and add a task to send the quote. Atomic; safe to tap twice.
create function public.convert_lead(p_lead uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare l public.call_leads; cid uuid; who text; today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  select * into l from public.call_leads where id = p_lead for update;
  if not found then raise exception 'Lead not found'; end if;
  if l.client_id is not null then return l.client_id; end if;
  select name into who from public.profiles where id = auth.uid();

  insert into public.clients (name, status, contact, phone, source, notes)
    values (l.business, 'Lead', l.contact, l.phone, 'Cold call', l.notes) returning id into cid;
  insert into public.tasks (title, assignee, due, client_id)
    values ('Send quote to ' || l.business, coalesce(who, 'Both'), today + 2, cid);
  if who is not null then
    insert into public.activities (client_id, type, text, at, by) values (cid, 'Call', 'Cold call: interested', today, who);
  end if;
  update public.call_leads
     set client_id = cid,
         outcome = case when outcome in ('Not called','No answer','Call back later') then 'Interested' else outcome end
   where id = l.id;
  return cid;
end $$;
revoke all on function public.convert_lead(uuid) from public, anon;
grant execute on function public.convert_lead(uuid) to authenticated;
