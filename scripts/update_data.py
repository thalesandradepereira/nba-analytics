import io,json
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import quote
import numpy as np,pandas as pd,requests

BASE='https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data'
OUT=Path(__file__).resolve().parents[1]/'data'; OUT.mkdir(exist_ok=True)
FILES={'tot':'Player Totals.csv','adv':'Advanced.csv','shot':'Player Shooting.csv','pbp':'Player Play By Play.csv','tt':'Team Totals.csv','ts':'Team Summaries.csv'}
S=requests.Session(); S.headers['User-Agent']='nba-analytics-by-tap/1.0'

def csv(name,required=True):
    try:
        r=S.get(f'{BASE}/{quote(name)}',timeout=180); r.raise_for_status(); d=pd.read_csv(io.BytesIO(r.content),low_memory=False); print(name,len(d)); return d
    except Exception as e:
        if required: raise
        print('optional source unavailable',name,e); return pd.DataFrame()

def nba(d):
    if d.empty:return d
    d=d.copy()
    if 'lg' in d:d=d[d.lg.astype(str).str.upper().eq('NBA')]
    d['season']=pd.to_numeric(d.season,errors='coerce'); d=d[d.season.ge(1989)]; d['season']=d.season.astype(int); return d.reset_index(drop=True)

def lab(y):return f'{y-1}-{str(y)[-2:]}'
def era(y,cur):return '1988-89 a 1999-00' if y<=2000 else ('2000-01 a 2009-10' if y<=2010 else f'2010-11 a {lab(cur)}')
def num(d,cols):
    for c in cols:
        if c in d:d[c]=pd.to_numeric(d[c],errors='coerce')
    return d

def one(d):
    if d.empty:return d
    d=nba(d)
    if 'team' not in d:return d.drop_duplicates(['season','player_id'])
    d['_a']=d.team.astype(str).str.match(r'^\d+TM$').astype(int)
    return d.sort_values(['season','player_id','_a'],ascending=[1,1,0]).drop_duplicates(['season','player_id']).drop(columns='_a')

def wavg(g,c,w):
    if c not in g or w not in g:return None
    x=pd.to_numeric(g[c],errors='coerce'); z=pd.to_numeric(g[w],errors='coerce'); m=x.notna()&z.gt(0)&z.notna()
    return float(np.average(x[m],weights=z[m])) if m.any() else None

def sm(g,c):
    if c not in g:return None
    x=pd.to_numeric(g[c],errors='coerce'); return float(x.sum()) if x.notna().any() else None

def div(a,b):
    try:return None if a is None or b is None or pd.isna(a) or pd.isna(b) or float(b)==0 else float(a)/float(b)
    except:return None

