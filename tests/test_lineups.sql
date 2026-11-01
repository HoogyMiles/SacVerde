-- LOCAL TEST of 020 (lineups) on the imported 2026 rosters. Prints PASS/FAIL lines.
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','chrisbadley@live.com'),
 ('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com') on conflict do nothing;
update league_members m set user_id = u.id from auth.users u where lower(u.email) = m.email and m.user_id is null;
create function pg_temp.as_user(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n)::text, false) $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n and active $$;
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
create function pg_temp.at(t text, s text, w int default null) returns text language sql as $$
  select p.name from lineups l join players p on p.id = l.player_id
   where l.season = 2026 and l.week = coalesce(w, league_week(2026)) and l.team_id = pg_temp.tid(t) and l.slot = s $$;
create function pg_temp.ok(label text, cond boolean) returns text language sql as $$
  select case when coalesce(cond,false) then 'PASS ' else 'FAIL ' end || label $$;
-- Tries a call as the current role; returns the error text (or 'no error')
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'no error'; exception when others then return sqlerrm; end $$;

select 'league week: ' || league_week(2026);
select pg_temp.ok('L1 every team has a full 9-slot lineup after 020', (select bool_and(filled = 9) from lineup_status(2026, null)));
select pg_temp.ok('L1b Roaring Hoogy autofill skips bye-week McCaffrey for RB', pg_temp.at('Roaring Hoogy','RB1') = 'Bijan Robinson' and pg_temp.at('Roaring Hoogy','RB2') = 'J.K. Dobbins');

-- ===== manager moves (Roaring Hoogy) =====
select pg_temp.as_user(1); set role authenticated;
select pg_temp.ok('L2 bench player into FLEX', set_lineup_slot('FLEX', pg_temp.pid('Keenan Allen')) like 'Keenan Allen is in your FLEX%');
select pg_temp.ok('L2b old FLEX (Jack Bech) went to the bench', not exists (select 1 from lineups where week = league_week(2026) and player_id = pg_temp.pid('Jack Bech')));
select set_lineup_slot('WR2', pg_temp.pid('Keenan Allen'));   -- FLEX Allen ↔ WR2 Egbuka
select pg_temp.ok('L3 swap: Allen to WR2, Egbuka to FLEX', pg_temp.at('Roaring Hoogy','WR2') = 'Keenan Allen' and pg_temp.at('Roaring Hoogy','FLEX') = 'Emeka Egbuka');
select set_lineup_slot('RB2', pg_temp.pid('Bijan Robinson'));  -- RB1 ↔ RB2
select pg_temp.ok('L3b RB1/RB2 swap keeps both', pg_temp.at('Roaring Hoogy','RB2') = 'Bijan Robinson' and pg_temp.at('Roaring Hoogy','RB1') = 'J.K. Dobbins');
select pg_temp.ok('L4 RB can''t play QB', pg_temp.err($q$select set_lineup_slot('QB', pg_temp.pid('Bijan Robinson'))$q$) like '%can''t play the QB slot%');
select pg_temp.ok('L4b QB can''t play FLEX', pg_temp.err($q$select set_lineup_slot('FLEX', pg_temp.pid('Kirk Cousins'))$q$) like '%can''t play the FLEX slot%');
select pg_temp.ok('L5 taxi player can''t start', pg_temp.err($q$select set_lineup_slot('RB1', pg_temp.pid('Jonah Coleman'))$q$) like 'Only players on your active roster%');
select pg_temp.ok('L5b IR player can''t start', pg_temp.err($q$select set_lineup_slot('TE', pg_temp.pid('Chig Okonkwo'))$q$) like 'Only players on your active roster%');
select pg_temp.ok('L5c another team''s player can''t start', pg_temp.err($q$select set_lineup_slot('QB', (select player_id from roster_spots where team_id = pg_temp.tid('Pool Boy') and status='active' and player_id in (select id from players where pos='QB') limit 1))$q$) like 'Only players on your active roster%');
select pg_temp.ok('L6 no direct writes to the lineups table', pg_temp.err($q$insert into lineups (season, week, team_id, slot, player_id) values (2026, 8, 1, 'K', 1)$q$) like '%permission denied%');
reset role;

