/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { eventCommandPickerSearchEntries, openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { modalStackEntryCountForTest } from "@/editor/ui/modalStack";
import { resolveDialogueText } from "@/player/dialogue";
import { createInterpreter } from "@/player/interpreter";
import { deserialize, serialize } from "@/project/io";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { buildFixture, OTHER_ACTOR, REWARD_VARIABLE, saveTextCommand, textCommand, textFixture } from "./U28.fixture";

function control<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!element) throw new TypeError(`Missing mounted control ${id}`);
  return element;
}

let previousProject: Project;
let applied: Command[];

function openText(initial: Command = textFixture()): HTMLTextAreaElement {
  openEventCommandEditDialog({ initial, onApply: command => {
    applied.push(command);
    saveTextCommand(store.getCurrent(), command);
  } });
  return control<HTMLTextAreaElement>("event-command-text-body");
}

function chooseRecord(tool: string, row: number): void {
  control<HTMLButtonElement>(`event-command-text-tool-${tool}`).click();
  control<HTMLButtonElement>(`event-record-picker-row-${row}`).click();
  control<HTMLButtonElement>("event-record-picker-ok").click();
}

beforeEach(() => {
  previousProject = store.getCurrent();
  store.replace(buildFixture());
  expect(store.getCurrent().database.actors[1]?.id).toBe(OTHER_ACTOR);
  expect(store.getCurrent().variables[1]?.id).toBe(REWARD_VARIABLE);
  applied = [];
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="event-record-picker"] .event-subdialog-close')?.click();
  document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-cancel"]')?.click();
  expect(modalStackEntryCountForTest()).toBe(0);
  document.body.replaceChildren();
  store.replace(previousProject);
});

