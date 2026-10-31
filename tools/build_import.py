import json, re
from collections import defaultdict
from standings import standings, TEAMS
from fa_parse import parse_week
import openpyxl
D=json.load(open('out/parsed.json')); teams=D['teams']; off=D['official']
res=json.load(open('out/results2026.json'))
ABBR={'arz':'ARI','ari':'ARI','atl':'ATL','bal':'BAL','buf':'BUF','car':'CAR','chi':'CHI','cin':'CIN','cle':'CLE','dal':'DAL','den':'DEN','det':'DET','gb':'GB','hou':'HOU','ind':'IND','jax':'JAX','jac':'JAX','kc':'KC','lv':'LV','lac':'LAC','lar':'LAR','la':'LAR','mia':'MIA','min':'MIN','ne':'NE','no':'NO','nyg':'NYG','nyj':'NYJ','phi':'PHI','pit':'PIT','sf':'SF','sea':'SEA','tb':'TB','ten':'TEN','was':'WAS','wsh':'WAS'}
def nfl(x): return ABBR.get(str(x or '').strip().lower(),'FA')
def q(v):
    if v is None: return 'null'
    if isinstance(v,bool): return 'true' if v else 'false'
    if isinstance(v,(int,float)): return str(int(v)) if float(v).is_integer() else str(v)
    return "'"+str(v).replace("'","''")+"'"
