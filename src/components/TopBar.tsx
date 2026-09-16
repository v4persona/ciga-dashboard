import Image from "next/image";
import { format, parseISO } from "date-fns";
import type { SyncStatus } from "@/lib/sources";

const names: Record<SyncStatus["source"], string> = { shopify: "Shopify", olist: "Olist", meta: "Meta", google: "Google" };

export function TopBar({ syncs, children }: { syncs: SyncStatus[]; children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image src="/ciga-logo.png" alt="CIGA design" width={96} height={32} priority className="h-7 w-auto" />
            <span className="hidden h-5 w-px bg-line-strong sm:block" />
            <span className="hidden text-sm font-normal text-muted sm:block">Painel geral</span>
          </div>
          <ul className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted" aria-label="Última sincronização">
            {syncs.map((s) => (
              <li key={s.source} className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${s.ok ? "bg-good" : "bg-bad"}`} />
                <span className="text-ink/80">{names[s.source]}</span>
                <span className="hidden sm:inline">{s.finishedAt ? format(parseISO(s.finishedAt), "HH:mm") : "sem dados"}</span>
                {s.mode === "mock" && <span className="rounded-sm border border-line px-1 text-[10px] text-subtle">mock</span>}
              </li>
            ))}
          </ul>
        </div>
        {children}
      </div>
    </header>
  );
}
