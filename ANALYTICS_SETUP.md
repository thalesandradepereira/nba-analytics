# Analytics / contador de acessos

O projeto usa **GoatCounter** no GitHub Pages e mantém um snapshot local do total
de visitas para que o dashboard continue responsivo mesmo quando o serviço
externo estiver lento ou bloqueado no navegador.

## Arquitetura atual

- tracking de pageviews continua client-side pelo GoatCounter;
- o workflow `.github/workflows/refresh-visitor-count.yml` roda a cada 6 horas;
- se `GOATCOUNTER_API_KEY` estiver configurado, a API autenticada é preferida;
- sem segredo, o workflow usa o endpoint público oficial `counter/TOTAL.json`;
- o endpoint público exige habilitar **Allow adding visitor counts on your website**;
- o contador público do GoatCounter pode ficar em cache por até quatro horas;
- o snapshot local só é alterado quando o número muda ou quando vence o heartbeat;
- o heartbeat padrão é de 30 dias, abaixo do limite de 60 dias de inatividade para workflows agendados em repositórios públicos;
- pull requests executam apenas testes unitários, com `contents: read` e sem acessar GoatCounter;
- o job operacional de refresh recebe `contents: write` somente fora de PR e somente em `main`;
- falha nas duas rotas de leitura faz o workflow falhar de forma explícita;
- o cliente HTTP do contador usa apenas a biblioteca padrão do Python, reduzindo dependências no job;
- Actions oficiais estão pinadas por SHA e comentadas com a versão correspondente.

## Configuração pública

O código público do site permanece em `analytics-config.js`:

```js
window.NBA_ANALYTICS_CONFIG = Object.freeze({
  provider: 'goatcounter',
  goatcounterCode: 'nba-analytics-tap',
  publicCounter: true,
  productionHosts: ['thalesandradepereira.github.io']
});
```

No GoatCounter, mantenha habilitado **Allow adding visitor counts on your website**.

## Segredo opcional

`GOATCOUNTER_API_KEY` é opcional. Quando configurado em **Settings → Secrets and
variables → Actions**, o workflow usa a API autenticada. O segredo nunca deve ser
gravado em JavaScript, README, logs ou arquivos publicados pelo GitHub Pages.

## Política de atualização

O arquivo `data/visitor_count.json` é versionado somente quando:

1. o total de visitas muda; ou
2. o último snapshot tem 30 dias ou mais.

Isso evita commits horários artificiais e mantém uma atividade operacional
periódica suficiente para reduzir o risco de desativação automática dos
workflows agendados por inatividade do repositório.

## QA

Execute localmente:

```bash
python -m unittest discover -s tests -p "test_update_visitor_count.py" -v
python scripts/update_visitor_count.py
```

O segundo comando requer acesso à internet e que o contador público esteja
habilitado ou que `GOATCOUNTER_API_KEY` esteja configurado.
