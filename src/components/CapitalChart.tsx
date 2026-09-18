"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtBRL, fmtBRLCompact, fmtNum } from "@/lib/format";
import type { CapitalByCollection } from "@/lib/metrics/operations";
import { TooltipBox } from "./ChartTooltip";

/**
 * Valor em estoque por coleção. Série única: uma cor só (dourado), magnitude na barra.
 * A coleção em foco (mais dinheiro parado) fica em dourado claro para leitura imediata.
 */
export function CapitalChart({ rows }: { rows: CapitalByCollection[] }) {
  const height = Math.max(180, rows.length * 44);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Valor em estoque por coleção, a preço de venda">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
          <YAxis type="category" dataKey="collection" tickLine={false} axisLine={false} width={92} />
          <Tooltip
            cursor={{ fill: "var(--card-hover)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as CapitalByCollection;
              return (
                <TooltipBox
                  title={p.collection}
                  rows={[
                    { label: "Valor em estoque", value: fmtBRL(p.value), color: "var(--gold)" },
                    { label: "Peças", value: fmtNum(p.units) },
                    { label: "SKUs", value: fmtNum(p.skus) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={22}>
            {rows.map((r, i) => (
              <Cell key={r.collection} fill={i === 0 ? "var(--gold-light)" : "var(--gold)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
