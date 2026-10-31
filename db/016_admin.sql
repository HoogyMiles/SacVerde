-- =====================================================================
-- SacVerde League — 016: commissioner admin tools (every change is logged for the league to see)
-- Run AFTER 015. Safe to re-run.
-- =====================================================================

-- Set / move / release a player on a 2026 roster. p_team null = release to free agency.
create or replace function public.admin_set_roster(p_player int, p_team int, p_status text default 'active',
    p_salary int default null, p_contract text default null) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); spot public.roster_spots; nm text; sal int; tname text;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  select name into nm from public.players where id = p_player;
  if nm is null then raise exception 'Player not found.'; end if;
  select * into spot from public.roster_spots where season = yr and player_id = p_player;
  if p_team is null then
    if spot is null then return format('%s is already a free agent.', nm); end if;
    delete from public.roster_spots where id = spot.id;
    insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
    values (yr, public.league_week(yr), 'commissioner_release', spot.team_id, p_player, spot.salary, '{}');
    return format('%s released to free agency.', nm);
  end if;
  if p_status not in ('active','ir','taxi') then raise exception 'Status must be active, ir or taxi.'; end if;
  sal := coalesce(p_salary, spot.salary, (select list_salary from public.player_salaries where season = yr and player_id = p_player), 0);
  select name into tname from public.teams where id = p_team;
  insert into public.roster_spots (season, team_id, player_id, status, salary, contract, acquired_via, acquired_week, ir_since_week)
  values (yr, p_team, p_player, p_status, sal, nullif(trim(p_contract),''), 'commissioner', public.league_week(yr),
          case when p_status = 'ir' then public.league_week(yr) end)
  on conflict (season, player_id) do update set team_id = excluded.team_id, status = excluded.status, salary = excluded.salary,
     contract = coalesce(excluded.contract, public.roster_spots.contract),
     ir_since_week = case when excluded.status = 'ir' then coalesce(public.roster_spots.ir_since_week, excluded.ir_since_week) end;
  insert into public.transactions (season, week, kind, team_id, player_id, amount, details)
  values (yr, public.league_week(yr), 'commissioner_roster', p_team, p_player, sal,
          jsonb_build_object('status', p_status, 'from_team', spot.team_id));
  return format('%s → %s (%s, $%s).', nm, tname, p_status, sal);
end $$;

-- Edit a player's info and listed salary
create or replace function public.admin_set_player(p_player int, p_nfl_team text, p_list_salary int,
    p_name text default null, p_pos text default null, p_rookie boolean default null) returns text
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); old public.players; old_sal int;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  select * into old from public.players where id = p_player;
  if old is null then raise exception 'Player not found.'; end if;
  select list_salary into old_sal from public.player_salaries where season = yr and player_id = p_player;
  update public.players set nfl_team = coalesce(p_nfl_team, nfl_team), name = coalesce(nullif(trim(p_name),''), name),
         pos = coalesce(p_pos, pos), rookie = coalesce(p_rookie, rookie), active = true where id = p_player;
  if p_list_salary is not null then
    insert into public.player_salaries (season, player_id, list_salary) values (yr, p_player, p_list_salary)
    on conflict (season, player_id) do update set list_salary = excluded.list_salary;
  end if;
  insert into public.transactions (season, week, kind, player_id, amount, details)
  values (yr, public.league_week(yr), 'commissioner_player', p_player, p_list_salary,
          jsonb_build_object('nfl_team', jsonb_build_array(old.nfl_team, p_nfl_team), 'list_salary', jsonb_build_array(old_sal, p_list_salary),
                             'name', jsonb_build_array(old.name, coalesce(nullif(trim(p_name),''), old.name))));
  return format('%s updated.', coalesce(nullif(trim(p_name),''), old.name));
end $$;

create or replace function public.admin_add_player(p_name text, p_pos text, p_nfl_team text, p_list_salary int, p_rookie boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); pid int;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if exists (select 1 from public.players where lower(name) = lower(trim(p_name)) and pos = p_pos and active) then
    raise exception '% (%) is already on the salary list.', p_name, p_pos;
  end if;
  insert into public.players (name, pos, nfl_team, rookie) values (trim(p_name), p_pos, p_nfl_team, p_rookie) returning id into pid;
  insert into public.player_salaries (season, player_id, list_salary) values (yr, pid, p_list_salary);
  insert into public.transactions (season, week, kind, player_id, amount, details)
  values (yr, public.league_week(yr), 'commissioner_new_player', pid, p_list_salary, jsonb_build_object('name', p_name, 'pos', p_pos, 'nfl_team', p_nfl_team));
  return pid;
