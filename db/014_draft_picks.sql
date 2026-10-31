-- =====================================================================
-- SacVerde League — 014: draft pick inventory (2027, 2028) + picks in trades
-- Source: "Draft Picks" box on each team sheet (SacVerdeLeague2026.xlsx), 2026-10-31.
-- One conflict resolved: da bombers' unlabeled 2028 2nd is Pool Boy's (K2's holds da bombers' own
-- 2028 2nd from the Oct 28 Zay Flowers trade, and no team listed Pool Boy's). Flagged for Hoogs.
-- Run AFTER 013. Safe to re-run.
-- =====================================================================
insert into public.draft_picks (draft_year, round, original_team, owner_team)
select v.yr, v.rd, o.id, w.id
  from (values
 (2027,1,'Rhin-Owned','Rhin-Owned'),
 (2027,1,'K2''s Kings','Rhin-Owned'),
 (2027,1,'Milky Wet Hogs','Rhin-Owned'),
 (2027,2,'Rhin-Owned','Rhin-Owned'),
 (2027,3,'Rhin-Owned','Rhin-Owned'),
 (2027,4,'Rhin-Owned','Rhin-Owned'),
 (2027,5,'Rhin-Owned','Rhin-Owned'),
 (2027,6,'Rhin-Owned','Rhin-Owned'),
 (2027,7,'Rhin-Owned','Rhin-Owned'),
 (2027,8,'Rhin-Owned','Rhin-Owned'),
 (2027,9,'Rhin-Owned','Rhin-Owned'),
 (2027,10,'Rhin-Owned','Rhin-Owned'),
 (2028,1,'Rhin-Owned','Rhin-Owned'),
 (2028,2,'Rhin-Owned','Rhin-Owned'),
 (2028,3,'Rhin-Owned','Rhin-Owned'),
 (2028,4,'Rhin-Owned','Rhin-Owned'),
 (2028,5,'Rhin-Owned','Rhin-Owned'),
 (2028,6,'Rhin-Owned','Rhin-Owned'),
 (2028,7,'Rhin-Owned','Rhin-Owned'),
 (2028,8,'Rhin-Owned','Rhin-Owned'),
 (2028,9,'Rhin-Owned','Rhin-Owned'),
 (2028,10,'Rhin-Owned','Rhin-Owned'),
 (2027,1,'Purple Reign','Purple Reign'),
 (2027,3,'Purple Reign','Purple Reign'),
 (2027,5,'Purple Reign','Purple Reign'),
 (2027,6,'Purple Reign','Purple Reign'),
 (2027,7,'Purple Reign','Purple Reign'),
 (2027,8,'Purple Reign','Purple Reign'),
 (2027,9,'Purple Reign','Purple Reign'),
 (2027,10,'Purple Reign','Purple Reign'),
 (2028,1,'Purple Reign','Purple Reign'),
 (2028,2,'Purple Reign','Purple Reign'),
 (2028,3,'Purple Reign','Purple Reign'),
 (2028,4,'Purple Reign','Purple Reign'),
 (2028,5,'Purple Reign','Purple Reign'),
 (2028,6,'Purple Reign','Purple Reign'),
 (2028,7,'Purple Reign','Purple Reign'),
 (2028,8,'Purple Reign','Purple Reign'),
 (2028,9,'Purple Reign','Purple Reign'),
 (2028,10,'Purple Reign','Purple Reign'),
 (2027,2,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,3,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,4,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,5,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,6,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,7,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,8,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,9,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,10,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,1,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,2,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,3,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,4,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,5,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,6,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,7,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,8,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,9,'Milky Wet Hogs','Milky Wet Hogs'),
 (2028,10,'Milky Wet Hogs','Milky Wet Hogs'),
 (2027,1,'Pool Boy','K2''s Kings'),
 (2027,1,'Steel Curtain','K2''s Kings'),
 (2027,2,'da bombers','K2''s Kings'),
 (2027,2,'Purple Reign','K2''s Kings'),
 (2027,3,'K2''s Kings','K2''s Kings'),
 (2027,4,'K2''s Kings','K2''s Kings'),
 (2027,4,'Alligator Arms','K2''s Kings'),
 (2027,5,'K2''s Kings','K2''s Kings'),
 (2027,6,'K2''s Kings','K2''s Kings'),
 (2027,7,'K2''s Kings','K2''s Kings'),
 (2027,8,'K2''s Kings','K2''s Kings'),
 (2027,9,'K2''s Kings','K2''s Kings'),
 (2027,10,'K2''s Kings','K2''s Kings'),
 (2028,1,'K2''s Kings','K2''s Kings'),
 (2028,1,'Steel Curtain','K2''s Kings'),
 (2028,2,'K2''s Kings','K2''s Kings'),
 (2028,2,'da bombers','K2''s Kings'),
 (2028,3,'K2''s Kings','K2''s Kings'),
 (2028,4,'K2''s Kings','K2''s Kings'),
 (2028,5,'K2''s Kings','K2''s Kings'),
 (2028,6,'K2''s Kings','K2''s Kings'),
 (2028,7,'K2''s Kings','K2''s Kings'),
 (2028,8,'K2''s Kings','K2''s Kings'),
 (2028,9,'K2''s Kings','K2''s Kings'),
 (2028,10,'K2''s Kings','K2''s Kings'),
 (2027,1,'3 Nuggles','3 Nuggles'),
 (2027,2,'3 Nuggles','3 Nuggles'),
 (2027,3,'3 Nuggles','3 Nuggles'),
 (2027,4,'3 Nuggles','3 Nuggles'),
 (2027,5,'3 Nuggles','3 Nuggles'),
 (2027,6,'3 Nuggles','3 Nuggles'),
 (2027,7,'3 Nuggles','3 Nuggles'),
 (2027,8,'3 Nuggles','3 Nuggles'),
 (2027,9,'3 Nuggles','3 Nuggles'),
 (2027,10,'3 Nuggles','3 Nuggles'),
 (2028,1,'3 Nuggles','3 Nuggles'),
 (2028,2,'3 Nuggles','3 Nuggles'),
 (2028,3,'3 Nuggles','3 Nuggles'),
 (2028,4,'3 Nuggles','3 Nuggles'),
 (2028,5,'3 Nuggles','3 Nuggles'),
 (2028,6,'3 Nuggles','3 Nuggles'),
 (2028,7,'3 Nuggles','3 Nuggles'),
 (2028,8,'3 Nuggles','3 Nuggles'),
 (2028,9,'3 Nuggles','3 Nuggles'),
 (2028,10,'3 Nuggles','3 Nuggles'),
 (2027,1,'Roaring Hoogy','Roaring Hoogy'),
 (2027,2,'Roaring Hoogy','Roaring Hoogy'),
 (2027,4,'Roaring Hoogy','Roaring Hoogy'),
 (2027,5,'Roaring Hoogy','Roaring Hoogy'),
 (2027,6,'Roaring Hoogy','Roaring Hoogy'),
 (2027,7,'Roaring Hoogy','Roaring Hoogy'),
 (2027,8,'Roaring Hoogy','Roaring Hoogy'),
 (2027,9,'Roaring Hoogy','Roaring Hoogy'),
 (2027,10,'Roaring Hoogy','Roaring Hoogy'),
 (2028,1,'Roaring Hoogy','Roaring Hoogy'),
 (2028,2,'Roaring Hoogy','Roaring Hoogy'),
 (2028,3,'Roaring Hoogy','Roaring Hoogy'),
 (2028,4,'Roaring Hoogy','Roaring Hoogy'),
 (2028,5,'Roaring Hoogy','Roaring Hoogy'),
 (2028,6,'Roaring Hoogy','Roaring Hoogy'),
 (2028,7,'Roaring Hoogy','Roaring Hoogy'),
 (2028,8,'Roaring Hoogy','Roaring Hoogy'),
 (2028,9,'Roaring Hoogy','Roaring Hoogy'),
 (2028,10,'Roaring Hoogy','Roaring Hoogy'),
 (2027,1,'da bombers','da bombers'),
 (2027,3,'da bombers','da bombers'),
 (2027,3,'Roaring Hoogy','da bombers'),
 (2027,4,'da bombers','da bombers'),
 (2027,4,'Purple Reign','da bombers'),
 (2027,4,'Steel Curtain','da bombers'),
 (2027,5,'da bombers','da bombers'),
 (2027,6,'da bombers','da bombers'),
 (2027,7,'da bombers','da bombers'),
 (2027,8,'da bombers','da bombers'),
 (2027,9,'da bombers','da bombers'),
 (2027,10,'da bombers','da bombers'),
 (2028,1,'da bombers','da bombers'),
 (2028,2,'Pool Boy','da bombers'),
 (2028,3,'da bombers','da bombers'),
 (2028,4,'da bombers','da bombers'),
 (2028,5,'da bombers','da bombers'),
 (2028,6,'da bombers','da bombers'),
 (2028,7,'da bombers','da bombers'),
 (2028,8,'da bombers','da bombers'),
 (2028,9,'da bombers','da bombers'),
 (2028,10,'da bombers','da bombers'),
 (2027,1,'Alligator Arms','Alligator Arms'),
 (2027,2,'Alligator Arms','Alligator Arms'),
 (2027,3,'Alligator Arms','Alligator Arms'),
 (2027,5,'Alligator Arms','Alligator Arms'),
 (2027,6,'Alligator Arms','Alligator Arms'),
 (2027,7,'Alligator Arms','Alligator Arms'),
 (2027,8,'Alligator Arms','Alligator Arms'),
 (2027,9,'Alligator Arms','Alligator Arms'),
 (2027,10,'Alligator Arms','Alligator Arms'),
 (2028,1,'Alligator Arms','Alligator Arms'),
 (2028,2,'Alligator Arms','Alligator Arms'),
 (2028,3,'Alligator Arms','Alligator Arms'),
 (2028,4,'Alligator Arms','Alligator Arms'),
 (2028,5,'Alligator Arms','Alligator Arms'),
 (2028,6,'Alligator Arms','Alligator Arms'),
 (2028,7,'Alligator Arms','Alligator Arms'),
 (2028,8,'Alligator Arms','Alligator Arms'),
 (2028,9,'Alligator Arms','Alligator Arms'),
 (2028,10,'Alligator Arms','Alligator Arms'),
 (2027,2,'Pool Boy','Pool Boy'),
 (2027,3,'Pool Boy','Pool Boy'),
 (2027,4,'Pool Boy','Pool Boy'),
 (2027,5,'Pool Boy','Pool Boy'),
 (2027,6,'Pool Boy','Pool Boy'),
 (2027,7,'Pool Boy','Pool Boy'),
 (2027,8,'Pool Boy','Pool Boy'),
 (2027,9,'Pool Boy','Pool Boy'),
 (2027,10,'Pool Boy','Pool Boy'),
 (2028,1,'Pool Boy','Pool Boy'),
 (2028,3,'Pool Boy','Pool Boy'),
 (2028,4,'Pool Boy','Pool Boy'),
 (2028,5,'Pool Boy','Pool Boy'),
 (2028,6,'Pool Boy','Pool Boy'),
 (2028,7,'Pool Boy','Pool Boy'),
 (2028,8,'Pool Boy','Pool Boy'),
 (2028,9,'Pool Boy','Pool Boy'),
 (2028,10,'Pool Boy','Pool Boy'),
 (2027,3,'Steel Curtain','Steel Curtain'),
 (2027,5,'Steel Curtain','Steel Curtain'),
 (2027,6,'Steel Curtain','Steel Curtain'),
 (2027,7,'Steel Curtain','Steel Curtain'),
 (2027,8,'Steel Curtain','Steel Curtain'),
 (2027,9,'Steel Curtain','Steel Curtain'),
 (2027,10,'Steel Curtain','Steel Curtain'),
 (2028,2,'Steel Curtain','Steel Curtain'),
 (2028,4,'Steel Curtain','Steel Curtain'),
 (2028,5,'Steel Curtain','Steel Curtain'),
 (2028,6,'Steel Curtain','Steel Curtain'),
 (2028,7,'Steel Curtain','Steel Curtain'),
 (2028,8,'Steel Curtain','Steel Curtain'),
 (2028,9,'Steel Curtain','Steel Curtain'),
 (2028,10,'Steel Curtain','Steel Curtain'),
 (2027,1,'Juggernauts','Juggernauts'),
 (2027,2,'Juggernauts','Juggernauts'),
 (2027,3,'Juggernauts','Juggernauts'),
 (2027,4,'Juggernauts','Juggernauts'),
 (2027,5,'Juggernauts','Juggernauts'),
 (2027,6,'Juggernauts','Juggernauts'),
 (2027,7,'Juggernauts','Juggernauts'),
 (2027,8,'Juggernauts','Juggernauts'),
 (2027,9,'Juggernauts','Juggernauts'),
 (2027,10,'Juggernauts','Juggernauts'),
 (2028,1,'Juggernauts','Juggernauts'),
 (2028,2,'Juggernauts','Juggernauts'),
 (2028,3,'Juggernauts','Juggernauts'),
 (2028,4,'Juggernauts','Juggernauts'),
 (2028,5,'Juggernauts','Juggernauts'),
 (2028,6,'Juggernauts','Juggernauts'),
 (2028,7,'Juggernauts','Juggernauts'),
 (2028,8,'Juggernauts','Juggernauts'),
 (2028,9,'Juggernauts','Juggernauts'),
 (2028,10,'Juggernauts','Juggernauts'),
 (2027,1,'Assassins','Assassins'),
 (2027,2,'Assassins','Assassins'),
 (2027,2,'K2''s Kings','Assassins'),
 (2027,2,'Steel Curtain','Assassins'),
 (2027,3,'Assassins','Assassins'),
 (2027,4,'Assassins','Assassins'),
 (2027,5,'Assassins','Assassins'),
 (2027,6,'Assassins','Assassins'),
 (2027,7,'Assassins','Assassins'),
 (2027,8,'Assassins','Assassins'),
 (2027,9,'Assassins','Assassins'),
 (2027,10,'Assassins','Assassins'),
 (2028,1,'Assassins','Assassins'),
 (2028,2,'Assassins','Assassins'),
 (2028,3,'Assassins','Assassins'),
 (2028,3,'Steel Curtain','Assassins'),
 (2028,4,'Assassins','Assassins'),
 (2028,5,'Assassins','Assassins'),
 (2028,6,'Assassins','Assassins'),
 (2028,7,'Assassins','Assassins'),
 (2028,8,'Assassins','Assassins'),
 (2028,9,'Assassins','Assassins'),
 (2028,10,'Assassins','Assassins')
  ) v(yr, rd, orig, owner)
  join public.teams o on o.name = v.orig join public.teams w on w.name = v.owner
on conflict (draft_year, round, original_team) do update set owner_team = excluded.owner_team;

-- picks inside trades
create table if not exists public.trade_picks (
  trade_id   bigint not null references public.trades(id) on delete cascade,
  pick_id    int    not null references public.draft_picks(id),
  from_team  int    not null references public.teams(id),
  to_team    int    not null references public.teams(id),
  primary key (trade_id, pick_id)
);
alter table public.trade_picks enable row level security;
drop policy if exists "involved or approved" on public.trade_picks;
create policy "involved or approved" on public.trade_picks for select to authenticated using (
  exists (select 1 from public.trades t where t.id = trade_id));
grant select on public.trade_picks to authenticated;

-- every pick must still belong to the side sending it
create or replace function public.check_trade_picks(p_from int, p_to int, p_give int[], p_get int[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  for r in select x.pid, x.side, d.owner_team, d.draft_year, d.round, o.name orig
             from (select unnest(coalesce(p_give,'{}')) pid, 'give' side union all select unnest(coalesce(p_get,'{}')), 'get') x
             left join public.draft_picks d on d.id = x.pid left join public.teams o on o.id = d.original_team loop
    if r.owner_team is null or (r.side = 'give' and r.owner_team <> p_from) or (r.side = 'get' and r.owner_team <> p_to) then
      raise exception 'The % round % pick (%) isn''t owned by the % anymore.', r.draft_year, r.round, r.orig,
        case r.side when 'give' then 'sending team' else 'receiving team' end;
    end if;
  end loop;
end $$;

drop function if exists public.propose_trade(int,int[],int[],text,text,text);
create or replace function public.propose_trade(p_to_team int, p_give int[], p_get int[],
    p_give_picks int[] default null, p_get_picks int[] default null, p_note text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare me int := public.my_team_id(); yr int := public.current_season(); tid bigint;
begin
  if me is null then raise exception 'You are not on the league list.'; end if;
  if p_to_team = me then raise exception 'You can''t trade with yourself.'; end if;
  if coalesce(array_length(p_give,1),0) + coalesce(array_length(p_get,1),0)
     + coalesce(array_length(p_give_picks,1),0) + coalesce(array_length(p_get_picks,1),0) = 0 then
    raise exception 'Pick at least one player or draft pick.';
  end if;
  if coalesce(array_length(p_give,1),0) + coalesce(array_length(p_get,1),0) > 0 then
    perform public.check_trade(yr, me, p_to_team, p_give, p_get);
  elsif public.trade_deadline(yr) is not null and now() >= public.trade_deadline(yr) then
    raise exception 'The trade deadline (kickoff of week 11) has passed.';
  end if;
  perform public.check_trade_picks(me, p_to_team, p_give_picks, p_get_picks);
  insert into public.trades (season, from_team, to_team, note) values (yr, me, p_to_team, nullif(trim(p_note),'')) returning id into tid;
  insert into public.trade_items (trade_id, player_id, from_team, to_team)
  select tid, unnest(coalesce(p_give,'{}')), me, p_to_team union all select tid, unnest(coalesce(p_get,'{}')), p_to_team, me;
  insert into public.trade_picks (trade_id, pick_id, from_team, to_team)
  select tid, unnest(coalesce(p_give_picks,'{}')), me, p_to_team union all select tid, unnest(coalesce(p_get_picks,'{}')), p_to_team, me;
  return tid;
end $$;

create or replace function public.decide_trade(p_trade bigint, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare t public.trades; give int[]; get int[]; gpk int[]; rpk int[]; lw int; r record;
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
  select array_agg(pick_id) filter (where from_team = t.from_team), array_agg(pick_id) filter (where from_team = t.to_team)
    into gpk, rpk from public.trade_picks where trade_id = t.id;
  if coalesce(array_length(give,1),0) + coalesce(array_length(get,1),0) > 0 then
    perform public.check_trade(t.season, t.from_team, t.to_team, give, get);
  elsif public.trade_deadline(t.season) is not null and now() >= public.trade_deadline(t.season) then
    raise exception 'The trade deadline (kickoff of week 11) has passed.';
  end if;
  perform public.check_trade_picks(t.from_team, t.to_team, gpk, rpk);
  lw := public.league_week(t.season);
  for r in select i.*, rs.salary from public.trade_items i
             join public.roster_spots rs on rs.season = t.season and rs.player_id = i.player_id where i.trade_id = t.id loop
    update public.roster_spots set team_id = r.to_team, acquired_via = 'trade', acquired_week = lw
     where season = t.season and player_id = r.player_id;
    insert into public.transactions (season, week, kind, team_id, player_id, amount, details) values
      (t.season, lw, 'trade_out', r.from_team, r.player_id, r.salary, jsonb_build_object('trade', t.id)),
      (t.season, lw, 'trade_in',  r.to_team,   r.player_id, r.salary, jsonb_build_object('trade', t.id));
  end loop;
  update public.draft_picks d set owner_team = p.to_team from public.trade_picks p where p.trade_id = t.id and d.id = p.pick_id;
  update public.trades set status = 'approved', decided_at = now(), commish_note = nullif(trim(p_note),'') where id = t.id;
  insert into public.transactions (season, week, kind, details)
  values (t.season, lw, 'trade', jsonb_build_object('trade', t.id, 'from', t.from_team, 'to', t.to_team,
          'picks', (select jsonb_agg(jsonb_build_object('pick', pick_id, 'to', to_team)) from public.trade_picks where trade_id = t.id)));
  return 'Trade approved — rosters and draft picks updated. Both teams must be cap- and roster-legal by Sunday 9:55am PT.';
end $$;

grant execute on function public.propose_trade(int,int[],int[],int[],int[],text), public.decide_trade(bigint,boolean,text) to authenticated;
revoke execute on function public.check_trade_picks(int,int,int[],int[]) from public, anon;

-- check: should be 240 picks, 120 per year
select draft_year, count(*) from public.draft_picks group by 1 order by 1;
