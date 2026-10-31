-- SacVerde League — 007: data fixes approved by Hoogs (2026-10-31)
-- David Njoku: Los Angeles Chargers, $4 (not Cleveland $5)
update public.players set nfl_team = 'LAC' where name = 'David Njoku' and pos = 'TE';
update public.player_salaries s set list_salary = 4
  from public.players p where p.id = s.player_id and p.name = 'David Njoku' and p.pos = 'TE' and s.season = 2026;
-- Open the first bid week now (afterwards the scheduler keeps one open automatically)
select public.ensure_open_week();
