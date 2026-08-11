/* Shooting & Zones + Dashboard Filter QA v4 */
D.shot_distribution_note=['Participação de cada zona no total de tentativas de arremesso (FGA) dentro do período selecionado.','Share of total field-goal attempts (FGA) from each distance zone within the selected period.'];
D.corner_note=['Volume por equipe/jogo e eficiência da bola de 3 da zona morta.','Corner-3 volume per team/game and shooting efficiency.'];
D.dunk_note=['Evolução do volume médio de enterradas na liga durante o período selecionado.','Evolution of average league dunk volume during the selected period.'];
D.dunk_leaders_note=['Ranking acumulado do período selecionado; cobertura disponível a partir de 1996-97.','Cumulative ranking for the selected period; coverage is available from 1996-97 onward.'];

(() => {
  'use strict';
  const clone=o=>JSON.parse(JSON.stringify(o));
  const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
  const nums=arr=>arr.filter(finite).map(Number);
  const localeNumber=(v,digits=1)=>Number(v).toLocaleString(S.lang,{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const emptyText=(pt,enText)=>en()?enText:pt;

  function baseLayout(extra={}){
    const b=clone(L);
    b.xaxis={...(b.xaxis||{}),type:'linear',automargin:true,tickfont:{size:12}};
    b.yaxis={...(b.yaxis||{}),type:'linear',automargin:true,tickfont:{size:12}};
    b.margin={l:78,r:36,t:28,b:62};
    return Object.assign(b,extra);
  }
  function niceStep(range,target=5){
    if(!Number.isFinite(range)||range<=0)return 1;
    const raw=range/target,p=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/p;
    const m=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;
    return m*p;
  }
  function axisTicks(values,kind='one',opts={}){
    const a=nums(values); if(!a.length)return {type:'linear',automargin:true};
    let min=Math.min(...a),max=Math.max(...a);
    if(kind==='pct'){
      const pad=Math.max((max-min)*0.12,0.01);
      min=opts.zero?0:Math.max(0,min-pad);max=Math.min(1,max+pad);
      const step=opts.step||niceStep(max-min,5);
      const lo=Math.max(0,Math.floor(min/step)*step),hi=Math.min(1,Math.ceil(max/step)*step);
      const vals=[];for(let v=lo;v<=hi+step/100;v+=step)vals.push(+v.toFixed(6));
      return {type:'linear',automargin:true,range:[lo,hi===lo?Math.min(1,lo+step):hi],tickmode:'array',tickvals:vals,ticktext:vals.map(v=>`${Math.round(v*100)}%`)};
    }
    if(opts.zero)min=Math.min(0,min);
    let span=max-min;if(span===0){span=Math.max(Math.abs(max)*.2,1);min-=span/2;max+=span/2;}
    const pad=span*(opts.pad??.10);min-=pad;max+=pad;
    if(opts.zero&&min<0&&Math.min(...a)>=0)min=0;
    const step=opts.step||niceStep(max-min,5),lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step;
    const vals=[];for(let v=lo;v<=hi+step/100;v+=step)vals.push(+v.toFixed(10));
    const digits=kind==='int'?0:(step<.1?2:step<1?1:0);
    return {type:'linear',automargin:true,range:[lo,hi===lo?lo+step:hi],tickmode:'array',tickvals:vals,ticktext:vals.map(v=>kind==='int'?Math.round(v).toLocaleString(S.lang):localeNumber(v,digits))};
  }
  function clearAndPlot(id,data,layout){
    const el=document.getElementById(id);if(!el)return Promise.resolve();
    Plotly.purge(el);return Plotly.newPlot(el,data,layout,{...C,responsive:true,displaylogo:false});
  }
  function emptyChart(id,message){const el=document.getElementById(id);if(!el)return;Plotly.purge(el);el.innerHTML=`<div class="qa-empty">${message}</div>`;}
  function currentLeague(includeShot=false){return S.league.filter(x=>x.era===era()&&(!includeShot||Number(x.season)>=1997));}
  function ensurePlayerSelect(){
    const el=$('#playerSelect');if(!el||!S.ready)return;
    const names=[...new Set(S.players.filter(x=>x.era===era()).map(x=>x.player))].sort((a,b)=>a.localeCompare(b));
    const old=el.value,chosen=names.includes(old)?old:(names.includes('LeBron James')?'LeBron James':names[0]);
    el.innerHTML=names.map(n=>`<option${n===chosen?' selected':''}>${esc(n)}</option>`).join('');
  }

  league=function(){
    const m=$('#leagueMetric').value,d=LM[m],l=currentLeague(false),y=l.map(x=>finite(x[m])?Number(x[m]):null),valid=nums(y);
    if(!valid.length)emptyChart('leagueTrend',emptyText('N/D para esta métrica no período selecionado.','N/A for this metric in the selected period.'));
    else{
      const ax=axisTicks(valid,d[1]==='pct'?'pct':(d[1]==='int'?'int':'one'));
      clearAndPlot('leagueTrend',[{x:l.map(x=>Number(x.season)),y,text:l.map(x=>x.season_label),mode:'lines+markers',line:{width:2.6},marker:{size:7},hovertemplate:'%{text}<br>%{y:.2f}<extra></extra>'}],{
        ...baseLayout(),margin:{l:88,r:34,t:24,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:l.length<=12?1:2},
        yaxis:{...baseLayout().yaxis,...ax,title:d[0]},shapes:[{type:'rect',xref:'x',yref:'paper',x0:1995,x1:1997.5,y0:0,y1:1,fillcolor:'rgba(216,179,99,.09)',line:{width:0}}]
      });
    }
    $('#eraTable').innerHTML=tbl([en()?'Period':'Período','PTS/G','Pace','3PA/G','FTA/G','PF/G','Dunks/G'],S.eras.map(x=>`<tr><td>${x.era}</td><td>${f(x.ppg)}</td><td>${f(x.pace)}</td><td>${f(x.x3pa_pg)}</td><td>${f(x.fta_pg)}</td><td>${f(x.pf_pg)}</td><td>${f(x.dunks_pg)}</td></tr>`));
  };

  players=function(){
    const m=$('#playerMetric').value,d=PM[m];let a=S.players.filter(x=>x.era===era()&&finite(x[m]));
    if(d[2])a=a.filter(x=>finite(x[d[2][0]])&&Number(x[d[2][0]])>=d[2][1]);
    a.sort((x,y)=>Number(y[m])-Number(x[m]));const top=a.slice(0,30),chart=top.slice(0,20).reverse();
    $('#qualNote').textContent=d[2]?`${en()?'Minimum':'Mínimo'}: ${d[2][1]} ${d[2][0]}`:'';
    if(!chart.length){emptyChart('playerRankChart',emptyText('N/D: não há jogadores qualificados para esta métrica no período selecionado.','N/A: no qualified players for this metric in the selected period.'));$('#playerRankTable').innerHTML=`<div class="qa-empty compact">${emptyText('Nenhum dado disponível.','No data available.')}</div>`;return;}
    const values=chart.map(x=>Number(x[m])),kind=d[1]==='pct'?'pct':(d[1]==='int'?'int':'one'),ax=axisTicks(values,kind,{zero:kind==='int'}),h=Math.max(580,chart.length*29+100);
    if($('#playerRankChart'))$('#playerRankChart').style.height=`${h}px`;
    clearAndPlot('playerRankChart',[{x:values,y:chart.map(x=>x.player),type:'bar',orientation:'h',text:values.map(v=>f(v,d[1])),textposition:'outside',cliponaxis:false,marker:{color:'#d8b363'},hovertemplate:'%{y}<br>%{text}<extra></extra>'}],{
      ...baseLayout(),height:h,margin:{l:185,r:90,t:20,b:58},xaxis:{...baseLayout().xaxis,...ax,title:d[0],zeroline:true,zerolinecolor:'#48665a'},yaxis:{gridcolor:'rgba(0,0,0,0)',type:'category',automargin:true,tickfont:{size:12}}
    });
    $('#playerRankTable').innerHTML=tbl(['#',en()?'Player':'Jogador',d[0],'G',en()?'Seasons':'Temporadas',en()?'Teams':'Equipes','VORP','WS'],top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x[m],d[1])}</td><td>${f(x.g,'int')}</td><td>${x.seasons}</td><td>${esc(x.teams||'')}</td><td>${f(x.vorp)}</td><td>${f(x.ws)}</td></tr>`));
  };

  detail=function(){
    ensurePlayerSelect();const name=$('#playerSelect').value,a=S.players.filter(x=>x.era===era()&&x.player===name);
    if(!a.length){$('#playerDetailContent').innerHTML=`<div class="qa-empty">${emptyText('Nenhum dado deste jogador no período selecionado.','No data for this player in the selected period.')}</div>`;return;}
    $('#playerDetailContent').innerHTML=a.map(x=>`<div class="card mt"><h3>${x.era}</h3><p class="note">${esc(x.pos||'')} • ${esc(x.teams||'')} • ${x.seasons} ${en()?'seasons':'temporadas'} • ${f(x.g,'int')} G</p><div class="detail-grid">${[['PTS',x.pts,'int'],['PPG',x.ppg],['REB',x.trb,'int'],['RPG',x.rpg],['AST',x.ast,'int'],['APG',x.apg],['STL',x.stl,'int'],['BLK',x.blk,'int'],['3PM',x.x3p,'int'],['3P%',x.x3p_pct,'pct'],['FT%',x.ft_pct,'pct'],['TS%',x.ts_pct_calc,'pct'],['PER',x.per_w],['BPM',x.bpm_w],['VORP',x.vorp],['WS',x.ws],['WS/48',x.ws48_calc,'two'],['Dunks',x.num_of_dunks,'int'],['Corner 3%',x.corner3_pct_w,'pct'],['And-1',x.and1,'int']].map(v=>`<div class="detail"><div class="dl">${v[0]}</div><div class="dv">${f(v[1],v[2]||'one')}</div></div>`).join('')}</div></div>`).join('');
  };

  shooting=function(){
    const l=currentLeague(true),latest=l.length?l[l.length-1]:null;
    const kpis=[[en()?'Latest shot-data season':'Última temporada com shot data',latest?.season_label,'text'],[en()?'3P share of FGA':'Participação dos 3P nos FGA',latest?.zone_3p_share,'pct'],['Corner 3%',latest?.corner3_pct,'pct'],[en()?'Dunks / team / game':'Enterradas / equipe / jogo',latest?.dunks_pg,'one']];
    if($('#shootingKpis'))$('#shootingKpis').innerHTML=kpis.map(([label,value,kind])=>`<div class="shooting-kpi"><div class="shooting-kpi-label">${label}</div><div class="shooting-kpi-value">${kind==='text'?(value||(en()?'N/A':'N/D')):f(value,kind)}</div></div>`).join('');
    if(!l.length){['zoneShareChart','cornerChart','dunkTrend'].forEach(id=>emptyChart(id,emptyText('N/D para o período selecionado.','N/A for the selected period.')));}
    else{
      const zones=[['zone_0_3_share','0–3 ft'],['zone_3_10_share','3–10 ft'],['zone_10_16_share','10–16 ft'],['zone_16_3p_share','16 ft–3P'],['zone_3p_share','3P']];
      clearAndPlot('zoneShareChart',zones.map(([k,n])=>({x:l.map(x=>Number(x.season)),y:l.map(x=>finite(x[k])?Number(x[k]):null),name:n,mode:'lines',stackgroup:'one',line:{width:1.8},hovertemplate:`%{x}<br>${n}: %{y:.1%}<extra></extra>`})),{
        ...baseLayout(),margin:{l:92,r:28,t:48,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:1},yaxis:{...baseLayout().yaxis,title:en()?'Share of FGA':'Participação nos FGA',range:[0,1],tickmode:'array',tickvals:[0,.25,.5,.75,1],ticktext:['0%','25%','50%','75%','100%']},legend:{orientation:'h',x:0,y:1.08,xanchor:'left',yanchor:'bottom'},hovermode:'x unified'
      });
      const av=l.map(x=>finite(x.corner3_att_pg)?Number(x.corner3_att_pg):null),pv=l.map(x=>finite(x.corner3_pct)?Number(x.corner3_pct):null);
      clearAndPlot('cornerChart',[{x:l.map(x=>Number(x.season)),y:av,name:en()?'Attempts / team / G':'Tentativas / equipe / J',mode:'lines+markers',line:{width:2.5},marker:{size:6},hovertemplate:'%{x}<br>%{y:.2f}<extra></extra>'},{x:l.map(x=>Number(x.season)),y:pv,name:'Corner 3%',mode:'lines+markers',yaxis:'y2',line:{width:2.3},marker:{size:6},hovertemplate:'%{x}<br>%{y:.1%}<extra></extra>'}],{
        ...baseLayout(),margin:{l:92,r:82,t:48,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:1},yaxis:{...baseLayout().yaxis,...axisTicks(av,'one'),title:en()?'Attempts / team / game':'Tentativas / equipe / jogo'},yaxis2:{...axisTicks(pv,'pct'),overlaying:'y',side:'right',title:'Corner 3%',gridcolor:'rgba(0,0,0,0)',automargin:true},legend:{orientation:'h',x:0,y:1.12,xanchor:'left',yanchor:'bottom'},hovermode:'x unified'
      });
      const dv=l.map(x=>finite(x.dunks_pg)?Number(x.dunks_pg):null);
      clearAndPlot('dunkTrend',[{x:l.map(x=>Number(x.season)),y:dv,mode:'lines+markers',line:{width:2.7},marker:{size:7},hovertemplate:'%{x}<br>%{y:.2f}<extra></extra>'}],{
        ...baseLayout(),margin:{l:104,r:34,t:36,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:1},yaxis:{...baseLayout().yaxis,...axisTicks(dv,'one'),title:en()?'Dunks / team / game':'Enterradas / equipe / jogo'},showlegend:false
      });
    }
    const a=S.players.filter(x=>x.era===era()&&finite(x.num_of_dunks)).sort((x,y)=>Number(y.num_of_dunks)-Number(x.num_of_dunks)).slice(0,20);
    $('#dunkLeaders').innerHTML=tbl(['#',en()?'Player':'Jogador','Dunks','Dunks/G','G'],a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x.num_of_dunks,'int')}</td><td>${f(x.dunks_pg,'two')}</td><td>${f(x.g,'int')}</td></tr>`));
  };

  fouls=function(){
    const l=currentLeague(false),pf=l.map(x=>finite(x.pf_pg)?Number(x.pf_pg):null),ft=l.map(x=>finite(x.fta_pg)?Number(x.fta_pg):null),both=[...pf,...ft];
    clearAndPlot('pfFtTrend',[{x:l.map(x=>Number(x.season)),y:pf,name:'PF/G',mode:'lines+markers',line:{width:2.5},marker:{size:6},hovertemplate:'%{x}<br>PF/G: %{y:.2f}<extra></extra>'},{x:l.map(x=>Number(x.season)),y:ft,name:'FTA/G',mode:'lines+markers',line:{width:2.5},marker:{size:6},hovertemplate:'%{x}<br>FTA/G: %{y:.2f}<extra></extra>'}],{
      ...baseLayout(),margin:{l:96,r:38,t:42,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:l.length<=12?1:2},yaxis:{...baseLayout().yaxis,...axisTicks(both,'one'),title:en()?'Events / team / game':'Eventos / equipe / jogo'},legend:{orientation:'h',x:0,y:1.1},hovermode:'x unified'
    });
    const p=l.filter(x=>Number(x.season)>=1997),shoot=p.map(x=>finite(x.shooting_fouls_drawn_pg)?Number(x.shooting_fouls_drawn_pg):null),off=p.map(x=>finite(x.off_fouls_drawn_pg)?Number(x.off_fouls_drawn_pg):null),and1=p.map(x=>finite(x.and1_pg)?Number(x.and1_pg):null);
    if(!nums([...shoot,...off,...and1]).length)emptyChart('pbpTrend',emptyText('N/D: PBP detalhado indisponível no período.','N/A: detailed PBP unavailable in this period.'));
    else clearAndPlot('pbpTrend',[{x:p.map(x=>Number(x.season)),y:shoot,name:en()?'Shooting fouls drawn':'Faltas de arremesso sofridas',mode:'lines+markers',line:{width:2.5},marker:{size:6},hovertemplate:'%{x}<br>%{y:.2f}<extra></extra>'},...(nums(off).length?[{x:p.map(x=>Number(x.season)),y:off,name:en()?'Offensive fouls drawn':'Faltas ofensivas sofridas',mode:'lines+markers',yaxis:'y2',line:{width:2.2},marker:{size:6},hovertemplate:'%{x}<br>%{y:.2f}<extra></extra>'}]:[]),{x:p.map(x=>Number(x.season)),y:and1,name:'And-1',mode:'lines+markers',yaxis:'y2',line:{width:2.2},marker:{size:6},hovertemplate:'%{x}<br>%{y:.2f}<extra></extra>'}],{
      ...baseLayout(),margin:{l:98,r:92,t:42,b:62},xaxis:{...baseLayout().xaxis,title:en()?'Season':'Temporada',dtick:p.length<=12?1:2},yaxis:{...baseLayout().yaxis,...axisTicks(shoot,'one'),title:en()?'Shooting fouls / team / game':'Faltas de arremesso / equipe / jogo'},yaxis2:{...axisTicks([...off,...and1],'one'),overlaying:'y',side:'right',title:en()?'Offensive fouls & And-1 / G':'Faltas ofensivas & And-1 / J',gridcolor:'rgba(0,0,0,0)',automargin:true},legend:{orientation:'h',x:0,y:1.12},hovermode:'x unified'
    });
    const pe=S.players.filter(x=>x.era===era()),cats=[['FTA','fta'],['PF','pf'],[en()?'Shooting fouls drawn':'Faltas de arremesso sofridas','shooting_foul_drawn'],[en()?'Offensive fouls drawn':'Faltas ofensivas sofridas','offensive_foul_drawn'],['And-1','and1']];
    $('#foulLeaderTable').innerHTML=tbl([en()?'Category':'Categoria',en()?'Leader':'Líder','Total','G'],cats.map(([n,k])=>{let x=pe.filter(v=>finite(v[k])).sort((a,b)=>Number(b[k])-Number(a[k]))[0];return x?`<tr><td>${n}</td><td>${esc(x.player)}</td><td>${f(x[k],'int')}</td><td>${f(x.g,'int')}</td></tr>`:`<tr><td>${n}</td><td colspan="3">${en()?'N/A':'N/D'}</td></tr>`;}));
  };

  teams=function(){
    const m=$('#teamMetric').value,d=TM[m];let a=S.teams.filter(x=>x.era===era()&&finite(x[m])).sort((x,y)=>d[2]?Number(x[m])-Number(y[m]):Number(y[m])-Number(x[m])).slice(0,30),chart=a.slice(0,20).reverse();
    if(!chart.length){emptyChart('teamChart',emptyText('N/D para a métrica selecionada.','N/A for the selected metric.'));$('#teamTable').innerHTML='';return;}
    const values=chart.map(x=>Number(x[m])),kind=d[1]==='pct'?'pct':(d[1]==='int'?'int':'one'),ax=axisTicks(values,kind,{zero:m==='w'}),h=Math.max(590,chart.length*29+105);if($('#teamChart'))$('#teamChart').style.height=`${h}px`;
    clearAndPlot('teamChart',[{x:values,y:chart.map(x=>`${x.team} • ${x.season_label}`),type:'bar',orientation:'h',text:values.map(v=>f(v,d[1])),textposition:'outside',cliponaxis:false,marker:{color:'#d8b363'},hovertemplate:'%{y}<br>%{text}<extra></extra>'}],{
      ...baseLayout(),height:h,margin:{l:285,r:100,t:24,b:62},xaxis:{...baseLayout().xaxis,...ax,title:d[0],zeroline:true,zerolinecolor:'#48665a'},yaxis:{gridcolor:'rgba(0,0,0,0)',type:'category',automargin:true,tickfont:{size:12}}
    });
    $('#teamTable').innerHTML=tbl(['#',en()?'Team':'Equipe',en()?'Season':'Temporada',d[0],'W-L','SRS','ORtg','DRtg','Net','Pace'],a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.team)}</td><td>${x.season_label}</td><td>${f(x[m],d[1])}</td><td>${f(x.w,'int')}-${f(x.l,'int')}</td><td>${f(x.srs)}</td><td>${f(x.o_rtg)}</td><td>${f(x.d_rtg)}</td><td>${f(x.n_rtg)}</td><td>${f(x.pace)}</td></tr>`));
  };

  function rebindFilters(){
    $('#eraGlobal').onchange=()=>{kpis();league();players();detail();shooting();fouls();teams();};
    $('#leagueMetric').onchange=()=>league();$('#playerMetric').onchange=()=>players();$('#playerSelect').onchange=()=>detail();$('#teamMetric').onchange=()=>teams();
  }
  window.runDashboardFilterQA=function(){
    if(!S.ready)return {ready:false,errors:['data not loaded']};
    const errors=[],warnings=[],summary=[];
    for(const e of S.eras.map(x=>x.era)){
      const l=S.league.filter(x=>x.era===e);
      for(const [m] of Object.entries(LM)){const n=nums(l.map(x=>x[m])).length;summary.push(['league',e,m,n]);if(!n)warnings.push(`League ${e} / ${m}: N/D`);}
      for(const [m,d] of Object.entries(PM)){let a=S.players.filter(x=>x.era===e&&finite(x[m]));if(d[2])a=a.filter(x=>finite(x[d[2][0]])&&Number(x[d[2][0]])>=d[2][1]);summary.push(['player',e,m,a.length]);if(!a.length&&!(e.startsWith('1988')&&m==='offensive_foul_drawn'))errors.push(`Players ${e} / ${m}: empty`);if(!a.length)warnings.push(`Players ${e} / ${m}: N/D`);}
      for(const [m] of Object.entries(TM)){const n=S.teams.filter(x=>x.era===e&&finite(x[m])).length;summary.push(['team',e,m,n]);if(!n)errors.push(`Teams ${e} / ${m}: empty`);}
      const shot=l.filter(x=>Number(x.season)>=1997),shotMetrics=['zone_0_3_share','zone_3_10_share','zone_10_16_share','zone_16_3p_share','zone_3p_share','corner3_att_pg','corner3_pct','dunks_pg'];shotMetrics.forEach(m=>{const n=nums(shot.map(x=>x[m])).length;summary.push(['shooting',e,m,n]);if(!n)errors.push(`Shooting ${e} / ${m}: empty`);});
      ['pf_pg','fta_pg'].forEach(m=>{const n=nums(l.map(x=>x[m])).length;summary.push(['fouls',e,m,n]);if(!n)errors.push(`Fouls ${e} / ${m}: empty`);});
    }
    const result={ready:true,passed:errors.length===0,errors,warnings,totalChecks:summary.length,summary};window.NBA_FILTER_QA=result;console.group(`NBA Analytics Filter QA — ${result.passed?'PASS':'FAIL'}`);console.log(`Checks: ${result.totalChecks}`);console.log('Errors',errors);console.log('Expected/coverage warnings',warnings);console.groupEnd();return result;
  };
  function waitForData(){if(S.ready){rebindFilters();ensurePlayerSelect();setTimeout(()=>window.runDashboardFilterQA(),50);return;}setTimeout(waitForData,80);}
  rebindFilters();waitForData();
})();