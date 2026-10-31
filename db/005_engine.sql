-- =====================================================================
-- SacVerde League — 005: bidding engine, claims, drops
-- Run AFTER 004. Safe to re-run (replaces functions).
-- =====================================================================

-- When was a team's priority/open window. Stored per bidder at reveal.
alter table public.bid_results add column if not exists open_from  timestamptz;  -- any bidder may add after this
alter table public.bid_results add column if not exists kickoff_at timestamptz;  -- adds close at player's kickoff
alter table public.bid_results add column if not exists early_game boolean not null default false;

-- ---------- time helpers ----------
-- PT wall-clock time -> timestamptz
create or replace function public.pt(d date, t time) returns timestamptz
language sql immutable as $$ select (d + t) at time zone 'America/Los_Angeles' $$;

-- The league week in progress: rolls over ~6 hours after the week's last kickoff (end of MNF)
create or replace function public.league_week(p_season int default null) returns int
language sql stable as $$
  select coalesce(min(week), 18) from (
    select week, max(kickoff_at) last_ko from public.nfl_games
     where season = coalesce(p_season, public.current_season()) group by week) w
   where last_ko + interval '6 hours' > now()
$$;

-- A player's game this week (null if bye / free agent)
create or replace function public.player_kickoff(p_player int, p_season int, p_week int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select g.kickoff_at from public.nfl_games g join public.players p on p.id = p_player
   where g.season = p_season and g.week = p_week and p.nfl_team in (g.home, g.away)
   order by g.kickoff_at limit 1
$$;

create or replace function public.player_locked(p_player int, p_season int, p_week int) returns boolean
language sql stable as $$ select coalesce(public.player_kickoff(p_player, p_season, p_week) <= now(), false) $$;

-- Cap used = active salaries + IR salaries minus IR relief (half, rounded down). Taxi is off-cap.
create or replace function public.team_cap_used(p_team int, p_season int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case status when 'active' then salary
                                  when 'ir' then salary - salary / 2
                                  else 0 end), 0)::int
    from public.roster_spots where team_id = p_team and season = p_season
$$;


-- ---------- Bid weeks open themselves ----------
-- The week a deadline belongs to = the NFL week of the first game after it.
create or replace function public.week_for_close(p_close timestamptz, p_season int) returns int
language sql stable as $$
  select week from public.nfl_games where season = p_season and kickoff_at > p_close order by kickoff_at limit 1
$$;

-- Next Tuesday 9:00pm PT strictly after now
create or replace function public.next_tuesday_close() returns timestamptz
language sql stable as $$
  select public.pt(d + ((2 - extract(dow from d)::int + 7) % 7), '21:00')
         + case when public.pt(d + ((2 - extract(dow from d)::int + 7) % 7), '21:00') <= now() then interval '7 days' else interval '0' end
    from (select (now() at time zone 'America/Los_Angeles')::date d) x
$$;

-- Keep exactly one bid week open until the free agent deadline
create or replace function public.ensure_open_week() returns void
language plpgsql security definer set search_path = public as $$
declare s public.seasons; c timestamptz; wk int;
begin
  select * into s from public.seasons where is_current;
  if s is null or exists (select 1 from public.bid_weeks where season = s.year and status = 'open') then return; end if;
  c  := public.next_tuesday_close();
  if s.fa_deadline is not null and c >= s.fa_deadline then return; end if;
  wk := public.week_for_close(c, s.year);
  if wk is null or exists (select 1 from public.bid_weeks where season = s.year and week = wk) then return; end if;
  insert into public.bid_weeks (season, week, bids_close_at) values (s.year, wk, c);
end $$;

-- Commissioner: open a week manually with a custom deadline (week number computed from the schedule)
create or replace function public.open_bid_week(p_close timestamptz) returns int
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int;
begin
  if not public.is_commissioner() then raise exception 'Only the commissioner can open a bid week.'; end if;
  if p_close <= now() then raise exception 'The deadline must be in the future.'; end if;
  wk := public.week_for_close(p_close, yr);
  if wk is null then raise exception 'No NFL games after that deadline.'; end if;
  insert into public.bid_weeks (season, week, bids_close_at) values (yr, wk, p_close);
  return wk;
end $$;
grant execute on function public.open_bid_week(timestamptz) to authenticated;

-- ---------- REVEAL: rank bidders, set windows ----------
-- Priority: highest bid; tie -> team LOWER in the standings after the previous week
-- (bigger rank number goes first). If standings are missing, ties fall back to
-- earliest bid placed and the result is flagged in details.
create or replace function public.resolve_bid_week(p_week_id int) returns int
language plpgsql security definer set search_path = public as $$
declare
  w public.bid_weeks; d date; dow int; fri date; thu date; n int := 0; r record;
