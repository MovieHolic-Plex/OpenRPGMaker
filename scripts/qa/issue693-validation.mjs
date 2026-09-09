import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { verifyValidationRecoveryFields } from "./issue693-validation-recovery.mjs";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:38426";
const output = process.env.QA_OUTPUT ?? "output/evidence/issue693-validation/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL ?? "chrome", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
page.setDefaultTimeout(90000);
// Same-origin GET relay works around this workstation's Chromium network-change cancellation.
// Responses are the running Vite server's actual bytes, never fixture/mock responses.
await page.route("**/*", async route => {
  const request = route.request();
  if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(base).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
const errors = [];
const sends = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => {
  if (request.method() === "POST" && /completion|chat-completions|assistant\/send/u.test(request.url())) sends.push(new URL(request.url()).pathname);
});
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  window.validationReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("EditScene readiness missing")), 120000);
    let hook;
    Object.defineProperty(window, "__oprnEditWorldToClient", { configurable: true, get: () => hook,
      set: value => { hook = value; clearTimeout(timeout); resolve(); } });
  });
});
// Subscribe before actions; every asynchronous UI wait is a mutation/focus event, never polling.
async function arm(selector, attribute, value) {
  await page.evaluate(({ selector, attribute, value }) => {
    window.validationSignal = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        const node = document.querySelector(selector);
        if (node && (attribute === null || node.getAttribute(attribute) === value)) {
          observer.disconnect(); clearTimeout(timeout); resolve();
        }
      });
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(`Missing UI signal: ${selector}`)); }, 15000);
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    });
  }, { selector, attribute, value });
}
async function settled() { await page.evaluate(() => window.validationSignal); }
async function clickIssue(code, path, field) {
  await page.getByTestId("event-draft-validation-summary").click();
  const row = page.locator(`[data-issue-code="${code}"]`).filter({ has: page.locator("span") });
  const rows = await row.elementHandles();
  const match = [];
  for (const node of rows) if (await node.getAttribute("data-command-path") === JSON.stringify(path)
    && (!field || await node.getAttribute("data-field") === field)) match.push(node);
  assert.equal(match.length, 1, "diagnostic must have one current location");
  await match[0].click();
}
const measurements = [];
let recovery = [];
try {
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => window.validationReady);
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { M2_COMMAND_CATALOG, createDefaultM2Fields } = await import("/src/project/eventCommands/m2Catalog.ts");
    const query = M2_COMMAND_CATALOG.find(entry => entry.title === "Data Query");
    if (!query) throw new Error("Missing Data Query command");
    const { whenAiChatPanelSettled } = await import("/src/editor/panels/aiChatPanel.ts");
    await whenAiChatPanelSettled();
    if (store.remotePersistenceEnabled !== false) throw new Error("QA must not mutate remote content");
    const mapId = store.getCurrent().startMapId;
    store.updateMap(mapId, map => { map.events.push({ id: "validation-qa", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "qa-page", name: "Validation QA", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [
        { kind: "loop", body: [{ kind: "gotoLabel", name: "Bearer secret /home/private https://private.local" }] },
        { kind: "loop", body: [{ kind: "changeFactionStance", a: "missing-a", b: "missing-b", op: "=", value: 0 }] },
        { kind: "m2Command", commandId: query.id, fields: { ...createDefaultM2Fields(query), variableId: "missing-variable" } },
        { kind: "moveEvent", route: { moves: [{ kind: "playSe", resourceId: "missing-audio-a" }, { kind: "playSe", resourceId: "missing-audio-b" }] } },
      ],
    }] }); }, { label: "Local validation QA" });
    editorState.set({ currentMapId: mapId, selectedEventId: "validation-qa", selectedEventPageId: "qa-page", layer: "event" });
    window.validationQa = { store, editorState, mapId };
  });
  // Real event-list/open controls own modal creation.
  await arm('[data-testid="event-editor-modal"]', null, null);
  await page.getByTestId("event-editor-open").click();
  await settled();
  await page.getByTestId("event-editor-save").click();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "event-command-goto-label-name");
  await clickIssue("reference.faction.missing", [1, -5, 0], "event-command-faction-b");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-custom-select-for")
    ?? document.activeElement?.getAttribute("data-testid")), "event-command-faction-b");

  await clickIssue("reference.variable.missing", [2], "m2-command-variableId-record-select");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "m2-command-variableId-record-open");
  await clickIssue("reference.resource.missing", [3], "move-route-command-2");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "move-route-command-2");
  assert.equal(await page.getByTestId("move-route-command-2").getAttribute("class"), "move-route-list-row selected");
  // Restrict the structural walk to the two original sibling commands.
  await page.evaluate(() => {
    const { store, mapId } = window.validationQa;
    store.updateMap(mapId, map => map.events.find(event => event.id === "validation-qa").pages[0].commands.splice(2));
  });

  // Real store mutations exercise the same subscriptions as reorder/delete controls.
  await arm('[data-issue-code="label.target-missing"]', "data-command-path", "[1,-5,0]");
  await page.evaluate(() => {
    const { store, mapId } = window.validationQa;
    store.updateMap(mapId, map => map.events.find(event => event.id === "validation-qa").pages[0].commands.reverse());
  });
  await settled();
  await clickIssue("label.target-missing", [1, -5, 0]);
  assert.equal(await page.getByTestId("event-editor-inspector").getAttribute("data-command-path"), "[1,-5,0]");
  await arm('[data-issue-code="label.target-missing"]', "data-command-path", "[0,-5,0]");
  await page.evaluate(() => {
    const { store, mapId } = window.validationQa;
    store.updateMap(mapId, map => map.events.find(event => event.id === "validation-qa").pages[0].commands.splice(0, 1));
  });
  await settled();
  await clickIssue("label.target-missing", [0, -5, 0]);
  assert.equal(await page.getByTestId("event-editor-inspector").getAttribute("data-command-path"), "[0,-5,0]");

  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await page.getByTestId("event-draft-validation-summary").click();
    const bounds = await page.locator(".event-draft-validation-popover").boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    measurements.push({ width, height, bounds });
    await page.screenshot({ path: `${output}/diagnostics-${width}.png` });
    await page.getByTestId("event-draft-validation-summary").click();
  }
  await page.getByTestId("event-draft-validation-summary").click();
  await page.getByTestId("event-validation-copy").click();
  const markdown = await page.evaluate(() => navigator.clipboard.readText());
  await page.getByTestId("event-validation-format").selectOption("json");
  await page.getByTestId("event-validation-copy").click();
  const json = await page.evaluate(() => navigator.clipboard.readText());
  assert.deepEqual(JSON.parse(markdown.split("```json\n")[1].split("\n```")[0]), JSON.parse(json));
  assert(!/Bearer|secret|private|qa-page/u.test(json));
  await writeFile(`${output}/diagnostics.json`, json);
  await writeFile(`${output}/diagnostics.md`, markdown);
  await page.getByTestId("event-draft-validation-summary").click();
  await page.getByTestId("event-editor-window-minimize").click();
  await page.getByTestId("ai-input").fill("Existing instructions");
  await page.getByTestId("event-editor-window-restore").click();
  await page.getByTestId("event-draft-validation-summary").click();
  await page.getByTestId("event-validation-ask-assistant").click();
  const draft = await page.getByTestId("ai-input").inputValue();
  assert(draft.startsWith("Existing instructions\n\n"));
  assert(draft.includes('"status": "UNSENT"'));
  assert.equal(await page.getByTestId("event-editor-modal").getAttribute("hidden"), "");
  await page.getByTestId("ai-input").fill(`${draft}\nAdditional instructions`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "ai-input");
  assert.deepEqual(sends, []);
  await page.screenshot({ path: `${output}/unsent-composer.png` });
  recovery = await verifyValidationRecoveryFields(page, output);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ measurements, recovery, errors, sends }, null, 2));
  await page.screenshot({ path: `${output}/final.png` });
  await browser.close();
}
assert.deepEqual(errors, []);
console.log(`Verified current paths, field focus, equivalent sanitized copy and editable UNSENT handoff: ${output}`);
