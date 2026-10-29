import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

async function runMigrations() {
  console.log("Running database migrations from ./drizzle...");
  const start = Date.now();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`Migrations applied successfully in ${Date.now() - start}ms!`);
  await pool.end();
}

runMigrations().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});

