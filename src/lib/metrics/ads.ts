import { eachDayOfInterval } from "date-fns";
import type { AdCampaign, AdDaily, AdPlatform } from "@/lib/sources/ads/types";
import { isoDay, type Filters } from "@/lib/filters";
import { settings } from "@/lib/settings";

export type AdTotals = { spend: number; impressions: number; clicks: number; purchases: number; revenue: number; roas: number; cpa: number; ctr: number; cpc: number };

const totals = (rows: AdDaily[]): AdTotals => {
  const t = rows.reduce((a, r) => ({ spend: a.spend + r.spend, impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks, purchases: a.purchases + r.purchases, revenue: a.revenue + r.revenue }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 });
  return { ...t, roas: t.spend ? t.revenue / t.spend : 0, cpa: t.purchases ? t.spend / t.purchases : 0, ctr: t.impressions ? t.clicks / t.impressions : 0, cpc: t.clicks ? t.spend / t.clicks : 0 };
};

const inRange = (r: AdDaily, from: Date, to: Date) => r.date >= isoDay(from) && r.date <= isoDay(to);

export type CampaignRow = AdCampaign & AdTotals & { share: number };

export type AdsSummary = {
  total: AdTotals;
  prev: AdTotals;
  byPlatform: Record<AdPlatform, AdTotals>;
  activeCampaigns: number;
  campaigns: CampaignRow[];
  best: CampaignRow | null;
  /** Marketing Efficiency Ratio = receita Shopify ÷ gasto total */
  mer: number;
  cac: number;
  daily: { date: string; meta: number; google: number }[];
};

export function summarizeAds(campaigns: AdCampaign[], rows: AdDaily[], f: Filters, shopifyGross: number, shopifyOrders: number): AdsSummary {
  const cur = rows.filter((r) => inRange(r, f.from, f.to));
  const prev = rows.filter((r) => inRange(r, f.prevFrom, f.prevTo));
  const total = totals(cur);
  const byPlatform = { meta: totals(cur.filter((r) => r.campaignId.startsWith("meta:"))), google: totals(cur.filter((r) => r.campaignId.startsWith("google:"))) };
  const campaignRows: CampaignRow[] = campaigns
    .map((c) => ({ ...c, ...totals(cur.filter((r) => r.campaignId === c.id)), share: 0 }))
    .filter((c) => c.spend > 0 || c.status === "active")
    .map((c) => ({ ...c, share: total.spend ? c.spend / total.spend : 0 }))
    .sort((a, b) => b.spend - a.spend);
  const eligible = campaignRows.filter((c) => c.spend >= settings.bestCampaignMinSpend && c.purchases > 0);
  const best = eligible.sort((a, b) => b.roas - a.roas)[0] ?? null;
  const days = eachDayOfInterval({ start: f.from, end: f.to }).map(isoDay);
  const daily = days.map((date) => ({
    date,
    meta: Math.round(cur.filter((r) => r.date === date && r.campaignId.startsWith("meta:")).reduce((a, r) => a + r.spend, 0)),
    google: Math.round(cur.filter((r) => r.date === date && r.campaignId.startsWith("google:")).reduce((a, r) => a + r.spend, 0)),
  }));
  return {
    total,
    prev: totals(prev),
    byPlatform,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    campaigns: campaignRows.sort((a, b) => b.spend - a.spend),
    best,
    mer: total.spend ? shopifyGross / total.spend : 0,
    cac: shopifyOrders ? total.spend / shopifyOrders : 0,
    daily,
  };
}
