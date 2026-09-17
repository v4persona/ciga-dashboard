/**
 * Sondagem da Shopify: confere credencial, escopos e o formato dos dados reais antes de ligar o sync.
 * Só lê; não grava nada e não imprime nome/e-mail de cliente (só contagens).
 *
 *   npm run shopify:probe            # últimos 30 dias
 *   npm run shopify:probe -- 90      # últimos 90 dias
 */
import { subDays, formatISO, differenceInCalendarDays, parseISO } from "date-fns";
import { bySku } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { bucketOf } from "@/lib/metrics/sales";
import { shopifyConfig, shopifyGraphql, shopifyPaginate, ShopifyError } from "@/lib/sources/shopify/client";
import { ABANDONED_CHECKOUTS_QUERY, ORDERS_QUERY, type ShopifyAbandonedCheckout, type ShopifyOrder } from "@/lib/sources/shopify/types";

const REQUIRED_SCOPES = ["read_orders", "read_all_orders", "read_checkouts", "read_products", "read_reports", "read_discounts", "read_marketing_events", "read_customers"];
const days = Number(process.argv[2] ?? 30);
const since = formatISO(subDays(new Date(), days), { representation: "date" });

const ok = (s: string) => console.log(`  ✓ ${s}`);
const warn = (s: string) => console.log(`  ! ${s}`);
const fail = (s: string) => console.log(`  ✗ ${s}`);
const title = (s: string) => console.log(`\n── ${s}`);
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

function tally<T>(items: T[], key: (t: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) ?? "(vazio)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const list = (entries: [string, number][], limit = 10) =>
  entries.slice(0, limit).forEach(([k, n]) => console.log(`      ${String(n).padStart(5)}  ${k}`));

/** roda um passo isolado: se falhar, mostra o erro e segue para o próximo */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`${label}: ${[...new Set(msg.split("; "))].join("; ")}`);
    return null;
  }
}

