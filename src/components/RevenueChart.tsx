"use client";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtBRL, fmtBRLCompact } from "@/lib/format";
import { TooltipBox } from "./ChartTooltip";
import type { DailyPoint } from "@/lib/metrics/sales";

type Props = { current: DailyPoint[]; previous: DailyPoint[]; cutover: string; legacyName: string };

export function RevenueChart({ current, previous, cutover, legacyName }: Props) {
  const data = current.map((p, i) => ({ ...p, prev: previous[i]?.revenue ?? null, prevDate: previous[i]?.date }));
  const showCutover = current.some((p) => p.date === cutover);
  const many = data.length > 45;
  return (
    <div className="h-[300px] w-full" role="img" aria-label="Receita por dia no período, comparada com o período anterior">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={many ? 48 : 28} tickFormatter={(d: string) => format(parseISO(d), many ? "d MMM" : "d/M", { locale: ptBR })} />
          <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmtBRLCompact(v)} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <TooltipBox
                  title={format(parseISO(p.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  rows={[
                    { label: p.source === "legacy" ? legacyName : "Receita", value: `${fmtBRL(p.revenue)} · ${p.orders} ped.`, color: "var(--gold)" },
                    ...(p.prev !== null && p.prevDate ? [{ label: `Anterior (${format(parseISO(p.prevDate), "d/M")})`, value: fmtBRL(p.prev), color: "var(--text-subtle)", dashed: true }] : []),
                  ]}
                />
              );
            }}
          />
          {showCutover && (
            <ReferenceLine x={cutover} stroke="var(--rose)" strokeDasharray="4 4" label={{ value: "Troca para Shopify", position: "insideTopLeft", fill: "var(--rose)", fontSize: 11 }} />
          )}
          <Area type="monotone" dataKey="prev" stroke="var(--text-subtle)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} activeDot={{ r: 4, fill: "var(--text-subtle)", stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
          <Area type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} fill="url(#gold)" dot={false} activeDot={{ r: 5, fill: "var(--gold)", stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
