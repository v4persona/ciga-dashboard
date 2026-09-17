import { addDays, addHours, formatISO, parseISO, differenceInCalendarDays } from "date-fns";
import { campaignTargets, catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { seeded } from "@/lib/random";
import { mockCampaigns } from "@/lib/sources/ads/mock";
import type { CustomerJourneySummary, MoneyBag, ShopifyAbandonedCheckout, ShopifyOrder } from "./types";

const money = (n: number): MoneyBag => ({ shopMoney: { amount: n.toFixed(2), currencyCode: "BRL" } });

const firstNames = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Thiago", "Vitória", "William"];
const lastNames = ["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Ferreira", "Carvalho", "Gomes", "Martins", "Ribeiro"];

/** Peso de venda por modelo: Blue Planet e Hunter puxam a maior parte da receita. */
const weights = catalog.map((c) =>
  c.collection === "Blue Planet" ? 5 : c.collection === "Hunter" ? 4 : c.collection === "Aventur" ? 2 : 3,
);
const totalWeight = weights.reduce((a, b) => a + b, 0);

/** campanhas de mídia com os modelos que anunciam, para simular a jornada com UTM */
const paidCampaigns = mockCampaigns.map((c) => ({ c, targets: new Set(campaignTargets(c.name).map((t) => t.sku)) }));

/**
 * Simula `customerJourneySummary`: ~55% dos pedidos Shopify chegam por mídia paga com UTM
 * (utm_campaign = nome da campanha); o resto é orgânico/direto. A campanha do próprio modelo
 * é a mais provável; senão uma campanha genérica (Shopping, PMax, Search).
 */
function journeyFor(r: ReturnType<typeof seeded>, sku: string, created: Date, ageDays: number): CustomerJourneySummary {
  const occurredAt = formatISO(addHours(created, -r.int(1, 30)));
  if (!r.chance(0.55)) {
    const source = r.pick(["direct", "google", "instagram", "email"] as const);
    return { ready: ageDays > 0, momentsCount: { count: r.int(1, 4), precision: "EXACT" }, firstVisit: null, lastVisit: { occurredAt, source, landingPage: "https://usecigadesign.com.br/", utmParameters: null } };
  }
  const own = paidCampaigns.filter((p) => p.targets.has(sku) && p.c.status === "active");
  const generic = paidCampaigns.filter((p) => p.targets.size === 0 && p.c.status === "active");
  const pool = own.length && r.chance(0.6) ? own : generic;
  const { c } = r.pick(pool);
  const meta = c.platform === "meta";
  const visit = {
    occurredAt,
    source: meta ? "facebook" : "google",
    landingPage: "https://usecigadesign.com.br/products/" + sku.toLowerCase(),
    utmParameters: { source: meta ? (r.chance(0.5) ? "facebook" : "instagram") : "google", medium: meta ? "paid" : "cpc", campaign: c.name, content: null, term: null },
  };
  return { ready: ageDays > 0, momentsCount: { count: r.int(1, 6), precision: "EXACT" }, firstVisit: visit, lastVisit: visit };
}

function pickSku(r: ReturnType<typeof seeded>) {
  let x = r.next() * totalWeight;
  for (let i = 0; i < catalog.length; i++) {
    x -= weights[i];
    if (x <= 0) return catalog[i];
  }
  return catalog[0];
}

/**
 * Gera ~8 meses de pedidos, com sazonalidade semanal, um pico no Dia dos Pais (ago)
 * e a troca de plataforma em `settings.cutoverDate`. Antes disso, `source: 'legacy'`.
 */
export function generateOrders(today: Date, days = 260): ShopifyOrder[] {
  const r = seeded(20260916);
  const orders: ShopifyOrder[] = [];
  const cutover = parseISO(settings.cutoverDate);
  let seq = 1001;
  for (let d = days; d >= 0; d--) {
    const day = addDays(today, -d);
    const dow = day.getDay();
    const weekend = dow === 0 || dow === 6;
    const month = day.getMonth();
    let base = 3.2 + (weekend ? -0.8 : 0) + (month === 7 ? 1.6 : 0) + (month === 4 ? 0.9 : 0);
    if (day < cutover) base *= 0.75; // plataforma antiga vendia menos
    const n = Math.max(0, Math.round(base + (r.next() - 0.5) * 3));
    for (let i = 0; i < n; i++) {
      const created = addHours(day, r.int(8, 22));
      const items = r.chance(0.15) ? 2 : 1;
      const nodes = [];
      let subtotal = 0;
      for (let k = 0; k < items; k++) {
        const p = pickSku(r);
        const qty = 1;
        const disc = r.chance(0.3) ? Math.round(p.price * 0.1) : 0;
        subtotal += p.price - disc;
        nodes.push({
          id: `gid://shopify/LineItem/${seq}${k}`,
          sku: p.sku,
          title: p.model,
          quantity: qty,
          originalTotalSet: money(p.price),
          discountedTotalSet: money(p.price - disc),
        });
      }
      const discounts = nodes.reduce((a, li) => a + Number(li.originalTotalSet.shopMoney.amount) - Number(li.discountedTotalSet.shopMoney.amount), 0);
      const ageDays = differenceInCalendarDays(today, created);
      const legacy = created < cutover;
      // status: recentes ficam "em processo"; uma pequena parte é cancelada/reembolsada
      let fin: ShopifyOrder["displayFinancialStatus"] = "PAID";
      let ful: ShopifyOrder["displayFulfillmentStatus"] = "FULFILLED";
      let cancelledAt: string | null = null;
      let refunded = 0;
      if (!legacy && ageDays <= 2 && r.chance(0.45)) { fin = "PENDING"; ful = "UNFULFILLED"; }
      else if (!legacy && ageDays <= 6 && r.chance(0.5)) { fin = "PAID"; ful = r.chance(0.5) ? "UNFULFILLED" : "IN_PROGRESS"; }
      else if (r.chance(0.03)) { fin = "REFUNDED"; ful = "RESTOCKED"; refunded = subtotal; }
      else if (r.chance(0.02)) { fin = "VOIDED"; ful = "UNFULFILLED"; cancelledAt = formatISO(addHours(created, 5)); }
      const fn = r.pick(firstNames);
      const ln = r.pick(lastNames);
      orders.push({
        id: `gid://shopify/Order/${seq}`,
        name: `#${seq}`,
        createdAt: formatISO(created),
        processedAt: formatISO(created),
        cancelledAt,
        displayFinancialStatus: fin,
        displayFulfillmentStatus: ful,
        currentTotalPriceSet: money(cancelledAt ? 0 : subtotal - refunded),
        totalDiscountsSet: money(discounts),
        totalRefundedSet: money(refunded),
        customer: { id: `gid://shopify/Customer/${seq * 7}`, firstName: fn, lastName: ln, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` },
        lineItems: { nodes },
        customerJourneySummary: legacy ? null : journeyFor(r, nodes[0].sku, created, ageDays),
        source: legacy ? "legacy" : "shopify",
      });
      seq++;
    }
  }
  return orders;
}

export function generateAbandonedCheckouts(today: Date, days = 60): ShopifyAbandonedCheckout[] {
  const r = seeded(777);
  const out: ShopifyAbandonedCheckout[] = [];
  let seq = 5001;
  for (let d = days; d >= 0; d--) {
    const day = addDays(today, -d);
    const n = r.int(1, 5);
    for (let i = 0; i < n; i++) {
      const created = addHours(day, r.int(9, 23));
      const p = pickSku(r);
      const recovered = r.chance(0.22);
      const fn = r.pick(firstNames);
      const ln = r.pick(lastNames);
      out.push({
        id: `gid://shopify/AbandonedCheckout/${seq}`,
        createdAt: formatISO(created),
        updatedAt: formatISO(created),
        completedAt: recovered ? formatISO(addHours(created, r.int(2, 48))) : null,
        abandonedCheckoutUrl: `https://usecigadesign.com.br/checkouts/ac/${seq}/recover`,
        totalPriceSet: money(p.price),
        customer: { firstName: fn, lastName: ln, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` },
        lineItems: { nodes: [{ id: `gid://shopify/LineItem/ac${seq}`, sku: p.sku, title: p.model, quantity: 1 }] },
      });
      seq++;
    }
  }
  return out;
}
