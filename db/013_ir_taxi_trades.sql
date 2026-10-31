-- =====================================================================
-- SacVerde League — 013: IR, taxi squad, trades (2026 rule document)
-- Run AFTER 012. Safe to re-run.
--
-- IR:    max 2 per team · minimum 3 weeks · half the salary counts against the cap
--        player must be on an NFL roster (not a free agent)
-- Taxi:  max 4 · rookies only · off the cap · a promotion is permanent (no demotion)
--        a rookie claimed in free agency may go to the taxi squad the week he is added
-- Trades: commissioner approval · deadline = first kickoff of week 11 · Pair of Juggs:
--        a newly acquired free agent can't be traded until the week after he was added
-- =====================================================================

-- ---------- IR ----------
create or replace function public.place_on_ir(p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); s public.seasons;
        spot public.roster_spots; p public.players; n int; lw int := public.league_week(yr);
begin
  select * into s from public.seasons where year = yr;
  select * into p from public.players where id = p_player;
  select * into spot from public.roster_spots where season = yr and team_id = me and player_id = p_player;
  if spot is null then raise exception '% is not on your roster.', p.name; end if;
  if spot.status = 'ir' then raise exception '% is already on IR.', p.name; end if;
  if spot.status = 'taxi' then raise exception 'Taxi squad players can''t go on IR. Promote him first.'; end if;
  if p.nfl_team = 'FA' then raise exception '% isn''t on an NFL roster, so he can''t go on IR.', p.name; end if;
  select count(*) into n from public.roster_spots where season = yr and team_id = me and status = 'ir';
  if n >= s.max_ir then raise exception 'You already have % players on IR (max %).', n, s.max_ir; end if;
  update public.roster_spots set status = 'ir', ir_since_week = lw where id = spot.id;
  insert into public.transactions (season, week, kind, team_id, player_id, amount)
  values (yr, lw, 'ir_on', me, p_player, spot.salary);
  return format('%s moved to IR in week %s. Earliest return: week %s. Only half his salary ($%s) now counts against your cap.',
                p.name, lw, lw + s.ir_min_weeks, spot.salary - spot.salary / 2);
end $$;

create or replace function public.activate_from_ir(p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); s public.seasons;
        spot public.roster_spots; nm text; lw int := public.league_week(yr);
begin
  select * into s from public.seasons where year = yr;
  select name into nm from public.players where id = p_player;
  select * into spot from public.roster_spots where season = yr and team_id = me and player_id = p_player;
  if spot is null or spot.status <> 'ir' then raise exception '% is not on your IR.', nm; end if;
  if spot.ir_since_week is not null and lw < spot.ir_since_week + s.ir_min_weeks then
    raise exception '% went on IR in week % and must stay at least % weeks. Earliest return: week %.',
      nm, spot.ir_since_week, s.ir_min_weeks, spot.ir_since_week + s.ir_min_weeks;
  end if;
  update public.roster_spots set status = 'active', ir_since_week = null where id = spot.id;
  insert into public.transactions (season, week, kind, team_id, player_id, amount)
  values (yr, lw, 'ir_off', me, p_player, spot.salary);
  return format('%s is back on your active roster. His full $%s salary counts again — check your cap and roster size.', nm, spot.salary);
end $$;

-- ---------- Taxi ----------
create or replace function public.promote_from_taxi(p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); spot public.roster_spots; nm text;
begin
  select name into nm from public.players where id = p_player;
  select * into spot from public.roster_spots where season = yr and team_id = me and player_id = p_player;
  if spot is null or spot.status <> 'taxi' then raise exception '% is not on your taxi squad.', nm; end if;
  update public.roster_spots set status = 'active' where id = spot.id;
  insert into public.transactions (season, week, kind, team_id, player_id, amount)
  values (yr, public.league_week(yr), 'taxi_promote', me, p_player, spot.salary);
  return format('%s promoted to your active roster. This is permanent (he can''t go back to the taxi squad), his $%s salary now counts against your cap, and he loses 1 year of keeper availability.', nm, spot.salary);
end $$;

create or replace function public.move_to_taxi(p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); s public.seasons;
        spot public.roster_spots; p public.players; n int; lw int := public.league_week(yr);
begin
  select * into s from public.seasons where year = yr;
  select * into p from public.players where id = p_player;
  select * into spot from public.roster_spots where season = yr and team_id = me and player_id = p_player;
  if spot is null then raise exception '% is not on your roster.', p.name; end if;
  if spot.status = 'taxi' then raise exception '% is already on your taxi squad.', p.name; end if;
  if not p.rookie then raise exception 'Only rookies can go on the taxi squad.'; end if;
  if not (spot.acquired_via = 'fa_bid' and spot.acquired_week >= lw) then
    raise exception 'Only a rookie you just added in free agency can go to the taxi squad. Players already on your active roster can''t be moved down.';
  end if;
  if public.player_locked(p_player, yr, lw) then raise exception '%''s game has kicked off this week.', p.name; end if;
  select count(*) into n from public.roster_spots where season = yr and team_id = me and status = 'taxi';
  if n >= s.max_taxi then raise exception 'Your taxi squad is full (% of %).', n, s.max_taxi; end if;
  update public.roster_spots set status = 'taxi' where id = spot.id;
  insert into public.transactions (season, week, kind, team_id, player_id, amount)
  values (yr, lw, 'taxi_add', me, p_player, spot.salary);
  return format('%s moved to your taxi squad. His $%s salary no longer counts against your cap.', p.name, spot.salary);
