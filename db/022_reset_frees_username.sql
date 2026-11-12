-- =====================================================================
-- SacVerde League — 022: Reset frees the username in one click (2026-11-12)
-- Run AFTER 021. Safe to re-run. Changes one function; no data changes.
--
-- Before: Admin → Logins → Reset cleared the username and made a new team code, but the old
-- Supabase account (<username>@users.sacverde.app) stayed behind, so the manager couldn't sign up
-- with the same username until the commissioner deleted it by hand in Supabase → Authentication → Users.
--
-- Now Reset also retires that old account:
--  * no forum posts  -> the old account is deleted (sessions/identities go with it)
--  * has forum posts -> the old account is renamed to <username>.old<timestamp>@users.sacverde.app,
--                       banned, and signed out, so posts keep their author and the username is free
-- Only username accounts (@users.sacverde.app) are touched — never an email-link login.
-- =====================================================================

create or replace function public.admin_reset_login(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); nc text; old_uid uuid; old_email text; how text := '';
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if not exists (select 1 from public.league_members where email = e) then raise exception 'No login for %.', e; end if;
  if exists (select 1 from public.league_members where email = e and login_user_id = auth.uid() and user_id is distinct from auth.uid()) then
    raise exception 'That would lock you out (you have no email login). Reset it from the SQL Editor if you really need to.';
  end if;

  select login_user_id into old_uid from public.league_members where email = e;
  update public.league_members set login_user_id = null, username = null where email = e;

  if old_uid is not null then
    select u.email into old_email from auth.users u where u.id = old_uid;
    if old_email like '%@users.sacverde.app' then
      if exists (select 1 from public.forum_messages f where f.author = old_uid) then
        old_email := split_part(old_email, '@', 1) || '.old' || to_char(now(), 'YYYYMMDDHH24MISS') || '@users.sacverde.app';
        update auth.users set email = old_email, banned_until = 'infinity' where id = old_uid;
        update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(old_email)) where user_id = old_uid;
        delete from auth.sessions where user_id = old_uid;
        how := ' Old account retired (kept for forum history); username is free.';
      else
        delete from auth.users where id = old_uid;
        how := ' Old account deleted; username is free.';
      end if;
    end if;
  end if;

  nc := public.new_member_code();
  insert into public.member_codes (email, code) values (e, nc) on conflict (email) do update set code = excluded.code, created_at = now();
  insert into public.transactions (season, kind, team_id, details)
  values (public.current_season(), 'login_reset', (select team_id from public.league_members where email = e), jsonb_build_object('email', e));
  return format('Login reset. New team code: %s.%s', nc, how);
end $$;
