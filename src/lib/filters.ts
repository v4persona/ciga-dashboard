import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { settings } from "./settings";

export type PeriodPreset = "hoje" | "7d" | "30d" | "mes" | "mes-anterior" | "custom";
export type SourceFilter = "todas" | "shopify" | "legacy";

export type Filters = {
  period: PeriodPreset;
  from: Date;
  to: Date;
  /** período imediatamente anterior, de mesma duração, para comparação */
  prevFrom: Date;
  prevTo: Date;
  /** sku do modelo ou "todos" */
  model: string;
  source: SourceFilter;
};

export const periodLabels: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
  "mes-anterior": "Mês anterior",
  custom: "Personalizado",
};

export function parseFilters(params: Record<string, string | string[] | undefined>, now: Date): Filters {
  const get = (k: string) => (Array.isArray(params[k]) ? params[k]?.[0] : params[k]) as string | undefined;
  const period = (get("periodo") ?? "30d") as PeriodPreset;
  let from: Date;
  let to: Date = endOfDay(now);
  switch (period) {
    case "hoje": from = startOfDay(now); break;
    case "7d": from = startOfDay(subDays(now, 6)); break;
    case "mes": from = startOfMonth(now); break;
    case "mes-anterior": { const m = subMonths(now, 1); from = startOfMonth(m); to = endOfDay(endOfMonth(m)); break; }
    case "custom": {
      const f = get("de"); const t = get("ate");
      from = f ? startOfDay(parseISO(f)) : startOfDay(subDays(now, 29));
      to = t ? endOfDay(parseISO(t)) : endOfDay(now);
      break;
    }
    default: from = startOfDay(subDays(now, 29));
  }
  const len = differenceInCalendarDays(to, from) + 1;
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(prevTo, -(len - 1)));
  return { period: periodLabels[period] ? period : "30d", from, to, prevFrom, prevTo, model: get("modelo") ?? "todos", source: (get("fonte") as SourceFilter) ?? "todas" };
}

export const isoDay = (d: Date) => format(d, "yyyy-MM-dd");
export const cutover = () => parseISO(settings.cutoverDate);
