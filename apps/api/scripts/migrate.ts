import { readFileSync, readdirSync } from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const migrationsDir = path.join(__dirname, "..", "db", "migrations");

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query(
      "create table if not exists schema_migrations (id serial primary key, name text not null unique, executed_at timestamptz not null default now())"
    );

    const executed = await client
      .query<{ name: string }>("select name from schema_migrations order by id asc")
      .then((r) => r.rows.map((row) => row.name));

    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrations) {
      if (executed.includes(file)) continue;

      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Running migration ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    console.log("Migrations complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
