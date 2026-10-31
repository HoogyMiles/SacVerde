import openpyxl, re, json
from collections import Counter, defaultdict
A='/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/'
L=openpyxl.load_workbook(A+'315b5ce4-SacVerdeLeague2026.xlsx',data_only=True)
S=openpyxl.load_workbook(A+'75401938-2026_SalaryList.xlsx',read_only=True,data_only=True)
TABS={'Rhin-Owned':'Rhin-Owned','Purple Reign':'Purple Reign','Hogs':'Milky Wet Hogs','Kings':"K2's Kings",'Nuggles':'3 Nuggles',
      'Roaring Hoogy':'Roaring Hoogy','da bombers':'da bombers','Arms':'Alligator Arms','Pool Boy':'Pool Boy','Curtain':'Steel Curtain','Juggs':'Juggernauts','Assassins':'Assassins'}
ABBR={'arz':'ARI','ari':'ARI','atl':'ATL','bal':'BAL','buf':'BUF','car':'CAR','chi':'CHI','cin':'CIN','cle':'CLE','dal':'DAL','den':'DEN','det':'DET','gb':'GB','hou':'HOU','ind':'IND','jax':'JAX','jac':'JAX','kc':'KC','lv':'LV','lac':'LAC','lar':'LAR','la':'LAR','mia':'MIA','min':'MIN','ne':'NE','no':'NO','nyg':'NYG','nyj':'NYJ','phi':'PHI','pit':'PIT','sf':'SF','sea':'SEA','tb':'TB','ten':'TEN','was':'WAS','wsh':'WAS'}
def nfl(x): return ABBR.get(str(x or '').strip().lower(),'FA')
def norm(n): return re.sub(r'[^a-z0-9]','',re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?','',n.lower()))
teams={}
for tab,team in TABS.items():
    ws=L[tab]; rows=[[c for c in r] for r in ws.iter_rows(values_only=True)]
    info={}; roster=[]; in_roster=False
    for r in rows:
        r=list(r)+[None]*40
        if r[2]=='ROSTER': in_roster=True; continue
        if r[2]=='SCHEDULE': in_roster=False
        slot=r[2]
        # team info column K/L (index 10/11)
        if r[10] in ('Owner','Owners','Phone','Email','Division'): info[r[10].rstrip('s')]=r[11]
        if not in_roster or slot is None or r[4] in (None,'',0,'0'): continue
        s=str(slot).strip()
        if s=='IR': status='ir'
        elif s.startswith('Taxi'): status='taxi'
        elif re.fullmatch(r'\d+(\.0)?',s) and 1<=float(s)<=15 and r[3]: status='active'
        else: continue
        raw=str(r[4]).strip(); m=re.search(r'\((\w+)\)\s*$',raw)
        name=re.sub(r'\s*\(\w+\)\s*$','',raw).strip()
        roster.append(dict(name=name,contract=m.group(1) if m else None,pos=str(r[3]).upper() if r[3] else None,nfl=nfl(r[7]),salary=r[8],status=status))
    teams[team]=dict(info=info,roster=roster)
off=[r for r in list(S['2026 SalaryList'].iter_rows(values_only=True))[1:] if r[0]]
json.dump(dict(teams=teams,official=[list(r[:7]) for r in off]),open('/home/claude/imp/out/parsed.json','w'),default=str)
for t,d in teams.items():
    c=Counter(p['status'] for p in d['roster'])
    print(f"{t:16} {dict(c)}  owner={d['info'].get('Owner')}  email={d['info'].get('Email')}")
# cross-check with official ownership
offown=defaultdict(set)
for r in off:
    if r[5]: offown[r[5]].add(norm(r[0]))
for t,d in teams.items():
    sheet={norm(p['name']) for p in d['roster']}
    a=sheet-offown[t]; b=offown[t]-sheet
    if a or b: print('MISMATCH',t,'on team sheet only:',a,'| on salary list only:',b)
offidx=defaultdict(list)
for r in off: offidx[norm(r[0])].append(r)
nomatch=[(t,p['name']) for t,d in teams.items() for p in d['roster'] if norm(p['name']) not in offidx]
print('roster players not on official list:',nomatch)
