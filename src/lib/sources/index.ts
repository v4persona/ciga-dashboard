/**
 * Repositório de dados do painel. Lê `data/snapshot.json` (gerado por `npm run pull`) quando ele existe;
 * sem ele, devolve mock. Quando o Supabase entrar, troca-se a leitura aqui e o front não muda:
 * o front só conhece `getDashboardData()`.
 */
import { generateOrders, generateAbandonedCheckouts, generateSessions } from "./shopify/mock";
import { generateStock } from "./olist/mock";
import { generateAdDaily, mockCampaigns } from "./ads/mock";
import { readSnapshot } from "./snapshot";
import type { SessionDaily, ShopifyAbandonedCheckout, ShopifyOrder } from "./shopify/types";
import type { OlistCatalogItem, StockSnapshot } from "./olist/types";
import type { AdCampaign, AdDaily } from "./ads/types";

export type DataMode = "mock" | "local" | "live";

export type SyncStatus = { source: "shopify" | "olist" | "meta" | "google"; finishedAt: string | null; ok: boolean; mode: DataMode };

export type DashboardData = {
  now: Date;
  /** de onde vieram vendas e estoque */
  mode: DataMode;
  orders: ShopifyOrder[];
  abandonedCheckouts: ShopifyAbandonedCheckout[];
  sessions: SessionDaily[];
  stock: StockSnapshot[];
  olistCatalog: OlistCatalogItem[];
  /** mídia paga entra na fase 2; hoje só mock, escondido por settings.showPaidMedia */
  campaigns: AdCampaign[];
  adDaily: AdDaily[];
  syncs: SyncStatus[];
};

let cache: DashboardData | null = null;

export async function getDashboardData(): Promise<DashboardData> {
  if (cache) return cache;
  const now = new Date();
  const snapshot = await readSnapshot();

  if (snapshot) {
    cache = {
      now,
      mode: "local",
      orders: snapshot.orders,
      abandonedCheckouts: snapshot.abandonedCheckouts,
      sessions: snapshot.sessions,
      stock: snapshot.stock,
      olistCatalog: snapshot.olistCatalog,
      campaigns: mockCampaigns,
      adDaily: generateAdDaily(now),
      syncs: [
        { source: "shopify", finishedAt: snapshot.pulledAt, ok: snapshot.orders.length > 0, mode: "local" },
        { source: "olist", finishedAt: snapshot.pulledAt, ok: snapshot.stock.length > 0, mode: "local" },
        { source: "meta", finishedAt: null, ok: false, mode: "mock" },
        { source: "google", finishedAt: null, ok: false, mode: "mock" },
      ],
    };
    return cache;
  }

  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  cache = {
    now,
    mode: "mock",
    orders: generateOrders(now),
    abandonedCheckouts: generateAbandonedCheckouts(now),
    sessions: generateSessions(now),
    stock: generateStock(now),
    olistCatalog: [],
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
