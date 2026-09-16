/**
 * Catálogo de modelos CIGA — o "de-para" entre SKU e modelo/coleção.
 * Chave de junção entre Shopify (lineItems.sku), Olist (produto.sku) e a plataforma antiga.
 * Imagens apontam para o wiki oficial (asset do próprio cliente).
 */
export type Collection = "Blue Planet" | "Hunter" | "Everest" | "Zodiac" | "Skeleton" | "Aventur" | "Edge";

export type CatalogItem = {
  sku: string;
  model: string;
  collection: Collection;
  /** preço de tabela em BRL, usado só no mock */
  price: number;
  image: string;
  /** slug da página no wiki */
  slug: string;
};

const WIKI = "https://wiki.usecigadesign.com.br";

export const catalog: CatalogItem[] = [
  { sku: "CIGA-BP2-ATL", model: "Blue Planet II Atlantic", collection: "Blue Planet", price: 8990, slug: "blue-planet-atlantic", image: `${WIKI}/blue-planet-atlantic/imagens/produto-oficial.jpg` },
  { sku: "CIGA-BP2-BLK", model: "Blue Planet II Black Star", collection: "Blue Planet", price: 8990, slug: "blue-planet-black-star", image: `${WIKI}/blue-planet-black-star/imagens/produto-oficial.jpg` },
  { sku: "CIGA-BP2-GLD", model: "Blue Planet II Gilded Age", collection: "Blue Planet", price: 9990, slug: "blue-planet-ii-gilded-age", image: `${WIKI}/blue-planet-ii-gilded-age/imagens/gildedAge_1.jpg` },
  { sku: "CIGA-BP-STD", model: "Blue Planet", collection: "Blue Planet", price: 7490, slug: "cigaBluePlanet", image: `${WIKI}/imagens/blueplanet_1.webp` },
  { sku: "CIGA-HUN-STD", model: "Hunter", collection: "Hunter", price: 3290, slug: "hunter", image: `${WIKI}/hunter/imagens/hunter_1.jpg` },
  { sku: "CIGA-HUN-TI", model: "Hunter Titanium", collection: "Hunter", price: 4190, slug: "hunter-titanium", image: `${WIKI}/hunter-titanium/imagens/produto-oficial.jpg` },
  { sku: "CIGA-HUN-TB", model: "Hunter Tourbillon", collection: "Hunter", price: 12900, slug: "hunter-tourbillon", image: `${WIKI}/hunter-tourbillon/imagens/produto-oficial.jpg` },
  { sku: "CIGA-HUN-VIN", model: "Hunter Vintage", collection: "Hunter", price: 3490, slug: "hunter-vintage", image: `${WIKI}/hunter-vintage/imagens/produto-oficial.jpg` },
  { sku: "CIGA-EVR-SUM", model: "Everest Summit", collection: "Everest", price: 5490, slug: "everest-summit", image: `${WIKI}/everest-summit/imagens/produto-oficial.jpg` },
  { sku: "CIGA-EVR-70", model: "Everest 70th Anniversary", collection: "Everest", price: 6290, slug: "everest-70th-anniversary", image: `${WIKI}/everest-70th-anniversary/imagens/produto-oficial.jpg` },
  { sku: "CIGA-ZOD-DRG", model: "Zodiac Dragon", collection: "Zodiac", price: 4790, slug: "zodiac-dragon", image: `${WIKI}/zodiac-dragon/imagens/produto-oficial.jpg` },
  { sku: "CIGA-ZOD-HRS", model: "Zodiac Horse", collection: "Zodiac", price: 4790, slug: "zodiac-horse", image: `${WIKI}/zodiac-horse/imagens/produto-oficial.jpg` },
  { sku: "CIGA-SKL-STD", model: "Skeleton", collection: "Skeleton", price: 2890, slug: "skeleton", image: `${WIKI}/skeleton/imagens/skeleton_1.webp` },
  { sku: "CIGA-SKL-EDX", model: "Skeleton Edge Exploration", collection: "Skeleton", price: 3690, slug: "skeleton-edge-exploration", image: `${WIKI}/skeleton-edge-exploration/imagens/edgeExploration_1.jpg` },
  { sku: "CIGA-EDG-STD", model: "Edge", collection: "Edge", price: 2690, slug: "edge", image: `${WIKI}/edge/imagens/edge_1.jpg` },
  { sku: "CIGA-AVT-HOR", model: "Eye of Horus", collection: "Aventur", price: 5990, slug: "eye-of-horus", image: `${WIKI}/eye-of-horus/imagens/eyeOfHorus_1.jpg` },
  { sku: "CIGA-AVT-SRP", model: "Legend of Serpent", collection: "Aventur", price: 5990, slug: "legend-of-serpent", image: `${WIKI}/legend-of-serpent/imagens/s1.webp` },
  { sku: "CIGA-AVT-MAG", model: "Magician", collection: "Aventur", price: 6490, slug: "magician", image: `${WIKI}/magician/imagens/m1.webp` },
  { sku: "CIGA-AVT-JAD", model: "Eastern Jade", collection: "Aventur", price: 5490, slug: "eastern-jade", image: `${WIKI}/eastern-jade/imagens/easternJade_1.jpg` },
  { sku: "CIGA-AVT-MCH", model: "Machina", collection: "Aventur", price: 4990, slug: "machina", image: `${WIKI}/machina/imagens/machina_1.jpg` },
  { sku: "CIGA-AVT-GOR", model: "Gorilla", collection: "Aventur", price: 3990, slug: "gorilla", image: `${WIKI}/gorilla/imagens/g1.webp` },
  { sku: "CIGA-AVT-ICE", model: "Ice Age", collection: "Aventur", price: 4290, slug: "ice-age", image: `${WIKI}/ice-age/imagens/i1.webp` },
  { sku: "CIGA-AVT-FAL", model: "Falcon", collection: "Aventur", price: 4490, slug: "falcon", image: `${WIKI}/falcon/imagens/produto-oficial.jpg` },
  { sku: "CIGA-AVT-MWK", model: "Moon Walker", collection: "Aventur", price: 5290, slug: "moon-walker", image: `${WIKI}/moon-walker/imagens/produto-oficial.jpg` },
  { sku: "CIGA-AVT-TCP", model: "Time Cipher", collection: "Aventur", price: 4690, slug: "time-cipher", image: `${WIKI}/time-cipher/imagens/produto-oficial.jpg` },
  { sku: "CIGA-AVT-VEC", model: "Vector", collection: "Aventur", price: 3890, slug: "vector", image: `${WIKI}/vector/imagens/produto-oficial.jpg` },
];

export const bySku = new Map(catalog.map((c) => [c.sku, c]));
export const collections: Collection[] = ["Blue Planet", "Hunter", "Everest", "Zodiac", "Skeleton", "Aventur", "Edge"];
