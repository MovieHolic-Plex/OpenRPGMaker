/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { modalStackEntryCountForTest } from "@/editor/ui/modalStack";
import { createInterpreter } from "@/player/interpreter";
import { charsetFollowerGraphic } from "@/project/followers";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import {
  BOB_ID, CUSTOM_FOLLOWER, CUSTOM_GRAPHIC, HERO_ID,
  buildFixture, commandOf, followerSession, saveCommand,
} from "./U06.fixture";

const DIALOG = '[data-testid="event-command-edit-dialog"]';
let project: Project;
let applied: Command[];

function control<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`${DIALOG} [data-testid="${id}"]`);
  if (!element) throw new Error(`Rendered U06 dialog is missing ${id}`);
  return element;
}

function open(initial: Command = commandOf(project)): HTMLElement {
  openEventCommandEditDialog({ initial, onApply: (command) => {
    applied.push(command);
    saveCommand(project, command);
  } });
  const dialog = document.querySelector<HTMLElement>(DIALOG);
  expect(dialog).not.toBeNull();
  // A missing intended control is evidence only after the real body has rendered.
  expect(dialog?.querySelector(`[data-testid="${initial.kind === "addFollower" ? "add" : "remove"}-follower-editor"]`)).not.toBeNull();
  return dialog!;
}

