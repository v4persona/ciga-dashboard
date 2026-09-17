# Olist ERP — conexão com a API

> Segunda fonte real. O painel usa a Olist só para **estoque**; a junção com a Shopify é pelo **SKU**
> (`codigo` na Olist, `lineItems.sku` na Shopify — os dois usam os códigos `JG…`).
>
> **Decisão (2026-09-17): usamos a API v2**, com o token fixo que o gestor do projeto já tinha.
> Motivos: funciona hoje, não exige criar app nem login no navegador, e não tem a sessão de 1 dia da v3.
> A v2 não recebe mais novidades, mas segue no ar sem data de descontinuação anunciada.
> O caminho da v3 está montado e descrito no fim deste documento, caso valha migrar.

## 1. Como conectar (v2)

O token é da conta inteira e não expira. A conta que ele abre é **JG IMPORTADORA LTDA**, cujos produtos
usam os mesmos SKUs `JG…` da Shopify.

```bash
# .env.local
OLIST_TOKEN=…          # token da API v2, gerado no painel da Olist

npm run olist:probe            # produtos, SKU × catálogo, estoque de até 30 SKUs
npm run olist:probe -- --todos # estoque de todos os SKUs do catálogo
```

⚠ O token é uma credencial da conta toda. Não entra no git (só em `.env.local` e nas variáveis da Vercel),
e vale trocá-lo na Olist se circular por e-mail ou chat.

| Bloco | O que responde |
|---|---|
| Conta | O token funciona e abre qual empresa |
| Produtos | Quantos, situação (ativo/inativo/excluído) e tipo de variação |
| SKU × catálogo | Quanto do catálogo da Shopify existe com o mesmo código na Olist, o que falta e o que sobra |
| Estoque | `saldo`, `saldoReservado`, disponível calculado, depósitos, quantos abaixo do mínimo |

## 2. O que a v2 entrega (e o que não entrega)

| Campo | v2 | Observação |
|---|---|---|
| SKU | `codigo` | na v3 é `sku` |
| Saldo | `saldo` | |
| Reservado | `saldoReservado` | |
| Disponível | **não existe** | o painel calcula `saldo − saldoReservado` (`normalizeEstoque` em `types.ts`) |
| Depósitos | `depositos[].deposito` | só nome, empresa, saldo e `desconsiderar`; sem reservado por depósito |

Endpoints usados: `produtos.pesquisa` (100 por página) e `produto.obter.estoque` (uma chamada por produto).
Limite por minuto depende do plano (30 a 120); o cliente lê o header `x-limit-api` e espaça as chamadas.
Ler o estoque dos 94 SKUs leva alguns minutos no plano mais baixo — no sync, `lista.atualizacoes.estoque`
(só o que mudou desde uma data) evita varrer tudo a cada rodada.

## 3. Resultado da sondagem e decisões (2026-09-17)

- **SKU**: 94 de 94 do catálogo existem na Olist com o mesmo `codigo`. A junção funciona sem de-para.
- **A conta é da importadora**: 854 produtos, 621 ativos de outras marcas (Joog). O sync **filtra pelos SKUs do
  catálogo**. Os códigos repetidos que existem são todos de produtos Joog ou sem código.
- **Depósitos** — decidido: **somar os dois** (WSI e Nova-SC). É o que o campo `saldo` da Olist já faz;
  "Avarias" fica de fora porque a própria Olist o marca como desconsiderado.
- **Mínimo de estoque** — decidido: **5 para todos**, por enquanto (`settings.stockMin`). Rever depois:
  1 peça de um relógio de R$ 27 mil não é a mesma urgência que 1 pulseira. A coluna de cobertura em dias
  já é uma alternativa ao número fixo.
- **Alerta usa o disponível** (`saldo − saldoReservado`), não o saldo: 39 dos 94 SKUs têm reserva, às vezes
  quase toda a peça disponível. Responde a pergunta 4 do §9 da estruturação.
- **Saldo negativo** — decidido: **mostrar como está**, sem virar zero. Aparece quando o cadastro na Olist está
  furado (foi o caso de Blue Planet II Gilded Age e Eastern Jade Black) e o painel serve para expor isso.

## 4. Caminho alternativo: API v3 (OAuth2)

Montado, porém não usado. Fica aqui caso a v2 saia do ar ou falte algum dado.

### Criar o aplicativo

1. Na Olist: **menu → Configurações → aba Geral → Aplicativos → + novo aplicativo**.
2. **Nome do aplicativo**: `CIGA Dashboard`.
3. **URLs de Redirecionamento**: `http://localhost:8787/olist/callback`
   (é para onde a Olist devolve o login; o script `olist:auth` escuta nesse endereço).
   Quando o sync for para a Vercel, acrescentar a URL de produção aqui.
4. **Permissões**: só **Leitura**, nos módulos de **Produtos** e **Estoque**. Opcional para explorar depois:
   Leitura em **Pedidos** (conferir pedidos da Shopify que chegam à Olist). Nada de Incluir/Editar/Excluir.
5. Salvar e copiar **Client ID** e **Client Secret** para `.env.local` (`OLIST_CLIENT_ID`, `OLIST_CLIENT_SECRET`).

Mudou permissão depois? É preciso refazer o login (`npm run olist:auth`): as permissões ficam gravadas no momento
da autorização.

### Como a autenticação funciona

OAuth2 com *authorization code*, via Keycloak da Tiny
([documentação](https://api-docs.erp.olist.com/documentacao/comecando/autenticacao)):

| Token | Validade | Observação |
|---|---|---|
| access token | 4 horas | vai no header `Authorization: Bearer …` |
| refresh token | **1 dia** | cada renovação devolve um novo; o anterior deixa de valer |

Consequências:

- O token **não cabe em variável de ambiente**, porque muda a cada renovação. Localmente fica em
  `.olist-token.json` (fora do git), gravado e atualizado por `src/lib/sources/olist/client-v3.ts`.
- **Se passar mais de 24h sem nenhuma chamada**, o refresh token expira e alguém precisa refazer o login no navegador.
- Em produção: o token vai para uma tabela no Supabase e o cron de estoque (a cada 15–30 min) mantém a sessão viva.
  Vale um alerta no painel quando a renovação falhar.

### Rodar

```bash
# .env.local: OLIST_CLIENT_ID, OLIST_CLIENT_SECRET, OLIST_REDIRECT_URI
npm run olist:auth   # login no navegador; grava .olist-token.json (access 4h, refresh 1 dia)
```

Pré-requisitos na conta: plano Construa ou superior com a extensão **Gestão de Aplicativos**, e um usuário
da Olist para autorizar. Máximo de 5 aplicativos por conta.
