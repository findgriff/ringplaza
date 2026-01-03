import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import mercurius from "mercurius";
import "./fastify";
import { ensureBillingAllowance, logAudit, GRACE_ORDERS, rollupUsageMonthly } from "./ops";
import { z } from "zod";
import { config } from "./config";
import { findTenantByHost, provisionTenant, withTenantContext } from "./db";
import { schema, resolvers } from "./graphql";
import { payments } from "./payments";
import fastifyRawBody from "fastify-raw-body";
import {
  createStripeCheckoutSession,
  handleStripeWebhook,
  verifyStripeSignature,
  createStripeSubscriptionSession,
  createBillingPortalSession
} from "./payments/stripe";
import { capturePayPalOrder, createPayPalOrder, finalizePayPalOrder } from "./payments/paypal";
import { rollupMetrics } from "./ops";
import { v4 as uuidv4 } from "uuid";

const app = Fastify({
  logger: true
});

app.register(cors, { origin: true, credentials: true });
app.register(sensible);
app.register(jwt, { secret: config.JWT_SECRET });
app.register(fastifyRawBody, {
  field: "rawBody",
  global: false,
  runFirst: true,
  encoding: "utf8"
});

app.decorateRequest("tenant", null);

app.addHook("preHandler", async (request, reply) => {
  const routeConfig = request.routeOptions.config as { skipTenant?: boolean } | undefined;
  if (routeConfig?.skipTenant) return;

  const hostHeader = request.headers["x-tenant"] ?? request.headers.host;
  if (!hostHeader) {
    reply.badRequest("Missing tenant host");
    return;
  }

  const tenant = await findTenantByHost(String(hostHeader));
  if (!tenant) {
    reply.notFound("Tenant not found");
    return;
  }

  request.tenant = tenant;
});

app.get("/health", { config: { skipTenant: true } }, async () => ({ status: "ok" }));

app.post(
  "/api/tenants",
  { config: { skipTenant: true } },
  async (request, reply) => {
    const bodySchema = z.object({
      slug: z.string().min(3),
      domain: z.string().optional(),
      planId: z.string().default("starter"),
      billingMode: z.enum(["saas", "selfhost", "appsumo"]).default("saas"),
      timezone: z.string().default("UTC")
    });

    const body = bodySchema.parse(request.body ?? {});
    const tenant = await provisionTenant({
      slug: body.slug,
      domain: body.domain,
      planId: body.planId,
      billingMode: body.billingMode,
      timezone: body.timezone
    });

    reply.code(201);
    return tenant;
  }
);

app.get("/api/tenant", async (request) => request.tenant);

app.get("/api/products", async (request) => {
  const tenant = request.tenant;
  if (!tenant) {
    throw new Error("Tenant missing");
  }

  return withTenantContext(tenant.id, (trx) =>
    trx.selectFrom("products").selectAll().where("status", "=", "active").execute()
  );
});

app.post("/api/checkout", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) {
    throw new Error("Tenant missing");
  }

  const bodySchema = z.object({
    amountCents: z.number().positive(),
    currency: z.string().length(3).default("USD"),
    provider: z.enum(["stripe", "paypal"]).optional()
  });
  const body = bodySchema.parse(request.body ?? {});

  const gating = await ensureBillingAllowance(tenant.id);
  if (!gating.allowed) {
    reply.code(402);
    return {
      error: "Billing limit reached",
      message: gating.message
    };
  }

  const order = await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("orders")
      .values({
        tenant_id: tenant.id,
        status: "pending",
        procurement_status: "none",
        total_cents: body.amountCents,
        currency: body.currency.toUpperCase(),
        metadata: { channel: "rest" }
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  );

  const checkout = await payments.gateway.createCheckoutSession({
    amountCents: body.amountCents,
    currency: body.currency,
    orderId: order.id as string,
    tenant,
    provider: body.provider,
    successUrl: `${config.WEB_APP_URL}/checkout/success`,
    cancelUrl: `${config.WEB_APP_URL}/checkout/cancel`
  });

  await withTenantContext(tenant.id, (trx) =>
    trx
      .updateTable("orders")
      .set({
        metadata: {
          ...(order.metadata as Record<string, unknown>),
          checkout_url: checkout.url
        }
      })
      .where("id", "=", order.id as string)
      .execute()
  );

  await logAudit(tenant.id, "order.checkout_created", {
    orderId: order.id,
    amountCents: body.amountCents,
    provider: checkout.provider
  });

  return {
    provider: checkout.provider,
    checkoutUrl: checkout.url,
    graceRemaining: gating.graceRemaining
  };
});

