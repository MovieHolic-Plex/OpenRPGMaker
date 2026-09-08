import assert from "node:assert/strict";
import { createServer as createNetServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const phaseIndex = argv.indexOf("--phase");
const phase = phaseIndex >= 0 ? argv[phaseIndex + 1] : "surface";
assert(["red", "green", "surface"].includes(phase), "Unknown evidence phase");
const out = join(root, "output/evidence/event-command-repairs/editor", phase);
await mkdir(out, { recursive: true });
const report = { actions: [], panels: [], screenshots: [], errors: [], requests: [], cleanup: {} };
let server, browser, page;

async function freePort() {
  const probe = createNetServer();
  probe.unref();
  return new Promise((resolvePort, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("Missing probe address"));
      probe.close(() => resolvePort(address.port));
    });
  });
}

function row(context, id) {
  const found = report.panels.filter(panel => panel.context === context)
    .flatMap(panel => panel.rows).find(entry => entry.id === id);
  assert(found, `Missing rendered command ${context}/${id}`);
  return found;
}

try {
  server = await createServer({
    root, configFile: join(root, "vite.config.ts"), configLoader: "runner",
    cacheDir: join(root, ".vite-cache/editor-support-qa"),
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true, watch: null, hmr: false },
    logLevel: "warn",
  });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Missing editor address");
  const url = `http://127.0.0.1:${address.port}`;
  report.url = url;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"],
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("request", request => report.requests.push({ method: request.method(), url: request.url() }));
  await page.route(url => url.pathname === "/__support-qa", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="ko"><head><link rel="stylesheet" href="/src/styles/index.css"></head><body><div id="app"></div></body></html>',
  }));
  await page.route(requestUrl => requestUrl.origin === url && requestUrl.pathname !== "/__support-qa", async route => {
    try {
      const method = route.request().method();
      await route.fulfill({ response: await route.fetch({
        timeout: 120_000,
        maxRetries: method === "GET" || method === "HEAD" ? 1 : 0,
      }) });
    } catch (error) {
      if (page.isClosed()) return;
      report.errors.push(`${route.request().url()}: ${error instanceof Error ? error.message : String(error)}`);
      try {
        await route.abort();
      } catch (abortError) {
        if (!page.isClosed()) report.errors.push(String(abortError));
      }
    }
  });
  await page.routeWebSocket(requestUrl => requestUrl.host === new URL(url).host, () => {});
  await page.goto(`${url}/__support-qa`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  for (const context of ["map", "common", "troop"]) {
    await page.evaluate(async context => {
      const { openEventCommandPicker } = await import("/src/editor/panels/eventEditor/commandPicker.ts");
      openEventCommandPicker({ title: `Command support: ${context}`, context, onSelect: () => {} });
    }, context);
    report.actions.push({ action: "open actual picker", context });
    for (let tab = 1; tab <= 4; tab += 1) {
      await page.getByTestId(`event-command-picker-tab-${tab}`).click();
      report.actions.push({ action: "click tab", context, tab });
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="event-command-picker"] button[data-runtime-support]')].map(button => {
          const badge = button.querySelector(".command-runtime-badge");
          return {
            id: button.dataset.commandEntry, testid: button.dataset.testid,
            label: button.getAttribute("aria-label"), support: button.dataset.runtimeSupport,
            reason: badge?.dataset.runtimeReason, alternative: badge?.dataset.runtimeAlternative,
            alternativeLoop: badge?.dataset.runtimeAlternativeLoop,
            tooltip: badge?.getAttribute("title"), accessibleName: badge?.getAttribute("aria-label"),
          };
        }));
      assert(rows.length > 0, `Empty picker tab ${context}/${tab}`);
      report.panels.push({ context, tab, rows });
      const screenshot = join(out, `${context}-${tab}.png`);
      await page.screenshot({ path: screenshot });
      report.screenshots.push(screenshot);
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.getByTestId("event-command-picker").count(), 0);
  }

  const verified = [
    "m2-022-change-actor-name", "m2-040-set-event-location", "m2-041-swap-event-location",
    "m2-042-get-terrain-id", "m2-043-get-event-id", "m2-044-hide-screen", "m2-045-show-screen",
    "m2-078-open-menu-screen", "m2-093-open-load-menu", "m2-205-pathfind-move",
    "m2-206-wait-until", "m2-210-sound-layer",
  ];
  for (const context of ["map", "common"]) {
    for (const id of verified) {
      assert.equal(row(context, id).support, "runtime-full", `${context}/${id}`);
      assert.equal(row(context, id).reason, undefined, `${context}/${id} must not show a limitation badge`);
    }
    for (const id of ["m2-027-change-system-bgm", "m2-028-change-system-se"]) {
      const entry = row(context, id);
      assert.equal(entry.support, "runtime-full");
      assert.equal(entry.reason, undefined);
    }
  }
  assert.equal(row("troop", "m2-040-set-event-location").reason, "not-executed-in-context");
  assert.equal(row("troop", "m2-210-sound-layer").reason, "not-executed-in-context");
  for (const id of [
    "m2-001-show-text", "m2-002-display-text-settings", "m2-003-change-faceset",
    "m2-060-wait", "m2-067-key-input-processing",
  ]) {
    assert.equal(row("troop", id).support, "runtime-full");
    assert.equal(row("troop", id).reason, undefined);
  }
  report.authoring = [];
  for (const [family, initialCue, selectedCue] of [
    ["bgm", "battle", "victory"], ["se", "confirm", "cancel"],
  ]) {
    for (const legacy of [false, true]) {
      const initial = await page.evaluate(async ({ family, legacy }) => {
        const { openEventCommandEditDialog } = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
        const { newM2Command } = await import("/src/editor/eventActions.ts");
        const commandId = family === "bgm" ? "m2-027-change-system-bgm" : "m2-028-change-system-se";
        const initial = legacy
          ? { kind: "m2Command", commandId, fields: { resourceId: "" } }
          : newM2Command(commandId);
        let applied = null;
        let applyCount = 0;
        openEventCommandEditDialog({
          initial,
          onApply: command => { applied = command; applyCount += 1; },
        });
        window.__cueAuthoringState = () => ({ initial, applied, applyCount });
        return window.__cueAuthoringState();
      }, { family, legacy });
      const cue = page.getByTestId("m2-command-cue-option-select");
      assert.equal(await cue.inputValue(), legacy ? "" : initialCue);
      assert.equal(initial.applyCount, 0);
      await cue.selectOption(selectedCue);
      await page.getByTestId("m2-command-operation-option-select").selectOption("reset");
      const staged = await page.evaluate(() => window.__cueAuthoringState());
      assert.equal(staged.applyCount, 0);
      assert.equal(staged.applied, null);
      assert.deepEqual(staged.initial, initial.initial);
      const screenshot = join(out, `cue-${family}-${legacy ? "legacy" : "new"}.png`);
      await page.screenshot({ path: screenshot });
      report.screenshots.push(screenshot);
      await page.getByTestId("event-command-edit-ok").click();
      const authored = await page.evaluate(() => window.__cueAuthoringState());
      assert.equal(authored.applied.fields.cue, selectedCue);
      assert.equal(authored.applied.fields.operation, "reset");
      assert.equal(authored.applied.fields.resourceId, "");
      assert.equal(authored.applyCount, 1);
      assert.equal(await page.getByTestId("event-command-edit-dialog").count(), 0);
      report.authoring.push({ family, legacy, initial, authored });
      report.actions.push({ action: "select cue and reset, then apply through actual edit dialog", family, legacy, selectedCue });
    }
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requests.filter(request => !["GET", "HEAD", "OPTIONS"].includes(request.method)), []);
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.failure = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: join(out, "failure.png") });
} finally {
  if (browser) { await browser.close(); report.cleanup.browserClosed = true; }
  if (server) { await server.close(); report.cleanup.serverClosed = true; }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"),
    `# Editor support: ${report.pass ? "PASS" : "FAIL"}\n\nActual picker in the editor Vite configuration; no project edits or remote writes.\n` +
    `Native tooltip text is recorded from rendered badge attributes, not fabricated visible copy.\n\n` +
    `Immediately inspect: ${report.screenshots.join(", ")}\nCleanup: ${JSON.stringify(report.cleanup)}\n\n${report.failure ?? ""}\n`);
  console.log(JSON.stringify({ pass: report.pass, out, cleanup: report.cleanup, failure: report.failure }));
}
