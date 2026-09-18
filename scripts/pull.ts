/**
 * Puxa Shopify + Olist e grava tudo em `data/snapshot.json`. É o banco provisório enquanto o Supabase
 * não existe: o painel lê esse arquivo quando ele está presente, senão cai no mock.
 *
 *   npm run pull            # pedidos desde a data de corte (settings.cutoverDate)
 *   npm run pull -- 2026-01-01
 *
 * O arquivo tem nome e e-mail de cliente: fica fora do git (ver .gitignore).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { formatISO } from "date-fns";
import { catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { shopifyGraphql, shopifyPaginate } from "@/lib/sources/shopify/client";
import { ABANDONED_CHECKOUTS_QUERY, ORDERS_QUERY, SESSIONS_QUERY, type SessionDaily, type ShopifyAbandonedCheckout, type ShopifyOrder } from "@/lib/sources/shopify/types";
import { olistPaginate, olistPost } from "@/lib/sources/olist/client";
import { normalizeEstoque, type OlistProduto, type OlistProdutoEstoque, type OlistCatalogItem, type StockSnapshot } from "@/lib/sources/olist/types";
import type { Snapshot } from "@/lib/sources/snapshot";

const since = process.argv[2] ?? settings.cutoverDate;
const step = (s: string) => process.stdout.write(`\n${s} `);
const done = (s: string) => console.log(`✓ ${s}`);

type Conn<N> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: N[] };

async function main() {
  const pulledAt = formatISO(new Date());

  step("Shopify · pedidos");
  const orderNodes = await shopifyPaginate<{ orders: Conn<Omit<ShopifyOrder, "source">> }, Omit<ShopifyOrder, "source">>(
    ORDERS_QUERY,
    (d) => d.orders,
    { query: `created_at:>=${since}` },
    { pageSize: 10, onPage: (c) => process.stdout.write(`\r  Shopify · pedidos: ${c} `) },
  );
  // `source` não existe na Shopify: marca a origem do registro para conviver com o legado
  const orders: ShopifyOrder[] = orderNodes.map((o) => ({ ...o, source: "shopify" }));
  done(`${orders.length} pedidos desde ${since}`);

  step("Shopify · checkouts abandonados");
  const abandonedCheckouts = await shopifyPaginate<{ abandonedCheckouts: Conn<ShopifyAbandonedCheckout> }, ShopifyAbandonedCheckout>(
    ABANDONED_CHECKOUTS_QUERY,
    (d) => d.abandonedCheckouts,
    { query: `created_at:>=${since}` },
    { pageSize: 25 },
  );
  done(`${abandonedCheckouts.length} checkouts`);

  step("Shopify · sessões (ShopifyQL)");
  let sessions: SessionDaily[] = [];
  try {
    const r = await shopifyGraphql<{ shopifyqlQuery: { tableData: { rows: { day: string; sessions: string }[] } | null; parseErrors: string[] | null } }>(
      `query ($q: String!) { shopifyqlQuery(query: $q) { tableData { rows } parseErrors } }`,
      { q: SESSIONS_QUERY(since) },
    );
    if (r.shopifyqlQuery.parseErrors?.length) throw new Error(r.shopifyqlQuery.parseErrors.join("; "));
    sessions = (r.shopifyqlQuery.tableData?.rows ?? []).map((row) => ({ date: String(row.day).slice(0, 10), sessions: Number(row.sessions) }));
    done(`${sessions.length} dias · ${sessions.reduce((a, s) => a + s.sessions, 0)} sessões`);
  } catch (e) {
    console.log(`! sessões indisponíveis: ${e instanceof Error ? e.message : String(e)}`);
  }

  step("Olist · produtos");
  const wrapped = await olistPaginate<{ produto: OlistProduto }>("produtos.pesquisa", "produtos", { pesquisa: "" }, {
    onPage: (c) => process.stdout.write(`\r  Olist · produtos: ${c} `),
  });
  // só o que está no catálogo: a conta é da importadora e tem centenas de produtos de outras marcas
  const noCatalogo = new Map<string, OlistProduto>();
  for (const { produto } of wrapped) {
    const atual = noCatalogo.get(produto.codigo);
    // com código repetido, fica o ativo
    if (!atual || (atual.situacao !== "A" && produto.situacao === "A")) noCatalogo.set(produto.codigo, produto);
  }
  const olistCatalog: OlistCatalogItem[] = catalog
    .map((c) => noCatalogo.get(c.sku))
    .filter((p): p is OlistProduto => Boolean(p))
    .map((p) => ({ id: Number(p.id), codigo: p.codigo, nome: p.nome, situacao: p.situacao, preco: Number(p.preco) || 0 }));
  done(`${olistCatalog.length} de ${catalog.length} SKUs do catálogo (de ${wrapped.length} produtos na conta)`);

  step("Olist · estoque");
  const stock: StockSnapshot[] = [];
  for (const [i, p] of olistCatalog.entries()) {
    process.stdout.write(`\r  Olist · estoque: ${i + 1}/${olistCatalog.length} `);
    const r = await olistPost<{ produto: OlistProdutoEstoque }>("produto.obter.estoque", { id: String(p.id) });
    stock.push(normalizeEstoque(r.produto, pulledAt));
  }
  done(`${stock.length} posições`);

  const snapshot: Snapshot = { pulledAt, since, orders, abandonedCheckouts, sessions, stock, olistCatalog };
  mkdirSync("data", { recursive: true });
  writeFileSync("data/snapshot.json", JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  console.log(`\n→ data/snapshot.json (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} kB). O painel passa a ler daqui.`);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
