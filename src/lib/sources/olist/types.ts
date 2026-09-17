/**
 * Subconjunto da Olist ERP API v2 (ex-Tiny), que é a que o painel usa. Nomes idênticos aos da API.
 * A v3 (OAuth2) fica em `types-v3.ts` como caminho alternativo — ver docs/04-olist.md.
 *
 * POST https://api.tiny.com.br/api2/produtos.pesquisa.php       -> { retorno: { produtos: [{ produto }] } }
 * POST https://api.tiny.com.br/api2/produto.obter.estoque.php   -> { retorno: { produto } }
 * Docs: https://tiny.com.br/api-docs/api2-produtos-pesquisar
 *       https://tiny.com.br/api-docs/api2-produtos-estoque
 *
 * Diferenças da v2 para a v3 que importam aqui:
 *   - o SKU chama `codigo` (na v3 é `sku`)
 *   - o reservado chama `saldoReservado` e **não existe `disponivel`**: o painel calcula saldo − reservado
 *   - os depósitos vêm embrulhados em `{ deposito: {...} }` e não trazem reservado nem disponível
 *   - números podem vir como string
 */

export type OlistNumero = number | string;

/** item de `produtos.pesquisa` */
export type OlistProduto = {
  id: OlistNumero;
  nome: string;
  codigo: string;               // = SKU
  preco: OlistNumero;
  preco_promocional?: OlistNumero;
  preco_custo?: OlistNumero;
  preco_custo_medio?: OlistNumero;
  unidade: string;
  gtin: string;
  tipoVariacao: string;         // N, P, V
  localizacao: string;
  situacao: string;             // A ativo, I inativo, E excluído
  data_criacao: string;         // dd/mm/aaaa hh:mm:ss
};

export type OlistDeposito = {
  nome: string;
  desconsiderar: boolean | string;
  saldo: OlistNumero;
  empresa: string;
};

/** resposta de `produto.obter.estoque` */
export type OlistProdutoEstoque = {
  id: OlistNumero;
  nome: string;
  codigo: string;
  unidade: string;
  saldo: OlistNumero;
  saldoReservado: OlistNumero;
  depositos: { deposito: OlistDeposito }[];
};

/** Posição de estoque de um SKU no momento do sync, já normalizada para o painel. */
export type StockSnapshot = {
  capturedAt: string;
  /** id do produto na Olist */
  idOlist: number;
  sku: string;
  nome: string;
  saldo: number;
  reservado: number;
  /** saldo − reservado (a v2 não devolve esse campo pronto) */
  disponivel: number;
  depositos: { nome: string; empresa: string; desconsiderar: boolean; saldo: number }[];
};

const num = (v: OlistNumero | undefined | null): number => (typeof v === "number" ? v : Number(String(v ?? "0").replace(",", ".")) || 0);
const bool = (v: boolean | string): boolean => v === true || v === "S" || v === "true";

/** `produto.obter.estoque` → StockSnapshot */
export function normalizeEstoque(e: OlistProdutoEstoque, capturedAt: string): StockSnapshot {
  const saldo = num(e.saldo);
  const reservado = num(e.saldoReservado);
  return {
    capturedAt,
    idOlist: num(e.id),
    sku: e.codigo,
    nome: e.nome,
    saldo,
    reservado,
    disponivel: saldo - reservado,
    depositos: (e.depositos ?? []).map(({ deposito: d }) => ({ nome: d.nome, empresa: d.empresa, desconsiderar: bool(d.desconsiderar), saldo: num(d.saldo) })),
  };
}
