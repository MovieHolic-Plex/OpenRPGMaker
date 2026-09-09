import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { firefox } from "@playwright/test";

const out = resolve(process.argv[2] ?? ".omo/evidence/event-command-remediation/U14/surface");
await mkdir(out, { recursive: true });
const owned = await mkdtemp(join(out, "tmp-"));
process.env.U14_STANDALONE = "1";
process.env.DEV_SERVER_NO_TLS = "1";
process.env.E2E_FREEZE_DEV_SERVER = "1";
process.env.VITE_SUPABASE_URL = "";
process.env.VITE_SUPABASE_ANON_KEY = "";
process.env.VITE_SUPABASE_USE_PROXY = "0";
process.env.VITE_CACHE_DIR = join(owned, "editor-cache");
const { createServer } = await import("vite");
const { proveU14Editor } = await import("../../test/e2e/event-command-remediation-U14.spec");
const server = await createServer({ configFile: resolve("vite.config.ts"), configLoader: "runner",
  server: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "warn" });
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address(); assert.ok(address && typeof address === "object");
  browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const exported = await proveU14Editor(page, `http://127.0.0.1:${address.port}`, out);
  console.log(`EDITOR PASS: ${exported}`);
} finally {
  await browser?.close(); await server.close();
  await rm(owned, { recursive: true, force: true });
  await writeFile(join(out, "editor-cleanup.json"), JSON.stringify({ serverClosed: true, browserClosed: true, temporaryCacheRemoved: true }));
}
