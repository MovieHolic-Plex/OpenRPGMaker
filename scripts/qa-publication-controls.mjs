import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { firefox } from "@playwright/test";

const root = process.cwd();
const oldReportPath = resolve(process.argv[2] ?? "verify-shots/release-artifact/report.json");
const outDir = resolve(process.argv[3] ?? "verify-shots/release-controls");
const cache = await mkdtemp(join(tmpdir(), "oprn-publication-controls-"));
await mkdir(outDir, { recursive: true });
const reservation = createServer();
const listening = once(reservation, "listening");
reservation.listen(0, "127.0.0.1");
await listening;
const address = reservation.address();
assert.ok(address && typeof address !== "string");
await new Promise((done, fail) => reservation.close(error => error ? fail(error) : done()));
const origin = `http://127.0.0.1:${address.port}`;
const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js", "--configLoader", "runner",
  "--host", "127.0.0.1", "--port", String(address.port), "--strictPort",
], {
  cwd: root,
  env: { ...process.env, DEV_SERVER_NO_TLS: "1", VITE_CACHE_DIR: cache },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
let browser;
let page;
const report = { oldReportPath, scenarios: [], pass: false };
try {
  await new Promise((done, fail) => {
    const deadline = setTimeout(() => fail(new Error(`Editor listen deadline: ${serverLog}`)), 90_000);
    const data = bytes => {
      serverLog += bytes;
      if (serverLog.includes(origin)) {
        clearTimeout(deadline);
        done();
      }
    };
    server.stdout.on("data", data);
    server.stderr.on("data", data);
    server.once("error", error => { clearTimeout(deadline); fail(error); });
    server.once("exit", code => { clearTimeout(deadline); fail(new Error(`Editor exited ${code}: ${serverLog}`)); });
  });
  browser = await firefox.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("**/*", route => ["GET", "HEAD"].includes(route.request().method())
    ? route.continue() : route.abort("blockedbyclient"));
  page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${origin}/?blankProject=1`, { waitUntil: "load" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__oprnEditorStore.isRemotePersistenceEnabled()), false);
  const project = JSON.parse(await readFile("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
  project.meta.publication = JSON.parse(await readFile(oldReportPath, "utf8")).publication;
  assert.ok(project.meta.publication);
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("menu-project").click();
  await page.getByTestId("menu-project-import").click();
  await (await chooser).setFiles({
    name: "publication-controls.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByTestId("menu-project").filter({ hasText: project.meta.title }).waitFor({ state: "visible" });
  const current = () => page.evaluate(() => window.__oprnEditorStore.getCurrent().meta.publication);
  const original = await current();
  report.original = original;
  assert.deepEqual(original, project.meta.publication, "The real import must preserve publication metadata");
  const open = async () => {
    await page.getByTestId("menu-project").click();
    await page.getByTestId("menu-project-publication").click();
  };
  await open();
  await page.getByTestId("publication-upgrade").click({ timeout: 180_000 });
  assert.equal(await page.getByTestId("publication-game-id").inputValue(), original.gameId);
  assert.notEqual(await page.getByTestId("publication-runtime").inputValue(), original.runtimeTarget);
  assert.notEqual(await page.getByTestId("publication-lineage").inputValue(), original.saveCompatibilityId);
  assert.deepEqual(await current(), original);
  const geometries = [];
  for (const [width, height] of [[1440, 900], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    geometries.push({ viewport: { width, height }, dialog: box });
    await page.screenshot({ path: join(outDir, `upgrade-${width}.png`), fullPage: true });
  }
  report.scenarios.push({ name: "staged-upgrade-and-layout", pass: true, geometries });
  await page.getByTestId("publication-cancel").click();
  assert.deepEqual(await current(), original);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "menu-project");
  report.scenarios.push({ name: "cancel-preserves-draft-and-focus", pass: true });
  await open();
  await page.getByTestId("publication-fork").click();
  assert.notEqual(await page.getByTestId("publication-game-id").inputValue(), original.gameId);
  await page.getByTestId("publication-cancel").click();
  assert.deepEqual(await current(), original);
  report.scenarios.push({ name: "fork-cancel-preserves-original", pass: true });
  await open();
  await page.getByTestId("publication-upgrade").click({ timeout: 180_000 });
  await page.getByTestId("publication-accept-predecessor").check();
  await page.getByTestId("publication-version").fill("2.0");
  await page.getByTestId("publication-apply").click();
  const applied = await current();
  assert.equal(applied.gameId, original.gameId);
  assert.notEqual(applied.runtimeTarget, original.runtimeTarget);
  assert.notEqual(applied.saveCompatibilityId, original.saveCompatibilityId);
  assert.ok(applied.acceptedSaveCompatibilityIds.includes(original.saveCompatibilityId));
  assert.equal(applied.versionLabel, "2.0");
  report.scenarios.push({ name: "explicit-upgrade-and-predecessor-acceptance", pass: true, original, applied });
  report.pass = true;
  console.log("PASS real publication controls: staged upgrade, layouts, cancellation, fork, explicit apply");
} catch (error) {
  report.error = String(error);
  report.serverLog = serverLog.slice(-5000);
  if (page && !page.isClosed()) {
    report.surface = await page.evaluate(() => ({
      dialog: document.querySelector('[data-testid="publication-dialog"]')?.textContent,
      fields: [...document.querySelectorAll('[data-testid^="publication-"]')].map(node => ({
        id: node.dataset.testid, value: node.value, disabled: node.disabled,
      })),
    }));
  }
  throw error;
} finally {
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    const deadline = setTimeout(() => server.kill("SIGKILL"), 20_000);
    try { await exited; } finally { clearTimeout(deadline); }
  }
  await rm(cache, { recursive: true, force: true });
}
