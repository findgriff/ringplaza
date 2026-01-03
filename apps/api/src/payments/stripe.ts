import Stripe from "stripe";
import { config } from "../config";
import { TenantRow } from "../types";
import { finalizeOrder } from "../ops";
import { logAudit } from "../ops";
import { db } from "../db";
import { sql } from "kysely";

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16"
});

const priceToPlan: Record<string, { planId: string | null; procurement: boolean }> = {
  [config.STRIPE_PRICE_STARTER]: { planId: "starter", procurement: false },
  [config.STRIPE_PRICE_UNLIMITED]: { planId: "unlimited", procurement: false },
  [config.STRIPE_PRICE_PROCUREMENT]: { planId: null, procurement: true }
};

export async function createStripeCheckoutSession(input: {
  amountCents: number;
  currency: string;
  orderId: string;
  tenant: TenantRow;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${input.successUrl}?orderId=${input.orderId}`,
    cancel_url: `${input.cancelUrl}?orderId=${input.orderId}`,
    currency: input.currency.toLowerCase(),
    line_items: [
      {
        price_data: {
          currency: input.currency.toLowerCase(),
          product_data: {
            name: "Order",
            metadata: {
              orderId: input.orderId,
              tenantId: input.tenant.id
            }
          },
          unit_amount: input.amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      orderId: input.orderId,
      tenantId: input.tenant.id
    }
  });

  return session;
}

export function verifyStripeSignature(rawBody: Buffer, signature: string | undefined) {
  if (!signature) throw new Error("Missing Stripe signature");
  return stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
}

export async function handleStripeWebhook(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenantId;
    const orderId = session.metadata?.orderId;

    if (!tenantId || !orderId) {
      throw new Error("Missing tenant/order metadata on session");
    }

    await finalizeOrder({
      tenantId,
      orderId,
      idempotencyKey: session.id,
      provider: "stripe",
      providerRef: session.payment_intent ? String(session.payment_intent) : session.id,
      procurementEnabled: false
    });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const priceId = (subscription.items.data[0]?.price?.id as string | undefined) ?? null;
    const status = subscription.status;

    const mapping = priceId ? priceToPlan[priceId] : undefined;
    const planId = mapping?.planId ?? null;
    const procurement = Boolean(mapping?.procurement);

    await upsertTenantSubscription({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status,
      priceId,
      planId,
      procurement
    });
  }
}

export async function createStripeSubscriptionSession(input: {
  tenant: TenantRow;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const customerId = await ensureCustomer(input.tenant);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      tenantId: input.tenant.id,
      plan: input.priceId
    }
  });
  return session;
}

export async function createBillingPortalSession(input: { tenant: TenantRow; returnUrl: string }) {
  const customerId = await ensureCustomer(input.tenant);
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: input.returnUrl
  });
}

async function ensureCustomer(tenant: TenantRow): Promise<string> {
  const existing = await db
    .selectFrom("tenant_subscriptions")
    .selectAll()
    .where("tenant_id", "=", tenant.id)
    .executeTakeFirst();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    name: tenant.slug,
    metadata: {
      tenantId: tenant.id,
      slug: tenant.slug
    }
  });

  await db
    .insertInto("tenant_subscriptions")
    .values({
      tenant_id: tenant.id,
      stripe_customer_id: customer.id,
      status: "active",
      procurement_addon: false
    })
    .onConflict((oc) =>
      oc.column("tenant_id").doUpdateSet({
        stripe_customer_id: customer.id,
        updated_at: sql`now()`
      })
    )
    .execute();

  return customer.id;
}

async function upsertTenantSubscription(input: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  priceId: string | null;
  planId: string | null;
  status: string | null;
  procurement: boolean;
}) {
  const tenantSub = await db
    .selectFrom("tenant_subscriptions")
    .select(["tenant_id"])
    .where("stripe_customer_id", "=", input.stripeCustomerId)
    .executeTakeFirst();

  if (!tenantSub) {
    console.warn("No tenant found for customer", input.stripeCustomerId);
    return;
  }

  await db
    .insertInto("tenant_subscriptions")
    .values({
      tenant_id: tenantSub.tenant_id,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      price_id: input.priceId,
      plan_id: input.planId,
      status: input.status ?? undefined,
      procurement_addon: input.procurement
    })
    .onConflict((oc) =>
      oc.column("tenant_id").doUpdateSet({
        stripe_subscription_id: input.stripeSubscriptionId,
        price_id: input.priceId,
        plan_id: input.planId,
        status: input.status ?? undefined,
        procurement_addon: input.procurement,
        updated_at: sql`now()`
      })
    )
    .execute();

  if (input.planId) {
    await db
      .updateTable("tenants")
      .set({ plan_id: input.planId })
      .where("id", "=", tenantSub.tenant_id)
      .execute();
  }

  await logAudit(tenantSub.tenant_id, "billing.subscription_updated", {
    priceId: input.priceId,
    planId: input.planId,
    status: input.status,
    procurement: input.procurement
  });
}
