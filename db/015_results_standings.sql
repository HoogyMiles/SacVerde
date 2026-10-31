-- =====================================================================
-- SacVerde League — 015: full 2026 schedule, weekly results entry, standings computed automatically
-- Standings tiebreakers (constitution XI-D): overall record -> head-to-head among tied teams
--   -> division record -> total points. Week 0 (preseason order) is kept as imported.
-- Run AFTER 014. Safe to re-run.
-- =====================================================================
-- weeks 8-14 (no scores yet)
insert into public.matchups (season, week, home_team, away_team)
select 2026, v.wk, h.id, a.id from (values
 (8,'Rhin-Owned','Assassins'),
 (8,'Roaring Hoogy','Alligator Arms'),
 (8,'Pool Boy','3 Nuggles'),
 (8,'K2''s Kings','da bombers'),
 (8,'Juggernauts','Milky Wet Hogs'),
 (8,'Purple Reign','Steel Curtain'),
 (9,'Rhin-Owned','da bombers'),
 (9,'3 Nuggles','Assassins'),
 (9,'Purple Reign','Alligator Arms'),
 (9,'Pool Boy','Milky Wet Hogs'),
 (9,'Roaring Hoogy','Juggernauts'),
 (9,'K2''s Kings','Steel Curtain'),
 (10,'Rhin-Owned','Pool Boy'),
 (10,'3 Nuggles','Juggernauts'),
 (10,'Purple Reign','da bombers'),
 (10,'K2''s Kings','Assassins'),
 (10,'Steel Curtain','Roaring Hoogy'),
 (10,'Alligator Arms','Milky Wet Hogs'),
 (11,'Rhin-Owned','Alligator Arms'),
 (11,'3 Nuggles','Steel Curtain'),
 (11,'Purple Reign','Milky Wet Hogs'),
 (11,'Pool Boy','da bombers'),
 (11,'Roaring Hoogy','K2''s Kings'),
 (11,'Assassins','Juggernauts'),
 (12,'Rhin-Owned','Purple Reign'),
 (12,'3 Nuggles','K2''s Kings'),
 (12,'Pool Boy','Alligator Arms'),
 (12,'Steel Curtain','Juggernauts'),
 (12,'Assassins','Roaring Hoogy'),
 (12,'da bombers','Milky Wet Hogs'),
 (13,'Rhin-Owned','Milky Wet Hogs'),
 (13,'3 Nuggles','Roaring Hoogy'),
 (13,'Alligator Arms','da bombers'),
 (13,'K2''s Kings','Juggernauts'),
 (13,'Purple Reign','Pool Boy'),
 (13,'Steel Curtain','Assassins'),
 (14,'da bombers','Steel Curtain'),
 (14,'Milky Wet Hogs','Assassins'),
 (14,'Alligator Arms','3 Nuggles'),
 (14,'Juggernauts','K2''s Kings'),
 (14,'Rhin-Owned','Roaring Hoogy'),
 (14,'Purple Reign','Pool Boy')
) v(wk, home, away) join public.teams h on h.name = v.home join public.teams a on a.name = v.away
on conflict (season, week, home_team) do update set away_team = excluded.away_team;

-- standings after week p_week, written to public.standings
create or replace function public.compute_standings(p_season int, p_week int) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.standings where season = p_season and week = p_week;
  insert into public.standings (season, week, team_id, rank, wins, losses, ties, pf, pa)
  with g as (
    select m.home_team me, m.away_team op, m.home_pts ms, m.away_pts os from public.matchups m
     where m.season = p_season and m.week between 1 and p_week and not m.playoff and m.home_pts is not null and m.away_pts is not null
    union all
    select m.away_team, m.home_team, m.away_pts, m.home_pts from public.matchups m
     where m.season = p_season and m.week between 1 and p_week and not m.playoff and m.home_pts is not null and m.away_pts is not null),
  r as (
    select g.*, (case when ms > os then 1 when ms = os then 0.5 else 0 end) pts_w,
           (tm.division_id = to_.division_id) same_div
      from g join public.teams tm on tm.id = g.me join public.teams to_ on to_.id = g.op),
  base as (
    select t.id team_id,
           count(r.me) gp,
           count(*) filter (where r.ms > r.os) w, count(*) filter (where r.ms < r.os) l, count(*) filter (where r.ms = r.os) tie,
           coalesce(sum(r.pts_w),0) wp, coalesce(sum(r.ms),0) pf, coalesce(sum(r.os),0) pa,
           coalesce(sum(r.pts_w) filter (where r.same_div),0) dwp, count(*) filter (where r.same_div) dgp
      from public.teams t left join r on r.me = t.id group by t.id),
  b2 as (select *, case when gp > 0 then wp / gp else 0 end pct, case when dgp > 0 then dwp / dgp else 0 end dpct from base),
  h2h as (   -- head-to-head among teams with the same winning percentage
    select x.team_id, case when count(r.me) > 0 then sum(r.pts_w) / count(r.me) else 0 end hpct
      from b2 x left join r on r.me = x.team_id and r.op in (select y.team_id from b2 y where y.pct = x.pct and y.team_id <> x.team_id)
     group by x.team_id)
  select p_season, p_week, b2.team_id,
         row_number() over (order by b2.pct desc, h2h.hpct desc, b2.dpct desc, b2.pf desc, b2.team_id),
         b2.w, b2.l, b2.tie, round(b2.pf, 2), round(b2.pa, 2)
    from b2 join h2h using (team_id);
end $$;

-- recompute every week that has all of its games scored (and clear weeks that don't)
create or replace function public.recompute_standings(p_season int) returns int
language plpgsql security definer set search_path = public as $$
declare wk int; last_done int := 0;
begin
  for wk in select distinct week from public.matchups where season = p_season and not playoff and week >= 1 order by 1 loop
    if exists (select 1 from public.matchups where season = p_season and week = wk and not playoff and (home_pts is null or away_pts is null)) then
      delete from public.standings where season = p_season and week >= wk and week >= 1;
      exit;
    end if;
    perform public.compute_standings(p_season, wk); last_done := wk;
  end loop;
  return last_done;
end $$;

-- commissioner enters (or corrects) one game's final score
create or replace function public.set_score(p_matchup int, p_home numeric, p_away numeric) returns text
language plpgsql security definer set search_path = public as $$
declare m public.matchups; done int;
begin
  if not public.is_commissioner() then raise exception 'Only the commissioner can enter scores.'; end if;
  if p_home < 0 or p_away < 0 then raise exception 'Scores can''t be negative.'; end if;
  update public.matchups set home_pts = p_home, away_pts = p_away where id = p_matchup returning * into m;
  if m is null then raise exception 'Game not found.'; end if;
  insert into public.transactions (season, week, kind, details)
  values (m.season, m.week, 'score_entry', jsonb_build_object('matchup', m.id, 'home', m.home_team, 'away', m.away_team, 'home_pts', p_home, 'away_pts', p_away));
  done := public.recompute_standings(m.season);
  return case when done >= m.week then format('Week %s complete — standings updated through week %s.', m.week, done)
              else format('Score saved. Standings update once all week %s games are entered.', m.week) end;
end $$;

revoke execute on function public.compute_standings(int,int), public.recompute_standings(int) from public, anon, authenticated;
grant execute on function public.set_score(int,numeric,numeric) to authenticated;

select public.recompute_standings(2026) as standings_complete_through_week;
