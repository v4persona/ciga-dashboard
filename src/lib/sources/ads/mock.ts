import { addDays, format } from "date-fns";
import { seeded } from "@/lib/random";
import type { AdCampaign, AdDaily } from "./types";

export const mockCampaigns: AdCampaign[] = [
  { id: "meta:1201", platform: "meta", externalId: "1201", name: "Blue Planet II — Conversão", status: "active", objective: "OUTCOME_SALES" },
  { id: "meta:1202", platform: "meta", externalId: "1202", name: "Remarketing — Carrinho", status: "active", objective: "OUTCOME_SALES" },
  { id: "meta:1203", platform: "meta", externalId: "1203", name: "Hunter — Lançamento Titanium", status: "active", objective: "OUTCOME_SALES" },
  { id: "meta:1204", platform: "meta", externalId: "1204", name: "Reconhecimento — Vídeo GPHG", status: "paused", objective: "OUTCOME_AWARENESS" },
  { id: "google:8801", platform: "google", externalId: "8801", name: "Search — Marca CIGA", status: "active", objective: "SEARCH" },
  { id: "google:8802", platform: "google", externalId: "8802", name: "Shopping — Catálogo", status: "active", objective: "SHOPPING" },
  { id: "google:8803", platform: "google", externalId: "8803", name: "Performance Max — Relógios", status: "active", objective: "PERFORMANCE_MAX" },
  { id: "google:8804", platform: "google", externalId: "8804", name: "Search — Genérico automático", status: "ended", objective: "SEARCH" },
];

/** perfil de cada campanha: gasto diário base, CTR, taxa de conversão, ticket */
const profile: Record<string, { spend: number; ctr: number; cvr: number; ticket: number; cpm: number }> = {
  "meta:1201": { spend: 900, ctr: 0.014, cvr: 0.0012, ticket: 8600, cpm: 28 },
  "meta:1202": { spend: 350, ctr: 0.022, cvr: 0.0024, ticket: 5200, cpm: 34 },
  "meta:1203": { spend: 550, ctr: 0.012, cvr: 0.0014, ticket: 3900, cpm: 26 },
  "meta:1204": { spend: 150, ctr: 0.006, cvr: 0.00015, ticket: 4000, cpm: 12 },
  "google:8801": { spend: 200, ctr: 0.085, cvr: 0.0023, ticket: 5600, cpm: 90 },
  "google:8802": { spend: 500, ctr: 0.019, cvr: 0.0018, ticket: 4800, cpm: 40 },
  "google:8803": { spend: 650, ctr: 0.016, cvr: 0.0013, ticket: 5100, cpm: 30 },
  "google:8804": { spend: 300, ctr: 0.021, cvr: 0.0004, ticket: 3500, cpm: 35 },
};

export function generateAdDaily(today: Date, days = 120): AdDaily[] {
  const r = seeded(99);
  const rows: AdDaily[] = [];
  for (let d = days; d >= 0; d--) {
    const day = addDays(today, -d);
    const date = format(day, "yyyy-MM-dd");
    for (const c of mockCampaigns) {
      const p = profile[c.id];
      // campanha pausada parou há 20 dias; encerrada parou há 45
      if (c.status === "paused" && d < 20) continue;
      if (c.status === "ended" && d < 45) continue;
      const spend = Math.max(0, p.spend * (0.7 + r.next() * 0.6) * (day.getMonth() === 7 ? 1.3 : 1));
      const impressions = Math.round((spend / p.cpm) * 1000);
      const clicks = Math.round(impressions * p.ctr * (0.8 + r.next() * 0.4));
      const purchasesF = clicks * p.cvr;
      const purchases = Math.floor(purchasesF) + (r.chance(purchasesF % 1) ? 1 : 0);
      rows.push({ campaignId: c.id, date, spend: Math.round(spend * 100) / 100, impressions, clicks, purchases, revenue: purchases * p.ticket * (0.9 + r.next() * 0.2) });
    }
  }
  return rows;
}
