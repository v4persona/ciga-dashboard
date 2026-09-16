"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { periodLabels, type PeriodPreset, type SourceFilter } from "@/lib/filters";
import { collections } from "@/lib/catalog";
import { settings } from "@/lib/settings";

type Props = { period: PeriodPreset; from: string; to: string; model: string; source: SourceFilter; models: { value: string; label: string; collection: string }[] };

const presets: PeriodPreset[] = ["hoje", "7d", "30d", "mes", "mes-anterior"];

export function FilterBar({ period, from, to, model, source, models }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Período">
        {presets.map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={period === p} onClick={() => set({ periodo: p, de: null, ate: null })}>
            {periodLabels[p]}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line-strong sm:block" />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <span className="sr-only">De</span>
          <input type="date" className="date" value={period === "custom" ? from : ""} placeholder="de" max={to} onChange={(e) => set({ periodo: "custom", de: e.target.value, ate: period === "custom" ? to : "" })} />
          <span aria-hidden>até</span>
          <input type="date" className="date" value={period === "custom" ? to : ""} min={from} onChange={(e) => set({ periodo: "custom", de: period === "custom" ? from : "", ate: e.target.value })} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        Modelo
        <select className="select" value={model} onChange={(e) => set({ modelo: e.target.value === "todos" ? null : e.target.value })}>
          <option value="todos">Todos os modelos</option>
          {collections.map((c) => (
            <optgroup key={c} label={c}>
              {models.filter((m) => m.collection === c).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2 text-xs text-muted" role="group" aria-label="Fonte dos dados">
        Fonte
        <div className="flex gap-1">
          {([["todas", "Todas"], ["shopify", "Shopify"], ["legacy", settings.legacyPlatformName]] as const).map(([v, l]) => (
            <button key={v} type="button" className="chip capitalize" aria-pressed={source === v} onClick={() => set({ fonte: v === "todas" ? null : v })}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
