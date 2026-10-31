-- =====================================================================
-- SacVerde League — 018: alerts (in-site now; email copies once an email service is connected)
-- Alerts: bid saved · reveal results · your priority window is open · open window · trade offer /
--         accepted / approved / rejected · Saturday cap-roster warning · penalty applied
-- Run AFTER 017. Safe to re-run.
-- =====================================================================
create table if not exists public.notifications (
  id          bigserial primary key,
  team_id     int  not null references public.teams(id),
  kind        text not null,
  title       text not null,
  body        text,
  view        text,                     -- which page the alert links to
  ref         text,                     -- de-duplication key
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  emailed_at  timestamptz,
  unique (team_id, ref)
);
alter table public.notifications enable row level security;
drop policy if exists "own team" on public.notifications;
create policy "own team" on public.notifications for select to authenticated using (team_id = public.my_team_id());
drop policy if exists "mark own read" on public.notifications;
create policy "mark own read" on public.notifications for update to authenticated
  using (team_id = public.my_team_id()) with check (team_id = public.my_team_id());
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.bid_results add column if not exists window_notified boolean not null default false;
alter table public.bid_results add column if not exists open_notified   boolean not null default false;

create table if not exists public.app_config (key text primary key, value text);
alter table public.app_config enable row level security;   -- no policies: server-side only

