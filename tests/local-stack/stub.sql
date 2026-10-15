-- Minimal stand-in for what Supabase provides, so the real migration + seed + RLS can run on plain Postgres.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'pw'; end if;
end $$;
grant anon, authenticated to authenticator;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to anon, authenticated;
-- Supabase grants new tables to anon + authenticated by default; the migration then revokes anon.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'michaelvaneck11@gmail.com'),
  ('22222222-2222-4222-8222-222222222222', 'ryantrevor72@gmail.com'),
  ('33333333-3333-4333-8333-333333333333', 'stranger@example.com')
on conflict do nothing;
