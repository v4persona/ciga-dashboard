# Tela de Operação

> Segunda tela (`/operacao`), nascida do escopo da v1: **só Shopify + Olist**; Meta e Google ficam para a fase 2
> (decidido com o cliente em 2026-09-17). Enquanto isso, os blocos de mídia saem do painel geral
> pela chave `settings.showPaidMedia`, para ninguém ler dado de exemplo como real.

Estoque é sempre "agora". Vendas usam janela fixa de **30 dias** (`WINDOW_DAYS`), sem os filtros da tela principal:
são decisões de operação, não de análise de período.

## Blocos

### 1. Reposição
Ordena por urgência: quem **vende e está acabando** primeiro, depois quem vende, depois quem está crítico parado.

- **Cobertura**: `disponível ÷ (unidades vendidas em 30 dias ÷ 30)`, em dias.
- **Receita em risco**: projeta a demanda dos últimos 30 dias para os próximos 30 e valoriza o que faltar pelo
  preço da loja — `max(0, vendidas − disponível) × preço`. É a conta que responde "quanto deixo de vender se não repor".
- **Ação sugerida** é derivada, não uma regra de negócio fechada; serve de leitura rápida.

### 2. Capital em estoque
Valor guardado em peça, **a preço de venda** (a Olist tem preço de custo, mas ele ainda não entra no snapshot).
"Sem venda na janela" é o SKU que não saiu nenhuma vez em 30 dias — com a loja recém-migrada, a tela avisa
quantos dias de histórico existem, porque ainda é cedo para chamar de encalhe.

### 3. Funil da loja
Sessões → checkouts iniciados → pedidos válidos.

- **Sessões** vêm do ShopifyQL (`FROM sessions SHOW sessions TIMESERIES day`), escopo `read_reports`.
  Só existem a partir da migração, então a tela mostra em quantos dos 30 dias há dado.
- **Checkout iniciado** é todo `abandonedCheckout`, inclusive os que viraram pedido (`completedAt`).
- **Conversão** = pedidos válidos ÷ sessões.

### 4. Saúde do cadastro
Divergências entre as duas fontes, ligadas pelo SKU. Severidade alta é o que atrapalha venda hoje:

| Alerta | O que significa |
|---|---|
| Saldo negativo | cadastro furado na Olist |
| Reservado acima do saldo | reserva maior que o estoque |
| Vendendo sem estoque | vendeu nos 30 dias e está com disponível ≤ 0 |
| Preço diferente entre as fontes | Shopify e Olist com preços diferentes para o mesmo SKU |
| Ativo na Shopify, inativo na Olist | produto vendável sem cadastro ativo no ERP |
| Sem produto na Olist | SKU da loja que não existe no ERP |
| Vendido fora do catálogo | pedido com SKU que o catálogo gerado não conhece (rodar `npm run shopify:catalog`) |

## Dados

Enquanto o Supabase não existe, `npm run pull` grava `data/snapshot.json` (pedidos, checkouts, sessões, estoque e
o cadastro da Olist dos SKUs do catálogo) e `getDashboardData()` lê dali. O arquivo tem nome e e-mail de cliente:
fica fora do git. Trocar para o banco muda só `src/lib/sources/index.ts`.
