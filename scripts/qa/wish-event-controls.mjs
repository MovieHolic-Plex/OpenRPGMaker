// QA uses direct Chromium navigation to the real local app; no request relay.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = "http://127.0.0.1:19842";
const out = ".omo/evidence/wish-event-audit";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:storyboard-mode", "list");
    window.__controlsReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Editor boot deadline")); }, 180_000);
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-testid="event-editor-modal"]')) return;
        observer.disconnect(); clearTimeout(timer); resolve();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
  });
  await page.goto(origin + "/?blankProject=1&classicCapture=2", { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.evaluate(() => window.__controlsReady);
  await page.getByTestId("event-editor-cancel").click();
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    if (store !== window.__oprnEditorStore) throw new Error("QA imported a different store instance");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    const mapId = store.getCurrent().startMapId;
    const commands = [{ kind: "text", body: "first" }, { kind: "loop", body: [{ kind: "text", body: "nested" }] }, { kind: "text", body: "last" }];
    store.update(project => {
      const page = { id: "p1", name: "controls", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
      project.maps[mapId].events = [{ id: "controls-qa", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page, { ...structuredClone(page), id: "p2", commands: [{ kind: "text", body: "other page" }] }] }];
    });
    editorState.set({ currentMapId: mapId, selectedEventId: "controls-qa", selectedEventPageId: "p1" });
    openEventEditorModal(mapId, "controls-qa");
  });
  const commands = () => page.evaluate(() => {
    const store = window.__oprnEditorStore;
    return store.getCurrent().maps[store.getCurrent().startMapId].events.find(event => event.id === "controls-qa").pages.find(page => page.id === "p1").commands;
  });
  const head = () => page.locator('.cmd-list [data-cmd-path="[0]"] > .cmd-head');
  const original = await commands();
  await head().click();
  await head().press("Control+a");
  assert.equal(await page.locator(".cmd-list .cmd-item.selected").count(), 4);
  await page.screenshot({ path: `${out}/controls-browser-selected.png` });
  await head().press("Control+x");
  assert.deepEqual(await commands(), []);
  await page.getByTestId("event-command-empty-line").press("Control+v");
  assert.deepEqual(await commands(), original);
  await page.getByTestId("event-command-toolbar-undo").click();
  assert.deepEqual(await commands(), []);
  await page.getByTestId("event-command-toolbar-undo").click();
  assert.deepEqual(await commands(), original);
  await head().click();
  await head().press("Control+v");
  assert.deepEqual(await commands(), [...original, ...original]);
  await head().press("Control+z");
  assert.deepEqual(await commands(), original);
  checks.push("nested select-all/cut/paste is one page undo with stable root order");

  await head().click({ button: "right" });
  assert.equal(await page.getByTestId("event-command-context-menu").count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("event-command-context-menu").count(), 0);
  assert.equal(await page.getByTestId("event-editor-modal").count(), 1);
  assert.equal(await head().evaluate(node => document.activeElement === node), true);
  checks.push("context-menu topmost Escape and live opener focus");

  await page.getByTestId("event-command-toolbar-add").press("Control+k");
  await page.getByTestId("command-picker-add-text").click();
  await page.getByTestId("event-command-edit-ok").click();
  assert.equal((await commands()).length, original.length + 1);
  await page.getByTestId("event-command-toolbar-undo").click();
  assert.deepEqual(await commands(), original);
  checks.push("Ctrl+K picker insertion and toolbar undo are equivalent");

  const name = page.getByTestId("event-editor-name");
  const originalName = await name.inputValue();
  await name.focus();
  await name.press("End");
  await name.press("x");
  assert.equal(await name.inputValue(), originalName + "x");
  await name.press("Control+z");
  assert.equal(await name.inputValue(), originalName);
  assert.deepEqual(await commands(), original);
  checks.push("native input undo remains native");

  await page.getByTestId("event-view-toggle-storyboard").click();
  const story = page.locator('[data-testid="event-storyboard-host"] [data-cmd-path="[0]"]');
  await story.click();
  await story.press("Control+a");
  assert.equal(await page.locator('[data-testid="event-storyboard-host"] [data-cmd-path].selected').count(), 4);
  await story.press("Delete");
  assert.deepEqual(await commands(), []);
  await page.getByTestId("event-command-toolbar-undo").click();
  assert.deepEqual(await commands(), original);
  checks.push("storyboard selection and keyboard deletion use the same page contract");

  await page.getByTestId("event-view-toggle-flow").click();
  await page.getByTestId("event-command-search").fill("no-such-command");
  const navigation = await page.evaluate(async () => {
    const { navigateToEventCommand } = await import("/src/editor/panels/eventEditor/content.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const store = window.__oprnEditorStore;
    editorState.set({ selectedEventPageId: "p2" });
    return navigateToEventCommand(store.getCurrent().startMapId, "controls-qa", "p1", [1, -5, 0]);
  });
  assert.equal(navigation, true);
  assert.equal(await page.getByTestId("event-command-search").inputValue(), "");
  assert.equal(await page.locator('.cmd-list [data-cmd-path="[1,-5,0]"] > .cmd-head').evaluate(node => document.activeElement === node && !node.closest(".cmd-list").hidden), true);
  assert.equal(await page.getByTestId("event-editor-inspector").getAttribute("data-command-path"), "[1,-5,0]");
  await page.screenshot({ path: `${out}/controls-browser-navigation.png` });
  checks.push("cross-page navigation reveals nested authored command, clears filter, synchronizes inspector/focus");

  await page.getByTestId("event-editor-cancel").click();
  assert.equal(await page.getByTestId("event-editor-modal").count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ origin, checks, errors }, null, 2));
  await writeFile(`${out}/controls-browser.json`, JSON.stringify({ origin, checks, errors }, null, 2));
} finally {
  await browser.close();
}
