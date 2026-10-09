// Executable action proof scenario (not the turn-based sceneTestRunner).
// node scripts/qa/runtime/action-rpg.scenario.mjs
// Uses a private player.html server on 45973, the exported store shim, and the
// existing authored action demo. No LegacyDb or authored content writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../../", import.meta.url));

export async function runActionRpgScenario(page, serverUrl, outDir, project) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => console.error(`QA request failed: ${request.url()} ${request.failure()?.errorText}`));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  // A blank host, never the editor shell. The child loads the real compiled
  // /export-player deployment with no route interception or module substitutions.
  await page.goto(`${serverUrl}/__action-proof-host`, { waitUntil: "domcontentloaded" });
  const screenshot = new Promise((resolve, reject) => {
    page.once("framenavigated", async frame => {
      try {
        await frame.evaluate(() => new Promise((ready, fail) => {
          const done = () => {
            if (!window.__oprnActionCombat?.()) return;
            observer.disconnect();
            clearTimeout(deadline);
            ready();
          };
          const observer = new MutationObserver(done);
          const deadline = setTimeout(() => {
            observer.disconnect();
            fail(new Error("Instrumented player did not become ready for capture"));
          }, 120_000);
          observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
          done();
        }));
        await page.screenshot({ path: join(outDir, "player-proof.png") });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
  const run = page.evaluate(async project => {
    const { runActionCombatTest, isVerifiedActionCombatProof, actionCombatProjectFingerprint } = await import("/src/testing/actionCombatProof.ts");
    const started = performance.now();
    const before = actionCombatProjectFingerprint(project);
    const fingerprintMs = performance.now() - started;
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId, timeoutMs: 120_000 });
    const owned = isVerifiedActionCombatProof(receipt, project, project.startMapId);
    const forgedAccepted = isVerifiedActionCombatProof(structuredClone(receipt), project, project.startMapId);
    const wrongMapAccepted = isVerifiedActionCombatProof(receipt, project, "not-the-tested-map");
    const unchanged = before === actionCombatProjectFingerprint(project);
    project.meta.title += " revision changed";
    return {
      receipt, owned, forgedAccepted, wrongMapAccepted, unchanged, fingerprintMs,
      staleAccepted: isVerifiedActionCombatProof(receipt, project, receipt.mapId),
      remainingFrames: document.querySelectorAll("iframe").length,
      normalBootHasQaGlobals: "__oprnRunActionCombatProof" in window || "__oprnActionCombat" in window,
    };
  }, project);
  const [result] = await Promise.all([run, screenshot]);
  assert.equal(result.receipt.status, "verified");
  assert.equal(result.owned, true);
  assert.equal(result.forgedAccepted, false);
  assert.equal(result.wrongMapAccepted, false);
  assert.equal(result.staleAccepted, false);
  assert.equal(result.unchanged, true);
  assert.equal(result.remainingFrames, 0);
  assert.equal(result.normalBootHasQaGlobals, false);
  assert.deepEqual(errors, []);
  return { ...result, errors };
}

async function main() {
  const outDir = join(root, "verify-shots/runtime-qa/action-rpg");
  await mkdir(outDir, { recursive: true });
  process.env.DEV_SERVER_NO_TLS = "1";
  const server = await createServer({
    configFile: join(root, "vite.config.ts"),
    configLoader: "runner",
    cacheDir: join(root, ".vite-cache/action-proof"),
    server: { port: 45973, strictPort: true, host: "127.0.0.1", hmr: false, watch: { ignored: ["**/*"] } },
    plugins: [{
      name: "action-proof-empty-host",
      configureServer(vite) {
        vite.middlewares.use("/__action-proof-host", (_request, response) => {
          response.setHeader("Content-Type", "text/html");
          response.end('<!doctype html><html><head><title>Action proof QA</title></head><body></body></html>');
        });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    // Load authored data server-side so QA does not race thousands of unbundled
    // demo-factory requests. The tested player still receives only its JSON copy.
    const { createActionCombatDemoProject } = await server.ssrLoadModule("/src/project/defaults/actionCombatDemoProject.ts");
    const project = createActionCombatDemoProject();
    // Warm the real editor deployment before the bounded player execution starts.
    const deployment = await fetch("http://127.0.0.1:45973/export-player/player.html", { signal: AbortSignal.timeout(180_000) });
    assert.equal(deployment.status, 200);
    browser = await chromium.launch({
      headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
    });
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    const result = await runActionRpgScenario(page, "http://127.0.0.1:45973", outDir, project);
    await writeFile(join(outDir, "receipt.json"), `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(join(outDir, "SUMMARY.md"), [
      "# Action RPG runtime proof", "",
      `PASS: ${result.receipt.mapId} / ${result.receipt.runId}`,
      `Fingerprint: ${result.receipt.projectFingerprint}`, "",
      "Actual exported PlayScene; copied project; seed 731; stationary Shift paired with directional dodge.",
      "All eight runtime outcomes observed. Forged, wrong-map and stale receipts rejected.",
      "Source project unchanged; iframe removed; normal player QA globals absent; no page or HTTP errors.",
      `Fingerprint duration: ${result.fingerprintMs.toFixed(1)} ms.`, "",
      "Inspect player-proof.png for the real-player capture. receipt.json contains the numeric observations.", "",
    ].join("\n"));
    console.log(`PASS action-rpg: ${result.receipt.observations.length} observations; ${outDir}/SUMMARY.md`);
  } finally {
    await browser?.close();
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
