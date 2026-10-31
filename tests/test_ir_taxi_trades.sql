-- LOCAL TEST of 013 on the imported 2026 rosters
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','chrisbadley@live.com'),
 ('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com') on conflict do nothing;
create function pg_temp.as_user(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n)::text, false) $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n and active $$;
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
select 'league week now: ' || league_week(2026) || ' | trade deadline: ' || to_char(trade_deadline(2026) at time zone 'America/Los_Angeles','Dy Mon DD HH24:MI') || ' PT';

-- ===== IR (Roaring Hoogy: Chig Okonkwo on IR since week 3) =====
select pg_temp.as_user(1); set role authenticated;
select 'I1 cap before: $' || team_cap_used(my_team_id(),2026);
select 'I2 ' || place_on_ir(pg_temp.pid('Deebo Samuel Sr.'));
select 'I3 cap after (Deebo $6 -> counts $3): $' || team_cap_used(my_team_id(),2026);
select place_on_ir(pg_temp.pid('Jack Bech'));                       -- 3rd IR -> blocked
select activate_from_ir(pg_temp.pid('Deebo Samuel Sr.'));           -- placed this week -> must wait 3 weeks
select 'I4 ' || activate_from_ir(pg_temp.pid('Chig Okonkwo'));      -- IR since wk 3 -> OK
select place_on_ir(pg_temp.pid('Jonah Coleman'));                   -- taxi player -> blocked
-- ===== Taxi =====
select move_to_taxi(pg_temp.pid('Emeka Egbuka'));                   -- not a just-added FA rookie -> blocked
select 'T1 ' || promote_from_taxi(pg_temp.pid('Jonah Coleman'));
select 'T2 cap after promoting Coleman ($12): $' || team_cap_used(my_team_id(),2026) || ', active ' || (select count(*) from roster_spots where team_id=my_team_id() and status='active');
reset role;

-- ===== Trades =====
select pg_temp.as_user(2); set role authenticated;   -- Purple Reign
select 'R1 trade id ' || propose_trade(pg_temp.tid('Roaring Hoogy'), array[pg_temp.pid('Jerry Jeudy')], array[pg_temp.pid('Case Keenum')], '2027 5th (own)', null, 'QB depth');
select propose_trade(pg_temp.tid('Roaring Hoogy'), array[pg_temp.pid('Case Keenum')], null);           -- not his player -> blocked
reset role; select pg_temp.as_user(3); set role authenticated;   -- Pool Boy (not involved)
select 'R2 Pool Boy sees pending trade (expect 0): ' || count(*) from trades;
select respond_trade(1, true);                                        -- not his trade -> blocked
reset role; select pg_temp.as_user(1); set role authenticated;   -- Hoogy (receiving team)
select 'R3 ' || respond_trade(1, true);
reset role; select pg_temp.as_user(2); set role authenticated;
select decide_trade(1, true);                                         -- manager can't approve
reset role; select pg_temp.as_user(1); set role authenticated;
select 'R4 ' || decide_trade(1, true, 'Looks fair');
reset role;
select 'R5 Jeudy now on: ' || (select t.name from roster_spots r join teams t on t.id=r.team_id where player_id=pg_temp.pid('Jerry Jeudy'))
    || ' | Keenum now on: ' || (select t.name from roster_spots r join teams t on t.id=r.team_id where player_id=pg_temp.pid('Case Keenum'))
    || ' | salaries kept: ' || (select string_agg(salary::text, ',') from roster_spots where player_id in (pg_temp.pid('Jerry Jeudy'), pg_temp.pid('Case Keenum')));
select pg_temp.as_user(3); set role authenticated;
select 'R6 Pool Boy sees approved trade (expect 1): ' || count(*) from trades;
reset role;
-- Pair of Juggs: Purple Reign just claimed a free agent this week -> can't trade him
update roster_spots set acquired_via='fa_bid', acquired_week=league_week(2026) where player_id = pg_temp.pid('Geno Smith');
select pg_temp.as_user(2); set role authenticated;
select propose_trade(pg_temp.tid('Pool Boy'), array[pg_temp.pid('Geno Smith')], null);
-- cancel flow
select 'R7 trade ' || propose_trade(pg_temp.tid('Pool Boy'), array[pg_temp.pid('Rashod Bateman')], null) || ' then ' || cancel_trade(2);
reset role;
select 'R8 log: ' || string_agg(kind, ', ' order by id) from transactions where kind in ('ir_on','ir_off','taxi_promote','trade_in','trade_out','trade');
