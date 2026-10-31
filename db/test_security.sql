-- LOCAL TEST: impersonate managers and try to break the rules.
\set ON_ERROR_STOP 0
\pset tuples_only on
-- Three logins: Hoogy (commissioner), Tritons, Pool Boy, plus a stranger
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','PaulBStephens@hotmail.com'),
 ('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com'),
 ('00000000-0000-0000-0000-000000000009','random@stranger.com');
select 'T1 linked logins (expect 3): ' || count(*) from league_members where user_id is not null;

insert into bid_weeks (season, week, bids_close_at) values (2026, 9, now() + interval '1 hour');
-- a rostered player
insert into roster_spots (season, team_id, player_id, salary)
 select 2026, (select id from teams where name='Tritons'), id, 40 from players where name='Ja''Marr Chase';

create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  $$;

-- ===== Tritons places bids =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
set role authenticated;
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 7 from players where name='Jauan Jennings';         -- $12 list -> min 6: OK
select 'T2 Tritons bid placed (expect 1): ' || count(*) from bids;
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 5 from players where name='Jauan Jennings';         -- duplicate -> fail
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 2 from players where name='Tyreek Hill';           -- $3 list -> min 2: OK
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 1 from players where name='David Njoku';           -- $5 -> min 3: TOO LOW
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 50 from players where name='Ja''Marr Chase';       -- rostered -> fail
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, (select id from teams where name='Pool Boy'), id, 9 from players where name='Tyreek Hill';  -- bid as another team -> fail
reset role;

-- ===== Pool Boy bids on the same player =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
set role authenticated;
insert into bids (bid_week_id, team_id, player_id, amount)
  select 1, my_team_id(), id, 9 from players where name='Jauan Jennings';
select 'T3 Pool Boy sees only own bids (expect 1): ' || count(*) from bids;
update bids set amount = 99 where team_id <> my_team_id();
reset role;
select 'T4 Tritons bid untouched by Pool Boy (expect 7): ' || amount from bids b join players p on p.id=b.player_id join teams t on t.id=b.team_id where t.name='Tritons' and p.name='Jauan Jennings';

-- ===== Commissioner tries to peek =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
set role authenticated;
select 'T5 Commissioner sees others bids before reveal (expect 0): ' || count(*) from bids;
update bid_weeks set status = 'revealed' where id = 1;                -- early reveal -> fail
update bid_weeks set bids_close_at = now() - interval '1 minute' where id = 1;  -- move deadline -> fail
update league_members set team_id = (select id from teams where name='Tritons') where email='chrishoogstad@gmail.com';  -- swap team -> fail
select 'T6 Commissioner still sees 0 after tricks: ' || count(*) from bids;
reset role;

-- ===== Stranger =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
set role authenticated;
select 'T7 Stranger sees players (expect 0): ' || count(*) from players;
select 'T8 Stranger sees contacts (expect 0): ' || count(*) from league_members;
reset role;
set role anon;
select 'T9 Logged-out visitor can read players (expect error): ' || count(*) from players;
reset role;

-- ===== Deadline passes, then reveal =====
reset role;
alter table bid_weeks disable trigger bid_week_guard;   -- test-only: fast-forward the clock
update bid_weeks set bids_close_at = now() - interval '1 second' where id = 1;
alter table bid_weeks enable trigger bid_week_guard;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
set role authenticated;
update bids set amount = 20 where team_id = my_team_id();                 -- after deadline -> fail
delete from bids where team_id = my_team_id();                            -- withdraw after deadline -> fail
reset role;
update bid_weeks set status = 'revealed' where id = 1;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
set role authenticated;
select 'T10 After reveal Pool Boy sees all bids (expect 3): ' || count(*) from bids;
insert into transactions (season, kind) values (2026, 'fake');                -- forge log -> fail
reset role;
select 'T11 Audit entries logged: ' || string_agg(kind, ', ' order by id) from transactions;
