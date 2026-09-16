# CIGA Dashboard — Estruturação do projeto

> Documento de partida. Traduz o pedido de projeto em escopo, métricas, arquitetura e plano.
> Pedido original resumido: **uma página** com Vendas (Shopify), Estoque (Olist), Tráfego pago (Meta/Google),
> filtros de período e por modelo de relógio, deploy na Vercel ainda esta semana, identidade do wiki.usecigadesign.com.br,
> dados históricos de uma plataforma antiga (congelados) incorporados ao banco.

---

## 1. Princípio de arquitetura: o banco é a fonte única

O dashboard **não consulta Shopify/Olist/Meta/Google ao vivo**. Jobs de sincronização puxam das APIs
para um Postgres; o front lê só do banco. Isso resolve quatro coisas de uma vez:

1. **Dados da plataforma antiga** entram nas mesmas tabelas com `source = 'legacy'`. O filtro de período
   funciona igual e o gráfico mostra onde uma plataforma termina e a outra começa.
2. **"Montar o front e depois plugar os dados"** vira literal: o front nasce contra o schema do banco com seed
   de mock. Plugar uma fonte = ligar o job de sync daquela fonte. Nada muda no front.
3. Rate limits e lentidão das APIs (Google Ads e Meta em especial) não afetam a página.
4. Métricas cruzadas (ex.: MER = receita Shopify ÷ gasto total em mídia) ficam triviais.

```
Shopify ─┐                                  ┌─ /  (página única)
Olist   ─┼─ sync jobs (cron) ─► Postgres ─►─┤   filtros: período · modelo · fonte
Meta    ─┤                                  └─ API interna (server components / route handlers)
Google  ─┘
CSV legado ─ script de importação ─┘
```

---

## 2. Stack recomendada

| Camada | Escolha | Por quê |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript** | Vercel nativo; front e API no mesmo deploy; cron da Vercel para os syncs |
| UI | **Tailwind 4 + shadcn/ui + Recharts** | Mesma base dos projetos irmãos (mango, influencer); rápido de montar |
| Banco | **Postgres (Neon)** + **Drizzle ORM** | Integração de 1 clique na Vercel, free tier suficiente, migrations em TS |
| Sync | **Vercel Cron → route handlers** `/api/sync/{shopify,olist,meta,google}` | Sem infra extra. Se algum sync passar de 60s, quebrar em páginas |
| Auth | Senha única compartilhada (cookie assinado) na v1 | Dashboard interno; troca por login real depois se precisar |
| Locale | `pt-BR`, `America/Sao_Paulo`, BRL | Todo cálculo de "hoje/mês" no fuso de SP |

Alternativa considerada e descartada: Rails API + SPA (padrão do mango). Funcionaria, mas exige servidor próprio
(Kamal/DigitalOcean) e dobra o deploy. O pedido pede Vercel e velocidade.

---

## 3. Layout da página única

