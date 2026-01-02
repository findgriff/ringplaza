import { db, withTenantLookup, closeDb } from "../src/db";
import { rollupMetrics, rollupUsageMonthly } from "../src/ops";
import { config } from "../src/config";

async function main() {
  console.log("Rolling up metrics using", config.DATABASE_URL);
  const tenants = await withTenantLookup((trx) => trx.selectFrom("tenants").selectAll().execute());

  for (const tenant of tenants) {
    console.log(`Aggregating metrics for ${tenant.slug}`);
    await rollupMetrics(tenant.id);
    await rollupUsageMonthly(tenant.id);
  }
}

main()
  .then(() => closeDb())
  .catch((err) => {
    console.error(err);
    closeDb().finally(() => process.exit(1));
  });
