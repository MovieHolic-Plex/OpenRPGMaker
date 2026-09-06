import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test, firefox, type Page, type Locator } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { readProjectPackage } from "../../src/project/package";
import type { Command } from "../../src/project/types";
import { buildFixture, CUSTOM_FOLLOWER, CUSTOM_GRAPHIC, HERO_ID } from "../eventCommandRemediation/U06.fixture";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, observeEditorAction } from "./eventCommandRemediationHarness";

const dialog = (page: Page) => page.getByTestId("event-command-edit-dialog");
const control = (scope: Locator, id: string) => scope.getByTestId(`event-command-${id}`);
const viewports = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }] as const;
const expected: readonly Command[] = [
  { kind: "removeFollower", name: "Bob" }, { kind: "removeFollower", all: true },
  { kind: "addFollower", actorId: HERO_ID, name: "Hero" },
  { ...CUSTOM_FOLLOWER, name: "Hero renamed", graphic: { ...CUSTOM_GRAPHIC, scale: 2, direction: "up", pattern: 1 } },
  { kind: "addFollower", name: "Mascot", graphic: CUSTOM_GRAPHIC },
];

async function fill(scope: Locator, id: string, value: string) {
  await control(scope, id).fill(value);
  await control(scope, id).press("Tab");
}
async function select(scope: Locator, id: string, value: string) {
  const native = control(scope, id);
  const index = await native.evaluate((node, value) => {
    if (!(node instanceof HTMLSelectElement)) throw new Error("Expected native select");
    return [...node.options].findIndex(option => option.value === value);
  }, value);
  assert.ok(index >= 0);
  await scope.locator(`[data-custom-select-for="event-command-${id}"]`).click();
  await scope.page().locator(`.event-custom-select-popover button[data-option-index="${index}"]`).click();
  assert.equal(await native.inputValue(), value);
}
async function checkReopened(scope: Locator, index: number) {
  if (index < 2) {
    assert.equal(await control(scope, "remove-follower-mode").inputValue(), index === 0 ? "name" : "all");
    if (index === 0) assert.equal(await control(scope, "remove-follower-name").inputValue(), "Bob");
  } else {
    assert.equal(await control(scope, "add-follower-use-graphic").isChecked(), index !== 2);
    assert.equal(await control(scope, "add-follower-name").inputValue(), ["Hero", "Hero renamed", "Mascot"][index - 2]);
    if (index !== 2) {
      assert.equal(await control(scope, "add-follower-graphic-id").inputValue(), "charsetB");
      assert.equal(await control(scope, "add-follower-graphic-frame").inputValue(), index === 3 ? "1" : "2");
      assert.equal(await control(scope, "add-follower-graphic-direction").inputValue(), index === 3 ? "up" : "left");
    }
  }
}

