/* Dashboard chart fixes v12 — isolated Plotly layouts, period-aware charts, stable numeric axes */
D.shot_distribution_note=[
  'Participação de cada zona no total de tentativas de arremesso (FGA) dentro do período selecionado.',
  'Share of total field-goal attempts (FGA) from each distance zone within the selected period.'
];
D.corner_note=[
  'Volume por equipe/jogo e eficiência da bola de 3 da zona morta.',
  'Corner-3 volume per team/game and shooting efficiency.'
];
D.dunk_note=[
  'Evolução do volume médio de enterradas na liga durante o período selecionado.',
  'Evolution of average league dunk volume during the selected period.'
];
D.dunk_leaders_note=[
  'Ranking acumulado do período selecionado; cobertura disponível a partir de 1996-97.',
  'Cumulative ranking for the selected period; coverage is available from 1996-97 onward.'
];

/* Plotly mutates layout objects while resolving defaults.
   The original dashboard reused L across charts. Clone every layout to stop
   categorical/range state leaking from one chart into another. */
if (window.Plotly && !Plotly.__tapSafeReact) {
  const _react = Plotly.react.bind(Plotly);
  const cloneLayout = obj => {
    try { return structuredClone(obj); }
    catch (_) { return JSON.parse(JSON.stringify(obj)); }
  };
  Plotly.react = (gd, data, layout, config) => _react(gd, data, cloneLayout(layout || {}), config);
  Plotly.__tapSafeReact = true;
}

const tapPlotBase = () => ({
  paper_bgcolor:'rgba(0,0,0,0)',
  plot_bgcolor:'rgba(0,0,0,0)',
  font:{color:'#dce5da'},
  margin:{l:62,r:28,t:24,b:52},
  xaxis:{type:'linear',gridcolor:'#274238',zerolinecolor:'#355348',automargin:true},
  yaxis:{type:'linear',gridcolor:'#274238',zerolinecolor:'#355348',automargin:true},
  colorway:['#d8b363','#79c98d','#e7c56d','#9aa78e','#b48756'],
  hoverlabel:{bgcolor:'#0b1a15',bordercolor:'#355348',font:{color:'#f7f2e8'}}
});

const tapNum = v => (v==null || v==='' || !Number.isFinite(+v)) ? null : +v;
const tapPctText = v => tapNum(v)==null ? (en()?'N/A':'N/D') : (tapNum(v)*100).toFixed(1)+'%';

function tapLinearTicks(values, target=6, floorZero=false) {
  const a=values.map(tapNum).filter(v=>v!=null);
  if(!a.length) return {range:[0,1],tickvals:[0,.2,.4,.6,.8,1],ticktext:['0','0.2','0.4','0.6','0.8','1']};
  let lo=Math.min(...a), hi=Math.max(...a);
  if (floorZero && lo>0) lo=0;
  if (lo===hi) { lo-=1; hi+=1; }
  const raw=(hi-lo)/Math.max(2,target);
  const p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1e-9))));
  const n=raw/p;
  const step=(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;
  const start=Math.floor(lo/step)*step;
  const end=Math.ceil(hi/step)*step;
  const ticks=[];
  for(let v=start;v<=end+step*.25;v+=step) ticks.push(+v.toFixed(6));
  const pad=(end-start)*.04 || step*.5;
  return {
    range:[floorZero ? Math.max(0,start) : start-pad, end+pad],
    tickvals:ticks,
    ticktext:ticks.map(v=>v.toLocaleString(S.lang,{maximumFractionDigits:2}))
  };
}

function tapEmpty(id, text) {
  try { Plotly.purge(id); } catch (_) {}
  const el=$('#'+id);
  if(el) el.innerHTML=`<div class="empty-state">${text}</div>`;
}

