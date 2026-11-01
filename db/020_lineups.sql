-- =====================================================================
-- SacVerde League — 020: weekly starting lineups (decided by Hoogs 2026-10-31)
-- Fighting Dogos: QB, RB, RB, WR, WR, TE, FLEX (RB/WR/TE), K, DST each week.
-- Bench = active players not in the lineup. IR and Taxi are the existing statuses.
-- Assass Your Roster: once a player's game kicks off he can't be moved in or out.
-- No lineup set → last week's lineup is used (minus anyone no longer active on the team).
-- Invalid lineup (an empty slot) at Sunday 9:55am PT → automatic loss (same switch as cap/roster).
-- Lineups are visible to every league member.
-- ADDITIVE ONLY: no existing table or column changes. Safe to re-run. Run AFTER 019.
-- =====================================================================

-- ---------- table ----------
create table if not exists public.lineups (
  season     int  not null,
  week       int  not null,
  team_id    int  not null references public.teams(id),
  slot       text not null check (slot in ('QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DST')),
  player_id  int  not null references public.players(id),
  set_by     uuid,
  updated_at timestamptz not null default now(),
  primary key (season, week, team_id, slot),
  unique (season, week, team_id, player_id)
);
create index if not exists lineups_player_idx on public.lineups (season, week, player_id);
alter table public.lineups enable row level security;
drop policy if exists "members read" on public.lineups;
create policy "members read" on public.lineups for select to authenticated using (public.is_member());
grant select on public.lineups to authenticated;     -- all writes go through the functions below

-- penalties: say which rule was broken (existing rows default to cap/roster)
alter table public.penalties add column if not exists reason text not null default 'cap_roster';
alter table public.penalties add column if not exists lineup_empty jsonb;

-- ---------- helpers ----------
create or replace function public.lineup_slots() returns text[]
language sql immutable as $$ select array['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DST'] $$;

create or replace function public.slot_fits(p_slot text, p_pos text) returns boolean
language sql immutable as $$
  select case p_slot when 'QB' then p_pos = 'QB'
                     when 'RB1' then p_pos = 'RB' when 'RB2' then p_pos = 'RB'
                     when 'WR1' then p_pos = 'WR' when 'WR2' then p_pos = 'WR'
                     when 'TE' then p_pos = 'TE'
                     when 'FLEX' then p_pos in ('RB','WR','TE')
                     when 'K' then p_pos = 'K' when 'DST' then p_pos = 'DST' else false end
$$;

-- Best-guess lineup for one team/week: highest salary per slot, players with a game that week first
create or replace function public.autofill_lineup(p_team int, p_season int, p_week int) returns int
language plpgsql security definer set search_path = public as $$
declare v_slot text; v_pid int; n int := 0;
begin
  foreach v_slot in array public.lineup_slots() loop
    if v_slot = 'FLEX' then continue; end if;                 -- FLEX last, so RB/WR/TE fill first
    if exists (select 1 from public.lineups where season = p_season and week = p_week and team_id = p_team and slot = v_slot) then continue; end if;
    select r.player_id into v_pid from public.roster_spots r join public.players p on p.id = r.player_id
     where r.season = p_season and r.team_id = p_team and r.status = 'active' and public.slot_fits(v_slot, p.pos)
       and r.player_id not in (select player_id from public.lineups where season = p_season and week = p_week and team_id = p_team)
     order by (p.nfl_team <> 'FA' and public.player_kickoff(r.player_id, p_season, p_week) is not null) desc, r.salary desc, p.name
     limit 1;
    if v_pid is not null then
      insert into public.lineups (season, week, team_id, slot, player_id) values (p_season, p_week, p_team, v_slot, v_pid);
      n := n + 1;
    end if;
  end loop;
  if not exists (select 1 from public.lineups where season = p_season and week = p_week and team_id = p_team and slot = 'FLEX') then
    select r.player_id into v_pid from public.roster_spots r join public.players p on p.id = r.player_id
     where r.season = p_season and r.team_id = p_team and r.status = 'active' and public.slot_fits('FLEX', p.pos)
       and r.player_id not in (select player_id from public.lineups where season = p_season and week = p_week and team_id = p_team)
     order by (p.nfl_team <> 'FA' and public.player_kickoff(r.player_id, p_season, p_week) is not null) desc, r.salary desc, p.name
     limit 1;
    if v_pid is not null then
      insert into public.lineups (season, week, team_id, slot, player_id) values (p_season, p_week, p_team, 'FLEX', v_pid);
      n := n + 1;
    end if;
  end if;
  return n;