Uma tela, rolagem vertical, 4 blocos. Ordem pensada para quem abre e quer entender em 10 segundos.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CIGA design · Painel        [Período ▾ 30 dias] [Modelo ▾ Todos] [Fonte ▾]│
│                                          última sync: Shopify 14:02 · Olist 13:55 · Meta 13:40 · Google 12:00 │
├──────────────────────────────────────────────────────────────────────────┤
│ VENDAS                                                                    │
│ ┌ Receita bruta ┐ ┌ Finalizadas ┐ ┌ Em processo ┐ ┌ Carrinhos a recuperar ┐│
│ │ R$ 128.400   │ │ 84 · R$ 96k │ │ 21 · R$ 24k │ │ 37 · R$ 41k          ││
│ │ ▲ 12% vs ant.│ │             │ │             │ │ [ver lista]          ││
│ └──────────────┘ └─────────────┘ └─────────────┘ └──────────────────────┘│
│ [gráfico: receita por dia, área; linha vertical tracejada = troca de plataforma] │
│ [tabela/barras: vendas por modelo — top 8]     [donut: status dos pedidos] │
├──────────────────────────────────────────────────────────────────────────┤
│ ESTOQUE                                  ⚠ 4 modelos abaixo do mínimo (5) │
│ [tabela: modelo · SKU · em estoque · reservado · status ● ok / ● atenção / ● crítico] │
│ (críticos primeiro, destacados em vermelho; "atenção" = exatamente 5)     │
├──────────────────────────────────────────────────────────────────────────┤
│ TRÁFEGO PAGO                                                              │
│ ┌ Gasto total ┐ ┌ Receita atribuída ┐ ┌ ROAS ┐ ┌ MER ┐ ┌ Campanhas ativas ┐│
│ [barras empilhadas: gasto/dia Meta vs Google]  [destaque: melhor campanha] │
│ [tabela: campanha · plataforma · status · gasto · compras · ROAS · CPC]    │
└──────────────────────────────────────────────────────────────────────────┘
```

Filtros globais (afetam todos os blocos, exceto Estoque que é sempre "agora"):

- **Período**: hoje · 7 dias · 30 dias · mês atual · mês anterior · intervalo custom. Sempre com comparação
  contra o período anterior de mesma duração (as setinhas ▲▼).
- **Modelo / coleção**: lista de modelos do catálogo (Blue Planet, Edge, Hunter, Skeleton…), agrupável por coleção.
  Exige mapear SKU → modelo (ver §6).
- **Fonte**: Todas · Shopify · Plataforma antiga.

---

## 4. Definição das métricas

Definições fechadas aqui viram código. O que ficar em aberto está marcado com ❓ para validar com o cliente.

### 4.1 Vendas (Shopify — Admin GraphQL API)

| Métrica | Definição | Campo Shopify |
|---|---|---|
| Receita bruta | Soma de `totalPrice` dos pedidos criados no período, exceto cancelados | `orders(query: "created_at:>=… -status:cancelled")` |
| Receita líquida | Bruta − reembolsos − descontos ❓ (mostrar como secundária) | `totalRefunded`, `totalDiscounts` |
| Finalizadas | Pedidos **pagos e enviados** | `displayFinancialStatus = PAID` e `displayFulfillmentStatus = FULFILLED` |
| Em processo | Pagos e ainda não enviados, ou aguardando pagamento (Pix/boleto) | `PAID + UNFULFILLED/PARTIALLY` ou `PENDING/AUTHORIZED` |
| Carrinhos a recuperar | Checkouts abandonados dos últimos N dias ❓ (sugestão: 14) sem pedido associado | `abandonedCheckouts` com `completedAt = null` |
| Nº de pedidos, ticket médio | Contagem / bruta ÷ pedidos | derivado |
| Vendas por modelo | Soma de line items agrupada por modelo | `lineItems { sku, quantity, originalTotal }` |

Escopo de acesso do app Shopify: `read_orders`, `read_checkouts`, `read_products`. Pedidos com mais de 60 dias
exigem aprovação de "read_all_orders" — importante pedir já para carregar histórico.

### 4.2 Estoque (Olist ERP, ex-Tiny)

| Métrica | Definição |
|---|---|
| Em estoque | Saldo atual por SKU (`saldo`) |
| Reservado | `saldoReservado` (pedidos ainda não faturados) |
| Disponível | Saldo − reservado ❓ (confirmar se o alerta usa saldo ou disponível) |
| Status | **crítico** < 5 · **atenção** = 5 · **ok** > 5 |
| Alerta | Contador no topo do bloco + linhas críticas primeiro. Opcional: e-mail/WhatsApp diário (fase 2) |

API: v2 (`produtos.pesquisa`, `produto.obter.estoque`, `lista.atualizacoes.estoque` — token simples) ou v3 REST
(OAuth). A v2 basta para leitura e é mais rápida de ligar. Estoque sincroniza a cada 15–30 min.

### 4.3 Tráfego pago (Meta Marketing API + Google Ads API)

Este é o bloco "chato". Proposta de núcleo comum entre as duas plataformas:

| Métrica | Meta (Insights) | Google Ads (GAQL) |
|---|---|---|
| Gasto | `spend` | `metrics.cost_micros / 1e6` |
| Impressões / cliques / CTR / CPC | `impressions`, `clicks`, `ctr`, `cpc` | `metrics.impressions`, `clicks`, `ctr`, `average_cpc` |
| Compras atribuídas | `actions[action_type=purchase]` | `metrics.conversions` |
| Receita atribuída | `action_values[purchase]` | `metrics.conversions_value` |
| ROAS | receita atribuída ÷ gasto | idem |
| CPA | gasto ÷ compras | idem |
| Campanhas ativas | `effective_status = ACTIVE` | `campaign.status = ENABLED` |

Métricas consolidadas (as que o dono do negócio realmente olha):

- **Gasto total** = Meta + Google.
- **MER** (Marketing Efficiency Ratio) = receita bruta Shopify ÷ gasto total. Não depende da atribuição de
  cada plataforma, que costuma inflar. É a métrica mais honesta para "está valendo a pena?".
- **CAC aproximado** = gasto total ÷ nº de pedidos Shopify no período.
- **Melhor campanha** = maior ROAS entre campanhas com gasto ≥ R$ X ❓ (evita "campeã" com R$ 12 gastos).
  Fallback quando não há conversão rastreada: menor CPC com CTR acima da mediana.

Granularidade armazenada: **campanha × dia**. Suficiente para todos os filtros e barato.

⚠ **Risco de prazo — Google Ads**: a API exige *developer token* aprovado pelo Google (Basic Access), o que
pode levar dias. Plano B para esta semana: exportação CSV agendada do Google Ads → importador. Meta não tem
essa barreira (System User token no Business Manager sai na hora).

---

## 5. Modelo de dados (Postgres)

```
products         id · sku · title · model · collection · shopify_product_id · olist_product_id · image_url
orders           id · source ('shopify'|'legacy') · external_id · created_at · financial_status ·
                 fulfillment_status · gross · discounts · refunded · currency · customer_hash