app.post("/api/checkout/session", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    amountCents: z.number().positive(),
    currency: z.string().length(3).default("USD")
  });
  const body = bodySchema.parse(request.body ?? {});

  const order = await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("orders")
      .values({
        tenant_id: tenant.id,
        status: "pending",
        procurement_status: "none",
        total_cents: body.amountCents,
        currency: body.currency.toUpperCase(),
        metadata: { channel: "rest", provider: "stripe" }
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  );

  const session = await createStripeCheckoutSession({
    amountCents: body.amountCents,
    currency: body.currency,
    orderId: order.id as string,
    tenant,
    successUrl: `${config.WEB_APP_URL}/checkout/success`,
    cancelUrl: `${config.WEB_APP_URL}/checkout/cancel`
  });

  await withTenantContext(tenant.id, (trx) =>
    trx
      .updateTable("orders")
      .set({
        metadata: {
          ...(order.metadata as Record<string, unknown>),
          checkout_session_id: session.id
        }
      })
      .where("id", "=", order.id as string)
      .execute()
  );

  await logAudit(tenant.id, "order.checkout_stripe_created", {
    orderId: order.id,
    sessionId: session.id
  });

  reply.code(201);
  return { url: session.url, id: session.id, orderId: order.id };
});

app.post("/api/paypal/create-order", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    amountCents: z.number().positive(),
    currency: z.string().length(3).default("USD")
  });
  const body = bodySchema.parse(request.body ?? {});

  const order = await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("orders")
      .values({
        tenant_id: tenant.id,
        status: "pending",
        procurement_status: "none",
        total_cents: body.amountCents,
        currency: body.currency.toUpperCase(),
        metadata: { channel: "rest", provider: "paypal" }
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  );

  const session = await createPayPalOrder({
    amountCents: body.amountCents,
    currency: body.currency,
    orderId: order.id as string,
    tenant,
    successUrl: `${config.WEB_APP_URL}/checkout/success`,
    cancelUrl: `${config.WEB_APP_URL}/checkout/cancel`
  });

  const approval = session.links.find((l) => l.rel === "approve");

  await withTenantContext(tenant.id, (trx) =>
    trx
      .updateTable("orders")
      .set({
        metadata: {
          ...(order.metadata as Record<string, unknown>),
          paypal_order_id: session.id
        }
      })
      .where("id", "=", order.id as string)
      .execute()
  );

  await logAudit(tenant.id, "order.checkout_paypal_created", {
    orderId: order.id,
    paypalOrderId: session.id
  });

  reply.code(201);
  return { url: approval?.href, id: session.id, orderId: order.id };
});

app.post("/api/paypal/capture", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    providerOrderId: z.string(),
    orderId: z.string()
  });
  const body = bodySchema.parse(request.body ?? {});

  const capture = await capturePayPalOrder(body.providerOrderId);
  const status = capture?.status;
  if (status !== "COMPLETED") {
    reply.code(400);
    return { error: "Capture failed", status };
  }

  await finalizePayPalOrder({
    tenantId: tenant.id,
    orderId: body.orderId,
    providerOrderId: body.providerOrderId
  });

  return { status: "paid" };
});

app.post("/api/imports", async (request) => {
  const tenant = request.tenant;
  if (!tenant) {
    throw new Error("Tenant missing");
  }

  const bodySchema = z.object({
    source: z.enum(["aliexpress_csv", "aliexpress_api", "shopify"]),
    payload: z.any()
  });
  const body = bodySchema.parse(request.body ?? {});

  const job = await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("imports")
      .values({
        tenant_id: tenant.id,
        source: body.source,
        status: "pending",
        metadata: body.payload
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  );

  await logAudit(tenant.id, "import.created", { source: body.source });
  return job;
});

app.get("/api/imports/:id", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  const job = await withTenantContext(tenant.id, (trx) =>
    trx.selectFrom("imports").selectAll().where("id", "=", params.id).executeTakeFirst()
  );

  if (!job) {
    return { error: "Not found" };
  }
  return job;
});

app.post("/imports/shopify/csv", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    filename: z.string().optional()
  });
  bodySchema.parse(request.body ?? {});

  const jobId = uuidv4();
  await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("imports")
      .values({
        id: jobId,
        tenant_id: tenant.id,
        source: "shopify",
        status: "processing",
        metadata: { progress: 100, message: "Imported placeholder CSV", products: 1, variants: 2 }
      })
      .execute()
  );

  await logAudit(tenant.id, "import.shopify_csv.started", { jobId });
  return { jobId, status: "processing" };
});

app.post("/imports/shopify/graphql", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    shopDomain: z.string(),
    accessToken: z.string()
  });
  const body = bodySchema.parse(request.body ?? {});

  const jobId = uuidv4();
  await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("imports")
      .values({
        id: jobId,
        tenant_id: tenant.id,
        source: "shopify",
        status: "processing",
        metadata: {
          progress: 100,
          message: "Imported placeholder via GraphQL",
          shop: body.shopDomain,
          products: 1,
          variants: 2
        }
      })
      .execute()
  );

  await logAudit(tenant.id, "import.shopify_graphql.started", { jobId, shop: body.shopDomain });
  return { jobId, status: "processing" };
});