def player_data(src,cur):
    raw=nba(src['tot']); actual=raw[~raw.team.astype(str).str.match(r'^\d+TM$')] if 'team' in raw else raw
    teammap=actual.groupby(['season','player_id']).team.agg(lambda x:', '.join(dict.fromkeys(map(str,x.dropna())))).to_dict() if 'team' in actual else {}
    d=one(raw)
    for k in ['adv','shot','pbp']:
        x=one(src[k]);
        if x.empty:continue
        x=x.drop(columns=[c for c in ['player','lg','age','pos','team'] if c in x],errors='ignore')
        overlap=[c for c in x if c in d and c not in ['season','player_id']]; x=x.rename(columns={c:c+'_'+k for c in overlap})
        d=d.merge(x,on=['season','player_id'],how='left')
    d['era']=d.season.map(lambda y:era(int(y),cur))
    sums=['g','gs','mp','fg','fga','x3p','x3pa','x2p','x2pa','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf','pts','trp_dbl','ows','dws','ws','vorp','num_of_dunks','bad_pass_turnover','lost_ball_turnover','shooting_foul_committed','offensive_foul_committed','shooting_foul_drawn','offensive_foul_drawn','points_generated_by_assists','and1','fga_blocked']
    avgs=['per','usg_percent','obpm','dbpm','bpm','on_court_plus_minus_per_100_poss','net_plus_minus_per_100_poss']
    shots=['avg_dist_fga','percent_fga_from_x0_3_range','percent_fga_from_x3_10_range','percent_fga_from_x10_16_range','percent_fga_from_x16_3p_range','percent_fga_from_x3p_range','fg_percent_from_x0_3_range','fg_percent_from_x3_10_range','fg_percent_from_x10_16_range','fg_percent_from_x16_3p_range','fg_percent_from_x3p_range','percent_dunks_of_fga','percent_corner_3s_of_3pa','corner_3_point_percent']
    d=num(d,sums+avgs+shots+['age'])
    out=[]
    for (e,pid,p),g in d.groupby(['era','player_id','player'],dropna=False):
        r={'era':e,'player_id':pid,'player':p,'seasons':int(g.season.nunique()),'season_start':lab(int(g.season.min())),'season_end':lab(int(g.season.max()))}
        po=g.pos.dropna().astype(str) if 'pos' in g else pd.Series(dtype=str); r['pos']=po.mode().iloc[0] if len(po) else None
        r['age_min']=float(g.age.min()) if 'age' in g and g.age.notna().any() else None; r['age_max']=float(g.age.max()) if 'age' in g and g.age.notna().any() else None
        tc=[]
        for y in g.season:
            for t in teammap.get((int(y),pid),'').split(', '):
                if t and t not in tc:tc.append(t)
        r['teams']=', '.join(tc)
        for c in sums:r[c]=sm(g,c)
        G=r.get('g'); MP=r.get('mp')
        for n,c in [('ppg','pts'),('rpg','trb'),('apg','ast'),('spg','stl'),('bpg','blk'),('tov_pg','tov'),('pf_pg','pf'),('x3pm_pg','x3p'),('fta_pg','fta'),('ftm_pg','ft'),('dunks_pg','num_of_dunks')]:r[n]=div(r.get(c),G)
        r['fg_pct']=div(r.get('fg'),r.get('fga'));r['x3p_pct']=div(r.get('x3p'),r.get('x3pa'));r['x2p_pct']=div(r.get('x2p'),r.get('x2pa'));r['ft_pct']=div(r.get('ft'),r.get('fta'));r['efg_pct']=div((r.get('fg') or 0)+.5*(r.get('x3p') or 0),r.get('fga'));r['ts_pct_calc']=div(r.get('pts'),2*((r.get('fga') or 0)+.44*(r.get('fta') or 0)));r['ws48_calc']=div((r.get('ws') or 0)*48,MP)
        for c in avgs:r[c+'_w']=wavg(g,c,'mp')
        for key,sh,pc in [('0_3','percent_fga_from_x0_3_range','fg_percent_from_x0_3_range'),('3_10','percent_fga_from_x3_10_range','fg_percent_from_x3_10_range'),('10_16','percent_fga_from_x10_16_range','fg_percent_from_x10_16_range'),('16_3p','percent_fga_from_x16_3p_range','fg_percent_from_x16_3p_range'),('3p','percent_fga_from_x3p_range','fg_percent_from_x3p_range')]:
            r[f'zone_{key}_share_w']=wavg(g,sh,'fga');r[f'zone_{key}_pct_w']=wavg(g,pc,'fga');r[f'zone_{key}_att_est']=sm(pd.DataFrame({'v':pd.to_numeric(g.get(sh),errors='coerce')*pd.to_numeric(g.get('fga'),errors='coerce')}),'v') if sh in g and 'fga' in g else None
        r['avg_dist_fga_w']=wavg(g,'avg_dist_fga','fga');r['dunk_share_est']=wavg(g,'percent_dunks_of_fga','fga');r['corner3_pct_w']=wavg(g,'corner_3_point_percent','x3pa');r['corner3_share_3pa_w']=wavg(g,'percent_corner_3s_of_3pa','x3pa')
        r['corner3_att_est']=float((pd.to_numeric(g.percent_corner_3s_of_3pa,errors='coerce')*pd.to_numeric(g.x3pa,errors='coerce')).sum()) if 'percent_corner_3s_of_3pa' in g and 'x3pa' in g else None
        r['shooting_coverage_note']='Shot/PBP available from 1996-97 where published';out.append(r)
    return pd.DataFrame(out),d

def team_data(tt,ts,cur):
    t=nba(tt);s=nba(ts)
    if 'team' in t:t=t[~t.team.astype(str).str.contains('League Average',case=False,na=False)]
    if 'team' in s:s=s[~s.team.astype(str).str.contains('League Average',case=False,na=False)]
    keys=[c for c in ['season','team','abbreviation'] if c in t and c in s] or ['season','team']
    ov=[c for c in s if c in t and c not in keys];s=s.rename(columns={c:c+'_s' for c in ov});d=t.merge(s,on=keys,how='left')
    counts=['g','pts','fg','fga','x3p','x3pa','x2p','x2pa','ft','fta','orb','drb','trb','ast','stl','blk','tov','pf']; adv=['w','l','srs','o_rtg','d_rtg','n_rtg','pace','ts_percent','e_fg_percent','tov_percent','orb_percent','opp_e_fg_percent','opp_tov_percent','drb_percent']
    for c in adv:
        if c+'_s' in d:d[c]=d[c+'_s']
    d=num(d,counts+adv);d['games']=d.g;d['win_pct']=d.w/(d.w+d.l);d['season_label']=d.season.map(lab);d['era']=d.season.map(lambda y:era(int(y),cur))
    for c in counts[1:]:d[c+'_pg']=d[c]/d.games
    return d

