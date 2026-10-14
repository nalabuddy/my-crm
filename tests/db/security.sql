\set ON_ERROR_STOP off
select id as mid from auth.users where email='michaelvaneck11@gmail.com' \gset
select id as sid from auth.users where email='stranger@example.com' \gset
begin; set local role authenticated; select set_config('request.jwt.sub',:'mid',true) \gset
insert into payments(invoice_id,amount) select id,4000 from invoices where label='Completed project';
insert into payments(invoice_id,amount) select id,3000 from invoices where label='Completed project';
savepoint s; insert into payments(invoice_id,amount) select id,3500.01 from invoices where label='Completed project'; rollback to s;
\echo '--- exact remaining 3500 accepted -> balance 0'
insert into payments(invoice_id,amount) select id,3500 from invoices where label='Completed project';
select label, balance, payment_count from invoice_balances where label='Completed project';
\echo '--- bad stage rejected'
savepoint s2; insert into deals(title,stage) values('x','Nope'); rollback to s2;
rollback;
\echo '--- stranger UPDATE/DELETE affect 0 rows'
begin; set local role authenticated; select set_config('request.jwt.sub',:'sid',true) \gset
update tasks set done=true; delete from clients;
rollback;
select count(*) as tasks_done_total, (select count(*) from clients) as clients_left from tasks where done;
