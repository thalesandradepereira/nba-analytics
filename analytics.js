/* NBA Analytics — GoatCounter integration.
   Tracks visits with count.js and displays the public site-wide TOTAL counter.
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
    if(label) label.textContent = isEnglish() ? 'Visits' : 'Visitas';
    if(reach) reach.title = isEnglish()
      ? 'Total site visits reported by GoatCounter. Public counters can be cached for up to four hours.'
      : 'Total de visitas reportadas pelo GoatCounter. O contador público pode ficar em cache por até quatro horas.';
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

  function showCounter(raw){
    if(!reach || !value) return;
    const text = String(raw ?? '').trim();
    if(!text) throw new Error('empty GoatCounter count');
    value.textContent = text;
    reach.hidden = false;
    reach.classList.remove('is-loading','is-error');
  }

  async function loadPublicCounter(){
    if(!cfg.publicCounter || !reach || !value) return;
    reach.hidden = false;
    reach.classList.add('is-loading');
    reach.classList.remove('is-error');
    value.textContent = '…';

    const endpoint = `https://${cfg.goatcounterCode}.goatcounter.com/counter/TOTAL.json`;

    try{
      // GoatCounter documents the JSON counter endpoint for custom JavaScript
      // counters. `count` is the current field; `count_unique` is kept only as
      // a compatibility fallback.
      const response = await fetch(endpoint, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers: { 'Accept': 'application/json' }
      });
      if(!response.ok) throw new Error(`GoatCounter HTTP ${response.status}`);
      const payload = await response.json();
      const count = payload && (payload.count ?? payload.count_unique);
      showCounter(count);
    }catch(err){
      console.warn('NBA Analytics: direct GoatCounter TOTAL fetch failed; trying official visit_count helper.', err);
      fallbackVisitCount();
    }
  }

  function fallbackVisitCount(){
    if(!reach || !value) return;
    if(!window.goatcounter || typeof window.goatcounter.visit_count !== 'function'){
      reach.classList.remove('is-loading');
      reach.classList.add('is-error');
      value.textContent = '—';
      return;
    }

    let probe = document.getElementById('goatCounterPublicProbe');
    if(!probe){
      probe = document.createElement('div');
      probe.id = 'goatCounterPublicProbe';
      probe.setAttribute('aria-hidden','true');
      probe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      document.body.appendChild(probe);
    }
    probe.innerHTML = '';

    try{
      window.goatcounter.visit_count({
        append: '#goatCounterPublicProbe',
        path: 'TOTAL',
        no_branding: true,
        type: 'html'
      });

      let tries = 0;
      const timer = setInterval(()=>{
        tries += 1;
        const n = probe.querySelector('#gcvc-views');
        const text = n && n.textContent.trim();
        if(text){
          clearInterval(timer);
          showCounter(text);
        }else if(tries >= 60){
          clearInterval(timer);
          reach.classList.remove('is-loading');
          reach.classList.add('is-error');
          value.textContent = '—';
        }
      },100);
    }catch(err){
      console.warn('NBA Analytics: GoatCounter fallback counter failed.', err);
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
    script.dataset.goatcounterSettings = JSON.stringify({
      no_onload: true,
      no_events: true
    });

    script.addEventListener('load', ()=>{
      sendPageview();
      // Fetch the public count independently from tracking. The public endpoint
      // can be cached by GoatCounter, so the displayed total may lag new visits.
      setTimeout(loadPublicCounter, 600);
    });

    script.addEventListener('error', ()=>{
      console.warn('NBA Analytics: GoatCounter count.js was blocked or unavailable.');
      // Even if tracking script is blocked, attempt to display the public total.
      loadPublicCounter();
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
