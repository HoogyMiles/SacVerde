import openpyxl, json
from collections import Counter
from fa_parse import parse_week
from standings import standings
wb=openpyxl.load_workbook('/mnt/user-data/attachments/407d527f-37fd-5b43-8982-216eae156fb4/e6a6abb6-Free_Agency_26.xlsx',read_only=True,data_only=True)
T=Counter(); diffs=[]
allweeks={}
for wk in range(1,9):
    P=parse_week(wb[f'Week {wk}']); allweeks[wk]=P
    order,_=standings(wk-1); myrank={t:12-i for i,t in enumerate(order)}
    for p in P:
        b=p['bids']; T['players']+=1; T['bids']+=len(b)
        sheet=[x['team'] for x in sorted(b,key=lambda x:(x['rk'],x['code']))]
        rule_with_sheet_codes=[x['team'] for x in sorted(b,key=lambda x:(-x['amt'],x['code']))]
        site=[x['team'] for x in sorted(b,key=lambda x:(-x['amt'],myrank[x['team']]))]
        if sheet!=rule_with_sheet_codes: T['sheet_internal_inconsistent']+=1
        if max(Counter(x['amt'] for x in b).values())>1: T['players_with_tied_amounts']+=1
        top=[x for x in b if x['amt']==b and 0]
        if sheet==site: T['exact_match']+=1
        else:
            T['order_diff']+=1
            if sheet[:3]!=site[:3]: T['top3_diff']+=1
            if sheet[0]!=site[0]: T['winner_diff']+=1; diffs.append((wk,p['player'],[(x['team'],x['amt'],x['code']) for x in sorted(b,key=lambda x:(x['rk'],x['code']))][:4],site[:4],{t:myrank[t] for t in site[:4]}))
        T[f'wk{wk}_players']+=1
        if sheet[0]!=site[0]: T[f'wk{wk}_winner_diff']+=1
json.dump({str(k):v for k,v in allweeks.items()},open('/home/claude/imp/out/fa_bids_2026.json','w'))
print({k:v for k,v in T.items() if not k.startswith('wk')})
print({k:v for k,v in sorted(T.items()) if k.startswith('wk')})
for d in diffs:
    if d[0]>1: print(d)
