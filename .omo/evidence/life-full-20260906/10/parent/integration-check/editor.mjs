import { createServer } from "vite";
import { firefox } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, rm } from "node:fs/promises";
const root = process.cwd();
const out = `${root}/.omo/evidence/life-full-20260906/10/parent/integration-check`;
const cache = `${out}/editor-cache`;
const port = 34893;
process.env.DEV_SERVER_NO_TLS = "1";
const server = await createServer({ root, cacheDir: cache, server: { host: "127.0.0.1", port, strictPort: true, watch: null }, logLevel: "warn" });
let browser;
const receipt = { cwd: root, port, browser: "firefox", nativeEditor: true, nativePlayer: false, writeRequests: [], remoteWrites: [], errors: [], actions: [], console: [], requestFailures: [] };
try {
  await server.listen();
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => receipt.errors.push(error.message));
  page.on("console", (message) => receipt.console.push({ type: message.type(), text: message.text() }));
  page.on("requestfailed", (request) => receipt.requestFailures.push({ url: request.url(), error: request.failure() }));
  const isWrite = (request) => !["GET", "HEAD", "OPTIONS"].includes(request.method());
  const describeWrite = (request) => {
    const url = new URL(request.url());
    return { method: request.method(), origin: url.origin, pathname: url.pathname };
  };
  receipt.origins = [];
  context.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (!receipt.origins.includes(origin)) receipt.origins.push(origin);
    if (isWrite(request)) receipt.writeRequests.push(describeWrite(request));
  });
  await context.route("**/*", (route) => {
    const request = route.request();
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.url()).hostname);
    if (isWrite(request) && !local) {
      receipt.remoteWrites.push(describeWrite(request));
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    window.task8Dom = (selector) => new Promise((resolve, reject) => {
      const ready = () => {
        if (selector === "editor-ready") {
          const metrics = document.querySelector('[data-testid="perf-metrics-json"]');
          return metrics && JSON.parse(metrics.textContent).initialEditRenderMs !== undefined;
        }
        const node = document.querySelector(selector);
        return node;
      };
      if (ready()) return resolve(true);
      const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); clearTimeout(timer); resolve(true); } });
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM signal timeout: ${selector}`)); }, 60000);
      observer.observe(document, { subtree: true, childList: true, attributes: true });
    });
    window.task8Boot = window.task8Dom("editor-ready");
  });
  await page.goto(`http://127.0.0.1:${port}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.task8Boot);
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    const button = page.getByTestId(id);
    if (await button.isVisible()) { await button.focus(); await page.keyboard.press("Enter"); }
  }
  receipt.initial = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
    resetMapEditHistory();
    return { remote: store.isRemotePersistenceEnabled(), rules: store.getCurrent().system.toolActions ?? null };
  });
  assert.equal(receipt.initial.remote, false);
  assert.equal(receipt.initial.rules, null);
  const keyClick = async (id) => { await page.getByTestId(id).focus(); await page.keyboard.press("Enter"); };
  await page.evaluate(() => { window.task8NextDom = window.task8Dom('[data-testid="database-modal"]'); });
  await keyClick("toolbar-database");
  await page.evaluate(() => window.task8NextDom);
  // The existing group header is a pointer-only div, not a focusable control.
  if (!await page.getByTestId("db-tab-life-crafting").isVisible()) await page.getByTestId("db-tab-group-life").click();
  await keyClick("db-tab-life-crafting");
  await keyClick("db-life-section-tool-actions");

  const armChange = async () => page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    window.task8Change = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error("project mutation signal timeout")); }, 10000);
      const unsubscribe = store.subscribe(() => {
        unsubscribe(); clearTimeout(timer);
        resolve(structuredClone(store.getCurrent().system.toolActions ?? null));
      });
    });
  });
  const changed = async (label, action) => {
    await armChange();
    await action();
    const rules = await page.evaluate(() => window.task8Change);
    receipt.actions.push({ label, rules });
    return rules;
  };
  const added = await changed("keyboard add", () => keyClick("db-life-add"));
  assert.equal(added.length, 5);
  assert.deepEqual(added.slice(1).map((rule) => rule.action), ["till", "water", "chop", "mine"]);
  assert.equal(added[0].itemId, undefined);
  await page.getByTestId("db-life-add").focus();
  assert.equal(await changed("Ctrl+Z first-table creation", () => page.keyboard.press("Control+z")), null);
  assert.deepEqual(await changed("Ctrl+Y first-table creation", () => page.keyboard.press("Control+y")), added);

  const checkbox = page.getByTestId("db-life-tool-requires-farmable");
  assert.equal(await checkbox.isChecked(), true);
  await checkbox.focus();
  const unrestricted = await changed("Space unchecks effective default", () => page.keyboard.press("Space"));
  assert.equal(unrestricted[0].requiresFarmable, false);
  await page.getByTestId("db-life-add").focus();
  const undone = await changed("Ctrl+Z checkbox", () => page.keyboard.press("Control+z"));
  assert.equal(undone[0].requiresFarmable, undefined);
  const redone = await changed("Ctrl+Y checkbox", () => page.keyboard.press("Control+y"));
  assert.equal(redone[0].requiresFarmable, false);

  const action = page.getByTestId("db-life-tool-action");
  await action.focus();
  const harvested = await changed("keyboard action End selects harvest", () => page.keyboard.press("End"));
  assert.equal(harvested[0].action, "harvest");
  assert.equal(await page.getByTestId("db-life-tool-requires-farmable").isChecked(), false);
  await page.screenshot({ path: `${out}/editor-1440.png` });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: `${out}/editor-1024.png` });
  receipt.controls = await page.getByTestId("db-life-tool-condition-card").evaluate((node) => ({ text: node.innerText, rect: node.getBoundingClientRect().toJSON() }));
  receipt.roundtrip = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { serialize, deserialize } = await import("/src/project/io.ts");
    const wire = serialize(store.getCurrent());
    localStorage.setItem("parent-phase3-project-fixture", wire);
    const loaded = deserialize(localStorage.getItem("parent-phase3-project-fixture"));
    store.replace(loaded);
    return { version: loaded.version, rules: loaded.system.toolActions, stable: serialize(deserialize(serialize(loaded))) === serialize(loaded), remote: store.isRemotePersistenceEnabled() };
  });
  assert.equal(receipt.roundtrip.remote, false);
  assert.equal(receipt.roundtrip.version, 4);
  assert.equal(receipt.roundtrip.rules[0].requiresFarmable, false);
  assert.equal(receipt.roundtrip.stable, true);
  assert.equal(await page.getByTestId("db-life-tool-requires-farmable").isChecked(), false);
  const appended = await changed("keyboard add to existing table", () => keyClick("db-life-add"));
  assert.equal(appended.length, 6);
  assert.deepEqual(appended.slice(0, 5), receipt.roundtrip.rules);
  receipt.finalRemote = await page.evaluate(async () => (await import("/src/project/store.ts")).store.isRemotePersistenceEnabled());
  assert.equal(receipt.finalRemote, false);
  assert.deepEqual(receipt.remoteWrites, []);
  assert.deepEqual(receipt.errors, []);
  receipt.pass = true;
  await page.evaluate(() => localStorage.removeItem("parent-phase3-project-fixture"));
  await context.close();
  receipt.contextClosed = true;
} catch (error) {
  receipt.failure = String(error);
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) { await page.screenshot({ path: `${out}/editor-failure.png` }); receipt.failureSurface = await page.locator("body").innerText(); receipt.failureHtml = await page.content(); }
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
  await rm(cache, { recursive: true, force: true });
  receipt.cleanup = { browserClosed: true, serverClosed: true, ownedCacheRemoved: cache };
  await writeFile(`${out}/editor-state.json`, JSON.stringify(receipt, null, 2) + "\n");
}
