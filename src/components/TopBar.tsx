import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { SyncStatus } from "@/lib/sources";

const names: Record<SyncStatus["source"], string> = { shopify: "Shopify", olist: "Olist", meta: "Meta", google: "Google" };

const pages = [
  { href: "/", label: "Painel geral" },
  { href: "/operacao", label: "Operação" },
] as const;

export function TopBar({ syncs, current, children }: { syncs: SyncStatus[]; current: string; children?: React.ReactNode }) {
  return (
    <header className="z-20 md:sticky md:top-0 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image src="/ciga-logo.png" alt="CIGA design" width={96} height={32} priority className="h-7 w-auto" />
            <span className="hidden h-5 w-px bg-line-strong sm:block" />
            <nav className="flex items-center gap-1" aria-label="Telas">
              {pages.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={p.href === current ? "page" : undefined}
                  className={`rounded-sm px-2 py-1 text-sm ${p.href === current ? "bg-gold-dim text-gold-light" : "text-muted hover:text-ink"}`}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
          </div>
          <ul className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted" aria-label="Última sincronização">
            {syncs.map((s) => (
              <li key={s.source} className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${s.ok ? "bg-good" : "bg-bad"}`} />
                <span className="text-ink/80">{names[s.source]}</span>
                <span className="hidden sm:inline">{s.finishedAt ? format(parseISO(s.finishedAt), "HH:mm") : "sem dados"}</span>
                {s.mode !== "live" && <span className="rounded-sm border border-line px-1 text-[10px] text-subtle">{s.mode === "mock" ? "mock" : "local"}</span>}
              </li>
            ))}
          </ul>
        </div>
        {children}
      </div>
    </header>
  );
}
