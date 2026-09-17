/**
 * Sondagem da Olist (API v2): confere o token, lista os produtos, cruza SKU com o catálogo da Shopify
 * e lê o estoque de uma amostra. Só leitura.
 *
 *   npm run olist:probe            # estoque de até 30 SKUs do catálogo
 *   npm run olist:probe -- --todos # estoque de todos os SKUs do catálogo encontrados na Olist
 */
import { formatISO } from "date-fns";
import { bySku, catalog } from "@/lib/catalog";
import { settings } from "@/lib/settings";
import { stockLevel } from "@/lib/metrics/stock";
import { olistPaginate, olistPost, OlistError } from "@/lib/sources/olist/client";
import { normalizeEstoque, type OlistProduto, type OlistProdutoEstoque, type StockSnapshot } from "@/lib/sources/olist/types";

const all = process.argv.includes("--todos");
const ok = (s: string) => console.log(`  ✓ ${s}`);
const warn = (s: string) => console.log(`  ! ${s}`);
const fail = (s: string) => console.log(`  ✗ ${s}`);
const title = (s: string) => console.log(`\n── ${s}`);
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

function tally<T>(items: T[], key: (t: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) ?? "(vazio)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const list = (entries: [string, number][], limit = 10) =>
  entries.slice(0, limit).forEach(([k, n]) => console.log(`      ${String(n).padStart(5)}  ${k}`));

const situacaoLabel: Record<string, string> = { A: "A (ativo)", I: "I (inativo)", E: "E (excluído)" };
const variacaoLabel: Record<string, string> = { N: "N (sem variação)", P: "P (produto pai)", V: "V (variação)" };

async function main() {
  title("Conta");
  const info = await olistPost<{ conta: { razao_social: string; cnpj_cpf: string; fantasia: string } }>("info");
  ok(`${info.conta.fantasia} · ${info.conta.razao_social} · CNPJ ${info.conta.cnpj_cpf}`);

  title("Produtos");
  // a v2 não tem "listar tudo": pesquisa vazia devolve o catálogo inteiro, 100 por página
  const wrapped = await olistPaginate<{ produto: OlistProduto }>("produtos.pesquisa", "produtos", { pesquisa: "" }, {
    onPage: (c, pages) => process.stdout.write(`\r  … ${c} produtos (${pages} páginas)`),
  });
  process.stdout.write("\r");
  const produtos = wrapped.map((w) => w.produto);
  ok(`${produtos.length} produtos`);
  console.log("    situacao");
  list(tally(produtos, (p) => situacaoLabel[p.situacao] ?? p.situacao));
  console.log("    tipoVariacao");
  list(tally(produtos, (p) => variacaoLabel[p.tipoVariacao] ?? p.tipoVariacao));

  title("SKU Olist (codigo) × catálogo Shopify");
  const byCodigo = new Map<string, OlistProduto[]>();
  for (const p of produtos) byCodigo.set(p.codigo, [...(byCodigo.get(p.codigo) ?? []), p]);
  const found = catalog.filter((c) => byCodigo.has(c.sku));
  const missing = catalog.filter((c) => !byCodigo.has(c.sku));
  ok(`${found.length} de ${catalog.length} SKUs do catálogo existem na Olist (${pct(found.length, catalog.length)})`);
  if (missing.length) {
    warn(`${missing.length} do catálogo sem código igual na Olist:`);
    missing.slice(0, 20).forEach((c) => console.log(`      ${c.sku.padEnd(12)} ${c.model}`));
    if (missing.length > 20) console.log(`      … e mais ${missing.length - 20}`);
  }
  const dup = [...byCodigo].filter(([, ps]) => ps.length > 1);
  if (dup.length) {
    warn(`${dup.length} códigos repetidos na Olist (o sync precisa escolher um):`);
    for (const [codigo, ps] of dup) {
      console.log(`      ${(codigo || "(código vazio)").padEnd(12)} ${ps.length}×${bySku.has(codigo) ? " — está no catálogo!" : ""}`);
      ps.slice(0, 4).forEach((x) => console.log(`        id ${String(x.id).padEnd(10)} ${situacaoLabel[x.situacao] ?? x.situacao}  ${x.nome.slice(0, 80)}`));
    }
  }
  const extra = produtos.filter((p) => p.situacao === "A" && !bySku.has(p.codigo));
  if (extra.length) {
    console.log(`    ativos na Olist fora do catálogo da Shopify (${extra.length})`);
    extra.slice(0, 15).forEach((p) => console.log(`      ${(p.codigo || "(sem código)").padEnd(12)} ${p.nome.slice(0, 90)}`));
    if (extra.length > 15) console.log(`      … e mais ${extra.length - 15}`);
  }

  title(`Estoque (${all ? "todos os SKUs do catálogo" : "amostra de até 30"})`);
  const sample = (all ? found : found.slice(0, 30)).map((c) => ({ c, p: byCodigo.get(c.sku)![0] }));
  const capturedAt = formatISO(new Date());
  const rows: { model: string; s: StockSnapshot }[] = [];
  for (const [i, { c, p }] of sample.entries()) {
    process.stdout.write(`\r  … ${i + 1}/${sample.length}`);
    try {
      const r = await olistPost<{ produto: OlistProdutoEstoque }>("produto.obter.estoque", { id: String(p.id) });
      rows.push({ model: c.model, s: normalizeEstoque(r.produto, capturedAt) });
    } catch (e) {
      fail(`${c.sku}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  process.stdout.write("\r");
  ok(`${rows.length} estoques lidos`);
  console.log(`    nível pelo disponível (mínimo ${settings.stockMin})`);
  list(tally(rows, (r) => stockLevel(r.s.disponivel)));
  ok(`com reserva: ${rows.filter((r) => r.s.reservado > 0).length}`);
  const negativos = rows.filter((r) => r.s.disponivel < 0);
  if (negativos.length) warn(`${negativos.length} com disponível negativo (reservado maior que o saldo)`);
  const fracionado = rows.filter((r) => !Number.isInteger(r.s.saldo));
  if (fracionado.length) warn(`${fracionado.length} com saldo fracionado`);
  // um produto pode estar em vários depósitos; o painel precisa saber se `saldo` já é a soma dos que contam
  const deposits = [...new Set(rows.flatMap((r) => r.s.depositos.map((d) => d.nome)))].sort();
  console.log("    depósitos (soma no período lido)");
  for (const nome of deposits) {
    const ds = rows.flatMap((r) => r.s.depositos.filter((d) => d.nome === nome));
    const total = ds.reduce((a, d) => a + d.saldo, 0);
    console.log(`      ${nome.padEnd(14)} ${String(total).padStart(6)}${ds[0]?.desconsiderar ? "  (desconsiderado pela Olist)" : ""}`);
  }
  const somaBate = rows.filter((r) => r.s.saldo === r.s.depositos.filter((d) => !d.desconsiderar).reduce((a, d) => a + d.saldo, 0));
  (somaBate.length === rows.length ? ok : warn)(`saldo = soma dos depósitos que contam em ${somaBate.length}/${rows.length}`);

  console.log("    por coleção: crítico / atenção / ok");
  for (const col of [...new Set(rows.map((r) => bySku.get(r.s.sku)?.collection ?? "—"))].sort()) {
    const rs = rows.filter((r) => (bySku.get(r.s.sku)?.collection ?? "—") === col);
    const c = (lvl: string) => rs.filter((r) => stockLevel(r.s.disponivel) === lvl).length;
    console.log(`      ${col.padEnd(12)} ${String(c("critico")).padStart(3)} / ${String(c("atencao")).padStart(3)} / ${String(c("ok")).padStart(3)}`);
  }

  const header = ["SKU", "saldo", "res", "disp", ...deposits.map((d) => d.slice(0, 8))].join(" · ");
  console.log(`    ${header} · modelo`);
  rows
    .sort((a, b) => a.s.disponivel - b.s.disponivel)
    .forEach((r) => {
      const dep = deposits.map((nome) => String(r.s.depositos.find((d) => d.nome === nome)?.saldo ?? "—").padStart(Math.max(4, Math.min(8, nome.length))));
      console.log(`      ${r.s.sku.padEnd(12)} ${String(r.s.saldo).padStart(5)} ${String(r.s.reservado).padStart(4)} ${String(r.s.disponivel).padStart(5)} ${dep.join(" ")}  ${r.model}`);
    });
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof OlistError ? `Erro Olist: ${e.message}` : e);
  process.exitCode = 1;
});