end $$;

-- ---------- Trades ----------
create table if not exists public.trades (
  id            bigserial primary key,
  season        int  not null,
  from_team     int  not null references public.teams(id),
  to_team       int  not null references public.teams(id),
  status        text not null default 'proposed'
                check (status in ('proposed','accepted','approved','declined','cancelled','rejected')),
  picks_from    text,          -- picks the proposer sends, e.g. "2027 2nd (own)"
  picks_to      text,          -- picks the proposer receives
  note          text check (char_length(note) <= 1000),
  commish_note  text,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  decided_at    timestamptz,
  check (from_team <> to_team)
);
create table if not exists public.trade_items (
  trade_id   bigint not null references public.trades(id) on delete cascade,
  player_id  int    not null references public.players(id),
  from_team  int    not null references public.teams(id),
  to_team    int    not null references public.teams(id),
  primary key (trade_id, player_id)
);
alter table public.trades enable row level security;
alter table public.trade_items enable row level security;
-- The two teams and the commissioner see a trade while it's pending; everyone sees approved trades.
drop policy if exists "involved or approved" on public.trades;
create policy "involved or approved" on public.trades for select to authenticated using (
  public.is_member() and (status = 'approved' or public.is_commissioner() or public.my_team_id() in (from_team, to_team)));
drop policy if exists "involved or approved" on public.trade_items;
create policy "involved or approved" on public.trade_items for select to authenticated using (
  exists (select 1 from public.trades t where t.id = trade_id));
grant select on public.trades, public.trade_items to authenticated;

create or replace function public.trade_deadline(p_season int) returns timestamptz
language sql stable as $$ select min(kickoff_at) from public.nfl_games where season = p_season and week = 11 $$;

