-- =====================================================================
-- SacVerde League — 021: live scoring from Sleeper stats (approved by Hoogs 2026-11-01)
-- Every minute while an NFL game is in progress, Supabase fetches Sleeper's weekly stats
-- (api.sleeper.com, the same feed sleeper.com uses), scores each player with the SacVerde
-- rules (rules doc scoring table + Defensive Dogos + K2point, fractional points) and stores it.
-- Matchup Center / My Team read player_week_stats and the lineups to show live team totals.
-- Yahoo stays official: final scores are still entered in Admin → Scores.
-- ADDITIVE ONLY (new tables/columns/functions). Safe to re-run. Run AFTER 020.
-- Needs the pg_net extension (created below if available).
-- =====================================================================

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  else
    raise notice 'pg_net not available here — live fetching disabled (scoring functions still work).';
  end if;
end $$;

-- ---------- player ↔ Sleeper link ----------
alter table public.players add column if not exists sleeper_id text;
create unique index if not exists players_sleeper_idx on public.players (sleeper_id) where sleeper_id is not null;

-- ---------- scoring rules (points per stat; editable by the commissioner) ----------
create table if not exists public.scoring_rules (
  stat    text primary key,
  label   text not null,
  points  numeric not null,
  applies text not null default 'player' check (applies in ('player','def','k')),
  sort    int not null default 0
);
alter table public.scoring_rules enable row level security;
drop policy if exists "members read" on public.scoring_rules;
create policy "members read" on public.scoring_rules for select to authenticated using (public.is_member());
grant select on public.scoring_rules to authenticated;

insert into public.scoring_rules (stat, label, points, applies, sort) values
  ('rush_yd',   'Rushing yards (1 per 10)',            0.1,  'player', 1),
  ('rec_yd',    'Receiving yards (1 per 10)',          0.1,  'player', 2),
  ('pass_yd',   'Passing yards (1 per 25)',            0.04, 'player', 3),
  ('rec',       'Reception',                           0.5,  'player', 4),
  ('pass_td',   'Passing TD',                          4,    'player', 5),
  ('rush_td',   'Rushing TD',                          6,    'player', 6),
  ('rec_td',    'Receiving TD',                        6,    'player', 7),
  ('fum_rec_td','Offensive fumble recovery TD',        6,    'player', 8),
  ('pass_int',  'Interception thrown',                -1,    'player', 9),
  ('fum_lost',  'Fumble lost',                        -1,    'player', 10),
  ('pass_2pt',  'Passing 2-pt conversion (K2point)',   2,    'player', 11),
  ('rush_2pt',  'Rushing 2-pt conversion',             2,    'player', 12),
  ('rec_2pt',   'Receiving 2-pt conversion',           2,    'player', 13),
  ('pr_td',     'Punt return TD',                      6,    'player', 14),
  ('kr_td',     'Kickoff return TD',                   6,    'player', 15),
  ('xpm',       'PAT made',                            1,    'k',      20),
  ('fgm_0_29',  'Field goal 0–29 yds',                 3,    'k',      21),
  ('fgm_30_39', 'Field goal 30–39 yds',                4,    'k',      22),
  ('fgm_40_49', 'Field goal 40–49 yds',                5,    'k',      23),
  ('fgm_50p',   'Field goal 50+ yds',                  6,    'k',      24),
  ('int',       'Defense: interception',               1,    'def',    30),
  ('fum_rec',   'Defense: fumble recovery',            1,    'def',    31),
  ('sack',      'Defense: sack',                       1,    'def',    32),
  ('def_td',    'Defense: INT / fumble return TD',     6,    'def',    33),
  ('def_st_td', 'Defense: punt/kick/blocked-kick return TD', 6, 'def', 34),
  ('safe',      'Defense: safety',                     2,    'def',    35),
  ('def_2pt',   'Defense: returned PAT',               2,    'def',    36),
  ('ya_lt200',  'Yards allowed under 200 (Defensive Dogos)', 10, 'def', 40),
  ('ya_200_299','Yards allowed 200–299',               7,    'def',    41),
  ('ya_300_399','Yards allowed 300–399',               3,    'def',    42),
  ('ya_400p',   'Yards allowed 400+',                  0,    'def',    43)
on conflict (stat) do nothing;

