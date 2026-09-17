/**
 * Login na Olist: abre um servidor local na porta de OLIST_REDIRECT_URI, mostra o link de autorização,
 * recebe o callback e grava os tokens em `.olist-token.json`.
 *
 *   npm run olist:auth
 *
 * Precisa ser refeito se passar mais de 1 dia sem nenhuma chamada à API (o refresh token expira).
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { authorizeUrl, exchangeCode, olistCredentials, OlistError } from "@/lib/sources/olist/client-v3";

let redirectUri: string;
try {
  ({ redirectUri } = olistCredentials());
} catch (e) {
  console.error(e instanceof OlistError ? e.message : e);
  process.exit(1);
}
const callback = new URL(redirectUri);
if (!["localhost", "127.0.0.1"].includes(callback.hostname)) {
  console.error(`OLIST_REDIRECT_URI precisa apontar para localhost para este script (atual: ${redirectUri}).`);
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:sans-serif;background:#050505;color:#fff;padding:48px"><h1 style="color:#C9A962;font-weight:400">${title}</h1><p>${body}</p></body>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirectUri);
  if (url.pathname !== callback.pathname) {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code || url.searchParams.get("state") !== state) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(page("Falhou", error ?? "code ou state ausente/inválido"));
    console.error(`✗ callback inválido: ${error ?? "code/state"}`);
    server.close();
    process.exitCode = 1;
    return;
  }
  try {
    const t = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page("Olist conectada", "Pode fechar esta aba e voltar ao terminal."));
    console.log(`✓ tokens gravados em .olist-token.json · access até ${new Date(t.accessExpiresAt).toLocaleString("pt-BR")} · refresh até ${new Date(t.refreshExpiresAt).toLocaleString("pt-BR")}`);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" }).end(page("Falhou", "Veja o terminal."));
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
  server.close();
});

server.listen(Number(callback.port || 80), callback.hostname, () => {
  console.log("Abra este link no navegador e entre com o usuário da Olist da CIGA:\n");
  console.log(authorizeUrl(state));
  console.log(`\nAguardando retorno em ${redirectUri} …`);
});
