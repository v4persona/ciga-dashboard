import { Suspense } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDashboardData } from "@/lib/sources";
import { parseFilters, isoDay } from "@/lib/filters";
import { settings } from "@/lib/settings";
import { byModel, cartsToRecover, dailySeries, modelOptions, summarize } from "@/lib/metrics/sales";
import { stockRows } from "@/lib/metrics/stock";
import { summarizeAds } from "@/lib/metrics/ads";
import { delta, fmtBRL, fmtBRLCents, fmtNum, fmtPct, fmtX } from "@/lib/format";
import { TopBar } from "@/components/TopBar";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Section";
import { Kpi } from "@/components/Kpi";
import { RevenueChart } from "@/components/RevenueChart";
import { ModelBars } from "@/components/ModelBars";
import { StatusBreakdown } from "@/components/StatusBreakdown";
import { CartsTable } from "@/components/CartsTable";
import { StockTable } from "@/components/StockTable";
import { SpendChart } from "@/components/SpendChart";
import { CampaignsTable } from "@/components/CampaignsTable";
import { bySku } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const data = await getDashboardData();
  const f = parseFilters(params, data.now);

  // ---- vendas
  const cur = summarize(data.orders, f, f.from, f.to);
  const prev = summarize(data.orders, f, f.prevFrom, f.prevTo);
  const series = dailySeries(data.orders, f);
  const prevSeries = dailySeries(data.orders, { ...f, from: f.prevFrom, to: f.prevTo });
  const models = byModel(data.orders, f);
  const carts = cartsToRecover(data.abandonedCheckouts, data.now, f);
  const cartsValue = carts.reduce((a, c) => a + c.value, 0);

  // ---- estoque (sempre "agora"; a cobertura usa vendas dos últimos 30 dias)
  const last30 = byModel(data.orders, { ...f, model: "todos", source: "todas", from: subDays(data.now, 30), to: data.now });
  const stock = stockRows(data.stock, new Map(last30.map((m) => [m.sku, m.units])));
  const critical = stock.filter((s) => s.level === "critico");
  const warning = stock.filter((s) => s.level === "atencao");

  // ---- tráfego pago
  const ads = summarizeAds(data.campaigns, data.adDaily, f, cur.gross, cur.orders);
  const prevAdsMer = ads.prev.spend ? prev.gross / ads.prev.spend : 0;

  const periodText = `${format(f.from, "d MMM", { locale: ptBR })} – ${format(f.to, "d MMM yyyy", { locale: ptBR })}`;
  const modelName = f.model === "todos" ? null : bySku.get(f.model)?.model ?? f.model;
  const legacyInRange = isoDay(f.from) < settings.cutoverDate;

  return (
    <>
      <TopBar syncs={data.syncs}>
        <Suspense>
          <FilterBar period={f.period} from={isoDay(f.from)} to={isoDay(f.to)} model={f.model} source={f.source} models={modelOptions} />
        </Suspense>
      </TopBar>

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-8">
          <h1 className="font-condensed text-[40px] leading-none text-ink sm:text-[52px]">
            {periodText}
            {modelName && <span className="text-gold-light"> · {modelName}</span>}
          </h1>
          <p className="max-w-[48ch] text-sm text-muted">
            {legacyInRange
              ? `Inclui vendas da ${settings.legacyPlatformName} até ${format(new Date(settings.cutoverDate + "T12:00:00"), "d 'de' MMMM", { locale: ptBR })}; a partir daí, Shopify.`
              : "Comparações são contra o período imediatamente anterior, de mesma duração."}
          </p>
        </div>

        <div className="flex flex-col gap-16">
          {/* ------------------------------------------------ VENDAS */}
          <Section id="vendas" title="Vendas" description="Pedidos da loja no período. Receita bruta considera todos os pedidos não cancelados, antes de reembolsos.">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Receita bruta" value={fmtBRL(cur.gross)} delta={delta(cur.gross, prev.gross)} accent size="lg" sub={<span>{fmtNum(cur.orders)} pedidos · ticket {fmtBRL(cur.avgTicket)}</span>} />
              <Kpi label="Finalizadas" value={fmtBRL(cur.finalized.value)} delta={delta(cur.finalized.value, prev.finalized.value)} sub={<span>{cur.finalized.count} pedidos pagos e enviados</span>} />
              <Kpi label="Em processo" value={fmtBRL(cur.inProcess.value + cur.awaitingPayment.value)} sub={<span>{cur.inProcess.count} a enviar · {cur.awaitingPayment.count} aguardando pagamento</span>} />
              <Kpi label="Carrinhos a recuperar" value={fmtBRL(cartsValue)} sub={<span>{carts.length} checkouts nos últimos {settings.abandonedCartWindowDays} dias</span>} />
            </div>

            <div className="card mt-3 p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-normal text-ink">Receita por dia</h3>
                <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legenda">
                  <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-0.5 w-4 bg-gold" />Este período</li>
                  <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-0.5 w-4" style={{ background: "repeating-linear-gradient(90deg, var(--text-subtle) 0 3px, transparent 3px 5px)" }} />Período anterior</li>
                  {legacyInRange && <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-3 w-px bg-rose" />Troca de plataforma</li>}
                </ul>
              </div>
              <RevenueChart current={series} previous={prevSeries} cutover={settings.cutoverDate} legacyName={settings.legacyPlatformName} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <div className="card p-5 lg:col-span-3">
                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-normal text-ink">Vendas por modelo</h3>
                  <span className="text-xs text-muted">top 8 por receita</span>
                </div>
                <ModelBars rows={models} highlight={f.model} />
              </div>
              <div className="card p-5 lg:col-span-2">
                <h3 className="mb-4 text-base font-normal text-ink">Status dos pedidos</h3>
                <StatusBreakdown buckets={cur.buckets} />
              </div>
            </div>

            <div className="mt-3">
              <CartsTable carts={carts} windowDays={settings.abandonedCartWindowDays} />
            </div>
          </Section>

          {/* ------------------------------------------------ ESTOQUE */}
          <Section
            id="estoque"
            title="Estoque"
            description={`Posição atual no Olist. Mínimo definido em ${settings.stockMin} unidades disponíveis por modelo. Cobertura estima em quantos dias o estoque zera no ritmo dos últimos 30 dias.`}
            aside={
              critical.length || warning.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  {critical.length > 0 && <span className="inline-flex items-center gap-2 rounded-sm border border-bad/40 bg-bad-dim px-3 py-1.5 text-sm text-bad"><span aria-hidden>⚠</span>{critical.length} {critical.length === 1 ? "modelo abaixo" : "modelos abaixo"} do mínimo</span>}
                  {warning.length > 0 && <span className="inline-flex items-center gap-2 rounded-sm border border-line-gold bg-gold-dim px-3 py-1.5 text-sm text-gold">{warning.length} no limite</span>}
                </div>
              ) : <span className="text-good">Todos os modelos acima do mínimo</span>
            }
          >
            {critical.length > 0 && (
              <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {critical.map((s) => (
                  <li key={s.sku} className="card flex items-center gap-3 border-bad/30 p-3">
                    {s.image ? <img src={s.image} alt="" className="thumb" /> : <span className="thumb" />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-normal text-ink">{s.model}</div>
                      <div className="text-xs text-bad">{s.disponivel === 0 ? "Esgotado" : `${s.disponivel} disponíveis`}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <StockTable rows={stock} min={settings.stockMin} highlight={f.model} />
          </Section>

          {/* ------------------------------------------------ TRÁFEGO PAGO */}
          <Section id="trafego" title="Tráfego pago" description="Meta e Google somados. MER é a receita da loja dividida pelo gasto total: a leitura mais honesta de retorno, porque não depende da atribuição de cada plataforma.">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Gasto total" value={fmtBRL(ads.total.spend)} delta={delta(ads.total.spend, ads.prev.spend)} invert sub={<span>Meta {fmtBRL(ads.byPlatform.meta.spend)} · Google {fmtBRL(ads.byPlatform.google.spend)}</span>} />
              <Kpi label="MER" value={ads.total.spend ? fmtX(ads.mer) : "—"} delta={delta(ads.mer, prevAdsMer)} accent sub={<span>receita ÷ gasto</span>} />
              <Kpi label="ROAS atribuído" value={ads.total.purchases ? fmtX(ads.total.roas) : "—"} delta={delta(ads.total.roas, ads.prev.roas)} sub={<span>{fmtNum(ads.total.purchases)} compras · {fmtBRL(ads.total.revenue)}</span>} />
              <Kpi label="Custo por pedido" value={cur.orders ? fmtBRL(ads.cac) : "—"} delta={delta(ads.cac, ads.prev.spend && prev.orders ? ads.prev.spend / prev.orders : 0)} invert sub={<span>gasto ÷ pedidos da loja</span>} />
              <Kpi label="Campanhas ativas" value={String(ads.activeCampaigns)} sub={<span>CTR {fmtPct(ads.total.ctr)} · CPC {fmtBRLCents(ads.total.cpc)}</span>} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <div className="card p-5 lg:col-span-3">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-normal text-ink">Gasto por dia</h3>
                  <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legenda">
                    <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-blue" />Meta</li>
                    <li className="flex items-center gap-2"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-gold" />Google</li>
                  </ul>
                </div>
                <SpendChart data={ads.daily} />
              </div>
              <div className="card flex flex-col p-5 lg:col-span-2">
                <h3 className="text-base font-normal text-ink">Melhor campanha</h3>
                <p className="mt-1 text-xs text-muted">maior ROAS entre campanhas com pelo menos {fmtBRL(settings.bestCampaignMinSpend)} gastos</p>
                {ads.best ? (
                  <div className="mt-6 flex flex-1 flex-col justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted"><span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[2px] ${ads.best.platform === "meta" ? "bg-blue" : "bg-gold"}`} />{ads.best.platform === "meta" ? "Meta" : "Google"}</div>
                      <div className="mt-1 text-xl font-normal text-ink">{ads.best.name}</div>
                    </div>
                    <div className="numeral text-[56px] text-gold-light">{fmtX(ads.best.roas)}</div>
                    <dl className="grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-xs text-subtle">Gasto</dt><dd className="text-ink">{fmtBRL(ads.best.spend)}</dd></div>
                      <div><dt className="text-xs text-subtle">Compras</dt><dd className="text-ink">{fmtNum(ads.best.purchases)}</dd></div>
                      <div><dt className="text-xs text-subtle">Receita</dt><dd className="text-ink">{fmtBRL(ads.best.revenue)}</dd></div>
                    </dl>
                  </div>
                ) : <p className="mt-6 text-sm text-muted">Nenhuma campanha com compras rastreadas no período.</p>}
              </div>
            </div>

            <div className="mt-3">
              <CampaignsTable rows={ads.campaigns} bestId={ads.best?.id} />
            </div>
          </Section>
        </div>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-subtle">
        CIGA design Brasil · dados em {settings.currency}, fuso {settings.timeZone}
      </footer>
    </>
  );
}
