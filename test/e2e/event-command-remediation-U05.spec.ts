import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import type { Command, Project } from "../../src/project/types";
import { MAP, EVENT, COMMON, TROOP, HERO, OTHER, REWARD, SLEEP, POISON } from "../eventCommandRemediation/U05.fixture";
import {
  cancelCommand, confirmCommand, enterLocalEditor, observeEditorAction, openCommandRow,
  openMapCommand, openDatabaseCommand, projectObservation, readEditorProject, reimportProject,
} from "./eventCommandRemediationHarness";

const out = process.env.U05_EVIDENCE_DIR ?? ".omo/evidence/event-command-remediation/U05";
const DIALOG = '[data-testid="event-command-edit-dialog"]';
const selector = (id: string) => `${DIALOG} [data-testid="${id}"]`;
const present = (selector: string, equals = true) => ({ source: "dom" as const, selector, read: "present" as const, equals });
const value = (id: string, equals: string) => ({ source: "dom" as const, selector: selector(id), read: "property" as const, name: "value", equals });
const identity = [
  [5, "change-actor-name", "value-input"], [6, "change-actor-nickname", "value-input"],
  [7, "change-actor-graphic", "resource-select"], [8, "change-actor-faceset", "resource-select"],
  [9, "change-actor-class", "class-select"],
] as const;
const commandPath = (surface: string, index: number, project: Project): (string | number)[] => surface === "map"
  ? ["maps", MAP, "events", 0, "pages", 0, "commands", index]
  : surface === "common" ? ["commonEvents", 0, "commands", index]
    : ["database", "troops", project.database.troops.findIndex(row => row.id === TROOP), "battleEventPages", 0, "commands", index];
const commandsOf = (project: Project, surface: string) => surface === "map" ? project.maps[MAP]!.events[0]!.pages![0]!.commands
  : surface === "common" ? project.commonEvents![0]!.commands : project.database.troops.find(row => row.id === TROOP)!.battleEventPages[0]!.commands;

async function select(page: Page, id: string, next: string, scope = DIALOG) {
  const nativeSelector = `${scope} [data-testid="${id}"]`;
  const native = page.locator(nativeSelector);
  const option = await native.evaluate((node, next) => {
    const select = node as HTMLSelectElement;
    return { index: [...select.options].findIndex(option => option.value === next), segmented: select.classList.contains("rich-native-select") };
  }, next);
  assert.ok(option.index >= 0, `${id} offers ${next}`);
  const observe = [{ source: "dom" as const, selector: nativeSelector, read: "property" as const, name: "value", equals: next }];
  if (option.segmented) {
    // AMOUNT_OP_SEGMENTS uses these keys; target/source/state segments use value as key.
    const key = ({ "=": "set", "+=": "inc", "-=": "dec" } as Record<string, string>)[next] ?? next;
    const button = `${scope} [data-testid="${id}-segment-${key}"]`;
    return observeEditorAction(page, { observe: [...observe, { source: "dom", selector: button, read: "attribute", name: "aria-pressed", equals: "true" }],
      event: { selector: button, type: "click" }, timeoutMs: 10_000 }, () => page.locator(button).click());
  }
  if (await native.isVisible()) {
    return observeEditorAction(page, { observe, event: { selector: nativeSelector, type: "change" }, timeoutMs: 10_000 }, () => native.selectOption(next));
  }
  await observeEditorAction(page, { observe: [present(".event-custom-select-popover")], timeoutMs: 10_000 },
    () => page.locator(`${scope} [data-custom-select-for="${id}"]`).click());
  return observeEditorAction(page, { observe, event: { selector: nativeSelector, type: "change" }, timeoutMs: 10_000 },
    () => page.locator(`.event-custom-select-popover button[data-option-index="${option.index}"]`).click());
}
async function amount(page: Page, id: string, next: string) {
  return observeEditorAction(page, { observe: [value(id, next)], event: { selector: selector(id), type: "input" }, timeoutMs: 10_000 },
    () => page.locator(selector(id)).fill(next));
}
async function invalidConfirm(page: Page, form: string) {
  await observeEditorAction(page, { observe: [present(DIALOG), { source: "dom", selector: selector(form), read: "attribute", name: "aria-invalid", equals: "true" }],
    event: { selector: selector("event-command-edit-ok"), type: "click" }, timeoutMs: 10_000 }, () => page.locator(selector("event-command-edit-ok")).click());
}
async function closeOuter(page: Page, surface: string, saveChanges = false) {
  const id = surface === "map" ? "event-editor-modal-close" : "database-footer-ok";
  const outer = surface === "map" ? "event-editor-modal" : "database-modal";
  if (surface !== "map" && saveChanges) {
    await observeEditorAction(page, { observe: [present('[data-testid="database-dirty-save"]')], timeoutMs: 15_000 }, () => page.getByTestId(id).click());
    await observeEditorAction(page, { observe: [present(`[data-testid="${outer}"]`, false)], timeoutMs: 15_000 }, () => page.getByTestId("database-dirty-save").click());
    return;
  }
  await observeEditorAction(page, { observe: [present(`[data-testid="${outer}"]`, false)], timeoutMs: 15_000 }, () => page.getByTestId(id).click());
}