-- ===== kickoff locks (simulate Seattle's game having started) =====
update nfl_games set kickoff_at = now() - interval '1 hour' where season = 2026 and week = league_week(2026) and 'SEA' in (home, away);
select pg_temp.as_user(1); set role authenticated;
select pg_temp.ok('L7 locked starter can''t be benched', pg_temp.err($q$select set_lineup_slot('K', null)$q$) like '%game has kicked off%');
select pg_temp.ok('L7b locked starter can''t be replaced', pg_temp.err($q$select set_lineup_slot('WR1', pg_temp.pid('Jack Bech'))$q$) like '%game has kicked off%');
select pg_temp.ok('L7c locked player can''t be moved into a slot', pg_temp.err($q$select set_lineup_slot('FLEX', pg_temp.pid('Jaxon Smith-Njigba'))$q$) like '%game has kicked off%');
-- empty a slot (unlocked)
select pg_temp.ok('L8 bench a starter leaves the slot empty', set_lineup_slot('FLEX', null) like 'Emeka Egbuka moved to the bench%');
select pg_temp.ok('L8b lineup_status shows FLEX empty', (select empty from lineup_status(2026, null) where team = 'Roaring Hoogy') = array['FLEX']);
select set_lineup_slot('FLEX', pg_temp.pid('Emeka Egbuka'));
-- IR / drop clear slots
select place_on_ir(pg_temp.pid('Jayden Daniels'));
select pg_temp.ok('L9 IR move clears his QB slot', pg_temp.at('Roaring Hoogy','QB') is null);
select drop_player(pg_temp.pid('J.K. Dobbins'));
select pg_temp.ok('L10 drop clears his RB1 slot', pg_temp.at('Roaring Hoogy','RB1') is null);
select set_lineup_slot('QB', pg_temp.pid('Kirk Cousins'));
-- commissioner moves a LOCKED starter to another team: he stays in this week's lineup (his points count)
select admin_set_roster(pg_temp.pid('Jaxon Smith-Njigba'), pg_temp.tid('Pool Boy'));
select pg_temp.ok('L11 locked starter stays in the lineup after a roster move', pg_temp.at('Roaring Hoogy','WR1') = 'Jaxon Smith-Njigba');
select admin_set_roster(pg_temp.pid('Jaxon Smith-Njigba'), pg_temp.tid('Roaring Hoogy'));
-- commissioner override
select pg_temp.ok('L12 commissioner can set a slot even when locked', admin_set_lineup(pg_temp.tid('Roaring Hoogy'), league_week(2026), 'K', pg_temp.pid('Jason Myers')) like 'Jason Myers set at K%');
select pg_temp.ok('L12b commissioner can''t start a player from a different team', pg_temp.err($q$select admin_set_lineup(pg_temp.tid('Roaring Hoogy'), league_week(2026), 'K', (select player_id from roster_spots r join players p on p.id=r.player_id where p.pos='K' and r.team_id = pg_temp.tid('Pool Boy') limit 1))$q$) like '%not on that team''s roster%');
reset role;
select pg_temp.as_user(2); set role authenticated;   -- Purple Reign
select pg_temp.ok('L13 managers can see every team''s lineup', (select count(distinct team_id) from lineups where week = league_week(2026)) = 12);
select pg_temp.ok('L13b manager can''t use commissioner lineup tools', pg_temp.err($q$select admin_set_lineup(1, 8, 'K', 1)$q$) = 'Commissioner only.');
select pg_temp.ok('L13c manager can''t run autofill', pg_temp.err($q$select admin_autofill_lineups()$q$) = 'Commissioner only.');
reset role;
update nfl_games set kickoff_at = kickoff_at + interval '1 day' where season = 2026 and week = league_week(2026) and 'SEA' in (home, away);

-- ===== carryover into next week =====
select ensure_lineups(2026, league_week(2026) + 1);
select pg_temp.ok('L14 next week copies this week''s lineup', (select count(*) from lineups where week = league_week(2026)+1 and team_id = pg_temp.tid('Roaring Hoogy'))
   = (select count(*) from lineups l where week = league_week(2026) and team_id = pg_temp.tid('Roaring Hoogy')
       and exists (select 1 from roster_spots r where r.player_id = l.player_id and r.team_id = l.team_id and r.status = 'active')));
select pg_temp.ok('L14b carryover keeps the same players in the same slots', pg_temp.at('Roaring Hoogy','WR2', league_week(2026)+1) = 'Keenan Allen');
select pg_temp.ok('L14c running carryover again changes nothing', ensure_lineups(2026, league_week(2026) + 1) = 0);
-- a drop now also clears next week's copy
select pg_temp.as_user(1); set role authenticated;
select drop_player(pg_temp.pid('Keenan Allen'));
reset role;
select pg_temp.ok('L14d drop clears the player from next week too', pg_temp.at('Roaring Hoogy','WR2', league_week(2026)+1) is null);

-- ===== penalty: invalid lineup = automatic loss, no forced drops =====
select 'Hoogy empty slots: ' || array_to_string(empty, ',') from lineup_status(2026, null) where team = 'Roaring Hoogy';
select enforce_compliance_for(2026, league_week(2026), '-infinity');
select pg_temp.ok('L15 empty lineup → automatic loss with reason lineup', (select reason from penalties where week = league_week(2026) and team_id = pg_temp.tid('Roaring Hoogy')) = 'lineup');
select pg_temp.ok('L15b lineup-only penalty drops nobody', (select dropped = '[]'::jsonb and pending = '[]'::jsonb from penalties where week = league_week(2026) and team_id = pg_temp.tid('Roaring Hoogy')));
select pg_temp.ok('L15c penalty lists the empty slots', (select lineup_empty from penalties where week = league_week(2026) and team_id = pg_temp.tid('Roaring Hoogy')) = '["RB1","WR2"]'::jsonb);
select pg_temp.ok('L15d alert explains the lineup penalty', (select body from notifications where team_id = pg_temp.tid('Roaring Hoogy') and kind = 'penalty') like 'Your starting lineup had empty slots (RB1, WR2)%');
select pg_temp.ok('L16 Steel Curtain (over cap/roster) still gets the cap/roster penalty', (select reason from penalties where week = league_week(2026) and team_id = pg_temp.tid('Steel Curtain')) like 'cap_roster%');
select pg_temp.ok('L17 valid teams get no penalty', (select count(*) from penalties where week = league_week(2026)) = 2);
