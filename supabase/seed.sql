-- Run AFTER you have created both users in Supabase → Authentication → Users.
-- 1) Link the two logins to their names (this is what grants access).
insert into public.profiles (id, name)
select id, 'Michael' from auth.users where email = 'michaelvaneck11@gmail.com'
on conflict (id) do nothing;
insert into public.profiles (id, name)
select id, 'Trevor' from auth.users where email = 'ryantrevor72@gmail.com'
on conflict (id) do nothing;

-- 2) Starter data (only if the clients table is empty, so re-running is safe).
do $$
declare cid uuid;
begin
  if exists (select 1 from public.clients) then return; end if;

  insert into public.clients (name, status, source) values ('Mohammed', 'Active', 'Other') returning id into cid;

  insert into public.invoices (client_id, label, kind, amount) values
    (cid, 'Completed project',     'Invoice', 10500),
    (cid, 'New project deposit',   'Deposit', 15000);

  insert into public.deals (client_id, title, value, stage, owner) values
    (cid, 'Intranet', 0, 'Quote sent', 'Both');

  insert into public.tasks (title, assignee, client_id) values
    ('Send intranet quote to Mohammed', 'Both', cid),
    ('Get payment dates for the R10,500', 'Both', cid),
    ('Ask about the referral who will email website content', 'Both', cid),
    ('Fix the CIPC document', 'Both', null),
    ('Open the business bank account', 'Both', null),
    ('Restart cold calling', 'Both', null);
end $$;
