/**
 * Repositório de dados do painel. Hoje devolve mock; amanhã lê do Postgres alimentado pelos syncs.
 * A assinatura não muda: o front só conhece `getDashboardData()`.
 */
import { generateOrders, generateAbandonedCheckouts } from "./shopify/mock";
import { generateStock } from "./olist/mock";
import { generateAdDaily, mockCampaigns } from "./ads/mock";
import type { ShopifyAbandonedCheckout, ShopifyOrder } from "./shopify/types";
import type { StockSnapshot } from "./olist/types";
import type { AdCampaign, AdDaily } from "./ads/types";

export type SyncStatus = { source: "shopify" | "olist" | "meta" | "google"; finishedAt: string | null; ok: boolean; mode: "mock" | "live" };

export type DashboardData = {
  now: Date;
  orders: ShopifyOrder[];
  abandonedCheckouts: ShopifyAbandonedCheckout[];
  stock: StockSnapshot[];
  campaigns: AdCampaign[];
  adDaily: AdDaily[];
  syncs: SyncStatus[];
};

let cache: DashboardData | null = null;

export async function getDashboardData(): Promise<DashboardData> {
  if (cache) return cache;
  const now = new Date();
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  cache = {
    now,
    orders: generateOrders(now),
    abandonedCheckouts: generateAbandonedCheckouts(now),
    stock: generateStock(now),
    campaigns: mockCampaigns,
    adDaily: generateAdDaily(now),
    syncs: [
      { source: "shopify", finishedAt: iso(12), ok: true, mode: "mock" },
      { source: "olist", finishedAt: iso(27), ok: true, mode: "mock" },
      { source: "meta", finishedAt: iso(48), ok: true, mode: "mock" },
      { source: "google", finishedAt: null, ok: false, mode: "mock" },
    ],
  };
  return cache;
}