end $$;

-- Make sure every team has a lineup for the week: copy last week's (players still active on the team);
-- a team with no lineup history at all gets an autofilled one
create or replace function public.ensure_lineups(p_season int, p_week int) returns int
language plpgsql security definer set search_path = public as $$
declare t record; n int := 0;
begin
  for t in select id from public.teams loop
    if exists (select 1 from public.lineups where season = p_season and week = p_week and team_id = t.id) then continue; end if;
    if exists (select 1 from public.lineups where season = p_season and week < p_week and team_id = t.id) then
      insert into public.lineups (season, week, team_id, slot, player_id)
      select p_season, p_week, t.id, l.slot, l.player_id
        from public.lineups l
       where l.season = p_season and l.team_id = t.id
         and l.week = (select max(week) from public.lineups where season = p_season and team_id = t.id and week < p_week)
         and exists (select 1 from public.roster_spots r where r.season = p_season and r.team_id = t.id
                      and r.player_id = l.player_id and r.status = 'active');
    else
      perform public.autofill_lineup(t.id, p_season, p_week);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Empty slots for every team in a week (a lineup with no empty slot is valid; a starter on bye is still valid)
create or replace function public.lineup_status(p_season int default null, p_week int default null)
returns table (team_id int, team text, filled int, empty text[])
language sql stable security definer set search_path = public as $$
  with w as (select coalesce(p_season, public.current_season()) yr),
       wk as (select yr, coalesce(p_week, public.league_week(yr)) week from w)
  select t.id, t.name,
         (select count(*) from public.lineups l where l.season = wk.yr and l.week = wk.week and l.team_id = t.id)::int,
         array(select s from unnest(public.lineup_slots()) with ordinality u(s, i)
                where not exists (select 1 from public.lineups l where l.season = wk.yr and l.week = wk.week and l.team_id = t.id and l.slot = u.s)
                order by u.i)
    from public.teams t, wk
   order by t.name
$$;

-- ---------- manager: set one slot (player null = empty it) ----------
create or replace function public.set_lineup_slot(p_slot text, p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare
  yr int := public.current_season(); wk int; me int := public.my_team_id();
  v_pos text; v_name text; v_occ int; v_from text; v_occ_pos text;
begin
  if me is null then raise exception 'You are not on the league list.'; end if;
  if not (p_slot = any (public.lineup_slots())) then raise exception 'Unknown lineup slot %.', p_slot; end if;
  wk := public.league_week(yr);
  perform public.ensure_lineups(yr, wk);

  select player_id into v_occ from public.lineups where season = yr and week = wk and team_id = me and slot = p_slot;
  if v_occ is not null and v_occ = p_player then return 'No change.'; end if;
  if v_occ is not null and public.player_locked(v_occ, yr, wk) then
    raise exception '%''s game has kicked off — he can''t be taken out of the lineup this week.', (select name from public.players where id = v_occ);
  end if;

  if p_player is null then
    if v_occ is null then return 'That slot is already empty.'; end if;
    delete from public.lineups where season = yr and week = wk and team_id = me and slot = p_slot;
    return format('%s moved to the bench.', (select name from public.players where id = v_occ));
  end if;

  select p.pos, p.name into v_pos, v_name from public.roster_spots r join public.players p on p.id = r.player_id
   where r.season = yr and r.team_id = me and r.player_id = p_player and r.status = 'active';
  if v_pos is null then raise exception 'Only players on your active roster can start (not IR or taxi).'; end if;
  if not public.slot_fits(p_slot, v_pos) then raise exception '% (%) can''t play the % slot.', v_name, v_pos, p_slot; end if;
  if public.player_locked(p_player, yr, wk) then
    raise exception '%''s game has kicked off — he can''t be moved this week.', v_name;
  end if;

  -- where the incoming player is now (another slot, or the bench)
  select slot into v_from from public.lineups where season = yr and week = wk and team_id = me and player_id = p_player;
  delete from public.lineups where season = yr and week = wk and team_id = me and slot in (p_slot, coalesce(v_from, p_slot));
  insert into public.lineups (season, week, team_id, slot, player_id, set_by) values (yr, wk, me, p_slot, p_player, auth.uid());
  -- swap: the player who was in the target slot takes the incoming player's old slot if he fits it
  if v_from is not null and v_occ is not null then
    select pos into v_occ_pos from public.players where id = v_occ;
    if public.slot_fits(v_from, v_occ_pos) then
      insert into public.lineups (season, week, team_id, slot, player_id, set_by) values (yr, wk, me, v_from, v_occ, auth.uid());
    end if;
  end if;
  return format('%s is in your %s slot for week %s.', v_name, p_slot, wk);
end $$;

-- ---------- commissioner: set any team's slot for any week up to now (ignores kickoff locks, for corrections) ----------
create or replace function public.admin_set_lineup(p_team int, p_week int, p_slot text, p_player int) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); v_pos text; v_name text;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if not (p_slot = any (public.lineup_slots())) then raise exception 'Unknown lineup slot %.', p_slot; end if;
  if p_week > public.league_week(yr) then raise exception 'Week % hasn''t started yet.', p_week; end if;
  delete from public.lineups where season = yr and week = p_week and team_id = p_team and (slot = p_slot or player_id = p_player);
  if p_player is null then return 'Slot emptied.'; end if;
  select p.pos, p.name into v_pos, v_name from public.players p where p.id = p_player;
  if not exists (select 1 from public.roster_spots where season = yr and team_id = p_team and player_id = p_player) then
    raise exception '% is not on that team''s roster.', v_name;
  end if;
  if not public.slot_fits(p_slot, v_pos) then raise exception '% (%) can''t play the % slot.', v_name, v_pos, p_slot; end if;
  insert into public.lineups (season, week, team_id, slot, player_id, set_by) values (yr, p_week, p_team, p_slot, p_player, auth.uid());
  return format('%s set at %s for week %s.', v_name, p_slot, p_week);
