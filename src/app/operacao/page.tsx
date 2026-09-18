import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDashboardData } from "@/lib/sources";
import { settings } from "@/lib/settings";
import { capital, funnel, integrityAlerts, reposition, WINDOW_DAYS } from "@/lib/metrics/operations";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { TopBar } from "@/components/TopBar";
import { Section } from "@/components/Section";
import { Kpi } from "@/components/Kpi";
import { RepositionTable } from "@/components/RepositionTable";
import { CapitalChart } from "@/components/CapitalChart";
import { FunnelSteps } from "@/components/FunnelSteps";
import { AlertList } from "@/components/AlertList";

export const dynamic = "force-dynamic";

export const metadata = { title: "CIGA design · Operação" };

/**
 * Segunda tela: decisões que só dependem de Shopify + Olist. Estoque é sempre "agora";
 * vendas usam uma janela fixa de 30 dias, sem os filtros da tela principal.
 */
export default async function OperacaoPage() {
  const data = await getDashboardData();
  const rep = reposition(data.orders, data.stock, data.now);
  const cap = capital(data.orders, data.stock, data.now);
  const fun = funnel(data.sessions, data.abandonedCheckouts, data.orders, data.now);
  const alerts = integrityAlerts(data.orders, data.stock, data.olistCatalog, data.now);
  const alta = alerts.filter((a) => a.severity === "alta");

  const criticos = rep.rows.filter((r) => r.level === "critico");
  // a loja é nova: "sem venda na janela" pesa diferente quando o histórico é menor que a própria janela
  const firstOrder = data.orders.map((o) => o.createdAt).sort()[0];
  const historyDays = firstOrder ? differenceInCalendarDays(data.now, parseISO(firstOrder)) : WINDOW_DAYS;
  const shortHistory = historyDays < WINDOW_DAYS;
  const pulledAt = data.syncs.find((s) => s.source === "olist")?.finishedAt;

  return (
    <>
      <TopBar syncs={data.syncs} current="/operacao" />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-8">
          <h1 className="font-condensed text-[40px] leading-none text-ink sm:text-[52px]">Operação</h1>
          <p className="max-w-[52ch] text-sm text-muted">
            Estoque agora, vendas dos últimos {WINDOW_DAYS} dias.
            {pulledAt && ` Posição de ${format(parseISO(pulledAt), "d 'de' MMMM, HH:mm", { locale: ptBR })}.`}
            {data.mode === "mock" && " Dados de exemplo: rode npm run pull para ver os reais."}
          </p>
        </div>

        <div className="flex flex-col gap-16">
          {/* ------------------------------------------------ REPOSIÇÃO */}
          <Section
            id="reposicao"
            title="Reposição"
            description={`O que acaba primeiro entre o que vende. Cobertura é quantos dias o disponível dura no ritmo dos últimos ${WINDOW_DAYS} dias; receita em risco projeta a mesma demanda para os próximos ${WINDOW_DAYS} e valoriza o que faltar.`}
            aside={
              rep.criticalSelling > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-sm border border-bad/40 bg-bad-dim px-3 py-1.5 text-sm text-bad">
                  <span aria-hidden>⚠</span>
                  {rep.criticalSelling} {rep.criticalSelling === 1 ? "modelo vende e está" : "modelos vendem e estão"} abaixo do mínimo
                </span>
              ) : <span className="text-good">Nenhum modelo em venda abaixo do mínimo</span>
            }
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Receita em risco" value={fmtBRL(rep.totalAtRisk)} accent size="lg" sub={<span>se a demanda se repetir nos próximos {WINDOW_DAYS} dias</span>} />
              <Kpi label="Vendendo e acabando" value={String(rep.criticalSelling)} sub={<span>com venda nos últimos {WINDOW_DAYS} dias e abaixo de {settings.stockMin}</span>} />
              <Kpi label="Abaixo do mínimo" value={String(criticos.length)} sub={<span>de {rep.rows.length} SKUs · mínimo {settings.stockMin} disponíveis</span>} />
              <Kpi label="Sem nenhuma peça" value={String(rep.rows.filter((r) => r.disponivel <= 0).length)} sub={<span>disponível zerado ou negativo</span>} />
            </div>
            <div className="mt-3">
              <RepositionTable rows={rep.rows} />
            </div>
          </Section>

          {/* ------------------------------------------------ CAPITAL PARADO */}
          <Section
            id="capital"
            title="Capital em estoque"
            description={`Quanto dinheiro está guardado em peça, a preço de venda. "Sem venda" é o SKU que não saiu nenhuma vez na janela${
              shortHistory ? `, e a loja só tem ${historyDays} dias de histórico na Shopify — é cedo para chamar de encalhe` : ""
            }.`}
            aside={shortHistory ? <span className="text-muted">histórico de {historyDays} dias</span> : undefined}
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Valor em estoque" value={fmtBRL(cap.total)} accent size="lg" sub={<span>{fmtNum(cap.byCollection.reduce((a, c) => a + c.units, 0))} peças</span>} />
              <Kpi label="Sem venda na janela" value={fmtBRL(cap.idleValue)} sub={<span>{fmtPct(cap.idleShare, 0)} do valor · {cap.idle.length} de {rep.rows.length} SKUs</span>} />
              <Kpi label="Maior concentração" value={cap.byCollection[0]?.collection ?? "—"} sub={cap.byCollection[0] ? <span>{fmtBRL(cap.byCollection[0].value)} · {fmtPct(cap.byCollection[0].value / (cap.total || 1), 0)} do total</span> : undefined} />
              <Kpi label="Com venda na janela" value={cap.total ? fmtPct(1 - cap.idleShare, 0) : "—"} sub={<span>do valor em estoque saiu ao menos uma vez</span>} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <div className="card p-5 lg:col-span-2">
                <h3 className="mb-4 text-base font-normal text-ink">Por coleção</h3>
                <CapitalChart rows={cap.byCollection} />
              </div>
              <div className="card p-5 lg:col-span-3">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-normal text-ink">Maior valor sem venda na janela</h3>
                  <span className="text-xs text-muted">top 8 por valor</span>
                </div>
                <ul className="flex flex-col">
                  {cap.idle.slice(0, 8).map((r) => (
                    <li key={r.sku} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                      {r.image ? <img src={r.image} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{r.model}</div>
                        <div className="text-xs text-subtle">{r.collection} · {r.saldo} peças</div>
                      </div>
                      <span className="numeral text-lg text-ink">{fmtBRL(r.value)}</span>
                    </li>
                  ))}
                  {!cap.idle.length && <li className="py-2 text-sm text-good">Todo SKU com estoque vendeu na janela.</li>}
                </ul>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ FUNIL */}
          <Section
            id="funil"
            title="Funil da loja"
            description="Da visita ao pedido, com o que a Shopify registra. Sessões vêm do relatório da própria loja; checkout iniciado é todo carrinho com e-mail identificado."
            aside={fun.sessionDays < WINDOW_DAYS ? <span className="text-muted">sessões disponíveis em {fun.sessionDays} dos {WINDOW_DAYS} dias</span> : undefined}
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <FunnelSteps funnel={fun} />
              </div>
              <div className="flex flex-col gap-3 lg:col-span-2">
                <Kpi label="Conversão" value={fun.conversion === null ? "—" : fmtPct(fun.conversion, 2)} accent size="lg" sub={<span>pedidos ÷ sessões</span>} />
                <Kpi label="Carrinhos a recuperar" value={fmtBRL(fun.abandonedValue)} sub={<span>{fun.abandonedOpen} abertos nos últimos {settings.abandonedCartWindowDays} dias</span>} />
                <Kpi label="Receita na janela" value={fmtBRL(fun.revenue)} sub={<span>pedidos válidos dos últimos {WINDOW_DAYS} dias</span>} />
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ SAÚDE DO CADASTRO */}
          <Section
            id="cadastro"
            title="Saúde do cadastro"
            description="Divergências entre Shopify e Olist que atrapalham venda ou leitura do painel. A junção entre as duas é o SKU."
            aside={
              alta.length ? (
                <span className="inline-flex items-center gap-2 rounded-sm border border-bad/40 bg-bad-dim px-3 py-1.5 text-sm text-bad">
                  <span aria-hidden>⚠</span>{alta.length} de atenção imediata
                </span>
              ) : <span className="text-good">Nada urgente</span>
            }
          >
            <AlertList alerts={alerts} />
          </Section>
        </div>
      </main>
    </>
  );
}
