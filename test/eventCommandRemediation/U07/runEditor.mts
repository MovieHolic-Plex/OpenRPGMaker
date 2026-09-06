import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { firefox } from "@playwright/test";
import { VIEWPORTS } from "./editorFixture";

process.env.U07_STANDALONE = "1";
const { proveEditor } = await import("../../e2e/event-command-remediation-U07.spec");
const evidence = resolve(".omo/evidence/event-command-remediation/U07");
const out = await mkdtemp(join(evidence, "surface-"));
const owned = await mkdtemp(join(evidence, "tmp-editor-"));
const probe = createServer(); const listening = once(probe, "listening", { signal: AbortSignal.timeout(10_000) });
probe.listen(0, "127.0.0.1"); await listening;
const address = probe.address(); assert.ok(address && typeof address !== "string"); const port = address.port;
await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const url = `http://127.0.0.1:${port}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
  env: { ...process.env, VITE_CACHE_DIR: join(owned, "cache"), E2E_FREEZE_DEV_SERVER: "1",
    VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Owned editor readiness timeout")), 30_000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Owned editor exit ${code}`)); });
    server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes(url)) { clearTimeout(timeout); resolve(); } });
    server.stderr.on("data", data => process.stderr.write(data));
  });
  const styleStarted = performance.now();
  const styleResponse = await fetch(`${url}src/styles/index.css`, { signal: AbortSignal.timeout(120_000) });
  assert.equal(styleResponse.status, 200);
  const styleBytes = (await styleResponse.arrayBuffer()).byteLength;
  await writeFile(join(out, "style-preflight.json"), JSON.stringify({
    status: styleResponse.status, bytes: styleBytes, elapsedMs: performance.now() - styleStarted,
  }, null, 2));
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORTS[1] });
  const page = await context.newPage(); const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => requests.push(`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
  let exported: string | undefined;
  try {
    exported = await proveEditor(page, url, out); assert.deepEqual(errors, []);
    await writeFile(join(out, "editor-exit.json"), JSON.stringify({ exit: 0, commands: 17, errors, requests, exported }, null, 2));
  } catch (error) {
    await page.screenshot({ path: join(out, "runner-failure.png") });
    await writeFile(join(out, "runner-failure.json"), JSON.stringify({ error: String(error), errors, requests, url: page.url(), body: await page.locator("body").innerText() }, null, 2));
    throw error;
  }
  await context.close(); console.log(`EDITOR PASS ${out}`);
  if (process.env.U07_RUN_PLAYER === "1") {
    assert.ok(exported);
    const player = spawn("node", ["scripts/qa/runtime/event-command-remediation-u07.scenario.mjs", exported, out], { stdio: "inherit" });
    try {
      const [code] = await once(player, "exit", { signal: AbortSignal.timeout(1_200_000) });
      assert.equal(code, 0);
    } finally {
      if (player.exitCode === null && player.signalCode === null) {
        const exited = once(player, "exit", { signal: AbortSignal.timeout(10_000) });
        player.kill("SIGTERM");
        await exited;
      }
    }
  }
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) }); server.kill("SIGTERM"); await exited;
  }
  await rm(owned, { recursive: true, force: true });
  await writeFile(join(out, "editor-cleanup.json"), JSON.stringify({ port, serverClosed: true, browserClosed: true, owned, temporaryDirectoryRemoved: true }, null, 2));
  console.log(`U07 evidence ${out}`);
}
