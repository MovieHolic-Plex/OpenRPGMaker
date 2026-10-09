import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox, type Browser } from "playwright";
import type { SurfaceReceipt } from "./spatial-authoring-surface-scenario.mts";
import type { runInspectorScenario } from "./inspector-scenario.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.QA_PORT ?? 19873);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? "output/evidence/tile-to-world/task-11-13-15/browser");
const scenario = process.env.QA_SCENARIO ?? "surface";
const scenarioViewports = new Map([
  ["surface", [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]],
  ["inspector-metrics", [{ width: 1280, height: 800 }]],
]);
const viewports = scenarioViewports.get(scenario);
const interactions: SurfaceReceipt[] = [];
const inspectorCaptures: Awaited<ReturnType<typeof runInspectorScenario>>[] = [];
const errors: { readonly name: string; readonly message: string; readonly code?: string; readonly stack?: string }[] = [];
// Mutable evidence accumulators; failures are retained even when startup or cleanup fails.
const consoleMessages: { readonly type: string; readonly text: string }[] = [];
const pageErrors: string[] = [];
const requestFailures: { readonly url: string; readonly error: string | undefined }[] = [];
const httpFailures: { readonly url: string; readonly status: number }[] = [];
const report = {
  base, root, scenario, viewports, interactions, inspectorCaptures, errors, outcome: "FAIL", viteBin: "",
  console: consoleMessages, pageErrors, requestFailures, httpFailures,
  cleanup: { serverStarted: false, browserStarted: false, browserClosed: false, serverClosed: false,
    cacheRemoved: false, cacheDir: "", serverPid: 0 },
};
let probe: Server | undefined;
let server: ReturnType<typeof spawn> | undefined;
let serverClosed: Promise<void> | undefined;
let browser: Browser | undefined;
let cacheDir: string | undefined;
let serverLog = "";

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline exceeded: ${milliseconds}ms`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function recordFailure(error: unknown): void {
  const entry = error instanceof Error
    ? { name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}),
      ...("code" in error && typeof error.code === "string" ? { code: error.code } : {}) }
    : { name: "UnknownError", message: String(error) };
  errors.push(entry);
  serverLog += `${JSON.stringify({ event: "surface-failure", ...entry })}\n`;
  console.error(JSON.stringify({ event: "surface-failure", ...entry }));
  process.exitCode = 1;
}

try {
  await mkdir(out, { recursive: true });
  if (!viewports) throw new Error(`QA_SCENARIO must be surface or inspector-metrics; received ${scenario}`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("QA_PORT must be a TCP port");
  const require = createRequire(import.meta.url);
  report.viteBin = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  await mkdir(resolve(root, ".vite-cache"), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, ".vite-cache/spatial-authoring-surface-"));
  report.cleanup.cacheDir = cacheDir;
  probe = createServer();
  const listening = once(probe, "listening");
  probe.listen(port, "127.0.0.1");
  await listening;
  const probeClosed = once(probe, "close");
  probe.close();
  await probeClosed;

  const ready = Promise.withResolvers<void>();
  server = spawn(process.execPath, [report.viteBin,
    "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
  ], {
    cwd: root, detached: true,
    env: { ...process.env, DEV_SERVER_NO_TLS: "1", E2E_FREEZE_DEV_SERVER: "1",
      DEV_SERVER_PORT: String(port), VITE_CACHE_DIR: cacheDir, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  report.cleanup.serverStarted = server.pid !== undefined;
  report.cleanup.serverPid = server.pid ?? 0;
  serverClosed = new Promise(resolveClosed => {
    server?.once("close", (code, signal) => {
      report.cleanup.serverClosed = true;
      serverLog += `${JSON.stringify({ event: "server-close", code, signal })}\n`;
      ready.reject(new Error(`Vite exited ${code}/${signal}`));
      resolveClosed();
    });
  });
  server.once("error", error => ready.reject(error));
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", chunk => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, 60000);
  const css = await fetch(`${base}/src/styles/index.css`, { signal: AbortSignal.timeout(120000) });
  if (css.status !== 200) throw new Error(`css ${css.status}`);
  await css.arrayBuffer();
  const { runSpatialSurface } = await import("./spatial-authoring-surface-scenario.mts");
  browser = await firefox.launch({ headless: true });
  report.cleanup.browserStarted = true;
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("console", message => report.console.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("requestfailed", request => report.requestFailures.push({
      url: new URL(request.url()).pathname, error: request.failure()?.errorText,
    }));
    page.on("response", response => {
      if (response.status() >= 400) report.httpFailures.push({ url: new URL(response.url()).pathname, status: response.status() });
    });
    switch (scenario) {
      case "surface":
        await runSpatialSurface(page, out, receipt => interactions.push(receipt));
        break;
      case "inspector-metrics": {
        const { runInspectorScenario } = await import("./inspector-scenario.mts");
        inspectorCaptures.push(await runInspectorScenario(page, out));
        break;
      }
      default: throw new Error(`Unsupported QA_SCENARIO: ${scenario}`);
    }
  }
} catch (error) {
  recordFailure(error);
} finally {
  // Each cleanup failure is recorded; no failed resource can bypass the remaining cleanup/report.
  try {
    if (probe?.listening) {
      const closed = once(probe, "close");
      probe.close();
      await closed;
    }
  } catch (error) { recordFailure(error); }
  try {
    if (browser) { await bounded(browser.close(), 30000); report.cleanup.browserClosed = true; }
  } catch (error) { recordFailure(error); }
  try {
    if (server?.pid && !report.cleanup.serverClosed) process.kill(-server.pid, "SIGTERM");
    if (serverClosed) await bounded(serverClosed, 30000);
  } catch (error) {
    recordFailure(error);
    try {
      if (server?.pid && !report.cleanup.serverClosed) {
        process.kill(-server.pid, "SIGKILL");
        if (serverClosed) await bounded(serverClosed, 30000);
      }
    } catch (shutdownError) { recordFailure(shutdownError); }
  }
  try {
    if (cacheDir) { await rm(cacheDir, { recursive: true }); report.cleanup.cacheRemoved = true; }
  } catch (error) { recordFailure(error); }
  report.outcome = errors.length === 0 ? "PASS" : "FAIL";
  try {
    await mkdir(out, { recursive: true });
    const writes = await Promise.allSettled([
      writeFile(resolve(out, "server.log"), serverLog),
      writeFile(resolve(out, "qa.json"), JSON.stringify(report, null, 2)),
      writeFile(resolve(out, "cleanup.md"), `# Owned resource cleanup\n\n${JSON.stringify(report.cleanup, null, 2)}\n`),
    ]);
    for (const result of writes) if (result.status === "rejected") recordFailure(result.reason);
  } catch (error) { recordFailure(error); }
}
