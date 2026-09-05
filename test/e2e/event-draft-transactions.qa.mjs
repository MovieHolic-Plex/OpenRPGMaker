// QA uses direct Chromium navigation to the real local app; no request relay.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = "http://127.0.0.1:33675";
const evidence = ".omo/evidence/wish-event-audit";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const results = [];
try {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-session-id", "qa-draft-transactions");
    window.transactionShellReady = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-testid="oprn-menu-bar"]')) return;
        observer.disconnect(); clearTimeout(timer); resolve();
      });
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("editor shell did not mount")); }, 180000);
      observer.observe(document, { subtree: true, childList: true });
    });
  });
  await page.goto(origin + "/?blankProject=1", { waitUntil: "load", timeout: 180000 });
  await page.evaluate(() => window.transactionShellReady);
  console.log("Actual editor shell mounted");

  async function seed() {
    await page.evaluate(async () => {
      const [{ store }, { createBlankProject }, { createDefaultGameEvent }, { openEventEditorModal }, { resetMapEditHistory }] = await Promise.all([
        import("/src/project/store.ts"), import("/src/project/defaults.ts"), import("/src/editor/eventActions.ts"),
        import("/src/editor/panels/eventEditor/modal.ts"), import("/src/editor/mapEditHistory.ts"),
      ]);
      const project = createBlankProject();
      const event = createDefaultGameEvent(2, 2);
      event.id = "transaction-browser-event";
      event.characterId = "alice";
      project.characters = { alice: { displayName: "Before" } };
      project.maps[project.startMapId].events = [event];
      store.replaceProject(project);
      window.transactionIds = { mapId: project.startMapId, eventId: event.id };
      openEventEditorModal(project.startMapId, event.id);
      resetMapEditHistory();
    });
  }

  async function snapshot() {
    return page.evaluate(async () => {
      const [{ store }, { projectWithoutEventDrafts, eventDraftHasUserChanges }, { getMapEditHistoryEntries }] = await Promise.all([
        import("/src/project/store.ts"), import("/src/project/eventDrafts.ts"), import("/src/editor/mapEditHistory.ts"),
      ]);
      const { mapId, eventId } = window.transactionIds;
      const current = store.getCurrent();
      const canonical = projectWithoutEventDrafts(current);
      return {
        canonicalName: canonical.characters?.alice?.displayName,
        switches: canonical.switches, session: current.session,
        canonicalEvent: canonical.maps[mapId].events.find((event) => event.id === eventId),
        workingEvent: current.maps[mapId].events.find((event) => event.id === eventId),
        dirty: eventDraftHasUserChanges(current, mapId, eventId),
        historyCount: getMapEditHistoryEntries().length,
      };
    });
  }

  async function editName(value) {
    await page.getByTestId("evt-rail-group-npc").locator(":scope > button").click();
    await page.getByTestId("event-character-display-name-input").fill(value);
    await page.getByTestId("event-character-display-name-input").press("Tab");
  }

  async function cancel(changed) {
    await page.evaluate((needsConfirm) => {
      const modal = document.querySelector('[data-testid="event-editor-modal"]');
      window.transactionClosed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("event editor did not close")), 120000);
        modal.addEventListener("oprn:event-editor-close", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      if (needsConfirm) window.transactionConfirm = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-testid="app-modal-confirm"]')) return;
          observer.disconnect(); clearTimeout(timer); resolve();
        });
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error("dirty confirmation absent")); }, 120000);
        observer.observe(document.body, { subtree: true, childList: true });
      });
    }, changed);
    await page.getByTestId("event-editor-cancel").click();
    if (changed) {
      await page.evaluate(() => window.transactionConfirm);
      await page.getByTestId("app-modal-confirm").click();
    }
    await page.evaluate(() => window.transactionClosed);
  }

  await seed();
  await editName("Cancelled name");
  assert.equal((await snapshot()).canonicalName, "Before");
  assert.equal((await snapshot()).dirty, true);
  await page.screenshot({ path: evidence + "/transactions-name-staged.png" });
  await cancel(true);
  assert.equal((await snapshot()).canonicalName, "Before");
  assert.equal((await snapshot()).historyCount, 0);
  results.push("name-only Cancel: canonical isolated, dirty confirmation, no history");

  await seed();
  await editName("Applied name");
  await page.getByTestId("event-editor-apply").click();
  assert.equal((await snapshot()).canonicalName, "Applied name");
  assert.equal((await snapshot()).historyCount, 1);
  await editName("Discarded after Apply");
  await cancel(true);
  assert.equal((await snapshot()).canonicalName, "Applied name");
  assert.equal((await snapshot()).historyCount, 1);
  results.push("name Apply -> edit -> Cancel retains exactly applied name/history");

  await seed();
  const beforeMemory = await snapshot();
  await page.getByTestId("event-view-toggle-list").click();
  await page.getByTestId("event-template-memory-opening").click();
  assert.ok((await snapshot()).workingEvent.pages[0].commands.length > 3);
  await cancel(true);
  assert.deepEqual((await snapshot()).canonicalEvent, beforeMemory.canonicalEvent);
  assert.equal((await snapshot()).historyCount, 0);
  results.push("memory template parent Cancel restores event with no history");

  await seed();
  const beforeField = await snapshot();
  await page.getByTestId("event-editor-aux-tools").locator(":scope > summary").click();
  await page.getByTestId("event-command-toolbar-field-monster").click();
  await page.getByTestId("field-monster-template-clear-switch").fill("browser_template_clear");
  await page.getByTestId("field-monster-template-apply").click();
  const stagedField = await snapshot();
  assert.equal(stagedField.workingEvent.pages.length, 2);
  assert.deepEqual(stagedField.switches, beforeField.switches);
  assert.deepEqual(stagedField.session, beforeField.session);
  await page.screenshot({ path: evidence + "/transactions-field-staged.png" });
  await cancel(true);
  assert.deepEqual((await snapshot()).switches, beforeField.switches);
  assert.deepEqual((await snapshot()).canonicalEvent, beforeField.canonicalEvent);
  assert.equal((await snapshot()).historyCount, 0);
  results.push("field template parent Cancel leaves no switch/session/event/history leak");

  await writeFile(evidence + "/transactions-browser.json", JSON.stringify({ origin, results, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await writeFile(evidence + "/transactions-browser.json", JSON.stringify({ origin, results, errors }, null, 2));
  await context.close();
  await browser.close();
}