for (const surface of ["map", "common", "troop"] as const) {
  test(`U05 ${surface}: actor forms Confirm, outer save, import and reopen`, async ({ page, baseURL }) => {
    test.setTimeout(360_000);
    page.setDefaultTimeout(15_000);
    assert.ok(baseURL); assert.ok(process.env.U05_FIXTURE); assert.ok(process.env.U05_FIXTURE_DIR);
    const fixture = JSON.parse(await readFile(process.env.U05_FIXTURE, "utf8")) as Project;
    const plan = {
      surface, findings: ["G2-F1", "G2-F4", "G2-F6", "G2-F7", "G2-F8"],
      steps: ["092 party -> actual hero ID, slots retained", "EXP variable -> number31 -> variable reward; actor/op edits; focus stable",
        "014/021 variable -> number10 -> Confirm/reopen -> remove; inactive variable retained", "state toggle -> sleep; set remains selectable",
        "five identity forms + learnSkill + EXP: clear individual, Confirm rejects; explicit party and individual saves",
        "outer map Apply or database OK; actual wire JSON file import; reopen saved 092 and EXP",
        ...(surface === "map" ? ["inline individual clear cannot persist party on map Apply"] : [])],
      pass: { target: HERO, source: "number", inactiveVariable: REWARD, exp: { kind: "var", id: REWARD }, state: SLEEP, unexpectedRemoteWrites: 0 },
    };
    await writeFile(`${out}/editor-${surface}-scenarios.json`, JSON.stringify(plan, null, 2));
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const bootFailures: unknown[] = [];
    page.on("requestfailed", request => bootFailures.push({ url: request.url(), failure: request.failure() }));
    const local = await enterLocalEditor(page, fixture, baseURL).catch(async error => {
      await page.screenshot({ path: `${out}/editor-${surface}-boot-failure.png` });
      await writeFile(`${out}/editor-${surface}-boot-failure.json`, JSON.stringify({ error: String(error), errors, bootFailures, body: await page.locator("body").innerText() }, null, 2));
      throw error;
    });
    const traces: unknown[] = [];
    const scope = () => page.getByTestId(surface === "map" ? "event-editor-modal" : surface === "common" ? "db-common-event-command-list" : "db-troop-event-command-list");
    const open = async (index: number) => openCommandRow(page, scope(), [index]);
    const save = async (index: number, expected: Command) => {
      traces.push(await confirmCommand(page, surface, [projectObservation(commandPath(surface, index, fixture), expected)]));
      assert.deepEqual(commandsOf(await readEditorProject(page), surface)[index], expected);
    };
    try {
      if (surface === "map") await openMapCommand(page, EVENT);
      else await openDatabaseCommand(page, surface, surface === "common" ? COMMON : TROOP);
      await select(page, "change-battle-commands-target-mode", "actor");
      await invalidConfirm(page, "change-battle-commands-command-body");
      await select(page, "change-battle-commands-target-actor", HERO);
      await select(page, "change-battle-commands-command-select", "cmd_item");
      const battle: Command = { kind: "m2Command", commandId: "m2-092-change-battle-commands", fields: { target: HERO, operation: "add", value: "cmd_item", slots: "cmd_attack,cmd_defend" } };
      await save(0, battle);
      await open(0);
      assert.equal(await page.locator(selector("change-battle-commands-target-mode")).inputValue(), "actor");
      assert.equal(await page.locator(selector("change-battle-commands-target-actor")).inputValue(), HERO);
      await cancelCommand(page, await readEditorProject(page));

      await open(1);
      await select(page, "change-exp-amount-source", "number");
      const input = page.locator(selector("change-exp-amount-input"));
      const handle = await input.elementHandle(); assert.ok(handle);
      await amount(page, "change-exp-amount-input", "31");
      assert.equal(await handle.evaluate(node => node.isConnected && node === document.activeElement), true);
      await select(page, "change-exp-amount-source", "variable");
      assert.equal(await page.locator(`${selector("change-exp-amount-variable")} select`).inputValue(), REWARD);
      await select(page, "change-exp-amount-source", "number");
      assert.equal(await input.inputValue(), "31");
      await select(page, "change-exp-amount-source", "variable");
      await select(page, "change-exp-actor-select", OTHER);
      await select(page, "change-exp-op-select", "-=");
      const exp: Command = { kind: "changeExp", actorId: OTHER, op: "-=", amount: { kind: "var", id: REWARD } };
      await save(1, exp);
      await open(1);
      assert.equal(await page.locator(selector("change-exp-amount-source")).inputValue(), "variable");
      await select(page, "change-exp-actor-select", "");
      await invalidConfirm(page, "event-command-exp-form");
      await select(page, "change-exp-target-mode", "party");
      await save(1, { ...exp, actorId: "" });
      await open(1); await select(page, "change-exp-target-mode", "actor");
      await select(page, "change-exp-actor-select", OTHER); await save(1, exp);

      for (const [index, prefix] of [[2, "change-parameters"], [3, "damage-processing"]] as const) {
        await open(index);
        await select(page, `${prefix}-value-source`, "number");
        await amount(page, `${prefix}-value-input`, "10");
        const original = commandsOf(fixture, surface)[index]!; assert.equal(original.kind, "m2Command");
        if (original.kind !== "m2Command") throw Error("fixture M2 required");
        const numeric: Command = { ...original, fields: { ...original.fields, valueSource: "number", value: 10 } };
        await save(index, numeric);
        await open(index);
        assert.equal(await page.locator(selector(`${prefix}-value-source`)).inputValue(), "number");
        assert.equal(await page.locator(`${selector(`${prefix}-value-variable`)} select`).inputValue(), REWARD);
        await select(page, `${prefix}-operation`, "remove");
        await save(index, { ...numeric, fields: { ...numeric.fields, operation: "remove" } });
      }
      await open(4);
      assert.equal(await page.locator(selector("change-state-operation")).inputValue(), "toggle");
      await observeEditorAction(page, { observe: [value("change-state-state-select", SLEEP)], timeoutMs: 10_000 }, () => page.locator(selector(`change-state-chip-${SLEEP}`)).click());
      const state: Command = { kind: "m2Command", commandId: "m2-019-change-state", fields: { target: HERO, operation: "toggle", value: SLEEP } };
      await save(4, state);

      for (const [index, prefix, suffix] of identity) {
        await open(index);
        const before = await readEditorProject(page);
        await select(page, `${prefix}-actor-select`, "");
        await invalidConfirm(page, `${prefix}-command-body`);
        assert.deepEqual(await readEditorProject(page), before);
        await select(page, `${prefix}-target-mode`, "party");
        const original = commandsOf(fixture, surface)[index]!; assert.equal(original.kind, "m2Command");
        if (original.kind !== "m2Command") throw Error("fixture M2 required");
        await save(index, { ...original, fields: { ...original.fields, target: "party" } });
        await open(index);
        await select(page, `${prefix}-target-mode`, "actor");
        await select(page, `${prefix}-actor-select`, HERO);
        if (suffix === "value-input") {
          await amount(page, `${prefix}-${suffix}`, index === 5 ? "Hero edited" : "Hero nick2");
          await page.locator(selector(`${prefix}-${suffix}`)).press("Tab");
        }
        const savedValue = suffix === "value-input" ? index === 5 ? "Hero edited" : "Hero nick2" : original.fields.value;
        await save(index, { ...original, fields: { ...original.fields, target: HERO, value: savedValue } });
      }
      await open(10);
      const learned = commandsOf(fixture, surface)[10]!; assert.equal(learned.kind, "learnSkill");
      if (learned.kind !== "learnSkill") throw Error("fixture skill required");
      await select(page, "learn-skill-actor-select", "");
      await select(page, "learn-skill-action-select", "forget");
      await invalidConfirm(page, "event-command-learn-skill-form");
      await select(page, "learn-skill-target-mode", "party");
      await save(10, { ...learned, actorId: "", action: "forget" });
      await open(10); await select(page, "learn-skill-target-mode", "actor");
      await select(page, "learn-skill-actor-select", HERO);
      await select(page, "learn-skill-action-select", "learn");
      await save(10, learned);

      if (surface === "map") {
        const before = await readEditorProject(page);
        await scope().getByTestId("event-command-step-5").locator("..").click();
        const inline = page.getByTestId("event-inspector-body");
        await select(page, "change-actor-name-actor-select", "", '[data-testid="event-inspector-body"]');
        await observeEditorAction(page, { observe: [{ source: "dom", selector: '[data-testid="event-inspector-body"] [data-testid="change-actor-name-command-body"]', read: "attribute", name: "aria-invalid", equals: "true" }],
          event: { selector: '[data-testid="event-inspector-body"] [data-testid="change-actor-name-value-input"]', type: "input" }, timeoutMs: 10_000 },
          () => inline.getByTestId("change-actor-name-value-input").fill("NO_PARTY"));
        await inline.getByTestId("change-actor-name-value-input").press("Tab");
        await observeEditorAction(page, { observe: [projectObservation(commandPath(surface, 5, fixture), commandsOf(before, surface)[5])],
          event: { selector: '[data-testid="event-editor-apply"]', type: "click" }, timeoutMs: 10_000 }, () => page.getByTestId("event-editor-apply").click());
        assert.deepEqual(await readEditorProject(page), before);
      }
      await closeOuter(page, surface, true);
      const saved = await readEditorProject(page);
      const wire = JSON.parse(await page.getByTestId("project-export-json").textContent() ?? "null").project;
      await writeFile(join(process.env.U05_FIXTURE_DIR, `editor-${surface}.json`), JSON.stringify(wire));
      await reimportProject(page, saved);
      if (surface === "map") await openMapCommand(page, EVENT);
      else await openDatabaseCommand(page, surface, surface === "common" ? COMMON : TROOP);
      assert.equal(await page.locator(selector("change-battle-commands-target-actor")).inputValue(), HERO);
      await page.screenshot({ path: `${out}/editor-${surface}-092.png` });
      await cancelCommand(page, saved);
      await open(1);
      assert.equal(await page.locator(selector("change-exp-amount-source")).inputValue(), "variable");
      assert.equal(await page.locator(`${selector("change-exp-amount-variable")} select`).inputValue(), REWARD);
      await page.screenshot({ path: `${out}/editor-${surface}-exp.png` });
      await cancelCommand(page, saved);
      await closeOuter(page, surface);
      assert.deepEqual(await readEditorProject(page), saved);
      local.assertNoRemoteWrites(); assert.deepEqual(errors, []);
      await writeFile(`${out}/editor-${surface}-observation.json`, JSON.stringify({ status: "PASS", plan, traces, wireCommands: commandsOf(wire, surface), pageErrors: errors, remoteWrites: [], observationReleased: await page.evaluate(() => !window.__eventCommandQa) }, null, 2));
    } catch (error) {
      await page.screenshot({ path: `${out}/editor-${surface}-failure.png` });
      await writeFile(`${out}/editor-${surface}-failure.json`, JSON.stringify({ error: String(error), errors, traces, body: await page.locator("body").innerText() }, null, 2));
      throw error;
    } finally { await local.dispose(); }
  });
}

