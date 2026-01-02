import { ColumnType, Generated } from "kysely";

export interface PlansTable {
  id: string;
  name: string;
  monthly_price_cents: number;
  order_limit: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface TenantsTable {
  id: Generated<string>;
  slug: string;
  domain: string | null;
  preview_domain: string;
  plan_id: string;
  billing_mode: "saas" | "selfhost" | "appsumo";
  timezone: string;
  theme_settings: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface TenantUsageTable {
  tenant_id: string;
  billing_month: string;
  order_count: number;
  last_reset: ColumnType<Date, string | undefined, never>;
}

export interface UsersTable {
  id: Generated<string>;
  tenant_id: string;
  email: string;
  password_hash: string | null;
  role: "owner" | "admin" | "support";
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface ApiKeysTable {
  id: Generated<string>;
  tenant_id: string;
  key_hash: string;
  label: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  last_used_at: ColumnType<Date | null, string | null | undefined, never>;
}

export interface ProductsTable {
  id: Generated<string>;
  tenant_id: string;
  title: string;
  handle: string;
  description: string | null;
  status: "draft" | "active";
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface ProductVariantsTable {
  id: Generated<string>;
  product_id: string;
  sku: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  option_values: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface OrdersTable {
  id: Generated<string>;
  tenant_id: string;
  status: "pending" | "paid" | "fulfilled" | "refunded" | "canceled";
  procurement_status: "none" | "pending" | "ordered" | "failed";
  total_cents: number;
  currency: string;
  metadata: unknown;
  payment_idempotency_key: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface MetricsDailyTable {
  tenant_id: string;
  day: string;
  orders: number;
  revenue_cents: number;
  aov_cents: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface MeteringEventsTable {
  tenant_id: string;
  order_id: string;
  occurred_at: ColumnType<Date, string | undefined, never>;
}

export interface UsageMonthlyTable {
  tenant_id: string;
  year: number;
  month: number;
  orders_paid: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface TenantSubscriptionsTable {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  plan_id: string | null;
  status: string | null;
  procurement_addon: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface SupplierAccountsTable {
  id: Generated<string>;
  tenant_id: string;
  provider: string;
  credentials: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ProductSourcesTable {
  id: Generated<string>;
  tenant_id: string;
  product_id: string;
  provider: string;
  source_url: string | null;
  external_id: string | null;
  metadata: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ExternalProcurementsTable {
  id: Generated<string>;
  tenant_id: string;
  order_id: string;
  provider: string;
  status: "pending" | "ordered" | "failed" | "skipped";
  metadata: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface WebhookSubscriptionsTable {
  id: Generated<string>;
  tenant_id: string;
  url: string;
  event: string;
  secret: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AuditLogsTable {
  id: Generated<string>;
  tenant_id: string;
  actor: string;
  action: string;
  entity: string | null;
  metadata: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ImportsTable {
  id: Generated<string>;
  tenant_id: string;
  source: string;
  status: "pending" | "processing" | "completed" | "failed";
  metadata: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  plans: PlansTable;
  tenants: TenantsTable;
  tenant_usage: TenantUsageTable;
  users: UsersTable;
  api_keys: ApiKeysTable;
  products: ProductsTable;
  product_variants: ProductVariantsTable;
  orders: OrdersTable;
  metrics_daily: MetricsDailyTable;
  metering_events: MeteringEventsTable;
  usage_monthly: UsageMonthlyTable;
  tenant_subscriptions: TenantSubscriptionsTable;
  supplier_accounts: SupplierAccountsTable;
  product_sources: ProductSourcesTable;
  external_procurements: ExternalProcurementsTable;
  webhook_subscriptions: WebhookSubscriptionsTable;
  audit_logs: AuditLogsTable;
  imports: ImportsTable;
}
