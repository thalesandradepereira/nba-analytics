/* NBA Analytics — public analytics configuration.
   No secret/API token belongs in this file.

   GoatCounter site:
   https://nba-analytics-tap.goatcounter.com

   Public counter note:
   In GoatCounter settings, enable "Allow adding visitor counts on your website"
   so the public counter can be displayed in the dashboard.
*/
window.NBA_ANALYTICS_CONFIG = Object.freeze({
  provider: 'goatcounter',
  goatcounterCode: 'nba-analytics-tap',
  publicCounter: true,
  productionHosts: ['thalesandradepereira.github.io']
});

/* Load the UI QA/glossary enhancement after app + multi-period scripts.
   The guard prevents duplicate injection. */
(() => {
  if(document.querySelector('script[data-nba-dashboard-qa-v2]')) return;
  const script=document.createElement('script');
  script.src='dashboard-qa-v2.js?v=2';
  script.async=false;
  script.dataset.nbaDashboardQaV2='1';
  document.head.appendChild(script);
})();