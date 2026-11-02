-- LOCAL TEST of 021 (live scoring). Prints PASS/FAIL lines. Stat lines are real week 8 2026 values where noted.
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','chrisbadley@live.com') on conflict do nothing;
update league_members m set user_id = u.id from auth.users u where lower(u.email) = m.email and m.user_id is null;
create function pg_temp.as_user(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n)::text, false) $$;
create function pg_temp.ok(label text, cond boolean) returns text language sql as $$
  select case when coalesce(cond,false) then 'PASS ' else 'FAIL ' end || label $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'no error'; exception when others then return sqlerrm; end $$;
create function pg_temp.pts(n text) returns numeric language sql as $$
  select s.points from player_week_stats s join players p on p.id = s.player_id where p.name = n and s.season = 2026 and s.week = 8 $$;

-- ===== scoring math (rules doc table + Defensive Dogos + K2point, fractional) =====
select pg_temp.ok('S1 QB: Mahomes 321 pass yd, 3 TD, 6 rush yd = 25.44', score_stats('{"pass_yd":321,"pass_td":3,"rush_yd":6,"pass_att":41}', 'QB') = 25.44);
select pg_temp.ok('S2 QB: Nix 222 yd, 2 TD, 4 rush, passing 2-pt counts 2 (K2point) = 19.28', score_stats('{"pass_yd":222,"pass_td":2,"rush_yd":4,"pass_2pt":1}', 'QB') = 19.28);
select pg_temp.ok('S3 WR: 6 rec, 87 yd, 1 TD, 1 fumble lost = 16.70', score_stats('{"rec":6,"rec_yd":87,"rec_td":1,"fum_lost":1}', 'WR') = 16.70);
select pg_temp.ok('S4 QB: interception -1, negative rush yards count', score_stats('{"pass_yd":100,"pass_int":2,"rush_yd":-3}', 'QB') = 1.70);
select pg_temp.ok('S5 K: 3 PAT + FG 25 + FG 45 + FG 55 = 17', score_stats('{"xpm":3,"fgm_20_29":1,"fgm_40_49":1,"fgm_50_59":1}', 'K') = 17);
select pg_temp.ok('S5b K: 50+ not double counted when Sleeper sends fgm_50p and fgm_50_59', score_stats('{"fgm_50p":1,"fgm_50_59":1}', 'K') = 6);
select pg_temp.ok('S5c K: 0-19 and 20-29 both worth 3, 30-39 worth 4, misses worth 0', score_stats('{"fgm_0_19":1,"fgm_20_29":1,"fgm_30_39":1,"fgmiss":2,"xpmiss":1}', 'K') = 10);
select pg_temp.ok('S6 DEF: Denver 399 yds allowed, 3 sacks, INT, fum rec, def TD = 14', score_stats('{"yds_allow":399,"sack":3,"int":1,"fum_rec":1,"def_td":1}', 'DST') = 14);
select pg_temp.ok('S7 DEF brackets: -5 → 10, 199 → 10, 200 → 7, 299 → 7, 300 → 3, 400 → 0',
  score_stats('{"yds_allow":-5}','DST') = 10 and score_stats('{"yds_allow":199}','DST') = 10 and score_stats('{"yds_allow":200}','DST') = 7
  and score_stats('{"yds_allow":299}','DST') = 7 and score_stats('{"yds_allow":300}','DST') = 3 and score_stats('{"yds_allow":400}','DST') = 0);
select pg_temp.ok('S8 DEF: safety 2, return TD 6, returned PAT 2; no yards line yet → no bracket points', score_stats('{"safe":1,"def_st_td":1,"def_2pt":1}','DST') = 10);
select pg_temp.ok('S9 offensive stats on a DEF row don''t count, defense stats on a player don''t count',
  score_stats('{"rec":5,"yds_allow":450}','DST') = 0 and score_stats('{"sack":2,"int":1}','WR') = 0);
select pg_temp.ok('S10 return TDs and 2-pt by rusher/receiver', score_stats('{"kr_td":1,"rush_2pt":1,"rec_2pt":1}','RB') = 10);

