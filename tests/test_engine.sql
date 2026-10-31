-- LOCAL TEST of 005_engine.sql. Real 2026 NFL schedule; "now" = whenever this runs.
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','paulbstephens@hotmail.com'),
 ('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com'),
 ('00000000-0000-0000-0000-000000000004','spandexboy@hotmail.com');
create function pg_temp.as_user(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n)::text, false) $$;
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n $$;

-- standings after week 7: Tritons 3rd, Pool Boy 9th (lower), Hoogy 1st, Assassins 12th
insert into standings (season, week, team_id, rank) values
 (2026,7,pg_temp.tid('Tritons'),3),(2026,7,pg_temp.tid('Pool Boy'),9),(2026,7,pg_temp.tid('Roaring Hoogy'),1),(2026,7,pg_temp.tid('Assassins'),12);

delete from bid_weeks;  -- remove the auto-opened week (no bids yet)
-- Bid weeks: open them in the future, place bids, then move the deadline into the past (test-only)
insert into bid_weeks (id, season, week, bids_close_at) values (8, 2026, 8, now() + interval '1 day'), (9, 2026, 9, now() + interval '1 day');
insert into bids (bid_week_id, team_id, player_id, amount) values
 (8, pg_temp.tid('Tritons'),       pg_temp.pid('Josh Allen'), 20),
 (8, pg_temp.tid('Pool Boy'),      pg_temp.pid('Josh Allen'), 20),
 (8, pg_temp.tid('Roaring Hoogy'), pg_temp.pid('Josh Allen'), 15),
 (8, pg_temp.tid('Assassins'),     pg_temp.pid('Josh Allen'), 15),
 (8, pg_temp.tid('Tritons'),       pg_temp.pid('Josh Jacobs'), 14),
 (9, pg_temp.tid('Tritons'),       pg_temp.pid('Derrick Henry'), 20),
 (9, pg_temp.tid('Pool Boy'),      pg_temp.pid('Derrick Henry'), 16),
 (9, pg_temp.tid('Tritons'),       pg_temp.pid('Ja''Marr Chase'), 25),
 (9, pg_temp.tid('Assassins'),     pg_temp.pid('Tee Higgins'), 14);
alter table bid_weeks disable trigger bid_week_guard;
update bid_weeks set bids_close_at = '2026-10-27 21:00 America/Los_Angeles' where id = 8;   -- last Tuesday
update bid_weeks set bids_close_at = now() - interval '1 minute' where id = 9;              -- just closed
alter table bid_weeks enable trigger bid_week_guard;

-- E1 commissioner can't flip status directly (would skip priority windows)
select pg_temp.as_user(1); set role authenticated;
update bid_weeks set status = 'revealed' where id = 8;
-- E2 managers can't reveal
reset role; select pg_temp.as_user(2); set role authenticated;
select reveal_bid_week(8);
-- E3 scheduler reveals both closed weeks
reset role; select auto_reveal();
select 'E3 weeks revealed (expect 2): ' || count(*) from bid_weeks where status='revealed';

select 'E4 Allen order (expect PoolBoy#1 $20 tie>Tritons#2, Hoogy#3 $15 vs Assassins $15 -> Assassins lower -> Assassins#3, Hoogy#4): '
  || string_agg(t.name||'#'||r.priority||' $'||r.amount, ', ' order by r.priority)
  from bid_results r join teams t on t.id=r.team_id where r.bid_week_id=8 and r.player_id=pg_temp.pid('Josh Allen');
select 'E5 Allen windows PT: ' || string_agg('#'||priority||' '||coalesce(to_char(window_start at time zone 'America/Los_Angeles','Dy HH24:MI'),'-')||'→'||coalesce(to_char(window_end at time zone 'America/Los_Angeles','Dy MM/DD HH24:MI'),'-'), ' | ' order by priority)
  || ' | open from ' || to_char(max(open_from) at time zone 'America/Los_Angeles','Dy MM/DD HH24:MI')
  from bid_results where bid_week_id=8 and player_id=pg_temp.pid('Josh Allen');
