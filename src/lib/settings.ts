/** Parâmetros de negócio. Em produção viram a tabela `settings`; aqui são os defaults. */
export const settings = {
  /** mínimo em estoque; abaixo disso é crítico, igual é atenção */
  stockMin: 5,
  /** data em que a loja passou a operar na Shopify; antes disso, dados da plataforma antiga */
  cutoverDate: "2026-06-01",
  legacyPlatformName: "plataforma antiga",
  /** janela para considerar um checkout abandonado "recuperável" */
  abandonedCartWindowDays: 14,
  /** gasto mínimo para uma campanha entrar no ranking de melhor campanha */
  bestCampaignMinSpend: 100,
  timeZone: "America/Sao_Paulo",
  currency: "BRL",
} as const;
