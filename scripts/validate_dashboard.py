import json, math, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'

def load(name):
    return json.loads((DATA/name).read_text(encoding='utf-8'))

def finite(v):
    try:return v is not None and math.isfinite(float(v))
    except:return False

def values(rows,key):
    return [float(r[key]) for r in rows if key in r and finite(r.get(key))]

def check_range(vals,lo,hi,label,errors):
    bad=[v for v in vals if not (lo<=v<=hi)]
    if bad: errors.append(f'{label}: {len(bad)} value(s) outside [{lo},{hi}], examples={bad[:5]}')

def main():
    players,teams,league,eras=map(load,['players.json','teams.json','league.json','era_summary.json'])
    era_names=[e['era'] for e in eras]
    errors=[];warnings=[];checks=0;report=[]
    LM=['ppg','pace','x3pa_pg','x3p_pct','fta_pg','pf_pg','blk_pg','ast_pg','tov_pg','dunks_pg','corner3_att_pg']
    PM={'vorp':None,'ws':None,'pts':None,'ppg':('g',200),'trb':None,'rpg':('g',200),'ast':None,'apg':('g',200),'stl':None,'blk':None,'bpg':('g',200),'x3p':None,'x3p_pct':('x3pa',500),'ft':None,'fta':None,'ft_pct':('fta',500),'ts_pct_calc':('fga',2000),'per_w':('g',200),'bpm_w':('g',200),'ws48_calc':('mp',5000),'pf':None,'tov':None,'trp_dbl':None,'num_of_dunks':None,'dunks_pg':('g',100),'corner3_pct_w':('corner3_att_est',200),'shooting_foul_drawn':None,'offensive_foul_drawn':None,'and1':None}
    TM=['win_pct','w','srs','n_rtg','o_rtg','d_rtg','pace','pts_pg','x3pa_pg','blk_pg']
    SH=['zone_0_3_share','zone_3_10_share','zone_10_16_share','zone_16_3p_share','zone_3p_share','corner3_att_pg','corner3_pct','dunks_pg']

    for era in era_names:
        L=[r for r in league if r.get('era')==era];P=[r for r in players if r.get('era')==era];T=[r for r in teams if r.get('era')==era]
        for m in LM:
            n=len(values(L,m));checks+=1;report.append(['league',era,m,n])
            if n==0:errors.append(f'league {era} / {m}: empty')
        for m,q in PM.items():
            rows=[r for r in P if finite(r.get(m))]
            if q:rows=[r for r in rows if finite(r.get(q[0])) and float(r[q[0]])>=q[1]]
            n=len(rows);checks+=1;report.append(['player',era,m,n]);expected=era.startswith('1988') and m=='offensive_foul_drawn'
            if n==0 and not expected:errors.append(f'player {era} / {m}: empty')
            if n==0 and expected:warnings.append(f'expected N/D: player {era} / {m}')
        for m in TM:
            n=len(values(T,m));checks+=1;report.append(['team',era,m,n])
            if n==0:errors.append(f'team {era} / {m}: empty')
        shot=[r for r in L if int(r.get('season',0))>=1997]
        for m in SH:
            n=len(values(shot,m));checks+=1;report.append(['shooting',era,m,n])
            if n==0:errors.append(f'shooting {era} / {m}: empty')
        for m in ['pf_pg','fta_pg']:
            n=len(values(L,m));checks+=1;report.append(['fouls',era,m,n])
            if n==0:errors.append(f'fouls {era} / {m}: empty')
        pbp=[r for r in L if int(r.get('season',0))>=1997]
        for m in ['shooting_fouls_drawn_pg','and1_pg']:
            n=len(values(pbp,m));checks+=1;report.append(['pbp',era,m,n])
            if n==0:errors.append(f'pbp {era} / {m}: empty')
        n=len(values(pbp,'off_fouls_drawn_pg'));checks+=1;report.append(['pbp',era,'off_fouls_drawn_pg',n])
        if n==0 and not era.startswith('1988'):errors.append(f'pbp {era} / off_fouls_drawn_pg: empty')
        elif n==0:warnings.append(f'expected N/D: pbp {era} / off_fouls_drawn_pg')

    check_range(values(league,'x3p_pct'),0,1,'league x3p_pct',errors);check_range(values(league,'corner3_pct'),0,1,'league corner3_pct',errors)
    for m in ['zone_0_3_share','zone_3_10_share','zone_10_16_share','zone_16_3p_share','zone_3p_share']:check_range(values(league,m),0,1,f'league {m}',errors)
    check_range(values(league,'pf_pg'),10,40,'league pf_pg',errors);check_range(values(league,'fta_pg'),10,45,'league fta_pg',errors);check_range(values(league,'dunks_pg'),0,10,'league dunks_pg',errors);check_range(values(league,'corner3_att_pg'),0,20,'league corner3_att_pg',errors);check_range(values(league,'pace'),70,120,'league pace',errors);check_range(values(teams,'win_pct'),0,1,'team win_pct',errors)
    check_range([float(r['x3p_pct']) for r in players if finite(r.get('x3p_pct')) and finite(r.get('x3pa')) and float(r['x3pa'])>=500],0,1,'qualified player x3p_pct',errors)
    check_range([float(r['ft_pct']) for r in players if finite(r.get('ft_pct')) and finite(r.get('fta')) and float(r['fta'])>=500],0,1,'qualified player ft_pct',errors)
    check_range([float(r['ts_pct_calc']) for r in players if finite(r.get('ts_pct_calc')) and finite(r.get('fga')) and float(r['fga'])>=2000],0,1,'qualified player ts_pct_calc',errors)

    result={'status':'PASS' if not errors else 'FAIL','checks':checks,'errors':errors,'warnings':warnings,'matrix':report}
    (DATA/'qa_report.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({k:result[k] for k in ['status','checks','errors','warnings']},ensure_ascii=False,indent=2))
    if errors:sys.exit(1)

if __name__=='__main__':main()