/* ---------------- Shooting & Zones ---------------- */
shooting=function(){
  const selected=era();
  const l=S.league
    .filter(x=>x.season>=1997 && x.era===selected)
    .sort((a,b)=>a.season-b.season);
  const latest=l.length?l[l.length-1]:null;

  const kpis=[
    [en()?'Latest shot-data season':'Última temporada com shot data',latest?latest.season_label:null,'text'],
    [en()?'3P share of FGA':'Participação dos 3P nos FGA',latest?tapNum(latest.zone_3p_share):null,'pct'],
    ['Corner 3%',latest?tapNum(latest.corner3_pct):null,'pct'],
    [en()?'Dunks / team / game':'Enterradas / equipe / jogo',latest?tapNum(latest.dunks_pg):null,'one']
  ];
  if($('#shootingKpis')) $('#shootingKpis').innerHTML=kpis.map(([label,value,kind])=>`
    <div class="shooting-kpi">
      <div class="shooting-kpi-label">${label}</div>
      <div class="shooting-kpi-value">${kind==='text'?(value||(en()?'N/A':'N/D')):f(value,kind)}</div>
    </div>`).join('');

  if(!l.length){
    tapEmpty('zoneShareChart',en()?'No shot-location data available for this period.':'Não há dados de localização de arremesso disponíveis para este período.');
    tapEmpty('cornerChart',en()?'No corner-3 data available.':'Não há dados de corner 3 disponíveis.');
    tapEmpty('dunkTrend',en()?'No dunk data available.':'Não há dados de enterradas disponíveis.');
  } else {
    const years=l.map(x=>+x.season);
    const zones=[
      ['zone_0_3_share','0–3 ft'],
      ['zone_3_10_share','3–10 ft'],
      ['zone_10_16_share','10–16 ft'],
      ['zone_16_3p_share','16 ft–3P'],
      ['zone_3p_share','3P']
    ];
    const pctTicks=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1];

    Plotly.react('zoneShareChart',zones.map(([k,n])=>({
      x:years,
      y:l.map(x=>tapNum(x[k])),
      customdata:l.map(x=>tapPctText(x[k])),
      name:n,mode:'lines',stackgroup:'one',
      line:{width:2},
      hovertemplate:`%{x}<br>${n}: %{customdata}<extra></extra>`
    })),{
      ...tapPlotBase(),
      margin:{l:68,r:24,t:34,b:50},
      xaxis:{type:'linear',gridcolor:'#274238',title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,automargin:true},
      yaxis:{type:'linear',gridcolor:'#274238',title:en()?'Share of FGA':'Participação nos FGA',range:[0,1],
        tickmode:'array',tickvals:pctTicks,ticktext:pctTicks.map(v=>`${Math.round(v*100)}%`),automargin:true},
      legend:{orientation:'h',x:0,y:1.10,xanchor:'left',yanchor:'bottom'},
      hovermode:'x unified'
    },C);

    const cornerAtt=l.map(x=>tapNum(x.corner3_att_pg));
    const cAxis=tapLinearTicks(cornerAtt,5,true);
    const cornerPct=l.map(x=>tapNum(x.corner3_pct));
    const validPct=cornerPct.filter(v=>v!=null);
    let pMin=validPct.length?Math.max(0,Math.floor((Math.min(...validPct)-.02)*20)/20):.30;
    let pMax=validPct.length?Math.min(1,Math.ceil((Math.max(...validPct)+.02)*20)/20):.45;
    if(pMax<=pMin) pMax=Math.min(1,pMin+.10);
    const rightTicks=[]; for(let v=pMin;v<=pMax+.0001;v+=.05) rightTicks.push(+v.toFixed(2));

    Plotly.react('cornerChart',[
      {x:years,y:cornerAtt,name:en()?'Attempts / team / G':'Tentativas / equipe / J',mode:'lines+markers',
       line:{width:2.5},marker:{size:6},hovertemplate:`%{x}<br>${en()?'Attempts/team/G':'Tentativas/equipe/J'}: %{y:.2f}<extra></extra>`},
      {x:years,y:cornerPct,customdata:l.map(x=>tapPctText(x.corner3_pct)),name:'Corner 3%',mode:'lines+markers',yaxis:'y2',
       line:{width:2.3},marker:{size:5},hovertemplate:'%{x}<br>Corner 3%: %{customdata}<extra></extra>'}
    ],{
      ...tapPlotBase(),
      margin:{l:68,r:72,t:40,b:50},
      xaxis:{type:'linear',gridcolor:'#274238',title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,automargin:true},
      yaxis:{type:'linear',gridcolor:'#274238',title:en()?'Attempts / team / game':'Tentativas / equipe / jogo',
        range:cAxis.range,tickmode:'array',tickvals:cAxis.tickvals,ticktext:cAxis.ticktext,automargin:true},
      yaxis2:{type:'linear',overlaying:'y',side:'right',title:'Corner 3%',range:[pMin,pMax],
        tickmode:'array',tickvals:rightTicks,ticktext:rightTicks.map(v=>`${Math.round(v*100)}%`),
        gridcolor:'rgba(0,0,0,0)',automargin:true},
      legend:{orientation:'h',x:0,y:1.12,xanchor:'left',yanchor:'bottom'},
      hovermode:'x unified'
    },C);

    const dunks=l.map(x=>tapNum(x.dunks_pg));
    const dAxis=tapLinearTicks(dunks,6,false);
    Plotly.react('dunkTrend',[{
      x:years,y:dunks,mode:'lines+markers',
      name:en()?'Dunks / team / G':'Enterradas / equipe / J',
      line:{width:2.6},marker:{size:6},
      hovertemplate:`%{x}<br>${en()?'Dunks/team/G':'Enterradas/equipe/J'}: %{y:.2f}<extra></extra>`
    }],{
      ...tapPlotBase(),
      margin:{l:72,r:28,t:34,b:50},
      xaxis:{type:'linear',gridcolor:'#274238',title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,automargin:true},
      yaxis:{type:'linear',gridcolor:'#274238',title:en()?'Dunks / team / game':'Enterradas / equipe / jogo',
        range:dAxis.range,tickmode:'array',tickvals:dAxis.tickvals,ticktext:dAxis.ticktext,automargin:true},
      showlegend:false
    },C);
  }

  const a=S.players.filter(x=>x.era===selected && tapNum(x.num_of_dunks)!=null)
    .sort((x,y)=>tapNum(y.num_of_dunks)-tapNum(x.num_of_dunks)).slice(0,15);
  $('#dunkLeaders').innerHTML=tbl(
    ['#',en()?'Player':'Jogador','Dunks','Dunks/G','G'],
    a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x.num_of_dunks,'int')}</td><td>${f(x.dunks_pg,'two')}</td><td>${f(x.g,'int')}</td></tr>`)
  );
};

/* ---------------- Fouls & PBP ---------------- */
fouls=function(){
  const selected=era();
  const l=S.league.filter(x=>x.era===selected).sort((a,b)=>a.season-b.season);
  const years=l.map(x=>+x.season);
  const pf=l.map(x=>tapNum(x.pf_pg));
  const fta=l.map(x=>tapNum(x.fta_pg));
  const all=pf.concat(fta).filter(v=>v!=null);

  if(!all.length){
    tapEmpty('pfFtTrend',en()?'No foul/free-throw data available.':'Não há dados de faltas/lances livres disponíveis.');
  } else {
    const ax=tapLinearTicks(all,6,false);
    Plotly.react('pfFtTrend',[
      {x:years,y:pf,name:'PF/G',mode:'lines+markers',line:{width:2.4},marker:{size:5},
       hovertemplate:`%{x}<br>PF/G: %{y:.2f}<extra></extra>`},
      {x:years,y:fta,name:'FTA/G',mode:'lines+markers',line:{width:2.4},marker:{size:5},
       hovertemplate:`%{x}<br>FTA/G: %{y:.2f}<extra></extra>`}
    ],{
      ...tapPlotBase(),
      margin:{l:72,r:30,t:44,b:52},
      xaxis:{type:'linear',gridcolor:'#274238',title:en()?'Season':'Temporada',dtick:l.length<=12?1:2,automargin:true},
      yaxis:{type:'linear',gridcolor:'#274238',title:en()?'Events / team / game':'Eventos / equipe / jogo',
        range:ax.range,tickmode:'array',tickvals:ax.tickvals,ticktext:ax.ticktext,automargin:true},
      legend:{orientation:'h',x:0,y:1.11,xanchor:'left',yanchor:'bottom'},
      hovermode:'x unified'
    },C);
  }

  const p=l.filter(x=>x.season>=1997);
  const candidates=[
    ['shooting_fouls_drawn_pg',en()?'Shooting fouls drawn':'Faltas de arremesso sofridas'],
    ['off_fouls_drawn_pg',en()?'Offensive fouls drawn':'Faltas ofensivas sofridas'],
    ['off_fouls_committed_pg',en()?'Offensive fouls committed':'Faltas ofensivas cometidas'],
    ['and1_pg','And-1']
  ];
  /* Prefer drawn offensive fouls; use committed if the source has no drawn series. */
  const hasOffDrawn=p.some(x=>tapNum(x.off_fouls_drawn_pg)!=null);
  const chosen=candidates.filter(([k])=>k!=='off_fouls_committed_pg' || !hasOffDrawn)
    .filter(([k])=>p.some(x=>tapNum(x[k])!=null));
  const pAll=chosen.flatMap(([k])=>p.map(x=>tapNum(x[k]))).filter(v=>v!=null);

  if(!p.length || !pAll.length){
    tapEmpty('pbpTrend',en()?'Detailed PBP contact data are not available for this period.':'Os dados detalhados de contato PBP não estão disponíveis para este período.');
  } else {
    const ax=tapLinearTicks(pAll,6,true);
    Plotly.react('pbpTrend',chosen.map(([k,name])=>({
      x:p.map(x=>+x.season),y:p.map(x=>tapNum(x[k])),name,mode:'lines+markers',
      line:{width:2.3},marker:{size:5},hovertemplate:`%{x}<br>${name}: %{y:.2f}<extra></extra>`
    })),{
      ...tapPlotBase(),
      margin:{l:72,r:30,t:58,b:52},
      xaxis:{type:'linear',gridcolor:'#274238',title:en()?'Season':'Temporada',dtick:p.length<=12?1:2,automargin:true},
      yaxis:{type:'linear',gridcolor:'#274238',title:en()?'Events / team / game':'Eventos / equipe / jogo',
        range:ax.range,tickmode:'array',tickvals:ax.tickvals,ticktext:ax.ticktext,automargin:true},
      legend:{orientation:'h',x:0,y:1.10,xanchor:'left',yanchor:'bottom'},
      hovermode:'x unified'
    },C);
  }

  const pe=S.players.filter(x=>x.era===selected);
  const cats=[
    ['FTA','fta'],['PF','pf'],
    [en()?'Shooting fouls drawn':'Faltas de arremesso sofridas','shooting_foul_drawn'],
    [en()?'Offensive fouls drawn':'Faltas ofensivas sofridas','offensive_foul_drawn'],
    ['And-1','and1']
  ];
  $('#foulLeaderTable').innerHTML=tbl(
    [en()?'Category':'Categoria',en()?'Leader':'Líder','Total','G'],
    cats.map(([name,k])=>{
      const x=pe.filter(v=>tapNum(v[k])!=null).sort((a,b)=>tapNum(b[k])-tapNum(a[k]))[0];
      return x?`<tr><td>${name}</td><td>${esc(x.player)}</td><td>${f(x[k],'int')}</td><td>${f(x.g,'int')}</td></tr>`:'';
    })
  );
};

/* ---------------- Teams ---------------- */
teams=function(){
  const m=$('#teamMetric').value;
  const d=TM[m];
  const selected=era();
  let a=S.teams.filter(x=>x.era===selected && tapNum(x[m])!=null);
  a.sort((x,y)=>d[2] ? tapNum(x[m])-tapNum(y[m]) : tapNum(y[m])-tapNum(x[m]));
  const tableRows=a.slice(0,30);
  const chartRows=a.slice(0,20);
  const z=[...chartRows].reverse();
  const vals=z.map(x=>tapNum(x[m]));
  const labels=z.map(x=>`${x.team} • ${x.season_label}`);

  if(!vals.length){
    tapEmpty('teamChart',en()?'No team data available for this metric.':'Não há dados de equipes disponíveis para esta métrica.');
  } else {
    let lo=Math.min(...vals), hi=Math.max(...vals);
    let range;
    if(m==='win_pct') range=[0,1];
    else if(['srs','n_rtg'].includes(m)) {
      const pad=Math.max(1,(hi-lo)*.10);
      range=[Math.min(0,lo-pad),hi+pad];
    } else {
      range=[0,hi*1.10];
    }

    const tickFormat=m==='win_pct'?'.0%':undefined;
    Plotly.react('teamChart',[{
      x:vals,y:labels,type:'bar',orientation:'h',
      marker:{color:'#d8b363',line:{color:'rgba(247,238,208,.18)',width:1}},
      text:z.map(x=>f(x[m],d[1])),
      textposition:'outside',cliponaxis:false,
      hovertemplate:`%{y}<br>${d[0]}: %{text}<extra></extra>`
    }],{
      ...tapPlotBase(),
      margin:{l:255,r:82,t:26,b:54},
      xaxis:{type:'linear',gridcolor:'#274238',title:d[0],range,automargin:true,tickformat:tickFormat},
      yaxis:{type:'category',gridcolor:'#274238',categoryorder:'array',categoryarray:labels,automargin:true},
      showlegend:false,bargap:.24
    },C);
  }

  $('#teamTable').innerHTML=tbl(
    ['#',en()?'Team':'Equipe',en()?'Season':'Temporada',d[0],'W-L','SRS','ORtg','DRtg','Net','Pace'],
    tableRows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.team)}</td><td>${x.season_label}</td><td>${f(x[m],d[1])}</td><td>${f(x.w,'int')}-${f(x.l,'int')}</td><td>${f(x.srs)}</td><td>${f(x.o_rtg)}</td><td>${f(x.d_rtg)}</td><td>${f(x.n_rtg)}</td><td>${f(x.pace)}</td></tr>`)
  );
};

/* app.js bound the original teams function directly before this file loads. */
if($('#teamMetric')) $('#teamMetric').onchange=()=>teams();

/* Repaint currently visible affected charts after this override is installed. */
setStatic();
if(S.ready){
  shooting(); fouls(); teams();
}
