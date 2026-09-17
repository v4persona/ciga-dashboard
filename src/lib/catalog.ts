/**
 * Catálogo CIGA — o "de-para" entre SKU e modelo/coleção.
 * Chave de junção entre Shopify (lineItems.sku), Olist (produto.sku) e a plataforma antiga.
 * Os itens vêm da Shopify via `npm run shopify:catalog` (src/lib/catalog.generated.ts); este arquivo só define o tipo e os índices.
 */
import { generatedCatalog } from "./catalog.generated";

/** tags da loja na Shopify; pulseiras (tag Straps) ficam em Acessórios */
export type Collection = "Aventur" | "Edge" | "Everest" | "Zodiac" | "Outros" | "Acessórios";

export type CatalogItem = {
  sku: string;
  /** nome exibido: título do produto sem prefixo e sem referência */
  model: string;
  /** referência CIGA que vem no título, ex.: Z031-SISI-W15BK */
  reference: string | null;
  collection: Collection;
  /** preço atual na loja, em BRL (o mock usa para gerar pedidos) */
  price: number;
  /** imagem destacada do produto na CDN da Shopify */
  image: string;
  /** handle do produto: usecigadesign.com.br/products/<handle> */
  handle: string;
};

export const catalog: CatalogItem[] = generatedCatalog;

export const bySku = new Map(catalog.map((c) => [c.sku, c]));
export const collections: Collection[] = ["Aventur", "Edge", "Everest", "Zodiac", "Outros", "Acessórios"];

const tokens = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Resolve o nome de uma campanha para os modelos que ela anuncia, pela convenção de nome da CIGA
 * (campanhas nomeadas por modelo). Para cada modelo conta quantos tokens iniciais do nome aparecem
 * na campanha; vencem os modelos com a maior contagem.
 *   "Hunter — Lançamento Titanium"  → [Hunter Titanium]
 *   "Blue Planet II — Conversão"    → [BP II Atlantic, BP II Black Star, BP II Gilded Age]
 *   "Performance Max — Relógios"    → []  (genérica: anuncia o catálogo todo)
 */
export function campaignTargets(campaignName: string): CatalogItem[] {
  const words = new Set(tokens(campaignName));
  let best = 0;
  const scored = catalog.map((c) => {
    const t = tokens(c.model);
    let k = 0;
    while (k < t.length && words.has(t[k])) k++;
    best = Math.max(best, k);
    return { c, k };
  });
  return best === 0 ? [] : scored.filter((s) => s.k === best).map((s) => s.c);
}
