-- Cold-call leads, expenses, targets, convert_lead (run against crm_e2e from tests/local-stack)
\set ON_ERROR_STOP off
select id as mid from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as sid from auth.users where email='stranger@example.com' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mid', 'role', 'authenticated')::text, true) \gset
insert into call_leads (business, contact, phone) values ('Acme Plumbing', 'Sipho', '082 111 2222');
\echo '--- convert_lead: client + task + call log, lead linked'
select public.convert_lead((select id from call_leads where business='Acme Plumbing')) is not null as converted;
select name, status, source, phone from clients where name='Acme Plumbing';
select title, assignee from tasks where title='Send quote to Acme Plumbing';
select type, by, text from activities where text='Cold call: interested';
select outcome, client_id is not null as linked from call_leads where business='Acme Plumbing';
\echo '--- converting twice creates NO second client'
select public.convert_lead((select id from call_leads where business='Acme Plumbing')) is not null;
select count(*) as acme_clients from clients where name='Acme Plumbing';
\echo '--- bad outcome must FAIL'
savepoint a; update call_leads set outcome='Maybe' where business='Acme Plumbing'; rollback to a;
\echo '--- expense must be > 0 (FAIL), target month format (FAIL)'
savepoint b; insert into expenses (amount) values (0); rollback to b;
savepoint c; insert into revenue_targets (month, amount) values ('Oct-2026', 5); rollback to c;
insert into revenue_targets (month, amount) values ('default', 50000);
select * from revenue_targets;
rollback;
\echo '--- stranger: sees nothing, cannot write any of the three tables'
select id as cid from clients where name='Mohammed' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
select (select count(*) from call_leads) + (select count(*) from expenses) + (select count(*) from revenue_targets) as rows_seen;
insert into call_leads (business) values ('hacker');
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
insert into expenses (amount) values (5);
rollback;
\echo '--- anonymous denied'
begin; set local role anon; select count(*) from call_leads; rollback;
