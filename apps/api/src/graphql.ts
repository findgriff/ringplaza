import { withTenantContext, db } from "./db";
import { payments } from "./payments";
import { TenantsTable } from "./types";
import { config } from "./config";
import { incrementUsage, logAudit } from "./ops";

export const schema = /* GraphQL */ `
  scalar JSON

  type Tenant {
    id: ID!
    slug: String!
    domain: String
    preview_domain: String!
    plan_id: String!
    billing_mode: String!
    timezone: String!
    theme_settings: JSON
  }

  type Product {
    id: ID!
    title: String!
    handle: String!
    description: String
    status: String!
  }

  type Order {
    id: ID!
    status: String!
    total_cents: Int!
    currency: String!
    created_at: String!
  }

  type CheckoutSession {
    provider: String!
    url: String!
    expires_at: String!
  }

  type Query {
    tenant: Tenant!
    products: [Product!]!
    orders: [Order!]!
  }

  type Mutation {
    createOrder(amount_cents: Int!, currency: String!, provider: String): CheckoutSession!
  }
`;

export type GraphQLContext = {
  tenant?: TenantsTable;
};

export const resolvers = {
  JSON: {
    serialize: (value: unknown) => value
  },
  Query: {
    tenant: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.tenant) throw new Error("Tenant missing");
      return ctx.tenant;
    },
    products: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.tenant) throw new Error("Tenant missing");
      return withTenantContext(ctx.tenant.id, (trx) =>
        trx.selectFrom("products").selectAll().where("status", "=", "active").execute()
      );
    },
    orders: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.tenant) throw new Error("Tenant missing");
      return withTenantContext(ctx.tenant.id, (trx) =>
        trx
          .selectFrom("orders")
          .selectAll()
          .orderBy("created_at", "desc")
          .limit(25)
          .execute()
      );
    }
  },
  Mutation: {
    createOrder: async (
      _: unknown,
      args: { amount_cents: number; currency: string; provider?: "stripe" | "paypal" },
      ctx: GraphQLContext
    ) => {
      if (!ctx.tenant) throw new Error("Tenant missing");

      const order = await withTenantContext(ctx.tenant.id, (trx) =>
        trx
          .insertInto("orders")
          .values({
            tenant_id: ctx.tenant!.id,
            status: "pending",
            total_cents: args.amount_cents,
            currency: args.currency.toUpperCase(),
            metadata: { channel: "graphql" }
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      );

      const session = await payments.gateway.createCheckoutSession({
        amountCents: args.amount_cents,
        currency: args.currency,
        orderId: order.id as string,
        tenant: ctx.tenant,
        provider: args.provider,
        successUrl: `${config.WEB_APP_URL}/checkout/success`,
        cancelUrl: `${config.WEB_APP_URL}/checkout/cancel`
      });

      await withTenantContext(ctx.tenant.id, (trx) =>
        trx
          .updateTable("orders")
          .set({
            metadata: { ...order.metadata, checkout_url: session.url },
            status: "pending"
          })
          .where("id", "=", order.id as string)
          .execute()
      );

      await incrementUsage(ctx.tenant.id);
      await logAudit(ctx.tenant.id, "order.checkout_created", {
        orderId: order.id,
        amountCents: args.amount_cents,
        provider: session.provider
      });

      return {
        provider: session.provider,
        url: session.url,
        expires_at: session.expiresAt.toISOString()
      };
    }
  }
};