end $$;

create or replace function public.admin_autofill_lineups() returns int
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int; t record; n int := 0;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  wk := public.league_week(yr);
  for t in select id from public.teams loop n := n + public.autofill_lineup(t.id, yr, wk); end loop;
  return n;
end $$;

revoke execute on function public.autofill_lineup(int,int,int), public.ensure_lineups(int,int) from public, anon, authenticated;
grant execute on function public.set_lineup_slot(text,int), public.admin_set_lineup(int,int,text,int),
  public.admin_autofill_lineups(), public.lineup_status(int,int), public.slot_fits(text,text), public.lineup_slots() to authenticated;

-- ---------- roster changes clear lineup slots ----------
-- Dropped / traded / moved to IR or taxi → out of this week's and later lineups,
-- unless his game already kicked off this week (he stays — his points count).
create or replace function public.trg_lineup_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
declare wk int;
begin
  if tg_op = 'UPDATE' and new.team_id = old.team_id and new.status = old.status and new.player_id = old.player_id then return new; end if;
  wk := public.league_week(old.season);
  delete from public.lineups l
   where l.season = old.season and l.team_id = old.team_id and l.player_id = old.player_id
     and (l.week > wk or (l.week = wk and not public.player_locked(old.player_id, old.season, wk)));
  return coalesce(new, old);
end $$;
drop trigger if exists lineup_cleanup on public.roster_spots;
create trigger lineup_cleanup after update or delete on public.roster_spots
  for each row execute function public.trg_lineup_cleanup();

-- ---------- penalties: invalid lineup = automatic loss (no forced drops; nothing was added to cause it) ----------
create or replace function public.enforce_compliance_for(p_season int, p_week int, p_since timestamptz)
returns int
language plpgsql security definer set search_path = public as $$
declare
  s public.seasons; c record; n int := 0; dropped jsonb; pend jsonb; r record; v_empty text[]; v_capbad boolean;
