/**
 * Subconjunto da Olist ERP API v3 (ex-Tiny). Nomes idênticos aos da API.
 * Base: https://api.tiny.com.br/public-api/v3  (Bearer token via OAuth2)
 * GET /produtos            -> { itens: OlistProduto[], paginacao }
 * GET /estoque/{idProduto} -> OlistEstoque
 * Docs: https://api-docs.erp.olist.com/api-reference/produtos/listar-produtos
 *       https://api-docs.erp.olist.com/api-reference/estoque/obter-o-estoque-de-um-produto
 */

export type OlistProduto = {
  id: number;
  sku: string;
  descricao: string;
  tipo: "K" | "S" | "V" | "F" | "M";       // kit, simples, variação, fabricado, matéria-prima
  situacao: "A" | "I" | "E";               // ativo, inativo, excluído
  dataCriacao: string | null;
  dataAlteracao: string | null;
  unidade: string;
  gtin: string;
  precos: { preco: number | null; precoPromocional: number | null; precoCusto: number | null; precoCustoMedio: number | null };
  estoque: { localizacao: string | null };
  tipoVariacao: "N" | "P" | "V" | null;
};

export type OlistDeposito = {
  id: number;
  nome: string;
  desconsiderar: boolean;
  saldo: number;
  reservado: number;
  disponivel: number;
  empresa: string;
};

export type OlistEstoque = {
  id: number;
  nome: string;
  codigo: string;          // = sku
  unidade: string;
  saldo: number;
  reservado: number;
  disponivel: number;
  localizacao: string | null;
  depositos: OlistDeposito[];
};

/** Um snapshot = produto + estoque no momento do sync. */
export type StockSnapshot = {
  capturedAt: string;
  produto: OlistProduto;
  estoque: OlistEstoque;
};