begin
  select * into w from public.bid_weeks where id = p_week_id for update;
  if w.status = 'revealed' then return 0; end if;
  if now() < w.bids_close_at then raise exception 'Bids for week % have not closed yet.', w.week; end if;

  d   := (w.bids_close_at at time zone 'America/Los_Angeles')::date;
  dow := extract(dow from d)::int;
  fri := d + (((5 - dow + 7) % 7));
  if fri = d then fri := d + 7; end if;
  thu := fri - 1;

  delete from public.bid_results where bid_week_id = w.id;
  for r in
    select b.player_id, b.team_id, b.amount,
           row_number() over (partition by b.player_id
                              order by b.amount desc, coalesce(s.rank, 0) desc, b.created_at) as prio,
           public.player_kickoff(b.player_id, w.season, w.week) as ko
      from public.bids b
      left join public.standings s on s.season = w.season and s.week = w.week - 1 and s.team_id = b.team_id
     where b.bid_week_id = w.id
  loop
    insert into public.bid_results (bid_week_id, player_id, team_id, priority, amount,
                                    window_start, window_end, open_from, kickoff_at, early_game)
    values (w.id, r.player_id, r.team_id, r.prio, r.amount,
      -- window start
      case when r.prio = 1 then now()
           when r.ko is not null and r.ko < pt(fri + 2, '00:00') then   -- game before Sunday (TNF rules)
                case r.prio when 2 then pt(thu, '12:00') else null end
           else case r.prio when 2 then pt(fri, '09:00') when 3 then pt(fri + 1, '09:00') else null end end,
      -- window end
      case when r.ko is not null and r.ko < pt(fri + 2, '00:00') then
                case r.prio when 1 then pt(thu, '12:00') when 2 then pt(thu, '16:00') else null end
           else case r.prio when 1 then pt(fri, '09:00') when 2 then pt(fri + 1, '09:00') when 3 then pt(fri + 2, '09:00') else null end end,
      -- open (first come, first served) from
      case when r.ko is not null and r.ko < pt(fri + 2, '00:00') then pt(thu, '16:00') else pt(fri + 2, '09:00') end,
      r.ko,
      r.ko is not null and r.ko < pt(fri + 2, '00:00'));
    n := n + 1;
  end loop;

  update public.bid_weeks set status = 'revealed', revealed_at = now() where id = w.id;
  return n;
end $$;

-- Called every few minutes by the scheduler: reveals any week whose deadline has passed
create or replace function public.auto_reveal() returns void
language plpgsql security definer set search_path = public as $$
declare w record;
begin
  for w in select id from public.bid_weeks where status = 'open' and bids_close_at <= now() loop
    perform public.resolve_bid_week(w.id);
  end loop;
  update public.seasons set current_week = public.league_week(year) where is_current;
  perform public.ensure_open_week();
end $$;

