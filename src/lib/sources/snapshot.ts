/**
 * Snapshot local: o "banco" provisório enquanto o Supabase não existe.
 * `npm run pull` grava `data/snapshot.json`; `getDashboardData()` lê daqui quando o arquivo existe.
 * Quando o Postgres entrar, só a leitura muda — o formato aqui é o mesmo que as tabelas vão guardar.
 */
import type { SessionDaily, ShopifyAbandonedCheckout, ShopifyOrder } from "./shopify/types";
import type { OlistCatalogItem, StockSnapshot } from "./olist/types";

export type Snapshot = {
  /** quando o pull rodou */
  pulledAt: string;
  /** data inicial dos pedidos puxados */
  since: string;
  orders: ShopifyOrder[];
  abandonedCheckouts: ShopifyAbandonedCheckout[];
  sessions: SessionDaily[];
  stock: StockSnapshot[];
  /** produto correspondente na Olist, para comparar cadastro com a Shopify */
  olistCatalog: OlistCatalogItem[];
};

export const SNAPSHOT_PATH = "data/snapshot.json";

/**
 * Lê o snapshot do disco. Devolve null quando não existe (painel cai no mock).
 * Só roda no servidor; o import de `node:fs` é dinâmico para não vazar para o bundle do cliente.
 */
export async function readSnapshot(): Promise<Snapshot | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}
