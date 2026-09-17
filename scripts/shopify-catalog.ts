/**
 * Gera `src/lib/catalog.generated.ts` a partir dos produtos ativos da Shopify.
 * Rodar de novo sempre que a loja ganhar, perder ou renomear produtos:
 *
 *   npm run shopify:catalog
 *
 * Coleção vem das tags da loja (AVENTUR, EDGE, EVEREST, ZODIAC, outros, Straps).
 * O nome exibido é o título sem o prefixo "Relógio Masculino CIGA design" e sem a referência entre parênteses.
 */
import { writeFileSync } from "node:fs";
import { shopifyPaginate } from "@/lib/sources/shopify/client";
import type { CatalogItem, Collection } from "@/lib/catalog";

type Product = {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  featuredImage: { url: string } | null;
  variants: { nodes: { sku: string | null; price: string }[] };
};

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active", sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes { id title handle tags featuredImage { url } variants(first: 20) { nodes { sku price } } }
    }
  }
`;

/** tag da loja → coleção do painel; a primeira que casar vence */
const TAG_COLLECTION: [string, Collection][] = [
  ["straps", "Acessórios"],
  ["everest", "Everest"],
  ["zodiac", "Zodiac"],
  ["aventur", "Aventur"],
  ["edge", "Edge"],
  ["outros", "Outros"],
];

function collectionOf(tags: string[]): Collection {
  const lower = tags.map((t) => t.toLowerCase());
  return TAG_COLLECTION.find(([tag]) => lower.includes(tag))?.[1] ?? "Outros";
}

/** "Relógio Masculino CIGA design Edge Black (Z031-SISI-W15BK)" → { name: "Edge Black", reference: "Z031-SISI-W15BK" } */
function parseTitle(title: string, collection: Collection) {
  let rest = title.trim();
  const refInParens = rest.match(/\(([A-Z0-9]+-[A-Z0-9-]+)\)\s*$/);
  let reference = refInParens?.[1] ?? null;
  if (refInParens) rest = rest.slice(0, refInParens.index).trim();
  // alguns títulos trazem a referência solta: "Pulseira de relógio Ciga Design Z062-2G-BK-SS - Preta"
  const loose = rest.match(/\b([A-Z]\d{3}-[A-Z0-9-]+)\b/);
  if (!reference && loose) {
    reference = loose[1];
    rest = rest.replace(loose[0], "").replace(/\s+-\s+/, " ").trim();
  }
  let name = rest.replace(/^.*?ciga design\s+/i, "").trim();
  if (collection === "Acessórios") name = `Pulseira ${name}`;
  return { name, reference };
}

async function main() {
  const products = await shopifyPaginate<{ products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Product[] } }, Product>(
    PRODUCTS_QUERY,
    (d) => d.products,
    {},
    { pageSize: 50 },
  );

  const items: CatalogItem[] = [];
  const skipped: string[] = [];
  for (const p of products) {
    const collection = collectionOf(p.tags);
    const { name, reference } = parseTitle(p.title, collection);
    for (const v of p.variants.nodes) {
      if (!v.sku) { skipped.push(p.title); continue; }
      items.push({
        sku: v.sku,
        model: name,
        reference,
        collection,
        price: Number(v.price),
        // CDN da Shopify redimensiona pelo parâmetro width; a miniatura do painel tem ~40px
        image: p.featuredImage ? `${p.featuredImage.url}${p.featuredImage.url.includes("?") ? "&" : "?"}width=120` : "",
        handle: p.handle,
      });
    }
  }

  // nomes repetidos (ex.: dois "Gorilla Orange" com pulseiras diferentes) ganham a referência para distinguir;
  // pulseira sempre leva a referência, porque só a cor não identifica a peça nem a caixa em que ela serve
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.model, (counts.get(it.model) ?? 0) + 1);
  for (const it of items) {
    const ambiguous = (counts.get(it.model) ?? 0) > 1 || it.collection === "Acessórios";
    if (ambiguous && it.reference) it.model = `${it.model} · ${it.reference}`;
  }

  items.sort((a, b) => a.collection.localeCompare(b.collection) || a.model.localeCompare(b.model));

  const body = items.map((it) => `  ${JSON.stringify(it)},`).join("\n");
  const file = `/**
 * Gerado por \`npm run shopify:catalog\` a partir dos produtos ativos da Shopify. Não editar à mão.
 * ${items.length} SKUs · ${new Date().toISOString().slice(0, 10)}
 */
import type { CatalogItem } from "./catalog";

export const generatedCatalog: CatalogItem[] = [
${body}
];
`;
  writeFileSync("src/lib/catalog.generated.ts", file);

  const byCollection = new Map<string, number>();
  for (const it of items) byCollection.set(it.collection, (byCollection.get(it.collection) ?? 0) + 1);
  console.log(`${items.length} SKUs → src/lib/catalog.generated.ts`);
  console.log([...byCollection].map(([c, n]) => `  ${c}: ${n}`).join("\n"));
  if (skipped.length) console.log(`sem SKU (fora do catálogo): ${skipped.join("; ")}`);
  const noRef = items.filter((it) => !it.reference);
  if (noRef.length) console.log(`sem referência no título: ${noRef.map((it) => it.model).join("; ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
