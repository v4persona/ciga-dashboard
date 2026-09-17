"use client";
import { fmtBRL, fmtBRLCents, fmtNum, fmtPct, fmtX } from "@/lib/format";
import type { CampaignRow } from "@/lib/metrics/ads";
import { Th, useSort, type Accessors } from "./sortable";

type Key = "name" | "status" | "spend" | "share" | "clicks" | "ctr" | "cpc" | "purchases" | "revenue" | "roas";
const statusRank = { active: 0, paused: 1, ended: 2 } as const;
const accessors: Accessors<CampaignRow, Key> = {
  name: (c) => c.name, status: (c) => statusRank[c.status], spend: (c) => c.spend, share: (c) => c.share, clicks: (c) => c.clicks,
  ctr: (c) => c.ctr, cpc: (c) => c.cpc, purchases: (c) => c.purchases, revenue: (c) => c.revenue, roas: (c) => (c.purchases ? c.roas : null),
};

const status = { active: ["Ativa", "text-good"], paused: ["Pausada", "text-muted"], ended: ["Encerrada", "text-subtle"] } as const;

export function CampaignsTable({ rows, bestId }: { rows: CampaignRow[]; bestId?: string }) {
  const { sorted, sort, toggle } = useSort(rows, accessors, { key: "spend", dir: "desc" });
  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <Th label="Campanha" sortKey="name" sort={sort} onSort={toggle} />
              <Th label="Status" sortKey="status" sort={sort} onSort={toggle} />
              <Th label="Gasto" sortKey="spend" sort={sort} onSort={toggle} num />
              <Th label="% do gasto" sortKey="share" sort={sort} onSort={toggle} num />
              <Th label="Cliques" sortKey="clicks" sort={sort} onSort={toggle} num />
              <Th label="CTR" sortKey="ctr" sort={sort} onSort={toggle} num />
              <Th label="CPC" sortKey="cpc" sort={sort} onSort={toggle} num />
              <Th label="Compras" sortKey="purchases" sort={sort} onSort={toggle} num />
              <Th label="Receita" sortKey="revenue" sort={sort} onSort={toggle} num />
              <Th label="ROAS" sortKey="roas" sort={sort} onSort={toggle} num />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className={c.id === bestId ? "bg-gold-dim" : ""}>
                <td>
                  <div className="flex items-center gap-2">
                    <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[2px] ${c.platform === "meta" ? "bg-blue" : "bg-gold"}`} />
                    <span className="font-normal text-ink">{c.name}</span>
                    {c.id === bestId && <span className="rounded-sm border border-line-gold px-1.5 text-[10px] text-gold">melhor ROAS</span>}
                  </div>
                  <div className="pl-[18px] text-xs text-subtle">{c.platform === "meta" ? "Meta" : "Google"}</div>
                </td>
                <td className={`text-xs ${status[c.status][1]}`}>{status[c.status][0]}</td>
                <td className="num text-ink">{fmtBRL(c.spend)}</td>
                <td className="num text-muted">{fmtPct(c.share, 0)}</td>
                <td className="num text-muted">{fmtNum(c.clicks)}</td>
                <td className="num text-muted">{fmtPct(c.ctr)}</td>
                <td className="num text-muted">{fmtBRLCents(c.cpc)}</td>
                <td className="num text-muted">{fmtNum(c.purchases)}</td>
                <td className="num text-muted">{fmtBRL(c.revenue)}</td>
                <td className={`num ${c.roas >= 3 ? "text-good" : c.roas > 0 && c.roas < 1.5 ? "text-bad" : "text-ink"}`}>{c.purchases ? fmtX(c.roas) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
