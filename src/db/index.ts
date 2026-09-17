import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let instance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Conexão preguiçosa com o Postgres do Supabase: só cria quando DATABASE_URL existe. Sem ela, o painel fica em mock.
 * Na Vercel use a URL do *Transaction pooler* (porta 6543); esse modo não aceita prepared statements, daí `prepare: false`.
 * Uma instância por processo, reaproveitada entre invocações da função.
 */
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida — painel rodando em mock.");
  instance ??= drizzle({ client: postgres(url, { prepare: false }), schema });
  return instance;
}
