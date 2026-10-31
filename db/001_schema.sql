-- =====================================================================
-- SacVerde League — 001: core schema
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- ---------- League structure ----------
create table public.seasons (
  year            int primary key,
  salary_cap      int  not null default 170,
  roster_size     int  not null default 15,
  max_ir          int  not null default 2,
  ir_min_weeks    int  not null default 3,
  max_taxi        int  not null default 4,
  current_week    int  not null default 1,
  fa_deadline     timestamptz,            -- kickoff of the final NFL bye week
  is_current      boolean not null default false
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.divisions (
  id    serial primary key,
  name  text not null unique
);

create table public.teams (
  id           serial primary key,
  name         text not null unique,
  division_id  int references public.divisions(id)
);

-- Who is allowed in, and which team they run. Email is the login.
create table public.league_members (
  email         text primary key check (email = lower(email)),
  team_id       int  not null references public.teams(id),
  display_name  text,
  phone         text,
  role          text not null default 'manager' check (role in ('manager','commissioner')),
  user_id       uuid unique references auth.users(id) on delete set null
);

-- ---------- NFL ----------
create table public.nfl_teams (
  abbr  text primary key,       -- 'DET', 'FA' for free agent
  name  text not null unique
);

create table public.nfl_games (
  id          serial primary key,
  season      int  not null,
  week        int  not null,
  home        text not null references public.nfl_teams(abbr),
  away        text not null references public.nfl_teams(abbr),
  kickoff_at  timestamptz not null,
  unique (season, week, home)
);

create table public.players (
  id          serial primary key,
  name        text not null,
  pos         text not null check (pos in ('QB','RB','WR','TE','K','P','DST')),
  nfl_team    text not null references public.nfl_teams(abbr),
  jersey      int,
  height      text,
  weight      int,
  experience  text,
  college     text,
  rookie      boolean not null default false,
  yahoo_id    text unique,
  active      boolean not null default true
);
create index players_name_idx on public.players (lower(name));

-- The yearly salary list
create table public.player_salaries (
  season        int not null references public.seasons(year),
  player_id     int not null references public.players(id) on delete cascade,
  list_salary   int not null check (list_salary >= 0),
  avg_pos_rank  numeric,
  pos_finish    int,
  sources_used  int,
  primary key (season, player_id)
);

-- ---------- Rosters ----------
create table public.roster_spots (
  id             serial primary key,
  season         int  not null references public.seasons(year),
  team_id        int  not null references public.teams(id),
  player_id      int  not null references public.players(id),
  status         text not null default 'active' check (status in ('active','ir','taxi')),
  salary         int  not null check (salary >= 0),   -- contract salary (winning bid etc.)
  contract       text,
  acquired_via   text not null default 'draft' check (acquired_via in ('draft','keeper','fa_bid','trade','commissioner')),
  acquired_week  int,
  ir_since_week  int,
  unique (season, player_id)          -- a player can only be on one team
);
create index roster_team_idx on public.roster_spots (season, team_id);

create table public.draft_picks (
  id             serial primary key,
  draft_year     int  not null,
  round          int  not null,
  original_team  int  not null references public.teams(id),
  owner_team     int  not null references public.teams(id),
  unique (draft_year, round, original_team)
);

-- ---------- Weekly results ----------
create table public.matchups (
  id        serial primary key,
  season    int not null,
  week      int not null,
  home_team int not null references public.teams(id),
  away_team int not null references public.teams(id),
  home_pts  numeric,
  away_pts  numeric,
  playoff   boolean not null default false,
  unique (season, week, home_team)
);

-- Standings AFTER a given week's games; rank 1 = best (tiebreakers already applied)
create table public.standings (
  season   int not null,
  week     int not null,
  team_id  int not null references public.teams(id),
  rank     int not null,
  wins     int not null default 0,
  losses   int not null default 0,
  ties     int not null default 0,
  pf       numeric not null default 0,
  pa       numeric not null default 0,
  primary key (season, week, team_id),
  unique (season, week, rank)
);

-- ---------- Blind bidding ----------
create table public.bid_weeks (
  id             serial primary key,
  season         int not null references public.seasons(year),
  week           int not null,                 -- the league week the players are bid FOR
  bids_close_at  timestamptz not null,         -- Tuesday 9:00pm PT
  status         text not null default 'open' check (status in ('open','closed','revealed')),
  revealed_at    timestamptz,
  unique (season, week)
);

create table public.bids (
  id           bigserial primary key,
  bid_week_id  int not null references public.bid_weeks(id),
  team_id      int not null references public.teams(id),
  player_id    int not null references public.players(id),
  amount       int not null check (amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (bid_week_id, team_id, player_id)
);

-- Filled in by the reveal: every bidder on every player, in priority order
create table public.bid_results (
  bid_week_id   int not null references public.bid_weeks(id),
  player_id     int not null references public.players(id),
  team_id       int not null references public.teams(id),
  priority      int not null,                   -- 1 = winning bid
  amount        int not null,
  window_start  timestamptz,
  window_end    timestamptz,                    -- null = open (first come, first served)
  status        text not null default 'pending' check (status in ('pending','claimed','expired','passed')),
  primary key (bid_week_id, player_id, team_id),
  unique (bid_week_id, player_id, priority)
);

-- ---------- League transaction log (append-only) ----------
create table public.transactions (
  id          bigserial primary key,
  season      int not null,
  week        int,
  kind        text not null,       -- add, drop, trade, ir_on, ir_off, taxi_promote, bid_win, commissioner_edit...
  team_id     int references public.teams(id),
  player_id   int references public.players(id),
  amount      int,
  details     jsonb not null default '{}',
  actor       uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------- Archive (past seasons, financials) ----------
create table public.season_archive (
  season  int not null,
  kind    text not null,           -- 'team_history', 'financials', 'draft', 'team_page'
  key     text not null default '',
  data    jsonb not null,
  primary key (season, kind, key)
);

-- ---------- Forum ----------
create table public.forum_messages (
  id          bigserial primary key,
  team_id     int not null references public.teams(id),
  author      uuid not null default auth.uid() references auth.users(id),
  body        text check (char_length(body) <= 4000),
  media_url   text,
  created_at  timestamptz not null default now()
);
create table public.forum_reactions (
  message_id  bigint not null references public.forum_messages(id) on delete cascade,
  team_id     int not null references public.teams(id),
  emoji       text not null check (emoji in ('👍','🔥','😂','💀')),
  primary key (message_id, team_id, emoji)
);
