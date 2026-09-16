const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlCents = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const fmtBRL = (n: number) => brl.format(n);
export const fmtBRLCents = (n: number) => brlCents.format(n);
export const fmtNum = (n: number) => num.format(n);
export const fmtCompact = (n: number) => compact.format(n);
export const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(".", ",")}%`;
export const fmtX = (n: number) => `${n.toFixed(2).replace(".", ",")}×`;
export const fmtBRLCompact = (n: number) => (Math.abs(n) >= 1000 ? `R$ ${compact.format(n)}` : brl.format(n));
/** variação relativa; null quando não há base de comparação */
export const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
