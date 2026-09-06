import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test, firefox, type Page, type Locator } from "@playwright/test";
import { serialize } from "../../src/project/io";
import { buildFixture } from "../eventCommandRemediation/U02.fixture";
import type { Command } from "../../src/project/types";
import {
  enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand,
  readEditorProject, projectObservation, reimportProject, observeEditorAction, pickCommand,
} from "./eventCommandRemediationHarness";

const rootPath = ["maps", "map_intro", "events", 0, "pages", 0, "commands"] as const;
const ids = ["G1-F5", "G1-F14", "G1-F13", "G1-F4", "G1-F15"];
const dialog = (page: Page) => page.getByTestId("event-command-edit-dialog").last();

async function fill(scope: Locator, id: string, value: string) {
  const input = scope.getByTestId(id);
  await input.fill(value);
  await input.press("Tab");
}

async function select(page: Page, scope: Locator, id: string, value: string) {
  const native = scope.getByTestId(id).first();
  const index = await native.evaluate((node, value) => [...(node as HTMLSelectElement).options].findIndex(option => option.value === value), value);
  assert.ok(index >= 0, `${id} offers ${value}`);
  await scope.locator(`[data-custom-select-for="${id}"]`).first().click();
  await page.locator(`.event-custom-select-popover button[data-option-index="${index}"]`).click();
  assert.equal(await native.inputValue(), value);
}

async function pickVariable(page: Page, scope: Locator, id: string, name: string) {
  await scope.getByTestId(id).getByTestId("event-variable-picker-open").click();
  await page.getByTestId("event-record-picker-search").fill(name);
  await page.getByRole("option").filter({ has: page.locator(`.event-record-picker-row-name`, { hasText: name }) }).click();
  await page.getByTestId("event-record-picker-ok").click();
  assert.equal(await scope.getByTestId(id).locator("select").inputValue(), name);
}

