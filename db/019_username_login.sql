-- =====================================================================
-- SacVerde League — 019: username + password logins with one-time team codes (2026-10-31)
-- Run AFTER 018. Safe to re-run.
-- After running: Supabase → Authentication → Sign In / Providers → Email → turn OFF "Confirm email".
--
-- How it works
--  * A manager signs up on the site with a username + password. The site creates the Supabase account as
--    <username>@users.sacverde.app (never emailed). That account has no team until it is claimed.
--  * claim_login(code, username) links the account to the team whose one-time code matches. The code is then used up.
--  * Codes live in member_codes, which nobody can read except through admin_login_codes() (commissioner only).
--  * The existing email-link login (user_id) keeps working for anyone already linked (the commissioner's backup).
--    Email accounts are NO LONGER linked automatically by address: with "Confirm email" off, anyone could
--    create an account with someone else's address, so only a team code links a new account.
-- =====================================================================

alter table public.league_members add column if not exists login_user_id uuid unique references auth.users(id) on delete set null;
alter table public.league_members add column if not exists username text unique check (username ~ '^[a-z0-9]{3,20}$');

create table if not exists public.member_codes (
  email      text primary key references public.league_members(email) on delete cascade on update cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);
alter table public.member_codes enable row level security;
revoke all on public.member_codes from anon, authenticated;

create table if not exists public.login_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
create index if not exists login_attempts_user_at on public.login_attempts (user_id, at);

-- 6 characters, no look-alikes (no 0/O, 1/I/L)
create or replace function public.new_member_code() returns text
language plpgsql volatile set search_path = public as $$
declare abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.member_codes where code = c);
  end loop;
  return c;
end $$;

-- every manager without a username login gets a code
insert into public.member_codes (email, code)
select m.email, public.new_member_code() from public.league_members m
 where m.login_user_id is null and not exists (select 1 from public.member_codes c where c.email = m.email);

-- helpers: either login (email link or username) counts
create or replace function public.my_team_id() returns int
language sql stable security definer set search_path = public as $$
  select team_id from public.league_members where user_id = auth.uid() or login_user_id = auth.uid() limit 1
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where user_id = auth.uid() or login_user_id = auth.uid())
$$;
create or replace function public.is_commissioner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members
                 where (user_id = auth.uid() or login_user_id = auth.uid()) and role = 'commissioner')
$$;

-- stop linking new accounts by email address (see header)
create or replace function public.link_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

-- claim a team with its one-time code
-- returns {"ok":bool,"msg":text}. A wrong code is answered (not raised) so the attempt counter isn't rolled back.
drop function if exists public.claim_login(text, text);
create or replace function public.claim_login(p_code text, p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); u text := lower(trim(p_username)); c text := upper(regexp_replace(coalesce(p_code,''), '\s', '', 'g'));
        acct_email text; m public.league_members; tname text;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if (select count(*) from public.login_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many tries. Wait an hour or ask the commissioner for your code.';
  end if;
  insert into public.login_attempts (user_id) values (uid);
  select email into acct_email from auth.users where id = uid;
  if acct_email is distinct from u || '@users.sacverde.app' then raise exception 'Username doesn''t match this account.'; end if;
  if u !~ '^[a-z0-9]{3,20}$' then raise exception 'Usernames are 3–20 letters or numbers.'; end if;
  if exists (select 1 from public.league_members where login_user_id = uid) then
    select t.name into tname from public.league_members x join public.teams t on t.id = x.team_id where x.login_user_id = uid;
    return jsonb_build_object('ok', true, 'msg', format('Already linked to %s.', tname));
  end if;
  select m2.* into m from public.member_codes k join public.league_members m2 on m2.email = k.email where k.code = c;
  if m.email is null then return jsonb_build_object('ok', false, 'msg', 'That team code isn''t right. Check it with the commissioner.'); end if;
  if m.login_user_id is not null then raise exception 'That team already has a username login. Ask the commissioner to reset it.'; end if;
  update public.league_members set login_user_id = uid, username = u where email = m.email;
  delete from public.member_codes where email = m.email;
  delete from public.login_attempts where user_id = uid;
  select name into tname from public.teams where id = m.team_id;
  return jsonb_build_object('ok', true, 'msg', format('Welcome, %s! You''re signed in as %s.', u, tname));
end $$;

-- commissioner: see codes / usernames
create or replace function public.admin_login_codes() returns table (email text, team_id int, display_name text, role text,
    username text, code text, email_login boolean, username_login boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  return query select m.email, m.team_id, m.display_name, m.role, m.username, k.code,
                      m.user_id is not null, m.login_user_id is not null
                 from public.league_members m left join public.member_codes k on k.email = m.email
                order by m.team_id;
end $$;

-- commissioner: reset a username login (forgot password, wrong person) -> new code
create or replace function public.admin_reset_login(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); nc text;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if not exists (select 1 from public.league_members where email = e) then raise exception 'No login for %.', e; end if;
  if exists (select 1 from public.league_members where email = e and login_user_id = auth.uid() and user_id is distinct from auth.uid()) then
    raise exception 'That would lock you out (you have no email login). Reset it from the SQL Editor if you really need to.';
  end if;
  update public.league_members set login_user_id = null, username = null where email = e;
  nc := public.new_member_code();
  insert into public.member_codes (email, code) values (e, nc) on conflict (email) do update set code = excluded.code, created_at = now();
  insert into public.transactions (season, kind, team_id, details)
  values (public.current_season(), 'login_reset', (select team_id from public.league_members where email = e), jsonb_build_object('email', e));
  return format('Login reset. New team code: %s', nc);
end $$;

-- new managers added from Admin → Logins get a code; email accounts are no longer linked by address
create or replace function public.admin_set_member(p_email text, p_team int, p_name text default null, p_phone text default null,
    p_role text default 'manager', p_remove boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That doesn''t look like an email address.'; end if;
  if p_remove then
    if e = (select email from public.league_members where user_id = auth.uid() or login_user_id = auth.uid() limit 1) then raise exception 'You can''t remove your own login.'; end if;
    delete from public.league_members where email = e;
    return format('%s removed.', e);
  end if;
  if p_role = 'commissioner' and not exists (select 1 from public.league_members where email = e and role = 'commissioner') then
    raise exception 'There is only one commissioner. Change roles from the database if that ever needs to change.';
  end if;
  insert into public.league_members (email, team_id, display_name, phone, role)
  values (e, p_team, nullif(trim(p_name),''), nullif(trim(p_phone),''), p_role)
  on conflict (email) do update set team_id = excluded.team_id, display_name = coalesce(excluded.display_name, public.league_members.display_name),
     phone = coalesce(excluded.phone, public.league_members.phone);
  insert into public.member_codes (email, code)
  select e, public.new_member_code() where not exists (select 1 from public.member_codes where email = e)
     and exists (select 1 from public.league_members where email = e and login_user_id is null);
  return format('%s saved.', e);
end $$;

revoke execute on function public.claim_login(text,text), public.admin_login_codes(), public.admin_reset_login(text), public.new_member_code() from public, anon;
grant execute on function public.claim_login(text,text), public.admin_login_codes(), public.admin_reset_login(text) to authenticated;
