import { sql } from "kysely";
import { withTenantContext } from "./db";
import nodemailer from "nodemailer";
import { config } from "./config";

export const GRACE_ORDERS = 10;

export async function ensureBillingAllowance(tenantId: string) {
  const usage = await withTenantContext(tenantId, (trx) =>
    trx
      .selectFrom("tenants")
      .innerJoin("plans", "plans.id", "tenants.plan_id")
      .leftJoin("usage_monthly", (join) =>
        join
          .onRef("usage_monthly.tenant_id", "=", "tenants.id")
          .on("usage_monthly.year", "=", getCurrentYear())
          .on("usage_monthly.month", "=", getCurrentMonth())
      )
      .select([
        "plans.order_limit as order_limit",
        "usage_monthly.orders_paid as orders_paid"
      ])
      .where("tenants.id", "=", tenantId)
      .executeTakeFirst()
  );

  if (!usage) {
    return { allowed: true, message: "Usage record missing; allowing", graceRemaining: GRACE_ORDERS };
  }

  const currentOrders = usage.orders_paid ?? 0;
  const graceLimit = (usage.order_limit ?? 0) + GRACE_ORDERS;

  if (usage.order_limit && currentOrders >= graceLimit) {
    return { allowed: false, message: "Order limit reached. Please upgrade.", graceRemaining: 0 };
  }

  const banner = usage.order_limit
    ? currentOrders >= usage.order_limit * 0.8
    : false;

  return {
    allowed: true,
    message: banner ? "Approaching plan order limit" : "OK",
    graceRemaining: usage.order_limit ? graceLimit - currentOrders : GRACE_ORDERS
  };
}

export async function logAudit(tenantId: string, action: string, metadata: Record<string, unknown>) {
  await withTenantContext(tenantId, (trx) =>
    trx
      .insertInto("audit_logs")
      .values({
        tenant_id: tenantId,
        actor: "system",
        action,
        entity: "app",
        metadata
      })
      .execute()
  );
}

export async function finalizeOrder(params: {
  tenantId: string;
  orderId: string;
  idempotencyKey?: string;
  provider?: string;
  providerRef?: string | null;
  procurementEnabled?: boolean;
}) {
  let finalized = false;
  let orderEmail: string | null = null;
  let orderTotal = 0;

  await withTenantContext(params.tenantId, async (trx) => {
    const order = await trx.selectFrom("orders").selectAll().where("id", "=", params.orderId).executeTakeFirst();
    if (!order) return;
    const metadata = (order.metadata as Record<string, unknown>) || {};

    if (order.status === "paid") {
      finalized = false;
      return;
    }

    const update = await trx
      .updateTable("orders")
      .set({
        status: "paid",
        payment_idempotency_key: params.idempotencyKey ?? order.payment_idempotency_key,
        metadata: {
          ...metadata,
          provider: params.provider ?? metadata.provider,
          provider_ref: params.providerRef ?? metadata.provider_ref
        }
      })
      .where("id", "=", params.orderId)
      .where((eb) =>
        eb.and([
          eb("status", "!=", "paid"),
          params.idempotencyKey
            ? eb.or([
                eb("payment_idempotency_key", "is", null),
                eb("payment_idempotency_key", "=", params.idempotencyKey)
              ])
            : eb.val(true)
        ])
      )
      .returningAll()
      .executeTakeFirst();

    if (!update) return;
    finalized = true;
    const meta = (update.metadata as Record<string, unknown>) || {};
    orderEmail = (meta.customer_email as string) || null;
    orderTotal = update.total_cents;
  });

  if (!finalized) return { alreadyFinalized: true };

  await logAudit(params.tenantId, "order.paid", {
    orderId: params.orderId,
    provider: params.provider,
    providerRef: params.providerRef
  });
  await recordMeteringEvent(params.tenantId, params.orderId);
  await rollupUsageMonthly(params.tenantId);
  await rollupMetrics(params.tenantId, params.orderId, orderTotal);
  await emitWebhook(params.tenantId, "order.paid", { orderId: params.orderId });
  await sendOrderEmail(params.tenantId, params.orderId, orderEmail ?? config.FROM_EMAIL);
  if (params.procurementEnabled) {
    await enqueueProcurement(params.tenantId, params.orderId);
  }
  return { finalized: true };
}