def norm(n): return re.sub(r'[^a-z0-9]','',re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?','',n.lower()))
FIX_NAME={('caleb williams','det','WR'):'Jameson Williams'}
FIX_SHEET={'Garrett Wllson':'Garrett Wilson'}
# ---- official list -> unique players (name,pos); duplicates keep higher salary
plist={}; dupes=[]
for name,team,pos,rookie,sal,owner,order in off:
    if not pos or not name or name.strip().upper()=='PEIYM': continue
    name=FIX_NAME.get((name.strip().lower(),str(team or '').strip().lower(),pos),name.strip())
    k=(norm(name),pos)
    row=dict(name=name,nfl=nfl(team),pos=pos,rookie=bool(rookie and 'rookie' in str(rookie).lower()),sal=int(sal or 0))
    if k in plist:
        dupes.append((name,pos,plist[k]['nfl'],plist[k]['sal'],row['nfl'],row['sal']))
        if row['sal']>plist[k]['sal']: plist[k]=row
    else: plist[k]=row
# ---- rosters from team sheets (+ in-flight trades not yet on Curtain's sheet)
ADD_TO={'Steel Curtain':[('Derrick Henry','RB'),('George Kittle','TE'),('Chase Brown','RB')]}
ir_week={}
L=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/315b5ce4-SacVerdeLeague2026.xlsx',read_only=True,data_only=True)
for ws in L.worksheets:
    for r in ws.iter_rows(values_only=True):
        for v in r:
            m=re.match(r'moved (.+?) to IR week (\d+)',str(v or ''))
            if m: ir_week[norm(m.group(1))]=int(m.group(2))
spots=[]; flags=[]
for team,d in teams.items():
    for p in d['roster']:
        name=FIX_SHEET.get(p['name'],p['name']); pos=p['pos']
        k=(norm(name),pos)
        if k not in plist:
            cand=[kk for kk in plist if kk[0]==norm(name)]
            if len(cand)==1: k=cand[0]
            else: flags.append(f'NOT FOUND {team}: {name} {pos}'); continue
        spots.append(dict(team=team,key=k,status=p['status'],salary=int(p['salary'] or 0),contract=p['contract'],
                          ir=ir_week.get(norm(name)) if p['status']=='ir' else None))
    for name,pos in ADD_TO.get(team,[]):
        k=(norm(name),pos); spots.append(dict(team=team,key=k,status='active',salary=plist[k]['sal'],contract=None,ir=None,via='trade'))
        flags.append(f'ADDED from TRADES tab: {team} gets {name} at list salary ${plist[k]["sal"]} (confirm contract salary)')
# a player listed both active and on taxi (promoted; stale taxi row) -> keep active
dd={}
for sp in spots:
    k=(sp['team'],sp['key'])
    if k in dd:
        keep=dd[k] if dd[k]['status']=='active' else sp
        flags.append(f"LISTED TWICE on {sp['team']}: {plist[sp['key']]['name']} ({dd[k]['status']} + {sp['status']}) -> kept {keep['status']}")
        dd[k]=keep
    else: dd[k]=sp
spots=list(dd.values())
seen=defaultdict(list)
for s in spots: seen[s['key']].append(s['team'])
for k,v in seen.items():
    if len(v)>1: flags.append(f'ON TWO ROSTERS: {k} {v}')
# ---- SQL
o=["-- =====================================================================",
   "-- SacVerde League — 010: import 2026 season from the league's Google Sheets (2026-10-31)",
   "-- Sources: SacVerdeLeague2026.xlsx (team sheets, results, trades), 2026_SalaryList.xlsx (official list)",
   "-- Run AFTER 009. Safe to re-run (every step checks what already exists).",
   "-- =====================================================================",
   "create schema if not exists sv_import;   -- private staging area (not exposed to the website)",
   "-- names + divisions for 2026",
   "update public.teams set name = 'Purple Reign' where name = 'Tritons';",
   "update public.divisions set name = 'Sailgating Syndicate' where name = 'Deez Knutes';",
   "update public.divisions set name = 'Trojan Tears' where name = 'Gopher Nation';",
   "update public.divisions set name = 'Thunderdome' where name = 'The Kelp Bed';",
   "-- Purple Reign has a new owner (Chris Badley); bids can't be open-week-moved, so swap the login row directly",
   "alter table public.league_members disable trigger members_guard;",
   "delete from public.league_members where team_id = (select id from public.teams where name = 'Purple Reign');",
   "alter table public.league_members enable trigger members_guard;"]
for team,d in teams.items():
    i=d['info']; e=(i.get('Email') or '').strip().lower()
    if not e: continue
    o.append(f"insert into public.league_members (email, team_id, display_name, phone, role) select {q(e)}, id, {q(i.get('Owner'))}, {q(i.get('Phone'))}, {q('commissioner' if team=='Roaring Hoogy' else 'manager')} from public.teams where name = {q(team)} "
             f"on conflict (email) do update set team_id = excluded.team_id, display_name = excluded.display_name, phone = coalesce(excluded.phone, public.league_members.phone);")
o.append("insert into public.transactions (season, kind, details) values (2026, 'member_import', '{\"source\":\"2026 team sheets\"}');")
o.append("-- official 2026 salary list: update existing players, add new ones, retire the rest")
o.append("drop table if exists sv_import.off26; create table sv_import.off26 (name text, pos text, nfl text, rookie boolean, sal int);")
vals=",\n ".join(f"({q(r['name'])},{q(r['pos'])},{q(r['nfl'])},{q(r['rookie'])},{r['sal']})" for r in plist.values())
o.append(f"insert into sv_import.off26 values\n {vals};")
o.append("""drop table if exists sv_import.pmap; create table sv_import.pmap as
  select o.*, (select p.id from public.players p
                where regexp_replace(lower(regexp_replace(p.name,'\\m(jr|sr|ii|iii|iv)\\M\\.?','','gi')),'[^a-z0-9]','','g')
                    = regexp_replace(lower(regexp_replace(o.name,'\\m(jr|sr|ii|iii|iv)\\M\\.?','','gi')),'[^a-z0-9]','','g')
                  and (p.pos = o.pos or (o.pos = 'K' and p.pos = 'P'))
                order by (p.nfl_team = o.nfl) desc, p.id limit 1) as pid
  from sv_import.off26 o;""")
o.append("update public.players p set name = m.name, pos = m.pos, nfl_team = m.nfl, rookie = m.rookie, active = true from sv_import.pmap m where p.id = m.pid;")
o.append("with ins as (insert into public.players (name, pos, nfl_team, rookie) select name, pos, nfl, rookie from sv_import.pmap where pid is null returning id, name, pos) update sv_import.pmap m set pid = ins.id from ins where m.pid is null and ins.name = m.name and ins.pos = m.pos;")
o.append("update public.players set active = false where id not in (select pid from sv_import.pmap where pid is not null);")
o.append("delete from public.player_salaries s where season = 2026 and player_id not in (select pid from sv_import.pmap where pid is not null) and not exists (select 1 from public.bids b where b.player_id = s.player_id);")
o.append("insert into public.player_salaries (season, player_id, list_salary) select 2026, pid, sal from sv_import.pmap on conflict (season, player_id) do update set list_salary = excluded.list_salary;")
o.append("-- 2026 rosters (team sheets + Oct 30-31 trades from the TRADES tab)")
o.append("drop table if exists sv_import.r26; create table sv_import.r26 (team text, name text, pos text, status text, salary int, contract text, ir int, via text);")
rv=",\n ".join(f"({q(s['team'])},{q(plist[s['key']]['name'])},{q(s['key'][1])},{q(s['status'])},{s['salary']},{q(s['contract'])},{q(s['ir'])},{q(s.get('via','keeper'))})" for s in spots)
o.append(f"insert into sv_import.r26 values\n {rv};")
o.append("""insert into public.roster_spots (season, team_id, player_id, status, salary, contract, acquired_via, ir_since_week)
  select 2026, t.id, m.pid, r.status, r.salary, r.contract, case when r.via = 'trade' then 'trade' else 'keeper' end, r.ir
    from sv_import.r26 r join public.teams t on t.name = r.team join sv_import.pmap m on m.name = r.name and m.pos = r.pos
  on conflict (season, player_id) do update set team_id = excluded.team_id, status = excluded.status, salary = excluded.salary,
     contract = excluded.contract, acquired_via = excluded.acquired_via, ir_since_week = excluded.ir_since_week;""")
o.append("-- 2026 results, weeks 1-7")
for wk,h,hs,as_,a in res:
    o.append(f"insert into public.matchups (season, week, home_team, away_team, home_pts, away_pts) select 2026, {wk}, h.id, a.id, {hs}, {as_} from public.teams h, public.teams a where h.name = {q(h)} and a.name = {q(a)} on conflict (season, week, home_team) do update set away_team = excluded.away_team, home_pts = excluded.home_pts, away_pts = excluded.away_pts;")
o.append("-- standings after each week (rank 1 = best). Week 0 = preseason order used by the Week 1 FA sheet.")
o.append("delete from public.standings where season = 2026 and week between 0 and 7;")
wb=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/e6a6abb6-Free_Agency_26.xlsx',read_only=True,data_only=True)
codes={}
for p in parse_week(wb['Week 1']):
    for b in p['bids']: codes[b['team']]=b['code']
missing=[t for t in TEAMS if t not in codes]
used=set(codes.values()); free=[c for c in range(1,13) if c not in used]
for t,c in zip(missing,free): codes[t]=c
for t,c in codes.items(): o.append(f"insert into public.standings (season, week, team_id, rank) select 2026, 0, id, {13-c} from public.teams where name = {q(t)};")
for wk in range(1,8):
    order,rec=standings(wk)
    for i,t in enumerate(order):
        r=rec[t]
        o.append(f"insert into public.standings (season, week, team_id, rank, wins, losses, ties, pf) select 2026, {wk}, id, {i+1}, {r['w']}, {r['l']}, {r['t']}, {round(r['pf'],2)} from public.teams where name = {q(t)};")
o.append("update public.seasons set current_week = public.league_week(2026) where year = 2026;")
o.append("insert into public.transactions (season, kind, details) values (2026, 'season_import', '{\"source\":\"SacVerdeLeague2026.xlsx + 2026_SalaryList.xlsx\"}');")
o.append("drop schema sv_import cascade;   -- clean up staging")
open('/home/claude/repo/db/010_import_2026.sql','w').write("\n".join(o)+"\n")
print('players on official list:',len(plist),'| roster spots:',len(spots))
print('official-list duplicates (kept higher salary):'); [print('  ',d) for d in dupes]
print('flags:'); [print('  ',f) for f in flags]
print('week0 codes:',codes)
