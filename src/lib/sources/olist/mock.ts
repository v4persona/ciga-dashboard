import { formatISO } from "date-fns";
import { catalog } from "@/lib/catalog";
import { seeded } from "@/lib/random";
import type { StockSnapshot } from "./types";

/** Estoque atual por SKU, com alguns modelos propositalmente abaixo do mínimo. */
export function generateStock(capturedAt: Date): StockSnapshot[] {
  const r = seeded(42);
  const forced: Record<string, number> = {
    JG6004576: 2, // Blue Planet II Gilded Age · U036
    JG6004804: 0, // Hunter Tourbillon
    JG5043606: 4, // Legend of Serpent 18K Gold
    JG5043613: 5, // Legend of Serpent 925 Silver
    JG6004514: 5, // Everest China 65th Anniversary
    JG5043569: 3, // Ice Age Blue
  };
  return catalog.map((c, i) => {
    const saldo = forced[c.sku] ?? r.int(6, 34);
    const reservado = saldo > 0 && r.chance(0.35) ? r.int(1, Math.min(3, saldo)) : 0;
    return {
      capturedAt: formatISO(capturedAt),
      idOlist: 900100 + i,
      sku: c.sku,
      nome: `CIGA design ${c.model}`,
      saldo,
      reservado,
      disponivel: saldo - reservado,
      depositos: [{ nome: "Geral", empresa: "JG Importadora", desconsiderar: false, saldo }],
    };
  });
}