-- All rule checks for a trade, given the players each side sends. Raises on any problem.
create or replace function public.check_trade(p_season int, p_from int, p_to int, p_give int[], p_get int[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare lw int := public.league_week(p_season); dl timestamptz := public.trade_deadline(p_season);
        r record; s public.seasons; n_ir int; n_taxi int;
begin
  select * into s from public.seasons where year = p_season;
  if dl is not null and now() >= dl then
    raise exception 'The trade deadline (kickoff of week 11, %) has passed.', to_char(dl at time zone 'America/Los_Angeles', 'Dy Mon DD HH12:MI AM "PT"');
  end if;
  if coalesce(array_length(p_give,1),0) + coalesce(array_length(p_get,1),0) = 0 then
    raise exception 'A trade needs at least one player. (Pick-only deals: list the picks and include a player, or ask the commissioner.)';
  end if;
  for r in
    select x.pid, x.side, rs.team_id, rs.acquired_via, rs.acquired_week, pl.name
      from (select unnest(coalesce(p_give,'{}')) pid, 'give' side union all select unnest(coalesce(p_get,'{}')), 'get') x
      join public.players pl on pl.id = x.pid
      left join public.roster_spots rs on rs.season = p_season and rs.player_id = x.pid
  loop
    if r.team_id is null or (r.side = 'give' and r.team_id <> p_from) or (r.side = 'get' and r.team_id <> p_to) then
      raise exception '% isn''t on the % roster.', r.name, case r.side when 'give' then 'sending team''s' else 'receiving team''s' end;
    end if;
    -- PAIR OF JUGGS: newly acquired free agents can't be traded until the week after they're acquired
    if r.acquired_via = 'fa_bid' and r.acquired_week is not null and r.acquired_week >= lw then
      raise exception 'Pair of Juggs: % was just added in free agency and can''t be traded until week %.', r.name, r.acquired_week + 1;
    end if;
  end loop;
  -- IR (max 2) and taxi (max 4) still have to fit on each side after the swap
  for r in select t.id, t.name from public.teams t where t.id in (p_from, p_to) loop
    select count(*) filter (where status = 'ir'), count(*) filter (where status = 'taxi') into n_ir, n_taxi
      from (select rs.status from public.roster_spots rs
             where rs.season = p_season and rs.team_id = r.id
               and rs.player_id <> all (case when r.id = p_from then coalesce(p_give,'{}') else coalesce(p_get,'{}') end)
            union all
            select rs.status from public.roster_spots rs
             where rs.season = p_season
               and rs.player_id = any (case when r.id = p_from then coalesce(p_get,'{}') else coalesce(p_give,'{}') end)) z;
    if n_ir > s.max_ir then raise exception '% would have % players on IR (max %).', r.name, n_ir, s.max_ir; end if;
    if n_taxi > s.max_taxi then raise exception '% would have % taxi players (max %).', r.name, n_taxi, s.max_taxi; end if;
  end loop;
end $$;

create or replace function public.propose_trade(p_to_team int, p_give int[], p_get int[],
    p_picks_give text default null, p_picks_get text default null, p_note text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); tid bigint;
begin
  if me is null then raise exception 'You are not on the league list.'; end if;
  if p_to_team = me then raise exception 'You can''t trade with yourself.'; end if;
  perform public.check_trade(yr, me, p_to_team, p_give, p_get);
  insert into public.trades (season, from_team, to_team, picks_from, picks_to, note)
  values (yr, me, p_to_team, nullif(trim(p_picks_give),''), nullif(trim(p_picks_get),''), nullif(trim(p_note),''))
  returning id into tid;
  insert into public.trade_items (trade_id, player_id, from_team, to_team)
  select tid, unnest(coalesce(p_give,'{}')), me, p_to_team
  union all select tid, unnest(coalesce(p_get,'{}')), p_to_team, me;
  return tid;
end $$;

-- Receiving team accepts or declines; proposer can cancel while it's not approved yet
create or replace function public.respond_trade(p_trade bigint, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare t public.trades; me int := public.my_team_id();
begin
  select * into t from public.trades where id = p_trade for update;
  if t is null or t.to_team <> me then raise exception 'That trade isn''t waiting on you.'; end if;
  if t.status <> 'proposed' then raise exception 'That trade is already %.', t.status; end if;
  update public.trades set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = t.id;
  return case when p_accept then 'Accepted. It now goes to the commissioner for approval.' else 'Trade declined.' end;
end $$;

create or replace function public.cancel_trade(p_trade bigint) returns text
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  select * into t from public.trades where id = p_trade for update;
  if t is null or t.from_team <> public.my_team_id() then raise exception 'You can only cancel trades you proposed.'; end if;
  if t.status not in ('proposed','accepted') then raise exception 'That trade is already %.', t.status; end if;
  update public.trades set status = 'cancelled', decided_at = now() where id = t.id;
  return 'Trade cancelled.';
end $$;

-- Commissioner approves (executes) or rejects an accepted trade
create or replace function public.decide_trade(p_trade bigint, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare t public.trades; give int[]; get int[]; lw int; r record;
begin
  if not public.is_commissioner() then raise exception 'Only the commissioner can approve trades.'; end if;
  select * into t from public.trades where id = p_trade for update;
  if t is null then raise exception 'Trade not found.'; end if;
  if t.status <> 'accepted' then raise exception 'Only accepted trades can be decided (this one is %).', t.status; end if;
  if not p_approve then
    update public.trades set status = 'rejected', decided_at = now(), commish_note = nullif(trim(p_note),'') where id = t.id;
    return 'Trade rejected.';
  end if;
  select array_agg(player_id) filter (where from_team = t.from_team), array_agg(player_id) filter (where from_team = t.to_team)
    into give, get from public.trade_items where trade_id = t.id;
  perform public.check_trade(t.season, t.from_team, t.to_team, give, get);   -- re-check at approval time
  lw := public.league_week(t.season);
  for r in select i.*, rs.salary from public.trade_items i
             join public.roster_spots rs on rs.season = t.season and rs.player_id = i.player_id
            where i.trade_id = t.id loop
    update public.roster_spots set team_id = r.to_team, acquired_via = 'trade', acquired_week = lw
     where season = t.season and player_id = r.player_id;
    insert into public.transactions (season, week, kind, team_id, player_id, amount, details) values
      (t.season, lw, 'trade_out', r.from_team, r.player_id, r.salary, jsonb_build_object('trade', t.id)),
      (t.season, lw, 'trade_in',  r.to_team,   r.player_id, r.salary, jsonb_build_object('trade', t.id));
  end loop;
  update public.trades set status = 'approved', decided_at = now(), commish_note = nullif(trim(p_note),'') where id = t.id;
  insert into public.transactions (season, week, kind, details)
  values (t.season, lw, 'trade', jsonb_build_object('trade', t.id, 'from', t.from_team, 'to', t.to_team,
          'picks_from', t.picks_from, 'picks_to', t.picks_to));
  return 'Trade approved and rosters updated. Both teams must be cap- and roster-legal by Sunday 9:55am PT.';
end $$;

revoke execute on function public.check_trade(int,int,int,int[],int[]) from public, anon;
grant execute on function public.place_on_ir(int), public.activate_from_ir(int), public.promote_from_taxi(int),
  public.move_to_taxi(int), public.propose_trade(int,int[],int[],text,text,text), public.respond_trade(bigint,boolean),
  public.cancel_trade(bigint), public.decide_trade(bigint,boolean,text), public.trade_deadline(int) to authenticated;