app.post("/imports/aliexpress/url", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({ url: z.string().url() });
  const body = bodySchema.parse(request.body ?? {});

  const productId = uuidv4();
  const jobId = uuidv4();

  await withTenantContext(tenant.id, async (trx) => {
    const product = await trx
      .insertInto("products")
      .values({
        id: productId,
        tenant_id: tenant.id,
        title: "AliExpress import placeholder",
        handle: `ae-${productId.slice(0, 6)}`,
        description: `Imported from ${body.url}`,
        status: "active"
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("product_variants")
      .values({
        product_id: product.id,
        sku: `AE-${productId.slice(0, 6)}`,
        price_cents: 1999,
        option_values: { option: "Default" }
      })
      .execute();

    await trx
      .insertInto("product_sources")
      .values({
        tenant_id: tenant.id,
        product_id: product.id,
        provider: "aliexpress",
        source_url: body.url,
        external_id: productId,
        metadata: { note: "stub" }
      })
      .execute();

    await trx
      .insertInto("imports")
      .values({
        id: jobId,
        tenant_id: tenant.id,
        source: "aliexpress_url",
        status: "completed",
        metadata: { progress: 100, product_id: product.id, message: "AliExpress URL import complete" }
      })
      .execute();
  });

  await logAudit(tenant.id, "import.aliexpress_url.completed", { jobId, url: body.url });
  return { jobId, status: "completed" };
});

app.post("/api/webhooks", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    url: z.string().url(),
    event: z.string(),
    secret: z.string().min(8)
  });
  const body = bodySchema.parse(request.body ?? {});

  const subscription = await withTenantContext(tenant.id, (trx) =>
    trx
      .insertInto("webhook_subscriptions")
      .values({
        tenant_id: tenant.id,
        url: body.url,
        event: body.event,
        secret: body.secret
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  );

  await logAudit(tenant.id, "webhook.subscribed", { url: body.url, event: body.event });
  return subscription;
});

app.post("/api/billing/subscribe", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const bodySchema = z.object({
    priceId: z.string()
  });
  const body = bodySchema.parse(request.body ?? {});

  const session = await createStripeSubscriptionSession({
    tenant,
    priceId: body.priceId,
    successUrl: `${config.WEB_APP_URL}/admin/plan?status=success`,
    cancelUrl: `${config.WEB_APP_URL}/admin/plan?status=cancel`
  });

  reply.code(201);
  return { url: session.url };
});

app.post("/api/billing/portal", async (request, reply) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const session = await createBillingPortalSession({
    tenant,
    returnUrl: `${config.WEB_APP_URL}/admin/plan`
  });

  reply.code(201);
  return { url: session.url };
});

app.get("/api/admin/metrics", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const querySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional()
  });
  const params = querySchema.parse(request.query ?? {});

  await rollupMetrics(tenant.id, { from: params.from, to: params.to });

  const metrics = await withTenantContext(tenant.id, (trx) => {
    let q = trx
      .selectFrom("metrics_daily")
      .selectAll()
      .orderBy("day", "asc");
    if (params.from) q = q.where("day", ">=", params.from);
    if (params.to) q = q.where("day", "<=", params.to);
    return q.execute();
  });

  return { series: metrics };
});

app.get("/api/admin/usage", async (request) => {
  const tenant = request.tenant;
  if (!tenant) throw new Error("Tenant missing");

  const allow = await ensureBillingAllowance(tenant.id);
  const plan = await withTenantContext(tenant.id, (trx) =>
    trx
      .selectFrom("tenants")
      .innerJoin("plans", "plans.id", "tenants.plan_id")
      .select(["plans.id as plan_id", "plans.order_limit as order_limit"])
      .where("tenants.id", "=", tenant.id)
      .executeTakeFirst()
  );

  const usage = await withTenantContext(tenant.id, (trx) =>
    trx
      .selectFrom("usage_monthly")
      .selectAll()
      .where("tenant_id", "=", tenant.id)
      .where("year", "=", new Date().getUTCFullYear())
      .where("month", "=", new Date().getUTCMonth() + 1)
      .executeTakeFirst()
  );

  return {
    planId: plan?.plan_id,
    orderLimit: plan?.order_limit,
    usage: usage?.orders_paid ?? 0,
    allowed: allow.allowed,
    graceRemaining: allow.graceRemaining
  };
});

app.post("/webhooks/stripe", { config: { skipTenant: true, rawBody: true } }, async (request, reply) => {
  const signature = request.headers["stripe-signature"] as string | undefined;
  const raw = (request as any).rawBody as Buffer | undefined;
  if (!raw) {
    reply.code(400);
    return { error: "Missing raw body" };
  }

  try {
    const event = verifyStripeSignature(raw, signature);
    await handleStripeWebhook(event);
    return { received: true };
  } catch (err) {
    request.log.error(err);
    reply.code(400);
    return { error: "Invalid signature" };
  }
});

app.register(mercurius, {
  schema,
  resolvers,
  graphiql: true,
  context: (request) => ({
    tenant: request.tenant
  })
});

async function start() {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`API running on ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
