"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtBRL, fmtBRLCompact } from "@/lib/format";
import { TooltipBox } from "./ChartTooltip";

export function SpendChart({ data }: { data: { date: string; meta: number; google: number }[] }) {
  const many = data.length > 45;
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Gasto diário em mídia, Meta e Google empilhados">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={many ? "20%" : "35%"}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={many ? 48 : 28} tickFormatter={(d: string) => format(parseISO(d), many ? "d MMM" : "d/M", { locale: ptBR })} />
          <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => fmtBRLCompact(v)} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; meta: number; google: number };
              return <TooltipBox title={format(parseISO(p.date), "d 'de' MMMM", { locale: ptBR })} rows={[
                { label: "Meta", value: fmtBRL(p.meta), color: "var(--blue)" },
                { label: "Google", value: fmtBRL(p.google), color: "var(--gold)" },
                { label: "Total", value: fmtBRL(p.meta + p.google) },
              ]} />;
            }}
          />
          <Bar dataKey="meta" stackId="a" fill="var(--blue)" stroke="var(--card)" strokeWidth={1} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="google" stackId="a" fill="var(--gold)" stroke="var(--card)" strokeWidth={1} maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
