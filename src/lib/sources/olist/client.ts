/**
 * Cliente da Olist ERP API v2 (ex-Tiny). Só roda no servidor (sync e scripts).
 *
 * Autenticação: token fixo da conta em `OLIST_TOKEN` (não expira; trocar pelo painel da Olist se vazar).
 * Base: https://api.tiny.com.br/api2/<endpoint>.php  ·  docs: https://tiny.com.br/api-docs/api
 *
 * Particularidades da v2 que este cliente resolve:
 *   - erro vem com HTTP 200 e `retorno.status = "Erro"`; vira exceção aqui
 *   - limite por minuto depende do plano (30 a 120); o header `x-limit-api` diz qual é.
 *     Para não estourar, as chamadas são serializadas com um intervalo mínimo entre elas.
 */
const API = "https://api.tiny.com.br/api2";

export class OlistError extends Error {
  constructor(message: string, readonly codigoErro?: number) {
    super(message);
    this.name = "OlistError";
  }
}

export type OlistRetorno<T> = { retorno: { status_processamento: number; status: "OK" | "Erro"; codigo_erro?: number; erros?: { erro: string }[] } & T };

/** chamadas por minuto assumidas quando o header ainda não chegou (plano mais baixo com API) */
let callsPerMinute = 30;
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** serializa as chamadas e respeita o intervalo mínimo entre elas */
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const gap = Math.ceil(60_000 / callsPerMinute) + 100;
    const wait = lastCall + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

export function olistToken(): string {
  const token = process.env.OLIST_TOKEN;
  if (!token) throw new OlistError("OLIST_TOKEN não definida (token da API v2 da Olist).");
  return token;
}

/** POST em um endpoint da v2; devolve o conteúdo de `retorno` já validado */
export async function olistPost<T>(endpoint: string, params: Record<string, string | number | undefined> = {}, maxRetries = 4): Promise<OlistRetorno<T>["retorno"]> {
  const body = new URLSearchParams({ token: olistToken(), formato: "json" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));

  for (let attempt = 0; ; attempt++) {
    const res = await queued(() =>
      fetch(`${API}/${endpoint}.php`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }),
    );
    const limit = Number(res.headers.get("x-limit-api"));
    if (limit > 0) callsPerMinute = limit;

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      await sleep(2 ** attempt * 2000);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new OlistError(`Olist respondeu ${res.status} em ${endpoint}: ${text.slice(0, 200)}`);

    const json = JSON.parse(text) as OlistRetorno<T>;
    const r = json.retorno;
    if (r.status === "Erro") {
      const msg = r.erros?.map((e) => e.erro).join("; ") ?? `código ${r.codigo_erro}`;
      // 20 = "a consulta não retornou registros"; o chamador decide se isso é erro
      throw new OlistError(`${endpoint}: ${msg}`, r.codigo_erro);
    }
    return r;
  }
}

/** percorre um endpoint paginado da v2 (`produtos.pesquisa`, 100 registros por página) */
export async function olistPaginate<N>(
  endpoint: string,
  key: string,
  params: Record<string, string | number | undefined> = {},
  opts: { maxPages?: number; onPage?: (count: number, pages: number) => void } = {},
): Promise<N[]> {
  const out: N[] = [];
  let pages = 1;
  for (let pagina = 1; pagina <= Math.min(pages, opts.maxPages ?? Infinity); pagina++) {
    let r: Record<string, unknown> & { numero_paginas?: number };
    try {
      r = await olistPost<Record<string, unknown>>(endpoint, { ...params, pagina });
    } catch (e) {
      if (e instanceof OlistError && e.codigoErro === 20) break; // sem registros nesta página
      throw e;
    }
    pages = r.numero_paginas ?? 1;
    out.push(...((r[key] as N[] | undefined) ?? []));
    opts.onPage?.(out.length, pages);
  }
  return out;
}
