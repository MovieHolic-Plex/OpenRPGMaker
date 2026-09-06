import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "@playwright/test";
import { armEventCommandObservation } from "../../../../../scripts/lib/runtimeQaEventCommands.mjs";

const [mode, root] = process.argv.slice(2);
assert.ok(mode === "editor" || mode === "player");
assert.ok(root?.startsWith("/tmp/event-command-u05-supervisor-"));
const base = dirname(fileURLToPath(import.meta.url));
const out = await mkdtemp(join(base, `${mode}-`));
const probe = createServer();
const listening = once(probe, "listening", { signal: AbortSignal.timeout(10_000) });
probe.listen(0, "127.0.0.1");
await listening;
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const url = `http://127.0.0.1:${port}`;
const cache = join(root, `${mode}-cache`);
const env = {
  ...process.env, E2E_FREEZE_DEV_SERVER: "1", VITE_CACHE_DIR: cache,
  VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0",
  U05_EDITOR_URL: url, U05_OWNED_ROOT: root, U05_EVIDENCE_DIR: out,
  U05_FIXTURE: join(root, "fixtures/project.json"), U05_FIXTURE_DIR: join(root, "fixtures"),
  PLAYWRIGHT_JSON_OUTPUT_FILE: join(out, "report.json"),
};
await writeFile(join(out, "launch.json"), JSON.stringify({ mode, root, port, url, cache, workers: 1, retries: 0 }, null, 2));

async function runNode(args, timeoutMs) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit" });
  try {
    const [code, signal] = await once(child, "exit", { signal: AbortSignal.timeout(timeoutMs) });
    assert.equal(signal, null);
    assert.equal(code, 0);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit", { signal: AbortSignal.timeout(10_000) });
      child.kill("SIGTERM");
      await exited;
    }
  }
}

let server;
let passed = false;
try {
  const config = mode === "player" ? ["--config", "vite.player-qa.config.ts"] : [];
  await runNode(["node_modules/vite/bin/vite.js", "optimize", "--configLoader", "runner", ...config], 300_000);
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
    "--port", String(port), "--strictPort", "--configLoader", "runner", ...config],
  { env, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Owned Vite startup timeout")), 120_000);
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", (code, signal) => { clearTimeout(timer); reject(new Error(`Owned Vite exit ${code}/${signal}`)); });
    server.stdout.on("data", data => {
      process.stdout.write(data);
      output += data;
      if (output.includes(`${url}/`)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on("data", data => process.stderr.write(data));
  });
  if (mode === "editor") {
    // One complete module-load subscription precedes fresh acceptance contexts.
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const errors = [];
    const writes = [];
    try {
      await context.route(target => /(?:supabase|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(target.href), async route => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
          writes.push(route.request().url());
          await route.abort("blockedbyclient");
        } else await route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(seed => {
        localStorage.clear();
        localStorage.setItem("oprn:editor-ui-mode", "expert");
        window.__RPG_ZZU_E2E_PROJECT__ = seed;
      }, JSON.parse(await readFile(env.U05_FIXTURE, "utf8")));
      const ready = { kind: "eventCommand", trigger: { kind: "none" }, timeoutMs: 300_000, observe: [
        { source: "dom", selector: '[data-testid="edit-canvas"] canvas', read: "present", equals: true },
        { source: "dom", selector: '[data-testid="project-export-json"]', read: "present", equals: true },
      ] };
      await page.addInitScript(`(${armEventCommandObservation.toString()})(${JSON.stringify(ready)});window.__eventCommandQa.start();`);
      await page.goto(url, { waitUntil: "load", timeout: 300_000 });
      const trace = await page.evaluate(async () => {
        window.__eventCommandQa.check();
        const result = await window.__eventCommandQa.result;
        window.__eventCommandQa.abort();
        delete window.__eventCommandQa;
        return result;
      });
      await writeFile(join(out, "preflight.json"), JSON.stringify({ trace, errors, writes }, null, 2));
      assert.equal(trace.status, "success");
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
    } finally {
      await context.close();
      await browser.close();
    }
    await runNode(["node_modules/@playwright/test/cli.js", "test", "--config",
      join(base, "playwright.config.mts"), "--reporter=list,json"], 1_800_000);
  } else {
    await runNode(["scripts/qa/runtime/event-command-remediation-u05.scenario.mjs", url, root], 1_800_000);
  }
  passed = true;
  if (mode === "player") {
    await cp(join(root, "fixtures"), join(base, "accepted-fixtures"), { recursive: true, force: false });
  }
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) });
    server.kill("SIGTERM");
    await exited;
  }
  if (mode === "editor") await cp(join(root, "playwright-output"), join(out, "playwright-output"), { recursive: true, force: false }).catch(error => {
    if (error.code !== "ENOENT") throw error;
  });
  await rm(cache, { recursive: true, force: true });
  if (mode === "player" && passed) await rm(root, { recursive: true, force: true });
  const receipt = { mode, out, passed, port, serverClosed: true, cacheRemoved: true, temporaryRootRemoved: mode === "player" && passed };
  await writeFile(join(out, "cleanup.json"), JSON.stringify(receipt, null, 2));
  await writeFile(join(base, `${mode}-latest.json`), JSON.stringify(receipt, null, 2));
  console.log(`U05 ${mode} ${passed ? "PASS" : "FAIL"} evidence ${out}`);
}