order_items      order_id · product_id · sku · quantity · unit_price · total
abandoned_carts  id · created_at · value · items · recovery_url · recovered_at · customer_email_hash
stock_snapshots  product_id · captured_at · on_hand · reserved · available     (1 linha por SKU por sync)
campaigns        id · platform ('meta'|'google') · external_id · name · status · objective
ad_daily         campaign_id · date · spend · impressions · clicks · purchases · revenue
sync_runs        source · started_at · finished_at · status · rows · error   (alimenta "última sync")
settings         key · value     (ex.: stock_min = 5, cutover_date = 2026-xx-xx, legacy_platform_name)
```

Dinheiro em `numeric(12,2)`, datas em `timestamptz`, cálculo de "dia" sempre em `America/Sao_Paulo`.
`orders` e `order_items` são as **únicas** tabelas onde a plataforma antiga entra; o resto é só Shopify/Olist/ads.

---

## 6. Dados da plataforma antiga

- Formato de entrada: CSV/planilha exportada da plataforma anterior ❓ (qual plataforma? Nuvemshop, Loja Integrada, Tray…).
- Script `scripts/import-legacy.ts`: lê o arquivo, normaliza para `orders` + `order_items` com `source='legacy'`.
- `settings.cutover_date` marca a troca. Na UI: linha tracejada no gráfico + chip "plataforma antiga" nos períodos
  anteriores. Carrinhos abandonados e status "em processo" não existem para o legado (só finalizadas).
- Mapeamento de SKU: o legado provavelmente usa nomes de produto, não SKU. Precisa de uma tabela de-para
  manual (planilha) para o filtro por modelo funcionar no histórico.

---

## 7. Identidade visual

Extraída de `wiki.usecigadesign.com.br/style.css` — detalhe completo em `docs/01-identidade-visual.md`.
Resumo: **fundo preto (#050505)**, cards **#0f0f0f**, texto branco, acento **dourado #C9A962**, acento secundário
**azul #2E7BC4**, rosa #c46d7a para destaques, fonte **Helvetica Neue LT Pro** (arquivos no wiki em
`manualMarca/fonts/`), raio de borda **4px**, tudo minimalista e com bastante respiro.

Aplicação no dashboard: dourado para valores-chave e a série "principal" dos gráficos; azul para série de
comparação (período anterior / Google vs Meta); vermelho só para alerta de estoque e quedas; verde discreto
para altas. Fundo escuro pede cuidado com contraste nos gráficos (grid a 6% de branco, como no wiki).

---

## 8. Plano de execução (semana)

| Dia | Entrega | Verificável por |
|---|---|---|
| 1 | Scaffold Next + Tailwind + shadcn + Drizzle; schema; seed com dados fictícios realistas; deploy Vercel + Neon | URL pública no ar com dados mock |
| 1–2 | Página completa: 4 blocos, filtros de período/modelo/fonte, comparação com período anterior, identidade CIGA | Cliente navega e valida layout/métricas |
| 2 | Sync Shopify (pedidos, itens, checkouts abandonados, produtos) + cron | Bloco Vendas com dados reais |
| 3 | Sync Olist (estoque) + alerta; de-para SKU ↔ modelo | Bloco Estoque real |
| 3–4 | Sync Meta; Google via API se o token sair, senão via CSV | Bloco Tráfego real |
| 4 | Importador legado + `cutover_date` | Histórico visível com marcação de plataforma |
| 5 | Ajustes pós-feedback, senha de acesso, doc de operação | Apresentação |

Ordem escolhida pelo risco: front primeiro (pedido explícito), depois Shopify (mais simples e mais valor),
Olist, Meta, e Google por último porque depende de aprovação externa.

---

## 9. Perguntas para o cliente (bloqueiam só a etapa que citam)

1. **Acessos** — quem cria: app custom Shopify (com `read_all_orders`), token API Olist, System User Meta (ID da conta de anúncios), developer token Google Ads (ou conta MCC existente com token aprovado?).
2. **Plataforma antiga** — qual é, e existe exportação de pedidos com itens e datas? Data exata da troca.
3. **Carrinhos a recuperar** — janela de dias (sugestão 14) e se querem a lista com link de recuperação.
4. **Estoque** — alerta considera saldo total ou saldo disponível (menos reservado)?
5. **Melhor campanha** — gasto mínimo para entrar no ranking (sugestão R$ 100 no período).
6. **Acesso ao painel** — senha única compartilhada serve para a v1?
7. **Fuso/moeda** — assumindo São Paulo e BRL. Há venda internacional em outra moeda?

Enquanto não respondem: tudo tem valor padrão assumido (indicado com ❓ acima) e nada trava o front.
