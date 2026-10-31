\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com') on conflict do nothing;
create function pg_temp.pid(n text) returns int language sql as $$ select id from players where name = n and active $$;
create function pg_temp.tid(n text) returns int language sql as $$ select id from teams where name = n $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003"}',false); set role authenticated;
select admin_set_roster(pg_temp.pid('Romeo Doubs'), pg_temp.tid('Pool Boy'));                  -- manager -> blocked
select 'export as manager: ' || (admin_export() is not null)::text;                             -- blocked
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',false); set role authenticated;
select 'A1 ' || admin_set_roster(pg_temp.pid('Romeo Doubs'), pg_temp.tid('Pool Boy'), 'active', 13);
select 'A2 ' || admin_set_roster(pg_temp.pid('Romeo Doubs'), null);
select 'A3 ' || admin_set_player(pg_temp.pid('Tyreek Hill'), 'KC', 3);
select 'A4 new id ' || admin_add_player('Test Rookie', 'WR', 'DAL', 2, true);
select admin_add_player('Test Rookie', 'WR', 'DAL', 2, true);                                   -- duplicate -> blocked
select 'A5 ' || admin_set_pick((select id from draft_picks where draft_year=2028 and round=10 and original_team=pg_temp.tid('Pool Boy')), pg_temp.tid('Assassins'));
select 'A6 ' || admin_set_member('NewGuy@Example.com', pg_temp.tid('Pool Boy'), 'New Guy');
select admin_set_member('bad-email', pg_temp.tid('Pool Boy'));                                  -- blocked
select 'A7 ' || admin_set_member('newguy@example.com', pg_temp.tid('Pool Boy'), null, null, 'manager', true);
select 'A8 export keys: ' || (select count(*) from jsonb_object_keys(admin_export()));
reset role;
select 'A9 Tyreek Hill: ' || nfl_team from players where id = pg_temp.pid('Tyreek Hill');
select 'A10 log: ' || string_agg(kind, ', ' order by id) from transactions where kind like 'commissioner%';