create or replace function public.notify(p_team int, p_kind text, p_title text, p_body text, p_view text, p_ref text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (team_id, kind, title, body, view, ref)
  values (p_team, p_kind, p_title, p_body, p_view, p_ref)
  on conflict (team_id, ref) do nothing;
$$;

create or replace function public.fmt_pt(t timestamptz) returns text language sql immutable as $$
  select to_char(t at time zone 'America/Los_Angeles', 'Dy Mon DD, HH12:MI AM') || ' PT' $$;

-- ---------- bid saved (receipt to the bidding team only) ----------
create or replace function public.trg_bid_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare w public.bid_weeks; nm text;
begin
  select * into w from public.bid_weeks where id = new.bid_week_id;
  select name into nm from public.players where id = new.player_id;
  insert into public.notifications (team_id, kind, title, body, view, ref)
  values (new.team_id, 'bid', format('Bid saved: %s for $%s', nm, new.amount),
          format('Week %s bids close %s. You can change or withdraw it until then. Nobody else can see it.', w.week, public.fmt_pt(w.bids_close_at)),
          'bids', format('bid:%s:%s', new.bid_week_id, new.player_id))
  on conflict (team_id, ref) do update set title = excluded.title, body = excluded.body, created_at = now(), read_at = null, emailed_at = null;
  return new;
end $$;
drop trigger if exists bid_notify on public.bids;
create trigger bid_notify after insert or update of amount on public.bids for each row execute function public.trg_bid_notify();

-- ---------- reveal results (each team gets its own summary) ----------
create or replace function public.trg_reveal_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; lines text;
begin
  if new.status = 'revealed' and old.status <> 'revealed' then
    for t in select distinct team_id from public.bid_results where bid_week_id = new.id loop
      select string_agg(format('• %s — #%s at $%s: %s', p.name, r.priority, r.amount,
               case when r.window_end is not null and r.priority = 1 then 'yours to add until ' || public.fmt_pt(r.window_end)
                    when r.window_end is not null then 'your window ' || public.fmt_pt(r.window_start) || ' – ' || public.fmt_pt(r.window_end)
                    else 'open to all bidders from ' || public.fmt_pt(r.open_from) end), E'\n' order by r.priority, p.name)
        into lines from public.bid_results r join public.players p on p.id = r.player_id
       where r.bid_week_id = new.id and r.team_id = t.team_id;
      perform public.notify(t.team_id, 'reveal', format('Week %s bids revealed', new.week),
        lines || E'\nAdd players from the Bid Room → Reveal tab.', 'bids', format('reveal:%s', new.id));
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists reveal_notify on public.bid_weeks;
create trigger reveal_notify after update of status on public.bid_weeks for each row execute function public.trg_reveal_notify();

-- ---------- windows opening (run by the 5-minute scheduler) ----------
create or replace function public.notify_windows() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select b.*, p.name from public.bid_results b join public.players p on p.id = b.player_id
            where b.status = 'pending' and b.priority > 1 and not b.window_notified and b.window_start <= now()
              and (b.window_end is null or b.window_end > now())
              and not exists (select 1 from public.roster_spots s join public.bid_weeks w on w.id = b.bid_week_id
                               where s.season = w.season and s.player_id = b.player_id) loop
    perform public.notify(r.team_id, 'window', format('Your window for %s is open', r.name),
      format('You''re #%s. Add him for $%s until %s from the Bid Room → Reveal tab.', r.priority, r.amount, public.fmt_pt(r.window_end)),
      'bids', format('window:%s:%s', r.bid_week_id, r.player_id));
    update public.bid_results set window_notified = true where bid_week_id = r.bid_week_id and player_id = r.player_id and team_id = r.team_id;
  end loop;
  for r in select b.*, p.name from public.bid_results b join public.players p on p.id = b.player_id
            where b.status = 'pending' and not b.open_notified and b.open_from <= now()
              and (b.kickoff_at is null or b.kickoff_at > now())
              and not exists (select 1 from public.roster_spots s join public.bid_weeks w on w.id = b.bid_week_id
                               where s.season = w.season and s.player_id = b.player_id) loop
    perform public.notify(r.team_id, 'open', format('%s is open to all bidders', r.name),
      format('Nobody added him in their window. Any team that bid can add him now — first come, first served — at their own bid ($%s for you).', r.amount),
      'bids', format('open:%s:%s', r.bid_week_id, r.player_id));
    update public.bid_results set open_notified = true where bid_week_id = r.bid_week_id and player_id = r.player_id and team_id = r.team_id;
  end loop;
end $$;

-- ---------- trades ----------
create or replace function public.trg_trade_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; b text; commish int;
begin
  select name into a from public.teams where id = new.from_team;
  select name into b from public.teams where id = new.to_team;
  select team_id into commish from public.league_members where role = 'commissioner' limit 1;
  if tg_op = 'INSERT' then
    perform public.notify(new.to_team, 'trade', format('Trade offer from %s', a), 'Review it on My Team → Trades.', 'myteam', format('trade:%s:offer', new.id));
  elsif new.status <> old.status then
    if new.status = 'accepted' then
      perform public.notify(new.from_team, 'trade', format('%s accepted your trade', b), 'It''s waiting on commissioner approval.', 'myteam', format('trade:%s:accepted', new.id));
      if commish is not null then
        perform public.notify(commish, 'trade', format('Trade to approve: %s ↔ %s', a, b), 'Approve or reject it on My Team → Trades.', 'myteam', format('trade:%s:approve', new.id));
      end if;
    elsif new.status = 'declined' then
      perform public.notify(new.from_team, 'trade', format('%s declined your trade', b), null, 'myteam', format('trade:%s:declined', new.id));
    elsif new.status in ('approved','rejected') then
      perform public.notify(new.from_team, 'trade', format('Trade with %s %s', b, new.status), new.commish_note, 'myteam', format('trade:%s:%s:a', new.id, new.status));
      perform public.notify(new.to_team, 'trade', format('Trade with %s %s', a, new.status), new.commish_note, 'myteam', format('trade:%s:%s:b', new.id, new.status));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trade_notify on public.trades;
create trigger trade_notify after insert or update of status on public.trades for each row execute function public.trg_trade_notify();

-- ---------- Saturday 9am PT cap/roster warning + penalty notice ----------
create or replace function public.compliance_warnings() returns void
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); lw int; dl timestamptz; c record;
begin
  if yr is null then return; end if;
  lw := public.league_week(yr); dl := public.compliance_deadline(yr, lw);
  if dl is null or now() < dl - interval '24 hours 55 minutes' or now() >= dl then return; end if;   -- Sat 9:00am .. Sun 9:55am
  for c in select * from public.team_compliance(yr) where over_roster > 0 or over_cap > 0 loop
    perform public.notify(c.team_id, 'compliance', 'You are not cap/roster legal for Sunday',
      format('%s active players, $%s of $170. Get legal by %s or it''s an automatic loss and every player added since last Sunday is dropped.',
             c.active, c.cap_used, public.fmt_pt(dl)), 'myteam', format('compliance:%s:%s', yr, lw));
  end loop;
end $$;

