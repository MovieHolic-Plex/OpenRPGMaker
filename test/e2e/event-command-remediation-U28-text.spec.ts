import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test, firefox, type Page } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { readProjectPackage } from "../../src/project/package";
import { buildFixture, textFixture, textCommand, TEXT_MAP, TEXT_EVENT } from "../eventCommandRemediation/U28.fixture";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, observeEditorAction } from "./eventCommandRemediationHarness";

const viewports = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }] as const;
const bodyId = "event-command-text-body";
const bodySelector = `[data-testid="event-command-edit-dialog"] [data-testid="${bodyId}"]`;
const commandPath = ["maps", TEXT_MAP, "events", 0, "pages", 0, "commands", 0] as const;
const finalBody = "Hello\\n[2]\\v[2] world";
const dom = (id: string) => `[data-testid="${id}"]`;
const body = (page: Page) => page.locator(bodySelector);
const dialog = (page: Page) => page.getByTestId("event-command-edit-dialog");

async function choose(page: Page, tool: string, row: number) {
  const before = await body(page).inputValue();
  await observeEditorAction(page, { timeoutMs: 10_000,
    observe: [{ source: "dom", selector: dom("event-record-picker"), read: "present", equals: true }] },
  () => dialog(page).getByTestId(`event-command-text-tool-${tool}`).click());
  assert.equal(await body(page).inputValue(), before);
  await page.getByTestId(`event-record-picker-row-${row}`).click();
  await observeEditorAction(page, { timeoutMs: 10_000,
    observe: [{ source: "dom", selector: dom("event-record-picker"), read: "present", equals: false }] },
  () => page.getByTestId("event-record-picker-ok").click());
}
async function selection(page: Page, start: number, end = start) {
  await body(page).focus(); await body(page).press("Home");
  for (let index = 0; index < start; index++) await body(page).press("ArrowRight");
  for (let index = start; index < end; index++) await body(page).press("Shift+ArrowRight");
}
async function assertBody(page: Page, expected: string, range: readonly number[]) {
  assert.equal(await body(page).inputValue(), expected);
  assert.deepEqual(await body(page).evaluate(node => {
    if (!(node instanceof HTMLTextAreaElement)) throw new TypeError("Expected textarea");
    return { range: [node.selectionStart, node.selectionEnd], focused: document.activeElement === node };
  }), { range, focused: true });
}
async function geometry(page: Page, out: string, surface: string) {
  const measurements = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const id = surface === "picker" ? "event-record-picker" : "event-command-edit-dialog";
    const measured = await page.getByTestId(id).evaluate(node => ({
      overflow: node.scrollWidth > node.clientWidth, focused: document.activeElement?.getAttribute("data-testid"),
      actions: [...node.querySelectorAll('button[data-testid$="-ok"], button[data-testid$="-cancel"]')].map(action => {
        const r = action.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      }),
    }));
    assert.equal(measured.overflow, false); assert.ok(measured.actions.length > 0);
    for (const r of measured.actions) assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height);
    measurements.push({ ...viewport, ...measured });
    await page.screenshot({ path: join(out, `${surface}-${viewport.width}.png`) });
  }
  return measurements;
}