for (const unresolved of ["", "missing_state"]) {
  test(`U05 missing state ${JSON.stringify(unresolved)} survives until explicit chip`, async ({ page, baseURL }) => {
    test.setTimeout(180_000); assert.ok(baseURL); assert.ok(process.env.U05_FIXTURE);
    const fixture = JSON.parse(await readFile(process.env.U05_FIXTURE, "utf8")) as Project;
    const command = commandsOf(fixture, "map")[4]!;
    assert.equal(command.kind, "m2Command"); if (command.kind !== "m2Command") throw Error("M2 required");
    command.fields = { ...command.fields, value: unresolved, operation: "set" };
    const local = await enterLocalEditor(page, fixture, baseURL);
    try {
      await openMapCommand(page, EVENT, [4]);
      assert.equal(await page.locator(selector("change-state-state-select")).inputValue(), unresolved);
      assert.equal(await page.locator(selector(`change-state-chip-${POISON}`)).getAttribute("class"), "btn small actor-m2-chip");
      await invalidConfirm(page, "change-state-command-body");
      await select(page, "change-state-operation", "toggle");
      await invalidConfirm(page, "change-state-command-body");
      await select(page, "change-state-operation", "set");
      await observeEditorAction(page, { observe: [value("change-state-state-select", SLEEP)], timeoutMs: 10_000 }, () => page.locator(selector(`change-state-chip-${SLEEP}`)).click());
      const saved = { ...command, fields: { ...command.fields, value: SLEEP, operation: "set" } };
      await confirmCommand(page, "map", [projectObservation(commandPath("map", 4, fixture), saved)]);
      await closeOuter(page, "map");
      local.assertNoRemoteWrites();
      await writeFile(`${out}/editor-state-${unresolved || "empty"}.json`, JSON.stringify({ status: "PASS", initial: unresolved, saved, confirmRejectedBeforeChoice: true }, null, 2));
    } finally { await local.dispose(); }
  });
}

