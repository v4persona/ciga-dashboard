/**
 * Cliente do Shopify Admin GraphQL. Só roda no servidor (sync e scripts), nunca no front.
 *
 * Duas formas de credencial, nesta ordem:
 *   1. SHOPIFY_ADMIN_TOKEN — token fixo (shpat_…) de app personalizado criado no admin antes de 2026.
 *   2. SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET — app do Dev Dashboard. Troca por um token de 24h
 *      via client credentials grant; o token fica em memória e é renovado antes de expirar.
 *      https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 */

export type ShopifyConfig = { domain: string; apiVersion: string };

type GraphqlError = { message: string; extensions?: { code?: string } };
type ThrottleStatus = { maximumAvailable: number; currentlyAvailable: number; restoreRate: number };
type GraphqlResponse<T> = {
  data?: T;
  errors?: GraphqlError[];
  extensions?: { cost?: { requestedQueryCost: number; actualQueryCost: number | null; throttleStatus: ThrottleStatus } };
};

export class ShopifyError extends Error {
  constructor(message: string, readonly status?: number, readonly errors?: GraphqlError[]) {
    super(message);
    this.name = "ShopifyError";
  }
}

/**
 * Aceita o handle (`minha-loja`), o domínio (`minha-loja.myshopify.com`) ou a URL do admin
 * (`https://admin.shopify.com/store/minha-loja/`) e devolve sempre `<handle>.myshopify.com`.
 */
export function shopifyConfig(): ShopifyConfig {
  const raw = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!raw) throw new ShopifyError("SHOPIFY_STORE_DOMAIN não definida.");
  const host = raw
    .replace(/^https?:\/\//, "")
    .replace(/^admin\.shopify\.com\/store\//, "")
    .replace(/\/.*$/, "");
  const domain = host.includes(".") ? host : `${host}.myshopify.com`;
  return { domain, apiVersion: process.env.SHOPIFY_API_VERSION || "2026-01" };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(domain: string): Promise<string> {
  const fixed = process.env.SHOPIFY_ADMIN_TOKEN;
  if (fixed) return fixed;

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ShopifyError("Defina SHOPIFY_ADMIN_TOKEN ou SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET.");
  }
  // renova com 5 min de folga
  if (cachedToken && cachedToken.expiresAt - 5 * 60_000 > Date.now()) return cachedToken.value;

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    // a Shopify responde HTML; o código do erro vem no <title>, ex.: "400 - Oauth error app_not_installed"
    const body = await res.text();
    const code = body.match(/Oauth error (\w+)/)?.[1];
    const hints: Record<string, string> = {
      app_not_installed: "app não instalado nesta loja (Dev Dashboard → Home → Install app)",
    };
    const hint =
      res.status === 404 ? `loja não encontrada: confira SHOPIFY_STORE_DOMAIN (${domain})`
      : code ? `${code}${hints[code] ? `: ${hints[code]}` : ""}`
      : body.slice(0, 300);
    throw new ShopifyError(`Falha ao obter token (${res.status}): ${hint}`, res.status);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number; scope: string };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa uma query. Em THROTTLED ou HTTP 429 espera o balde de custo encher e tenta de novo.
 * Qualquer outro erro GraphQL vira ShopifyError com a lista original em `errors`.
 */
export async function shopifyGraphql<T>(query: string, variables: Record<string, unknown> = {}, maxRetries = 5): Promise<T> {
  const { domain, apiVersion } = shopifyConfig();
  const url = `https://${domain}/admin/api/${apiVersion}/graphql.json`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken(domain) },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 401 && cachedToken) {
      cachedToken = null; // token revogado ou expirado antes da hora
      if (attempt < maxRetries) continue;
    }
    if (res.status === 429 && attempt < maxRetries) {
      await sleep(2 ** attempt * 1000);
      continue;
    }
    if (!res.ok) throw new ShopifyError(`Shopify respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);

    const json = (await res.json()) as GraphqlResponse<T>;
    const throttled = json.errors?.some((e) => e.extensions?.code === "THROTTLED");
    if (throttled && attempt < maxRetries) {
      const cost = json.extensions?.cost;
      const missing = cost ? cost.requestedQueryCost - cost.throttleStatus.currentlyAvailable : 0;
      const wait = cost && missing > 0 ? Math.ceil(missing / cost.throttleStatus.restoreRate) * 1000 : 2 ** attempt * 1000;
      await sleep(wait);
      continue;
    }
    if (json.errors?.length) {
      throw new ShopifyError(json.errors.map((e) => e.message).join("; "), res.status, json.errors);
    }
    if (!json.data) throw new ShopifyError("Resposta sem data.", res.status);
    return json.data;
  }
}

type Connection<N> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: N[] };

/**
 * Percorre uma conexão paginada (`orders`, `abandonedCheckouts`…) e devolve todos os nós.
 * `pick` extrai a conexão da resposta, ex.: `(d) => d.orders`.
 */
export async function shopifyPaginate<D, N>(
  query: string,
  pick: (data: D) => Connection<N>,
  variables: Record<string, unknown> = {},
  opts: { pageSize?: number; maxPages?: number; onPage?: (count: number) => void } = {},
): Promise<N[]> {
  const out: N[] = [];
  let after: string | null = null;
  for (let page = 0; page < (opts.maxPages ?? Infinity); page++) {
    const data: D = await shopifyGraphql<D>(query, { ...variables, first: opts.pageSize ?? 100, after });
    const conn = pick(data);
    out.push(...conn.nodes);
    opts.onPage?.(out.length);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}
