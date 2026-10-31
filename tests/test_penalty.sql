-- LOCAL TEST of 009 (run after test_engine.sql's setup pattern; self-contained here)
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002','paulbstephens@hotmail.com');
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n $$;
delete from bid_weeks;
-- Tritons: 15 drafted players at $160 (before the cycle)
insert into roster_spots (season, team_id, player_id, salary)
 select 2026, pg_temp.tid('Tritons'), p.id, case when row_number() over () = 1 then 132 else 2 end
   from players p where p.pos='WR' and p.nfl_team in ('KC','LV','LAC','NYG') limit 15;
-- Pool Boy: over the cap with drafted players only ($171)
insert into roster_spots (season, team_id, player_id, salary) select 2026, pg_temp.tid('Pool Boy'), id, 171 from players where name='Josh Allen';
-- Assassins: legal
insert into roster_spots (season, team_id, player_id, salary) select 2026, pg_temp.tid('Assassins'), id, 40 from players where name='Lamar Jackson';
-- Tritons wins Henry ($20) and Chase ($25) this cycle -> 17 players, $205
insert into bid_weeks (id, season, week, bids_close_at) values (9, 2026, 9, now() + interval '1 day');
insert into bids (bid_week_id, team_id, player_id, amount) values
 (9, pg_temp.tid('Tritons'), pg_temp.pid('Derrick Henry'), 20), (9, pg_temp.tid('Tritons'), pg_temp.pid('Ja''Marr Chase'), 25);
alter table bid_weeks disable trigger bid_week_guard;
update bid_weeks set bids_close_at = now() - interval '1 minute' where id = 9;
alter table bid_weeks enable trigger bid_week_guard;
select resolve_bid_week(9);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', false);
set role authenticated;
select 'P1 ' || claim_player(9, pg_temp.pid('Derrick Henry'));
select 'P2 ' || claim_player(9, pg_temp.pid('Ja''Marr Chase'));
reset role;
select 'P3 before: ' || string_agg(team||' '||active||'/$'||cap_used, ', ') from team_compliance(2026) where active > 0;
select 'P4 penalties issued (expect 2): ' || enforce_compliance_for(2026, 9, now() - interval '1 hour');
select 'P5 ' || t.name || ' forfeit wk' || week || ' dropped=' || coalesce((select string_agg(d->>'name', ',') from jsonb_array_elements(dropped) d), 'none')
  from penalties p join teams t on t.id = p.team_id order by t.name;
select 'P6 after: ' || string_agg(team||' '||active||'/$'||cap_used, ', ') from team_compliance(2026) where active > 0;
select 'P7 second run issues nothing (expect 0): ' || enforce_compliance_for(2026, 9, now() - interval '1 hour');
select 'P8 manager cannot run enforcement: ' || has_function_privilege('authenticated', 'public.enforce_compliance_for(int,int,timestamptz)', 'execute');