-- ===== ingest a Sleeper payload (same shape as api.sleeper.com) =====
insert into players (name, pos, nfl_team) values ('Josh Allen', 'WR', 'KC');   -- not a real conflict: different position
select ingest_sleeper(2026, 8, $j$[
 {"player_id":"4046","team":"KC","game_id":"g1","updated_at":1793407353000,"stats":{"pass_yd":321,"pass_td":3,"rush_yd":6},"player":{"first_name":"Patrick","last_name":"Mahomes","position":"QB","team":"KC"}},
 {"player_id":"5848","team":"PHI","stats":{"rec":5,"rec_yd":64},"player":{"first_name":"A.J.","last_name":"Brown","position":"WR","team":"PHI"}},
 {"player_id":"7547","team":"DET","stats":{"rec":8,"rec_yd":102,"rec_td":1},"player":{"first_name":"Amon-Ra","last_name":"St. Brown","position":"WR","team":"DET"}},
 {"player_id":"9493","team":"JAX","stats":{"rec":3,"rec_yd":40},"player":{"first_name":"Brian","last_name":"Thomas","position":"WR","team":"JAX"}},
 {"player_id":"5872","team":"SF","stats":{"rush_yd":20},"player":{"first_name":"Deebo","last_name":"Samuel","position":"WR","team":"SF"}},
 {"player_id":"4984","team":"BUF","stats":{"pass_yd":289,"pass_td":2},"player":{"first_name":"Josh","last_name":"Allen","position":"QB","team":"BUF"}},
 {"player_id":"DEN","team":"DEN","stats":{"yds_allow":399,"sack":3,"int":1,"fum_rec":1,"def_td":1},"player":{"first_name":"Denver","last_name":"Broncos","position":"DEF","team":"DEN"}},
 {"player_id":"99999","team":"KC","stats":{"rec":2,"rec_yd":15},"player":{"first_name":"Nobody","last_name":"Onthelist","position":"WR","team":"KC"}},
 {"player_id":"88888","team":"KC","stats":{"tkl":5},"player":{"first_name":"Some","last_name":"Linebacker","position":"LB","team":"KC"}},
 {"player_id":"77777","team":"KC","stats":{"gms_active":1},"player":{"first_name":"Zero","last_name":"Points","position":"WR","team":"KC"}}
]$j$::jsonb);
select pg_temp.ok('I1 Mahomes scored 25.44 and linked to his Sleeper id', pg_temp.pts('Patrick Mahomes') = 25.44 and (select sleeper_id from players where name='Patrick Mahomes') = '4046');
select pg_temp.ok('I2 punctuation in names matches (A.J. Brown, Amon-Ra St. Brown)', pg_temp.pts('A.J. Brown') = 8.90 and pg_temp.pts('Amon-Ra St. Brown') = 20.20);
select pg_temp.ok('I3 Jr./Sr. suffixes match (Brian Thomas Jr., Deebo Samuel Sr.)', pg_temp.pts('Brian Thomas Jr.') = 5.50 and pg_temp.pts('Deebo Samuel Sr.') = 2.00);
select pg_temp.ok('I4 same name, different position doesn''t cross-match (Josh Allen QB vs a WR)', (select pos from players where sleeper_id = '4984') = 'QB');
select pg_temp.ok('I5 defense matched by team (Denver Broncos DST = 14)', (select s.points from player_week_stats s join players p on p.id=s.player_id where p.pos='DST' and p.nfl_team='DEN' and s.week=8) = 14);
select pg_temp.ok('I6 unknown scorer goes to the unmatched list', exists (select 1 from sleeper_unmatched where sleeper_id='99999' and points = 2.50));
select pg_temp.ok('I7 IDP and zero-point unknowns are ignored', not exists (select 1 from sleeper_unmatched where sleeper_id in ('88888','77777')));
select pg_temp.ok('I8 Sleeper update time is kept', (select updated_at from player_week_stats s join players p on p.id=s.player_id where p.name='Patrick Mahomes') = to_timestamp(1793407353));
-- a second pull with new numbers updates in place (live)
select ingest_sleeper(2026, 8, '[{"player_id":"4046","team":"KC","stats":{"pass_yd":350,"pass_td":4,"rush_yd":6},"player":{"first_name":"Patrick","last_name":"Mahomes","position":"QB","team":"KC"}}]');
select pg_temp.ok('I9 next pull updates the same row (350 yd, 4 TD = 30.60)', pg_temp.pts('Patrick Mahomes') = 30.60 and (select count(*) from player_week_stats where season=2026 and week=8 and sleeper_id='4046') = 1);
select pg_temp.ok('I10 object-shaped payload (keyed by id) also accepted', ingest_sleeper(2026, 8, '{"4046":{"player_id":"4046","team":"KC","stats":{"pass_yd":350,"pass_td":4,"rush_yd":6},"player":{"first_name":"Patrick","last_name":"Mahomes","position":"QB","team":"KC"}}}') = 1);
select pg_temp.ok('I11 garbage payload is rejected', pg_temp.err($q$select ingest_sleeper(2026, 8, '"oops"')$q$) like 'Unexpected Sleeper payload%');

