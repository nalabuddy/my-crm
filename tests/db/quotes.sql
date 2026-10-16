-- Quote → invoice conversion (run against crm_e2e from tests/local-stack, which applies all migrations + seed)
\set ON_ERROR_STOP off
select id as mid from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as sid from auth.users where email='stranger@example.com' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mid', 'role', 'authenticated')::text, true);
insert into deals (title, stage, client_id) select 'Quote deal', 'Quote sent', id from clients where name='Mohammed';
insert into quotes (client_id, deal_id, label, amount, status)
  select c.id, d.id, 'Website build', 10000, 'Sent' from clients c, deals d where c.name='Mohammed' and d.title='Quote deal';
insert into quotes (client_id, label, amount, status) select id, 'Declined job', 500, 'Declined' from clients where name='Mohammed';
\echo '--- 40% deposit: expect Deposit 4000 + Invoice 6000, quote invoiced, deal Awaiting deposit'
select public.convert_quote((select id from quotes where label='Website build'), 40);
select label, kind, amount from invoices where label like 'Website build%' order by kind;
select status, invoiced from quotes where label='Website build';
select stage from deals where title='Quote deal';
\echo '--- converting twice must FAIL'
savepoint s1; select public.convert_quote((select id from quotes where label='Website build'), 0); rollback to s1;
\echo '--- declined quote must FAIL'
savepoint s2; select public.convert_quote((select id from quotes where label='Declined job'), 0); rollback to s2;
\echo '--- bad deposit 100 must FAIL'
savepoint s3; select public.convert_quote((select id from quotes where label='Declined job'), 100); rollback to s3;
rollback;
\echo '--- stranger (no profile): sees no quotes and cannot convert'
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true);
select count(*) as quotes_seen from quotes;
insert into quotes (client_id, label, amount) select id, 'x', 1 from clients limit 1;
rollback;
\echo '--- anonymous denied'
begin; set local role anon; select count(*) from quotes; rollback;
-- more checks
\set ON_ERROR_STOP off
select id as mid from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as sid from auth.users where email='stranger@example.com' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mid', 'role', 'authenticated')::text, true) \gset
insert into quotes (client_id, label, amount, status) select id, 'Fresh', 900, 'Sent' from clients where name='Mohammed';
\echo '--- deposit 100 on a valid quote must FAIL'
savepoint a; select public.convert_quote((select id from quotes where label='Fresh'), 100); rollback to a;
\echo '--- 0% = one full invoice'
select public.convert_quote((select id from quotes where label='Fresh'), 0);
select label, kind, amount from invoices where label='Fresh';
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
\echo '--- stranger insert must FAIL'
insert into quotes (client_id, label, amount) select id, 'x', 1 from clients limit 1;
rollback;
\set ON_ERROR_STOP off
select id as cid from clients where name='Mohammed' \gset
select id as sid from auth.users where email='stranger@example.com' \gset
begin; set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'sid', 'role', 'authenticated')::text, true) \gset
\echo '--- stranger insert with a real client id must FAIL'
insert into quotes (client_id, label, amount) values (:'cid', 'x', 1);
\echo '--- stranger convert_quote on a real quote must FAIL/no-op'
select public.convert_quote(gen_random_uuid(), 0);
rollback;
