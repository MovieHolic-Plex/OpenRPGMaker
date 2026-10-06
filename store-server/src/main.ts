import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createDb, migrate } from "./db";

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const db = createDb(config.databaseUrl);
await migrate(db, process.env.STORE_MIGRATIONS_DIR ?? join(here, "..", "migrations"));
const app = createApp(config, db, process.env.STORE_PUBLIC_DIR ?? join(here, "..", "public"));
app.server.listen(config.port, config.host, () => {
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  console.log(`[store] listening on ${config.host}:${port} (public ${config.publicUrl})`);
});
const stop = async (): Promise<void> => {
  await app.close();
  await db.end();
  process.exit(0);
};
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
