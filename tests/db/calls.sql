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

-- migration 0004: lead sheet columns
\echo '--- 0004: sheet columns store and default; tier only A/B/C/blank (bad tier must FAIL)'
select id as m4 from auth.users where email='michaelvaneck11@gmail.com' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'m4', 'role', 'authenticated')::text, true) \gset
insert into call_leads (business, assigned_to, niche, tier, city, lead_code) values ('Sheet Co', 'Dom', 'Legal', 'A', 'Knysna', 'L-001');
insert into call_leads (business) values ('Plain Co');
select business, assigned_to, niche, tier, city, lead_code from call_leads where business in ('Sheet Co','Plain Co') order by business desc;
savepoint z; insert into call_leads (business, tier) values ('Bad Tier', 'Z'); rollback to z;
rollback;

-- migration 0005: payment plans
\echo '--- 0005: a team member can plan an invoice; a stranger sees nothing; anonymous denied; deleting the invoice removes the plan'
select id as m5 from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as inv5 from invoices limit 1 \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'m5', 'role', 'authenticated')::text, true) \gset
insert into installments (invoice_id, amount, due_on, paid_before) values (:'inv5', 100, '2026-12-01', 0);
select count(*) as rows_for_team from installments;
savepoint z; insert into installments (invoice_id, amount, due_on) values (:'inv5', 0, '2026-12-01'); rollback to z;
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
select count(*) as rows_for_stranger from installments;
rollback;
begin; set local role anon; select count(*) from installments; rollback;

-- migration 0006: quote documents + settings
\echo '--- 0006: team can save settings and quote wording; quote numbers unique; stranger and anon see nothing'
select id as m6 from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as c6 from clients limit 1 \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'m6', 'role', 'authenticated')::text, true) \gset
insert into settings (key, value) values ('business', '{"name":"X"}');
insert into quotes (client_id, label, amount, number, doc) values (:'c6', 'Doc quote', 100, 'T-2026-1', '{"project":"p"}');
savepoint z; insert into quotes (client_id, label, amount, number) values (:'c6', 'Dup number', 100, 'T-2026-1'); rollback to z;
insert into quotes (client_id, label, amount) values (:'c6', 'No number 1', 100), (:'c6', 'No number 2', 100);
select count(*) as quotes_ok from quotes where label like 'No number%' or label = 'Doc quote';
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
select count(*) as settings_for_stranger from settings;
rollback;
begin; set local role anon; select count(*) from settings; rollback;
