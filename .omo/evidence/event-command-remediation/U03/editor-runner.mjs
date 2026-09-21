import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
const out = ".omo/evidence/event-command-remediation/U03";
const root = (await readFile(`${out}/owned-root.txt`, "utf8")).trim();
assert.ok(root.startsWith("/tmp/event-command-u03-"));
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const cache = join(root, "editor-cache");
const url = `http://127.0.0.1:${port}`;
const env = { ...process.env, E2E_FREEZE_DEV_SERVER: "1", VITE_CACHE_DIR: cache,
  VITE_LEGACY_DB_URL: "", VITE_LEGACY_DB_ANON_KEY: "", VITE_LEGACY_DB_USE_PROXY: "0",
  U03_OWNED_ROOT: root, U03_EDITOR_URL: url, U03_FIXTURE: join(root, "fixtures/project.json"), U03_FIXTURE_DIR: join(root, "fixtures") };
await writeFile(`${out}/editor-launch.json`, JSON.stringify({ browser: "firefox", url, port, cache, fixture: env.U03_FIXTURE, freshContext: true, frozen: true, retries: 0 }, null, 2));
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], { env, stdio: ["ignore", "pipe", "pipe"] });
let child;
try {
  await new Promise((resolve, reject) => {
    const signal = AbortSignal.timeout(120_000);
    signal.addEventListener("abort", () => reject(new Error("U03 editor server startup timeout")), { once: true });
    server.once("error", reject);
    server.once("exit", code => reject(new Error(`U03 editor server exited ${code}`)));
    let output = "";
    server.stdout.on("data", data => { process.stdout.write(data); output += data; if (output.includes(`${url}/`)) resolve(); });
    server.stderr.on("data", data => process.stderr.write(data));
  });
  // Native Node Playwright loader, not vite-node SSR serialized browser callbacks.
  child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", `${out}/playwright.config.mts`], { env, stdio: "inherit" });
  const [code] = await once(child, "exit", { signal: AbortSignal.timeout(300_000) });
  assert.equal(code, 0, `U03 editor exit ${code}`);
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit", { signal: AbortSignal.timeout(10_000) });
    child.kill("SIGTERM"); await exited;
  }
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) });
    server.kill("SIGTERM"); await exited;
  }
  await rm(cache, { recursive: true, force: true });
  await writeFile(`${out}/editor-cleanup.json`, JSON.stringify({ port, serverExited: true, browserContext: "Playwright worker closed", cacheRemoved: cache }, null, 2));
  console.log("U03 editor cleanup: process/context closed, owned server and cache removed");
}
