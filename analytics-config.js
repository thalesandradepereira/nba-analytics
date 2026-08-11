/* NBA Analytics — public analytics configuration.
   No secret/API token belongs in this file.

   To activate GoatCounter:
   1) Create a GoatCounter site and note its public site code/subdomain.
   2) Set goatcounterCode below (example: "nba-analytics-tap").
   3) In GoatCounter settings, enable "Allow adding visitor counts on your website"
      if you want the public counter shown in the dashboard.
*/
window.NBA_ANALYTICS_CONFIG = Object.freeze({
  provider: 'goatcounter',
  goatcounterCode: '',
  publicCounter: true,
  productionHosts: ['thalesandradepereira.github.io']
});
