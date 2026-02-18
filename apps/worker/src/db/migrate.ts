import { migrate } from "drizzle-orm/postgres-js/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, client } from "./connection.js";

async function main() {
  console.log("Running migrations...");
  const currentDir = dirname(fileURLToPath(import.meta.url));
  await migrate(db, { migrationsFolder: resolve(currentDir, "../../drizzle") });
  console.log("Migrations complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