export async function proveEditor(page: Page, url: string, out: string) {
  await mkdir(out, { recursive: true });
  page.setDefaultTimeout(15_000);
  const fixture = buildFixture();
  const local = await enterLocalEditor(page, fixture, url);
  const traces: unknown[] = [];
  try {
    await openMapCommand(page, "host", [0]);
    for (const [index, id] of ids.entries()) {
      if (id === "G1-F15") {
        await pickCommand(page, { search: "숫자 입력", commandId: "m2-005-input-number" }, page.getByTestId("event-editor-modal").getByTestId("event-command-empty-line"));
      } else if (index > 0) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const scope = dialog(page);
      const before = await readEditorProject(page);
      const source: Command = before.maps.map_intro!.events[0]!.pages![0]!.commands[index]
        ?? { kind: "inputNumber", variableId: "", digits: 1 };
      const expected = structuredClone(source);
      const dir = join(out, id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "serialized-before.json"), serialize(before));
      if (expected.kind === "fork") {
        await select(page, scope, "event-condition-variable-op", "<=");
        await fill(scope, "event-condition-variable-value", "1");
        assert.equal(await scope.getByTestId("event-condition-eval").getAttribute("data-eval-ok"), "false");
        await fill(scope, "event-condition-variable-value", "50");
        await pickVariable(page, scope, "event-condition-variable-target", "other");
        assert.equal(await scope.getByTestId("event-condition-eval").getAttribute("data-eval-ok"), "true");
        expected.condition = { kind: "variable", variableId: "other", op: "<=", value: 50 };
      } else if (expected.kind === "choices") {
        await scope.getByTestId("event-choice-remove-1").click();
        await page.getByTestId("app-modal-cancel").click();
        assert.equal(await scope.getByTestId("event-choice-option-1").inputValue(), "A");
        await scope.getByTestId("event-choice-remove-2").click();
        assert.equal(await page.getByTestId("app-alert-modal").count(), 1);
        await page.getByTestId("app-modal-confirm").click();
        assert.equal(await scope.getByTestId("event-choice-option-2").inputValue(), "B");
        await scope.getByTestId("event-choice-remove-1").click();
        await observeEditorAction(page, { timeoutMs: 10_000, observe: [{ source: "dom", selector: '[data-testid="event-command-edit-dialog"] [data-testid="event-choice-option-1"]', read: "property", name: "value", equals: "B" }] },
          () => page.getByTestId("app-modal-confirm").click());
        assert.equal(await scope.getByTestId("event-choice-option-1").evaluate(node => node === document.activeElement), true);
        expected.options = expected.options.slice(1);
        expected.cancelBehavior = "choice1";
      } else if (expected.kind === "inputNumber") {
        assert.equal(await scope.getByTestId("input-number-variable").locator("select").inputValue(), "");
        await fill(scope, "input-number-prompt", "Code");
        await scope.getByTestId("event-command-edit-ok").click();
        assert.equal(await scope.count(), 1);
        assert.equal(await scope.getByTestId("input-number-variable").getAttribute("aria-invalid"), "true");
        await pickVariable(page, scope, "input-number-variable", "answer");
        await scope.getByTestId("input-number-digit-chip-3").click();
        await scope.getByTestId("input-number-show-pad").uncheck();
        expected.variableId = "answer"; expected.prompt = "Code"; expected.digits = 3;
        delete expected.showPad;
      } else if (expected.kind === "timer") {
        await select(page, scope, "event-command-timer-id", "timer2");
        await select(page, scope, "event-command-timer-start-mode", "restart");
        await fill(scope, "event-command-timer-seconds", "23");
        await select(page, scope, "event-command-timer-start-mode", "resume");
        assert.equal(await scope.getByTestId("event-command-timer-seconds").isVisible(), false);
        await select(page, scope, "event-command-timer-action", "stop");
        await select(page, scope, "event-command-timer-action", "start");
        expected.timerId = "timer2";
        delete expected.seconds;
      } else if (expected.kind === "loop") {
        assert.equal(await scope.getByTestId("event-loop-no-break-warning").isVisible(), true);
        await fill(scope, "event-loop-body-text-0", "Edited");
        await scope.getByTestId("event-loop-body-edit-0").click();
        await fill(dialog(page), "event-command-text-speaker", "Discard child");
        await dialog(page).getByTestId("event-command-edit-cancel").click();
        await scope.getByTestId("event-loop-body-edit-0").click();
        assert.equal(await dialog(page).getByTestId("event-command-text-speaker").inputValue(), "NPC");
        await fill(dialog(page), "event-command-text-speaker", "Edited NPC");
        await dialog(page).getByTestId("event-command-edit-ok").click();
        expected.body[0] = { ...expected.body[0], body: "Edited", speaker: "Edited NPC" } as typeof expected.body[0];
      }
      await page.screenshot({ path: join(dir, "editor-confirm.png"), fullPage: false });
      const confirm = await confirmCommand(page, "map", [projectObservation([...rootPath, index], JSON.parse(JSON.stringify(expected)))]);
      const saved = await readEditorProject(page);
      const actual = saved.maps.map_intro!.events[0]!.pages![0]!.commands[index];
      assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
      await writeFile(join(dir, "serialized-after.json"), serialize(saved));
      await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      const reopened = dialog(page);
      const geometry = [];
      for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
        await page.setViewportSize({ width: width!, height: height! });
        await reopened.getByTestId("event-command-edit-ok").scrollIntoViewIfNeeded();
        const bounds = await reopened.evaluate(node => {
          const ok = node.querySelector('[data-testid="event-command-edit-ok"]')!.getBoundingClientRect();
          return { overflow: node.scrollWidth > node.clientWidth, top: ok.top, bottom: ok.bottom, height: innerHeight };
        });
        assert.equal(bounds.overflow, false); assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.height);
        geometry.push({ width, ...bounds });
        await page.screenshot({ path: join(dir, `editor-reopen-${width}.png`), fullPage: false });
      }
      if (expected.kind === "fork") {
        assert.equal(await reopened.getByTestId("event-condition-variable-value").inputValue(), "50");
        await fill(reopened, "event-condition-variable-value", "999");
        for (const mode of ["all", "any", "not"]) {
          await select(page, reopened, "event-condition-mode", mode);
          const child = reopened.getByTestId(mode === "not" ? "event-condition-not" : "event-condition-group-item-0");
          await select(page, child, "event-condition-mode", "variable");
          await select(page, child, "event-condition-variable-op", "<=");
          await fill(child, "event-condition-variable-value", "731");
          await pickVariable(page, child, "event-condition-variable-target", "other");
          assert.equal(await child.getByTestId("event-condition-variable-value").inputValue(), "731");
          assert.equal(await child.getByTestId("event-condition-variable-op").inputValue(), "<=");
          await select(page, child, "event-condition-mode", "gold");
          await select(page, child, "event-condition-mode", "variable");
          assert.equal(await child.getByTestId("event-condition-variable-value").inputValue(), "731");
        }
        await select(page, reopened, "event-condition-mode", "switch");
        await select(page, reopened, "event-condition-switch-value", "false");
        await reopened.getByTestId("event-condition-switch-target").getByTestId("event-switch-picker-open").click();
        await page.getByTestId("event-record-picker-search").fill("switch-b");
        await page.getByRole("option").filter({ has: page.locator(".event-record-picker-row-name", { hasText: "switch-b" }) }).click();
        await page.getByTestId("event-record-picker-ok").click();
        assert.equal(await reopened.getByTestId("event-condition-switch-value").inputValue(), "false");
        await select(page, reopened, "event-condition-mode", "actor");
        await select(page, reopened, "event-condition-actor-present", "false");
        await select(page, reopened, "event-condition-actor", "actor_guardian");
        assert.equal(await reopened.getByTestId("event-condition-actor-present").inputValue(), "false");
        await select(page, reopened, "event-condition-mode", "gold");
        await fill(reopened, "event-condition-gold-amount", "917");
      } else if (expected.kind === "choices") {
        assert.equal(await reopened.getByTestId("event-choice-option-1").inputValue(), "B");
        for (let n = 2; n < 5; n++) await reopened.getByTestId("event-choice-add").click();
        assert.equal(await reopened.getByTestId("event-choice-add").isDisabled(), true);
      } else if (expected.kind === "inputNumber") {
        assert.equal(await reopened.getByTestId("input-number-variable").locator("select").inputValue(), "answer");
        await fill(reopened, "input-number-prompt", "Discard parent");
      } else if (expected.kind === "timer") {
        assert.equal(await reopened.getByTestId("event-command-timer-start-mode").inputValue(), "resume");
        await select(page, reopened, "event-command-timer-id", "timer1");
      } else if (expected.kind === "loop") {
        assert.equal(await reopened.getByTestId("event-loop-no-break-warning").isVisible(), true);
        await fill(reopened, "event-loop-body-text-0", "Discard parent");
      }
      await cancelCommand(page, saved);
      const proof = { id, index, confirm, saved: actual, reopened: true, canceled: true, unchangedAfterCancel: true, geometry };
      traces.push(proof);
      await writeFile(join(dir, "editor-cancel.json"), JSON.stringify(proof, null, 2));
    }
    const saved = await readEditorProject(page);
    await page.getByTestId("event-editor-modal-close").click();
    await reimportProject(page, saved);
    await openMapCommand(page, "host", [0]);
    for (const [index] of ids.entries()) {
      if (index) await openCommandRow(page, page.getByTestId("event-editor-modal"), [index]);
      if (index === 0) {
        await select(page, dialog(page), "event-condition-mode", "gold");
        assert.equal(await dialog(page).getByTestId("event-condition-gold-amount").inputValue(), "100");
      }
      await cancelCommand(page, saved);
    }
    local.assertNoRemoteWrites();
    await writeFile(join(out, "editor-observation.json"), JSON.stringify({ traces, reimport: true, remoteWrites: [], context: "map and full nested command dialogs" }, null, 2));
    return saved;
  } catch (error) {
    await page.screenshot({ path: join(out, "editor-failure.png"), fullPage: false });
    await writeFile(join(out, "editor-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`);
    throw error;
  } finally { await local.dispose(); }
}

async function standalone() {
  const out = process.env.U02_EVIDENCE_DIR ?? ".omo/evidence/event-command-remediation/U02";
  const owned = await mkdtemp(join(tmpdir(), "u02-qa-"));
  const cache = join(owned, "vite-editor");
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address(); assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
    env: { ...process.env, VITE_CACHE_DIR: cache, E2E_FREEZE_DEV_SERVER: "1", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Owned editor server did not become ready")), 30_000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Owned editor server exited ${code}`)); });
    server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes(url)) { clearTimeout(timeout); resolve(); } });
    server.stderr.on("data", data => process.stderr.write(data));
  });
  let browser;
  try {
    await ready;
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const saved = await proveEditor(page, url, out);
    const file = join(owned, "editor-saved.json");
    await writeFile(file, serialize(saved));
    await writeFile(join(out, "editor-saved.json"), serialize(saved));
    console.log("EDITOR PASS: all five IDs Confirm/Apply/reopen/Cancel/export/reimport");
    await context.close();
    if (process.env.U02_PLAYER === "1") {
      // H0's player Vite server runs in ordinary Node, independently of Bun's loader.
      const player = spawn("node", ["scripts/qa/runtime/event-command-remediation-u02.scenario.mjs", file, out], { stdio: "inherit" });
      try {
        const [code] = await once(player, "exit", { signal: AbortSignal.timeout(240_000) });
        assert.equal(code, 0, "Dedicated Node player proof");
      } finally {
        if (player.exitCode === null && player.signalCode === null) {
          const exited = once(player, "exit", { signal: AbortSignal.timeout(10_000) });
          player.kill("SIGTERM"); await exited;
        }
      }
    }
  } finally {
    await browser?.close();
    if (server.exitCode === null) {
      const exited = once(server, "exit", { signal: AbortSignal.timeout(10_000) });
      server.kill("SIGTERM"); await exited;
    }
    await rm(owned, { recursive: true, force: true });
    await writeFile(join(out, "editor-cleanup.json"), JSON.stringify({ port, serverExited: server.exitCode !== null || server.signalCode !== null, browserClosed: true, owned, temporaryDirectoryRemoved: true }, null, 2));
  }
}

if (process.env.U02_STANDALONE === "1") await standalone();
else test("U02 all finding editor roundtrips", async ({ page, baseURL }, testInfo) => {
  assert.ok(baseURL);
  await proveEditor(page, baseURL, testInfo.outputPath("U02"));
});
