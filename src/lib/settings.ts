/** Parâmetros de negócio. Em produção viram a tabela `settings`; aqui são os defaults. */
export const settings = {
  /**
   * mínimo em disponível (saldo − reservado); abaixo disso é crítico, igual é atenção.
   * Cliente confirmou 5 para todos os itens em 2026-09-17, incluindo acessórios; rever se a diferença
   * entre relógio de ticket alto e pulseira incomodar (ver docs/04-olist.md §3).
   */
  stockMin: 5,
  /** data em que a loja passou a operar na Shopify (primeiro pedido, confirmada com o cliente); antes disso, plataforma antiga */
  cutoverDate: "2026-08-27",
  legacyPlatformName: "plataforma antiga",
  /** janela para considerar um checkout abandonado "recuperável" */
  abandonedCartWindowDays: 14,
  /** gasto mínimo para uma campanha entrar no ranking de melhor campanha */
  bestCampaignMinSpend: 100,
  /**
   * Matriz do modelo: a partir de quantas vezes as compras alegadas pela plataforma superam
   * os pedidos rastreados por UTM, a atribuição é marcada como inflada
   */
  attributionInflationRatio: 2,
  /** valores de utm_source que identificam cada plataforma de mídia */
  utmSources: { meta: ["facebook", "instagram", "meta", "fb", "ig"], google: ["google", "adwords", "googleads"] },
  timeZone: "America/Sao_Paulo",
  currency: "BRL",
} as const;