export async function proveEditor(page: Page, url: string, out: string) {
  // Given: five independently editable command payloads, no remote authored content.
  await mkdir(out, { recursive: true }); page.setDefaultTimeout(15_000);
  const fixture = buildFixture();
  const map = fixture.maps[fixture.startMapId]; assert.ok(map);
  const event = map.events[0]; assert.ok(event);
  const eventPage = event.pages?.[0]; assert.ok(eventPage);
  const commands: Command[] = [{ kind: "removeFollower", name: "Alice" }, { kind: "removeFollower", name: "Bob" },
    structuredClone(CUSTOM_FOLLOWER), { ...CUSTOM_FOLLOWER, graphic: { ...CUSTOM_GRAPHIC, scale: 2 } },
    { kind: "addFollower", name: "Mascot", graphic: CUSTOM_GRAPHIC }];
  event.commands = commands; eventPage.commands = commands; fixture.startPos = { x: 2, y: 3 };
  if (fixture.system.titleScreen) fixture.system.titleScreen.musicResourceId = "";
  const local = await enterLocalEditor(page, fixture, url);
  const traces = [];
  try {
    await openMapCommand(page, "u06-host", [0]);
    for (const [index, command] of expected.entries()) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const scope = dialog(page); const before = await readEditorProject(page);
      // When: operate the visible form, including the two original invalid-name inputs.
      switch (index) {
        case 0:
          await select(scope, "remove-follower-mode", "name");
          for (const value of ["", "   "]) {
            await fill(scope, "remove-follower-name", value);
            const rejected = await observeEditorAction(page, { timeoutMs: 10_000,
              event: { selector: '[data-testid="event-command-remove-follower-name"]', type: "focus" },
              observe: [{ source: "dom", selector: '[data-testid="event-command-edit-dialog"]', read: "present", equals: true }] },
            () => control(scope, "edit-ok").click());
            assert.equal(await control(scope, "remove-follower-name").evaluate(node => node === document.activeElement), true);
            assert.equal(await control(scope, "remove-follower-name").evaluate(node => node instanceof HTMLInputElement && node.validity.valid), false);
            assert.deepEqual(await readEditorProject(page), before); traces.push({ index, value, rejected });
          }
          await fill(scope, "remove-follower-name", "  Bob  "); break;
        case 1: await select(scope, "remove-follower-mode", "all"); break;
        case 2: await control(scope, "add-follower-use-graphic").uncheck(); break;
        case 3: {
          const retained = await control(scope, "add-follower-graphic-frame").elementHandle(); assert.ok(retained);
          await select(scope, "add-follower-graphic-direction", "up");
          await fill(scope, "add-follower-graphic-frame", "1");
          await control(scope, "add-follower-use-graphic").uncheck();
          await fill(scope, "add-follower-name", "Hero renamed");
          await control(scope, "add-follower-use-graphic").check();
          assert.equal(await retained.evaluate(node => node.isConnected && node === document.querySelector('[data-testid="event-command-edit-dialog"] [data-testid="event-command-add-follower-graphic-frame"]')), true);
          await checkReopened(scope, index); await retained.dispose(); break;
        }
        case 4: break;
        default: assert.fail(`Unexpected fixture index ${index}`);
      }
      const path = ["maps", fixture.startMapId, "events", 0, "pages", 0, "commands", index];
      const confirmed = await confirmCommand(page, "map", [projectObservation(path, command)]);
      const saved = await readEditorProject(page);
      assert.deepEqual(JSON.parse(serialize(saved)).maps[fixture.startMapId].events[0].pages[0].commands[index], command);
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      await checkReopened(dialog(page), index);
      const geometry = [];
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await control(dialog(page), index < 2 ? "remove-follower-name" : "add-follower-name").focus();
        const bounds = await dialog(page).evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth,
          actions: [...node.querySelectorAll('[data-testid="event-command-edit-ok"], [data-testid="event-command-edit-cancel"]')].map(action => {
            const r = action.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          }), focused: document.activeElement?.getAttribute("data-testid") }));
        assert.equal(bounds.overflow, false);
        for (const r of bounds.actions) assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height);
        geometry.push({ ...viewport, ...bounds });
        await page.screenshot({ path: join(out, `editor-${index}-${viewport.width}.png`), fullPage: false });
      }
      if (index < 2) await fill(dialog(page), "remove-follower-name", "");
      else {
        if (index !== 2) await control(dialog(page), "add-follower-use-graphic").uncheck();
        await fill(dialog(page), "add-follower-name", "Discarded");
      }
      await cancelCommand(page, saved);
      traces.push({ index, confirmed, saved: command, geometry, canceled: true });
    }
    // Then: a real downloaded package imports unchanged and every dialog reopens correctly.
    const saved = await readEditorProject(page);
    await page.getByTestId("event-editor-modal-close").click();
    await page.getByTestId("menu-project").click();
    const downloading = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("menu-project-export").click();
    const download = await downloading; const exported = join(out, "editor-export.oprn");
    await download.saveAs(exported);
    const bytes = await readFile(exported);
    const imported = await readProjectPackage(new Blob([bytes])); assert.deepEqual(imported, saved);
    await page.getByTestId("menu-project").click();
    const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
    await page.getByTestId("menu-project-import").click(); const chooser = await choosing;
    await observeEditorAction(page, { timeoutMs: 10_000, mutation: '[data-testid="project-export-json"]',
      observe: [projectObservation([], JSON.parse(serialize(saved)))] }, () => chooser.setFiles(exported));
    await openMapCommand(page, "u06-host", [0]);
    for (const [index] of expected.entries()) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      await checkReopened(dialog(page), index); await cancelCommand(page, saved);
    }
    local.assertNoRemoteWrites();
    await writeFile(join(out, "editor-exported.json"), serialize(imported));
    await writeFile(join(out, "editor-observations.json"), JSON.stringify({ traces, exportImport: true, remoteWrites: [] }, null, 2));
    return join(out, "editor-exported.json");
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png") });
    await writeFile(join(out, "editor-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`); throw error;
  } finally { await local.dispose(); }
}

async function standalone() {
  const evidence = ".omo/evidence/event-command-remediation/U06";
  const out = await mkdtemp(join(evidence, "surface-"));
  const owned = await mkdtemp(join(evidence, "tmp-"));
  const probe = createServer(); const listening = once(probe, "listening", { signal: AbortSignal.timeout(10_000) });
  probe.listen(0, "127.0.0.1"); await listening;
  const address = probe.address(); assert.ok(address && typeof address !== "string"); const port = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
    env: { ...process.env, VITE_CACHE_DIR: join(process.cwd(), owned, "editor-cache"), E2E_FREEZE_DEV_SERVER: "1",
      VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Owned editor readiness timeout")), 30_000);
      server.once("error", error => { clearTimeout(timeout); reject(error); });
      server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Owned editor exit ${code}`)); });
      server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes(url)) { clearTimeout(timeout); resolve(); } });
      server.stderr.on("data", data => process.stderr.write(data));
    });
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({ viewport: viewports[1] });
    const exported = await proveEditor(await context.newPage(), url, out); await context.close();
    console.log(`EDITOR PASS ${out}`);
    const player = spawn("node", ["scripts/qa/runtime/event-command-remediation-u06.scenario.mjs", exported, out], { stdio: "inherit" });
    try {
      const [code] = await once(player, "exit", { signal: AbortSignal.timeout(240_000) }); assert.equal(code, 0);
    } finally {
      if (player.exitCode === null && player.signalCode === null) {
        const exited = once(player, "exit", { signal: AbortSignal.timeout(10_000) }); player.kill("SIGTERM"); await exited;
      }
    }
  } finally {
    await browser?.close();
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) }); server.kill("SIGTERM"); await exited;
    }
    await rm(owned, { recursive: true, force: true });
    await writeFile(join(out, "editor-cleanup.json"), JSON.stringify({ port, serverClosed: true, browserClosed: true, owned, temporaryDirectoryRemoved: true }, null, 2));
    console.log(`U06 evidence ${out}`);
  }
}
if (process.env.U06_STANDALONE === "1") await standalone();
else test("U06 follower intent survives Confirm Apply export import and Cancel", async ({ page, baseURL }, testInfo) => {
  assert.ok(baseURL); await proveEditor(page, baseURL, testInfo.outputPath("U06"));
});
