import { sql } from "kysely";
import { config } from "../src/config";
import { db, provisionTenant, withTenantContext, closeDb } from "../src/db";
import { defaultThemeSettings } from "@ringplaza/shared";
import { rollupMetrics } from "../src/ops";

async function seed() {
  console.log("Seeding database using", config.DATABASE_URL);

  const tenant = await provisionTenant({
    slug: "demo",
    planId: "starter",
    billingMode: "saas",
    timezone: "Europe/London"
  });

  console.log("Tenant ensured:", tenant.slug, tenant.id);

  await withTenantContext(tenant.id, async (trx) => {
    const existingProduct = await trx
      .selectFrom("products")
      .selectAll()
      .where("handle", "=", "demo-ring")
      .executeTakeFirst();

    if (existingProduct) {
      console.log("Demo product already exists");
      return;
    }

    const product = await trx
      .insertInto("products")
      .values({
        tenant_id: tenant.id,
        title: "Aurora Band",
        handle: "demo-ring",
        description: "A sleek titanium ring to showcase the RingPlaza default theme.",
        status: "active"
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("product_variants")
      .values([
        {
          product_id: product.id,
          sku: "AURORA-6",
          price_cents: 6900,
          option_values: { size: "6" }
        },
        {
          product_id: product.id,
          sku: "AURORA-7",
          price_cents: 6900,
          option_values: { size: "7" }
        }
      ])
      .execute();

    await trx
      .insertInto("orders")
      .values({
        tenant_id: tenant.id,
        status: "paid",
        procurement_status: "none",
        total_cents: 13800,
        currency: "USD",
        metadata: { seed: true }
      })
      .execute();

    await trx
      .insertInto("audit_logs")
      .values({
        tenant_id: tenant.id,
        actor: "system",
        action: "seed",
        entity: "tenant",
        metadata: { theme: defaultThemeSettings }
      })
      .execute();

    await sql`refresh materialized view concurrently if exists metrics_daily`.execute(trx).catch(() => {
      // ignore optional metrics view refresh during seed
    });

    console.log("Inserted demo product, variants, sample order");
    await rollupMetrics(tenant.id);
  });
}

seed()
  .then(() => closeDb())
  .catch((err) => {
    console.error(err);
    closeDb().finally(() => process.exit(1));
  });
