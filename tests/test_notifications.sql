\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),('00000000-0000-0000-0000-000000000002','chrisbadley@live.com'),('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com') on conflict do nothing;
create function pg_temp.as_user(n int) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n)::text, false) $$;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n and active $$;
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
-- bids by Purple Reign (2) and Pool Boy (3) on Jauan Jennings
select pg_temp.as_user(2); set role authenticated;
insert into bids (bid_week_id, team_id, player_id, amount) select w.id, my_team_id(), pg_temp.pid('Jauan Jennings'), 8 from bid_weeks w where status='open';
update bids set amount = 10 where team_id = my_team_id();
select 'N1 Purple Reign sees own receipt: ' || string_agg(title, ' | ') from notifications;
reset role; select pg_temp.as_user(3); set role authenticated;
insert into bids (bid_week_id, team_id, player_id, amount) select w.id, my_team_id(), pg_temp.pid('Jauan Jennings'), 9 from bid_weeks w where status='open';
select 'N2 Pool Boy sees only own (expect 1): ' || count(*) from notifications;
reset role;
alter table bid_weeks disable trigger bid_week_guard; update bid_weeks set bids_close_at = now() - interval '1 minute' where status='open'; alter table bid_weeks enable trigger bid_week_guard;
select auto_reveal();
select 'N3 reveal alerts: ' || string_agg(t.name || ' -> ' || replace(n.body, E'\n', ' / '), ' || ') from notifications n join teams t on t.id = n.team_id where kind = 'reveal';
-- simulate #2's window opening
update bid_results set window_start = now() - interval '1 minute' where priority = 2;
select notify_windows();
select 'N4 window alert: ' || t.name || ': ' || n.title from notifications n join teams t on t.id = n.team_id where kind = 'window';
select notify_windows();
select 'N5 no duplicate (expect 1): ' || count(*) from notifications where kind = 'window';
-- trade flow
select pg_temp.as_user(2); set role authenticated;
select propose_trade(pg_temp.tid('Roaring Hoogy'), array[pg_temp.pid('Jerry Jeudy')], array[pg_temp.pid('Case Keenum')]);
reset role; select pg_temp.as_user(1); set role authenticated;
select respond_trade((select max(id) from trades), true);
select decide_trade((select max(id) from trades), true, 'ok');
reset role;
select 'N6 trade alerts: ' || string_agg(t.name || ': ' || n.title, ' | ' order by n.id) from notifications n join teams t on t.id = n.team_id where kind = 'trade';
select 'N7 email sender without a provider sends: ' || send_pending_emails();