export async function proveEditor(page: Page, url: string, options: { readonly out: string; readonly legacy: boolean }) {
  // Given: unequal first/selected records, with a real raw209 fixture only on the load case.
  const { out, legacy } = options; await mkdir(out, { recursive: true }); page.setDefaultTimeout(15_000);
  const initial = { ...textFixture(), ...(legacy ? { autoAdvance: true } : {}) };
  const fixture = buildFixture(legacy ? { kind: "m2Command", commandId: "m2-209-advanced-dialogue",
    fields: { body: initial.body, speaker: initial.speaker, emotion: initial.emotion, autoAdvance: true } } : initial);
  fixture.variables.push({ id: "legacy_reward", name: "Unsupported reward" }, { id: "v2", name: "Shadowed reward" });
  fixture.session.variables.legacy_reward = 91; fixture.session.variables.v2 = 73;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const consoleErrors: string[] = []; page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  let local: Awaited<ReturnType<typeof enterLocalEditor>> | undefined; const traces: unknown[] = [];
  try {
    local = await enterLocalEditor(page, fixture, url);
    const booted = await readEditorProject(page); assert.deepEqual(textCommand(booted), initial);
    await writeFile(join(out, "boot.json"), JSON.stringify({ raw: textCommand(fixture), loaded: textCommand(booted), legacy }, null, 2));
    await openMapCommand(page, TEXT_EVENT);
    if (!legacy) {
      // When: replace a range; Cancel the command; Cancel a picker; inspect unavailable rows; create a variable.
      await selection(page, 6, 11); await choose(page, "hero-name", 2);
      await assertBody(page, "Hello \\n[2]", [11, 11]); await cancelCommand(page, booted);
      await openCommandRow(page, page.getByTestId("event-editor-modal"));
      await selection(page, 6, 11); await dialog(page).getByTestId("event-command-text-tool-variable").click();
      await page.getByTestId("event-record-picker").locator(".event-subdialog-close").click();
      await assertBody(page, initial.body, [6, 11]);
      await dialog(page).getByTestId("event-command-text-tool-variable").click();
      for (const id of ["legacy_reward", "v2"]) {
        const row = page.getByTestId(`event-record-picker-row-${booted.variables.findIndex(record => record.id === id) + 1}`);
        assert.equal(await row.isVisible(), true); assert.equal(await row.isDisabled(), true);
        assert.equal(await row.getAttribute("aria-selected"), "false");
        const reason = await row.getAttribute("title"); assert.ok(reason);
        assert.ok((await row.locator(".event-record-picker-row-meta").innerText()).includes(reason));
      }
      traces.push({ disabledPicker: await geometry(page, out, "picker") });
      await page.getByTestId("event-record-picker-search").fill("Fresh reward");
      const freshIndex = booted.variables.findIndex(record => record.id === "var_0003");
      assert.ok(freshIndex >= 0); assert.equal(booted.variables[freshIndex]?.name, "");
      await observeEditorAction(page, { timeoutMs: 10_000, mutation: dom("project-export-json"),
        observe: [projectObservation(["variables", freshIndex], { id: "var_0003", name: "Fresh reward" })] },
      () => page.getByTestId("event-record-picker-add").click());
      await page.getByTestId("event-record-picker-ok").click();
      await assertBody(page, "Hello \\v[3]", [11, 11]);
      const created = await readEditorProject(page); assert.deepEqual(textCommand(created), initial);
      await cancelCommand(page, created); await openCommandRow(page, page.getByTestId("event-editor-modal"));
      traces.push({ selectedRange: true, pickerCancel: true, disabledIds: ["legacy_reward", "v2"], createdId: "var_0003" });
    }
    const before = await readEditorProject(page);
    // When: choose Other and Reward at the retained caret, then Confirm and parent Apply.
    await selection(page, 5); await choose(page, "hero-name", 2); await assertBody(page, "Hello\\n[2] world", [10, 10]);
    await choose(page, "variable", 2); await assertBody(page, finalBody, [15, 15]);
    traces.push({ composer: await geometry(page, out, "composer") });
    const expected = { ...initial, body: finalBody };
    traces.push(await confirmCommand(page, "map", [projectObservation(commandPath, expected)]));
    const saved = await readEditorProject(page);
    const expectedProject = structuredClone(before);
    const eventPage = expectedProject.maps[TEXT_MAP]?.events[0]?.pages?.[0]; assert.ok(eventPage);
    eventPage.commands[0] = expected;
    assert.deepEqual(saved, expectedProject);
    await openCommandRow(page, page.getByTestId("event-editor-modal"));
    assert.equal(await body(page).inputValue(), finalBody);
    await body(page).fill("Discard this different edit"); await cancelCommand(page, saved);
    await observeEditorAction(page, { timeoutMs: 10_000, mutation: dom("project-export-json"),
      observe: [projectObservation(commandPath, expected)] }, () => page.getByTestId("event-editor-apply").click());
    assert.deepEqual(await readEditorProject(page), saved);
    await page.getByTestId("event-editor-modal-close").click();
    // Then: the real downloaded package and filechooser import preserve all metadata and unrelated data.
    await page.getByTestId("menu-project").click(); const downloading = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByTestId("menu-project-export").click(); const download = await downloading;
    const exported = join(out, "editor-export.oprn"); await download.saveAs(exported);
    const imported = await readProjectPackage(new Blob([await readFile(exported)])); assert.deepEqual(imported, saved);
    await page.getByTestId("menu-project").click(); const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
    await page.getByTestId("menu-project-import").click(); const chooser = await choosing;
    await observeEditorAction(page, { timeoutMs: 10_000, mutation: dom("project-export-json"),
      observe: [projectObservation([], JSON.parse(serialize(saved)))] }, () => chooser.setFiles(exported));
    assert.deepEqual(await readEditorProject(page), saved);
    await openMapCommand(page, TEXT_EVENT); assert.equal(await body(page).inputValue(), finalBody);
    await cancelCommand(page, saved); await page.getByTestId("event-editor-modal-close").click();
    local.assertNoRemoteWrites(); assert.deepEqual(errors, []);
    await writeFile(join(out, "editor-exported.json"), serialize(imported));
    await writeFile(join(out, "editor-observations.json"), JSON.stringify({ status: "PASS", legacy, traces, expected,
      entireProjectEqual: true, downloadedPackageImported: true, remoteWrites: [], errors,
      observationReleased: await page.evaluate(() => !window.__eventCommandQa) }, null, 2));
    return join(out, "editor-exported.json");
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png") });
    await writeFile(join(out, "editor-failure.json"), JSON.stringify({ error: String(error), errors, consoleErrors, traces, surface: await page.locator("body").innerText() }, null, 2));
    throw error;
  } finally { await local?.dispose(); }
}

