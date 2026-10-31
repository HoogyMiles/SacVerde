\set ON_ERROR_STOP 0
\pset tuples_only on
-- run on a fresh DB after all migrations (run_all.sh seeds hoogy/badley/kaiser with email links)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','k2kings@users.sacverde.app'),
  ('00000000-0000-0000-0000-0000000000a2','sneaky@users.sacverde.app'), ('00000000-0000-0000-0000-0000000000a3','k2smith@yahoo.com') on conflict do nothing;
select 'L1 codes for every member: ' || ((select count(*) from member_codes) = (select count(*) from league_members where login_user_id is null))::text;
select 'L2 email signup NOT auto-linked: ' || (select user_id is null from league_members where email='k2smith@yahoo.com')::text;
-- a member can't read codes
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003"}',false); set role authenticated;
select count(*) from member_codes;                                   -- blocked
select count(*) from admin_login_codes();                            -- blocked
reset role;
create function pg_temp.code(e text) returns text language sql as $$ select code from member_codes where email = e $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1"}',false);
\gset
select set_config('sv.k2code', pg_temp.code('k2smith@yahoo.com'), false);
set role authenticated;
select 'L3 not a member yet: ' || (not is_member())::text;
select 'L3b ' || (claim_login('ZZZZZZ', 'k2kings')->>'msg');
select claim_login(current_setting('sv.k2code'), 'otherguy');        -- username doesn't match account
select 'L4 ' || (claim_login(lower(current_setting('sv.k2code')), 'K2Kings')->>'msg');
select 'L5 team now: ' || (select name from teams where id = my_team_id());
select 'L6 again: ' || (claim_login(current_setting('sv.k2code'), 'k2kings')->>'msg');
reset role;
select 'L7 code used up: ' || (pg_temp.code('k2smith@yahoo.com') is null)::text;
-- someone else can't reuse it; brute force is capped
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2"}',false); set role authenticated;
select 'L7b used code: ' || (claim_login(current_setting('sv.k2code'), 'sneaky')->>'ok');
select 'L7c ' || count(*) filter (where not (claim_login('AAAAA'||i, 'sneaky')->>'ok')::boolean) || ' wrong' from generate_series(1,9) i;
select claim_login('AAAAAA', 'sneaky');                              -- 11th -> too many tries (error)
reset role;
-- commissioner sees codes and resets K2
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false); set role authenticated;
select 'L8 rows: ' || count(*) || ', k2 username: ' || max(username) filter (where email='k2smith@yahoo.com') from admin_login_codes();
select 'L9 ' || left(admin_reset_login('k2smith@yahoo.com'), 26);
reset role;
select 'L10 after reset: ' || (select (login_user_id is null and username is null)::text from league_members where email='k2smith@yahoo.com') || ' new code: ' || (pg_temp.code('k2smith@yahoo.com') is not null)::text;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1"}',false); set role authenticated;
select 'L11 old account lost team: ' || (not is_member())::text;
reset role;
select 'L12 log: ' || string_agg(distinct kind, ', ') from transactions where kind in ('login_reset');