describe("G1-F18 selected text record insertion", () => {
  it.each([
    { tool: "hero-name", token: "\\n[2]", resolved: "Other" },
    { tool: "variable", token: "\\v[2]", resolved: "29" },
  ])("inserts the selected $tool rather than the first record", ({ tool, token, resolved }) => {
    // Given an existing text command and a caret inside its body.
    const initial = textFixture();
    openEventCommandEditDialog({ initial, onApply: command => {
      applied.push(command);
      saveTextCommand(store.getCurrent(), command);
    } });
    const body = control<HTMLTextAreaElement>("event-command-text-body");
    expect(control("event-command-text-editor").isConnected).toBe(true);
    body.focus();
    body.setSelectionRange(5, 5);

    // When the author opens the tool and explicitly selects the second record.
    control<HTMLButtonElement>(`event-command-text-tool-${tool}`).click();
    expect(body.value).toBe("Hello world");
    expect(control("event-record-picker").isConnected).toBe(true);
    control<HTMLButtonElement>("event-record-picker-row-2").click();
    control<HTMLButtonElement>("event-record-picker-ok").click();

    // Then the actual dialog, codec and runtime all retain that selection.
    expect(body.value).toBe(`Hello${token} world`);
    expect(body.selectionStart).toBe(5 + token.length);
    expect(body.selectionEnd).toBe(5 + token.length);
    expect(applied).toEqual([]);
    control<HTMLButtonElement>("event-command-edit-ok").click();
    expect(applied).toEqual([{ ...initial, body: `Hello${token} world` }]);
    const reloaded = deserialize(serialize(store.getCurrent()));
    const saved = textCommand(reloaded);
    expect(saved).toEqual(applied[0]);
    const session = startSession(reloaded, 18);
    const step = createInterpreter([saved], session, reloaded).start();
    if (step.kind !== "text") throw new TypeError("Confirmed text did not reach the text interpreter");
    expect(resolveDialogueText(step.body, { session, project: reloaded })).toBe(`Hello${resolved} world`);
    expect(initial).toEqual(textFixture());
  });

  it("keeps body and range when the record picker is cancelled", () => {
    const body = openText();
    body.focus();
    body.setSelectionRange(6, 11);
    control<HTMLButtonElement>("event-command-text-tool-variable").click();
    const close = control("event-record-picker").querySelector<HTMLButtonElement>(".event-subdialog-close");
    if (!close) throw new TypeError("Record picker close control is missing");
    close.click();
    expect(body.value).toBe("Hello world");
    expect([body.selectionStart, body.selectionEnd]).toEqual([6, 11]);
    expect(document.activeElement).toBe(body);
    expect(applied).toEqual([]);
    control<HTMLButtonElement>("event-command-edit-ok").click();
    expect(applied).toEqual([textFixture()]);
  });

  it("replaces only the selected range and preserves presentation metadata", () => {
    const initial = { ...textFixture(), autoAdvance: true };
    const body = openText(initial);
    body.setSelectionRange(6, 11);
    chooseRecord("hero-name", 2);
    expect(body.value).toBe("Hello \\n[2]");
    control<HTMLButtonElement>("event-command-edit-ok").click();
    expect(applied).toEqual([{ ...initial, body: "Hello \\n[2]" }]);
  });

  it("retains completed IME text and caret across both record tools", () => {
    const body = openText();
    body.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    body.value = "안녕 world";
    body.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    body.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "안녕" }));
    body.setSelectionRange(2, 2);
    chooseRecord("hero-name", 2);
    chooseRecord("variable", 2);
    expect(control("event-command-text-body")).toBe(body);
    expect(document.activeElement).toBe(body);
    expect(body.value).toBe("안녕\\n[2]\\v[2] world");
    control<HTMLButtonElement>("event-command-edit-ok").click();
    const project = deserialize(serialize(store.getCurrent()));
    const session = startSession(project, 18);
    expect(resolveDialogueText(body.value, { session, project })).toBe("안녕Other29 world");
    expect(applied).toEqual([{ ...textFixture(), body: body.value }]);
  });

  it("uses the same tool for text created through the M2-001 picker entry", () => {
    const entry = eventCommandPickerSearchEntries().find(item => item.commandId === "m2-001-show-text");
    if (!entry) throw new TypeError("M2-001 picker entry is missing");
    const selected: Command[] = [];
    openEventCommandPicker({ title: "Text tools", context: "map", onSelect: command => selected.push(command) });
    control<HTMLButtonElement>(`event-command-picker-tab-${entry.page}`).click();
    control<HTMLButtonElement>(entry.testId).click();
    const command = selected[0];
    if (!command || command.kind !== "text") throw new TypeError("M2-001 must create native text");
    const body = openText({ ...command, ...textFixture() });
    body.setSelectionRange(5, 5);
    chooseRecord("hero-name", 2);
    control<HTMLButtonElement>("event-command-edit-ok").click();
    expect(applied).toEqual([{ ...textFixture(), body: "Hello\\n[2] world" }]);
  });

  it("preserves metadata after the existing M2-209 load normalization", () => {
    const legacy: Command = { kind: "m2Command", commandId: "m2-209-advanced-dialogue",
      fields: { body: "Hello world", speaker: "Narrator", emotion: "happy", autoAdvance: true } };
    const loaded = deserialize(serialize(buildFixture(legacy)));
    expect(rewriteLegacyAdvancedDialogueInProject(loaded)).toBe(true);
    store.replace(loaded);
    const normalized = textCommand(store.getCurrent());
    expect(normalized).toEqual({ ...textFixture(), autoAdvance: true });
    const body = openText(normalized);
    body.setSelectionRange(5, 5);
    chooseRecord("variable", 2);
    control<HTMLButtonElement>("event-command-edit-ok").click();
    expect(applied).toEqual([{ ...textFixture(), autoAdvance: true, body: "Hello\\v[2] world" }]);
  });

  it.each(["legacy_reward", "v2"])("disables the unrepresentable or shadowed variable %s", id => {
    const project = store.getCurrent();
    project.variables.push({ id, name: id });
    project.session.variables[id] = 91;
    store.replace(project);
    const rowNumber = store.getCurrent().variables.findIndex(record => record.id === id) + 1;
    const body = openText();
    body.setSelectionRange(5, 5);
    control<HTMLButtonElement>("event-command-text-tool-variable").click();
    const row = control<HTMLButtonElement>(`event-record-picker-row-${rowNumber}`);
    expect(row.disabled).toBe(true);
    row.click();
    expect(row.getAttribute("aria-selected")).toBe("false");
    expect(body.value).toBe("Hello world");
    expect(applied).toEqual([]);
  });

  it("skips unsupported variable rows during keyboard selection", () => {
    const project = store.getCurrent();
    project.variables.splice(1, 0, { id: "legacy_reward", name: "Legacy reward" });
    project.session.variables["legacy_reward"] = 91;
    store.replace(project);
    const body = openText();
    body.setSelectionRange(5, 5);
    control<HTMLButtonElement>("event-command-text-tool-variable").click();
    control("event-record-picker-search").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    control<HTMLButtonElement>("event-record-picker-ok").click();
    expect(body.value).toBe("Hello\\v[2] world");
  });

  it("retains the existing unshadowed numeric variable alias grammar", () => {
    const project = store.getCurrent();
    project.variables.push({ id: "v21", name: "Alias value" });
    project.session.variables["v21"] = 73;
    store.replace(project);
    const row = store.getCurrent().variables.findIndex(record => record.id === "v21") + 1;
    const body = openText();
    body.setSelectionRange(5, 5);
    chooseRecord("variable", row);
    expect(body.value).toBe("Hello\\v[21] world");
    const session = startSession(store.getCurrent(), 18);
    expect(resolveDialogueText(body.value, { session, project: store.getCurrent() })).toBe("Hello73 world");
  });

  it("uses the current project after a variable is created inside the picker", () => {
    const before = store.getCurrent();
    const body = openText();
    body.setSelectionRange(5, 5);
    control<HTMLButtonElement>("event-command-text-tool-variable").click();
    const search = control<HTMLInputElement>("event-record-picker-search");
    search.value = "Fresh reward";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    control<HTMLButtonElement>("event-record-picker-add").click();
    const created = store.getCurrent().variables.find(record => record.name === "Fresh reward");
    if (!created) throw new TypeError("Record picker did not create the variable");
    expect(store.getCurrent()).not.toBe(before);
    expect(created.id).toBe("var_0003");
    control<HTMLButtonElement>("event-record-picker-ok").click();
    expect(body.value).toBe("Hello\\v[3] world");
    expect(control("event-command-text-body")).toBe(body);
    control<HTMLButtonElement>("event-command-edit-ok").click();
    const project = deserialize(serialize(store.getCurrent()));
    const session = startSession(project, 18);
    session.variables[created.id] = 88;
    expect(resolveDialogueText(body.value, { session, project })).toBe("Hello88 world");
    expect(textCommand(project)).toEqual({ ...textFixture(), body: body.value });
  });
});
