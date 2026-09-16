@AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CIGA Dashboard — contexto do projeto

Painel único (uma página) de vendas, estoque e tráfego pago da CIGA design Brasil. Leia `README.md` e `docs/00-estruturacao.md`.

## Regras

- **Idioma**: UI e docs em pt-BR; código e nomes de variáveis em inglês, exceto campos que espelham APIs (Olist usa `saldo`, `reservado`, `disponivel`).
- **Chaves de origem são sagradas**: `src/lib/sources/*/types.ts` copia os nomes de campo das APIs (Shopify Admin GraphQL 2026-01, Olist ERP v3, Meta Insights, Google Ads GAQL). Não renomeie; o sync real deve devolver exatamente esses tipos.
- **O front não conhece fontes**: só `getDashboardData()` em `src/lib/sources/index.ts`. Métricas ficam em `src/lib/metrics/*` como funções puras.
- **Dinheiro em BRL, fuso America/Sao_Paulo**, formatação via `src/lib/format.ts`.
- **Parâmetros de negócio** (mínimo de estoque, data de corte, janela de carrinhos) só em `src/lib/settings.ts`.
- **Identidade visual**: tokens em `src/app/globals.css` vindos do wiki. Dourado para série principal e valores-chave; azul para Meta/comparação; vermelho só para alerta e queda. Sem sombras, radius 4px, fonte Helvetica Neue LT Pro local.
- **Gráficos**: Recharts em client components; sem eixo duplo; legenda sempre que houver 2+ séries; tooltip em todo gráfico.
- Mock é determinístico (`src/lib/random.ts`); não use `Math.random`.

## Verificar

```bash
npx tsc --noEmit && npm run lint && npm run build
```
