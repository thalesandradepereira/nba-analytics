/* Shooting & Zones v2 — focused layout and axis rendering */
D.shot_distribution_note=['Participação de cada zona no total de tentativas de arremesso (FGA) dentro do período selecionado.','Share of total field-goal attempts (FGA) from each distance zone within the selected period.'];
D.corner_note=['Volume por equipe/jogo e eficiência da bola de 3 da zona morta.','Corner-3 volume per team/game and shooting efficiency.'];
D.dunk_note=['Evolução do volume médio de enterradas na liga durante o período selecionado.','Evolution of average league dunk volume during the selected period.'];
D.dunk_leaders_note=['Ranking acumulado do período selecionado; cobertura disponível a partir de 1996-97.','Cumulative ranking for the selected period; coverage is available from 1996-97 onward.'];

shooting=function(){
  const selected=era();
  const l=S.league.filter(x=>x.season>=1997&&x.era===selected);
  const latest=l.length?l[l.length-1]:null;
  const pct=v=>v==null||Number.isNaN(+v)?null:+v;
  const pctText=v=>v==null||Number.isNaN(+v)?(en()?'N/A':'N/D'):(+v*100).toFixed(1)+'%';

  const kpis=[
    [en()?'Latest shot-data season':'Última temporada com shot data',latest?latest.season_label:null,'text'],
    [en()?'3P share of FGA':'Participação dos 3P nos FGA',latest?pct(latest.zone_3p_share):null,'pct'],
    [en()?'Corner 3%':'Corner 3%',latest?pct(latest.corner3_pct):null,'pct'],
    [en()?'Dunks / team / game':'Enterradas / equipe / jogo',latest?latest.dunks_pg:null,'one']
  ];
  $('#shootingKpis').innerHTML=kpis.map(([label,value,kind])=>`<div class="shooting-kpi"><div class="shooting-kpi-label">${label}</div><div class="shooting-kpi-value">${kind==='text'?(value||(en()?'N/A':'N/D')):f(value,kind)}</div></div>`).join('');

  if(!l.length){
    ['zoneShareChart','cornerChart','dunkTrend'].forEach(id=>Plotly.purge(id));
    $('#zoneShareChart').innerHTML=`<div class="empty-state">${en()?'No shot-location data available for this period.':'Não há dados de localização de arremesso disponíveis para este período.'}</div>`;
    $('#cornerChart').innerHTML=`<div class="empty-state">${en()?'No corner-3 data available.':'Não há dados de corner 3 disponíveis.'}</div>`;
    $('#dunkTrend').innerHTML=`<div class="empty-state">${en()?'No dunk data available.':'Não há dados de enterradas disponíveis.'}</div>`;
  }else{
    const zones=[['zone_0_3_share','0–3 ft'],['zone_3_10_share','3–10 ft'],['zone_10_16_share','10–16 ft'],['zone_16_3p_share','16 ft–3P'],['zone_3p_share','3P']];
    const pctTicks=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1];
    const pctTickText=pctTicks.map(v=>Math.round(v*100)+'%');

    Plotly.react('zoneShareChart',zones.map(([k,n])=>({
      x:l.map(x=>x.season),y:l.map(x=>pct(x[k])),customdata:l.map(x=>pctText(x[k])),name:n,mode:'lines',stackgroup:'one',line:{width:1.8},hovertemplate:`%{x}<br>${n}: %{customdata}<extra></extra>`
    })),{
      ...L,margin:{l:62,r:24,t:18,b:48},
      xaxis:{...L.xaxis,title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,tickmode:'linear'},
      yaxis:{...L.yaxis,title:en()?'Share of FGA':'Participação nos FGA',range:[0,1],tickmode:'array',tickvals:pctTicks,ticktext:pctTickText},
      legend:{orientation:'h',x:0,y:1.12,xanchor:'left',yanchor:'bottom'},hovermode:'x unified'
    },C);

    const leftVals=l.map(x=>x.corner3_att_pg).filter(v=>v!=null&&Number.isFinite(+v)).map(Number);
    const leftMax=leftVals.length?Math.max(...leftVals):1;
    const cornerPcts=l.map(x=>pct(x.corner3_pct)).filter(v=>v!=null&&Number.isFinite(v));
    const pMin=cornerPcts.length?Math.max(0,Math.floor((Math.min(...cornerPcts)-.02)*20)/20):.3;
    const pMax=cornerPcts.length?Math.min(1,Math.ceil((Math.max(...cornerPcts)+.02)*20)/20):.45;
    const rightTicks=[];for(let v=pMin;v<=pMax+.0001;v+=.05)rightTicks.push(+v.toFixed(2));

    Plotly.react('cornerChart',[
      {x:l.map(x=>x.season),y:l.map(x=>x.corner3_att_pg),name:en()?'Attempts / team / G':'Tentativas / equipe / J',mode:'lines+markers',line:{width:2.4},marker:{size:6},hovertemplate:`%{x}<br>${en()?'Attempts/team/G':'Tentativas/equipe/J'}: %{y:.2f}<extra></extra>`},
      {x:l.map(x=>x.season),y:l.map(x=>pct(x.corner3_pct)),customdata:l.map(x=>pctText(x.corner3_pct)),name:'Corner 3%',mode:'lines+markers',yaxis:'y2',line:{width:2.2},marker:{size:5},hovertemplate:'%{x}<br>Corner 3%: %{customdata}<extra></extra>'}
    ],{
      ...L,margin:{l:58,r:60,t:20,b:48},
      xaxis:{...L.xaxis,title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,tickmode:'linear'},
      yaxis:{...L.yaxis,title:en()?'Attempts / team / game':'Tentativas / equipe / jogo',rangemode:'tozero',range:[0,leftMax*1.18]},
      yaxis2:{overlaying:'y',side:'right',title:'Corner 3%',range:[pMin,pMax],tickmode:'array',tickvals:rightTicks,ticktext:rightTicks.map(v=>Math.round(v*100)+'%'),gridcolor:'rgba(0,0,0,0)'},
      legend:{orientation:'h',x:0,y:1.14,xanchor:'left',yanchor:'bottom'},hovermode:'x unified'
    },C);

    const dunkVals=l.map(x=>x.dunks_pg).filter(v=>v!=null&&Number.isFinite(+v)).map(Number);
    const dMax=dunkVals.length?Math.max(...dunkVals):1;
    Plotly.react('dunkTrend',[{
      x:l.map(x=>x.season),y:l.map(x=>x.dunks_pg),mode:'lines+markers',name:en()?'Dunks / team / G':'Enterradas / equipe / J',line:{width:2.6},marker:{size:6},hovertemplate:`%{x}<br>${en()?'Dunks/team/G':'Enterradas/equipe/J'}: %{y:.2f}<extra></extra>`
    }],{
      ...L,margin:{l:58,r:24,t:20,b:48},
      xaxis:{...L.xaxis,title:en()?'Season':'Temporada',dtick:l.length<=6?1:2,tickmode:'linear'},
      yaxis:{...L.yaxis,title:en()?'Dunks / team / game':'Enterradas / equipe / jogo',rangemode:'tozero',range:[0,dMax*1.15]},showlegend:false
    },C);
  }

  const a=S.players.filter(x=>x.era===selected&&x.num_of_dunks!=null).sort((x,y)=>y.num_of_dunks-x.num_of_dunks).slice(0,15);
  $('#dunkLeaders').innerHTML=tbl(['#',en()?'Player':'Jogador','Dunks','Dunks/G','G'],a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player)}</td><td>${f(x.num_of_dunks,'int')}</td><td>${f(x.dunks_pg,'two')}</td><td>${f(x.g,'int')}</td></tr>`));
};

setStatic();
