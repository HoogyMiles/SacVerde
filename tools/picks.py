import openpyxl, json, re
from collections import defaultdict
L=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/315b5ce4-SacVerdeLeague2026.xlsx',data_only=True)
TABS={'Rhin-Owned':'Rhin-Owned','Purple Reign':'Purple Reign','Hogs':'Milky Wet Hogs','Kings':"K2's Kings",'Nuggles':'3 Nuggles','Roaring Hoogy':'Roaring Hoogy','da bombers':'da bombers','Arms':'Alligator Arms','Pool Boy':'Pool Boy','Curtain':'Steel Curtain','Juggs':'Juggernauts','Assassins':'Assassins'}
ALIAS={'pool boy':'Pool Boy','curtain':'Steel Curtain','steel curtain':'Steel Curtain','da bombers':'da bombers','bombers':'da bombers','reign':'Purple Reign','purple reign':'Purple Reign','tritons':'Purple Reign',
 'arms':'Alligator Arms','alligator arms':'Alligator Arms','hoogy':'Roaring Hoogy','roaring hoogy':'Roaring Hoogy','k2s':"K2's Kings",'k2':"K2's Kings","k2's kings":"K2's Kings",'kings':"K2's Kings",
 'rynos':'Rhin-Owned','rhin-owned':'Rhin-Owned','rhinos':'Rhin-Owned','hogs':'Milky Wet Hogs','milky wet hogs':'Milky Wet Hogs','juggs':'Juggernauts','juggernauts':'Juggernauts','nuggles':'3 Nuggles','3 nuggles':'3 Nuggles','assassins':'Assassins'}
own=[]; unknown=[]
for tab,team in TABS.items():
    ws=L[tab]; hdr=None
    for row in ws.iter_rows(min_row=1,max_row=4):
        for c in row:
            if c.value=='Draft Picks': hdr=c
    r0,c0=hdr.row,hdr.column
    years={}
    for c in range(c0,c0+6):
        v=ws.cell(r0+1,c).value
        if isinstance(v,(int,float)): years[c]=int(v)
    for c,yr in years.items():
        for r in range(r0+2,r0+20):
            rd=ws.cell(r,c).value
            if not rd: continue
            m=re.match(r'(\d+)',str(rd).strip())
            if not m: continue
            orig=ws.cell(r,c+1).value
            o=team if not orig else ALIAS.get(str(orig).strip().lower())
            if o is None: unknown.append((team,yr,rd,orig)); continue
            own.append(dict(year=yr,round=int(m.group(1)),orig=o,owner=team))
by=defaultdict(list)
for p in own: by[(p['year'],p['round'],p['orig'])].append(p['owner'])
teams=sorted(set(TABS.values()))
missing=[(y,r,t) for y in (2027,2028) for r in range(1,11) for t in teams if (y,r,t) not in by]
dupes={k:v for k,v in by.items() if len(v)>1}
print('picks listed:',len(own),'| unknown origin labels:',unknown)
print('MISSING (nobody lists them):',missing)
print('DUPLICATES (two teams list them):',dupes)
json.dump(own,open('/home/claude/imp/out/picks.json','w'))
