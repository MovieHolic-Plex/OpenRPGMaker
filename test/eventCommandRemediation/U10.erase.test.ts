import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { replaceEventPageCommandAt } from "@/editor/eventPages";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { runCommands } from "@/player/playSceneInterpreter";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { installFakeDom } from "../fakeDom";
import { buildFixture, COMMON, HOME, HOST, m2, PAGE, runtimeFixture, SELECTED, storedCommand, UNKNOWN, type M2Command } from "./U10.fixture";

let restoreDom: () => void;
let project: ReturnType<typeof buildFixture>;

beforeEach(() => {
  restoreDom = installFakeDom({ animationFrames: "manual" });
  resetModalStackForTest();
  project = buildFixture();
  store.replace(project, { preserveEventDrafts: false });
  editorState.set({ currentMapId: HOME, selectedEventId: HOST, selectedEventPageId: PAGE });
});

afterEach(() => {
  document.querySelector<HTMLElement>('[data-testid="event-command-edit-cancel"]')?.click();
  document.body.replaceChildren();
  resetModalStackForTest();
  vi.restoreAllMocks();
  restoreDom();
});

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing rendered U10 control: ${id}`);
  return element;
}

function open(initial: M2Command) {
  const apply = vi.fn((command: Command) => replaceEventPageCommandAt(HOME, HOST, PAGE, [0], command));
  openEventCommandEditDialog({ initial, onApply: apply });
  // A missing intended control is RED only after the real body has rendered.
  expect(control(`m2-command-body-${initial.commandId}`)).toBeTruthy();
  return apply;
}

function change(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  // fakeDom does not enforce native select values: never inject a nonexistent option.
  if (element.tagName === "SELECT") {
    expect(Array.from(element.querySelectorAll("option")).map(option => option.value)).toContain(value);
  }
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function confirm(): M2Command {
  control("event-command-edit-ok").click();
  return storedCommand(store.getCurrent());
}

describe("U10/G1-F1 selected Erase Event", () => {
  it("PASS control: stages selection, Confirm/reload preserves it, reopened Cancel isolates edits", () => {
    const initial = storedCommand(project);
    const apply = open(initial);
    change(control<HTMLSelectElement>("m2-erase-event-target"), SELECTED);
    expect(apply).not.toHaveBeenCalled();
    expect(storedCommand(store.getCurrent())).toEqual(initial);
    const saved = confirm();
    expect(apply).toHaveBeenCalledExactlyOnceWith(saved);
    expect(saved.fields.eventId).toBe(SELECTED);
    expect(storedCommand(deserialize(serialize(store.getCurrent())))).toEqual(saved);
    const reopenApply = open(saved);
    expect(control<HTMLSelectElement>("m2-erase-event-target").value).toBe(SELECTED);
    change(control<HTMLSelectElement>("m2-erase-event-target"), HOST);
    control("event-command-edit-cancel").click();
    expect(reopenApply).not.toHaveBeenCalled();
    expect(storedCommand(store.getCurrent())).toEqual(saved);
  });

  it("RED: confirmed selectedOther hides only selectedOther through the actual scene consumer", async () => {
    open(m2("Erase Event"));
    change(control<HTMLSelectElement>("m2-erase-event-target"), SELECTED);
    const saved = confirm();
    expect(saved.fields.eventId).toBe(SELECTED);
    const runtime = runtimeFixture(project);
    await runCommands(runtime.scene, [saved], HOST);
    expect.soft(runtime.views().map(view => view.event.id)).toContain(HOST);
    expect.soft(runtime.views().map(view => view.event.id)).not.toContain(SELECTED);
    expect.soft([...runtime.destroyed]).toEqual([SELECTED]);
    expect.soft(runtime.sprites.has(HOST)).toBe(true);
    expect(runtime.session.removedEventIds).toEqual({});
  });

  it.each([HOST, undefined])("RED: selected target survives common-event execution with host=%s", async host => {
    project.commonEvents[0]!.commands = [m2("Erase Event", { eventId: SELECTED })];
    store.replace(project);
    const runtime = runtimeFixture(project);
    await runCommands(runtime.scene, [{ kind: "callCommonEvent", commonEventId: COMMON }], host);
    expect.soft(runtime.views().map(view => view.event.id)).toContain(HOST);
    expect.soft(runtime.views().map(view => view.event.id)).not.toContain(SELECTED);
    expect.soft([...runtime.destroyed]).toEqual([SELECTED]);
  });

  it("PASS control: deliberately choosing the existing current-event option erases only the host", async () => {
    open(m2("Erase Event", { eventId: SELECTED }));
    // The existing Erase form encodes its explicitly chosen current-event option as empty.
    change(control<HTMLSelectElement>("m2-erase-event-target"), "");
    const saved = confirm();
    const runtime = runtimeFixture(project);
    await runCommands(runtime.scene, [saved], HOST);
    expect(runtime.views().map(view => view.event.id)).toEqual([SELECTED]);
    expect([...runtime.destroyed]).toEqual([HOST]);
    expect(runtime.session.removedEventIds).toEqual({});
  });

  it("PASS control: standalone current-event without a host cannot erase another event", async () => {
    const runtime = runtimeFixture(project);
    await runCommands(runtime.scene, [m2("Erase Event", { eventId: "" })]);
    expect(runtime.views().map(view => view.event.id)).toEqual([HOST, SELECTED]);
    expect([...runtime.destroyed]).toEqual([]);
  });

  it("RED: unknown selected ID is preserved on edit and must not fall back to the host", async () => {
    open(m2("Erase Event", { eventId: UNKNOWN }));
    expect(control<HTMLSelectElement>("m2-erase-event-target").value).toBe(UNKNOWN);
    const saved = confirm();
    expect(saved.fields.eventId).toBe(UNKNOWN);
    const runtime = runtimeFixture(project);
    await runCommands(runtime.scene, [saved], HOST);
    expect.soft(runtime.views().map(view => view.event.id)).toEqual([HOST, SELECTED]);
    expect.soft([...runtime.destroyed]).toEqual([]);
  });
});