select 'E6 Henry (BAL plays THU 11/5) windows PT: ' || string_agg('#'||priority||' →'||to_char(window_end at time zone 'America/Los_Angeles','Dy MM/DD HH24:MI'), ' | ' order by priority)
  || ' | open ' || to_char(max(open_from) at time zone 'America/Los_Angeles','Dy HH24:MI') || '–kickoff ' || to_char(max(kickoff_at) at time zone 'America/Los_Angeles','HH24:MI') || ' early=' || bool_and(early_game)
  from bid_results where bid_week_id=9 and player_id=pg_temp.pid('Derrick Henry');
select 'E7 Chase (CIN Sunday) #1 window ends: ' || to_char(window_end at time zone 'America/Los_Angeles','Dy MM/DD HH24:MI') from bid_results where bid_week_id=9 and player_id=pg_temp.pid('Ja''Marr Chase');

-- Now (Sat afternoon) is the #3 window for week 8
reset role; select pg_temp.as_user(3); set role authenticated;            -- Pool Boy #1: window ended Fri
select claim_player(8, pg_temp.pid('Josh Allen'));
reset role; select pg_temp.as_user(1); set role authenticated;            -- Hoogy #4: not until Sunday
select claim_player(8, pg_temp.pid('Josh Allen'));
reset role; select pg_temp.as_user(4); set role authenticated;            -- Assassins #3: OK
select 'E8 ' || claim_player(8, pg_temp.pid('Josh Allen'));
reset role; select 'E9 Allen on Assassins at $15: ' || t.name || ' $' || salary from roster_spots r join teams t on t.id=r.team_id where player_id=pg_temp.pid('Josh Allen');
select pg_temp.as_user(1); set role authenticated;
select claim_player(8, pg_temp.pid('Josh Allen'));                        -- already rostered
select claim_player(8, pg_temp.pid('Josh Jacobs'));                       -- never bid
reset role; select pg_temp.as_user(2); set role authenticated;
select claim_player(8, pg_temp.pid('Josh Jacobs'));                       -- GB played Thu 10/29: kicked off

-- Week 9, Tritons is #1 on Henry and Chase. Fill Tritons to 15 active / $160 first.
reset role;
insert into roster_spots (season, team_id, player_id, salary)
 select 2026, pg_temp.tid('Tritons'), p.id, case when row_number() over () = 1 then 132 else 2 end
   from players p join player_salaries s on s.player_id=p.id
  where p.pos='WR' and p.nfl_team in ('KC','LV','LAC','NYG') limit 15;
select 'E10 Tritons active/cap: ' || count(*) || ' / $' || team_cap_used(pg_temp.tid('Tritons'),2026) from roster_spots where team_id=pg_temp.tid('Tritons');
select pg_temp.as_user(2); set role authenticated;
select claim_player(9, pg_temp.pid('Derrick Henry'));                     -- 16 players -> must drop
select claim_player(9, pg_temp.pid('Derrick Henry'),
  (select player_id from roster_spots where team_id=my_team_id() and salary=2 limit 1));   -- drop $2: cap 158+20=178 > 170
select 'E11 ' || claim_player(9, pg_temp.pid('Derrick Henry'),
  (select player_id from roster_spots where team_id=my_team_id() and salary=132 limit 1)); -- drop $132: OK
reset role; select 'E12 Tritons after: ' || count(*) || ' players, $' || team_cap_used(pg_temp.tid('Tritons'),2026) from roster_spots where team_id=pg_temp.tid('Tritons');
select pg_temp.as_user(2); set role authenticated;
select drop_player(pg_temp.pid('Derrick Henry'));                         -- Executive Order
reset role; select pg_temp.as_user(3); set role authenticated;
select claim_player(9, pg_temp.pid('Derrick Henry'));                     -- already claimed
reset role;
select 'E13 transactions: ' || string_agg(kind || ':' || coalesce((select name from players where id=player_id),'-'), ', ' order by id)
  from transactions where kind in ('add','drop');
