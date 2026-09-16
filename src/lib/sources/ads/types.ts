/**
 * Tráfego pago. Cada plataforma mantém os nomes de campo da própria API;
 * `AdDaily` é a linha normalizada (campanha × dia) que o painel consome.
 */

/** Meta Marketing API — GET /{ad_account_id}/insights?level=campaign&time_increment=1 */
export type MetaCampaignInsight = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;   // YYYY-MM-DD
  date_stop: string;
  spend: string;        // a Meta devolve números como string
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];        // ex.: purchase
  action_values?: { action_type: string; value: string }[];  // receita atribuída
};

/** Meta — GET /{ad_account_id}/campaigns?fields=id,name,effective_status,objective */
export type MetaCampaign = {
  id: string;
  name: string;
  effective_status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "IN_PROCESS" | "WITH_ISSUES";
  objective: string;
};

/** Google Ads API — GAQL: SELECT campaign.id, campaign.name, campaign.status, segments.date, metrics.* FROM campaign */
export type GoogleCampaignRow = {
  campaign: { id: string; name: string; status: "ENABLED" | "PAUSED" | "REMOVED"; advertisingChannelType: string };
  segments: { date: string };
  metrics: {
    costMicros: string;
    impressions: string;
    clicks: string;
    conversions: number;
    conversionsValue: number;
  };
};

export type AdPlatform = "meta" | "google";

export type AdCampaign = {
  id: string;
  platform: AdPlatform;
  externalId: string;
  name: string;
  status: "active" | "paused" | "ended";
  objective: string;
};

export type AdDaily = {
  campaignId: string;
  date: string;   // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
};

export function normalizeMeta(rows: MetaCampaignInsight[]): AdDaily[] {
  return rows.map((r) => ({
    campaignId: `meta:${r.campaign_id}`,
    date: r.date_start,
    spend: Number(r.spend),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    purchases: Number(r.actions?.find((a) => a.action_type === "purchase")?.value ?? 0),
    revenue: Number(r.action_values?.find((a) => a.action_type === "purchase")?.value ?? 0),
  }));
}

export function normalizeGoogle(rows: GoogleCampaignRow[]): AdDaily[] {
  return rows.map((r) => ({
    campaignId: `google:${r.campaign.id}`,
    date: r.segments.date,
    spend: Number(r.metrics.costMicros) / 1e6,
    impressions: Number(r.metrics.impressions),
    clicks: Number(r.metrics.clicks),
    purchases: r.metrics.conversions,
    revenue: r.metrics.conversionsValue,
  }));
}
