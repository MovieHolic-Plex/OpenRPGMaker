import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { readProjectPackage } from "../../src/project/package";
import { asset, MAP_A, MAP_B, PNG, SWITCH, VARIABLE } from "../eventCommandRemediation/U07.fixture";
import { CASES, editorFixture, EVENT_B, HOST, media } from "../eventCommandRemediation/U07/editorFixture";
import { choose, dialog, geometry, labeledInput } from "../eventCommandRemediation/U07/browserControls";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, observeEditorAction } from "./eventCommandRemediationHarness";

export async function proveEditor(page: Page, url: string, out: string) {
  // Given: independent mapped commands, authored A/B records, isolated local persistence.
  await mkdir(out, { recursive: true }); page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
  const fixture = editorFixture(); const local = await enterLocalEditor(page, fixture, url); const traces = [];
  const calls: string[] = [];
  await page.route("**/images/generations", async route => {
    assert.equal(route.request().method(), "POST"); calls.push(route.request().method());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ image: { dataUrl: PNG, mimeType: "image/png" } }) });
  });
  const source = fixture.maps[MAP_A]?.events[0]?.pages?.[0]?.commands; assert.ok(source);
  try {
    await openMapCommand(page, HOST, [0]);
    for (const [position, index] of CASES.entries()) {
      if (position) await openCommandRow(page, page.getByTestId("event-editor-modal"), [position]);
      const scope = dialog(page); const initial = source[position]; assert.ok(initial?.kind === "m2Command");
      const expected = structuredClone(initial); const before = await readEditorProject(page);
      let focus = scope.getByTestId("event-command-edit-ok");
      // When: use only visible product picker/segment/input controls.
      if (index === 24 || index === 25 || index === 69) {
        const kind = index === 24 ? "charset" : index === 25 ? "faceset" : "backdrop";
        const prefix = index === 24 ? "change-actor-graphic" : index === 25 ? "change-actor-faceset" : "change-parallax-back";
        const native = scope.getByTestId(`${prefix}-resource-select`); const retained = await native.elementHandle(); assert.ok(retained);
        let id: string;
        if (position < 3) {
          const added = asset(kind, "new");
          assert.equal(await native.locator(`option[value="${added.id}"]`).count(), 0);
          await page.evaluate(`(async () => { const { registerAsset, asset } = await import('/test/eventCommandRemediation/U07.fixture.ts'); registerAsset(asset(${JSON.stringify(kind)}, 'new')); })()`);
          await scope.getByTestId(`${prefix}-resource-picker`).click();
          await page.getByTestId(`db-resource-picker-option-${added.id}`).click(); await page.getByTestId("db-resource-picker-ok").click(); id = added.id;
        } else {
          const oldIds = Object.keys(before.assets.uploaded);
          await scope.getByTestId(`${prefix}-ai-prompt`).fill(`U07 generated ${kind}`);
          await observeEditorAction(page, { timeoutMs: 15_000, mutation: `[data-testid="${prefix}-ai-queue-list"]`,
            observe: [{ source: "dom", selector: `[data-testid="${prefix}-ai-queue-item"][data-job-status="done"]`, read: "present", equals: true }],
          }, () => scope.getByTestId(`${prefix}-ai-generate`).click());
          const current = await readEditorProject(page); const added = Object.values(current.assets.uploaded).filter(asset => !oldIds.includes(asset.id));
          assert.equal(added.length, 1); const resource = added[0]; assert.ok(resource);
          assert.equal(resource.kind, kind); assert.equal(resource.dataUrl, PNG);
          assert.ok(current.resourceProfiles.some(profile => profile.assetId === resource.id)); id = resource.id;
        }
        assert.equal(await native.inputValue(), id);
        assert.equal(await retained.evaluate((node, id) => node.isConnected && node === document.querySelector(`[data-testid="event-command-edit-dialog"] [data-testid="${id}"]`), `${prefix}-resource-select`), true);
        await retained.dispose(); expected.fields.value = id;
        if (index === 69) Object.assign(expected.fields, { resourceId: id, target: id, operation: "set" });
        const image = index === 25 ? scope.getByTestId("change-actor-faceset-face-preview").getByTestId("event-command-face-crop-shell") : scope.getByTestId(index === 24 ? "change-actor-graphic-preview" : "change-parallax-back-preview-image").locator("img");
        if (index === 25) assert.equal(await image.getAttribute("data-resource-id"), id);
        else assert.equal(await image.getAttribute("src"), (await readEditorProject(page)).assets.uploaded[id]?.dataUrl);
        focus = scope.getByTestId(`${prefix}-resource-picker`);
      } else if ([102, 26, 27, 28, 29].includes(index)) {
        const kind = index === 102 ? "backdrop" : index === 26 ? "charset" : index === 27 ? "music" : index === 28 ? "sound" : "system";
        const a = kind === "charset" || kind === "backdrop" ? asset(kind, "old") : media(kind, "old");
        const b = kind === "charset" || kind === "backdrop" ? asset(kind, "new") : media(kind, "new");
        const key = index === 26 || index === 29 ? "value" : "resourceId";
        const id = key === "value" ? "m2-command-value-resource-picker" : "m2-command-resourceId-picker";
        const nameId = key === "value" ? "m2-command-value-resource-selected-name" : "m2-command-resourceId-selected-name";
        const previewId = key === "value" ? "m2-command-value-resource-preview" : "m2-command-resourceId-preview";
        focus = scope.locator(`[data-custom-select-for="${id}"]`);
        const retained = await focus.elementHandle(); assert.ok(retained);
        for (const resource of [b, a, b]) {
          await choose(scope, id, resource.id);
          assert.equal(await scope.getByTestId(nameId).textContent(), resource.name);
          assert.equal(await scope.getByTestId(previewId).getAttribute("data-resource-id"), resource.id);
          if (kind !== "music" && kind !== "sound") assert.equal(await scope.getByTestId(previewId).locator("img").getAttribute("src"), resource.dataUrl);
          assert.equal(await retained.evaluate(node => node.isConnected && node === document.activeElement), true);
        }
        await retained.dispose(); expected.fields[key] = b.id;
      } else if ([203, 204, 207, 74].includes(index)) {
        const key = index === 203 || index === 74 ? "mapId" : "eventId";
        const values = key === "mapId" ? [MAP_B, MAP_A, MAP_B] : [EVENT_B, HOST, EVENT_B];
        const id = `m2-command-${key}-record-select`; focus = scope.locator(`[data-custom-select-for="${id}"]`);
        const retained = await focus.elementHandle(); assert.ok(retained);
        for (const value of values) {
          await choose(scope, id, value);
          const name = await scope.getByTestId(`m2-command-${key}-record-selected-name`).textContent();
          assert.equal(name, key === "mapId" ? fixture.maps[value]?.name : `${fixture.maps[MAP_A]?.name} / ${value} (${value === HOST ? "2, 2" : "4, 4"})`);
          assert.equal(await retained.evaluate(node => node.isConnected && node === document.activeElement), true);
        }
        await retained.dispose(); expected.fields[key] = values[2] ?? "";
        if (key === "mapId") { await labeledInput(scope, "m2-command-x-input", "0"); expected.fields.x = 0; }
        if (index === 207) assert.equal(await scope.getByTestId("m2-command-switchId-record-selected-name").textContent(), SWITCH.name);
      } else if (index === 217) {
        assert.equal(await scope.getByTestId("m2-command-variableId-record-selected-name").textContent(), VARIABLE.name);
        focus = scope.getByTestId("m2-command-variableId-record-open");
        const label = focus.locator("xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' field ')][1]/label");
        assert.equal(await label.evaluate(node => node instanceof HTMLLabelElement && node.control?.getAttribute("data-testid")), "m2-command-variableId-record-open");
      } else if (index === 213) {
        await labeledInput(scope, "m2-command-slotId-input", "u07-manual-9"); expected.fields.slotId = "u07-manual-9";
        const checkbox = scope.getByTestId("m2-command-restoreOnGameOver-checkbox");
        await checkbox.locator("xpath=../label").click(); assert.equal(await checkbox.isChecked(), false);
        expected.fields.restoreOnGameOver = false; focus = checkbox;
      } else if (index === 214) {
        await labeledInput(scope, "m2-command-message-textarea", "U07 changed message"); expected.fields.message = "U07 changed message";
        await labeledInput(scope, "m2-command-durationMs-input", "0"); expected.fields.durationMs = 0; focus = scope.getByTestId("m2-command-message-textarea");
      } else assert.fail(`Unmapped U07 command ${index}`);
      const dimensions = await geometry(scope, focus, join(out, `editor-${position}`));
      const confirmed = await confirmCommand(page, "map", [projectObservation(["maps", MAP_A, "events", 0, "pages", 0, "commands", position], expected)]);
      const saved = await readEditorProject(page);
      assert.deepEqual(saved.maps[MAP_A]?.events[0]?.pages?.[0]?.commands[position], expected);
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [position]);
      // Then: the same command reopens with the saved machine values; Cancel leaves the saved project intact.
      const reopened = await dialog(page).locator("input, textarea, select").evaluateAll(nodes => nodes.map(node => {
        if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) throw new Error("Expected form control");
        return { id: node.getAttribute("data-testid"), value: node.value };
      }));
      for (const entry of reopened) {
        if (entry.id?.endsWith("resource-select")) assert.equal(entry.value, expected.fields.value);
        if (entry.id === "m2-command-resourceId-picker") assert.equal(entry.value, expected.fields.resourceId);
        if (entry.id === "m2-command-mapId-record-select") assert.equal(entry.value, expected.fields.mapId);
      }
      await cancelCommand(page, saved); traces.push({ position, index, expected, dimensions, confirmed, reopened, canceled: true });
      await writeFile(join(out, "editor-progress.json"), JSON.stringify(traces, null, 2));
    }
    const saved = await readEditorProject(page); await page.getByTestId("event-editor-modal-close").click();
    await page.getByTestId("menu-project").click(); const downloading = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("menu-project-export").click(); const download = await downloading;
    const file = join(out, "editor-export.oprn"); await download.saveAs(file);
    const imported = await readProjectPackage(new Blob([await readFile(file)])); assert.deepEqual(imported, saved);
    await page.getByTestId("menu-project").click(); const choosing = page.waitForEvent("filechooser", { timeout: 15_000 });
    await page.getByTestId("menu-project-import").click(); const chooser = await choosing;
    await observeEditorAction(page, { timeoutMs: 15_000, mutation: '[data-testid="project-export-json"]',
      observe: [projectObservation([], JSON.parse(serialize(saved)))] }, () => chooser.setFiles(file));
    await openMapCommand(page, HOST, [0]); assert.equal(await dialog(page).getByTestId("change-actor-graphic-resource-select").inputValue(), asset("charset", "new").id);
    await cancelCommand(page, saved); assert.equal(calls.length, 2); local.assertNoRemoteWrites();
    await writeFile(join(out, "editor-exported.json"), serialize(imported));
    await writeFile(join(out, "editor-observations.json"), JSON.stringify({ traces, exportImport: true, aiHttpCalls: calls.length, remoteWrites: [] }, null, 2));
    return join(out, "editor-exported.json");
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png") });
    await writeFile(join(out, "editor-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`); throw error;
  } finally { await local.dispose(); }
}

if (process.env.U07_STANDALONE !== "1") test("U07 selected values survive Confirm Apply reopen Cancel and real file import", async ({ page, baseURL }, testInfo) => {
  assert.ok(baseURL); await proveEditor(page, baseURL, testInfo.outputPath("U07"));
});
