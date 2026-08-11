# Analytics / contador de acessos

O projeto está preparado para usar **GoatCounter** no GitHub Pages.

## O que já está integrado

- tracking de pageviews em produção;
- contador público de acessos no dashboard;
- atualização automática do rótulo PT-BR / EN-US;
- ausência de API key ou segredo no front-end;
- o tracker só é carregado no host configurado em `analytics-config.js`;
- falha do serviço ou bloqueio por adblock não impede o dashboard de funcionar.

## Ativação

1. Crie um site no GoatCounter e escolha um `site code` / subdomínio.
2. Em GoatCounter, habilite **Allow adding visitor counts on your website** para permitir o contador público.
3. Edite `analytics-config.js` e informe apenas o código público:

```js
window.NBA_ANALYTICS_CONFIG = Object.freeze({
  provider: 'goatcounter',
  goatcounterCode: 'SEU-CODIGO',
  publicCounter: true,
  productionHosts: ['thalesandradepereira.github.io']
});
```

Exemplo: se o endereço do painel for `https://nba-tap.goatcounter.com`, o código é `nba-tap`.

## Observações

- O contador visível usa o total do site (`TOTAL`).
- O valor público pode ficar em cache por algumas horas e não aumenta instantaneamente a cada reload.
- `goatcounterCode` é um identificador público, não uma credencial secreta.
- Nunca adicione API tokens, senhas ou outras credenciais em arquivos públicos do GitHub Pages.