-- ===== team totals from lineups =====
delete from lineups where season=2026 and week=8 and team_id=(select id from teams where name='Roaring Hoogy');
insert into lineups (season, week, team_id, slot, player_id)
select 2026, 8, (select id from teams where name='Roaring Hoogy'), 'QB', id from players where name='Patrick Mahomes'
union all select 2026, 8, (select id from teams where name='Roaring Hoogy'), 'WR1', id from players where name='Amon-Ra St. Brown'
union all select 2026, 8, (select id from teams where name='Roaring Hoogy'), 'DST', id from players where pos='DST' and nfl_team='DEN';
select pg_temp.ok('T1 team total = starters only (30.60 + 20.20 + 14 = 64.80)', (select points from team_week_points where season=2026 and week=8 and team_id=(select id from teams where name='Roaring Hoogy')) = 64.80);

-- ===== permissions + commissioner tools =====
select pg_temp.as_user(2); set role authenticated;
select pg_temp.ok('P1 managers can read player points and team totals', (select count(*) from player_week_stats) > 0 and (select count(*) from team_week_points) > 0);
select pg_temp.ok('P2 managers can''t see the unmatched list', (select count(*) from sleeper_unmatched) = 0);
select pg_temp.ok('P3 managers can''t load stats', pg_temp.err($q$select ingest_sleeper(2026, 8, '[]')$q$) like '%permission denied%');
select pg_temp.ok('P4 managers can''t change scoring', pg_temp.err($q$select admin_set_scoring_rule('rec', 1)$q$) = 'Commissioner only.');
select pg_temp.ok('P5 managers can''t link players', pg_temp.err($q$select admin_link_sleeper(1, '99999')$q$) = 'Commissioner only.');
select pg_temp.ok('P6 managers can''t write stats directly', pg_temp.err($q$update player_week_stats set points = 99$q$) like '%permission denied%');
reset role;
select pg_temp.as_user(1); set role authenticated;
select pg_temp.ok('C1 commissioner links an unmatched player', admin_link_sleeper((select id from players where name='Keenan Allen'), '99999') like 'Keenan Allen linked%');
select pg_temp.ok('C1b linked player leaves the unmatched list', not exists (select 1 from sleeper_unmatched where sleeper_id='99999'));
select pg_temp.ok('C2 commissioner changes a rule (reception 0.5 → 1) and the week re-scores', admin_set_scoring_rule('rec', 1) like 'rec now worth 1%' and pg_temp.pts('Amon-Ra St. Brown') = 24.20);
select admin_set_scoring_rule('rec', 0.5);
select pg_temp.ok('C3 fetch-now explains when pg_net is missing', pg_temp.err($q$select admin_live_fetch()$q$) like 'Live fetching isn''t switched on%');
reset role;
select ingest_sleeper(2026, 8, '[{"player_id":"99999","team":"KC","stats":{"rec":2,"rec_yd":15},"player":{"first_name":"Nobody","last_name":"Onthelist","position":"WR","team":"KC"}}]');
select pg_temp.ok('C4 linked player scores on the next pull', pg_temp.pts('Keenan Allen') = 2.50);
select pg_temp.ok('C5 live_tick runs without pg_net (no-op locally)', pg_temp.err('select live_tick()') = 'no error');
