import { fmtBRL, fmtBRLCents, fmtNum, fmtPct, fmtX } from "@/lib/format";
import type { CampaignRow } from "@/lib/metrics/ads";

const status = { active: ["Ativa", "text-good"], paused: ["Pausada", "text-muted"], ended: ["Encerrada", "text-subtle"] } as const;

export function CampaignsTable({ rows, bestId }: { rows: CampaignRow[]; bestId?: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto">
        <table className="table">
          <thead><tr><th>Campanha</th><th>Status</th><th className="num">Gasto</th><th className="num">% do gasto</th><th className="num">Cliques</th><th className="num">CTR</th><th className="num">CPC</th><th className="num">Compras</th><th className="num">Receita</th><th className="num">ROAS</th></tr></thead>
          <tbody>
            {rows.map((c) => (
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
