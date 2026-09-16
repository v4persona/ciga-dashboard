import { eachDayOfInterval, isWithinInterval, parseISO } from "date-fns";
import type { ShopifyAbandonedCheckout, ShopifyOrder } from "@/lib/sources/shopify/types";
import { bySku, catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { isoDay, type Filters } from "@/lib/filters";

const amt = (m: { shopMoney: { amount: string } }) => Number(m.shopMoney.amount);

export type OrderBucket = "finalizada" | "em_processo" | "aguardando_pagamento" | "cancelada" | "reembolsada";

export function bucketOf(o: ShopifyOrder): OrderBucket {
  if (o.cancelledAt || o.displayFinancialStatus === "VOIDED" || o.displayFinancialStatus === "EXPIRED") return "cancelada";
  if (o.displayFinancialStatus === "REFUNDED") return "reembolsada";
  if (o.displayFinancialStatus === "PENDING" || o.displayFinancialStatus === "AUTHORIZED") return "aguardando_pagamento";
  if (o.displayFulfillmentStatus === "FULFILLED") return "finalizada";
  return "em_processo";
}

export const bucketLabels: Record<OrderBucket, string> = {
  finalizada: "Finalizadas",
  em_processo: "Pagas, a enviar",
  aguardando_pagamento: "Aguardando pagamento",
  cancelada: "Canceladas",
  reembolsada: "Reembolsadas",
};

function matches(o: ShopifyOrder, f: Filters, from: Date, to: Date) {
  const d = parseISO(o.createdAt);
  if (!isWithinInterval(d, { start: from, end: to })) return false;
  if (f.source !== "todas" && o.source !== f.source) return false;
  if (f.model !== "todos" && !o.lineItems.nodes.some((li) => li.sku === f.model)) return false;
  return true;
}

/** receita de um pedido restrita ao modelo filtrado (ou total) */
function revenueOf(o: ShopifyOrder, f: Filters) {
  if (bucketOf(o) === "cancelada") return 0;
  if (f.model === "todos") return amt(o.currentTotalPriceSet);
  return o.lineItems.nodes.filter((li) => li.sku === f.model).reduce((a, li) => a + amt(li.discountedTotalSet), 0);
}

export type SalesSummary = {
  gross: number; orders: number; avgTicket: number; discounts: number; refunded: number;
  finalized: { count: number; value: number };
  inProcess: { count: number; value: number };
  awaitingPayment: { count: number; value: number };
  buckets: { key: OrderBucket; label: string; count: number; value: number }[];
};

export function summarize(orders: ShopifyOrder[], f: Filters, from: Date, to: Date): SalesSummary {
  const sel = orders.filter((o) => matches(o, f, from, to));
  const buckets = (Object.keys(bucketLabels) as OrderBucket[]).map((key) => {
    const os = sel.filter((o) => bucketOf(o) === key);
    return { key, label: bucketLabels[key], count: os.length, value: os.reduce((a, o) => a + revenueOf(o, f), 0) };
  });
  const b = (k: OrderBucket) => buckets.find((x) => x.key === k)!;
  const valid = sel.filter((o) => bucketOf(o) !== "cancelada");
  const gross = valid.reduce((a, o) => a + revenueOf(o, f), 0);
  return {
    gross,
    orders: valid.length,
    avgTicket: valid.length ? gross / valid.length : 0,
    discounts: valid.reduce((a, o) => a + amt(o.totalDiscountsSet), 0),
    refunded: valid.reduce((a, o) => a + amt(o.totalRefundedSet), 0),
    finalized: { count: b("finalizada").count, value: b("finalizada").value },
    inProcess: { count: b("em_processo").count, value: b("em_processo").value },
    awaitingPayment: { count: b("aguardando_pagamento").count, value: b("aguardando_pagamento").value },
    buckets,
  };
}

export type DailyPoint = { date: string; revenue: number; orders: number; source: "shopify" | "legacy" | "misto" };

export function dailySeries(orders: ShopifyOrder[], f: Filters): DailyPoint[] {
  const days = eachDayOfInterval({ start: f.from, end: f.to });
  const map = new Map(days.map((d) => [isoDay(d), { date: isoDay(d), revenue: 0, orders: 0, sources: new Set<string>() }]));
  for (const o of orders) {
    if (!matches(o, f, f.from, f.to) || bucketOf(o) === "cancelada") continue;
    const k = isoDay(parseISO(o.createdAt));
    const p = map.get(k);
    if (!p) continue;
    p.revenue += revenueOf(o, f);
    p.orders += 1;
    p.sources.add(o.source);
  }
  const cut = settings.cutoverDate;
  return [...map.values()].map((p) => ({
    date: p.date,
    revenue: Math.round(p.revenue),
    orders: p.orders,
    source: p.sources.size > 1 ? "misto" : p.date < cut ? "legacy" : "shopify",
  }));
}

export type ModelSales = { sku: string; model: string; collection: string; image: string; units: number; revenue: number };

export function byModel(orders: ShopifyOrder[], f: Filters): ModelSales[] {
  const acc = new Map<string, ModelSales>();
  for (const o of orders) {
    if (!matches(o, { ...f, model: "todos" }, f.from, f.to) || bucketOf(o) === "cancelada") continue;
    for (const li of o.lineItems.nodes) {
      const c = li.sku ? bySku.get(li.sku) : undefined;
      const key = li.sku ?? li.title;
      const cur = acc.get(key) ?? { sku: key, model: c?.model ?? li.title, collection: c?.collection ?? "—", image: c?.image ?? "", units: 0, revenue: 0 };
      cur.units += li.quantity;
      cur.revenue += amt(li.discountedTotalSet);
      acc.set(key, cur);
    }
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
}

export type CartToRecover = { id: string; createdAt: string; customer: string; email: string; value: number; items: string; url: string };

export function cartsToRecover(checkouts: ShopifyAbandonedCheckout[], now: Date, f: Filters): CartToRecover[] {
  const minDate = new Date(now.getTime() - settings.abandonedCartWindowDays * 86_400_000);
  return checkouts
    .filter((c) => c.completedAt === null && parseISO(c.createdAt) >= minDate)
    .filter((c) => f.model === "todos" || c.lineItems.nodes.some((li) => li.sku === f.model))
    .map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      customer: [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(" ") || "Sem nome",
      email: c.customer?.email ?? "",
      value: amt(c.totalPriceSet),
      items: c.lineItems.nodes.map((li) => (li.sku && bySku.get(li.sku)?.model) || li.title).join(", "),
      url: c.abandonedCheckoutUrl,
    }))
    .sort((a, b) => b.value - a.value);
}

export const modelOptions = catalog.map((c) => ({ value: c.sku, label: c.model, collection: c.collection }));
