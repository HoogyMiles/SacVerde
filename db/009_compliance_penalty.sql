-- =====================================================================
-- SacVerde League — 009: compliance penalty (decided by Hoogs 2026-10-31)
-- At Sunday 9:55am PT, any team over the $170 cap or the 15-man active
-- roster gets: (1) an automatic loss for that week, and (2) a mandatory drop
-- of every player it acquired (FA add or trade) since the previous Sunday
-- deadline — the transactions that caused the issue.
-- Runs automatically from the 5-minute scheduler. Run AFTER 008.
-- =====================================================================

create table if not exists public.penalties (
  id          bigserial primary key,
  season      int  not null,
  week        int  not null,
  team_id     int  not null references public.teams(id),
  kind        text not null default 'forfeit',
  active      int,
  cap_used    int,
  dropped     jsonb not null default '[]',     -- [{player_id, name, salary}]
  applied_in_yahoo boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (season, week, team_id)
);
create table if not exists public.compliance_runs (
  season int not null, week int not null, ran_at timestamptz not null default now(),
  primary key (season, week)
);
alter table public.penalties enable row level security;
alter table public.compliance_runs enable row level security;
drop policy if exists "members read" on public.penalties;
create policy "members read" on public.penalties for select to authenticated using (public.is_member());
drop policy if exists "commissioner marks yahoo" on public.penalties;
create policy "commissioner marks yahoo" on public.penalties for update to authenticated
  using (public.is_commissioner()) with check (public.is_commissioner());
drop policy if exists "members read" on public.compliance_runs;
create policy "members read" on public.compliance_runs for select to authenticated using (public.is_member());
grant select on public.penalties, public.compliance_runs to authenticated;
grant update (applied_in_yahoo) on public.penalties to authenticated;
grant usage, select on sequence public.penalties_id_seq to authenticated;

-- Core enforcement for one week. p_since = start of the cycle (previous Sunday deadline).
create or replace function public.enforce_compliance_for(p_season int, p_week int, p_since timestamptz)
returns int
language plpgsql security definer set search_path = public as $$
declare
  s public.seasons; c record; n int := 0; dropped jsonb; r record;
begin
  select * into s from public.seasons where year = p_season;
  if exists (select 1 from public.compliance_runs where season = p_season and week = p_week) then return 0; end if;

  for c in select * from public.team_compliance(p_season) where over_roster > 0 or over_cap > 0 loop
    dropped := '[]';
    -- players acquired this cycle that are still on the roster
    for r in
      select distinct on (rs.player_id) rs.id spot_id, rs.player_id, rs.salary, p.name
        from public.transactions t
        join public.roster_spots rs on rs.season = p_season and rs.team_id = c.team_id and rs.player_id = t.player_id
        join public.players p on p.id = rs.player_id
       where t.season = p_season and t.team_id = c.team_id and t.kind in ('add', 'trade_in')
         and t.created_at >= p_since
    loop
      delete from public.roster_spots where id = r.spot_id;
      insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
      values (p_season, p_week, 'forced_drop', c.team_id, r.player_id, r.salary,
              jsonb_build_object('reason', 'not compliant at Sunday 9:55am PT'));
      dropped := dropped || jsonb_build_object('player_id', r.player_id, 'name', r.name, 'salary', r.salary);
    end loop;

    insert into public.penalties (season, week, team_id, kind, active, cap_used, dropped)
    values (p_season, p_week, c.team_id, 'forfeit', c.active, c.cap_used, dropped);
    insert into public.transactions (season, week, kind, team_id, details)
    values (p_season, p_week, 'forfeit', c.team_id,
            jsonb_build_object('active', c.active, 'cap_used', c.cap_used, 'over_roster', c.over_roster,
                               'over_cap', c.over_cap, 'dropped', dropped));
    n := n + 1;
  end loop;

  insert into public.compliance_runs (season, week) values (p_season, p_week);
  return n;
end $$;

-- Scheduler entry point: enforce the current week once its Sunday 9:55am PT deadline passes
create or replace function public.enforce_compliance() returns void
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); lw int; dl timestamptz; prev timestamptz;
begin
  if yr is null then return; end if;
  lw := public.league_week(yr);
  dl := public.compliance_deadline(yr, lw);
  if dl is null or now() < dl then return; end if;
  prev := coalesce(public.compliance_deadline(yr, lw - 1), '-infinity'::timestamptz);
  perform public.enforce_compliance_for(yr, lw, prev);
end $$;

revoke execute on function public.enforce_compliance_for(int,int,timestamptz), public.enforce_compliance() from public, anon, authenticated;

-- Hook into the 5-minute scheduler
create or replace function public.auto_reveal() returns void
language plpgsql security definer set search_path = public as $$
declare w record;
begin
  for w in select id from public.bid_weeks where status = 'open' and bids_close_at <= now() loop
    perform public.resolve_bid_week(w.id);
  end loop;
  update public.seasons set current_week = public.league_week(year) where is_current;
  perform public.enforce_compliance();
  perform public.ensure_open_week();
end $$;
