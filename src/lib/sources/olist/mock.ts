import { formatISO } from "date-fns";
import { catalog } from "@/lib/catalog";
import { seeded } from "@/lib/random";
import type { StockSnapshot } from "./types";

/** Estoque atual por SKU, com alguns modelos propositalmente abaixo do mínimo. */
export function generateStock(capturedAt: Date): StockSnapshot[] {
  const r = seeded(42);
  const forced: Record<string, number> = {
    "CIGA-BP2-GLD": 2,
    "CIGA-HUN-TB": 0,
    "CIGA-ZOD-DRG": 4,
    "CIGA-AVT-SRP": 5,
    "CIGA-EVR-70": 5,
    "CIGA-AVT-ICE": 3,
  };
  return catalog.map((c, i) => {
    const saldo = forced[c.sku] ?? r.int(6, 34);
    const reservado = saldo > 0 && r.chance(0.35) ? r.int(1, Math.min(3, saldo)) : 0;
    const disponivel = saldo - reservado;
    const id = 900100 + i;
    return {
      capturedAt: formatISO(capturedAt),
      produto: {
        id,
        sku: c.sku,
        descricao: `CIGA design ${c.model}`,
        tipo: "S",
        situacao: "A",
        dataCriacao: "2026-05-20",
        dataAlteracao: "2026-09-10",
        unidade: "UN",
        gtin: `789${String(1000000000 + i).slice(0, 10)}`,
        precos: { preco: c.price, precoPromocional: null, precoCusto: Math.round(c.price * 0.42), precoCustoMedio: Math.round(c.price * 0.41) },
        estoque: { localizacao: `A${(i % 4) + 1}-${String(i).padStart(2, "0")}` },
        tipoVariacao: "N",
      },
      estoque: {
        id,
        nome: `CIGA design ${c.model}`,
        codigo: c.sku,
        unidade: "UN",
        saldo,
        reservado,
        disponivel,
        localizacao: `A${(i % 4) + 1}-${String(i).padStart(2, "0")}`,
        depositos: [{ id: 1, nome: "Geral", desconsiderar: false, saldo, reservado, disponivel, empresa: "CIGA design Brasil" }],
      },
    };
  });
}
