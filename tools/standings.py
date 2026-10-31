import json, re, openpyxl
from collections import defaultdict
res=json.load(open('/home/claude/imp/out/results2026.json'))
DIV={'Purple Reign':'S','Rhin-Owned':'S','Milky Wet Hogs':'S',"K2's Kings":'C','Roaring Hoogy':'C','3 Nuggles':'C',
     'da bombers':'T','Alligator Arms':'T','Pool Boy':'T','Assassins':'D','Juggernauts':'D','Steel Curtain':'D'}
TEAMS=list(DIV)
def standings(upto):
    g=[r for r in res if r[0]<=upto]
    rec={t:dict(w=0,l=0,t=0,dw=0,dl=0,dt=0,pf=0.0) for t in TEAMS}; h2h=defaultdict(lambda:[0,0,0])
    for wk,h,hs,as_,a in g:
        for me,ms,op,os in ((h,hs,a,as_),(a,as_,h,hs)):
            r=rec[me]; r['pf']+=ms
            k='w' if ms>os else 'l' if ms<os else 't'
            r[k]+=1; h2h[(me,op)][['w','l','t'].index(k)]+=1
            if DIV[me]==DIV[op]: r['d'+k]+=1
    pct=lambda w,l,t: (w+0.5*t)/(w+l+t) if (w+l+t) else 0
    def key_group(group):
        # sort a tied group: H2H among group, then division pct, then points
        def k(t):
            hw=sum(h2h[(t,o)][0]+0.5*h2h[(t,o)][2] for o in group if o!=t); hg=sum(sum(h2h[(t,o)]) for o in group if o!=t)
            r=rec[t]
            return (-(hw/hg if hg else 0), -pct(r['dw'],r['dl'],r['dt']), -r['pf'])
        return sorted(group,key=k)
    order=[]; by=defaultdict(list)
    for t in TEAMS: by[round(pct(rec[t]['w'],rec[t]['l'],rec[t]['t']),6)].append(t)
    for p in sorted(by,reverse=True): order+=key_group(by[p])
    return order, rec
if __name__=='__main__':
    SHORT={'Curtain':'Steel Curtain','Nuggles':'3 Nuggles','Roaring Hoogy':'Roaring Hoogy','Purple Reign':'Purple Reign','da bombers':'da bombers',
           'Juggs':'Juggernauts','Assassins':'Assassins','Arms':'Alligator Arms','Hogs':'Milky Wet Hogs','Pool Boy':'Pool Boy','K2s':"K2's Kings",'Rhin-Owned':'Rhin-Owned'}
    wb=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/e6a6abb6-Free_Agency_26.xlsx',read_only=True,data_only=True)
    for wk in range(2,9):
        codes={}
        for row in wb[f'Week {wk}'].iter_rows(values_only=True):
            for v in row:
                m=re.match(r'(\d+)\.(\d+) - (.+?) - \$(\d+)',str(v or ''))
                if m: codes[SHORT.get(m.group(3).strip(),m.group(3).strip())]=int(m.group(2))
        order,_=standings(wk-1)
        mine={t:12-i for i,t in enumerate(order)}   # 12 = best ... 1 = worst
        bad={t:(codes[t],mine[t]) for t in codes if codes[t]!=mine[t]}
        print(f'Week {wk} bids (standings after wk {wk-1}): {len(codes)} teams coded, mismatches: {bad}')
