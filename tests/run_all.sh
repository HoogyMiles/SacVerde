#!/bin/bash
# start local postgres, rebuild DB with all migrations, seed test users/bids, serve site, run browser test
pg_isready -h /tmp/pg -p 5433 -q || rm -f /tmp/pg/data/postmaster.pid
pg_isready -h /tmp/pg -p 5433 -q || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg/data -l /tmp/pg/log -o '-k /tmp/pg -p 5433' start" >/dev/null 2>&1; sleep 2
P="psql -h /tmp/pg -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists sv" -c "create database sv" >/dev/null
for f in /home/claude/repo/tests/000_local_supabase_stub.sql /home/claude/repo/db/0*.sql; do $P -d sv -f $f 2>&1 | grep -i error; done
$P -d sv <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001','chrishoogstad@gmail.com'),('00000000-0000-0000-0000-000000000002','chrisbadley@live.com'),('00000000-0000-0000-0000-000000000003','kaiser0505@gmail.com');
insert into bids (bid_week_id, team_id, player_id, amount) select 1, (select id from teams where name='Purple Reign'), id, 2 from players p join player_salaries s on s.player_id=p.id and s.season=2026 where p.active and s.list_salary=4 and p.id not in (select player_id from roster_spots) order by p.id limit 1;
insert into bids (bid_week_id, team_id, player_id, amount) select 1, (select id from teams where name='Pool Boy'), id, 9 from players where name='Jauan Jennings' and active;
SQL
echo "bids seeded: $($P -d sv -tA -c 'select count(*) from bids')"
(python3 -m http.server 8080 -d /home/claude/repo >/tmp/http.log 2>&1 &); sleep 1
cd /home/claude/e2e && timeout 300 python3 ${TEST:-test_site.py}
