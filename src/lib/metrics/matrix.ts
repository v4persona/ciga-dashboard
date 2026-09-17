/**
 * Matriz do modelo: uma linha por relógio, colunas vindas das três fontes.
 * Chaves de junção: SKU (Shopify ↔ Olist), nome da campanha → modelo (Meta/Google ↔ catálogo,
 * ver `campaignTargets`) e utm_campaign da última visita (pedido Shopify ↔ campanha).
 */
import { isWithinInterval, parseISO } from "date-fns";
import type { ShopifyOrder } from "@/lib/sources/shopify/types";
import type { AdCampaign, AdDaily, AdPlatform } from "@/lib/sources/ads/types";
import { campaignTargets, catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { isoDay, type Filters } from "@/lib/filters";
import { bucketOf } from "./sales";
import type { StockLevel, StockRow } from "./stock";

const amt = (m: { shopMoney: { amount: string } }) => Number(m.shopMoney.amount);

export type Signal = "repor" | "sem_midia" | "gasto_sem_venda" | "atribuicao_inflada";

export const signalLabels: Record<Signal, { label: string; decision: string }> = {
  repor: { label: "Anúncio com estoque crítico", decision: "Repor antes de investir mais" },
  sem_midia: { label: "Vende sem anúncio", decision: "Candidato a campanha própria" },
  gasto_sem_venda: { label: "Gasto sem venda", decision: "Rever ou pausar a campanha" },
  atribuicao_inflada: { label: "Atribuição inflada", decision: "Desconfiar do ROAS da plataforma" },
};

export type MatrixRow = {
  sku: string; model: string; collection: string; image: string;
  /** vendas Shopify no período */
  units: number; revenue: number; revenueShare: number;
  /** estoque agora */
  disponivel: number; level: StockLevel; daysOfCover: number | null;
  /** mídia atribuída ao modelo (rateio das campanhas que o anunciam) */
  spend: number; spendByPlatform: Record<AdPlatform, number>; spendShare: number;
  claimedPurchases: number; claimedRevenue: number; roas: number;
  campaigns: string[];
  /** pedidos Shopify cuja última visita veio de uma campanha deste modelo */
  utmOrders: number; utmRevenue: number;
  signals: Signal[];
};

export type ModelMatrix = {
  rows: MatrixRow[];
  /** gasto de campanhas genéricas (sem modelo no nome), não rateado */
  genericSpend: number;
  genericCampaigns: string[];
  /** pedidos com UTM de campanha genérica ou não reconhecida */
  genericUtmOrders: number;
  /** modelos por sinal, na ordem da tabela (maior receita primeiro) */
  flagged: Record<Signal, string[]>;
};

type Acc = { units: number; revenue: number; spend: Record<AdPlatform, number>; claimedPurchases: number; claimedRevenue: number; campaigns: Set<string>; utmOrders: number; utmRevenue: number };

const norm = (s: string) => s.trim().toLowerCase();

function platformOfUtm(source: string | null): AdPlatform | null {
  const s = norm(source ?? "");
  if ((settings.utmSources.meta as readonly string[]).includes(s)) return "meta";
  if ((settings.utmSources.google as readonly string[]).includes(s)) return "google";
  return null;
}

export function modelMatrix(orders: ShopifyOrder[], stock: StockRow[], campaigns: AdCampaign[], adDaily: AdDaily[], f: Filters): ModelMatrix {
  const acc = new Map<string, Acc>(catalog.map((c) => [c.sku, { units: 0, revenue: 0, spend: { meta: 0, google: 0 }, claimedPurchases: 0, claimedRevenue: 0, campaigns: new Set(), utmOrders: 0, utmRevenue: 0 }]));

  // ---- vendas por SKU no período (só Shopify: o legado não tem jornada nem mídia)
  const sel = orders.filter((o) => isWithinInterval(parseISO(o.createdAt), { start: f.from, end: f.to }) && bucketOf(o) !== "cancelada");
  for (const o of sel) {
    for (const li of o.lineItems.nodes) {
      const a = li.sku ? acc.get(li.sku) : undefined;
      if (!a) continue;
      a.units += li.quantity;
      a.revenue += amt(li.discountedTotalSet);
    }
  }

  // ---- campanha → modelos; gasto rateado pelas unidades vendidas (igual se ninguém vendeu)
  const targets = new Map(campaigns.map((c) => [c.id, campaignTargets(c.name)]));
  const byName = new Map(campaigns.map((c) => [norm(c.name), c]));
  const byExternalId = new Map(campaigns.map((c) => [`${c.platform}:${c.externalId}`, c]));
  const inRange = adDaily.filter((r) => r.date >= isoDay(f.from) && r.date <= isoDay(f.to));
  let genericSpend = 0;
  const genericCampaigns = new Set<string>();
  const campaignTotals = new Map<string, { spend: number; purchases: number; revenue: number }>();
  for (const r of inRange) {
    const t = campaignTotals.get(r.campaignId) ?? { spend: 0, purchases: 0, revenue: 0 };
    t.spend += r.spend; t.purchases += r.purchases; t.revenue += r.revenue;
    campaignTotals.set(r.campaignId, t);
  }
  for (const c of campaigns) {
    const t = campaignTotals.get(c.id);
    if (!t || t.spend === 0) continue;
    const ts = targets.get(c.id) ?? [];
    if (ts.length === 0) { genericSpend += t.spend; genericCampaigns.add(c.name); continue; }
    const unitsSold = ts.map((m) => acc.get(m.sku)?.units ?? 0);
    const totalUnits = unitsSold.reduce((a, b) => a + b, 0);
    ts.forEach((m, i) => {
      const a = acc.get(m.sku)!;
      const w = totalUnits ? unitsSold[i] / totalUnits : 1 / ts.length;
      a.spend[c.platform] += t.spend * w;
      a.claimedPurchases += t.purchases * w;
      a.claimedRevenue += t.revenue * w;
      a.campaigns.add(c.name);
    });
  }

  // ---- pedido → campanha pela UTM da última visita
  let genericUtmOrders = 0;
  for (const o of sel) {
    const utm = o.customerJourneySummary?.lastVisit?.utmParameters;
    if (!utm?.campaign) continue;
    const platform = platformOfUtm(utm.source);
    const c = byName.get(norm(utm.campaign)) ?? (platform ? byExternalId.get(`${platform}:${utm.campaign}`) : undefined);
    const ts = c ? targets.get(c.id) ?? [] : [];
    if (ts.length === 0) { genericUtmOrders++; continue; }
    // o pedido conta para os modelos da campanha que ele de fato contém; se nenhum, para todos os alvos
    const inOrder = ts.filter((m) => o.lineItems.nodes.some((li) => li.sku === m.sku));
    const hit = inOrder.length ? inOrder : ts;
    for (const m of hit) {
      const a = acc.get(m.sku)!;
      a.utmOrders += 1 / hit.length;
      a.utmRevenue += amt(o.currentTotalPriceSet) / hit.length;
    }
  }

  const totalRevenue = [...acc.values()].reduce((a, x) => a + x.revenue, 0);
  const totalSpend = [...acc.values()].reduce((a, x) => a + x.spend.meta + x.spend.google, 0) + genericSpend;
  // "vende sem anúncio" = fatura pelo menos tanto quanto o modelo anunciado que menos fatura
  // (sem nenhum modelo anunciado, cai para o quarto superior de receita)
  const advertised = [...acc.values()].filter((a) => a.spend.meta + a.spend.google > 0).map((a) => a.revenue);
  const revenueSorted = [...acc.values()].map((a) => a.revenue).sort((a, b) => b - a);
  const sellsWellFloor = advertised.length ? Math.min(...advertised) : revenueSorted[Math.ceil(revenueSorted.length / 4) - 1] ?? 0;
  const stockBySku = new Map(stock.map((s) => [s.sku, s]));

  const rows: MatrixRow[] = catalog.map((c) => {
    const a = acc.get(c.sku)!;
    const s = stockBySku.get(c.sku);
    const spend = a.spend.meta + a.spend.google;
    const level: StockLevel = s?.level ?? "ok";
    const signals: Signal[] = [];
    if (spend > 0 && level !== "ok") signals.push("repor");
    if (spend === 0 && a.revenue > 0 && a.revenue >= sellsWellFloor && level === "ok") signals.push("sem_midia");
    if (spend >= settings.bestCampaignMinSpend && a.utmOrders === 0 && a.claimedPurchases < 1) signals.push("gasto_sem_venda");
    if (a.claimedPurchases >= 1 && a.claimedPurchases >= a.utmOrders * settings.attributionInflationRatio && !signals.includes("gasto_sem_venda")) signals.push("atribuicao_inflada");
    return {
      sku: c.sku, model: c.model, collection: c.collection, image: c.image,
      units: a.units, revenue: a.revenue, revenueShare: totalRevenue ? a.revenue / totalRevenue : 0,
      disponivel: s?.disponivel ?? 0, level, daysOfCover: s?.daysOfCover ?? null,
      spend, spendByPlatform: a.spend, spendShare: totalSpend ? spend / totalSpend : 0,
      claimedPurchases: a.claimedPurchases, claimedRevenue: a.claimedRevenue, roas: spend ? a.claimedRevenue / spend : 0,
      campaigns: [...a.campaigns],
      utmOrders: a.utmOrders, utmRevenue: a.utmRevenue,
      signals,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue || a.model.localeCompare(b.model));

  const flagged: Record<Signal, string[]> = { repor: [], sem_midia: [], gasto_sem_venda: [], atribuicao_inflada: [] };
  for (const r of rows) for (const sg of r.signals) flagged[sg].push(r.model);

  return { rows, genericSpend, genericCampaigns: [...genericCampaigns], genericUtmOrders, flagged };
}
