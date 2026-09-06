// QA uses direct Chromium navigation to the real local app; no request relay.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, readlink, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const port = 40853;
const origin = `http://127.0.0.1:${port}`;
const out = ".omo/evidence/wish-event-audit";
await mkdir(out, { recursive: true });
const server = spawn("npm", ["run", "dev:worktree", "--", "--port", String(port)], {
  cwd: process.cwd(), env: { ...process.env, E2E_FREEZE_DEV_SERVER: "1" }, detached: true, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
let browser;
const errors = [];
const consoleDiagnostics = [];
const checks = [];
const serverExited = once(server, "close");
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Vite readiness deadline")), 180_000);
    const ready = chunk => {
      serverLog += chunk.toString();
      if (!serverLog.includes(origin)) return;
      clearTimeout(timeout); resolve();
    };
    server.stdout.on("data", ready);
    server.stderr.on("data", ready);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Vite exited before readiness: ${code}`)); });
  });
  const listener = execFileSync("ss", ["-ltnp", `sport = :${port}`], { encoding: "utf8" });
  const pid = Number(listener.match(/pid=(\d+)/)?.[1]);
  assert.ok(pid, listener);
  const cwd = await readlink(`/proc/${pid}/cwd`);
  assert.equal(cwd, process.cwd());
  await writeFile(`${out}/validation-server-identity.json`, JSON.stringify({ pid, cwd, origin, listener }, null, 2));
  browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleDiagnostics.push(Promise.all(message.args().map(arg => arg.jsonValue()))
      .then(args => ({ text: message.text(), location: message.location(), args })));
  });
  page.on("requestfailed", request => {
    if (!request.url().includes("127.0.0.1:17831") && request.failure()?.errorText !== "net::ERR_ABORTED") {
      errors.push(`${request.url()} ${request.failure()?.errorText}`);
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:storyboard-mode", "list");
    window.__validationReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Editor boot deadline")); }, 180_000);
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-testid="event-editor-modal"]')) return;
        observer.disconnect(); clearTimeout(timer); resolve();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
  });
  await page.goto(origin + "/?blankProject=1&classicCapture=2", { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.evaluate(() => window.__validationReady);
  await page.getByTestId("event-editor-cancel").click();
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    if (store !== window.__oprnEditorStore) throw new Error("Different store instance");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    const mapId = store.getCurrent().startMapId;
    store.update(project => {
      const base = { id: "p1", name: "origin", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "origin page" }] };
      project.maps[mapId].events = [{ id: "validation-qa", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [base, {
        ...structuredClone(base), id: "p2", name: "validation", conditions: [
          { kind: "switch", switchId: project.switches[0].id, value: true },
          { kind: "switch", switchId: "missing-slot2", value: false },
          { kind: "any", conditions: [{ kind: "not", condition: { kind: "item", itemId: "missing-nested-item", present: true } }] },
          { kind: "season", season: "winter" },
          { kind: "run", query: "flag", flag: "first", value: true },
          { kind: "run", query: "flag", flag: "", value: true },
        ], commands: [{ kind: "loop", body: [{ kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true },
          then: [{ kind: "gotoLabel", name: "missing-target" }] }] }],
      }] }];
    }, { scope: "map", mapId, origin: "system", label: "Validation navigation QA fixture" });
    editorState.set({ currentMapId: mapId, selectedEventId: "validation-qa", selectedEventPageId: "p1" });
    openEventEditorModal(mapId, "validation-qa");
  });
  const assertFocusedVisible = async locator => {
    assert.equal(await locator.isVisible(), true);
    assert.equal(await locator.evaluate(node => document.activeElement === node), true);
    assert.equal(await locator.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    }), true);
  };
  const clickIssue = async code => {
    await page.getByTestId("event-draft-validation-summary").click();
    await page.locator(`.event-draft-validation-issue[data-issue-code="${code}"]`).click();
    assert.equal(await page.getByTestId("event-draft-validation").evaluate(node => node.open), false);
    assert.equal(await page.locator('.evt-page-segment[data-page-id="p2"]').getAttribute("aria-selected"), "true");
  };
  for (const mode of ["list", "storyboard", "preview", "flow"]) {
    await page.locator('.evt-page-segment[data-page-id="p1"]').click();
    await page.getByTestId("event-view-toggle-list").click();
    await page.getByTestId("event-command-search").fill("no-matching-command");
    await page.getByTestId(`event-view-toggle-${mode}`).click();
    await clickIssue("label.target-missing");
    const head = page.locator('.cmd-list [data-cmd-path="[0,-5,0,-2,0]"] > .cmd-head');
    await assertFocusedVisible(head);
    assert.equal(await page.getByTestId("event-command-search").inputValue(), "");
    assert.equal(await page.getByTestId("event-editor-inspector").getAttribute("data-command-path"), "[0,-5,0,-2,0]");
    assert.equal(await page.getByTestId("event-editor-inspector").isVisible(), true);
    checks.push(`cross-page nested loop/fork command from ${mode}: visible focused list, filter cleared, inspector synchronized`);
  }
  await page.screenshot({ path: `${out}/validation-browser-command.png` });
  for (const [code, selector] of [
    ["reference.switch.missing", '[data-testid="event-page-switch2-condition-picker-open"]'],
    ["reference.item.missing", '[data-testid="event-page-advanced-condition-item-0-0-0-picker-open"]'],
    ["condition.season.no-time-system", '[data-custom-select-for="event-page-season-condition-input"]'],
    ["condition.run.flag-empty", '[data-testid="event-page-advanced-condition-row-2"] [data-testid="event-condition-run-flag"]'],
  ]) {
    await page.locator('.evt-page-segment[data-page-id="p1"]').click();
    await page.getByTestId("event-view-toggle-flow").click();
    // Close the destination rail through its actual header, then return to another page.
    await page.locator('.evt-page-segment[data-page-id="p2"]').click();
    // Rail headers select one group; clicking the active header does not collapse it.
    await page.getByTestId("evt-rail-group-npc").locator(":scope > button").click();
    assert.equal(await page.locator(selector).evaluate(node => node.closest(".event-editor-settings-accordion-group").classList.contains("is-open")), false);
    await page.locator('.evt-page-segment[data-page-id="p1"]').click();
    await clickIssue(code);
    await assertFocusedVisible(page.locator(selector));
    assert.equal(await page.locator(selector).evaluate(node => node.closest(".event-editor-settings-accordion-group").classList.contains("is-open")), true);
    assert.equal(await page.locator(selector).evaluate(node => node.closest("details:not([open])") === null), true);
    checks.push(`${code}: exact visible focused field from other page/flow with collapsed rail`);
  }
  await page.screenshot({ path: `${out}/validation-browser-field.png` });
  await page.getByTestId("event-draft-validation-summary").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("event-editor-modal").count(), 1);
  assert.equal(await page.getByTestId("event-draft-validation").evaluate(node => node.open), false);
  await assertFocusedVisible(page.getByTestId("event-draft-validation-summary"));
  checks.push("first Escape dismisses bell only and returns summary focus");
  const validation = await page.evaluate(async () => {
    const { validateEventDraft } = await import("/src/editor/eventDraftValidator.ts");
    const store = window.__oprnEditorStore;
    return validateEventDraft(store.getCurrent(), store.getCurrent().startMapId, "validation-qa");
  });
  assert.equal(validation.canCommit, false);
  assert.equal(validation.errorCount, 4);
  await page.getByTestId("event-editor-apply").click();
  assert.equal(await page.getByTestId("event-editor-modal").count(), 1);
  await assertFocusedVisible(page.getByTestId("event-page-switch2-condition-picker-open"));
  checks.push("fatal validation remains blocking and Apply navigates to first actual error field");
  await page.getByTestId("event-draft-validation-summary").click();
  await page.getByTestId("event-editor-cancel").click();
  assert.equal(await page.getByTestId("event-editor-modal").count(), 0);
  const layers = await page.evaluate(async () => (await import("/src/editor/ui/modalStack.ts")).modalStackEntryCountForTest());
  assert.equal(layers, 0);
  checks.push("parent close disposes open bell layer");
  await page.evaluate(async () => {
    const [{ createDefaultGameEvent }, { openEventEditorModal }, { resetMapEditHistory }] = await Promise.all([
      import("/src/editor/eventActions.ts"), import("/src/editor/panels/eventEditor/modal.ts"), import("/src/editor/mapEditHistory.ts"),
    ]);
    const store = window.__oprnEditorStore;
    const mapId = store.getCurrent().startMapId;
    const event = createDefaultGameEvent(2, 2);
    event.id = "projection-qa";
    event.characterId = "alice";
    store.update(project => {
      project.maps[mapId].events = [event];
      project.characters = { alice: { displayName: "Before" } };
    }, { scope: "map", mapId, origin: "system", label: "Validation projection QA fixture" });
    openEventEditorModal(mapId, event.id);
    resetMapEditHistory();
  });
  await page.getByTestId("evt-rail-group-npc").locator(":scope > button").click();
  await page.getByTestId("event-character-display-name-input").fill("Staged name");
  await page.getByTestId("event-character-display-name-input").press("Tab");
  assert.equal(await page.getByTestId("evt-rail-meta-npc").textContent(), "Staged name");
  assert.equal(await page.evaluate(() => window.__oprnEditorStore.getCurrent().characters.alice.displayName), "Before");
  checks.push("NPC rail shows staged name while canonical profile remains unchanged");
  await page.getByTestId("event-editor-aux-tools").locator(":scope > summary").click();
  await page.getByTestId("event-command-toolbar-field-monster").click();
  await page.getByTestId("field-monster-template-clear-switch").fill("validation_new_switch");
  await page.getByTestId("field-monster-template-apply").click();
  const staged = await page.evaluate(async () => {
    const store = window.__oprnEditorStore;
    const project = store.getCurrent();
    const { validateEventDraft } = await import("/src/editor/eventDraftValidator.ts");
    return { exists: project.switches.some(entry => entry.id === "validation_new_switch"),
      validation: validateEventDraft(project, project.startMapId, "projection-qa") };
  });
  assert.equal(staged.exists, false);
  assert.equal(staged.validation.canCommit, true);
  await page.getByTestId("event-editor-apply").click();
  const committed = await page.evaluate(async () => {
    const { projectWithoutEventDrafts } = await import("/src/project/eventDrafts.ts");
    const { getMapEditHistoryEntries } = await import("/src/editor/mapEditHistory.ts");
    const project = projectWithoutEventDrafts(window.__oprnEditorStore.getCurrent());
    return { exists: project.switches.some(entry => entry.id === "validation_new_switch"),
      name: project.characters.alice.displayName,
      pages: project.maps[project.startMapId].events.find(entry => entry.id === "projection-qa").pages.length,
      history: getMapEditHistoryEntries().length };
  });
  assert.deepEqual(committed, { exists: true, name: "Staged name", pages: 2, history: 1 });
  checks.push("new staged switch and name pass real parent Apply with two canonical pages and one global undo");
  await page.screenshot({ path: `${out}/validation-browser-projection.png` });
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="event-editor-modal"]');
    window.__projectionClosed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Projection editor close deadline")), 120_000);
      modal.addEventListener("oprn:event-editor-close", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  });
  await page.getByTestId("event-editor-cancel").click();
  await page.evaluate(() => window.__projectionClosed);
  assert.equal(await page.evaluate(async () => (await import("/src/editor/ui/modalStack.ts")).modalStackEntryCountForTest()), 0);
  const persistence = await page.evaluate(() => ({
    remote: window.__oprnEditorStore.isRemotePersistenceEnabled(),
    state: window.__oprnEditorStore.getAutoSaveState(),
  }));
  assert.equal(persistence.remote, false);
  assert.equal(persistence.state.code, "session-not-persisted");
  const diagnostics = await Promise.all(consoleDiagnostics);
  for (const diagnostic of diagnostics) {
    // Keep all diagnostics in evidence. Blank-project refusal is intentional, not a failed remote save.
    const detail = diagnostic.args[1];
    const localOnly = diagnostic.text.startsWith("[autosave]")
      && detail?.message === persistence.state.message && detail?.retryCount === 0;
    const optionalBridge = diagnostic.location.url.startsWith("http://127.0.0.1:17831/");
    if (!localOnly && !optionalBridge) errors.push(diagnostic);
  }
  assert.deepEqual(errors, []);
  const result = { origin, pid, cwd, checks, errors, persistence, diagnostics };
  console.log(JSON.stringify(result, null, 2));
  await writeFile(`${out}/validation-browser.json`, JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(`${out}/validation-browser-failure.json`, JSON.stringify({ checks, errors, error: String(error), stack: error.stack }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) process.kill(-server.pid, "SIGTERM");
  await serverExited;
  await writeFile(`${out}/validation-dev-server.log`, serverLog);
  const listener = execFileSync("ss", ["-ltnp", `sport = :${port}`], { encoding: "utf8" });
  await writeFile(`${out}/validation-cleanup.log`, listener);
  assert.equal(listener.includes(`:${port}`), false);
}
