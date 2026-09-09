import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { readProjectPackage } from "../../src/project/package";
import { u14Fixture } from "../eventCommandRemediation/U14.fixture";
import { choose } from "../eventCommandRemediation/U07/browserControls";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, observeEditorAction } from "./eventCommandRemediationHarness";

export async function proveU14Editor(page: Page, url: string, out: string) {
  await mkdir(out, { recursive: true });
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
  const fixture = u14Fixture();
  const local = await enterLocalEditor(page, fixture, url);
  const traces = [];
  const path = ["maps", fixture.startMapId, "events", 0, "pages", 0, "commands"];
  try {
    await openMapCommand(page, "u14-host", [0]);
    for (let index = 0; index < 6; index++) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const scope = page.getByTestId("event-command-edit-dialog");
      const command = structuredClone(fixture.maps[fixture.startMapId]?.events[0]?.pages?.[0]?.commands[index]);
      assert.ok(command?.kind === "m2Command");
      if (index === 1 || index === 2) {
        assert.equal(await scope.locator('input,select,textarea').count(), 0);
      } else {
        const options = await scope.getByTestId("m2-command-resourceId-picker").locator("option").evaluateAll(nodes => nodes.map(node => node.getAttribute("value")));
        if (index === 0) {
          assert.ok(options.includes("u14-ambient") && options.includes("u14-se"));
          assert.ok(!options.some(value => value?.startsWith("easyrpg-charset")));
          await choose(scope, "m2-command-channel-option-select", "ambient");
          await choose(scope, "m2-command-resourceId-picker", "u14-ambient");
          await scope.getByTestId("m2-command-volume-input").fill("25");
          await scope.getByTestId("m2-command-volume-input").press("Tab");
          await scope.getByTestId("m2-command-fadeMs-input").fill("0");
          await scope.getByTestId("m2-command-fadeMs-input").press("Tab");
          Object.assign(command.fields, { channel: "ambient", resourceId: "u14-ambient", volume: 25, fadeMs: 0 });
        } else {
          const resourceId = index === 3 ? "u14-battle" : index === 4 ? "u14-defeat" : "u14-other";
          const slot = index === 3 ? "battle" : index === 4 ? "defeat" : "field";
          await choose(scope, "m2-command-slot-option-select", slot);
          await choose(scope, "m2-command-resourceId-picker", resourceId);
          assert.equal(options.includes(index === 4 ? "u14-field" : "u14-se"), false);
          Object.assign(command.fields, { slot, resourceId });
        }
      }
      await page.screenshot({ path: join(out, `editor-${index}.png`) });
      traces.push(await confirmCommand(page, "map", [projectObservation([...path, index], command)]));
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const saved = await readEditorProject(page);
      if (index === 0) {
        assert.equal(await scope.getByTestId("m2-command-channel-option-select").inputValue(), "ambient");
        assert.equal(await scope.getByTestId("m2-command-volume-input").inputValue(), "25");
        assert.equal(await scope.getByTestId("m2-command-fadeMs-input").inputValue(), "0");
      }
      await cancelCommand(page, saved);
    }
    // Enter on a command row is the product's insertion shortcut.
    await page.getByTestId("event-command-step-6").locator("..").press("Enter");
    await page.getByTestId("event-command-picker-search").fill("BGM 페이드아웃");
    await page.getByTestId("event-command-picker-search-results").locator('button[data-command-entry="m2-062-fadeout-bgm"]').click();
    await page.screenshot({ path: join(out, "editor-fadeout-alias.png") });
    traces.push(await confirmCommand(page, "map", [projectObservation([...path, 6], { kind: "stopAudio", channel: "bgm" })]));
    const saved = await readEditorProject(page);
    await page.getByTestId("event-editor-modal-close").click();
    await page.getByTestId("menu-project").click();
    const downloading = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("menu-project-export").click();
    const file = join(out, "editor-export.oprn"); await (await downloading).saveAs(file);
    const imported = await readProjectPackage(new Blob([await readFile(file)]));
    assert.deepEqual(imported, saved);
    await page.getByTestId("menu-project").click();
    const choosing = page.waitForEvent("filechooser", { timeout: 15_000 });
    await page.getByTestId("menu-project-import").click();
    const chooser = await choosing;
    traces.push(await observeEditorAction(page, { timeoutMs: 15_000, mutation: '[data-testid="project-export-json"]',
      observe: [projectObservation([], JSON.parse(serialize(saved)))] }, () => chooser.setFiles(file)));
    assert.deepEqual(await readEditorProject(page), saved);
    await openMapCommand(page, "u14-host", [6]);
    await page.screenshot({ path: join(out, "editor-reimported-fadeout.png") });
    await cancelCommand(page, saved);
    local.assertNoRemoteWrites();
    await writeFile(join(out, "editor-exported.json"), serialize(saved));
    await writeFile(join(out, "editor-observations.json"), JSON.stringify({ traces, exportImport: true, remoteWrites: [] }, null, 2));
    return join(out, "editor-exported.json");
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png") });
    await writeFile(join(out, "editor-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`);
    throw error;
  } finally { await local.dispose(); }
}

if (process.env.U14_STANDALONE !== "1") test("U14 audio selections survive Confirm Apply reopen and file export/import", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(180_000); assert.ok(baseURL);
  await proveU14Editor(page, baseURL, testInfo.outputPath("U14"));
});
