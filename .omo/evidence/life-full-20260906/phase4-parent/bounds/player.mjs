import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { firefox } from "@playwright/test";
import { startPlayerQaServer } from "/home/main/z-project/rpg-zzu-life-full-authoring-bounds/scripts/lib/runtimeQaRun.mjs";
const root = process.cwd(), out = "/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/phase4-parent/bounds/native", cache = `${out}/player-cache`;
process.env.VITE_CACHE_DIR = cache;
const project = JSON.parse(await readFile(`${root}/.omo/evidence/life-full-20260906/5/project.json`, "utf8"));
const map = project.maps[project.startMapId];
project.meta.title = "Task14 local label QA";
project.system.giftSystem = true;
project.system.timeSystem = { enabled: true, minutesPerRealSecond: 0.001, dayStartHour: 12, dayEndHour: 26, daysPerSeason: 40 };
project.system.dailyWeather = { enabled: true, seasons: { spring: [{ kind: "rain", weight: 1 }] } };
project.characters = { resident: { displayName: "Linked resident", birthday: { season: "spring", day: 1 }, giftPrefs: { loved: ["item_potion"] }, giftResponses: { loved: "THANKS", alreadyGifted: "DAILY LIMIT", noItems: "NO ITEMS" } } };
project.session.inventory = { item_potion: 2 };
project.session.placeables = {}; project.session.chests = {};
const pageFor = (id, name, commands) => ({ id, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands });
map.events = [
  { id: "first", x: 2, y: 3, characterId: "resident", talkFriendship: true, trigger: { kind: "action" }, commands: [], pages: [pageFor("first-page", "First page name", [{ kind: "text", speaker: "Explicit command", body: "EXPLICIT" }, { kind: "text", body: "AUTOMATIC" }])] },
  { id: "second", x: 3, y: 2, characterId: "resident", talkFriendship: true, trigger: { kind: "action" }, commands: [], pages: [pageFor("second-page", "Second page name", [{ kind: "text", body: "SECOND" }])] },
];
const receipt = { surface: "Native Firefox player.html with exportProjectStoreShim", fixture: "Local HTTP project endpoint substitute only; real player boot, scene, input, dialogue, gift and interpreter", writes: [], errors: [], actions: [], faceSetup: "QA face hook changes direction only; all interactions and choices are native keyboard" };
let server, browser, context;
async function signal(page, spec, trigger = async () => {}) {
  const handle = await page.evaluateHandle(spec => {
    let cancel;
    const promise = new Promise(resolve => {
      const finish = result => { observer.disconnect(); clearTimeout(timer); resolve(result); };
      const check = () => {
        const mirror = document.querySelector('[data-testid="runtime-state-json"]');
        const state = mirror ? JSON.parse(mirror.textContent) : undefined;
        if (spec.kind === "idle") { if (state?.running === false) finish({ state }); return; }
        const node = document.querySelector(spec.selector);
        if (!node || (spec.text && !node.textContent.includes(spec.text))) return;
        if (spec.kind === "ready" && document.querySelector('[data-testid="play-loading-overlay"]')) return;
        finish({ text: node.textContent, state });
      };
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => finish({ error: `Missing signal ${JSON.stringify(spec)}` }), 120000);
      cancel = () => finish({ error: "cancelled" });
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); check();
    });
    return { promise, cancel: () => cancel() };
  }, spec);
  try { await trigger(); const result = await handle.evaluate(x => x.promise); assert.equal(result.error, undefined); return result; }
  finally { await handle.evaluate(x => x.cancel()); await handle.dispose(); }
}
try {
  server = await startPlayerQaServer(); receipt.server = { root, port: server.port, url: server.url };
  browser = await firefox.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 960 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", e => receipt.errors.push(e.message));
  await context.route("**/*", route => {
    const req = route.request();
    if (new URL(req.url()).pathname === "/__task14/project.json") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { receipt.writes.push({ url: req.url(), method: req.method() }); return route.abort(); }
    return route.continue();
  });
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: "/__task14/project.json", saveNamespace: "task14-local", qaInstrumentation: true }; });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await signal(page, { selector: '[data-testid="title-screen"]' });
  await signal(page, { kind: "ready", selector: '[data-testid="runtime-state-json"]' }, () => page.keyboard.press("Enter"));
  assert.equal(await page.getByTestId("toolbar-database").count(), 0);
  const state = () => page.evaluate(() => window.__oprnDebug.readState());
  receipt.initial = await state();
  const menu = async () => {
    const result = await signal(page, { selector: ".choice-prompt-row", text: "Linked resident" }, () => page.keyboard.press("z"));
    receipt.actions.push({ label: "automatic gift menu", text: result.text });
  };
  const text = async (expected, speaker, trigger) => {
    const result = await signal(page, { selector: ".dialogue-box.page-ready .body", text: expected }, trigger);
    const actual = await page.getByTestId("dialogue-speaker").innerText();
    assert.equal(actual, speaker);
    receipt.actions.push({ label: expected, speaker: actual, text: result.text, state: await state() });
  };
  await menu();
  await text("EXPLICIT", "Explicit command", () => page.keyboard.press("Enter"));
  await page.screenshot({ path: `${out}/player-explicit.png` });
  await text("AUTOMATIC", "Linked resident", () => page.keyboard.press("Enter"));
  await text("호감", "Linked resident", () => page.keyboard.press("Enter"));
  await page.screenshot({ path: `${out}/player-talk.png` });
  await signal(page, { kind: "idle" }, () => page.keyboard.press("Enter"));
  assert.equal((await state()).friendship.resident, 10);
  await menu(); await page.keyboard.press("ArrowDown");
  await signal(page, { selector: '[data-testid="gift-scene"]' }, () => page.keyboard.press("Enter"));
  await text("THANKS", "Linked resident", () => page.keyboard.press("Enter"));
  assert.equal((await state()).inventory.item_potion, 1);
  assert.equal((await state()).friendship.resident, 170);
  await page.screenshot({ path: `${out}/player-gift.png` });
  await signal(page, { kind: "idle" }, () => page.keyboard.press("Enter"));
  await page.evaluate(() => window.__oprnInput.face("right"));
  await menu(); await page.keyboard.press("ArrowDown");
  await text("DAILY LIMIT", "Linked resident", () => page.keyboard.press("Enter"));
  assert.equal((await state()).inventory.item_potion, 1); assert.equal((await state()).friendship.resident, 170);
  await page.screenshot({ path: `${out}/player-shared-limit.png` });
  await signal(page, { kind: "idle" }, () => page.keyboard.press("Enter"));
  await menu();
  await text("SECOND", "Linked resident", () => page.keyboard.press("Enter"));
  await signal(page, { kind: "idle" }, () => page.keyboard.press("Enter"));
  receipt.final = await state();
  assert.equal(receipt.final.friendship.resident, 170);
  assert.deepEqual(receipt.writes, []); assert.deepEqual(receipt.errors, []); receipt.pass = true;
} catch (error) {
  receipt.failure = String(error.stack ?? error);
  const page = context?.pages()[0];
  if (page) { await page.screenshot({ path: `${out}/player-failure.png` }); receipt.body = await page.locator("body").innerText(); }
  throw error;
} finally {
  await context?.close(); await browser?.close(); await server?.close(); await rm(cache, { recursive: true, force: true });
  receipt.cleanup = { contextClosed: true, browserClosed: true, serverClosed: true, ownedCacheRemoved: true };
  await writeFile(`${out}/player-state.json`, JSON.stringify(receipt, null, 2) + "\n");
}