-- ---------- weekly stats + points ----------
create table if not exists public.player_week_stats (
  season      int  not null,
  week        int  not null,
  player_id   int  not null references public.players(id) on delete cascade,
  sleeper_id  text,
  stats       jsonb not null default '{}',
  points      numeric(7,2) not null default 0,
  game_id     text,
  updated_at  timestamptz,                 -- Sleeper's last change to this stat line
  fetched_at  timestamptz not null default now(),
  primary key (season, week, player_id)
);
create index if not exists pws_week_idx on public.player_week_stats (season, week);
alter table public.player_week_stats enable row level security;
drop policy if exists "members read" on public.player_week_stats;
create policy "members read" on public.player_week_stats for select to authenticated using (public.is_member());
grant select on public.player_week_stats to authenticated;

-- Sleeper rows we couldn't match to a SacVerde player (only ones that scored), for Admin → Live Scoring
create table if not exists public.sleeper_unmatched (
  season int not null, week int not null, sleeper_id text not null,
  name text, pos text, team text, points numeric(7,2),
  primary key (season, week, sleeper_id)
);
alter table public.sleeper_unmatched enable row level security;
drop policy if exists "commissioner read" on public.sleeper_unmatched;
create policy "commissioner read" on public.sleeper_unmatched for select to authenticated using (public.is_commissioner());
grant select on public.sleeper_unmatched to authenticated;

create table if not exists public.live_fetches (
  id           bigserial primary key,
  season       int not null,
  week         int not null,
  request_id   bigint,
  requested_at timestamptz not null default now(),
  done_at      timestamptz,
  status       text not null default 'pending',   -- pending | ok | error
  http_status  int,
  rows_scored  int,
  message      text
);
alter table public.live_fetches enable row level security;
drop policy if exists "members read" on public.live_fetches;
create policy "members read" on public.live_fetches for select to authenticated using (public.is_member());
grant select on public.live_fetches to authenticated;

-- ---------- scoring ----------
-- Points for one stat line. p_pos is the SacVerde position (QB/RB/WR/TE/K/DST).
create or replace function public.score_stats(p_stats jsonb, p_pos text) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare tot numeric := 0; r record; v numeric; ya numeric;
  f0 numeric; f50 numeric;
