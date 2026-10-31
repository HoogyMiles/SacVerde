-- =====================================================================
-- SacVerde League — 002: logins, access rules, sealed bids
-- Run AFTER 001_schema.sql
-- =====================================================================

-- ---------- Helper functions ----------
create or replace function public.my_team_id() returns int
language sql stable security definer set search_path = public as $$
  select team_id from public.league_members where user_id = auth.uid()
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where user_id = auth.uid())
$$;

create or replace function public.is_commissioner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members
                 where user_id = auth.uid() and role = 'commissioner')
$$;

create or replace function public.current_season() returns int
language sql stable as $$ select year from public.seasons where is_current $$;

-- Minimum bid = half the listed salary, rounded to nearest dollar ($5 -> $3)
create or replace function public.min_bid(p_salary int) returns int
language sql immutable as $$ select greatest(1, round(p_salary / 2.0)::int) $$;

-- ---------- Link a login to a team when someone signs in ----------
create or replace function public.link_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.league_members set user_id = new.id
   where email = lower(new.email) and user_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_member();

-- ---------- Bid rules enforced by the database ----------
create or replace function public.check_bid() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w  public.bid_weeks;
  s  public.seasons;
  ls int;
begin
  select * into w from public.bid_weeks where id = new.bid_week_id;
  select * into s from public.seasons   where year = w.season;

  if w.status <> 'open' or now() >= w.bids_close_at then
    raise exception 'Bidding for week % is closed.', w.week;
  end if;
  if s.fa_deadline is not null and now() >= s.fa_deadline then
    raise exception 'The free agent deadline has passed.';
  end if;
  if exists (select 1 from public.roster_spots
              where season = w.season and player_id = new.player_id) then
    raise exception 'That player is already on a roster.';
  end if;

  select list_salary into ls from public.player_salaries
   where season = w.season and player_id = new.player_id;
  if ls is null then
    raise exception 'That player has no listed salary for %.', w.season;
  end if;
  if new.amount < public.min_bid(ls) then
    raise exception 'BID TOO LOW: minimum bid is $% (half of $%).', public.min_bid(ls), ls;
  end if;

  if tg_op = 'UPDATE' then
    if new.team_id <> old.team_id or new.player_id <> old.player_id
       or new.bid_week_id <> old.bid_week_id then
      raise exception 'Only the amount of a bid can be changed.';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger bids_check before insert or update on public.bids
  for each row execute function public.check_bid();

-- Deleting a bid is only allowed while bidding is open
create or replace function public.check_bid_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare w public.bid_weeks;
begin
  select * into w from public.bid_weeks where id = old.bid_week_id;
  if w.status <> 'open' or now() >= w.bids_close_at then
    raise exception 'Bidding is closed; bids can no longer be withdrawn.';
  end if;
  return old;
end $$;

create trigger bids_check_delete before delete on public.bids
  for each row execute function public.check_bid_delete();

-- ---------- Audit: every roster change is logged automatically ----------
create or replace function public.log_roster_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.transactions (season, kind, team_id, player_id, amount, details)
  values (
    coalesce(new.season, old.season),
    case tg_op when 'INSERT' then 'roster_add' when 'DELETE' then 'roster_remove' else 'roster_change' end,
    coalesce(new.team_id, old.team_id),
    coalesce(new.player_id, old.player_id),
    coalesce(new.salary, old.salary),
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );
  return coalesce(new, old);
end $$;

create trigger roster_audit after insert or update or delete on public.roster_spots
  for each row execute function public.log_roster_change();


-- ---------- Seal guards: stop anyone (commissioner included) from peeking early ----------
create or replace function public.guard_bid_week() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'revealed' and old.status <> 'revealed' and now() < old.bids_close_at then
      raise exception 'A bid week cannot be revealed before bids close.';
    end if;
    if new.bids_close_at <> old.bids_close_at
       and exists (select 1 from public.bids where bid_week_id = old.id) then
      raise exception 'Close time cannot change once bids have been placed.';
    end if;
    if old.status = 'revealed' and new.status <> 'revealed' then
      raise exception 'A revealed week cannot be re-sealed.';
    end if;
  end if;
  if tg_op = 'DELETE' and exists (select 1 from public.bids where bid_week_id = old.id) then
    raise exception 'A bid week with bids cannot be deleted.';
  end if;
  insert into public.transactions (season, week, kind, details)
  values (coalesce(new.season, old.season), coalesce(new.week, old.week), 'bid_week_' || lower(tg_op),
          jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
  return coalesce(new, old);
end $$;

create trigger bid_week_guard before insert or update or delete on public.bid_weeks
  for each row execute function public.guard_bid_week();

-- Logins can't be moved between teams while bidding is open (would expose another team's bids),
-- and every change to the member list is logged where the whole league can see it.
create or replace function public.guard_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and (new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id)
     and old.user_id is not null
     and exists (select 1 from public.bid_weeks where status = 'open') then
    raise exception 'Logins cannot be moved between teams while a bid week is open.';
  end if;
  insert into public.transactions (season, kind, team_id, details)
  values (coalesce(public.current_season(), extract(year from now())::int), 'member_' || lower(tg_op),
          coalesce(new.team_id, old.team_id),
          jsonb_build_object('email', coalesce(new.email, old.email),
                             'old_team', old.team_id, 'new_team', new.team_id,
                             'old_role', old.role, 'new_role', new.role));
  return coalesce(new, old);
