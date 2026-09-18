/**
 * Métricas da tela de Operação: o que dá para decidir com Shopify + Olist, sem mídia paga.
 * Funções puras; a janela de vendas é fixa (últimos 30 dias) e o estoque é sempre "agora".
 */
import { isWithinInterval, parseISO, subDays } from "date-fns";
import { bySku, catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { isoDay } from "@/lib/filters";
import type { SessionDaily, ShopifyAbandonedCheckout, ShopifyOrder } from "@/lib/sources/shopify/types";
import type { OlistCatalogItem, StockSnapshot } from "@/lib/sources/olist/types";
import { bucketOf } from "./sales";
import { stockLevel, type StockLevel } from "./stock";

const amt = (m: { shopMoney: { amount: string } }) => Number(m.shopMoney.amount);

export const WINDOW_DAYS = 30;

/** unidades vendidas por SKU nos últimos N dias (pedidos não cancelados) */
export function unitsSold(orders: ShopifyOrder[], now: Date, days = WINDOW_DAYS): Map<string, number> {
  const from = subDays(now, days);
  const out = new Map<string, number>();
  for (const o of orders) {
    if (!isWithinInterval(parseISO(o.createdAt), { start: from, end: now }) || bucketOf(o) === "cancelada") continue;
    for (const li of o.lineItems.nodes) {
      if (!li.sku) continue;
      out.set(li.sku, (out.get(li.sku) ?? 0) + li.quantity);
    }
  }
  return out;
}

// ---------------------------------------------------------------- reposição

export type RepositionRow = {
  sku: string; model: string; collection: string; image: string;
  units: number; saldo: number; reservado: number; disponivel: number;
  level: StockLevel;
  /** dias até zerar no ritmo dos últimos 30 dias; null quando não vendeu */
  daysOfCover: number | null;
  price: number;
  /** receita dos próximos 30 dias que o estoque atual não cobre */
  valueAtRisk: number;
};

export type Reposition = { rows: RepositionRow[]; totalAtRisk: number; criticalSelling: number };

/**
 * Ranking de reposição: quem vende e está acabando primeiro. `valueAtRisk` projeta a demanda dos
 * últimos 30 dias para os próximos 30 e valoriza o que faltar pelo preço da loja.
 */
export function reposition(orders: ShopifyOrder[], stock: StockSnapshot[], now: Date): Reposition {
  const units = unitsSold(orders, now);
  const rows: RepositionRow[] = stock.map((s) => {
    const c = bySku.get(s.sku);
    const sold = units.get(s.sku) ?? 0;
    const daily = sold / WINDOW_DAYS;
    const price = c?.price ?? 0;
    return {
      sku: s.sku,
      model: c?.model ?? s.nome,
      collection: c?.collection ?? "—",
      image: c?.image ?? "",
      units: sold,
      saldo: s.saldo,
      reservado: s.reservado,
      disponivel: s.disponivel,
      level: stockLevel(s.disponivel),
      daysOfCover: daily > 0 ? Math.round(s.disponivel / daily) : null,
      price,
      valueAtRisk: Math.max(0, sold - s.disponivel) * price,
    };
  });

  // quem vende e tem pouco vem primeiro; depois quem está crítico sem venda; o resto por cobertura
  const rank = (r: RepositionRow) => (r.units > 0 && r.level !== "ok" ? 0 : r.units > 0 ? 1 : r.level !== "ok" ? 2 : 3);
  rows.sort((a, b) =>
    rank(a) - rank(b) ||
    b.valueAtRisk - a.valueAtRisk ||
    (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) ||
    a.disponivel - b.disponivel,
  );

  return {
    rows,
    totalAtRisk: rows.reduce((a, r) => a + r.valueAtRisk, 0),
    criticalSelling: rows.filter((r) => r.units > 0 && r.level !== "ok").length,
  };
}

// ---------------------------------------------------------------- capital parado

export type CapitalByCollection = { collection: string; skus: number; units: number; value: number };
export type IdleRow = { sku: string; model: string; collection: string; image: string; saldo: number; price: number; value: number };
export type Capital = { total: number; byCollection: CapitalByCollection[]; idle: IdleRow[]; idleValue: number; idleShare: number };

/**
 * Quanto de dinheiro está no estoque, a preço de venda (a Olist tem preço de custo, mas ele não entra
 * no snapshot hoje). "Parado" = sem nenhuma venda nos últimos 30 dias.
 */
export function capital(orders: ShopifyOrder[], stock: StockSnapshot[], now: Date): Capital {
  const units = unitsSold(orders, now);
  const byCollection = new Map<string, CapitalByCollection>();
  const idle: IdleRow[] = [];
  let total = 0;

  for (const s of stock) {
    const c = bySku.get(s.sku);
    const price = c?.price ?? 0;
    const saldo = Math.max(0, s.saldo);
    const value = saldo * price;
    total += value;
    const key = c?.collection ?? "—";
    const acc = byCollection.get(key) ?? { collection: key, skus: 0, units: 0, value: 0 };
    acc.skus += 1;
    acc.units += saldo;
    acc.value += value;
    byCollection.set(key, acc);
    if (!units.get(s.sku) && saldo > 0) idle.push({ sku: s.sku, model: c?.model ?? s.nome, collection: key, image: c?.image ?? "", saldo, price, value });
  }

  idle.sort((a, b) => b.value - a.value);
  const idleValue = idle.reduce((a, r) => a + r.value, 0);
  return {
    total,
    byCollection: [...byCollection.values()].sort((a, b) => b.value - a.value),
    idle,
    idleValue,
    idleShare: total ? idleValue / total : 0,
  };
}

// ---------------------------------------------------------------- funil

export type FunnelStep = { key: "sessions" | "checkouts" | "orders"; label: string; value: number; note: string };
export type Funnel = {
  steps: FunnelStep[];
  /** dias de sessão disponíveis na janela (o ShopifyQL só tem desde a troca de plataforma) */
  sessionDays: number;
  conversion: number | null;
  checkoutRate: number | null;
  closeRate: number | null;
  abandonedOpen: number;
  abandonedValue: number;
  revenue: number;
};

export function funnel(
  sessions: SessionDaily[],
  checkouts: ShopifyAbandonedCheckout[],
  orders: ShopifyOrder[],
  now: Date,
  days = WINDOW_DAYS,
): Funnel {
  const from = subDays(now, days);
  const inWindow = (iso: string) => isWithinInterval(parseISO(iso), { start: from, end: now });

  const sessionRows = sessions.filter((s) => s.date >= isoDay(from) && s.date <= isoDay(now));
  const sessionCount = sessionRows.reduce((a, s) => a + s.sessions, 0);
  const checkoutRows = checkouts.filter((c) => inWindow(c.createdAt));
  const valid = orders.filter((o) => inWindow(o.createdAt) && bucketOf(o) !== "cancelada");
  const revenue = valid.reduce((a, o) => a + amt(o.currentTotalPriceSet), 0);

  // "a recuperar" usa a janela de carrinho de settings, que é mais curta que a do funil
  const recoverFrom = subDays(now, settings.abandonedCartWindowDays);
  const open = checkouts.filter((c) => !c.completedAt && parseISO(c.createdAt) >= recoverFrom);

  return {
    steps: [
      { key: "sessions", label: "Sessões", value: sessionCount, note: `${sessionRows.length} dias com dado` },
      { key: "checkouts", label: "Checkouts iniciados", value: checkoutRows.length, note: `${checkoutRows.filter((c) => c.completedAt).length} viraram pedido` },
      { key: "orders", label: "Pedidos válidos", value: valid.length, note: "sem cancelados e expirados" },
    ],
    sessionDays: sessionRows.length,
    conversion: sessionCount ? valid.length / sessionCount : null,
    checkoutRate: sessionCount ? checkoutRows.length / sessionCount : null,
    closeRate: checkoutRows.length ? checkoutRows.filter((c) => c.completedAt).length / checkoutRows.length : null,
    abandonedOpen: open.length,
    abandonedValue: open.reduce((a, c) => a + amt(c.totalPriceSet), 0),
    revenue,
  };
}

// ---------------------------------------------------------------- saúde do cadastro

export type AlertKind =
  | "estoque_negativo" | "reservado_maior" | "vendendo_sem_estoque"
  | "preco_divergente" | "inativo_na_olist" | "sem_correspondencia" | "vendido_fora_do_catalogo";

export type IntegrityAlert = { kind: AlertKind; severity: "alta" | "media"; sku: string; model: string; detail: string };

export const alertLabels: Record<AlertKind, { label: string; fix: string }> = {
  estoque_negativo: { label: "Saldo negativo", fix: "Corrigir o cadastro na Olist" },
  reservado_maior: { label: "Reservado acima do saldo", fix: "Conferir pedidos reservados na Olist" },
  vendendo_sem_estoque: { label: "Vendendo sem estoque", fix: "Repor ou pausar a venda na Shopify" },
  preco_divergente: { label: "Preço diferente entre as fontes", fix: "Alinhar Shopify e Olist" },
  inativo_na_olist: { label: "Ativo na Shopify, inativo na Olist", fix: "Reativar na Olist ou tirar da loja" },
  sem_correspondencia: { label: "Sem produto na Olist", fix: "Cadastrar o SKU na Olist" },
  vendido_fora_do_catalogo: { label: "Vendido fora do catálogo", fix: "Rodar npm run shopify:catalog" },
};

/** diferença de preço a partir da qual vale avisar */
const PRICE_TOLERANCE = 0.01;

export function integrityAlerts(
  orders: ShopifyOrder[],
  stock: StockSnapshot[],
  olistCatalog: OlistCatalogItem[],
  now: Date,
): IntegrityAlert[] {
  const units = unitsSold(orders, now);
  const out: IntegrityAlert[] = [];
  const stockBySku = new Map(stock.map((s) => [s.sku, s]));
  const olistBySku = new Map(olistCatalog.map((p) => [p.codigo, p]));
  const nameOf = (sku: string) => bySku.get(sku)?.model ?? sku;

  for (const s of stock) {
    if (s.saldo < 0 || s.disponivel < 0) {
      out.push({ kind: "estoque_negativo", severity: "alta", sku: s.sku, model: nameOf(s.sku), detail: `saldo ${s.saldo}, disponível ${s.disponivel}` });
    } else if (s.reservado > s.saldo) {
      out.push({ kind: "reservado_maior", severity: "alta", sku: s.sku, model: nameOf(s.sku), detail: `reservado ${s.reservado} para saldo ${s.saldo}` });
    }
    const sold = units.get(s.sku) ?? 0;
    if (sold > 0 && s.disponivel <= 0) {
      out.push({ kind: "vendendo_sem_estoque", severity: "alta", sku: s.sku, model: nameOf(s.sku), detail: `${sold} vendida${sold > 1 ? "s" : ""} em ${WINDOW_DAYS} dias, disponível ${s.disponivel}` });
    }
  }

  for (const c of catalog) {
    const p = olistBySku.get(c.sku);
    if (!p || !stockBySku.has(c.sku)) {
      if (olistCatalog.length) out.push({ kind: "sem_correspondencia", severity: "alta", sku: c.sku, model: c.model, detail: "SKU da Shopify não encontrado na Olist" });
      continue;
    }
    if (p.situacao !== "A") {
      out.push({ kind: "inativo_na_olist", severity: "media", sku: c.sku, model: c.model, detail: `situação "${p.situacao}" na Olist` });
    }
    if (p.preco > 0 && c.price > 0 && Math.abs(p.preco - c.price) / c.price > PRICE_TOLERANCE) {
      out.push({ kind: "preco_divergente", severity: "media", sku: c.sku, model: c.model, detail: `Shopify ${c.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Olist ${p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` });
    }
  }

  const foraDoCatalogo = new Map<string, number>();
  for (const [sku, qty] of units) if (!bySku.has(sku)) foraDoCatalogo.set(sku, qty);
  for (const [sku, qty] of foraDoCatalogo) {
    out.push({ kind: "vendido_fora_do_catalogo", severity: "media", sku, model: sku, detail: `${qty} unidade(s) vendida(s), SKU fora do catálogo` });
  }

  const order = { alta: 0, media: 1 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.kind.localeCompare(b.kind) || a.model.localeCompare(b.model));
}
