import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { firefox } from "@playwright/test";

process.env.U10_ERASE_STANDALONE = "1";
const { proveEraseEditor } = await import("../../e2e/event-command-remediation-U10-erase.spec");
const root = ".omo/evidence/event-command-remediation/U10/erase";
await mkdir(root, { recursive: true });
const out = await mkdtemp(join(root, "surface-"));
const owned = await mkdtemp(join(out, "tmp-editor-"));
const probe = createServer();
const listening = once(probe, "listening", { signal: AbortSignal.timeout(10_000) });
probe.listen(0, "127.0.0.1"); await listening;
const address = probe.address(); assert.ok(address && typeof address !== "string"); const port = address.port;
await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const url = `http://127.0.0.1:${port}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
  env: { ...process.env, VITE_CACHE_DIR: resolve(owned, "cache"), E2E_FREEZE_DEV_SERVER: "1",
    VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned editor readiness timeout")), 30_000);
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error(`Owned editor exit ${code}`)); });
    server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes(url)) { clearTimeout(timer); resolve(); } });
    server.stderr.on("data", data => process.stderr.write(data));
  });
  // Compile the required multi-megabyte stylesheet before browser interception.
  // This waits for an actual dependency response, not an elapsed-time guess.
  const styleStarted = performance.now();
  const styleResponse = await fetch(`${url}src/styles/index.css`, { signal: AbortSignal.timeout(120_000) });
  assert.equal(styleResponse.status, 200);
  const styleBytes = (await styleResponse.arrayBuffer()).byteLength;
  await writeFile(join(out, "style-preflight.json"), JSON.stringify({
    status: styleResponse.status, bytes: styleBytes, elapsedMs: performance.now() - styleStarted,
  }, null, 2));
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let exported;
  try { exported = await proveEraseEditor(await context.newPage(), url, out); }
  finally { await context.close(); }
  console.log(`EDITOR PASS ${out}`);
  const player = spawn("node", ["scripts/qa/runtime/event-command-remediation-u10-erase.scenario.mjs", exported, out], { stdio: "inherit" });
  try {
    const [code] = await once(player, "exit", { signal: AbortSignal.timeout(360_000) }); assert.equal(code, 0);
  } finally {
    if (player.exitCode === null && player.signalCode === null) {
      const exited = once(player, "exit", { signal: AbortSignal.timeout(10_000) }); player.kill("SIGTERM"); await exited;
    }
  }
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) }); server.kill("SIGTERM"); await exited;
  }
  await rm(owned, { recursive: true, force: true });
  await writeFile(join(out, "editor-cleanup.json"), JSON.stringify({ port, browserClosed: true, contextsClosed: true, serverClosed: true, cacheRemoved: true }, null, 2));
  console.log(`U10 ERASE evidence ${out}`);
}