async function main() {
  const { domain, apiVersion } = shopifyConfig();
  const auth = process.env.SHOPIFY_ADMIN_TOKEN ? "token fixo (SHOPIFY_ADMIN_TOKEN)" : "client credentials (Dev Dashboard)";
  console.log(`Shopify ${domain} · API ${apiVersion} · ${auth} · pedidos desde ${since}`);

  title("Loja e escopos");
  const shop = await step("autenticação", () =>
    shopifyGraphql<{
      shop: { name: string; currencyCode: string; ianaTimezone: string; plan: { displayName: string } };
      currentAppInstallation: { accessScopes: { handle: string }[] };
    }>(`{ shop { name currencyCode ianaTimezone plan { displayName } } currentAppInstallation { accessScopes { handle } } }`),
  );
  if (!shop) {
    console.log("\nSem autenticação não dá para seguir. Veja docs/03-shopify.md.");
    process.exitCode = 1;
    return;
  }
  ok(`${shop.shop.name} · plano ${shop.shop.plan.displayName}`);
  (shop.shop.currencyCode === settings.currency ? ok : warn)(`moeda da loja ${shop.shop.currencyCode}`);
  (shop.shop.ianaTimezone === settings.timeZone ? ok : warn)(`fuso da loja ${shop.shop.ianaTimezone}`);
  const scopes = new Set(shop.currentAppInstallation.accessScopes.map((s) => s.handle));
  for (const s of REQUIRED_SCOPES) (scopes.has(s) ? ok : fail)(`escopo ${s}`);

  title("Volume e histórico");
  const counts = await step("contagem", () =>
    shopifyGraphql<{
      total: { count: number; precision: string };
      recent: { count: number; precision: string };
      oldest: { nodes: { name: string; createdAt: string }[] };
    }>(
      `query ($recent: String!) {
        total: ordersCount { count precision }
        recent: ordersCount(query: $recent) { count precision }
        oldest: orders(first: 1, sortKey: CREATED_AT) { nodes { name createdAt } }
      }`,
      { recent: `created_at:>=${since}` },
    ),
  );
  if (counts) {
    ok(`${counts.total.count} pedidos visíveis no total · ${counts.recent.count} desde ${since}`);
    const oldest = counts.oldest.nodes[0];
    if (oldest) {
      const age = differenceInCalendarDays(new Date(), parseISO(oldest.createdAt));
      ok(`pedido mais antigo visível: ${oldest.name} em ${oldest.createdAt.slice(0, 10)} (${age} dias)`);
      if (age <= 60 && !scopes.has("read_all_orders")) warn("só aparecem 60 dias: falta read_all_orders para carregar o histórico");
      if (oldest.createdAt.slice(0, 10) > settings.cutoverDate) warn(`primeiro pedido é posterior a settings.cutoverDate (${settings.cutoverDate})`);
    }
  }

  title("Campos sensíveis (isolados)");
  const customer = await step("customer { firstName lastName email }", () =>
    shopifyGraphql<{ orders: { nodes: { customer: { firstName: string | null; email: string | null } | null }[] } }>(
      `{ orders(first: 10, reverse: true) { nodes { customer { firstName lastName email } } } }`,
    ),
  );
  if (customer) {
    const n = customer.orders.nodes;
    ok(`customer acessível · com nome ${pct(n.filter((o) => o.customer?.firstName).length, n.length)} · com e-mail ${pct(n.filter((o) => o.customer?.email).length, n.length)} (amostra de ${n.length})`);
  }
  const journey = await step("customerJourneySummary", () =>
    shopifyGraphql(`{ orders(first: 1, reverse: true) { nodes { customerJourneySummary { ready } } } }`),
  );
  if (journey) ok("customerJourneySummary acessível");

  // sem read_customers a Shopify nega o campo `customer` e derruba a query inteira; a sondagem segue sem ele
  const withoutCustomer = (q: string) => (scopes.has("read_customers") ? q : q.replace(/\bcustomer \{[^}]*\}/, ""));
  if (!scopes.has("read_customers")) warn("sem read_customers: ORDERS_QUERY e ABANDONED_CHECKOUTS_QUERY rodam aqui sem o campo customer");

  title(`Pedidos com ORDERS_QUERY (a mesma do sync)`);
  const orders = await step("ORDERS_QUERY", () =>
    shopifyPaginate<{ orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Omit<ShopifyOrder, "source">[] } }, Omit<ShopifyOrder, "source">>(
      withoutCustomer(ORDERS_QUERY),
      (d) => d.orders,
      { query: `created_at:>=${since}` },
      // lineItems(first: 50) pesa no custo da query; 10 pedidos por página fica bem abaixo do limite de 1000
      { pageSize: 10, maxPages: 50, onPage: (c) => process.stdout.write(`\r  … ${c} pedidos`) },
    ),
  );
  if (orders) {
    process.stdout.write("\r");
    ok(`${orders.length} pedidos lidos${orders.length === 500 ? " (limite da sondagem)" : ""}`);
    // mesma classificação do painel: cancelados, VOIDED e EXPIRED não contam receita
    const buckets = tally(orders, (o) => bucketOf({ ...o, source: "shopify" }));
    const valid = orders.filter((o) => bucketOf({ ...o, source: "shopify" }) !== "cancelada");
    const gross = valid.reduce((a, o) => a + Number(o.currentTotalPriceSet.shopMoney.amount), 0);
    ok(`${valid.length} pedidos válidos · receita ${gross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (regra de src/lib/metrics/sales.ts)`);
    console.log("    grupo do painel");
    list(buckets);

    const currencies = tally(orders, (o) => o.currentTotalPriceSet.shopMoney.currencyCode);
    (currencies.length === 1 && currencies[0][0] === "BRL" ? ok : warn)(`moedas: ${currencies.map(([c, n]) => `${c} ${n}`).join(", ")}`);

    console.log("    displayFinancialStatus");
    list(tally(orders, (o) => o.displayFinancialStatus));
    console.log("    displayFulfillmentStatus");
    list(tally(orders, (o) => o.displayFulfillmentStatus));

    const items = orders.flatMap((o) => o.lineItems.nodes);
    const noSku = items.filter((li) => !li.sku);
    const matched = items.filter((li) => li.sku && bySku.has(li.sku));
    const truncated = orders.filter((o) => o.lineItems.nodes.length === 50);
    title("SKUs × catálogo (src/lib/catalog.ts)");
    ok(`${items.length} itens · ${pct(matched.length, items.length)} com SKU do catálogo`);
    if (noSku.length) warn(`${noSku.length} itens sem SKU (${pct(noSku.length, items.length)})`);
    if (truncated.length) warn(`${truncated.length} pedidos com 50 itens: lineItems pode estar truncado`);
    const unmatched = tally(items.filter((li) => !li.sku || !bySku.has(li.sku)), (li) => `${li.sku ?? "(sem SKU)"} · ${li.title}`);
    if (unmatched.length) {
      console.log("    fora do catálogo (SKU · título)");
      list(unmatched, 30);
    }

    title("Atribuição (customerJourneySummary.lastVisit)");
    const ready = orders.filter((o) => o.customerJourneySummary?.ready);
    const withUtm = orders.filter((o) => o.customerJourneySummary?.lastVisit?.utmParameters?.campaign);
    ok(`jornada pronta em ${pct(ready.length, orders.length)} · com utm_campaign em ${pct(withUtm.length, orders.length)}`);
    console.log("    lastVisit.source");
    list(tally(orders, (o) => o.customerJourneySummary?.lastVisit?.source));
    console.log("    utm_source");
    list(tally(withUtm, (o) => o.customerJourneySummary?.lastVisit?.utmParameters?.source));
    console.log("    utm_campaign");
    list(tally(withUtm, (o) => o.customerJourneySummary?.lastVisit?.utmParameters?.campaign), 15);
    const known = new Set(Object.values(settings.utmSources).flat() as string[]);
    const unknownSources = tally(withUtm, (o) => o.customerJourneySummary?.lastVisit?.utmParameters?.source?.toLowerCase()).filter(([s]) => !known.has(s));
    if (unknownSources.length) warn(`utm_source fora de settings.utmSources: ${unknownSources.map(([s]) => s).join(", ")}`);
  }

  title(`Checkouts abandonados (últimos ${settings.abandonedCartWindowDays} dias)`);
  const checkoutsSince = formatISO(subDays(new Date(), settings.abandonedCartWindowDays), { representation: "date" });
  const checkouts = await step("ABANDONED_CHECKOUTS_QUERY", () =>
    shopifyPaginate<{ abandonedCheckouts: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyAbandonedCheckout[] } }, ShopifyAbandonedCheckout>(
      withoutCustomer(ABANDONED_CHECKOUTS_QUERY),
      (d) => d.abandonedCheckouts,
      { query: `created_at:>=${checkoutsSince}` },
      { pageSize: 25, maxPages: 20 },
    ),
  );
  if (checkouts) {
    const open = checkouts.filter((c) => !c.completedAt);
    const value = open.reduce((a, c) => a + Number(c.totalPriceSet.shopMoney.amount), 0);
    ok(`${checkouts.length} checkouts · ${open.length} ainda abertos · ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a recuperar`);
    ok(`com e-mail ${pct(open.filter((c) => c.customer?.email).length, open.length)} dos abertos`);
  }

  title("ShopifyQL (read_reports)");
  type ShopifyqlResult = { shopifyqlQuery: { tableData: { columns: { name: string }[]; rows: Record<string, unknown>[] } | null; parseErrors: string[] | null } };
  const shopifyql = (q: string) =>
    step(q, async () => {
      const r = await shopifyGraphql<ShopifyqlResult>(
        `query ($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`,
        { q },
      );
      if (r.shopifyqlQuery.parseErrors?.length) throw new ShopifyError(r.shopifyqlQuery.parseErrors.join("; "));
      return r.shopifyqlQuery.tableData;
    });
  // consultas exploratórias: o nome das métricas de sessões ainda não está confirmado na documentação
  for (const q of [
    `FROM sales SHOW total_sales, orders, average_order_value SINCE -${days}d UNTIL today`,
    `FROM sessions SHOW sessions SINCE -${days}d UNTIL today`,
    `FROM sessions SHOW sessions GROUP BY referrer_source SINCE -${days}d UNTIL today ORDER BY sessions DESC LIMIT 10`,
  ]) {
    const table = await shopifyql(q);
    if (!table) continue;
    ok(`${q}`);
    console.log(`      colunas: ${table.columns.map((c) => c.name).join(", ")}`);
    table.rows.slice(0, 10).forEach((row) => console.log(`      ${JSON.stringify(row)}`));
  }

  title("Cupons (read_discounts)");
  const discounts = await step("discountNodes", () =>
    shopifyGraphql<{ discountNodes: { nodes: { discount: { __typename: string; title?: string; status?: string } }[] } }>(
      `{ discountNodes(first: 100, reverse: true) { nodes { discount {
          __typename
          ... on DiscountCodeBasic { title status }
          ... on DiscountCodeBxgy { title status }
          ... on DiscountCodeFreeShipping { title status }
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticFreeShipping { title status }
      } } } }`,
    ),
  );
  if (discounts) {
    const d = discounts.discountNodes.nodes.map((n) => n.discount);
    ok(`${d.length} descontos (até 100 mais recentes)`);
    console.log("    tipo · status");
    list(tally(d, (x) => `${x.__typename} · ${x.status ?? "?"}`));
  }
  if (orders) {
    const codes = await step("orders.discountCodes", () =>
      shopifyPaginate<{ orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { discountCodes: string[] }[] } }, { discountCodes: string[] }>(
        `query ($first: Int!, $after: String, $query: String) {
          orders(first: $first, after: $after, query: $query) { pageInfo { hasNextPage endCursor } nodes { discountCodes } }
        }`,
        (r) => r.orders,
        { query: `created_at:>=${since}` },
        { pageSize: 250, maxPages: 4 },
      ),
    );
    if (codes) {
      ok(`pedidos com cupom: ${pct(codes.filter((o) => o.discountCodes.length).length, codes.length)}`);
      list(tally(codes.flatMap((o) => o.discountCodes), (c) => c.toUpperCase()));
    }
  }

  title("Eventos de marketing (read_marketing_events)");
  const events = await step("marketingEvents", () =>
    shopifyGraphql<{ marketingEvents: { nodes: { type: string; marketingChannelType: string | null; sourceAndMedium: string; utmCampaign: string | null; startedAt: string }[] } }>(
      `{ marketingEvents(first: 100, reverse: true) { nodes { type marketingChannelType sourceAndMedium utmCampaign startedAt } } }`,
    ),
  );
  if (events) {
    const e = events.marketingEvents.nodes;
    ok(`${e.length} eventos (até 100 mais recentes)`);
    console.log("    origem · tipo");
    list(tally(e, (x) => `${x.sourceAndMedium} · ${x.type}`));
    console.log("    utmCampaign");
    list(tally(e, (x) => x.utmCampaign));
  }

  title("Variantes com SKU (para o de-para do catálogo)");
  const variants = await step("productVariants", () =>
    shopifyPaginate<
      { productVariants: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { sku: string | null; title: string; product: { title: string; status: string } }[] } },
      { sku: string | null; title: string; product: { title: string; status: string } }
    >(
      `query ($first: Int!, $after: String) {
        productVariants(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { sku title product { title status } }
        }
      }`,
      (d) => d.productVariants,
      {},
      { pageSize: 250, maxPages: 10 },
    ),
  );
  if (variants) {
    const active = variants.filter((v) => v.product.status === "ACTIVE");
    ok(`${variants.length} variantes · ${active.length} de produtos ativos · ${pct(active.filter((v) => v.sku && bySku.has(v.sku)).length, active.length)} com SKU do catálogo`);
    for (const v of active) {
      const mark = v.sku && bySku.has(v.sku) ? "✓" : " ";
      const variant = v.title === "Default Title" ? "" : ` / ${v.title}`;
      console.log(`    ${mark} ${(v.sku ?? "(sem SKU)").padEnd(24)} ${v.product.title}${variant}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof ShopifyError ? `Erro Shopify: ${e.message}` : e);
  process.exitCode = 1;
});
