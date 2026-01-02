import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { config } from "./config";
import { Database, TenantsTable } from "./types";
import { defaultThemeSettings } from "@ringplaza/shared";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL
  })
});

export const db = new Kysely<Database>({
  dialect
});

export async function closeDb() {
  const pool = (dialect as any).pool as Pool | undefined;
  await pool?.end();
}

export async function withTenantLookup<T>(fn: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set local app.tenant_lookup = '1'`.execute(trx);
    return fn(trx);
  });
}

export async function withTenantContext<T>(
  tenantId: string,
  fn: (trx: Kysely<Database>) => Promise<T>
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set local app.current_tenant = ${tenantId}`.execute(trx);
    return fn(trx);
  });
}

export async function findTenantByHost(host: string): Promise<TenantsTable | null> {
  const normalizedHost = host.split(":")[0].toLowerCase();
  const tenant = await withTenantLookup((trx) =>
    trx
      .selectFrom("tenants")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("domain", "=", normalizedHost),
          eb("preview_domain", "=", normalizedHost),
          eb("slug", "=", normalizedHost.split(".")[0])
        ])
      )
      .executeTakeFirst()
  );

  return tenant ?? null;
}

export async function provisionTenant(input: {
  slug: string;
  domain?: string | null;
  planId: string;
  billingMode?: "saas" | "selfhost" | "appsumo";
  timezone?: string;
}): Promise<TenantsTable> {
  const previewDomain = `${input.slug}.shops.ringplaza.com`;

  const tenant = await db
    .insertInto("tenants")
    .values({
      slug: input.slug,
      domain: input.domain ?? null,
      preview_domain: previewDomain,
      plan_id: input.planId,
      billing_mode: input.billingMode ?? "saas",
      timezone: input.timezone ?? "UTC",
      theme_settings: defaultThemeSettings
    })
    .onConflict((oc) =>
      oc.column("slug").doUpdateSet({
        domain: input.domain ?? null,
        plan_id: input.planId,
        billing_mode: input.billingMode ?? "saas",
        timezone: input.timezone ?? "UTC",
        preview_domain: previewDomain,
        theme_settings: defaultThemeSettings,
        updated_at: sql`now()`
      })
    )
    .returningAll()
    .executeTakeFirst();

  if (!tenant) {
    throw new Error("Unable to provision tenant");
  }

  await db
    .insertInto("tenant_usage")
    .values({
      tenant_id: tenant.id,
      billing_month: new Date().toISOString().slice(0, 10),
      order_count: 0
    })
    .onConflict((oc) => oc.column("tenant_id").doNothing())
    .execute();

  return tenant;
}
