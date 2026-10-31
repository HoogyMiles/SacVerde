-- SacVerde League — 012: Steel Curtain contract salaries from the Oct 30-31 trades (confirmed by Hoogs 2026-10-31)
update public.roster_spots r set salary = v.sal
  from (values ('Derrick Henry', 'RB', 33), ('George Kittle', 'TE', 13), ('Chase Brown', 'RB', 9)) v(name, pos, sal),
       public.players p
 where p.name = v.name and p.pos = v.pos and p.active and r.player_id = p.id and r.season = 2026
   and r.team_id = (select id from public.teams where name = 'Steel Curtain');
-- check: should return 3 rows and Curtain's cap = 191
select p.name, r.salary, public.team_cap_used(r.team_id, 2026) as curtain_cap
  from public.roster_spots r join public.players p on p.id = r.player_id
 where r.season = 2026 and p.name in ('Derrick Henry', 'George Kittle', 'Chase Brown');
