/* NBA Analytics — UI QA v2
   1) Rebinds selectors to the latest renderer functions after multi-period overrides.
   2) Removes stale N/D placeholders before valid Plotly redraws.
   3) Replaces the glossary with a complete, detailed metric dictionary.
*/
(() => {
  'use strict';

  const STYLE_ID = 'nba-dashboard-qa-v2-style';

  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .qa-empty{display:flex;align-items:center;justify-content:center;min-height:180px;padding:28px;text-align:center;color:var(--muted);font-size:16px;line-height:1.45;border:1px dashed rgba(216,179,99,.14);border-radius:10px;background:rgba(8,20,16,.36)}
      #glossaryTable{max-height:none;overflow:auto}
      #glossaryTable table.glossary-v2{min-width:1080px;table-layout:fixed}
      #glossaryTable .glossary-v2 th,#glossaryTable .glossary-v2 td{white-space:normal;vertical-align:top;line-height:1.45;padding:10px 11px}
      #glossaryTable .glossary-v2 th:nth-child(1),#glossaryTable .glossary-v2 td:nth-child(1){width:14%;text-align:left}
      #glossaryTable .glossary-v2 th:nth-child(2),#glossaryTable .glossary-v2 td:nth-child(2){width:19%;text-align:left}
      #glossaryTable .glossary-v2 th:nth-child(3),#glossaryTable .glossary-v2 td:nth-child(3){width:33%;text-align:left}
      #glossaryTable .glossary-v2 th:nth-child(4),#glossaryTable .glossary-v2 td:nth-child(4){width:19%;text-align:left}
      #glossaryTable .glossary-v2 th:nth-child(5),#glossaryTable .glossary-v2 td:nth-child(5){width:15%;text-align:left}
      .glossary-term{font-weight:850;color:#f3ead4}
      .glossary-category{display:inline-block;padding:3px 7px;border-radius:999px;background:rgba(121,201,141,.08);border:1px solid rgba(121,201,141,.16);font-size:10px;color:#bfe2c8}
      .glossary-note{display:block;margin-top:4px;color:var(--muted);font-size:10px}
      .glossary-formula{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#e5d29a}
      .glossary-summary{margin:0 0 12px;color:var(--muted);font-size:11px;line-height:1.55}
      @media(max-width:720px){#glossaryTable table.glossary-v2{min-width:920px}.qa-empty{font-size:14px;min-height:150px}}
    `;
    document.head.appendChild(style);
  }

  function cleanPlaceholder(id){
    const el=document.getElementById(id);
    if(!el) return;
    el.querySelectorAll('.qa-empty').forEach(n=>n.remove());
  }

  function installRendererGuards(){
    if(window.__nbaRendererGuardsInstalled) return;
    window.__nbaRendererGuardsInstalled=true;

    const leagueBase=league;
    league=function(...args){ cleanPlaceholder('leagueTrend'); return leagueBase(...args); };

    const playersBase=players;
    players=function(...args){
      cleanPlaceholder('playerRankChart');
      const out=playersBase(...args);
      const chart=document.getElementById('playerRankChart');
      if(chart && chart.querySelector('.plot-container')) chart.querySelectorAll('.qa-empty').forEach(n=>n.remove());
      return out;
    };

    const detailBase=detail;
    detail=function(...args){ return detailBase(...args); };

    const shootingBase=shooting;
    shooting=function(...args){
      ['zoneShareChart','cornerChart','dunkTrend'].forEach(cleanPlaceholder);
      return shootingBase(...args);
    };

    const foulsBase=fouls;
    fouls=function(...args){
      ['pfFtTrend','pbpTrend'].forEach(cleanPlaceholder);
      return foulsBase(...args);
    };

    const teamsBase=teams;
    teams=function(...args){
      cleanPlaceholder('teamChart');
      const out=teamsBase(...args);
      const chart=document.getElementById('teamChart');
      if(chart && chart.querySelector('.plot-container')) chart.querySelectorAll('.qa-empty').forEach(n=>n.remove());
      return out;
    };
  }

  // Complete dictionary. Formulae are intentionally explicit where a stable
  // arithmetic definition exists; model-based metrics are described as models.
  const GLOSSARY=[
    {t:'G',full:'Games',pt:'Jogos disputados pelo jogador ou pela equipe.',en:'Games played by the player or team.',formula:'Contagem',cat:'Básica'},
    {t:'GS',full:'Games Started',pt:'Jogos em que o atleta começou como titular.',en:'Games in which the player was in the starting lineup.',formula:'Contagem',cat:'Básica'},
    {t:'MP',full:'Minutes Played',pt:'Minutos totais jogados. É usado também como base de normalização de várias métricas avançadas.',en:'Total minutes played. It is also used as the exposure base for several advanced metrics.',formula:'Contagem de minutos',cat:'Básica'},
    {t:'PTS',full:'Points',pt:'Pontos totais marcados.',en:'Total points scored.',formula:'1×FTM + 2×2PM + 3×3PM',cat:'Pontuação'},
    {t:'PTS/G · PPG',full:'Points Per Game',pt:'Média de pontos por jogo. No ranking do dashboard, PPG = pontos totais divididos pelos jogos disputados.',en:'Average points per game. In the dashboard ranking, PPG equals total points divided by games played.',formula:'PTS ÷ G',cat:'Pontuação'},
    {t:'FG · FGM',full:'Field Goals Made',pt:'Arremessos de quadra convertidos, incluindo cestas de 2 e de 3 pontos.',en:'Made field goals, including both two- and three-point baskets.',formula:'2PM + 3PM',cat:'Arremessos'},
    {t:'FGA',full:'Field Goal Attempts',pt:'Tentativas de arremesso de quadra. Não inclui lances livres.',en:'Field-goal attempts. Free throws are not included.',formula:'Tentativas de FG',cat:'Arremessos'},
    {t:'FG%',full:'Field Goal Percentage',pt:'Percentual de tentativas de quadra convertidas.',en:'Percentage of field-goal attempts made.',formula:'FGM ÷ FGA',cat:'Arremessos'},
    {t:'2PM · 2P',full:'Two-Point Field Goals Made',pt:'Cestas de dois pontos convertidas.',en:'Made two-point field goals.',formula:'Contagem',cat:'Arremessos'},
    {t:'2PA',full:'Two-Point Field Goal Attempts',pt:'Tentativas de arremesso de dois pontos.',en:'Two-point field-goal attempts.',formula:'Contagem',cat:'Arremessos'},
    {t:'2P%',full:'Two-Point Percentage',pt:'Eficiência nas tentativas de dois pontos.',en:'Efficiency on two-point attempts.',formula:'2PM ÷ 2PA',cat:'Arremessos'},
    {t:'3PM · 3P',full:'Three-Point Field Goals Made',pt:'Bolas de três pontos convertidas.',en:'Made three-point field goals.',formula:'Contagem',cat:'3 pontos'},
    {t:'3PA',full:'Three-Point Attempts',pt:'Tentativas de arremesso de três pontos.',en:'Three-point field-goal attempts.',formula:'Contagem',cat:'3 pontos'},
    {t:'3P%',full:'Three-Point Percentage',pt:'Percentual das tentativas de três pontos que foram convertidas.',en:'Percentage of three-point attempts made.',formula:'3PM ÷ 3PA',cat:'3 pontos'},
    {t:'3PAr',full:'Three-Point Attempt Rate',pt:'Mostra qual parcela de todos os arremessos de quadra foi tentada de três pontos. É uma medida de perfil/spacing, não de precisão.',en:'Share of all field-goal attempts taken from three-point range. It measures shot profile/spacing, not accuracy.',formula:'3PA ÷ FGA',cat:'3 pontos'},
    {t:'FT · FTM',full:'Free Throws Made',pt:'Lances livres convertidos.',en:'Made free throws.',formula:'Contagem',cat:'Lances livres'},
    {t:'FTA',full:'Free Throw Attempts',pt:'Tentativas de lance livre.',en:'Free-throw attempts.',formula:'Contagem',cat:'Lances livres'},
    {t:'FT%',full:'Free Throw Percentage',pt:'Percentual de lances livres convertidos.',en:'Percentage of free-throw attempts made.',formula:'FTM ÷ FTA',cat:'Lances livres'},
    {t:'ORB',full:'Offensive Rebounds',pt:'Rebotes ofensivos: recuperações da posse após um arremesso errado da própria equipe.',en:'Offensive rebounds: possessions recovered after the player’s own team misses a shot.',formula:'Contagem',cat:'Rebotes'},
    {t:'DRB',full:'Defensive Rebounds',pt:'Rebotes defensivos: recuperação da posse após um arremesso errado do adversário.',en:'Defensive rebounds: possessions secured after the opponent misses.',formula:'Contagem',cat:'Rebotes'},
    {t:'TRB · REB',full:'Total Rebounds',pt:'Rebotes totais, somando ofensivos e defensivos.',en:'Total rebounds, combining offensive and defensive rebounds.',formula:'ORB + DRB',cat:'Rebotes'},
    {t:'RPG',full:'Rebounds Per Game',pt:'Média de rebotes totais por jogo.',en:'Average total rebounds per game.',formula:'TRB ÷ G',cat:'Rebotes'},
    {t:'AST',full:'Assists',pt:'Assistências: passes creditados como criação direta de uma cesta.',en:'Assists: passes credited with directly creating a made basket.',formula:'Contagem',cat:'Criação'},
    {t:'APG',full:'Assists Per Game',pt:'Média de assistências por jogo.',en:'Average assists per game.',formula:'AST ÷ G',cat:'Criação'},
    {t:'STL',full:'Steals',pt:'Roubos de bola que geram mudança de posse.',en:'Steals that cause a change of possession.',formula:'Contagem',cat:'Defesa'},
    {t:'BLK',full:'Blocks',pt:'Tocos: arremessos adversários desviados legalmente por um defensor.',en:'Blocks: opponent shot attempts legally deflected by a defender.',formula:'Contagem',cat:'Defesa'},
    {t:'BPG',full:'Blocks Per Game',pt:'Média de tocos por jogo.',en:'Average blocks per game.',formula:'BLK ÷ G',cat:'Defesa'},
    {t:'TOV',full:'Turnovers',pt:'Perdas de posse atribuídas ao jogador/equipe.',en:'Possessions lost and charged as turnovers to the player/team.',formula:'Contagem',cat:'Posse'},
    {t:'PF',full:'Personal Fouls',pt:'Faltas pessoais cometidas.',en:'Personal fouls committed.',formula:'Contagem',cat:'Faltas'},
    {t:'TS%',full:'True Shooting Percentage',pt:'Métrica de eficiência de pontuação que combina arremessos de 2, de 3 e lances livres. No dashboard, é recalculada a partir dos totais do período.',en:'Scoring-efficiency metric combining two-pointers, three-pointers and free throws. In this dashboard it is recalculated from period totals.',formula:'PTS ÷ [2 × (FGA + 0,44 × FTA)]',cat:'Eficiência'},
    {t:'eFG%',full:'Effective Field Goal Percentage',pt:'FG% ajustado para reconhecer que uma bola de 3 vale 50% mais pontos que uma cesta de 2.',en:'Field-goal percentage adjusted for the extra value of a made three-pointer.',formula:'(FGM + 0,5 × 3PM) ÷ FGA',cat:'Eficiência'},
    {t:'PER',full:'Player Efficiency Rating',pt:'Índice criado por John Hollinger que resume produção de box score por minuto e é normalizado em torno de 15 para a média da liga. Quanto maior, maior a produção estatística; não mede perfeitamente defesa ou contexto.',en:'John Hollinger’s per-minute box-score summary metric, normalized around a league average of 15. Higher means more statistical production; it does not fully capture defense or context.',formula:'Modelo composto por minuto',cat:'Avançada'},
    {t:'USG%',full:'Usage Percentage',pt:'Estimativa da porcentagem das posses da equipe encerradas pelo jogador enquanto ele está em quadra, principalmente por FGA, FTA e TOV.',en:'Estimated percentage of team possessions finished by the player while on court, mainly through FGA, FTA and TOV.',formula:'Modelo de uso de posses',cat:'Avançada'},
    {t:'WS · Win Shares',full:'Win Shares',pt:'Estimativa de quantas vitórias foram atribuídas à contribuição do jogador. Combina componentes ofensivos e defensivos e é acumulativa: mais minutos e temporadas podem aumentar o total.',en:'Estimate of the number of team wins attributable to a player’s contribution. It combines offensive and defensive components and is cumulative.',formula:'OWS + DWS',cat:'Avançada'},
    {t:'OWS',full:'Offensive Win Shares',pt:'Componente ofensivo das Win Shares.',en:'Offensive component of Win Shares.',formula:'Modelo Win Shares',cat:'Avançada'},
    {t:'DWS',full:'Defensive Win Shares',pt:'Componente defensivo das Win Shares.',en:'Defensive component of Win Shares.',formula:'Modelo Win Shares',cat:'Avançada'},
    {t:'WS/48',full:'Win Shares Per 48 Minutes',pt:'Win Shares normalizadas para 48 minutos, permitindo comparar produção de vitória com menor influência do volume de minutos. Valores maiores indicam maior contribuição estimada por tempo de quadra.',en:'Win Shares normalized to 48 minutes, reducing the effect of playing-time volume. Higher values indicate greater estimated contribution per minute.',formula:'WS × 48 ÷ MP',cat:'Avançada'},
    {t:'BPM',full:'Box Plus/Minus',pt:'Modelo que estima o impacto de um jogador por 100 posses em relação a um jogador médio, usando estatísticas de box score e contexto da equipe. BPM +5 significa aproximadamente +5 pontos por 100 posses acima da referência do modelo.',en:'Model estimating a player’s impact per 100 possessions relative to an average player, using box-score statistics and team context. A BPM of +5 is roughly five points per 100 possessions above the model baseline.',formula:'Modelo Basketball-Reference',cat:'Avançada'},
    {t:'OBPM',full:'Offensive Box Plus/Minus',pt:'Parcela ofensiva do BPM.',en:'Offensive component of BPM.',formula:'Componente do BPM',cat:'Avançada'},
    {t:'DBPM',full:'Defensive Box Plus/Minus',pt:'Parcela defensiva do BPM. É uma estimativa baseada em box score, não uma medição direta de todas as ações defensivas.',en:'Defensive component of BPM. It is a box-score estimate, not a direct measurement of every defensive action.',formula:'Componente do BPM',cat:'Avançada'},
    {t:'VORP',full:'Value Over Replacement Player',pt:'Estimativa acumulada do valor produzido acima de um jogador de nível de reposição. Deriva do BPM e ajusta o impacto pelo tempo em quadra. É útil para comparar contribuição total dentro de um período.',en:'Cumulative estimate of value produced above a replacement-level player. It is derived from BPM and scales impact by playing time, making it useful for total contribution over a period.',formula:'Derivado de BPM + minutos',cat:'Avançada'},
    {t:'W',full:'Wins',pt:'Vitórias da equipe.',en:'Team wins.',formula:'Contagem',cat:'Equipe'},
    {t:'L',full:'Losses',pt:'Derrotas da equipe.',en:'Team losses.',formula:'Contagem',cat:'Equipe'},
    {t:'W-L',full:'Wins–Losses Record',pt:'Campanha da equipe apresentada como vitórias–derrotas.',en:'Team record shown as wins–losses.',formula:'W – L',cat:'Equipe'},
    {t:'Win%',full:'Winning Percentage',pt:'Percentual dos jogos vencidos pela equipe.',en:'Percentage of team games won.',formula:'W ÷ (W + L)',cat:'Equipe'},
    {t:'ORtg',full:'Offensive Rating',pt:'Eficiência ofensiva: pontos marcados por 100 posses. Quanto maior, melhor o ataque.',en:'Offensive efficiency: points scored per 100 possessions. Higher is better offensively.',formula:'Pontos por 100 posses',cat:'Equipe'},
    {t:'DRtg',full:'Defensive Rating',pt:'Eficiência defensiva: pontos sofridos por 100 posses. Para equipes, menor é melhor.',en:'Defensive efficiency: points allowed per 100 possessions. For teams, lower is better.',formula:'Pontos sofridos por 100 posses',cat:'Equipe'},
    {t:'Net Rating · NetRtg',full:'Net Rating',pt:'Saldo de eficiência por 100 posses. Positivo significa que a equipe marca mais do que sofre a cada 100 posses.',en:'Efficiency differential per 100 possessions. Positive means the team scores more than it allows per 100 possessions.',formula:'ORtg − DRtg',cat:'Equipe'},
    {t:'SRS',full:'Simple Rating System',pt:'Indicador de força da equipe que considera diferencial médio de pontos e força dos adversários. Valores positivos representam desempenho acima da média.',en:'Team-strength indicator combining average point differential and strength of schedule. Positive values indicate above-average performance.',formula:'Margem de pontos + ajuste de calendário',cat:'Equipe'},
    {t:'Pace',full:'Pace Factor',pt:'Estimativa do número de posses por 48 minutos. Pace maior significa jogo mais rápido, não necessariamente maior eficiência.',en:'Estimated possessions per 48 minutes. Higher pace means faster play, not necessarily better efficiency.',formula:'Posses estimadas / 48 min',cat:'Equipe'},
    {t:'PBP',full:'Play-by-Play',pt:'Base evento a evento: arremessos, faltas, turnovers, substituições e outras ações registradas cronologicamente. No projeto, várias métricas PBP têm cobertura a partir de 1996-97.',en:'Event-by-event data: shots, fouls, turnovers, substitutions and other actions recorded chronologically. In this project, several PBP metrics are available from 1996-97 onward.',formula:'Eventos registrados',cat:'Cobertura'},
    {t:'Dunks',full:'Dunks Made',pt:'Número de enterradas convertidas no período com cobertura de shot data.',en:'Number of made dunks in the period where shot-data coverage exists.',formula:'Contagem',cat:'Finalização',notePt:'Cobertura histórica principalmente a partir de 1996-97.',noteEn:'Historical coverage mainly from 1996-97 onward.'},
    {t:'Dunks/G',full:'Dunks Per Game',pt:'Média de enterradas convertidas por jogo.',en:'Average made dunks per game.',formula:'Dunks ÷ G',cat:'Finalização',notePt:'Depende da cobertura de shot data.',noteEn:'Depends on shot-data coverage.'},
    {t:'Corner 3',full:'Corner Three-Point Shot',pt:'Arremesso de três pontos realizado no canto/zona morta, onde a linha de 3 é mais curta que no arco frontal.',en:'Three-point shot taken from the corner, where the three-point line is shorter than above the break.',formula:'Zona da quadra',cat:'3 pontos'},
    {t:'Corner 3%',full:'Corner Three-Point Percentage',pt:'Percentual de bolas de 3 da zona morta convertidas. No agregado do dashboard, o percentual é ponderado pelo volume estimado de tentativas de corner 3.',en:'Percentage of corner three-point attempts made. In dashboard aggregates, it is weighted by the estimated corner-three attempt volume.',formula:'Corner 3M ÷ Corner 3A',cat:'3 pontos',notePt:'Cobertura de localização de arremesso principalmente a partir de 1996-97.',noteEn:'Shot-location coverage mainly from 1996-97 onward.'},
    {t:'Shooting fouls drawn',full:'Shooting Fouls Drawn',pt:'Quantidade de faltas de arremesso sofridas/forçadas pelo jogador segundo o play-by-play. Indica capacidade de gerar contato em ações de finalização.',en:'Number of shooting fouls drawn by the player according to play-by-play data. It reflects the ability to create contact on scoring attempts.',formula:'Contagem PBP',cat:'Faltas',notePt:'Cobertura PBP histórica pode ser parcial.',noteEn:'Historical PBP coverage may be partial.'},
    {t:'Offensive fouls drawn',full:'Offensive Fouls Drawn',pt:'Quantidade de faltas ofensivas cometidas pelo adversário e creditadas como provocadas pelo defensor, como várias situações de charge/contato ofensivo.',en:'Number of opponent offensive fouls credited as drawn by the defender, including many charge/contact situations.',formula:'Contagem PBP',cat:'Defesa/Faltas',notePt:'Pode estar N/D em períodos sem cobertura PBP suficiente.',noteEn:'May be N/A in periods without sufficient PBP coverage.'},
    {t:'And-1',full:'And-One',pt:'Jogada em que o jogador converte a cesta, sofre falta no ato do arremesso e ganha um lance livre adicional.',en:'Play in which the player makes the field goal, is fouled in the act of shooting and earns one additional free throw.',formula:'Contagem PBP',cat:'Finalização/Faltas'},
    {t:'Triple-double',full:'Triple-Double',pt:'Jogo em que um jogador alcança pelo menos 10 em três categorias estatísticas, tradicionalmente entre pontos, rebotes, assistências, roubos e tocos.',en:'Game in which a player reaches at least 10 in three statistical categories, traditionally among points, rebounds, assists, steals and blocks.',formula:'≥10 em 3 categorias',cat:'Marco estatístico'},
    {t:'p.p.',full:'Percentage Points',pt:'Pontos percentuais. Mede a diferença direta entre dois percentuais; por exemplo, 60% − 55% = +5 p.p.',en:'Percentage points. Direct difference between percentages; for example, 60% − 55% = +5 p.p.',formula:'Diferença entre percentuais',cat:'Estatística'},
    {t:'/G',full:'Per Game',pt:'Sufixo que significa “por jogo”. Exemplos: PTS/G, 3PA/G, PF/G e Dunks/G.',en:'Suffix meaning “per game”. Examples: PTS/G, 3PA/G, PF/G and Dunks/G.',formula:'Total ÷ G',cat:'Normalização'},
    {t:'Per 36',full:'Per 36 Minutes',pt:'Normalização de uma estatística para 36 minutos de quadra, útil para comparar jogadores com tempos de jogo diferentes.',en:'Statistic normalized to 36 minutes, useful for comparing players with different playing time.',formula:'Stat × 36 ÷ MP',cat:'Normalização'},
    {t:'Per 100 Poss',full:'Per 100 Possessions',pt:'Normalização para 100 posses, reduzindo o efeito de diferenças de ritmo (pace).',en:'Normalization to 100 possessions, reducing the effect of differences in pace.',formula:'Stat normalizada por posses',cat:'Normalização'},
    {t:'N/D · N/A',full:'Not Available',pt:'Dado não disponível na fonte para aquela combinação de período/métrica. O dashboard não inventa nem imputa esse valor.',en:'Data unavailable in the source for that period/metric combination. The dashboard does not invent or impute the value.',formula:'Sem dado',cat:'Cobertura'}
  ];

  function installGlossary(){
    glossary=function(){
      const input=document.getElementById('glossarySearch');
      const q=(input?.value||'').trim().toLowerCase();
      const rows=GLOSSARY.filter(x=>[
        x.t,x.full,x.pt,x.en,x.formula,x.cat,x.notePt,x.noteEn
      ].filter(Boolean).join(' ').toLowerCase().includes(q));
      const pt=!en();
      const root=document.getElementById('glossaryTable');
      if(!root) return;
      const headers=pt
        ? ['Sigla / termo','Nome completo','O que significa / como interpretar','Fórmula / leitura','Categoria / observação']
        : ['Acronym / term','Full name','Meaning / how to interpret','Formula / reading','Category / note'];
      root.innerHTML=`<p class="glossary-summary">${pt
        ? `Glossário técnico com ${GLOSSARY.length} métricas e termos utilizados no NBA Analytics. As fórmulas são mostradas quando existe uma definição aritmética direta; métricas de modelo, como BPM, PER e VORP, são identificadas como estimativas/modelos.`
        : `Technical glossary with ${GLOSSARY.length} metrics and terms used by NBA Analytics. Formulas are shown when a direct arithmetic definition exists; model-based metrics such as BPM, PER and VORP are explicitly identified as estimates/models.`}</p>`+
        `<table class="glossary-v2"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`+
        rows.map(x=>`<tr><td><span class="glossary-term">${esc(x.t)}</span></td><td>${esc(x.full)}</td><td>${esc(pt?x.pt:x.en)}</td><td><span class="glossary-formula">${esc(x.formula||'—')}</span></td><td><span class="glossary-category">${esc(x.cat)}</span>${(pt?x.notePt:x.noteEn)?`<span class="glossary-note">${esc(pt?x.notePt:x.noteEn)}</span>`:''}</td></tr>`).join('')+
        `</tbody></table>`;
    };
  }

  function rebindLatestFunctions(){
    const lm=document.getElementById('leagueMetric'); if(lm) lm.onchange=()=>league();
    const pm=document.getElementById('playerMetric'); if(pm) pm.onchange=()=>players();
    const ps=document.getElementById('playerSelect'); if(ps) ps.onchange=()=>detail();
    const tm=document.getElementById('teamMetric'); if(tm) tm.onchange=()=>teams();
    const gs=document.getElementById('glossarySearch'); if(gs) gs.oninput=()=>glossary();
  }

  function install(){
    if(window.__nbaDashboardQAV2Installed) return;
    window.__nbaDashboardQAV2Installed=true;
    installStyles();
    installRendererGuards();
    installGlossary();
    rebindLatestFunctions();
    try{ glossary(); }catch(e){ console.warn('NBA Analytics glossary v2 initial render:',e); }
    console.info(`NBA Analytics UI QA v2 active: ${GLOSSARY.length} glossary entries and dynamic filter bindings.`);
  }

  function boot(){
    try{
      if(typeof S==='undefined' || typeof players!=='function' || typeof teams!=='function' || typeof glossary!=='function'){
        setTimeout(boot,80);return;
      }
      install();
    }catch(e){
      console.warn('NBA Analytics UI QA v2 waiting for dashboard runtime:',e);
      setTimeout(boot,120);
    }
  }

  boot();
})();