end $$;

create or replace function public.admin_set_pick(p_pick int, p_owner int) returns text
language plpgsql security definer set search_path = public as $$
declare d public.draft_picks;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  select * into d from public.draft_picks where id = p_pick;
  if d is null then raise exception 'Pick not found.'; end if;
  update public.draft_picks set owner_team = p_owner where id = p_pick;
  insert into public.transactions (season, week, kind, team_id, details)
  values (public.current_season(), public.league_week(public.current_season()), 'commissioner_pick', p_owner,
          jsonb_build_object('pick', p_pick, 'year', d.draft_year, 'round', d.round, 'original', d.original_team, 'from_owner', d.owner_team));
  return 'Pick owner updated.';
end $$;

-- Logins: add / change / remove a manager email
create or replace function public.admin_set_member(p_email text, p_team int, p_name text default null, p_phone text default null,
    p_role text default 'manager', p_remove boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That doesn''t look like an email address.'; end if;
  if p_remove then
    if e = (select email from public.league_members where user_id = auth.uid()) then raise exception 'You can''t remove your own login.'; end if;
    delete from public.league_members where email = e;
    return format('%s removed.', e);
  end if;
  if p_role = 'commissioner' and not exists (select 1 from public.league_members where email = e and role = 'commissioner') then
    raise exception 'There is only one commissioner. Change roles from the database if that ever needs to change.';
  end if;
  insert into public.league_members (email, team_id, display_name, phone, role)
  values (e, p_team, nullif(trim(p_name),''), nullif(trim(p_phone),''), p_role)
  on conflict (email) do update set team_id = excluded.team_id, display_name = coalesce(excluded.display_name, public.league_members.display_name),
     phone = coalesce(excluded.phone, public.league_members.phone);
  -- link immediately if this person has already signed in once
  update public.league_members m set user_id = u.id from auth.users u where m.email = e and lower(u.email) = e and m.user_id is null;
  return format('%s saved.', e);
end $$;

-- Full league export (everything the commissioner can see; sealed bids stay sealed)
create or replace function public.admin_export() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'seasons', (select jsonb_agg(to_jsonb(x)) from public.seasons x),
    'teams', (select jsonb_agg(to_jsonb(x)) from public.teams x),
    'divisions', (select jsonb_agg(to_jsonb(x)) from public.divisions x),
    'league_members', (select jsonb_agg(to_jsonb(x) - 'user_id') from public.league_members x),
    'players', (select jsonb_agg(to_jsonb(x)) from public.players x),
    'player_salaries', (select jsonb_agg(to_jsonb(x)) from public.player_salaries x),
    'roster_spots', (select jsonb_agg(to_jsonb(x)) from public.roster_spots x),
    'draft_picks', (select jsonb_agg(to_jsonb(x)) from public.draft_picks x),
    'matchups', (select jsonb_agg(to_jsonb(x)) from public.matchups x),
    'standings', (select jsonb_agg(to_jsonb(x)) from public.standings x),
    'bid_weeks', (select jsonb_agg(to_jsonb(x)) from public.bid_weeks x),
    'revealed_bids', (select jsonb_agg(to_jsonb(b)) from public.bids b join public.bid_weeks w on w.id = b.bid_week_id where w.status = 'revealed'),
    'bid_results', (select jsonb_agg(to_jsonb(x)) from public.bid_results x),
    'trades', (select jsonb_agg(to_jsonb(x)) from public.trades x),
    'trade_items', (select jsonb_agg(to_jsonb(x)) from public.trade_items x),
    'trade_picks', (select jsonb_agg(to_jsonb(x)) from public.trade_picks x),
    'penalties', (select jsonb_agg(to_jsonb(x)) from public.penalties x),
    'transactions', (select jsonb_agg(to_jsonb(x)) from public.transactions x),
    'forum_messages', (select jsonb_agg(to_jsonb(x)) from public.forum_messages x));
end $$;

revoke execute on function public.admin_set_roster(int,int,text,int,text), public.admin_set_player(int,text,int,text,text,boolean),
  public.admin_add_player(text,text,text,int,boolean), public.admin_set_pick(int,int),
  public.admin_set_member(text,int,text,text,text,boolean), public.admin_export() from public, anon;
grant execute on function public.admin_set_roster(int,int,text,int,text), public.admin_set_player(int,text,int,text,text,boolean),
  public.admin_add_player(text,text,text,int,boolean), public.admin_set_pick(int,int),
  public.admin_set_member(text,int,text,text,text,boolean), public.admin_export() to authenticated;