export async function sendOrderEmail(tenantId: string, orderId: string, to: string) {
  const transporter = nodemailer.createTransport(config.SMTP_URL);
  const mail = {
    from: config.FROM_EMAIL,
    to,
    subject: `Order ${orderId} confirmed`,
    text: `Thank you for your order. Order ID: ${orderId}. Tenant: ${tenantId}.`
  };
  await transporter.sendMail(mail);
}

export async function emitWebhook(tenantId: string, event: string, payload: Record<string, unknown>) {
  // Stub: real implementation would sign and dispatch to subscriber URLs.
  console.log(`[webhook] tenant=${tenantId} event=${event}`, payload);
}

export async function rollupMetrics(tenantId: string, range?: { from?: string; to?: string }) {
  await withTenantContext(tenantId, async (trx) => {
    let query = trx
      .selectFrom("orders")
      .select([
        sql<string>`date(orders.created_at)`.as("day"),
        sql<number>`count(*)`.as("orders"),
        sql<number>`sum(orders.total_cents)`.as("revenue_cents"),
        sql<number>`avg(orders.total_cents)`.as("aov_cents")
      ])
      .where("status", "=", "paid");

    if (range?.from) {
      query = query.where(sql`date(orders.created_at)`, ">=", range.from);
    }
    if (range?.to) {
      query = query.where(sql`date(orders.created_at)`, "<=", range.to);
    }

    const rows = await query.groupBy(sql`date(orders.created_at)`).execute();

    for (const row of rows) {
      await trx
        .insertInto("metrics_daily")
        .values({
          tenant_id: tenantId,
          day: row.day,
          orders: Number(row.orders),
          revenue_cents: Number(row.revenue_cents),
          aov_cents: Number(row.aov_cents)
        })
        .onConflict((oc) =>
          oc.columns(["tenant_id", "day"]).doUpdateSet({
            orders: Number(row.orders),
            revenue_cents: Number(row.revenue_cents),
            aov_cents: Number(row.aov_cents),
            updated_at: sql`now()`
          })
        )
        .execute();
    }
  });
}

export async function recordMeteringEvent(tenantId: string, orderId: string) {
  await withTenantContext(tenantId, (trx) =>
    trx
      .insertInto("metering_events")
      .values({
        tenant_id: tenantId,
        order_id: orderId
      })
      .onConflict((oc) => oc.columns(["tenant_id", "order_id"]).doNothing())
      .execute()
  );
}

export async function rollupUsageMonthly(tenantId: string) {
  const year = getCurrentYear();
  const month = getCurrentMonth();

  const count = await withTenantContext(tenantId, (trx) =>
    trx
      .selectFrom("metering_events")
      .select((eb) => eb.fn.count<number>("order_id").as("orders_paid"))
      .where("tenant_id", "=", tenantId)
      .where(sql`extract(year from occurred_at)`, "=", year)
      .where(sql`extract(month from occurred_at)`, "=", month)
      .executeTakeFirst()
  );

  const ordersPaid = Number(count?.orders_paid ?? 0);

  await withTenantContext(tenantId, (trx) =>
    trx
      .insertInto("usage_monthly")
      .values({
        tenant_id: tenantId,
        year,
        month,
        orders_paid: ordersPaid
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "year", "month"]).doUpdateSet({
          orders_paid: ordersPaid,
          updated_at: sql`now()`
        })
      )
      .execute()
  );
}

function getCurrentYear() {
  return new Date().getUTCFullYear();
}

function getCurrentMonth() {
  return new Date().getUTCMonth() + 1;
}

export async function enqueueProcurement(tenantId: string, orderId: string) {
  await withTenantContext(tenantId, async (trx) => {
    const existing = await trx
      .selectFrom("external_procurements")
      .selectAll()
      .where("order_id", "=", orderId)
      .executeTakeFirst();
    if (existing) return;
    await trx
      .insertInto("external_procurements")
      .values({
        tenant_id: tenantId,
        order_id: orderId,
        provider: "aliexpress",
        status: "pending",
        metadata: { placeholder: true }
      })
      .execute();

    await trx
      .updateTable("orders")
      .set({ procurement_status: "pending" })
      .where("id", "=", orderId)
      .execute();
  });
}
