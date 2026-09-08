import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, firefox } from "playwright";
import { installMediaWriteGuard } from "./issue693-media-guard.mjs";

// Re-run against this worktree's real Vite/editor/Test Play surfaces. No runtime mocks.
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:38425";
const output = process.env.QA_OUTPUT_DIR ?? "/dev/shm/rpg-zzu-issue693-diagnostics/evidence";
await mkdir(output, { recursive: true });
const browserName = process.env.QA_BROWSER ?? "firefox";
const browserType = { chromium, firefox }[browserName];
assert(browserType, `Unsupported QA_BROWSER: ${browserName}`);
const relayGets = process.env.QA_GET_RELAY === "1";
const browser = await browserType.launch({ headless: true,
  ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(90_000);
const proof = { surface: "real editor and Test Play; isolated dev-showcase local project", browser: browserName, relayGets, screenshots: [], receipts: [], downloads: 0 };
if (relayGets) await installMediaWriteGuard(context, {
  report: { blockedMutations: [], bodyObservations: [], remoteWrites: 0 },
  permitRemoteCopy: false, getConfig: () => null, relayOrigin: new URL(base).origin,
});
page.on("download", () => proof.downloads++);
// Never read private live projects, provider logs, or mutate a remote service.
await page.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin
  ? route.fallback() : route.abort());
await page.addInitScript(() => {
  localStorage.setItem("oprn:ai-panel-collapsed", "0");
  window.diagnosticEditorReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Editor coordinate readiness missing")), 90_000);
    let hook;
    Object.defineProperty(window, "__oprnEditWorldToClient", { configurable: true, get: () => hook,
      set: value => { hook = value; clearTimeout(timeout); resolve(); } });
  });
});
const screenshot = async name => {
  await page.screenshot({ path: `${output}/${name}.png` }); proof.screenshots.push(name);
};
const arm = async (category, phase) => page.evaluate(async ({ category, phase }) => {
  const { localDiagnostics } = await import("/src/editor/localDiagnostics.ts");
  const from = localDiagnostics.snapshot().receipts.at(-1)?.sequence ?? 0;
  window.diagnosticReceipt = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { detach(); reject(new Error(`Missing ${category}:${phase}`)); }, 30_000);
    const detach = localDiagnostics.subscribe(() => {
      const receipt = localDiagnostics.snapshot().receipts.find(row => row.sequence > from && row.category === category && row.phase === phase);
      if (receipt) { clearTimeout(timer); detach(); resolve(receipt); }
    });
  });
}, { category, phase });
const receipt = () => page.evaluate(() => window.diagnosticReceipt);
try {
  await page.goto(`${base}/?devProject=1&sampleAdventure=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.diagnosticEditorReady);
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-export").click();
  assert.equal(await page.getByTestId("diagnostics-start").isDisabled(), true);
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await screenshot(`consent-${width}`);
    const bounds = await page.getByTestId("local-diagnostics-dialog").locator('[role="dialog"]').boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
  }
  await page.getByTestId("diagnostics-cancel").click();
  assert.equal(proof.downloads, 0);
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    if (store.remotePersistenceEnabled !== false) throw new Error("Not a local-only QA project");
    const { editorState } = await import("/src/editor/editorState.ts");
    store.update(project => {
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(270); map.upperTiles.fill(-1);
      map.events = [{ id: "diagnostic-fixture-transfer", x: 2, y: 5, priority: "below", trigger: { kind: "playerTouch" },
        commands: [{ kind: "transfer", mapId: map.id, x: 4, y: 5, fade: "none" }] }];
      project.startPos = { x: 0, y: 5 };
    }, { scope: "project", label: "local QA fixture" });
    editorState.set({ currentMapId: store.getCurrent().startMapId });
  });
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-export").click();
  for (const category of ["authoring", "movement", "collision", "event", "transfer", "asset", "warning", "error", "conversation"]) {
    await page.getByTestId(`diagnostics-category-${category}`).check();
  }
  assert.equal(await page.getByTestId("diagnostics-start").isDisabled(), true);
  await page.getByTestId("diagnostics-consent").check();
  await page.getByTestId("diagnostics-start").click();
  await arm("authoring", "written");
  // Actual canvas edit via native pointer; coordinate hook only supplies geometry.
  await page.getByTestId("layer-lower").click();
  await page.getByTestId("tool-paint").click();
  await page.locator('.chipset-tile[data-tile-index="7"]').first().click();
  const point = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const view = window.__oprnEditVisibleArea().worldView;
    return window.__oprnEditWorldToClient(Math.floor((view.x + view.width * 0.3) / 16) * 16 + 8,
      Math.floor((view.y + view.height * 0.4) / 16) * 16 + 8);
  });
  proof.paintPoint = point;
  assert(point.x > 320 && point.x < 1440 && point.y > 100 && point.y < 900, "Paint target outside authoring viewport");
  await page.mouse.click(point.x, point.y);
  proof.receipts.push(await receipt());
  await arm("authoring", "saved");
  await page.getByTestId("toolbar-save").click();
  proof.receipts.push(await receipt());
  await arm("asset", "ready");
  await page.getByTestId("mode-play").click();
  proof.receipts.push(await receipt());
  await screenshot("test-play-recording");
  await arm("collision", "terrain");
  await page.keyboard.press("ArrowLeft");
  proof.receipts.push(await receipt());
  await arm("movement", "completed");
  await page.keyboard.press("ArrowRight");
  proof.receipts.push(await receipt());
  await arm("event", "completed");
  await page.keyboard.press("ArrowRight");
  proof.receipts.push(await receipt());
  const transfer = await page.evaluate(async () => {
    const { localDiagnostics } = await import("/src/editor/localDiagnostics.ts");
    return localDiagnostics.snapshot().receipts.find(row => row.category === "transfer" && row.phase === "completed");
  });
  assert(transfer && transfer.x === 4 && transfer.y === 5);
  proof.receipts.push(transfer);
  await page.getByTestId("diagnostics-stop").click();
  await page.getByTestId("test-play-window-close").click();
  await page.getByTestId("diagnostics-open").click();
  await page.getByTestId("diagnostics-preview").click();
  const report = JSON.parse(await page.getByTestId("diagnostics-preview-text").inputValue());
  assert.equal(report.schema, "oprn-local-diagnostics-v1");
  assert(report.receipts.some(row => row.category === "movement"));
  assert(report.receipts.every(row => row.provenance && row.evidence));
  await screenshot("json-preview");
  await page.getByTestId("diagnostics-file").click();
  await screenshot("file-confirmation");
  await page.getByTestId("app-modal-cancel").click();
  assert.equal(proof.downloads, 0);
  await page.getByTestId("diagnostics-file").click();
  const downloaded = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("app-modal-confirm").click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "local-diagnostics.json");
  await download.saveAs(`${output}/confirmed-report.json`);
  // Shared custom select retains the native select as its machine-consumed owner.
  await page.getByTestId("diagnostics-format").evaluate(select => { select.value = "markdown"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.getByTestId("diagnostics-preview").click();
  assert((await page.getByTestId("diagnostics-preview-text").inputValue()).includes("```json"));
  await screenshot("markdown-preview");
  await page.getByTestId("diagnostics-file").click();
  const markdownDownload = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("app-modal-confirm").click();
  const markdown = await markdownDownload;
  assert.equal(markdown.suggestedFilename(), "local-diagnostics.md");
  await markdown.saveAs(`${output}/confirmed-report.md`);
  await page.getByTestId("diagnostics-cancel").click();
  await page.getByTestId("diagnostics-clear").click();
  assert.equal(await page.getByTestId("diagnostics-indicator").count(), 0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.diagnosticEditorReady);
  assert.equal(await page.getByTestId("diagnostics-indicator").count(), 0);
  proof.disabled = await page.evaluate(async () => {
    const { diagnosticObserved, publishDiagnostic } = await import("/src/util/diagnosticObserver.ts");
    let payloadReads = 0;
    const input = { get category() { payloadReads++; return "movement"; } };
    const start = performance.now();
    for (let i = 0; i < 1_000_000; i++) {
      if (diagnosticObserved("movement")) throw new Error("Unexpected off-mode observer");
      publishDiagnostic(input);
    }
    return { iterations: 1_000_000, elapsedMs: performance.now() - start, payloadReads };
  });
  assert.equal(proof.disabled.payloadReads, 0);
  proof.status = "PASS";
} catch (error) {
  proof.status = "FAIL"; proof.error = error.message;
  await screenshot("failure");
  throw error;
} finally {
  await writeFile(`${output}/qa.json`, JSON.stringify(proof, null, 2));
  await browser.close();
}
