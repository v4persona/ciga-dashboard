import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/** Conexão preguiçosa: só cria quando DATABASE_URL existe. Sem ela, o painel fica em mock. */
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida — painel rodando em mock.");
  return drizzle(neon(url), { schema });
}