create or replace function public.trg_penalty_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.team_id, 'penalty', format('Penalty: automatic loss for week %s', new.week),
    'You were not cap/roster legal at Sunday 9:55am PT. Players added since the previous Sunday were dropped.', 'myteam',
    format('penalty:%s:%s', new.season, new.week));
  return new;
end $$;
drop trigger if exists penalty_notify on public.penalties;
create trigger penalty_notify after insert on public.penalties for each row execute function public.trg_penalty_notify();

-- ---------- email copies (switch on by connecting an email service; see the site's Admin → Email tab) ----------
-- Needs: pg_net extension, a 'email_api_key' secret in Supabase Vault, and app_config rows
--        email_provider ('resend' or 'brevo'), email_from ('SacVerde <alerts@yourdomain.com>'), site_url.
create or replace function public.send_pending_emails() returns int
language plpgsql security definer set search_path = public as $$
declare api_key text; provider text; sender text; site text; n record; sent int := 0; addr text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return 0; end if;
  select c.value into provider from public.app_config c where c.key = 'email_provider';
  select c.value into sender from public.app_config c where c.key = 'email_from';
  select coalesce(c.value, '') into site from public.app_config c where c.key = 'site_url';
  if provider is null or sender is null then return 0; end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''email_api_key'' limit 1' into api_key;
  exception when others then return 0; end;
  if api_key is null then return 0; end if;
  for n in select * from public.notifications
            where emailed_at is null and created_at > now() - interval '1 day'
              and (kind <> 'bid' or created_at < now() - interval '2 minutes')   -- bid receipts wait 2 min so quick edits send once
            order by id limit 50 loop
    for addr in select email from public.league_members where team_id = n.team_id loop
      if provider = 'resend' then
        perform net.http_post(url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', sender, 'to', jsonb_build_array(addr), 'subject', 'SacVerde: ' || n.title,
                                     'text', coalesce(n.body, '') || E'\n\n' || site));
      elsif provider = 'brevo' then
        perform net.http_post(url := 'https://api.brevo.com/v3/smtp/email',
          headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('sender', jsonb_build_object('email', sender, 'name', 'SacVerde League'),
                                     'to', jsonb_build_array(jsonb_build_object('email', addr)),
                                     'subject', 'SacVerde: ' || n.title, 'textContent', coalesce(n.body, '') || E'\n\n' || site));
      end if;
    end loop;
    update public.notifications set emailed_at = now() where id = n.id;
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- ---------- scheduler: everything that runs every 5 minutes ----------
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
  perform public.notify_windows();
  perform public.compliance_warnings();
  perform public.send_pending_emails();
end $$;

revoke execute on function public.notify(int,text,text,text,text,text), public.notify_windows(), public.compliance_warnings(),
  public.send_pending_emails() from public, anon, authenticated;

-- ---------- commissioner: email setup status (the API key itself is only ever entered in Supabase, never on the site) ----------
create or replace function public.email_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare has_key boolean := false;
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  begin
    execute 'select exists (select 1 from vault.decrypted_secrets where name = ''email_api_key'')' into has_key;
  exception when others then has_key := false; end;
  return jsonb_build_object(
    'pg_net', exists (select 1 from pg_extension where extname = 'pg_net'),
    'api_key', has_key,
    'provider', (select value from public.app_config where key = 'email_provider'),
    'from', (select value from public.app_config where key = 'email_from'),
    'site_url', (select value from public.app_config where key = 'site_url'),
    'sent_last_24h', (select count(*) from public.notifications where emailed_at > now() - interval '1 day'));
end $$;

create or replace function public.admin_email_setup(p_provider text, p_from text, p_site_url text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_commissioner() then raise exception 'Commissioner only.'; end if;
  if p_provider not in ('resend','brevo','off') then raise exception 'Provider must be resend, brevo or off.'; end if;
  if p_provider = 'off' then delete from public.app_config where key = 'email_provider'; return 'Email copies turned off.'; end if;
  insert into public.app_config values ('email_provider', p_provider), ('email_from', trim(p_from)), ('site_url', trim(p_site_url))
  on conflict (key) do update set value = excluded.value;
  return 'Email settings saved.';
end $$;
revoke execute on function public.email_status(), public.admin_email_setup(text,text,text) from public, anon;
grant execute on function public.email_status(), public.admin_email_setup(text,text,text) to authenticated;