def league_data(t,p,cur):
    O=[]
    for y,g in t.groupby('season'):
        tg=g.games.sum();r={'season':int(y),'season_label':lab(int(y)),'era':era(int(y),cur),'team_games':float(tg),'teams':len(g)}
        for n,c in [('ppg','pts'),('x3pa_pg','x3pa'),('x3pm_pg','x3p'),('fta_pg','fta'),('ftm_pg','ft'),('pf_pg','pf'),('blk_pg','blk'),('ast_pg','ast'),('trb_pg','trb'),('stl_pg','stl'),('tov_pg','tov'),('fga_pg','fga')]:r[n]=div(g[c].sum(),tg)
        r['x3p_pct']=div(g.x3p.sum(),g.x3pa.sum());r['fg_pct']=div(g.fg.sum(),g.fga.sum())
        for c in ['pace','o_rtg','d_rtg','n_rtg','srs','ts_percent','e_fg_percent']:r[c]=float(g[c].mean()) if c in g else None
        q=p[p.season.eq(y)]
        for n,c in [('dunks_pg','num_of_dunks'),('shooting_fouls_drawn_pg','shooting_foul_drawn'),('shooting_fouls_committed_pg','shooting_foul_committed'),('off_fouls_drawn_pg','offensive_foul_drawn'),('off_fouls_committed_pg','offensive_foul_committed'),('and1_pg','and1')]:r[n]=div(pd.to_numeric(q[c],errors='coerce').sum(min_count=1),tg) if c in q else None
        for k,sh,pc in [('0_3','percent_fga_from_x0_3_range','fg_percent_from_x0_3_range'),('3_10','percent_fga_from_x3_10_range','fg_percent_from_x3_10_range'),('10_16','percent_fga_from_x10_16_range','fg_percent_from_x10_16_range'),('16_3p','percent_fga_from_x16_3p_range','fg_percent_from_x16_3p_range'),('3p','percent_fga_from_x3p_range','fg_percent_from_x3p_range')]:r[f'zone_{k}_share']=wavg(q,sh,'fga');r[f'zone_{k}_pct']=wavg(q,pc,'fga')
        r['corner3_att_pg']=div((pd.to_numeric(q.get('percent_corner_3s_of_3pa'),errors='coerce')*pd.to_numeric(q.get('x3pa'),errors='coerce')).sum(min_count=1),tg) if 'percent_corner_3s_of_3pa' in q and 'x3pa' in q else None;r['corner3_pct']=wavg(q,'corner_3_point_percent','x3pa');O.append(r)
    return pd.DataFrame(O)

def rec(d,cols=None):
    x=d[cols].copy() if cols else d.copy();x=x.replace([np.inf,-np.inf],np.nan);return json.loads(x.to_json(orient='records',force_ascii=False))
def write(n,o):(OUT/n).write_text(json.dumps(o,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def main():
    x={k:csv(v,k not in ['shot','pbp']) for k,v in FILES.items()};cur=int(max(nba(x['tot']).season.max(),nba(x['tt']).season.max()));P,ps=player_data(x,cur);T=team_data(x['tt'],x['ts'],cur);L=league_data(T,ps,cur);E=L.groupby('era',sort=False)[['ppg','pace','x3pa_pg','fta_pg','pf_pg','blk_pg','ast_pg','tov_pg','dunks_pg','corner3_att_pg']].mean().reset_index()
    pc=['era','player_id','player','seasons','season_start','season_end','pos','age_min','age_max','teams','g','gs','mp','pts','trb','ast','stl','blk','tov','pf','x3p','x3pa','ft','fta','fga','fg','trp_dbl','ows','dws','ws','vorp','ppg','rpg','apg','spg','bpg','tov_pg','pf_pg','x3pm_pg','fta_pg','ftm_pg','fg_pct','x3p_pct','x2p_pct','ft_pct','efg_pct','ts_pct_calc','ws48_calc','per_w','usg_percent_w','obpm_w','dbpm_w','bpm_w','avg_dist_fga_w','zone_0_3_att_est','zone_0_3_pct_w','zone_0_3_share_w','zone_3_10_att_est','zone_3_10_pct_w','zone_3_10_share_w','zone_10_16_att_est','zone_10_16_pct_w','zone_10_16_share_w','zone_16_3p_att_est','zone_16_3p_pct_w','zone_16_3p_share_w','zone_3p_att_est','zone_3p_pct_w','zone_3p_share_w','num_of_dunks','dunks_pg','dunk_share_est','corner3_att_est','corner3_pct_w','corner3_share_3pa_w','shooting_foul_committed','offensive_foul_committed','shooting_foul_drawn','offensive_foul_drawn','points_generated_by_assists','and1','fga_blocked','bad_pass_turnover','lost_ball_turnover','on_court_plus_minus_per_100_poss_w','net_plus_minus_per_100_poss_w','shooting_coverage_note'];tc=['era','season','season_label','team','abbreviation','playoffs','w','l','games','win_pct','srs','o_rtg','d_rtg','n_rtg','pace','ts_percent','e_fg_percent','tov_percent','orb_percent','opp_e_fg_percent','opp_tov_percent','drb_percent','pts_pg','x3pa_pg','x3p_pg','fta_pg','trb_pg','ast_pg','stl_pg','blk_pg','tov_pg','pf_pg']
    write('players.json',rec(P,[c for c in pc if c in P]));write('teams.json',rec(T,[c for c in tc if c in T]));write('league.json',rec(L));write('era_summary.json',rec(E));write('meta.json',{'updated_at_utc':datetime.now(timezone.utc).isoformat(),'current_season_end_year':cur,'current_season_label':lab(cur),'source_repository':'sumitrodatta/bball-reference-datasets','integrity_rule':'Missing values remain null; no arbitrary imputation.'})
if __name__=='__main__':main()
