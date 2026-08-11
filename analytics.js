/* NBA Analytics — GoatCounter integration.
   The public GoatCounter site code is intentionally stored separately in analytics-config.js.
   No API token or secret is required in the browser. */
(function(){
  'use strict';

  const cfg = window.NBA_ANALYTICS_CONFIG || {};
  const reach = document.getElementById('analyticsReach');
  const value = document.getElementById('analyticsValue');
  const label = document.getElementById('analyticsLabel');

  function isEnglish(){ return document.documentElement.lang === 'en-US'; }
  function setLanguage(){
    if(label) label.textContent = isEnglish() ? 'Site views' : 'Acessos';
    if(reach) reach.title = isEnglish()
      ? 'Public site-view counter. GoatCounter may cache this value for up to four hours.'
      : 'Contador público de acessos. O GoatCounter pode manter este valor em cache por até quatro horas.';
  }

  function validCode(code){ return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(code || ''); }
  function productionAllowed(){
    const hosts = Array.isArray(cfg.productionHosts) ? cfg.productionHosts : [];
    return hosts.length === 0 || hosts.includes(location.hostname);
  }

  async function loadPublicCounter(code){
    if(!cfg.publicCounter || !reach || !value) return;
    reach.hidden = false;
    reach.classList.add('is-loading');
    value.textContent = '…';
    try{
      const endpoint = `https://${code}.goatcounter.com/counter/TOTAL.json`;
      const response = await fetch(endpoint, {cache:'no-store', mode:'cors'});
      if(!response.ok) throw new Error(`counter HTTP ${response.status}`);
      const payload = await response.json();
      if(!payload || payload.count == null) throw new Error('counter payload missing count');
      value.textContent = String(payload.count);
      reach.classList.remove('is-loading','is-error');
    }catch(err){
      console.warn('NBA Analytics public counter unavailable:', err);
      reach.classList.remove('is-loading');
      reach.classList.add('is-error');
      value.textContent = '—';
    }
  }

  function loadTracker(code){
    if(document.querySelector('script[data-nba-goatcounter]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.v5.js';
    script.dataset.nbaGoatcounter = '1';
    script.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
    script.dataset.goatcounterSettings = JSON.stringify({no_events:true});
    script.addEventListener('load', ()=>loadPublicCounter(code));
    script.addEventListener('error', ()=>{
      if(reach){ reach.hidden=false; reach.classList.add('is-error'); }
      if(value) value.textContent='—';
      console.warn('NBA Analytics: GoatCounter tracking script was blocked or unavailable.');
    });
    document.head.appendChild(script);
  }

  function init(){
    setLanguage();
    const code = String(cfg.goatcounterCode || '').trim();
    if(!validCode(code) || !productionAllowed()){
      if(reach) reach.hidden = true;
      return;
    }
    loadTracker(code);
  }

  new MutationObserver(setLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  document.addEventListener('DOMContentLoaded', init, {once:true});
})();
