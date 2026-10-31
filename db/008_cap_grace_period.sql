-- =====================================================================
-- SacVerde League — 008: cap / roster grace period (decided 2026-10-31)
-- Teams may be over the $170 cap and over 15 active players from the end of
-- one week until 5 minutes before the next week's Sunday 10:00am PT kickoff
-- (Sunday 9:55am PT). After that deadline, until the week ends, every add
-- must keep the team legal. Penalty for missing the deadline: TBD (flagged).
-- Run AFTER 007. Replaces claim_player.
-- =====================================================================

-- Sunday 9:55am PT of a league week (the compliance deadline)
create or replace function public.compliance_deadline(p_season int, p_week int) returns timestamptz
language sql stable as $$
  select public.pt(min((kickoff_at at time zone 'America/Los_Angeles')::date), '09:55')
    from public.nfl_games
   where season = p_season and week = p_week
     and extract(dow from kickoff_at at time zone 'America/Los_Angeles') = 0
$$;

-- Every team's status right now
create or replace function public.team_compliance(p_season int default null)
returns table (team_id int, team text, active int, cap_used int, over_roster int, over_cap int)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.seasons where year = coalesce(p_season, public.current_season()))
  select t.id, t.name,
         (select count(*) from public.roster_spots r where r.team_id = t.id and r.season = s.year and r.status = 'active')::int,
         public.team_cap_used(t.id, s.year),
         greatest(0, (select count(*) from public.roster_spots r where r.team_id = t.id and r.season = s.year and r.status = 'active') - s.roster_size)::int,
         greatest(0, public.team_cap_used(t.id, s.year) - s.salary_cap)::int
    from public.teams t, s
   order by t.name
$$;
grant execute on function public.compliance_deadline(int,int), public.team_compliance(int) to authenticated;

create or replace function public.claim_player(p_week_id int, p_player int, p_drop int default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  me int := public.my_team_id(); w public.bid_weeks; s public.seasons; br public.bid_results;
  pname text; dname text; drop_spot public.roster_spots; cnt int; cap int; ok boolean;
  lw int; dl timestamptz; is_strict boolean; msg text;
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

  if p_drop is not null then
    select * into drop_spot from public.roster_spots where season = w.season and team_id = me and player_id = p_drop;
    select name into dname from public.players where id = p_drop;
    if drop_spot is null then raise exception '% is not on your roster.', dname; end if;
    perform public.check_droppable(drop_spot, w.season);
  end if;

  select count(*) into cnt from public.roster_spots
   where season = w.season and team_id = me and status = 'active' and player_id is distinct from p_drop;
  cnt := cnt + 1;
  cap := public.team_cap_used(me, w.season)
         - coalesce(case drop_spot.status when 'active' then drop_spot.salary
                                          when 'ir' then drop_spot.salary - drop_spot.salary / 2 else 0 end, 0)
         + br.amount;

  -- Grace period: limits are only hard between Sunday 9:55am PT and the end of the week
  lw := public.league_week(w.season);
  dl := public.compliance_deadline(w.season, lw);
  is_strict := dl is not null and now() >= dl;
  if is_strict and cnt > s.roster_size then
    raise exception 'It''s past Sunday 9:55am PT — adding % would put you at % active players (max %). Drop someone in the same move.', pname, cnt, s.roster_size;
  end if;
  if is_strict and cap > s.salary_cap then
    raise exception 'It''s past Sunday 9:55am PT — adding % at $% puts you at $%, over the $% cap by $%. Drop salary in the same move.', pname, br.amount, cap, s.salary_cap, cap - s.salary_cap;
  end if;

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

  msg := format('%s added at $%s.', pname, br.amount);
  if cnt > s.roster_size or cap > s.salary_cap then
    msg := msg || format(' You are now%s%s — get legal by %s.',
      case when cnt > s.roster_size then format(' %s %s over the %s-man limit', cnt - s.roster_size, case when cnt - s.roster_size = 1 then 'player' else 'players' end, s.roster_size) else '' end
      || case when cnt > s.roster_size and cap > s.salary_cap then ' and' else '' end,
      case when cap > s.salary_cap then format(' $%s over the $%s cap', cap - s.salary_cap, s.salary_cap) else '' end,
      to_char(public.compliance_deadline(w.season, greatest(lw, w.week)) at time zone 'America/Los_Angeles', 'Dy Mon DD at HH12:MI AM "PT"'));
  end if;
  return msg;
end $$;
