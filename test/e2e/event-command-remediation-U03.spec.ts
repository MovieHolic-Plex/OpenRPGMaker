import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import type { Project } from "../../src/project/types";
import {
  cancelCommand, confirmCommand, enterLocalEditor, observeEditorAction,
  openCommandRow, openMapCommand, projectObservation, readEditorProject, reimportProject,
} from "./eventCommandRemediationHarness";

const out = ".omo/evidence/event-command-remediation/U03";
const path = ["maps", "mapA", "events", 0, "pages", 0, "commands", 0] as const;
const initial = { kind: "transfer", mapId: "mapA", x: 2, y: 3, direction: "left", fade: "black", transition: "fade" };
const dialog = '[data-testid="event-command-edit-dialog"]';
const selector = (id: string) => `${dialog} [data-testid="${id}"]`;

async function selectMap(page: Page, mapId: string) {
  return observeEditorAction(page, {
    observe: [{ source: "dom", selector: selector(`transfer-player-map-${mapId}`), read: "attribute", name: "class", equals: "transfer-player-map-row selected" }],
    event: { selector: selector(`transfer-player-map-${mapId}`), type: "click" }, timeoutMs: 10_000,
  }, () => page.locator(selector(`transfer-player-map-${mapId}`)).click());
}

async function direction(page: Page, value: string) {
  return observeEditorAction(page, {
    observe: [{ source: "dom", selector: selector(`transfer-player-direction-${value}`), read: "property", name: "checked", equals: true }],
    event: { selector: selector(`transfer-player-direction-${value}`), type: "change" }, timeoutMs: 10_000,
  }, () => page.locator(selector(`transfer-player-direction-${value}`)).check());
}

async function assertReopened(page: Page, facing: string) {
  await observeEditorAction(page, {
    observe: [
      { source: "dom", selector: selector("transfer-player-map-mapA"), read: "attribute", name: "class", equals: "transfer-player-map-row selected" },
      { source: "dom", selector: selector(`transfer-player-direction-${facing}`), read: "property", name: "checked", equals: true },
      { source: "dom", selector: selector("transfer-player-fade-black"), read: "property", name: "checked", equals: true },
    ], timeoutMs: 10_000,
  }, async () => undefined);
  // Coordinates and untouched optional fields are asserted against the export mirror.
  assert.equal(await page.locator(`${dialog} [data-testid="event-command-edit-ok"]`).count(), 1);
  assert.equal(await page.locator(`${dialog} [data-testid="transfer-player-cancel"]`).count(), 0);
}

test("G1-F20 real editor restores A, preserves transition, and isolates Cancel through import", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  const fixturePath = process.env.U03_FIXTURE;
  assert.ok(fixturePath, "Prepare the U03 fixture with the H0 positional CLI first");
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Project;
  const fixtureDirectory = process.env.U03_FIXTURE_DIR;
  assert.ok(fixtureDirectory);
  assert.ok(baseURL);
  const plan = [
    { id: "restore-A", action: "Select host row; Space; mapB; mapA; outer Confirm; event Apply", pass: initial },
    { id: "reopen-A", action: "Select existing row; Space; inspect A/left/black; Cancel", pass: "A unchanged, exactly one outer Confirm" },
    { id: "import-A", action: "Read export mirror wire JSON; menu-project/import; filechooser; reopen with Space", pass: initial },
    { id: "direction-only", action: "Check up; Confirm; event Apply; reopen", pass: { ...initial, direction: "up" } },
    { id: "cancel", action: "Select mapB and right; Cancel; Apply event draft", pass: { ...initial, direction: "up" } },
    { id: "final-import", action: "Import saved up wire JSON; reopen; Cancel", pass: { ...initial, direction: "up" } },
  ];
  await writeFile(`${out}/editor-scenarios.json`, JSON.stringify(plan, null, 2));
  const traces: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const local = await enterLocalEditor(page, fixture, baseURL);
  try {
    await openMapCommand(page, "u03-transfer");
    traces.push(await selectMap(page, "mapB"));
    traces.push(await selectMap(page, "mapA"));
    traces.push(await confirmCommand(page, "map", [projectObservation(path, initial)]));
    const savedA = await readEditorProject(page);
    const wireA = JSON.parse(await page.getByTestId("project-export-json").textContent() ?? "null").project;
    assert.deepEqual(wireA.maps.mapA.events[0].pages[0].commands[0], initial);
    await writeFile(join(fixtureDirectory, "restored-A.json"), JSON.stringify(wireA));
    await openCommandRow(page, page.getByTestId("event-editor-modal"));
    await assertReopened(page, "left");
    await page.screenshot({ path: `${out}/editor-restored-A.png` });
    await cancelCommand(page, savedA);
    await page.getByTestId("event-editor-modal-close").click();
    await reimportProject(page, savedA);
    await openMapCommand(page, "u03-transfer");
    await assertReopened(page, "left");
    traces.push(await direction(page, "up"));
    const up = { ...initial, direction: "up" };
    traces.push(await confirmCommand(page, "map", [projectObservation(path, up)]));
    const savedUp = await readEditorProject(page);
    const wireUp = JSON.parse(await page.getByTestId("project-export-json").textContent() ?? "null").project;
    assert.deepEqual(wireUp.maps.mapA.events[0].pages[0].commands[0], up);
    await writeFile(join(fixtureDirectory, "direction-up.json"), JSON.stringify(wireUp));
    await openCommandRow(page, page.getByTestId("event-editor-modal"));
    await assertReopened(page, "up");
    await page.screenshot({ path: `${out}/editor-direction-up.png` });
    traces.push(await selectMap(page, "mapB"));
    traces.push(await direction(page, "right"));
    await cancelCommand(page, savedUp);
    traces.push(await observeEditorAction(page, { observe: [projectObservation(path, up)], mutation: '[data-testid="project-export-json"]', timeoutMs: 10_000 },
      () => page.getByTestId("event-editor-apply").click()));
    assert.deepEqual(await readEditorProject(page), savedUp);
    await page.getByTestId("event-editor-modal-close").click();
    await reimportProject(page, savedUp);
    await openMapCommand(page, "u03-transfer");
    await assertReopened(page, "up");
    await cancelCommand(page, savedUp);
    await page.getByTestId("event-editor-modal-close").click();
    local.assertNoRemoteWrites();
    assert.deepEqual(errors, []);
    await writeFile(`${out}/editor-observation.json`, JSON.stringify({ status: "PASS", scenarios: plan, traces,
      exportFormat: "project-export-json.project wire JSON; real filechooser import", retainedA: initial, retainedUp: up,
      remoteWrites: [], pageErrors: errors, observationReleased: await page.evaluate(() => !window.__eventCommandQa) }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${out}/editor-failure.png` });
    await writeFile(`${out}/editor-failure.json`, JSON.stringify({ error: String(error), pageErrors: errors, surface: await page.locator("body").innerText(), traces }, null, 2));
    throw error;
  } finally {
    await local.dispose();
  }
});
