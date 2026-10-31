-- LOCAL TESTING ONLY. Mimics the parts of Supabase the real project already has.
-- Never run this in Supabase.
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::json->>'sub','')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
