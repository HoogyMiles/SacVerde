\set ON_ERROR_STOP 0
\pset tuples_only on
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n $$;
insert into roster_spots (season, team_id, player_id, salary)
 select 2026, pg_temp.tid('Tritons'), p.id, case when row_number() over () = 1 then 132 else 2 end
   from players p where p.pos='WR' and p.nfl_team in ('KC','LV','LAC','NYG') limit 15;
-- two adds this cycle: Jordan Love (GB, played Thu 10/29 = locked) and Josh Allen (BUF, plays Sunday)
insert into roster_spots (season, team_id, player_id, salary, acquired_via, acquired_week) values
 (2026, pg_temp.tid('Tritons'), pg_temp.pid('Jordan Love'), 10, 'fa_bid', 8),
 (2026, pg_temp.tid('Tritons'), pg_temp.pid('Josh Allen'), 15, 'fa_bid', 8);
insert into transactions (season, week, kind, team_id, player_id, amount) values
 (2026, 8, 'add', pg_temp.tid('Tritons'), pg_temp.pid('Jordan Love'), 10),
 (2026, 8, 'add', pg_temp.tid('Tritons'), pg_temp.pid('Josh Allen'), 15);
select 'D1 penalties: ' || enforce_compliance_for(2026, 8, now() - interval '1 hour');
select 'D2 dropped now=' || (select string_agg(d->>'name', ',') from jsonb_array_elements(dropped) d)
    || ' | deferred=' || (select string_agg(d->>'name', ',') from jsonb_array_elements(pending) d) from penalties;
select 'D3 Love still on roster (locked): ' || exists(select 1 from roster_spots where player_id = pg_temp.pid('Jordan Love'));
select process_deferred_drops();
select 'D4 week 8 not over yet -> Love stays: ' || exists(select 1 from roster_spots where player_id = pg_temp.pid('Jordan Love'));
update penalties set week = 7;   -- simulate the week having ended
select process_deferred_drops();
select 'D5 after week ends -> Love dropped: ' || (not exists(select 1 from roster_spots where player_id = pg_temp.pid('Jordan Love')))
    || ' | pending cleared: ' || (pending = '[]') || ' | dropped list: ' || (select string_agg(d->>'name', ',') from jsonb_array_elements(dropped) d) from penalties;
