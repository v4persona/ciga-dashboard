/**
 * Subconjunto do Shopify Admin GraphQL API (versão 2026-01) usado pelo painel.
 * Nomes de campo idênticos aos da API para que o sync real devolva exatamente este tipo.
 * Docs: https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Order
 *       https://shopify.dev/docs/api/admin-graphql/2026-01/objects/AbandonedCheckout
 */

export type MoneyBag = { shopMoney: { amount: string; currencyCode: string } };

/** https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Count */
export type Count = { count: number; precision: "AT_LEAST" | "EXACT" };

export type OrderDisplayFinancialStatus =
  | "AUTHORIZED" | "EXPIRED" | "PAID" | "PARTIALLY_PAID" | "PARTIALLY_REFUNDED"
  | "PENDING" | "REFUNDED" | "VOIDED";

export type OrderDisplayFulfillmentStatus =
  | "FULFILLED" | "IN_PROGRESS" | "ON_HOLD" | "OPEN" | "PARTIALLY_FULFILLED"
  | "PENDING_FULFILLMENT" | "REQUEST_DECLINED" | "RESTOCKED" | "SCHEDULED" | "UNFULFILLED";

export type ShopifyLineItem = {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  originalTotalSet: MoneyBag;
  discountedTotalSet: MoneyBag;
};

/** Parâmetros UTM da visita — https://shopify.dev/docs/api/admin-graphql/2026-01/objects/UTMParameters */
export type UTMParameters = {
  campaign: string | null;
  content: string | null;
  medium: string | null;
  source: string | null;
  term: string | null;
};

/** https://shopify.dev/docs/api/admin-graphql/2026-01/objects/CustomerVisit */
export type CustomerVisit = {
  occurredAt: string;
  source: string;                 // ex.: "facebook", "google", "direct"
  landingPage: string | null;
  utmParameters: UTMParameters | null;
};

/**
 * Jornada do cliente até o pedido. `ready = false` quando a Shopify ainda não processou a atribuição
 * (acontece nas primeiras horas). `lastVisit` é a visita que converteu; é a que usamos para ligar
 * pedido ↔ campanha. https://shopify.dev/docs/api/admin-graphql/2026-01/objects/CustomerJourneySummary
 */
export type CustomerJourneySummary = {
  ready: boolean;
  momentsCount: Count | null;
  firstVisit: CustomerVisit | null;
  lastVisit: CustomerVisit | null;
};

export type ShopifyOrder = {
  id: string;            // gid://shopify/Order/123
  name: string;          // "#1001"
  createdAt: string;     // ISO 8601
  processedAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: OrderDisplayFinancialStatus;
  displayFulfillmentStatus: OrderDisplayFulfillmentStatus;
  currentTotalPriceSet: MoneyBag;   // total após edições/reembolsos
  totalDiscountsSet: MoneyBag;
  totalRefundedSet: MoneyBag;
  customer: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  lineItems: { nodes: ShopifyLineItem[] };
  /** null para pedidos da plataforma antiga (sem jornada rastreada) */
  customerJourneySummary: CustomerJourneySummary | null;
  /**
   * Campo próprio (não existe na Shopify): origem do registro.
   * 'legacy' = importado da plataforma antiga com o mesmo formato.
   */
  source: "shopify" | "legacy";
};

export type ShopifyAbandonedCheckout = {
  id: string;            // gid://shopify/AbandonedCheckout/123
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;   // null = ainda abandonado
  abandonedCheckoutUrl: string;
  totalPriceSet: MoneyBag;
  customer: { firstName: string | null; lastName: string | null; email: string | null } | null;
  lineItems: { nodes: Pick<ShopifyLineItem, "id" | "sku" | "title" | "quantity">[] };
};

/** Query que o sync real vai enviar ao endpoint /admin/api/2026-01/graphql.json */
export const ORDERS_QUERY = /* GraphQL */ `
  query Orders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name createdAt processedAt cancelledAt
        displayFinancialStatus displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        totalDiscountsSet { shopMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } }
        customer { id firstName lastName email }
        customerJourneySummary {
          ready momentsCount { count precision }
          firstVisit { occurredAt source landingPage utmParameters { campaign content medium source term } }
          lastVisit { occurredAt source landingPage utmParameters { campaign content medium source term } }
        }
        lineItems(first: 50) {
          nodes {
            id sku title quantity
            originalTotalSet { shopMoney { amount currencyCode } }
            discountedTotalSet { shopMoney { amount currencyCode } }
          }
        }
      }
    }
  }
`;

export const ABANDONED_CHECKOUTS_QUERY = /* GraphQL */ `
  query AbandonedCheckouts($first: Int!, $after: String, $query: String) {
    abandonedCheckouts(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id createdAt updatedAt completedAt abandonedCheckoutUrl
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { firstName lastName email }
        lineItems(first: 20) { nodes { id sku title quantity } }
      }
    }
  }
`;