function change(id: string, value: string): void {
  const element = control<HTMLInputElement | HTMLSelectElement>(`event-command-${id}`);
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function graphic(enabled: boolean): void {
  const checkbox = control<HTMLInputElement>("event-command-add-follower-use-graphic");
  expect(checkbox.checked).toBe(!enabled);
  checkbox.click();
  expect(checkbox.checked).toBe(enabled);
}

function confirm(): void { control<HTMLButtonElement>("event-command-edit-ok").click(); }
function cancel(): void { control<HTMLButtonElement>("event-command-edit-cancel").click(); }
function reload(): Project { return deserialize(serialize(project)); }

function namedSession(reloaded: Project) {
  const session = followerSession(reloaded);
  expect(session.followers.map(({ id, name, kind }) => ({ id, name, kind }))).toEqual([
    { id: `actor:${HERO_ID}`, name: "Alice", kind: "actor" },
    { id: `actor:${BOB_ID}`, name: "Bob", kind: "actor" },
    { id: `monster:${session.monsterParty[0]}`, name: "M", kind: "monster" },
  ]);
  return session;
}

beforeEach(() => {
  project = buildFixture();
  applied = [];
  store.replace(project, { preserveEventDrafts: false });
});

afterEach(() => {
  // Real Cancel disposes the modal and custom-select observer even after RED assertions.
  document.querySelector<HTMLButtonElement>(`${DIALOG} [data-testid="event-command-edit-cancel"]`)?.click();
  expect(modalStackEntryCountForTest()).toBe(0);
  document.body.replaceChildren();
});

describe("U06 G5-F3: individual removal must not broaden into all", () => {
  it.each(["", "   "])("rejects individual name %j on Confirm, then accepts Bob", (invalidName) => {
    saveCommand(project, { kind: "removeFollower", name: "Bob" });
    const dialog = open();
    change("remove-follower-mode", "name");
    change("remove-follower-name", invalidName);
    expect(control<HTMLSelectElement>("event-command-remove-follower-mode").value).toBe("name");
    expect(control<HTMLInputElement>("event-command-remove-follower-name").value).toBe(invalidName);
    confirm();

    expect.soft(applied).toEqual([]);
    const reloaded = reload();
    expect.soft(commandOf(reloaded)).not.toHaveProperty("all", true);
    const session = namedSession(reloaded);
    const before = structuredClone(session.followers);
    // Only applied commands enter the interpreter. A rejected Confirm executes nothing.
    const commands = applied.length ? [commandOf(reloaded)] : [];
    expect(createInterpreter(commands, session, reloaded).start()).toEqual({ kind: "done" });
    expect.soft(session.followers).toEqual(before);
    expect(dialog.isConnected).toBe(true);
    expect(document.activeElement).toBe(control<HTMLInputElement>("event-command-remove-follower-name"));

    change("remove-follower-name", "Bob");
    confirm();
    expect(applied).toEqual([{ kind: "removeFollower", name: "Bob" }]);
    const corrected = reload();
    expect(commandOf(corrected)).toEqual({ kind: "removeFollower", name: "Bob" });
    expect(createInterpreter([commandOf(corrected)], session, corrected).start()).toEqual({ kind: "done" });
    expect(session.followers.map((entry) => entry.name)).toEqual(["Alice", "M"]);
    open(commandOf(corrected));
    expect(control<HTMLSelectElement>("event-command-remove-follower-mode").value).toBe("name");
    cancel();
    expect(applied).toHaveLength(1);
  });

  it("saves trimmed Bob, reopens in name mode, removes only Bob and cancels later all intent", () => {
    saveCommand(project, { kind: "removeFollower", name: "Alice" });
    open();
    change("remove-follower-mode", "name");
    change("remove-follower-name", "  Bob  ");
    confirm();
    const reloaded = reload();
    expect(commandOf(reloaded)).toEqual({ kind: "removeFollower", name: "Bob" });
    const session = namedSession(reloaded);
    const retained = structuredClone(session.followers.filter((entry) => entry.name !== "Bob"));
    expect(createInterpreter([commandOf(reloaded)], session, reloaded).start()).toEqual({ kind: "done" });
    expect(session.followers).toEqual(retained);
    open(commandOf(reloaded));
    expect(control<HTMLSelectElement>("event-command-remove-follower-mode").value).toBe("name");
    expect(control<HTMLInputElement>("event-command-remove-follower-name").value).toBe("Bob");
    change("remove-follower-mode", "all");
    cancel();
    expect(applied).toEqual([{ kind: "removeFollower", name: "Bob" }]);
    expect(commandOf(reload())).toEqual(commandOf(reloaded));
  });

  it("explicit all survives Confirm/reopen and removes actors only, preserving monster state", () => {
    saveCommand(project, { kind: "removeFollower", name: "Bob" });
    open();
    change("remove-follower-mode", "all");
    change("remove-follower-name", "");
    confirm();
    const reloaded = reload();
    expect(commandOf(reloaded)).toEqual({ kind: "removeFollower", all: true });
    const session = namedSession(reloaded);
    const monsters = structuredClone(session.followers.filter((entry) => entry.kind === "monster"));
    const party = structuredClone(session.monsterParty);
    const instances = structuredClone(session.monsterInstances);
    expect(createInterpreter([commandOf(reloaded)], session, reloaded).start()).toEqual({ kind: "done" });
    expect(session.followers).toEqual(monsters);
    expect(session.monsterParty).toEqual(party);
    expect(session.monsterInstances).toEqual(instances);
    open(commandOf(reloaded));
    expect(control<HTMLSelectElement>("event-command-remove-follower-mode").value).toBe("all");
    cancel();
    expect(applied).toHaveLength(1);
  });

  it("Cancel after an empty name leaves the saved command and session unchanged", () => {
    saveCommand(project, { kind: "removeFollower", name: "Bob" });
    const session = namedSession(project);
    const before = structuredClone(session.followers);
    open();
    change("remove-follower-name", "");
    cancel();
    expect(applied).toEqual([]);
    expect(commandOf(reload())).toEqual({ kind: "removeFollower", name: "Bob" });
    expect(session.followers).toEqual(before);
  });
});

describe("U06 G5-F5: explicit graphic off deletes saved graphic, not dialog draft", () => {
  it("deletes an existing custom graphic on off/Confirm/reopen and retains actor/name", () => {
    open();
    expect(control<HTMLInputElement>("event-command-add-follower-graphic-frame").value).toBe("2");
    graphic(false);
    confirm();
    const reloaded = reload();
    const saved = commandOf(reloaded);
    expect.soft(saved).toEqual({ kind: "addFollower", actorId: HERO_ID, name: "Hero" });
    expect.soft(saved).not.toHaveProperty("graphic");
    const session = startSession(reloaded, 6);
    expect(createInterpreter([saved], session, reloaded).start()).toEqual({ kind: "done" });
    const actor = reloaded.database.actors.find((entry) => entry.id === HERO_ID)!;
    expect(session.followers).toHaveLength(1);
    expect(session.followers[0]).toMatchObject({
      eventId: HERO_ID, name: "Hero", kind: "actor",
      graphic: charsetFollowerGraphic(actor.characterResourceId!, 0),
    });
    open(saved);
    expect.soft(control<HTMLInputElement>("event-command-add-follower-use-graphic").checked).toBe(false);
    cancel();
    expect(applied).toHaveLength(1);
  });

  it("preserves unrelated graphic scale when an edited inactive draft is restored", () => {
    // Given: authored scale has no editable control in this dialog.
    const original = { ...CUSTOM_FOLLOWER, graphic: { ...CUSTOM_GRAPHIC, scale: 2 } };
    saveCommand(project, original);
    open();
    // When: edit, disable, rename, and restore within the same mounted dialog.
    change("add-follower-graphic-direction", "up");
    graphic(false);
    change("add-follower-name", "Scaled hero");
    graphic(true);
    confirm();
    // Then: only the edited fields change.
    expect(commandOf(reload())).toEqual({ ...original, name: "Scaled hero",
      graphic: { ...original.graphic, direction: "up" } });
  });

  it("recovers the edited graphic draft after off/on in the same dialog", () => {
    open();
    change("add-follower-graphic-direction", "up");
    change("add-follower-graphic-frame", "1");
    graphic(false);
    change("add-follower-name", "Hero renamed");
    graphic(true);
    expect(control<HTMLInputElement>("event-command-add-follower-graphic-id").value).toBe("charsetB");
    expect(control<HTMLInputElement>("event-command-add-follower-graphic-frame").value).toBe("1");
    expect(control<HTMLSelectElement>("event-command-add-follower-graphic-direction").value).toBe("up");
    confirm();
    const saved = commandOf(reload());
    expect(saved).toEqual({ ...CUSTOM_FOLLOWER, name: "Hero renamed",
      graphic: { ...CUSTOM_GRAPHIC, direction: "up", pattern: 1 } });
    open(saved);
    expect(control<HTMLInputElement>("event-command-add-follower-use-graphic").checked).toBe(true);
    cancel();
  });

  it("does not invent a graphic when initially absent and an unrelated name changes", () => {
    saveCommand(project, { kind: "addFollower", actorId: HERO_ID, name: "Hero" });
    open();
    expect(control<HTMLInputElement>("event-command-add-follower-use-graphic").checked).toBe(false);
    change("add-follower-name", "Hero renamed");
    confirm();
    expect(commandOf(reload())).toEqual({ kind: "addFollower", actorId: HERO_ID, name: "Hero renamed" });
  });

  it("Cancel after off retains the original graphic and unrelated fields", () => {
    open();
    graphic(false);
    change("add-follower-name", "Discarded");
    cancel();
    expect(applied).toEqual([]);
    expect(commandOf(reload())).toEqual(CUSTOM_FOLLOWER);
    open(commandOf(reload()));
    expect(control<HTMLInputElement>("event-command-add-follower-use-graphic").checked).toBe(true);
    expect(control<HTMLInputElement>("event-command-add-follower-graphic-frame").value).toBe("2");
    cancel();
  });

  it("an unchanged custom graphic round-trips and is used by a graphic-only follower", () => {
    saveCommand(project, { kind: "addFollower", name: "Mascot", graphic: CUSTOM_GRAPHIC });
    open();
    confirm();
    const reloaded = reload();
    expect(commandOf(reloaded)).toEqual({ kind: "addFollower", name: "Mascot", graphic: CUSTOM_GRAPHIC });
    const session = startSession(reloaded, 6);
    expect(createInterpreter([commandOf(reloaded)], session, reloaded).start()).toEqual({ kind: "done" });
    expect(session.followers).toHaveLength(1);
    expect(session.followers[0]).toMatchObject({ name: "Mascot", graphic: CUSTOM_GRAPHIC, kind: "actor" });
  });
});
