import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { readProjectPackage } from "../../src/project/package";
import { buildFixture, HOME, HOST, SELECTED, UNKNOWN, m2, storedCommand } from "../eventCommandRemediation/U10.fixture";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, observeEditorAction } from "./eventCommandRemediationHarness";

const viewports = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }] as const;
const target = (page: Page) => page.getByTestId("event-command-edit-dialog").getByTestId("m2-erase-event-target");

async function selectTarget(page: Page, value: string) {
  const native = target(page);
  const custom = page.getByTestId("event-command-edit-dialog").locator('[data-custom-select-for="m2-erase-event-target"]');
  if (await custom.isVisible()) {
    const index = await native.evaluate((node, selected) => {
      if (!(node instanceof HTMLSelectElement)) throw new Error("Erase target is not a select");
      return [...node.options].findIndex(option => option.value === selected);
    }, value);
    assert.ok(index >= 0);
    await custom.click();
    await page.locator(`.event-custom-select-popover button[data-option-index="${index}"]`).click();
  } else await native.selectOption(value);
  assert.equal(await native.inputValue(), value);
}

export async function proveEraseEditor(page: Page, url: string, out: string) {
  // Given: original U10 fixture, cloned only for this disposable surface narrative.
  await mkdir(out, { recursive: true });
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
  const fixture = buildFixture();
  fixture.startPos = { x: 2, y: 3 };
  if (fixture.system.titleScreen) fixture.system.titleScreen.musicResourceId = "";
  const host = fixture.maps[HOME]?.events.find(event => event.id === HOST);
  const eventPage = host?.pages?.[0]; assert.ok(eventPage);
  eventPage.commands = [m2("Erase Event", { futureOption: "retained" }),
    m2("Erase Event", { eventId: SELECTED }), m2("Erase Event", { eventId: UNKNOWN })];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: { readonly url: string; readonly failure: unknown }[] = [];
  const bootResponses: { readonly path: string; readonly status: number }[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", request => failedRequests.push({ url: request.url(), failure: request.failure() }));
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (path === "/" || path === "/src/main.ts" || path === "/src/styles/index.css") {
      bootResponses.push({ path, status: response.status() });
    }
  });
  const local = await enterLocalEditor(page, fixture, url).catch(async (error: unknown) => {
    await page.screenshot({ path: join(out, "boot-failure.png") });
    await writeFile(join(out, "boot-failure.json"), JSON.stringify({
      error: String(error), pageErrors, consoleErrors, failedRequests, bootResponses,
      document: await page.evaluate(() => ({
        url: location.href, state: document.readyState, title: document.title,
        scripts: [...document.scripts].map(script => new URL(script.src || location.href).pathname),
      })),
      body: await page.locator("body").innerText(),
    }, null, 2));
    throw error;
  });
  const traces = [];
  try {
    await openMapCommand(page, HOST, [0]);
    for (const [index, selected] of [SELECTED, "", UNKNOWN].entries()) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const before = await readEditorProject(page);
      // When: real target selection, Confirm, parent Apply, reopen, changed draft, Cancel.
      await selectTarget(page, selected);
      assert.deepEqual(await readEditorProject(page), before);
      const command = m2("Erase Event", { ...(index === 0 ? { futureOption: "retained" } : {}), eventId: selected });
      const confirmed = await confirmCommand(page, "map", [
        projectObservation(["maps", HOME, "events", 0, "pages", 0, "commands", index], command),
      ]);
      const saved = await readEditorProject(page);
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      assert.equal(await target(page).inputValue(), selected);
      const geometry = [];
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        const visible = page.getByTestId("event-command-edit-dialog").locator('[data-custom-select-for="m2-erase-event-target"]');
        await (await visible.isVisible() ? visible : target(page)).focus();
        const bounds = await page.getByTestId("event-command-edit-dialog").evaluate(node => ({
          overflow: node.scrollWidth > node.clientWidth,
          actions: [...node.querySelectorAll('[data-testid="event-command-edit-ok"], [data-testid="event-command-edit-cancel"]')].map(action => {
            const r = action.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          }), focused: document.activeElement?.getAttribute("data-testid"),
        }));
        assert.equal(bounds.overflow, false); assert.equal(bounds.actions.length, 2);
        for (const r of bounds.actions) assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height);
        geometry.push({ ...viewport, ...bounds });
        await page.screenshot({ path: join(out, `editor-${index}-${viewport.width}.png`), fullPage: false });
      }
      await selectTarget(page, HOST);
      await cancelCommand(page, saved);
      traces.push({ index, command, confirmed, geometry, canceled: true });
    }
    // Then: actual downloaded package and filechooser import preserve the complete payload.
    const saved = await readEditorProject(page);
    assert.equal(storedCommand(saved).fields.eventId, SELECTED);
    await page.getByTestId("event-editor-modal-close").click();
    await page.getByTestId("menu-project").click();
    const downloading = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("menu-project-export").click();
    const download = await downloading;
    const exported = join(out, "editor-export.oprn"); await download.saveAs(exported);
    const imported = await readProjectPackage(new Blob([await readFile(exported)]));
    assert.deepEqual(imported, saved);
    await page.getByTestId("menu-project").click();
    const choosing = page.waitForEvent("filechooser", { timeout: 15_000 });
    await page.getByTestId("menu-project-import").click();
    const chooser = await choosing;
    await observeEditorAction(page, { timeoutMs: 15_000, mutation: '[data-testid="project-export-json"]',
      observe: [projectObservation([], JSON.parse(serialize(saved)))] }, () => chooser.setFiles(exported));
    await openMapCommand(page, HOST, [0]);
    for (const [index, selected] of [SELECTED, "", UNKNOWN].entries()) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      assert.equal(await target(page).inputValue(), selected);
      await cancelCommand(page, saved);
    }
    local.assertNoRemoteWrites();
    await writeFile(join(out, "editor-exported.json"), serialize(imported));
    await writeFile(join(out, "editor-observations.json"), JSON.stringify({
      traces, exportImport: true, remoteWrites: [], pageErrors, consoleErrors, failedRequests,
    }, null, 2));
    return join(out, "editor-exported.json");
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png") });
    await writeFile(join(out, "editor-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`);
    throw error;
  } finally { await local.dispose(); }
}

if (process.env.U10_ERASE_STANDALONE !== "1") {
  test("preserves selected erase intent when Confirm Apply reopen Cancel and file export import run", async ({ page, baseURL }, testInfo) => {
    assert.ok(baseURL);
    await proveEraseEditor(page, baseURL, testInfo.outputPath("U10-erase"));
  });
}
