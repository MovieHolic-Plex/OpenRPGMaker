import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, firefox } from "playwright";
import { installMediaWriteGuard } from "./issue693-media-guard.mjs";

// Real editor Test Play and Phaser loader. Only the asset HTTP response is controlled;
// session replacement uses the production consent API while that request is deferred.
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:38425";
const output = process.env.QA_OUTPUT_DIR ?? "/dev/shm/rpg-zzu-issue693-diagnostics/r2-evidence";
await mkdir(output, { recursive: true });
const browserName = process.env.QA_BROWSER ?? "firefox";
const browserType = { chromium, firefox }[browserName];
assert(browserType, `Unsupported QA_BROWSER: ${browserName}`);
const relayGets = process.env.QA_GET_RELAY === "1";
const browser = await browserType.launch({ headless: true,
  ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {}) });
const proof = [];

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Missing ${label}`)), 90_000);
    })]);
  } finally { clearTimeout(timer); }
}

try {
  for (const scenario of ["same-session-success", "same-session-failure", "replacement-failure", "initially-disabled-failure"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (relayGets) await installMediaWriteGuard(context, {
      report: { blockedMutations: [], bodyObservations: [], remoteWrites: 0 },
      permitRemoteCopy: false, getConfig: () => null, relayOrigin: new URL(base).origin,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);
    const requested = deferred();
    const release = deferred();
    try {
      // No private projects, remote reads/writes or provider traffic.
      await page.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin
        ? route.fallback() : route.abort());
      await page.addInitScript(() => {
        localStorage.setItem("oprn:ai-panel-collapsed", "0");
        window.diagnosticEditorReady = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Editor readiness missing")), 90_000);
          let hook;
          Object.defineProperty(window, "__oprnEditWorldToClient", { configurable: true, get: () => hook,
            set: value => { hook = value; clearTimeout(timeout); resolve(); } });
        });
      });
      await page.goto(`${base}/?devProject=1&sampleAdventure=1`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => window.diagnosticEditorReady);
      await page.evaluate(async () => {
        const { store } = await import("/src/project/store.ts");
        if (store.remotePersistenceEnabled !== false) throw new Error("Not a local-only QA project");

      });
      if (scenario !== "initially-disabled-failure") {
        await page.getByTestId("ai-command-menu-toggle").click();
        await page.getByTestId("ai-command-menu-export").click();
        await page.getByTestId("diagnostics-category-asset").check();
        await page.getByTestId("diagnostics-consent").check();
        await page.getByTestId("diagnostics-start").click();
      }
      await page.route("**/assets/generated-emotes.png", async route => {
        // The editor's Image warmup precedes preload; only Phaser's XHR proves
        // that the loaderror callback (and its session owner) already exists.
        if (route.request().resourceType() !== "xhr") return route.continue();
        requested.resolve();
        await release.promise;
        if (scenario === "same-session-success") await route.continue();
        else await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
      });
      // Subscribe before triggering; final ready is the exact boot completion signal.
      const booted = page.waitForEvent("console", { timeout: 90_000,
        predicate: message => message.text().includes("stage=ready") && message.text().includes("boot complete") });
      // Attach rejection handling now so a failed setup cannot leave an unhandled timeout.
      void booted.catch(() => {});
      await page.getByTestId("mode-play").click();
      await bounded(requested.promise, "Phaser asset request");
      if (scenario === "replacement-failure" || scenario === "initially-disabled-failure") {
        await page.evaluate(async () => {
          const { localDiagnostics } = await import("/src/editor/localDiagnostics.ts");
          localDiagnostics.clear();
          if (!localDiagnostics.start(true, ["asset"])) throw new Error("Consent failed");
        });
      }
      release.resolve();
      await booted;
      const result = await page.evaluate(async () => {
        const { localDiagnostics } = await import("/src/editor/localDiagnostics.ts");
        const receipts = localDiagnostics.snapshot().receipts;
        const raw = window.__oprnPlayBootLog().map(({ stage, ok }) => ({ stage, ok }));
        return { receipts, raw, canvas: !!document.querySelector("[data-testid='play-canvas'] canvas"),
          recovery: !!document.querySelector("[data-testid='play-recovery-panel']") };
      });
      assert(result.canvas && !result.recovery, "Real Test Play did not reach a rendered game");
      assert(result.raw.some(row => row.stage === "ready" && row.ok === true));
      if (scenario !== "same-session-success") assert(result.raw.some(row => row.stage === "assets" && row.ok === false));
      if (scenario.startsWith("same-session")) {
        assert(result.receipts.some(row => row.phase === "ready" && row.ok === true));
        if (scenario === "same-session-failure") assert(result.receipts.some(row => row.phase === "assets" && row.ok === false));
        else assert(!result.receipts.some(row => row.ok === false));
      } else assert.deepEqual(result.receipts, []);
      const keys = new Set(["category", "phase", "ok", "count", "sequence", "elapsedMs", "provenance", "evidence", "savedGeneration"]);
      for (const row of result.receipts) {
        assert.equal(row.category, "asset");
        assert(Object.keys(row).every(key => keys.has(key)), "Unexpected retained field");
      }
      proof.push({ scenario, browser: browserName, relayGets, ...result });
      console.log(`${scenario}: PASS`);
    } finally {
      release.resolve();
      await context.close();
    }
  }
  await writeFile(`${output}/boot.json`, JSON.stringify(proof, null, 2));
  console.log(`${proof.length} real Test Play scenarios passed; ${output}/boot.json`);
} finally { await browser.close(); }
