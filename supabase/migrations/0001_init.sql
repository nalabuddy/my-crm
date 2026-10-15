-- Next Level Web Solutions CRM — schema + Row Level Security
-- Run once in Supabase → SQL Editor.

create table public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  name text not null unique check (name in ('Michael','Trevor'))
);

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  status     text not null default 'Lead' check (status in ('Lead','Active','Past')),
  contact    text not null default '',
  phone      text not null default '',
  email      text not null default '',
  source     text not null default 'Other' check (source in ('Cold call','Referral','Website','Social media','Other')),
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create table public.deals (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients(id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  value      numeric(12,2) not null default 0 check (value >= 0),
  stage      text not null default 'Lead' check (stage in ('Lead','Quote sent','Awaiting deposit','In progress','Delivered','Paid')),
  owner      text not null default 'Both' check (owner in ('Michael','Trevor','Both')),
  due        date,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  label         text not null check (length(trim(label)) > 0),
  kind          text not null default 'Invoice' check (kind in ('Invoice','Deposit')),
  amount        numeric(12,2) not null check (amount > 0),
  due           date,
  promised_date date,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  received_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  assignee   text not null default 'Both' check (assignee in ('Michael','Trevor','Both')),
  due        date,
  priority   text not null default 'Normal' check (priority in ('Normal','High')),
  client_id  uuid references public.clients(id) on delete set null,
  notes      text not null default '',
  done       boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  type       text not null default 'Note' check (type in ('Call','WhatsApp','Email','Meeting','Note')),
  text       text not null default '',
  at         date not null default current_date,
  by         text not null check (by in ('Michael','Trevor')),
  created_at timestamptz not null default now()
);

create index on public.deals (client_id);
create index on public.invoices (client_id);
create index on public.payments (invoice_id);
create index on public.tasks (client_id);
create index on public.tasks (done, due);
create index on public.activities (client_id, at desc);

-- Balance per invoice (security_invoker → RLS of the caller applies)
create view public.invoice_balances with (security_invoker = true) as
select i.*,
       coalesce(sum(p.amount), 0)::numeric(12,2)           as paid,
       (i.amount - coalesce(sum(p.amount), 0))::numeric(12,2) as balance,
       count(p.id)::int                                     as payment_count
from public.invoices i
left join public.payments p on p.invoice_id = i.id
group by i.id;

-- Never allow payments to exceed the invoice amount (race-safe: locks the invoice row)
create function public.check_payment_total() returns trigger
language plpgsql as $$
declare inv_amount numeric; others numeric;
begin
  select amount into inv_amount from public.invoices where id = new.invoice_id for update;
  select coalesce(sum(amount), 0) into others from public.payments
   where invoice_id = new.invoice_id and id <> new.id;
  if others + new.amount > inv_amount then
    raise exception 'Payment exceeds the invoice balance (balance is %)', inv_amount - others
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger payments_total_check before insert or update on public.payments
  for each row execute function public.check_payment_total();

-- Only the two registered team members pass. Not just "any authenticated user".
create function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;
revoke all on function public.is_team() from public, anon;
grant execute on function public.is_team() to authenticated;

alter table public.profiles   enable row level security;
alter table public.clients    enable row level security;
alter table public.deals      enable row level security;
alter table public.invoices   enable row level security;
alter table public.payments   enable row level security;
alter table public.tasks      enable row level security;
alter table public.activities enable row level security;

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['clients','deals','invoices','payments','tasks','activities'] loop
    execute format('create policy "team all" on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
end $$;

-- Nothing for the anonymous role
revoke all on all tables in schema public from anon;
revoke all on public.invoice_balances from anon;
