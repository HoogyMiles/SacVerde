import re, openpyxl
SHORT={'Curtain':'Steel Curtain','Nuggles':'3 Nuggles','Roaring Hoogy':'Roaring Hoogy','Purple Reign':'Purple Reign','da bombers':'da bombers','Juggs':'Juggernauts','Assassins':'Assassins','Arms':'Alligator Arms','Hogs':'Milky Wet Hogs','Pool Boy':'Pool Boy','K2s':"K2's Kings",'Rhin-Owned':'Rhin-Owned'}
BID=re.compile(r'^(\d+)\.(\d+) - (.+?) - \$(\d+)$')
POS={'QB','RB','WR','TE','K','DST'}
def parse_week(ws):
    rows=[list(r) for r in ws.iter_rows(values_only=True)]
    out=[]; header=None; pos=None
    for r in rows:
        cells={j:str(v).strip() for j,v in enumerate(r) if v not in (None,'') and str(v).strip()}
        if not cells: continue
        if len(cells)==1 and list(cells.values())[0] in POS: pos=list(cells.values())[0]; header=None; continue
        bids={j:BID.match(s) for j,s in cells.items()}
        if any(bids.values()):
            for j,m in bids.items():
                if m and header and j in header:
                    header[j]['bids'].append(dict(rk=int(m.group(1)),code=int(m.group(2)),team=SHORT.get(m.group(3).strip(),m.group(3).strip()),amt=int(m.group(4))))
            continue
        if pos:   # a row of player names
            header={j:dict(player=s,pos=pos,bids=[]) for j,s in cells.items()}
            out+=header.values()
    return [p for p in out if p['bids']]
if __name__=='__main__':
    wb=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/e6a6abb6-Free_Agency_26.xlsx',read_only=True,data_only=True)
    w2=parse_week(wb['Week 2'])
    for p in w2:
        if p['player'] in ('Antonio Gibson','Josh Jacobs','Rachaad White'): print(p)