test("U05 EXP inline variable creation keeps current selection and inactive draft", async ({ page, baseURL }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(15_000);
  assert.ok(baseURL); assert.ok(process.env.U05_FIXTURE);
  const fixture = JSON.parse(await readFile(process.env.U05_FIXTURE, "utf8")) as Project;
  for (const variable of fixture.variables) if (!variable.name.trim()) variable.name = `Existing ${variable.id}`;
  const name = "U05 newly authored reward";
  const plan = { action: "Existing EXP -> numeric31 -> variable -> real picker search/add/select/Confirm -> EXP Confirm -> map Apply",
    pass: { createdName: name, actorId: OTHER, op: "-=", inactiveNumber: "31", currentPreviewIdentity: true, mountedNodes: true } };
  await writeFile(`${out}/inline-variable-editor-scenario.json`, JSON.stringify(plan, null, 2));
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const local = await enterLocalEditor(page, fixture, baseURL);
  let selection: unknown;
  try {
    await openMapCommand(page, EVENT, [1]);
    await select(page, "change-exp-actor-select", OTHER);
    await select(page, "change-exp-op-select", "-=");
    await select(page, "change-exp-amount-source", "number");
    await amount(page, "change-exp-amount-input", "31");
    await select(page, "change-exp-amount-source", "variable");
    const form = await page.locator(selector("event-command-exp-form")).elementHandle(); assert.ok(form);
    const numeric = await page.locator(selector("change-exp-amount-input")).elementHandle(); assert.ok(numeric);
    const before = await readEditorProject(page);
    assert.equal(before.variables.some(variable => variable.name === name), false);
    const picker = '[data-testid="event-record-picker"]';
    const search = `${picker} [data-testid="event-record-picker-search"]`;
    await observeEditorAction(page, { observe: [present(picker)], timeoutMs: 10_000 },
      () => page.locator(`${selector("change-exp-amount-variable")} [data-testid="event-variable-picker-open"]`).click());
    await observeEditorAction(page, { observe: [present(`${picker} [data-testid="event-record-picker-no-result"]`)],
      event: { selector: search, type: "input" }, timeoutMs: 10_000 }, () => page.locator(search).fill(name));
    await observeEditorAction(page, { observe: [projectObservation(["variables", before.variables.length, "name"], name)],
      mutation: '[data-testid="project-export-json"]', timeoutMs: 15_000 }, () => page.getByTestId("event-record-picker-add").click());
    const current = await readEditorProject(page);
    const created = current.variables.find(variable => variable.name === name); assert.ok(created);
    assert.equal(before.variables.some(variable => variable.id === created.id), false);
    const index = current.variables.findIndex(variable => variable.id === created.id) + 1;
    const row = `${picker} [data-testid="event-record-picker-row-${index}"]`;
    await observeEditorAction(page, { observe: [{ source: "dom", selector: row, read: "attribute", name: "aria-selected", equals: "true" }],
      event: { selector: `${row}, ${row} *`, type: "click" }, timeoutMs: 10_000 }, () => page.locator(row).click());
    await observeEditorAction(page, { observe: [present(picker, false), { source: "dom", selector: `${selector("change-exp-amount-variable")} select`, read: "property", name: "value", equals: created.id }], timeoutMs: 10_000 },
      () => page.getByTestId("event-record-picker-ok").click());
    const selected = {
      id: await page.locator(`${selector("change-exp-amount-variable")} select`).inputValue(),
      label: await page.locator(`${selector("change-exp-amount-variable")} [data-testid="event-variable-picker-open"]`).textContent(),
      previewContainsCurrentName: (await page.locator(selector("change-exp-preview")).textContent())?.includes(created.name),
      invalid: await page.locator(selector("event-command-exp-form")).getAttribute("aria-invalid"),
      sameForm: await form.evaluate(node => node.isConnected), sameNumeric: await numeric.evaluate(node => node.isConnected),
    };
    selection = { created, selected };
    await select(page, "change-exp-amount-source", "number");
    assert.equal(await page.locator(selector("change-exp-amount-input")).inputValue(), "31");
    await select(page, "change-exp-amount-source", "variable");
    const expected: Command = { kind: "changeExp", actorId: OTHER, op: "-=", amount: { kind: "var", id: created.id } };
    await confirmCommand(page, "map", [projectObservation(commandPath("map", 1, fixture), expected)]);
    assert.deepEqual(selected, { id: created.id, label: created.name, previewContainsCurrentName: true, invalid: "false", sameForm: true, sameNumeric: true });
    const saved = await readEditorProject(page);
    assert.deepEqual(saved.variables.find(variable => variable.id === created.id), created);
    assert.deepEqual(commandsOf(saved, "map")[1], expected);
    await closeOuter(page, "map");
    local.assertNoRemoteWrites(); assert.deepEqual(errors, []);
    await writeFile(`${out}/inline-variable-editor-observation.json`, JSON.stringify({ status: "PASS", plan, selection, expected, errors, remoteWrites: [], observationReleased: await page.evaluate(() => !window.__eventCommandQa) }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${out}/inline-variable-editor-failure.png` });
    await writeFile(`${out}/inline-variable-editor-failure.json`, JSON.stringify({ error: String(error), selection, errors, body: await page.locator("body").innerText() }, null, 2));
    throw error;
  } finally { await local.dispose(); }
});
