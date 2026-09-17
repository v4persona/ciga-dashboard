# Matriz do modelo — cruzando as três fontes por relógio

> Quinto bloco da página. Nasceu da pergunta "que insight só um painel agregador consegue dar?".
> Resposta: o que acontece quando vendas, estoque e mídia são lidos **por modelo**, lado a lado.

## 1. Chaves de junção

Pivot só existe onde há dimensão compartilhada. As três fontes se ligam por três chaves:

| Chave | Liga | Força | Onde está |
|---|---|---|---|
| **SKU** | Shopify `lineItems.sku` ↔ Olist `produto.sku` | forte | `src/lib/catalog.ts` (de-para SKU → modelo/coleção) |
| **Nome da campanha → modelo** | Meta/Google `campaign_name` ↔ catálogo | média (depende de convenção) | `campaignTargets()` em `src/lib/catalog.ts` |
| **UTM da visita que converteu** | Shopify `customerJourneySummary.lastVisit.utmParameters.campaign` ↔ campanha | forte (quando os links têm UTM) | `src/lib/metrics/matrix.ts` |

Confirmado com o cliente em 2026-09-17: campanhas são nomeadas por modelo e os anúncios usam UTM nos links.

> ⚠ **Revisto após a sondagem da Shopify (2026-09-17)**: a única campanha com UTM nos pedidos reais é
> `CA01 - VENDAS SETEMBRO | CBO | BR`, sem modelo no nome. A heurística de nome continua valendo só para o mock.
> Como ligar campanha a relógio (conjunto/anúncio, `utm_content`, página de entrada) fica para depois das
> conexões com Meta e Google, quando der para ver a estrutura real das contas.

### Como o nome vira modelo

Para cada modelo do catálogo, conta-se quantos tokens iniciais do nome aparecem no nome da campanha.
Vencem os modelos com a maior contagem; empate significa que a campanha anuncia a linha inteira.

```
"Hunter — Lançamento Titanium"  → Hunter Titanium
"Blue Planet II — Conversão"    → Blue Planet II Atlantic · Black Star · Gilded Age
"Performance Max — Relógios"    → (genérica: não entra na matriz, aparece no rodapé)
```

O gasto de uma campanha com vários alvos é **rateado pelas unidades vendidas** de cada alvo no período
(igualmente, se ninguém vendeu). É uma aproximação declarada na UI. Quando a convenção de nome falhar,
o caminho é uma tabela `campaign_targets` (campanha → SKUs) editável, não afinar a heurística.

### Como o pedido vira campanha

`ORDERS_QUERY` já pede `customerJourneySummary { firstVisit lastVisit { utmParameters { … } } }`.
Usamos `lastVisit` (a visita que converteu). `utm_campaign` é comparado ao nome da campanha e, se não bater,
ao id externo dentro da plataforma indicada por `utm_source` (`settings.utmSources`).
`ready = false` nas primeiras horas do pedido: a Shopify ainda não fechou a atribuição.

## 2. Colunas

| Coluna | Fonte | Definição |
|---|---|---|
| Vendas no período | Shopify | unidades e receita dos line items do SKU, pedidos não cancelados; barra dourada = magnitude |
| Disponível · cobertura | Olist | `disponivel` agora, cor pelo status de estoque; dias até zerar no ritmo dos últimos 30 dias |
| Mídia rateada | Meta + Google | gasto das campanhas que citam o modelo, rateado; barra azul = Meta, dourada = Google |
| ROAS alegado | Meta + Google | receita atribuída pela plataforma ÷ gasto rateado |
| Via UTM | Shopify | pedidos cuja última visita veio de campanha deste modelo, ao lado das compras que a plataforma alega |

## 3. Sinais: onde há uma decisão

Cada sinal é uma regra pura em `modelMatrix()` e vira um cartão no topo do bloco com os modelos afetados.

| Sinal | Regra | Decisão sugerida |
|---|---|---|
| **Anúncio com estoque crítico** | gasto > 0 e estoque em atenção ou crítico | repor antes de investir mais |
| **Gasto sem venda** | gasto ≥ `bestCampaignMinSpend`, nenhum pedido via UTM, < 1 compra alegada | rever ou pausar a campanha |
| **Vende sem anúncio** | gasto = 0, estoque ok, receita ≥ a do modelo anunciado que menos fatura | candidato a campanha própria |
| **Atribuição inflada** | compras alegadas ≥ `attributionInflationRatio` × pedidos via UTM | desconfiar do ROAS da plataforma |

Os limiares ficam em `src/lib/settings.ts`. Sinais em vermelho pedem ação; dourado é oportunidade; cinza é ressalva.

## 4. O que muda para o sync real

- **Shopify**: nada além do que a query já pede. Gravar `utm_source`, `utm_medium`, `utm_campaign` em `orders` (colunas já no schema).
- **Meta/Google**: nada. A matriz usa `campaigns.name` e `ad_daily`.
- **Olist**: nada.
- **Legado**: pedidos antigos não têm jornada; entram só nas colunas de vendas.

## 5. Próximos cruzamentos possíveis (não feitos)

- **Dia da semana × plataforma**: gasto vs receita da loja por dia da semana, para decidir pacing de verba.
- **Atraso mídia → venda**: correlação entre pico de gasto e pico de receita com defasagem de 0 a 7 dias.
- **Breakdowns** de Meta (idade, gênero, posicionamento) e Google (dispositivo, região): só quando houver uma decisão que dependa deles.
