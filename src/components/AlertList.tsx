import { alertLabels, type IntegrityAlert } from "@/lib/metrics/operations";

/**
 * Alertas de cadastro agrupados por tipo. Severidade nunca é só cor: vem com ícone e a palavra.
 */
export function AlertList({ alerts }: { alerts: IntegrityAlert[] }) {
  if (!alerts.length) {
    return <p className="card p-5 text-sm text-good">Nenhuma divergência entre Shopify e Olist.</p>;
  }
  const kinds = [...new Set(alerts.map((a) => a.kind))];
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {kinds.map((kind) => {
        const items = alerts.filter((a) => a.kind === kind);
        const alta = items[0].severity === "alta";
        return (
          <section key={kind} className={`card p-5 ${alta ? "border-bad/30" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={`text-base font-normal ${alta ? "text-bad" : "text-ink"}`}>
                <span aria-hidden className="mr-1.5">{alta ? "⚠" : "●"}</span>
                {alertLabels[kind].label}
                <span className="sr-only"> — severidade {items[0].severity}</span>
              </h3>
              <span className="numeral text-xl text-ink">{items.length}</span>
            </div>
            <p className="mt-1 text-xs text-subtle">{alertLabels[kind].fix}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {items.slice(0, 6).map((a) => (
                <li key={`${a.kind}-${a.sku}`} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line pt-1.5">
                  <span className="text-ink">{a.model}</span>
                  <span className="text-xs text-muted">{a.detail}</span>
                </li>
              ))}
              {items.length > 6 && <li className="pt-1 text-xs text-subtle">… e mais {items.length - 6}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
