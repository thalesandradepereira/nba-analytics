/* NBA Analytics — GoatCounter integration.
   Uses GoatCounter's official count.js API for both tracking and the public TOTAL counter.
   No API token or secret is required in the browser. */
(function(){
  'use strict';

  const cfg = window.NBA_ANALYTICS_CONFIG || {};
  const reach = document.getElementById('analyticsReach');
  const value = document.getElementById('analyticsValue');
  const label = document.getElementById('analyticsLabel');
  let pageviewSent = false;
  let probe = null;

  function isEnglish(){ return document.documentElement.lang === 'en-US'; }
  function setLanguage(){
    if(label) label.textContent = isEnglish() ? 'Visits' : 'Visitas';
    if(reach) reach.title = isEnglish()
      ? 'Total public site visits recorded by GoatCounter. Public counters may be cached for up to four hours.'
      : 'Total de visitas públicas registradas pelo GoatCounter. Contadores públicos podem ficar em cache por até quatro horas.';
  }

  function validCode(code){ return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(code || ''); }
  function productionAllowed(){
    const hosts = Array.isArray(cfg.productionHosts) ? cfg.productionHosts : [];
    return hosts.length === 0 || hosts.includes(location.hostname);
  }

  function trackedPath(){ return location.pathname || '/'; }

  function sendPageview(){
    if(pageviewSent) return;
    if(!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
    pageviewSent = true;
    window.goatcounter.count({
      path: trackedPath(),
      title: document.title,
      referrer: document.referrer || undefined
    });
  }

  function ensureProbe(){
    if(probe) return probe;
    probe = document.createElement('div');
    probe.id = 'goatCounterPublicProbe';
    probe.setAttribute('aria-hidden','true');
    probe.style.cssText = 'position:absolute!important;left:-99999px!important;top:-99999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;';
    document.body.appendChild(probe);
    return probe;
  }

  function readProbeCount(){
    if(!probe || !value) return false;
    const node = probe.querySelector('#gcvc-views') || probe.querySelector('[id$="views"]');
    const text = node ? node.textContent.trim() : '';
    if(!text || text === '…') return false;
    value.textContent = text;
    reach.classList.remove('is-loading','is-error');
    return true;
  }

  function loadPublicCounter(){
    if(!cfg.publicCounter || !reach || !value) return;
    reach.hidden = false;
    reach.classList.add('is-loading');
    value.textContent = '…';

    if(!window.goatcounter || typeof window.goatcounter.visit_count !== 'function'){
      reach.classList.remove('is-loading');
      reach.classList.add('is-error');
      value.textContent = '—';
      console.warn('NBA Analytics: goatcounter.visit_count() unavailable.');
      return;
    }

    const p = ensureProbe();
    p.innerHTML = '';

    try{
      // Official GoatCounter helper. TOTAL is the documented special path for
      // the site-wide total and avoids URL-path encoding/CORS edge cases.
      window.goatcounter.visit_count({
        append: '#goatCounterPublicProbe',
        path: 'TOTAL',
        no_branding: true,
        type: 'html'
      });

      let attempts = 0;
      const timer = setInterval(()=>{
        attempts += 1;
        if(readProbeCount() || attempts >= 80){
          clearInterval(timer);
          if(attempts >= 80 && !readProbeCount()){
            reach.classList.remove('is-loading');
            reach.classList.add('is-error');
            value.textContent = '—';
            console.warn('NBA Analytics: GoatCounter public TOTAL counter did not render in time.');
          }
        }
      }, 100);
    }catch(err){
      reach.classList.remove('is-loading');
      reach.classList.add('is-error');
      value.textContent = '—';
      console.warn('NBA Analytics public counter unavailable:', err);
    }
  }

  function loadTracker(code){
    if(document.querySelector('script[data-nba-goatcounter]')) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.nbaGoatcounter = '1';
    script.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
    script.dataset.goatcounterSettings = JSON.stringify({
      no_onload: true,
      no_events: true
    });

    script.addEventListener('load', ()=>{
      sendPageview();
      // The public TOTAL response is cached by GoatCounter, so it may lag the
      // just-recorded visit; this is expected and documented behavior.
      setTimeout(loadPublicCounter, 1200);
    });

    script.addEventListener('error', ()=>{
      if(reach){ reach.hidden=false; reach.classList.add('is-error'); }
      if(value) value.textContent='—';
      console.warn('NBA Analytics: GoatCounter count.js was blocked or unavailable.');
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