end $$;

create trigger members_guard before insert or update or delete on public.league_members
  for each row execute function public.guard_members();

-- ---------- Turn on row level security everywhere ----------
alter table public.seasons          enable row level security;
alter table public.divisions        enable row level security;
alter table public.teams            enable row level security;
alter table public.league_members   enable row level security;
alter table public.nfl_teams        enable row level security;
alter table public.nfl_games        enable row level security;
alter table public.players          enable row level security;
alter table public.player_salaries  enable row level security;
alter table public.roster_spots     enable row level security;
alter table public.draft_picks      enable row level security;
alter table public.matchups         enable row level security;
alter table public.standings        enable row level security;
alter table public.bid_weeks        enable row level security;
alter table public.bids             enable row level security;
alter table public.bid_results      enable row level security;
alter table public.transactions     enable row level security;
alter table public.season_archive   enable row level security;
alter table public.forum_messages   enable row level security;
alter table public.forum_reactions  enable row level security;

-- League data: any league member can read; only the commissioner can edit.
do $$
declare t text;
begin
  foreach t in array array['seasons','divisions','teams','nfl_teams','nfl_games','players',
                           'player_salaries','roster_spots','draft_picks','matchups',
                           'standings','bid_weeks','season_archive']
  loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_member())', t);
    execute format('create policy "commissioner writes" on public.%I for all to authenticated using (public.is_commissioner()) with check (public.is_commissioner())', t);
  end loop;
end $$;

-- Contact list: members only. Members can edit their own phone/name; commissioner manages the list.
create policy "members read" on public.league_members
  for select to authenticated using (public.is_member());
create policy "commissioner manages" on public.league_members
  for all to authenticated using (public.is_commissioner()) with check (public.is_commissioner());

-- SEALED BIDS: you see your own team's bids. Nobody — commissioner included —
-- sees anyone else's until the week is revealed.
create policy "see own or revealed" on public.bids
  for select to authenticated using (
    team_id = public.my_team_id()
    or exists (select 1 from public.bid_weeks w where w.id = bid_week_id and w.status = 'revealed')
  );
create policy "place own bids" on public.bids
  for insert to authenticated with check (team_id = public.my_team_id());
create policy "change own bids" on public.bids
  for update to authenticated using (team_id = public.my_team_id()) with check (team_id = public.my_team_id());
create policy "withdraw own bids" on public.bids
  for delete to authenticated using (team_id = public.my_team_id());

create policy "members read revealed results" on public.bid_results
  for select to authenticated using (
    public.is_member() and exists (select 1 from public.bid_weeks w where w.id = bid_week_id and w.status = 'revealed'));

-- Transaction log: read-only for everyone. Only database functions write to it.
create policy "members read" on public.transactions
  for select to authenticated using (public.is_member());

-- Forum
create policy "members read" on public.forum_messages
  for select to authenticated using (public.is_member());
create policy "post as own team" on public.forum_messages
  for insert to authenticated with check (team_id = public.my_team_id() and author = auth.uid());
create policy "delete own or commish" on public.forum_messages
  for delete to authenticated using (author = auth.uid() or public.is_commissioner());

create policy "members read" on public.forum_reactions
  for select to authenticated using (public.is_member());
create policy "react as own team" on public.forum_reactions
  for insert to authenticated with check (team_id = public.my_team_id());
create policy "unreact own" on public.forum_reactions
  for delete to authenticated using (team_id = public.my_team_id());

-- ---------- Table permissions (RLS above still applies) ----------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke insert, update, delete on public.transactions from authenticated;
revoke execute on function public.link_member() from public, anon, authenticated;
