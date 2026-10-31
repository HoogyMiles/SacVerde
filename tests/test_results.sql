\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com') on conflict do nothing;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003"}',false); set role authenticated;
select set_score((select min(id) from matchups where season=2026 and week=8), 100, 90);   -- manager -> blocked
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false); set role authenticated;
select 'S' || row_number() over () || ' ' || set_score(id, 100 + id % 7, 95 + id % 11) from (select id from matchups where season=2026 and week=8 order by id) g;
reset role;
select 'week 8 standings rows: ' || count(*) from standings where season=2026 and week=8;
select 'leader after wk 8: ' || t.name || ' ' || wins || '-' || losses from standings s join teams t on t.id=s.team_id where season=2026 and week=8 and rank=1;
-- correcting a week 7 score recomputes 7 and 8
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false); set role authenticated;
select 'fix: ' || set_score((select min(id) from matchups where season=2026 and week=7), 1, 200);
reset role;
select 'weeks with standings: ' || string_agg(distinct week::text, ',') from standings where season=2026;
