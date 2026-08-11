/* Multi-period selector and cross-era aggregation */
(() => {
  'use strict';

  const STORAGE_KEY='nba-analytics-periods';
  let selected=[];

  const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uniq=a=>[...new Set(a.filter(Boolean))];

  function allEras(){ return (S.eras||[]).map(x=>x.era); }
  function validSelection(a){
    const allowed=new Set(allEras());
    return uniq((a||[]).filter(x=>allowed.has(x)));
  }
  function selectedEras(){ return validSelection(selected); }
  function selectedSet(){ return new Set(selectedEras()); }
  function selectedCount(){ return selectedEras().length; }
  function hasEra(e){ return selectedSet().has(e); }

  function label(){
    const a=selectedEras();
    if(a.length===allEras().length) return en()?'All periods':'Todos os períodos';
    if(a.length===1) return a[0];
    return en()?`${a.length} periods selected`:`${a.length} períodos selecionados`;
  }

  function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(selectedEras())); }

  function baseLayout(){
    const b=clone(L);
    b.margin={l:88,r:38,t:30,b:62};
    b.xaxis={...(b.xaxis||{}),type:'linear',automargin:true,tickfont:{size:12}};
    b.yaxis={...(b.yaxis||{}),type:'linear',automargin:true,tickfont:{size:12}};
    return b;
  }
  function clearPlot(id,data,layout){
    const el=document.getElementById(id); if(!el)return;
    Plotly.purge(el);
    Plotly.newPlot(el,data,layout,{...C,responsive:true,displaylogo:false});
  }
  function empty(id,pt,enText){
    const el=document.getElementById(id); if(!el)return;
    Plotly.purge(el); el.innerHTML=`<div class="qa-empty">${en()?enText:pt}</div>`;
  }
  function mean(rows,key){
    const a=rows.map(x=>x[key]).filter(finite).map(Number);
    return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  }
  function selectedLeague(shot=false){
    const set=selectedSet();
    return S.league.filter(x=>set.has(x.era)&&(!shot||Number(x.season)>=1997)).sort((a,b)=>Number(a.season)-Number(b.season));
  }
  function withGaps(rows,key){
    const x=[],y=[];let prev=null;
    for(const r of rows){
      const s=Number(r.season);
      if(prev!==null&&s-prev>1){x.push(null);y.push(null);}
      x.push(s);y.push(finite(r[key])?Number(r[key]):null);prev=s;
    }
    return {x,y};
  }
  function axis(values,kind='one',zero=false){
    const a=values.filter(finite).map(Number);
    if(!a.length)return {type:'linear',automargin:true};
    let mn=Math.min(...a),mx=Math.max(...a);
    if(kind==='pct'){
      const pad=Math.max((mx-mn)*.12,.01),lo=zero?0:Math.max(0,mn-pad),hi=Math.min(1,mx+pad);
      const step=(hi-lo)<=.1?.02:(hi-lo)<=.25?.05:.1;
      const vals=[];for(let v=Math.floor(lo/step)*step;v<=hi+step/10;v+=step)if(v>=0&&v<=1)vals.push(+v.toFixed(4));
      return {type:'linear',automargin:true,range:[Math.max(0,lo),Math.max(lo+step,hi)],tickmode:'array',tickvals:vals,ticktext:vals.map(v=>`${Math.round(v*100)}%`)};
    }
    if(zero)mn=Math.min(0,mn);
    let span=mx-mn;if(span===0)span=Math.max(Math.abs(mx)*.2,1);
    const pad=span*.1,lo=zero&&mn>=0?0:mn-pad,hi=mx+pad;
    return {type:'linear',automargin:true,range:[lo,hi],tickformat:kind==='int'?'.0f':'.1f'};
  }

  function sumRows(rows,key){ const vals=rows.filter(r=>finite(r[key])).map(r=>Number(r[key])); return vals.length?vals.reduce((a,b)=>a+b,0):null; }
  function wavg(rows,key,wkey){
    let sw=0,sv=0;
    for(const r of rows){if(finite(r[key])&&finite(r[wkey])&&Number(r[wkey])>0){sv+=Number(r[key])*Number(r[wkey]);sw+=Number(r[wkey]);}}
    return sw?sv/sw:null;
  }
  function ratio(n,d){return finite(n)&&finite(d)&&Number(d)!==0?Number(n)/Number(d):null;}

  const additive=['g','mp','pts','trb','ast','stl','blk','tov','pf','x3p','x3pa','ft','fta','fga','fg','trp_dbl','ows','dws','ws','vorp','num_of_dunks','corner3_att_est','shooting_foul_committed','offensive_foul_committed','shooting_foul_drawn','offensive_foul_drawn','points_generated_by_assists','and1','fga_blocked','bad_pass_turnover','lost_ball_turnover'];
  function aggregatePlayerGroup(rows){
    const o={player:rows[0].player,pos:uniq(rows.map(r=>r.pos)).join('/'),eras:rows.map(r=>r.era),era:rows.map(r=>r.era).join(' + ')};
    additive.forEach(k=>o[k]=sumRows(rows,k));
    o.seasons=rows.reduce((s,r)=>s+(finite(r.seasons)?Number(r.seasons):1),0);
    o.teams=uniq(rows.flatMap(r=>String(r.teams||'').split(/\s*[·,/]\s*/))).join(' · ');
    o.ppg=ratio(o.pts,o.g);o.rpg=ratio(o.trb,o.g);o.apg=ratio(o.ast,o.g);o.bpg=ratio(o.blk,o.g);
    o.dunks_pg=ratio(o.num_of_dunks,o.g);o.x3p_pct=ratio(o.x3p,o.x3pa);o.ft_pct=ratio(o.ft,o.fta);
    o.ts_pct_calc=(finite(o.pts)&&finite(o.fga)&&finite(o.fta)&&(2*(Number(o.fga)+.44*Number(o.fta)))>0)?Number(o.pts)/(2*(Number(o.fga)+.44*Number(o.fta))):null;
    o.ws48_calc=(finite(o.ws)&&finite(o.mp)&&Number(o.mp)>0)?Number(o.ws)*48/Number(o.mp):null;
    o.per_w=wavg(rows,'per_w','mp');o.bpm_w=wavg(rows,'bpm_w','mp');o.corner3_pct_w=wavg(rows,'corner3_pct_w','corner3_att_est');
    return o;
  }
  function playerDataset(){
    const set=selectedSet(),rows=S.players.filter(x=>set.has(x.era));
    if(selectedCount()===1)return rows;
    const m=new Map();
    rows.forEach(r=>{if(!m.has(r.player))m.set(r.player,[]);m.get(r.player).push(r);});
    return [...m.values()].map(aggregatePlayerGroup);
  }

  function buildWidget(){
    const native=$('#eraGlobal'); if(!native||document.getElementById('eraMulti'))return;
    const lab=native.closest('label');if(!lab)return;
    lab.classList.add('period-multi-label');
    const wrap=document.createElement('div');wrap.id='eraMulti';wrap.className='period-multi';
    wrap.innerHTML=`<button type="button" class="period-multi-button" aria-haspopup="true" aria-expanded="false"><span class="summary"></span><span class="chevron">▼</span></button><div class="period-multi-menu" role="menu"></div>`;
    native.after(wrap);
    wrap.querySelector('.period-multi-button').onclick=e=>{e.stopPropagation();wrap.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',wrap.classList.contains('open')?'true':'false');};
    document.addEventListener('click',e=>{if(!wrap.contains(e.target)){wrap.classList.remove('open');wrap.querySelector('.period-multi-button').setAttribute('aria-expanded','false');}});
    renderWidget();
  }
  function renderWidget(){
    const wrap=$('#eraMulti');if(!wrap)return;
    wrap.querySelector('.summary').textContent=label();
    const a=selectedEras(),all=allEras(),menu=wrap.querySelector('.period-multi-menu');
    menu.innerHTML=`<label class="period-multi-option all"><input type="checkbox" data-all ${a.length===all.length?'checked':''}><span>${en()?'Select all':'Selecionar todos'}</span></label>`+
      all.map(e=>`<label class="period-multi-option"><input type="checkbox" data-era="${esc(e)}" ${a.includes(e)?'checked':''}><span>${esc(e)}</span></label>`).join('')+
      `<div class="period-multi-hint">${en()?'Choose one, two or all periods. At least one period must remain selected.':'Escolha um, dois ou todos os períodos. Pelo menos um período deve permanecer selecionado.'}</div>`;
    menu.querySelector('[data-all]').onchange=e=>{selected=e.target.checked?[...all]:[all[0]];applySelection();};
    menu.querySelectorAll('[data-era]').forEach(cb=>cb.onchange=e=>{
      const eraName=e.target.dataset.era,next=new Set(selectedEras());
      if(e.target.checked)next.add(eraName);else if(next.size>1)next.delete(eraName);else e.target.checked=true;
      selected=all.filter(x=>next.has(x));applySelection();
    });
  }
  function applySelection(){
    persist();renderWidget();
    const first=selectedEras()[0],native=$('#eraGlobal');if(native&&first)native.value=first;
    ensurePlayerSelectMulti();
    kpis();league();players();detail();shooting();fouls();teams();
    setTimeout(()=>dispatchEvent(new Event('resize')),20);
  }

  function ensurePlayerSelectMulti(){
    const el=$('#playerSelect');if(!el||!S.ready)return;
    const set=selectedSet(),names=[...new Set(S.players.filter(x=>set.has(x.era)).map(x=>x.player))].sort((a,b)=>a.localeCompare(b));
    const old=el.value,chosen=names.includes(old)?old:(names.includes('LeBron James')?'LeBron James':names[0]);
    el.innerHTML=names.map(n=>`<option${n===chosen?' selected':''}>${esc(n)}</option>`).join('');
  }

  era=function(){return selectedEras()[0]||allEras()[0]||'';};

  kpis=function(){
    const rows=selectedLeague(false),a=[['PTS/team/G',mean(rows,'ppg')],['Pace',mean(rows,'pace')],['3PA/team/G',mean(rows,'x3pa_pg')],['FTA/team/G',mean(rows,'fta_pg')],['PF/team/G',mean(rows,'pf_pg')],['Dunks/team/G',mean(rows,'dunks_pg')]];
    $('#kpis').innerHTML=a.map(x=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value">${f(x[1])}</div><div class="sub">${en()?'Average of selected seasons':'Média das temporadas selecionadas'}</div></div>`).join('');
  };

  league=function(){
    const m=$('#leagueMetric').value,d=LM[m],groups=selectedEras().map(e=>[e,S.league.filter(x=>x.era===e&&finite(x[m])).sort((a,b)=>Number(a.season)-Number(b.season))]).filter(x=>x[1].length);
    const vals=groups.flatMap(g=>g[1].map(x=>Number(x[m])));
    if(!vals.length)empty('leagueTrend','N/D para esta métrica nos períodos selecionados.','N/A for this metric in the selected periods.');
    else{
      const traces=groups.map(([e,r])=>({x:r.map(x=>Number(x.season)),y:r.map(x=>Number(x[m])),text:r.map(x=>x.season_label),name:e,mode:'lines+markers',line:{width:2.5},marker:{size:6},hovertemplate:d[1]==='pct'?`%{text}<br>${d[0]}: %{y:.1%}<extra></extra>`:`%{text}<br>${d[0]}: %{y:.2f}<extra></extra>`}));
      const b=baseLayout(),kind=d[1]==='pct'?'pct':d[1]==='int'?'int':'one';
      clearPlot('leagueTrend',traces,{...b,xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,...axis(vals,kind),title:d[0]},legend:{orientation:'h',x:0,y:1.08},shapes:hasEra(allEras()[0])?[{type:'rect',xref:'x',yref:'paper',x0:1995,x1:1997.5,y0:0,y1:1,fillcolor:'rgba(216,179,99,.09)',line:{width:0}}]:[]});
    }
    const rows=S.eras.filter(x=>hasEra(x.era));
    $('#eraTable').innerHTML=tbl([en()?'Period':'Período','PTS/G','Pace','3PA/G','FTA/G','PF/G','Dunks/G'],rows.map(x=>`<tr><td>${x.era}</td><td>${f(x.ppg)}</td><td>${f(x.pace)}</td><td>${f(x.x3pa_pg)}</td><td>${f(x.fta_pg)}</td><td>${f(x.pf_pg)}</td><td>${f(x.dunks_pg)}</td></tr>`));
  };

  players=function(){
    const m=$('#playerMetric').value,d=PM[m];let a=playerDataset().filter(x=>finite(x[m]));
    if(d[2])a=a.filter(x=>finite(x[d[2][0]])&&Number(x[d[2][0]])>=d[2][1]);
    a.sort((x,y)=>Number(y[m])-Number(x[m]));const top=a.slice(0,30),chart=top.slice(0,20).reverse();
    $('#qualNote').textContent=d[2]?`${en()?'Minimum':'Mínimo'}: ${d[2][1]} ${d[2][0]}`:'';
    if(!chart.length){empty('playerRankChart','N/D: nenhum jogador qualificado nos períodos selecionados.','N/A: no qualified players in the selected periods.');$('#playerRankTable').innerHTML='';return;}
    const values=chart.map(x=>Number(x[m])),b=baseLayout(),kind=d[1]==='pct'?'pct':d[1]==='int'?'int':'one',h=Math.max(580,chart.length*29+100);
    $('#playerRankChart').style.height=`${h}px`;
    clearPlot('playerRankChart',[{x:values,y:chart.map(x=>x.player),type:'bar',orientation:'h',text:values.map(v=>f(v,d[1])),textposition:'outside',cliponaxis:false,marker:{color:'#d8b363'},hovertemplate:'%{y}<br>%{text}<extra></extra>'}],{...b,height:h,margin:{l:185,r:95,t:20,b:58},xaxis:{...b.xaxis,...axis(values,kind,kind==='int'),title:d[0]},yaxis:{type:'category',automargin:true,gridcolor:'rgba(0,0,0,0)'}});
    $('#playerRankTable').innerHTML=tbl(['#',en()?'Player':'Jogador',d[0],'G',en()?'Seasons':'Temporadas',en()?'Teams':'Equipes','VORP','WS'],top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x[m],d[1])}</td><td>${f(x.g,'int')}</td><td>${f(x.seasons,'int')}</td><td>${esc(x.teams||'')}</td><td>${f(x.vorp)}</td><td>${f(x.ws)}</td></tr>`));
  };

  detail=function(){
    ensurePlayerSelectMulti();const name=$('#playerSelect').value,set=selectedSet(),a=S.players.filter(x=>set.has(x.era)&&x.player===name);
    if(!a.length){$('#playerDetailContent').innerHTML=`<div class="qa-empty">${en()?'No data for this player in the selected periods.':'Nenhum dado deste jogador nos períodos selecionados.'}</div>`;return;}
    $('#playerDetailContent').innerHTML=a.map(x=>`<div class="card mt"><h3>${x.era}</h3><p class="note">${esc(x.pos||'')} • ${esc(x.teams||'')} • ${x.seasons} ${en()?'seasons':'temporadas'} • ${f(x.g,'int')} G</p><div class="detail-grid">${[['PTS',x.pts,'int'],['PPG',x.ppg],['REB',x.trb,'int'],['RPG',x.rpg],['AST',x.ast,'int'],['APG',x.apg],['STL',x.stl,'int'],['BLK',x.blk,'int'],['3PM',x.x3p,'int'],['3P%',x.x3p_pct,'pct'],['FT%',x.ft_pct,'pct'],['TS%',x.ts_pct_calc,'pct'],['PER',x.per_w],['BPM',x.bpm_w],['VORP',x.vorp],['WS',x.ws],['WS/48',x.ws48_calc,'two'],['Dunks',x.num_of_dunks,'int'],['Corner 3%',x.corner3_pct_w,'pct'],['And-1',x.and1,'int']].map(v=>`<div class="detail"><div class="dl">${v[0]}</div><div class="dv">${f(v[1],v[2]||'one')}</div></div>`).join('')}</div></div>`).join('');
  };

  shooting=function(){
    const l=selectedLeague(true),latest=l.length?l[l.length-1]:null;
    const kpis=[[en()?'Latest shot-data season':'Última temporada com shot data',latest?.season_label,'text'],[en()?'3P share of FGA':'Participação dos 3P nos FGA',latest?.zone_3p_share,'pct'],['Corner 3%',latest?.corner3_pct,'pct'],[en()?'Dunks / team / game':'Enterradas / equipe / jogo',latest?.dunks_pg,'one']];
    if($('#shootingKpis'))$('#shootingKpis').innerHTML=kpis.map(([lab,val,kind])=>`<div class="shooting-kpi"><div class="shooting-kpi-label">${lab}</div><div class="shooting-kpi-value">${kind==='text'?(val||(en()?'N/A':'N/D')):f(val,kind)}</div></div>`).join('');
    if(!l.length){['zoneShareChart','cornerChart','dunkTrend'].forEach(id=>empty(id,'N/D para os períodos selecionados.','N/A for the selected periods.'));}
    else{
      const zones=[['zone_0_3_share','0–3 ft'],['zone_3_10_share','3–10 ft'],['zone_10_16_share','10–16 ft'],['zone_16_3p_share','16 ft–3P'],['zone_3p_share','3P']],b=baseLayout();
      clearPlot('zoneShareChart',zones.map(([k,n])=>{const s=withGaps(l,k);return {x:s.x,y:s.y,name:n,mode:'lines',stackgroup:'one',line:{width:1.8},hovertemplate:`%{x}<br>${n}: %{y:.1%}<extra></extra>`};}),{...b,margin:{l:92,r:28,t:48,b:62},xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,title:en()?'Share of FGA':'Participação nos FGA',range:[0,1],tickmode:'array',tickvals:[0,.25,.5,.75,1],ticktext:['0%','25%','50%','75%','100%']},legend:{orientation:'h',x:0,y:1.08},hovermode:'x unified'});
      const av=l.map(x=>finite(x.corner3_att_pg)?Number(x.corner3_att_pg):null),pv=l.map(x=>finite(x.corner3_pct)?Number(x.corner3_pct):null),sa=withGaps(l,'corner3_att_pg'),sp=withGaps(l,'corner3_pct');
      clearPlot('cornerChart',[{x:sa.x,y:sa.y,name:en()?'Attempts / team / G':'Tentativas / equipe / J',mode:'lines+markers'},{x:sp.x,y:sp.y,name:'Corner 3%',mode:'lines+markers',yaxis:'y2'}],{...b,margin:{l:92,r:82,t:48,b:62},xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,...axis(av,'one'),title:en()?'Attempts / team / game':'Tentativas / equipe / jogo'},yaxis2:{...axis(pv,'pct'),overlaying:'y',side:'right',title:'Corner 3%',gridcolor:'rgba(0,0,0,0)',automargin:true},legend:{orientation:'h',x:0,y:1.12}});
      const dv=l.map(x=>finite(x.dunks_pg)?Number(x.dunks_pg):null),sd=withGaps(l,'dunks_pg');
      clearPlot('dunkTrend',[{x:sd.x,y:sd.y,mode:'lines+markers'}],{...b,margin:{l:104,r:34,t:36,b:62},xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,...axis(dv,'one'),title:en()?'Dunks / team / game':'Enterradas / equipe / jogo'},showlegend:false});
    }
    const a=playerDataset().filter(x=>finite(x.num_of_dunks)).sort((x,y)=>Number(y.num_of_dunks)-Number(x.num_of_dunks)).slice(0,20);
    $('#dunkLeaders').innerHTML=tbl(['#',en()?'Player':'Jogador','Dunks','Dunks/G','G'],a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x.num_of_dunks,'int')}</td><td>${f(x.dunks_pg,'two')}</td><td>${f(x.g,'int')}</td></tr>`));
  };

  fouls=function(){
    const l=selectedLeague(false),b=baseLayout();
    if(!l.length){empty('pfFtTrend','N/D para os períodos selecionados.','N/A for the selected periods.');empty('pbpTrend','N/D para os períodos selecionados.','N/A for the selected periods.');}
    else{
      const pf=l.map(x=>x.pf_pg),ft=l.map(x=>x.fta_pg),all=[...pf,...ft],spf=withGaps(l,'pf_pg'),sft=withGaps(l,'fta_pg');
      clearPlot('pfFtTrend',[{x:spf.x,y:spf.y,name:'PF/G',mode:'lines+markers'},{x:sft.x,y:sft.y,name:'FTA/G',mode:'lines+markers'}],{...b,xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,...axis(all,'one'),title:en()?'Per team / game':'Por equipe / jogo'},legend:{orientation:'h',x:0,y:1.08}});
      const p=l.filter(x=>Number(x.season)>=1997),sf=withGaps(p,'shooting_fouls_drawn_pg'),so=withGaps(p,'off_fouls_drawn_pg'),sa=withGaps(p,'and1_pg'),vals=p.flatMap(x=>[x.shooting_fouls_drawn_pg,x.off_fouls_drawn_pg,x.and1_pg]).filter(finite);
      if(!vals.length)empty('pbpTrend','N/D: PBP detalhado indisponível nos períodos selecionados.','N/A: detailed PBP unavailable in the selected periods.');
      else clearPlot('pbpTrend',[{x:sf.x,y:sf.y,name:'Shooting fouls',mode:'lines+markers'},{x:so.x,y:so.y,name:'Offensive fouls',mode:'lines+markers'},{x:sa.x,y:sa.y,name:'And-1',mode:'lines+markers'}],{...b,xaxis:{...b.xaxis,title:en()?'Season':'Temporada',dtick:2},yaxis:{...b.yaxis,...axis(vals,'one'),title:en()?'Events / team / game':'Eventos / equipe / jogo'},legend:{orientation:'h',x:0,y:1.08}});
    }
    const pe=playerDataset(),cats=[['FTA','fta'],['PF','pf'],['Shooting fouls drawn','shooting_foul_drawn'],['Offensive fouls drawn','offensive_foul_drawn'],['And-1','and1']];
    $('#foulLeaderTable').innerHTML=tbl([en()?'Category':'Categoria',en()?'Leader':'Líder','Total','G'],cats.map(([n,k])=>{const x=pe.filter(v=>finite(v[k])).sort((a,b)=>Number(b[k])-Number(a[k]))[0];return x?`<tr><td>${n}</td><td>${esc(x.player)}</td><td>${f(x[k],'int')}</td><td>${f(x.g,'int')}</td></tr>`:'';}));
  };

  teams=function(){
    const m=$('#teamMetric').value,d=TM[m],set=selectedSet();let a=S.teams.filter(x=>set.has(x.era)&&finite(x[m]));
    a.sort((x,y)=>d[2]?Number(x[m])-Number(y[m]):Number(y[m])-Number(x[m]));const top=a.slice(0,30),chart=top.slice(0,20).reverse(),values=chart.map(x=>Number(x[m]));
    if(!chart.length){empty('teamChart','N/D para os períodos selecionados.','N/A for the selected periods.');$('#teamTable').innerHTML='';return;}
    const b=baseLayout(),kind=d[1]==='pct'?'pct':d[1]==='int'?'int':'one',h=Math.max(640,chart.length*30+110);$('#teamChart').style.height=`${h}px`;
    clearPlot('teamChart',[{x:values,y:chart.map(x=>`${x.team} • ${x.season_label}`),type:'bar',orientation:'h',text:values.map(v=>f(v,d[1])),textposition:'outside',cliponaxis:false,marker:{color:'#d8b363'}}],{...b,height:h,margin:{l:255,r:95,t:20,b:58},xaxis:{...b.xaxis,...axis(values,kind,kind==='int'),title:d[0]},yaxis:{type:'category',automargin:true,gridcolor:'rgba(0,0,0,0)'}});
    $('#teamTable').innerHTML=tbl(['#',en()?'Team':'Equipe',en()?'Season':'Temporada',d[0],'W-L','SRS','ORtg','DRtg','Net','Pace'],top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.team)}</td><td>${x.season_label}</td><td>${f(x[m],d[1])}</td><td>${f(x.w,'int')}-${f(x.l,'int')}</td><td>${f(x.srs)}</td><td>${f(x.o_rtg)}</td><td>${f(x.d_rtg)}</td><td>${f(x.n_rtg)}</td><td>${f(x.pace)}</td></tr>`));
  };

  const oldSetLang=setLang;
  setLang=function(x){oldSetLang(x);setTimeout(()=>{renderWidget();ensurePlayerSelectMulti();},0);};

  function boot(){
    if(!S.ready||!S.eras.length){setTimeout(boot,80);return;}
    const stored=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}})();
    selected=validSelection(stored);
    if(!selected.length){const n=$('#eraGlobal');selected=validSelection([n?.value||allEras()[0]]);}
    buildWidget();ensurePlayerSelectMulti();applySelection();
  }
  boot();
})();