-- Commissioner's manual reveal button (only works after the deadline, same as auto)
create or replace function public.reveal_bid_week(p_week_id int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_commissioner() then raise exception 'Only the commissioner can reveal.'; end if;
  return public.resolve_bid_week(p_week_id);
end $$;

-- Results are visible to members once revealed; nobody writes them directly.
-- (bid_weeks status can now only become 'revealed' through resolve_bid_week)
create or replace function public.guard_reveal_path() returns trigger
language plpgsql as $$
begin
  if new.status = 'revealed' and old.status <> 'revealed'
     and coalesce(current_setting('sv.resolving', true), '') <> 'on'
     and not exists (select 1 from public.bid_results where bid_week_id = new.id)
     and exists (select 1 from public.bids where bid_week_id = new.id) then
    raise exception 'Use the Reveal button (resolve_bid_week) so priority windows are set.';
  end if;
  return new;
end $$;
drop trigger if exists bid_week_reveal_path on public.bid_weeks;
create trigger bid_week_reveal_path before update on public.bid_weeks
  for each row execute function public.guard_reveal_path();

-- ---------- CLAIM a player you bid on ----------
create or replace function public.claim_player(p_week_id int, p_player int, p_drop int default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  me int := public.my_team_id(); w public.bid_weeks; s public.seasons; br public.bid_results;
  pname text; dname text; drop_spot public.roster_spots; cnt int; cap int; ok boolean;
begin
  if me is null then raise exception 'You are not on the league list.'; end if;
  select * into w from public.bid_weeks where id = p_week_id;
  select * into s from public.seasons where year = w.season;
  if w.status <> 'revealed' then raise exception 'That week has not been revealed yet.'; end if;
  select name into pname from public.players where id = p_player;

  select * into br from public.bid_results where bid_week_id = w.id and player_id = p_player and team_id = me;
  if br is null then raise exception 'You did not bid on % that week, so you cannot add him.', pname; end if;
  if exists (select 1 from public.roster_spots where season = w.season and player_id = p_player) then
    raise exception '% is already on a roster.', pname;
  end if;
  if br.kickoff_at is not null and now() >= br.kickoff_at then
    raise exception '%''s game has kicked off. Adds are closed for him this week.', pname;
  end if;

  ok := (br.window_start is not null and now() >= br.window_start and now() < br.window_end)
        or now() >= br.open_from;
  if not ok then
    if now() < coalesce(br.window_start, br.open_from) then
      raise exception 'Your window for % opens %.', pname,
        to_char(coalesce(br.window_start, br.open_from) at time zone 'America/Los_Angeles', 'Dy Mon DD at HH12:MI AM "PT"');
    else
      raise exception 'Your priority window for % has ended. It reopens to all bidders %.', pname,
        to_char(br.open_from at time zone 'America/Los_Angeles', 'Dy Mon DD at HH12:MI AM "PT"');
    end if;
  end if;

  -- optional drop in the same move
  if p_drop is not null then
    select * into drop_spot from public.roster_spots where season = w.season and team_id = me and player_id = p_drop;
    select name into dname from public.players where id = p_drop;
    if drop_spot is null then raise exception '% is not on your roster.', dname; end if;
    perform public.check_droppable(drop_spot, w.season);
  end if;

  -- roster size and cap AFTER the move
  select count(*) into cnt from public.roster_spots
   where season = w.season and team_id = me and status = 'active' and player_id is distinct from p_drop;
  if cnt + 1 > s.roster_size then
    raise exception 'Adding % would put you at % active players (max %). Choose a player to drop.', pname, cnt + 1, s.roster_size;
  end if;
  cap := public.team_cap_used(me, w.season)
         - coalesce(case drop_spot.status when 'active' then drop_spot.salary
                                          when 'ir' then drop_spot.salary - drop_spot.salary / 2 else 0 end, 0)
         + br.amount;
  if cap > s.salary_cap then
    raise exception 'Adding % at $% puts you at $% — over the $% cap by $%. Drop salary first.', pname, br.amount, cap, s.salary_cap, cap - s.salary_cap;
  end if;

  perform set_config('sv.reason', 'fa_claim', true);
  if p_drop is not null then
    delete from public.roster_spots where id = drop_spot.id;
    insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
    values (w.season, w.week, 'drop', me, p_drop, drop_spot.salary, jsonb_build_object('with_add', p_player));
  end if;
  insert into public.roster_spots (season, team_id, player_id, status, salary, acquired_via, acquired_week)
  values (w.season, me, p_player, 'active', br.amount, 'fa_bid', w.week);
  update public.bid_results set status = case when team_id = me then 'claimed' else 'passed' end
   where bid_week_id = w.id and player_id = p_player;
  insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
  values (w.season, w.week, 'add', me, p_player, br.amount,
          jsonb_build_object('priority', br.priority, 'bid_week', w.week, 'dropped', p_drop));
  return format('%s added at $%s.', pname, br.amount);
end $$;

-- ---------- DROP rules ----------
create or replace function public.check_droppable(spot public.roster_spots, p_season int) returns void
language plpgsql stable security definer set search_path = public as $$
declare lw int := public.league_week(p_season); nm text;
begin
  select name into nm from public.players where id = spot.player_id;
  if public.player_locked(spot.player_id, p_season, lw) then
    raise exception '%''s game has kicked off this week — he can''t be dropped until next week.', nm;
  end if;
  -- EXECUTIVE ORDER: a player added in FA can't be dropped until the next league week
  if spot.acquired_via = 'fa_bid' and spot.acquired_week is not null and spot.acquired_week >= lw then
    raise exception 'Executive Order: % was added this league week and can''t be dropped until next week.', nm;
  end if;
end $$;

create or replace function public.drop_player(p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); spot public.roster_spots; nm text;
begin
  select * into spot from public.roster_spots where season = yr and team_id = me and player_id = p_player;
  select name into nm from public.players where id = p_player;
  if spot is null then raise exception '% is not on your roster.', nm; end if;
  perform public.check_droppable(spot, yr);
  delete from public.roster_spots where id = spot.id;
  insert into public.transactions (season, week, kind, team_id, player_id, amount)
  values (yr, public.league_week(yr), 'drop', me, p_player, spot.salary);
  return format('%s dropped. He becomes a free agent for next week''s bidding.', nm);
end $$;

-- ---------- permissions ----------
revoke execute on function public.resolve_bid_week(int), public.auto_reveal(), public.ensure_open_week() from public, anon, authenticated;
grant execute on function public.reveal_bid_week(int), public.claim_player(int,int,int), public.drop_player(int),
                          public.league_week(int), public.team_cap_used(int,int), public.min_bid(int) to authenticated;

-- ---------- scheduler: check every 5 minutes for weeks to reveal ----------
-- Requires the pg_cron extension (Supabase: Database -> Extensions -> pg_cron). Skipped if absent.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'sacverde-auto-reveal';
    perform cron.schedule('sacverde-auto-reveal', '*/5 * * * *', 'select public.auto_reveal()');
  else
    raise notice 'pg_cron not available here — auto reveal not scheduled.';
  end if;
end $$;
