/* NBA Analytics — GoatCounter integration.
   The public GoatCounter site code is stored in analytics-config.js.
   No API token or secret is required in the browser. */
(function(){
  'use strict';

  const cfg = window.NBA_ANALYTICS_CONFIG || {};
  const reach = document.getElementById('analyticsReach');
  const value = document.getElementById('analyticsValue');
  const label = document.getElementById('analyticsLabel');
  let pageviewSent = false;

  function isEnglish(){ return document.documentElement.lang === 'en-US'; }
  function setLanguage(){
    if(label) label.textContent = isEnglish() ? 'Site visits' : 'Acessos';
    if(reach) reach.title = isEnglish()
      ? 'Public site-visit counter. GoatCounter may cache this value for a few hours.'
      : 'Contador público de acessos. O GoatCounter pode manter este valor em cache por algumas horas.';
  }

  function validCode(code){ return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(code || ''); }
  function productionAllowed(){
    const hosts = Array.isArray(cfg.productionHosts) ? cfg.productionHosts : [];
    return hosts.length === 0 || hosts.includes(location.hostname);
  }

  function trackedPath(){
    return location.pathname || '/';
  }

  function sendPageview(){
    if(pageviewSent) return;
    if(!window.goatcounter || typeof window.goatcounter.count !== 'function'){
      console.warn('NBA Analytics: goatcounter.count() unavailable after count.js load.');
      return;
    }

    pageviewSent = true;
    window.goatcounter.count({
      path: trackedPath(),
      title: document.title,
      referrer: document.referrer || undefined
    });
    console.info('NBA Analytics: GoatCounter visit sent for', trackedPath());
  }

  async function loadPublicCounter(){
    if(!cfg.publicCounter || !reach || !value) return;
    reach.hidden = false;
    reach.classList.add('is-loading');
    value.textContent = '…';

    try{
      const path = trackedPath();
      const endpoint = `https://${cfg.goatcounterCode}.goatcounter.com/counter/${encodeURIComponent(path)}.json`;
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
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.nbaGoatcounter = '1';
    script.dataset.goatcounter = `https://${code}.goatcounter.com/count`;

    // We explicitly send the pageview in the load handler below. This avoids
    // relying on the automatic onload path when count.js itself was inserted
    // dynamically by the dashboard.
    script.dataset.goatcounterSettings = JSON.stringify({
      no_onload: true,
      no_events: true
    });

    script.addEventListener('load', ()=>{
      sendPageview();
      // GoatCounter's public visitor-counter responses are cached, so a newly
      // recorded visit may not be reflected immediately in this number.
      setTimeout(loadPublicCounter, 1200);
    });

    script.addEventListener('error', ()=>{
      if(reach){ reach.hidden=false; reach.classList.add('is-error'); }
      if(value) value.textContent='—';
      console.warn('NBA Analytics: GoatCounter count.js was blocked or unavailable. Check browser/ad-blocker settings.');
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
