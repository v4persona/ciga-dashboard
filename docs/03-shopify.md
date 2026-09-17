# Shopify — conexão com a API

> Primeira fonte real. Etapa atual: **sondagem** (`npm run shopify:probe`), que lê a loja e diz se os dados
> reais cabem no que o painel espera. O sync para o Postgres vem depois, com o que a sondagem mostrar.

## 1. Como a Shopify autentica em 2026

Desde **1º de janeiro de 2026** não é mais possível criar "app personalizado" pelo admin (o antigo
*Configurações → Apps → Desenvolver apps*, que gerava um token `shpat_` fixo). Apps antigos continuam funcionando.

App novo nasce no **Dev Dashboard** (`dev.shopify.com/dashboard`). O servidor troca `client_id` + `client_secret`
por um token que **expira em 24h** (*client credentials grant*). O cliente em `src/lib/sources/shopify/client.ts`
faz essa troca sozinho, guarda o token em memória e renova antes de vencer.

| Variável | Quando usar |
|---|---|
| `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` | App do Dev Dashboard (caminho padrão) |
| `SHOPIFY_ADMIN_TOKEN` | Já existe um app personalizado antigo com token `shpat_`. Tem prioridade se preenchido |

⚠ **Organização**: o client credentials grant só funciona quando **o app e a loja estão na mesma organização**
do Dev Dashboard. Com acesso de partner, a organização do partner é outra; o token é recusado. Crie o app
a partir do login da própria loja (dono ou staff com permissão de desenvolver apps), não da organização do partner.

## 2. Criar o app (Dev Dashboard)

1. Entrar no admin da loja → **Configurações → Apps** → **Desenvolver apps** → seguir para o **Dev Dashboard**
   (ou abrir `dev.shopify.com/dashboard` e escolher a organização da loja).
2. **Create app** → **Start from Dev Dashboard** → nome `CIGA Dashboard` → **Create**.
3. Aba **Versions** → nova versão:
   - **App URL**: `https://shopify.dev/apps/default-app-home` (o app não abre dentro do admin)
   - **Webhooks API version**: a mais recente
   - **Scopes**: `read_orders`, `read_all_orders`, `read_checkouts`, `read_products`, `read_customers` (nome e e-mail em pedidos e carrinhos); exploratórios: `read_reports`, `read_discounts`, `read_marketing_events`
   - **Release**
4. **Home** → **Install app** → escolher a loja da CIGA → **Install**. O endereço `<handle>.myshopify.com` vai em `SHOPIFY_STORE_DOMAIN` (o handle aparece na URL do admin: `admin.shopify.com/store/<handle>`).
5. **Settings** → copiar **Client ID** e **Client secret**.

Sobre os escopos:

- **Mudou escopo depois de instalado?** Salvar a configuração não basta. Criar e **liberar uma nova versão**, e então
  aprovar as novas permissões na loja (o admin mostra o pedido de atualização do app; se não aparecer, **Home → Install app**
  de novo). A sondagem lista o que a instalação recebeu de fato.

- `read_all_orders` libera pedidos com mais de 60 dias. Sem ele o histórico some. Se o Dev Dashboard não deixar
  marcar direto, pedir o acesso pela própria tela do app (seção de acessos protegidos).
- Nome e e-mail do cliente (lista de carrinhos a recuperar) são *protected customer data*. Para app personalizado
  de uma única loja o acesso costuma ser liberado sem revisão; a sondagem testa isso isoladamente.

## 3. Rodar a sondagem

```bash
cp .env.example .env.local     # se ainda não existir
# preencher SHOPIFY_CLIENT_ID e SHOPIFY_CLIENT_SECRET (ou SHOPIFY_ADMIN_TOKEN)
npm run shopify:probe          # pedidos dos últimos 30 dias
npm run shopify:probe -- 120   # janela maior
```

Só leitura. Não grava nada e não imprime nome/e-mail de cliente, apenas contagens. Cada passo roda isolado:
se um falhar (ex.: escopo faltando), os outros seguem.

| Bloco | O que responde |
|---|---|
| Loja e escopos | A credencial funciona? Moeda BRL e fuso America/Sao_Paulo? Os 4 escopos foram concedidos? |
| Volume e histórico | Quantos pedidos existem, qual é o mais antigo visível (testa `read_all_orders` e `settings.cutoverDate`) |
| Campos sensíveis | `customer` e `customerJourneySummary` estão acessíveis? |
| ORDERS_QUERY | A query do sync roda sem erro? Distribuição de `displayFinancialStatus` / `displayFulfillmentStatus` |
| SKUs × catálogo | Quanto dos itens vendidos bate com `src/lib/catalog.ts` e quais SKUs estão fora |
| Atribuição | Quanto dos pedidos tem `utm_campaign`; valores reais de `utm_source` e nomes de campanha |
| Checkouts abandonados | Volume e valor a recuperar na janela de `settings.abandonedCartWindowDays` |
| Variantes | Lista de SKUs ativos da loja, base para corrigir o de-para do catálogo |

## 4. O que esperar e o que fazer com o resultado

- **SKUs**: o catálogo vem da própria loja. `npm run shopify:catalog` lê os produtos ativos e grava
  `src/lib/catalog.generated.ts` (SKU `JG…`, nome, referência CIGA, preço, imagem). Coleção = tag da loja
  (`AVENTUR`, `EDGE`, `EVEREST`, `ZODIAC`, `outros`); pulseiras (tag `Straps`) vão para **Acessórios**.
  Rodar de novo quando a loja mudar produtos.
- **Status**: se aparecerem status que `src/lib/metrics/sales.ts` não classifica (ex.: `PARTIALLY_PAID`,
  `ON_HOLD`), decidir em qual grupo entram (finalizadas / em processo).
- **UTMs**: `utm_source` fora de `settings.utmSources` indica pedido de mídia paga que a matriz do modelo não vai
  reconhecer; incluir o valor na lista.
- **Custo de query**: `ORDERS_QUERY` pede `lineItems(first: 50)`, então cada pedido pesa ~50 pontos. A sondagem e o
  sync usam páginas de 10 pedidos. Para a carga inicial do histórico, avaliar *bulk operation*.
- **Versão da API**: `2026-01` tem suporte até cerca de janeiro de 2027. `Customer.email` já está marcado como
  deprecated nessa versão (substituto: `defaultEmailAddress { emailAddress }`); revisar ao subir de versão.

## 5. Próximo passo: sync

Depois da sondagem validada: projeto no Supabase (`DATABASE_URL` do *Transaction pooler*), migrations com
`drizzle-kit`, `src/app/api/sync/shopify/route.ts` (incremental por `updated_at`, grava `orders`,
`order_line_items`, `abandoned_checkouts`, registra `sync_runs`), cron na Vercel com `CRON_SECRET` e
`getDashboardData()` lendo do banco quando `DATABASE_URL` existir.

⚠ Antes de gravar dados reais:

- **Supabase Data API**: o Supabase expõe o schema `public` via REST. O painel acessa o banco só pelo servidor, então
  desligar a Data API do projeto (ou ligar RLS nas tabelas sem policies) para os pedidos e e-mails não ficarem expostos.
- **Painel público**: hoje o deploy na Vercel não tem senha e o repositório é público. Com dados reais, a lista de
  carrinhos mostra nome e e-mail de clientes; a senha de acesso (v1 do §2 da estruturação) precisa entrar antes.