async function standalone() {
  const evidence = ".omo/evidence/event-command-remediation/U28/G1-F18";
  const out = await mkdtemp(join(evidence, "surface-")); const owned = await mkdtemp(join(evidence, "tmp-"));
  const probe = createServer(); const listening = once(probe, "listening", { signal: AbortSignal.timeout(10_000) });
  probe.listen(0, "127.0.0.1"); await listening;
  const address = probe.address(); assert.ok(address && typeof address !== "string"); const port = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
    env: { ...process.env, VITE_CACHE_DIR: join(process.cwd(), owned, "editor-cache"), E2E_FREEZE_DEV_SERVER: "1",
      VITE_LEGACY_DB_URL: "", VITE_LEGACY_DB_ANON_KEY: "", VITE_LEGACY_DB_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new TypeError("Owned editor readiness timeout")), 30_000);
      server.once("error", error => { clearTimeout(timeout); reject(error); });
      server.once("exit", code => { clearTimeout(timeout); reject(new TypeError(`Owned editor exit ${code}`)); });
      server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes(url)) { clearTimeout(timeout); resolve(); } });
      server.stderr.on("data", data => process.stderr.write(data));
    });
    browser = await firefox.launch({ headless: true }); let exported = "";
    for (const legacy of [false, true]) {
      const context = await browser.newContext({ viewport: viewports[1] });
      try {
        const file = await proveEditor(await context.newPage(), url, { out: join(out, legacy ? "raw209" : "native"), legacy });
        if (!legacy) exported = file;
      } finally { await context.close(); }
    }
    console.log(`EDITOR PASS: 2 cases ${out}`);
    const player = spawn("node", ["scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs", exported, out], { stdio: "inherit" });
    try { const [code] = await once(player, "exit", { signal: AbortSignal.timeout(240_000) }); assert.equal(code, 0); }
    finally {
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
    console.log(`U28 G1-F18 evidence ${out}`);
  }
}
if (process.env.U28_TEXT_STANDALONE === "1") await standalone();
else for (const legacy of [false, true]) test(`G1-F18 selected text survives real editor boundaries when legacy=${legacy}`, async ({ page, baseURL }, testInfo) => {
  test.setTimeout(240_000); assert.ok(baseURL); await proveEditor(page, baseURL, { out: testInfo.outputPath("G1-F18"), legacy });
});
