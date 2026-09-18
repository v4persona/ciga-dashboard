# CIGA Dashboard

Painel único de métricas da CIGA design Brasil: vendas (Shopify), estoque (Olist ERP) e tráfego pago (Meta + Google Ads),
com filtros de período, modelo de relógio e fonte dos dados. Identidade visual do wiki.usecigadesign.com.br.

Documentos de partida: `docs/00-estruturacao.md` (escopo, métricas, plano), `docs/01-identidade-visual.md` (tokens),
`docs/02-matriz-do-modelo.md` (cruzamento das três fontes por relógio),
`docs/03-shopify.md` / `docs/04-olist.md` (criar os apps, credenciais e sondagem dos dados reais)
e `docs/05-tela-operacao.md` (segunda tela: reposição, capital, funil e saúde do cadastro).

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

`npm run pull` puxa Shopify + Olist para `data/snapshot.json` e o painel passa a mostrar dados reais sem banco.
O arquivo tem nome e e-mail de cliente e fica fora do git. Sem ele e sem `DATABASE_URL`, o painel roda **100% em mock** (determinístico, gerado em `src/lib/sources/*/mock.ts`).
Copie `.env.example` para `.env.local` quando for ligar as fontes reais.

## Como está organizado

```
src/app/page.tsx              painel geral (server component). Lê filtros da URL, calcula métricas, renderiza.
src/app/operacao/page.tsx     tela de operação: reposição, capital em estoque, funil e saúde do cadastro (Shopify + Olist)
src/components/               FilterBar, Kpi, RevenueChart, SpendChart, StockTable, CampaignsTable, ModelMatrix, …
src/lib/filters.ts            período (hoje/7d/30d/mês/mês anterior/custom), modelo, fonte. Comparação com período anterior.
src/lib/metrics/{sales,stock,ads,matrix}.ts   funções puras: tipos de origem → números do painel
src/lib/sources/shopify/      types.ts = subconjunto do Admin GraphQL 2026-01 (nomes idênticos) + queries prontas
src/lib/sources/olist/        types.ts = Olist ERP API v2 (produtos.pesquisa, produto.obter.estoque), nomes em pt como na API;
                              client-v3.ts/types-v3.ts = caminho OAuth2 alternativo, não usado
src/lib/sources/ads/          Meta Insights e Google Ads (GAQL) → linha normalizada `AdDaily` (campanha × dia)
src/lib/metrics/operations.ts reposição, capital parado, funil e alertas de divergência entre as duas fontes
src/lib/sources/index.ts      getDashboardData(): lê data/snapshot.json se existir, senão mock. Depois, Postgres.
src/lib/sources/snapshot.ts   formato do snapshot local gravado por `npm run pull` (banco provisório, fora do git)
src/lib/catalog.ts            de-para SKU → modelo / coleção / imagem (chave de junção entre todas as fontes) e nome de campanha → modelo;
                              itens gerados da Shopify por `npm run shopify:catalog` em catalog.generated.ts
src/lib/settings.ts           mínimo de estoque (5), data de corte da plataforma antiga, janela de carrinhos, etc.
src/db/schema.ts              Drizzle/Postgres espelhando os tipos acima (syncs gravam, painel lê)
```

## Filtros pela URL

`/?periodo=30d` · `?periodo=custom&de=2026-05-01&ate=2026-07-15` · `&modelo=JG6004804` · `&fonte=legacy`

## Plugar dados reais (próximos passos)

1. **Shopify**: app custom com `read_orders`, `read_all_orders`, `read_checkouts`, `read_products`. O sync roda `ORDERS_QUERY` e
   `ABANDONED_CHECKOUTS_QUERY` (já escritas em `src/lib/sources/shopify/types.ts`) e grava em `orders`, `order_line_items`, `abandoned_checkouts`.
2. **Olist**: API v2 com `OLIST_TOKEN` fixo, `produtos.pesquisa` + `produto.obter.estoque` → `stock_snapshots` (disponível = saldo − reservado).
3. **Meta**: System User token, `GET /act_{id}/insights?level=campaign&time_increment=1` → `normalizeMeta()` → `ad_daily`.
4. **Google Ads**: developer token (aprovação pode levar dias). GAQL por campanha × dia → `normalizeGoogle()`. Plano B: CSV.
5. **Plataforma antiga**: importar CSV para `orders` com `source='legacy'`; `settings.cutoverDate` marca a troca no gráfico.

Cada sync vira uma rota `app/api/sync/<fonte>/route.ts` chamada pelo Vercel Cron (`vercel.json`) com `CRON_SECRET`.

## Deploy

Projeto padrão Next.js: importar o repositório na Vercel, apontar `DATABASE_URL` para o Postgres do Supabase (transaction pooler) quando houver sync,
copiar as variáveis de `.env.example`.
