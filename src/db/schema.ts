/**
 * Schema Postgres (Drizzle). Espelha os tipos de `src/lib/sources/*`: os syncs gravam aqui,
 * o painel lê daqui. Colunas mantêm o nome do campo de origem para o de-para ser óbvio.
 */
import { boolean, date, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const orderSource = pgEnum("order_source", ["shopify", "legacy"]);
export const adPlatform = pgEnum("ad_platform", ["meta", "google"]);
export const syncSource = pgEnum("sync_source", ["shopify", "olist", "meta", "google", "legacy"]);

export const products = pgTable("products", {
  sku: text("sku").primaryKey(),
  model: text("model").notNull(),
  collection: text("collection").notNull(),
  imageUrl: text("image_url"),
  shopifyProductId: text("shopify_product_id"),
  olistProductId: integer("olist_product_id"),
});

/** Shopify Order (+ legado no mesmo formato) */
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),                       // gid://shopify/Order/… ou legacy:…
  name: text("name").notNull(),
  source: orderSource("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  displayFinancialStatus: text("display_financial_status").notNull(),
  displayFulfillmentStatus: text("display_fulfillment_status").notNull(),
  currentTotalPrice: numeric("current_total_price", { precision: 12, scale: 2 }).notNull(),
  totalDiscounts: numeric("total_discounts", { precision: 12, scale: 2 }).notNull().default("0"),
  totalRefunded: numeric("total_refunded", { precision: 12, scale: 2 }).notNull().default("0"),
  currencyCode: text("currency_code").notNull().default("BRL"),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  // customerJourneySummary.lastVisit.utmParameters — liga pedido ↔ campanha de mídia
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  raw: text("raw"),                                   // JSON original, para reprocessar
});

export const orderLineItems = pgTable("order_line_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  sku: text("sku"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  originalTotal: numeric("original_total", { precision: 12, scale: 2 }).notNull(),
  discountedTotal: numeric("discounted_total", { precision: 12, scale: 2 }).notNull(),
});

/** Shopify AbandonedCheckout */
export const abandonedCheckouts = pgTable("abandoned_checkouts", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  abandonedCheckoutUrl: text("abandoned_checkout_url").notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  lineItems: text("line_items").notNull(),            // JSON [{sku,title,quantity}]
});

/** Olist /estoque/{id} — uma linha por SKU por sync (histórico de posição) */
export const stockSnapshots = pgTable("stock_snapshots", {
  sku: text("sku").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  olistProductId: integer("olist_product_id").notNull(),
  nome: text("nome").notNull(),
  saldo: numeric("saldo", { precision: 12, scale: 3 }).notNull(),
  reservado: numeric("reservado", { precision: 12, scale: 3 }).notNull(),
  disponivel: numeric("disponivel", { precision: 12, scale: 3 }).notNull(),
  depositos: text("depositos"),                       // JSON
}, (t) => [primaryKey({ columns: [t.sku, t.capturedAt] })]);

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),                        // meta:123 | google:456
  platform: adPlatform("platform").notNull(),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),                   // active | paused | ended
  objective: text("objective"),
});

export const adDaily = pgTable("ad_daily", {
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  spend: numeric("spend", { precision: 12, scale: 2 }).notNull(),
  impressions: integer("impressions").notNull(),
  clicks: integer("clicks").notNull(),
  purchases: numeric("purchases", { precision: 10, scale: 2 }).notNull(),
  revenue: numeric("revenue", { precision: 12, scale: 2 }).notNull(),
}, (t) => [primaryKey({ columns: [t.campaignId, t.date] })]);

export const syncRuns = pgTable("sync_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: syncSource("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok").notNull().default(false),
  rows: integer("rows").notNull().default(0),
  error: text("error"),
});

export const appSettings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
