# CIGA Dashboard

Painel único de métricas da CIGA design Brasil: vendas (Shopify), estoque (Olist ERP) e tráfego pago (Meta + Google Ads),
com filtros de período, modelo de relógio e fonte dos dados. Identidade visual do wiki.usecigadesign.com.br.

Documentos de partida: `docs/00-estruturacao.md` (escopo, métricas, plano) e `docs/01-identidade-visual.md` (tokens).

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Sem `DATABASE_URL` o painel roda **100% em mock** (determinístico, gerado em `src/lib/sources/*/mock.ts`).
Copie `.env.example` para `.env.local` quando for ligar as fontes reais.

## Como está organizado

```
src/app/page.tsx              página única (server component). Lê filtros da URL, calcula métricas, renderiza.
src/components/               FilterBar, Kpi, RevenueChart, SpendChart, StockTable, CampaignsTable, …
src/lib/filters.ts            período (hoje/7d/30d/mês/mês anterior/custom), modelo, fonte. Comparação com período anterior.
src/lib/metrics/{sales,stock,ads}.ts   funções puras: tipos de origem → números do painel
src/lib/sources/shopify/      types.ts = subconjunto do Admin GraphQL 2026-01 (nomes idênticos) + queries prontas
src/lib/sources/olist/        types.ts = Olist ERP API v3 (/produtos, /estoque/{id}), nomes em pt como na API
src/lib/sources/ads/          Meta Insights e Google Ads (GAQL) → linha normalizada `AdDaily` (campanha × dia)
src/lib/sources/index.ts      getDashboardData(): hoje mock, depois Postgres. O front só conhece essa função.
src/lib/catalog.ts            de-para SKU → modelo / coleção / imagem (chave de junção entre todas as fontes)
src/lib/settings.ts           mínimo de estoque (5), data de corte da plataforma antiga, janela de carrinhos, etc.
src/db/schema.ts              Drizzle/Postgres espelhando os tipos acima (syncs gravam, painel lê)
```

## Filtros pela URL

`/?periodo=30d` · `?periodo=custom&de=2026-05-01&ate=2026-07-15` · `&modelo=CIGA-HUN-TB` · `&fonte=legacy`

## Plugar dados reais (próximos passos)

1. **Shopify**: app custom com `read_orders`, `read_all_orders`, `read_checkouts`, `read_products`. O sync roda `ORDERS_QUERY` e
   `ABANDONED_CHECKOUTS_QUERY` (já escritas em `src/lib/sources/shopify/types.ts`) e grava em `orders`, `order_line_items`, `abandoned_checkouts`.
2. **Olist**: OAuth2 (client id/secret + refresh token), `GET /produtos` + `GET /estoque/{id}` → `stock_snapshots`.
3. **Meta**: System User token, `GET /act_{id}/insights?level=campaign&time_increment=1` → `normalizeMeta()` → `ad_daily`.
4. **Google Ads**: developer token (aprovação pode levar dias). GAQL por campanha × dia → `normalizeGoogle()`. Plano B: CSV.
5. **Plataforma antiga**: importar CSV para `orders` com `source='legacy'`; `settings.cutoverDate` marca a troca no gráfico.

Cada sync vira uma rota `app/api/sync/<fonte>/route.ts` chamada pelo Vercel Cron (`vercel.json`) com `CRON_SECRET`.

## Deploy

Projeto padrão Next.js: importar o repositório na Vercel, adicionar a integração Neon (Postgres) quando houver sync,
copiar as variáveis de `.env.example`.
