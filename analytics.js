/* NBA Analytics — GoatCounter integration.
   Tracking remains client-side through GoatCounter count.js.
   The visible counter prefers a repository-local snapshot produced from the
   authenticated GoatCounter API by GitHub Actions; the public TOTAL endpoint
   is only a fallback because GoatCounter caches public counters for hours.
*/
(function(){
  'use strict';

  const cfg = window.NBA_ANALYTICS_CONFIG || {};
  const reach = document.getElementById('analyticsReach');
  const value = document.getElementById('analyticsValue');
  const label = document.getElementById('analyticsLabel');
  let pageviewSent = false;

  function isEnglish(){ return document.documentElement.lang === 'en-US'; }
  function validCode(code){ return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(code || ''); }
  function productionAllowed(){
    const hosts = Array.isArray(cfg.productionHosts) ? cfg.productionHosts : [];
    return hosts.length === 0 || hosts.includes(location.hostname);
  }
  function trackedPath(){ return location.pathname || '/'; }

  function setLanguage(){
    if(label) label.textContent = isEnglish() ? 'Visits' : 'Visitas';
  }

  function setTitle(source, updatedAt){
    if(!reach) return;
    const stamp = updatedAt ? new Date(updatedAt) : null;
    const when = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleString(isEnglish() ? 'en-US' : 'pt-BR')
      : null;
    if(source === 'goatcounter-api'){
      reach.title = isEnglish()
        ? `GoatCounter total synchronized by GitHub Actions${when ? ` at ${when}` : ''}.`
        : `Total do GoatCounter sincronizado pelo GitHub Actions${when ? ` em ${when}` : ''}.`;
    }else{
      reach.title = isEnglish()
        ? 'GoatCounter public total. This fallback may be cached for up to four hours.'
        : 'Total público do GoatCounter. Este fallback pode permanecer em cache por até quatro horas.';
    }
  }

  function showCounter(raw, source, updatedAt){
    if(!reach || !value) return false;
    const normalized = String(raw ?? '').replace(/[\u00a0\u202f\s]/g,'').trim();
    if(!normalized || !/^\d+$/.test(normalized)) return false;
    value.textContent = Number(normalized).toLocaleString(isEnglish() ? 'en-US' : 'pt-BR');
    reach.hidden = false;
    reach.classList.remove('is-loading','is-error');
    reach.dataset.counterSource = source || 'unknown';
    setTitle(source, updatedAt);
    return true;
  }

  async function loadSnapshotCounter(){
    if(!reach || !value) return false;
    try{
      const response = await fetch(`data/visitor_count.json?ts=${Date.now()}`, {
        cache:'no-store',
        credentials:'same-origin',
        headers:{'Accept':'application/json'}
      });
      if(!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
      const payload = await response.json();
      if(payload.source !== 'goatcounter-api' || payload.count == null) return false;
      return showCounter(payload.count, payload.source, payload.updated_at_utc);
    }catch(err){
      console.warn('NBA Analytics: visitor snapshot unavailable.', err);
      return false;
    }
  }

  async function loadPublicFallback(){
    if(!cfg.publicCounter || !reach || !value) return false;
    const endpoint = `https://${cfg.goatcounterCode}.goatcounter.com/counter/TOTAL.json`;
    try{
      const response = await fetch(endpoint, {
        method:'GET',
        mode:'cors',
        cache:'no-store',
        credentials:'omit',
        headers:{'Accept':'application/json'}
      });
      if(!response.ok) throw new Error(`GoatCounter HTTP ${response.status}`);
      const payload = await response.json();
      return showCounter(payload && (payload.count ?? payload.count_unique), 'public-fallback', null);
    }catch(err){
      console.warn('NBA Analytics: GoatCounter public fallback failed.', err);
      return false;
    }
  }

  async function refreshVisibleCounter(){
    if(!reach || !value) return;
    reach.hidden = false;
    reach.classList.add('is-loading');
    reach.classList.remove('is-error');
    value.textContent = '…';

    if(await loadSnapshotCounter()) return;
    if(await loadPublicFallback()) return;

    reach.classList.remove('is-loading');
    reach.classList.add('is-error');
    value.textContent = '—';
  }

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

  function loadTracker(code){
    if(document.querySelector('script[data-nba-goatcounter]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.nbaGoatcounter = '1';
    script.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
    script.dataset.goatcounterSettings = JSON.stringify({no_onload:true,no_events:true});
    script.addEventListener('load', ()=>{
      sendPageview();
      setTimeout(refreshVisibleCounter, 800);
    });
    script.addEventListener('error', ()=>{
      console.warn('NBA Analytics: GoatCounter tracking script was blocked or unavailable.');
      refreshVisibleCounter();
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
    refreshVisibleCounter();
    loadTracker(code);
    // Re-check the local snapshot periodically in long-lived tabs.
    setInterval(refreshVisibleCounter, 5 * 60 * 1000);
  }

  new MutationObserver(()=>{
    setLanguage();
    if(value && value.textContent && /^\d/.test(value.textContent)){
      const digits=value.textContent.replace(/\D/g,'');
      if(digits) value.textContent=Number(digits).toLocaleString(isEnglish()?'en-US':'pt-BR');
    }
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

  document.addEventListener('DOMContentLoaded', init, {once:true});
})();
