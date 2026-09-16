import type { StockSnapshot } from "@/lib/sources/olist/types";
import { bySku } from "@/lib/catalog";
import { settings } from "@/lib/settings";

export type StockLevel = "critico" | "atencao" | "ok";

export type StockRow = {
  sku: string; model: string; collection: string; image: string;
  saldo: number; reservado: number; disponivel: number;
  level: StockLevel;
  /** dias até zerar, com base na média de vendas diárias dos últimos 30 dias */
  daysOfCover: number | null;
};

export function stockLevel(available: number): StockLevel {
  if (available < settings.stockMin) return "critico";
  if (available === settings.stockMin) return "atencao";
  return "ok";
}

export const levelLabels: Record<StockLevel, string> = { critico: "Crítico", atencao: "Atenção", ok: "Ok" };

export function stockRows(snapshots: StockSnapshot[], unitsLast30: Map<string, number>): StockRow[] {
  const order: Record<StockLevel, number> = { critico: 0, atencao: 1, ok: 2 };
  return snapshots
    .map((s) => {
      const c = bySku.get(s.produto.sku);
      const daily = (unitsLast30.get(s.produto.sku) ?? 0) / 30;
      return {
        sku: s.produto.sku,
        model: c?.model ?? s.produto.descricao,
        collection: c?.collection ?? "—",
        image: c?.image ?? "",
        saldo: s.estoque.saldo,
        reservado: s.estoque.reservado,
        disponivel: s.estoque.disponivel,
        level: stockLevel(s.estoque.disponivel),
        daysOfCover: daily > 0 ? Math.round(s.estoque.disponivel / daily) : null,
      };
    })
    .sort((a, b) => order[a.level] - order[b.level] || a.disponivel - b.disponivel || a.model.localeCompare(b.model));
}
