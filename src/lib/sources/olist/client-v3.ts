/**
 * Cliente da Olist ERP API **v3** (OAuth2). Caminho alternativo, não usado hoje: o painel usa a v2 em `client.ts`.
 * Mantido porque a v3 é o caminho novo da Olist; ver docs/04-olist.md.
 *
 * Autenticação OAuth2 (Keycloak da Tiny), https://api-docs.erp.olist.com/documentacao/comecando/autenticacao
 *   - login uma vez no navegador (`npm run olist:auth`) → code → access token (4h) + refresh token (1 dia)
 *   - cada renovação devolve um refresh token novo; o anterior deixa de valer
 * Por isso o token não mora em variável de ambiente: fica num armazenamento que o próprio cliente atualiza.
 * Local: `.olist-token.json` (fora do git). Em produção isso vira uma linha no banco, e o sync precisa rodar
 * pelo menos uma vez por dia; se passar mais de 24h sem renovar, é preciso refazer o login.
 */
import { readFileSync, writeFileSync } from "node:fs";

export const OLIST_API = "https://api.tiny.com.br/public-api/v3";
const OIDC = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect";
const TOKEN_FILE = ".olist-token.json";

export class OlistError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OlistError";
  }
}

export type OlistTokens = { accessToken: string; accessExpiresAt: number; refreshToken: string; refreshExpiresAt: number };

type TokenResponse = { access_token: string; expires_in: number; refresh_token: string; refresh_expires_in: number };

export function olistCredentials() {
  const clientId = process.env.OLIST_CLIENT_ID;
  const clientSecret = process.env.OLIST_CLIENT_SECRET;
  const redirectUri = process.env.OLIST_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new OlistError("Defina OLIST_CLIENT_ID, OLIST_CLIENT_SECRET e OLIST_REDIRECT_URI.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function loadTokens(): OlistTokens | null {
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf8")) as OlistTokens;
  } catch {
    return null;
  }
}

function saveTokens(t: TokenResponse): OlistTokens {
  const now = Date.now();
  const tokens: OlistTokens = {
    accessToken: t.access_token,
    accessExpiresAt: now + t.expires_in * 1000,
    refreshToken: t.refresh_token,
    refreshExpiresAt: now + t.refresh_expires_in * 1000,
  };
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return tokens;
}

export function authorizeUrl(state: string) {
  const { clientId, redirectUri } = olistCredentials();
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "openid", response_type: "code", state });
  return `${OIDC}/auth?${q}`;
}

async function tokenRequest(body: Record<string, string>): Promise<OlistTokens> {
  const { clientId, clientSecret } = olistCredentials();
  const res = await fetch(`${OIDC}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new OlistError(`Falha no token (${res.status}): ${text.slice(0, 300)}`, res.status);
  return saveTokens(JSON.parse(text) as TokenResponse);
}

/** troca o `code` do callback pelo primeiro par de tokens */
export function exchangeCode(code: string) {
  const { redirectUri } = olistCredentials();
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

async function accessToken(forceRefresh = false): Promise<string> {
  const t = loadTokens();
  if (!t) throw new OlistError("Sem token da Olist. Rode `npm run olist:auth`.");
  // folga de 5 min
  if (!forceRefresh && t.accessExpiresAt - 5 * 60_000 > Date.now()) return t.accessToken;
  if (t.refreshExpiresAt <= Date.now()) {
    throw new OlistError("Refresh token da Olist expirou (mais de 1 dia sem renovar). Rode `npm run olist:auth` de novo.");
  }
  return (await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refreshToken })).accessToken;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET na API v3. Em 429 espera e tenta de novo (o limite varia por plano: 30 a 140 leituras por minuto);
 * em 401 renova o token uma vez.
 */
export async function olistGet<T>(path: string, params: Record<string, string | number | undefined> = {}, maxRetries = 5): Promise<T> {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  const url = `${OLIST_API}${path}${q.size ? `?${q}` : ""}`;
  let refreshed = false;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(refreshed)}`, Accept: "application/json" } });
    if (res.status === 401 && !refreshed) { refreshed = true; continue; }
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 2000);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new OlistError(`Olist respondeu ${res.status} em ${path}: ${text.slice(0, 300)}`, res.status);
    return JSON.parse(text) as T;
  }
}

/** percorre uma listagem paginada por limit/offset (`/produtos`, `/pedidos`…) */
export async function olistPaginate<N>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  opts: { limit?: number; maxPages?: number; onPage?: (count: number, total: number) => void } = {},
): Promise<N[]> {
  const limit = opts.limit ?? 100;
  const out: N[] = [];
  for (let page = 0; page < (opts.maxPages ?? Infinity); page++) {
    const r = await olistGet<{ itens: N[]; paginacao: { limit: number; offset: number; total: number } }>(path, { ...params, limit, offset: page * limit });
    out.push(...r.itens);
    opts.onPage?.(out.length, r.paginacao.total);
    if (r.itens.length < limit || out.length >= r.paginacao.total) break;
  }
  return out;
}