begin
  select * into s from public.seasons where year = p_season;
  if exists (select 1 from public.compliance_runs where season = p_season and week = p_week) then return 0; end if;
  perform public.ensure_lineups(p_season, p_week);

  for c in select tc.*, ls.empty from public.team_compliance(p_season) tc
             join public.lineup_status(p_season, p_week) ls on ls.team_id = tc.team_id
            where tc.over_roster > 0 or tc.over_cap > 0 or cardinality(ls.empty) > 0 loop
    dropped := '[]'; pend := '[]';
    v_capbad := c.over_roster > 0 or c.over_cap > 0;
    v_empty := c.empty;
    if v_capbad then
      -- players acquired this cycle that are still on the roster
      for r in
        select distinct on (rs.player_id) rs.id spot_id, rs.player_id, rs.salary, p.name
          from public.transactions t
          join public.roster_spots rs on rs.season = p_season and rs.team_id = c.team_id and rs.player_id = t.player_id
          join public.players p on p.id = rs.player_id
         where t.season = p_season and t.team_id = c.team_id and t.kind in ('add', 'trade_in')
           and t.created_at >= p_since
      loop
        -- A player whose game has started is locked to the roster for the week: drop him when the week ends
        if public.player_locked(r.player_id, p_season, p_week) then
          pend := pend || jsonb_build_object('player_id', r.player_id, 'name', r.name, 'salary', r.salary);
          continue;
        end if;
        delete from public.roster_spots where id = r.spot_id;
        insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
        values (p_season, p_week, 'forced_drop', c.team_id, r.player_id, r.salary,
                jsonb_build_object('reason', 'not compliant at Sunday 9:55am PT'));
        dropped := dropped || jsonb_build_object('player_id', r.player_id, 'name', r.name, 'salary', r.salary);
      end loop;
    end if;

    insert into public.penalties (season, week, team_id, kind, active, cap_used, dropped, pending, reason, lineup_empty)
    values (p_season, p_week, c.team_id, 'forfeit', c.active, c.cap_used, dropped, pend,
            case when v_capbad and cardinality(v_empty) > 0 then 'cap_roster+lineup' when v_capbad then 'cap_roster' else 'lineup' end,
            case when cardinality(v_empty) > 0 then to_jsonb(v_empty) end);
    insert into public.transactions (season, week, kind, team_id, details)
    values (p_season, p_week, 'forfeit', c.team_id,
            jsonb_build_object('active', c.active, 'cap_used', c.cap_used, 'over_roster', c.over_roster,
                               'over_cap', c.over_cap, 'lineup_empty', to_jsonb(v_empty), 'dropped', dropped, 'deferred', pend));
    n := n + 1;
  end loop;

  insert into public.compliance_runs (season, week) values (p_season, p_week);
  return n;
end $$;
revoke execute on function public.enforce_compliance_for(int,int,timestamptz) from public, anon, authenticated;

create or replace function public.trg_penalty_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.team_id, 'penalty', format('Penalty: automatic loss for week %s', new.week),
    case coalesce(new.reason, 'cap_roster')
      when 'lineup' then format('Your starting lineup had empty slots (%s) at Sunday 9:55am PT.',
                                (select string_agg(x, ', ') from jsonb_array_elements_text(new.lineup_empty) x))
      when 'cap_roster+lineup' then 'You were not cap/roster legal and your lineup had empty slots at Sunday 9:55am PT. Players added since the previous Sunday were dropped.'
      else 'You were not cap/roster legal at Sunday 9:55am PT. Players added since the previous Sunday were dropped.' end,
    'myteam', format('penalty:%s:%s', new.season, new.week));
  return new;
end $$;

-- ---------- scheduler: carry lineups into the new week + Saturday 9am warning ----------
create or replace function public.lineup_tick() returns void
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); wk int; dl timestamptz; c record;
begin
  if yr is null then return; end if;
  wk := public.league_week(yr);
  perform public.ensure_lineups(yr, wk);
  dl := public.compliance_deadline(yr, wk);
  if dl is null or now() < dl - interval '24 hours 55 minutes' or now() >= dl then return; end if;   -- Sat 9:00am .. Sun 9:55am
  for c in select * from public.lineup_status(yr, wk) where cardinality(empty) > 0 loop
    perform public.notify(c.team_id, 'compliance', 'Your starting lineup has empty slots',
      format('Empty: %s. Fill them by %s or it''s an automatic loss.', array_to_string(c.empty, ', '), public.fmt_pt(dl)),
      'myteam', format('lineup:%s:%s', yr, wk));
  end loop;
end $$;
revoke execute on function public.lineup_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sacverde-lineups';
    perform cron.schedule('sacverde-lineups', '*/5 * * * *', 'select public.lineup_tick()');
  else
    raise notice 'pg_cron not available here — lineup carryover not scheduled.';
  end if;
end $$;

-- ---------- first run: give every team a lineup for the current week ----------
select public.ensure_lineups(public.current_season(), public.league_week(public.current_season()));