begin
  if p_stats is null then return 0; end if;
  for r in select stat, points, applies from public.scoring_rules loop
    if r.applies = 'player' and p_pos not in ('QB','RB','WR','TE','K') then continue; end if;
    if r.applies = 'def' and p_pos <> 'DST' then continue; end if;
    if r.applies = 'k' and p_pos = 'DST' then continue; end if;
    if r.stat like 'ya\_%' or r.stat in ('fgm_0_29','fgm_50p') then continue; end if;   -- handled below
    v := coalesce((p_stats->>r.stat)::numeric, 0);
    tot := tot + v * r.points;
  end loop;
  if p_pos <> 'DST' then
    -- field goals by distance; Sleeper splits 0-19 / 20-29 and gives 50+ either as fgm_50p or 50-59 + 60+
    f0  := coalesce((p_stats->>'fgm_0_19')::numeric, 0) + coalesce((p_stats->>'fgm_20_29')::numeric, 0);
    f50 := coalesce((p_stats->>'fgm_50p')::numeric,
                    coalesce((p_stats->>'fgm_50_59')::numeric, 0) + coalesce((p_stats->>'fgm_60p')::numeric, 0));
    tot := tot + f0 * coalesce((select points from public.scoring_rules where stat = 'fgm_0_29'), 0)
               + f50 * coalesce((select points from public.scoring_rules where stat = 'fgm_50p'), 0);
  else
    -- Defensive Dogos: points by total yards allowed (only once the defense's game has stats)
    if p_stats ? 'yds_allow' then
      ya := (p_stats->>'yds_allow')::numeric;
      tot := tot + coalesce((select points from public.scoring_rules where stat =
               case when ya < 200 then 'ya_lt200' when ya < 300 then 'ya_200_299' when ya < 400 then 'ya_300_399' else 'ya_400p' end), 0);
    end if;
  end if;
  return round(tot, 2);
end $$;

-- Name key for matching Sleeper players to the salary list: lowercase, no accents/punctuation/suffixes
create or replace function public.name_key(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(
           translate(lower(coalesce(p,'')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
           '[.''’`,-]', '', 'g'),
           '\s+(jr|sr|ii|iii|iv|v)$', ''),
           '\s+', ' ', 'g'))
$$;

-- Load one Sleeper weekly stats payload (array of rows). Returns how many SacVerde players were scored.
create or replace function public.ingest_sleeper(p_season int, p_week int, p_payload jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_sid text; v_pos text; v_spos text; v_team text; v_nm text; v_pid int; n int := 0; v_pts numeric;
begin
  if jsonb_typeof(p_payload) = 'object' then p_payload := (select jsonb_agg(v) from jsonb_each(p_payload) e(k, v)); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then raise exception 'Unexpected Sleeper payload'; end if;
  for r in select * from jsonb_array_elements(p_payload) loop
    v_sid  := r->>'player_id';
    v_spos := coalesce(r->'player'->>'position', '');
    v_team := coalesce(r->>'team', r->'player'->>'team');
    if v_spos not in ('QB','RB','WR','TE','K','DEF','FB') then continue; end if;
    v_pos  := case v_spos when 'DEF' then 'DST' when 'FB' then 'RB' else v_spos end;
    v_nm   := trim(coalesce(r->'player'->>'first_name','') || ' ' || coalesce(r->'player'->>'last_name',''));

    select id into v_pid from public.players where sleeper_id = v_sid;
    if v_pid is null then
      if v_pos = 'DST' then
        select id into v_pid from public.players where pos = 'DST' and nfl_team = v_sid and active and sleeper_id is null
         order by id limit 1;
      else
        -- unique name + position match (team breaks ties)
        select id into v_pid from (
          select p.id, count(*) over () c, (p.nfl_team = v_team) same_team
            from public.players p
           where p.active and p.sleeper_id is null and p.pos = v_pos and public.name_key(p.name) = public.name_key(v_nm)) x
         where c = 1 or same_team
         order by same_team desc limit 1;
      end if;
      if v_pid is not null then update public.players set sleeper_id = v_sid where id = v_pid; end if;
    end if;

    v_pts := public.score_stats(r->'stats', v_pos);
    if v_pid is null then
      if v_pts <> 0 then
        insert into public.sleeper_unmatched (season, week, sleeper_id, name, pos, team, points)
        values (p_season, p_week, v_sid, v_nm, v_pos, v_team, v_pts)
        on conflict (season, week, sleeper_id) do update set points = excluded.points, team = excluded.team;
      end if;
      continue;
    end if;
    delete from public.sleeper_unmatched where season = p_season and week = p_week and sleeper_id = v_sid;
    insert into public.player_week_stats (season, week, player_id, sleeper_id, stats, points, game_id, updated_at, fetched_at)
    values (p_season, p_week, v_pid, v_sid, coalesce(r->'stats', '{}'), v_pts, r->>'game_id',
            case when r ? 'updated_at' then to_timestamp((r->>'updated_at')::numeric / 1000) end, now())
    on conflict (season, week, player_id) do update
      set stats = excluded.stats, points = excluded.points, sleeper_id = excluded.sleeper_id,
          game_id = excluded.game_id, updated_at = excluded.updated_at, fetched_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- Re-score stored stats (after a scoring rule change or a manual link)
create or replace function public.rescore_week(p_season int, p_week int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.player_week_stats s set points = public.score_stats(s.stats, p.pos)
    from public.players p where p.id = s.player_id and s.season = p_season and s.week = p_week;
  get diagnostics n = row_count; return n;
end $$;

-- Live team totals: starters' points per team per week
create or replace view public.team_week_points with (security_invoker = true) as
  select l.season, l.week, l.team_id, round(sum(coalesce(s.points, 0)), 2) as points, count(s.player_id)::int as starters_with_stats
    from public.lineups l
    left join public.player_week_stats s on s.season = l.season and s.week = l.week and s.player_id = l.player_id
   group by l.season, l.week, l.team_id;
grant select on public.team_week_points to authenticated;

-- ---------- fetching (pg_net) ----------
create or replace function public.sleeper_url(p_season int, p_week int) returns text
language sql immutable as $$
  select format('https://api.sleeper.com/stats/nfl/%s/%s?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF', p_season, p_week)
$$;

create or replace function public.live_request(p_season int, p_week int) returns bigint
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return null; end if;
  execute 'select net.http_get(url := $1, timeout_milliseconds := 30000)' into rid using public.sleeper_url(p_season, p_week);
  insert into public.live_fetches (season, week, request_id) values (p_season, p_week, rid);
  return rid;
end $$;

-- Pick up finished responses, score them, then delete them (they're ~1-2 MB each)
create or replace function public.live_collect() returns int
language plpgsql security definer set search_path = public as $$
declare f record; st int; body text; err text; timed boolean; n int; done int := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return 0; end if;
  for f in select * from public.live_fetches where status = 'pending' order by id loop
    st := null; body := null; err := null; timed := null;
    execute 'select status_code, content, error_msg, timed_out from net._http_response where id = $1'
       into st, body, err, timed using f.request_id;
    if st is null and err is null and timed is null then
      if f.requested_at < now() - interval '10 minutes' then
        update public.live_fetches set status = 'error', done_at = now(), message = 'no response' where id = f.id;
      end if;
      continue;
    end if;
    begin
      if st between 200 and 299 then
        n := public.ingest_sleeper(f.season, f.week, body::jsonb);
        update public.live_fetches set status = 'ok', done_at = now(), http_status = st, rows_scored = n where id = f.id;
      else
        update public.live_fetches set status = 'error', done_at = now(), http_status = st,
               message = left(coalesce(err, case when timed then 'timed out' end, body), 300) where id = f.id;
      end if;
    exception when others then
      update public.live_fetches set status = 'error', done_at = now(), http_status = st, message = left(sqlerrm, 300) where id = f.id;
    end;
    execute 'delete from net._http_response where id = $1' using f.request_id;
    done := done + 1;
  end loop;
  delete from public.live_fetches where requested_at < now() - interval '14 days';
  return done;
end $$;

-- Every minute (pg_cron): collect results; fetch the current week every minute while a game is on,
-- every 30 min for 2 days after the week's games (stat corrections), and last week every 6 hours
-- until 4 days after its last game.
create or replace function public.live_tick() returns void
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int; live boolean; recent boolean; last_req timestamptz; prev_last timestamptz;
begin
  if yr is null then return; end if;
  perform public.live_collect();
  -- pg_cron logs every run; keep a week of history so the once-a-minute job doesn't bloat the free database
  if extract(minute from now()) = 7 then
    begin
      execute $q$delete from cron.job_run_details where end_time < now() - interval '7 days'$q$;
    exception when others then null;
    end;
  end if;
  wk := public.league_week(yr);
  select bool_or(kickoff_at <= now() and kickoff_at > now() - interval '4 hours 30 minutes'),
         bool_or(kickoff_at <= now() and kickoff_at > now() - interval '2 days')
    into live, recent
    from public.nfl_games where season = yr and week = wk;
  select max(requested_at) into last_req from public.live_fetches where season = yr and week = wk;
  if coalesce(live, false) then
    if last_req is null or last_req < now() - interval '50 seconds' then perform public.live_request(yr, wk); end if;
  elsif coalesce(recent, false) then
    if last_req is null or last_req < now() - interval '30 minutes' then perform public.live_request(yr, wk); end if;
  end if;
  -- last week's corrections
  select max(kickoff_at) into prev_last from public.nfl_games where season = yr and week = wk - 1;
  if prev_last is not null and now() < prev_last + interval '4 days' then
    select max(requested_at) into last_req from public.live_fetches where season = yr and week = wk - 1;
    if last_req is null or last_req < now() - interval '6 hours' then perform public.live_request(yr, wk - 1); end if;
  end if;
end $$;

-- ---------- commissioner tools ----------
create or replace function public.admin_live_fetch(p_week int default null) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int := coalesce(p_week, public.league_week(public.current_season())); rid bigint;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  rid := public.live_request(yr, wk);
  if rid is null then raise exception 'Live fetching isn''t switched on (pg_net extension missing).'; end if;
  return format('Fetching week %s stats from Sleeper. Points update within a minute.', wk);
end $$;

create or replace function public.admin_link_sleeper(p_player int, p_sleeper_id text) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); nm text;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  update public.players set sleeper_id = null where sleeper_id = p_sleeper_id and id <> p_player;
  update public.players set sleeper_id = nullif(trim(p_sleeper_id), '') where id = p_player returning name into nm;
  if nm is null then raise exception 'Player not found.'; end if;
  delete from public.sleeper_unmatched where season = yr and sleeper_id = p_sleeper_id;
  return format('%s linked to Sleeper id %s. Points appear on the next fetch.', nm, p_sleeper_id);
end $$;

create or replace function public.admin_set_scoring_rule(p_stat text, p_points numeric) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int := public.league_week(public.current_season());
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  update public.scoring_rules set points = p_points where stat = p_stat;
  if not found then raise exception 'Unknown scoring rule %.', p_stat; end if;
  perform public.rescore_week(yr, wk);
  return format('%s now worth %s. Week %s re-scored.', p_stat, p_points, wk);
end $$;

revoke execute on function public.ingest_sleeper(int,int,jsonb), public.rescore_week(int,int), public.live_request(int,int),
  public.live_collect(), public.live_tick() from public, anon, authenticated;
grant execute on function public.score_stats(jsonb,text), public.admin_live_fetch(int), public.admin_link_sleeper(int,text),
  public.admin_set_scoring_rule(text,numeric) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sacverde-live';
    perform cron.schedule('sacverde-live', '* * * * *', 'select public.live_tick()');
  else
    raise notice 'pg_cron not available here — live scoring not scheduled.';
  end if;
end $$;
