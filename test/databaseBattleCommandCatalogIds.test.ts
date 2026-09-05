import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";

describe("battle command catalog ID allocation", () => {
  let restoreDom: () => void;
  let host: HTMLElement;
  let store: typeof import("@/project/store")["store"];
  let studio: typeof import("@/editor/panels/databaseBattleCommandStudio");
  let actorId: string;
  let classId: string;
  let skillId: string;

  function control(id: string): HTMLElement {
    const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }

  function input(id: string, value: string, event: "input" | "change"): void {
    const node = control(id);
    if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) throw new Error(`Not a field: ${id}`);
    node.value = value;
    node.dispatchEvent(new Event(event));
  }

  beforeEach(async () => {
    restoreDom = installFakeDom();
    vi.stubGlobal("window", {
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    ({ store } = await import("@/project/store"));
    studio = await import("@/editor/panels/databaseBattleCommandStudio");
    const { renderBattleCommandsTab } = await import("@/editor/panels/databaseUtilityRecordViews");
    const { resetMapEditHistory } = await import("@/editor/mapEditHistory");
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((row) => row.id === actor?.classId);
    const skill = project.database.skills[0];
    if (!actor || !klass || !skill) throw new Error("Missing starter actor/class/skill");
    actorId = actor.id;
    classId = klass.id;
    skillId = skill.id;
    project.system.monsterCollection = false;
    project.database.classes = [
      { ...klass, id: "unrelated_class", battleCommands: [] },
      { ...klass, battleCommands: [] },
    ];
    // Reserve the next candidate in the catalog as well as the placed cmd_002.
    project.database.battleCommands = [{ id: "cmd_003", name: "Source", kind: "skill" }];
    store.replace(project);
    resetMapEditHistory();
    host = document.createElement("div");
    renderBattleCommandsTab(host);
    input("db-command-class-select", classId, "change");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreDom();
  });

  it.each(["add", "duplicate"] as const)("%s does not relink a deleted catalog ID still placed in another class", (action) => {
    control("db-battle-command-add").dispatchEvent(new Event("click"));
    const original = store.getCurrent().database.battleCommands?.[1];
    if (!original) throw new Error("Missing added command");
    expect(original.id).toBe("cmd_002");
    input("db-field-battle-command-kind-1", "skill", "change");
    control(`db-command-place-${original.id}`).dispatchEvent(new Event("click"));
    const authoredBefore = structuredClone(store.getCurrent().database.classes);
    const runtimeBefore = battleCommandsForActor(store.getCurrent(), actorId);
    expect(runtimeBefore).toEqual([expect.objectContaining({ id: original.id, kind: "skill" })]);
    expect(runtimeBefore[0]?.skillId).toBeUndefined();
    expect(runtimeBefore[0]?.skillSubsetName).toBeUndefined();

    const remove = control("db-battle-command-delete-1");
    remove.dispatchEvent(new Event("click"));
    remove.dispatchEvent(new Event("click"));
    expect(store.getCurrent().database.battleCommands?.map((row) => row.id)).toEqual(["cmd_003"]);
    expect(store.getCurrent().database.classes).toEqual(authoredBefore);
    expect(battleCommandsForActor(store.getCurrent(), actorId)).toEqual(runtimeBefore);

    // Allocation must inspect every class, not only the currently displayed one.
    input("db-command-class-select", "unrelated_class", "change");
    control(action === "add" ? "db-battle-command-add" : "db-battle-command-duplicate-0").dispatchEvent(new Event("click"));
    input("db-picker-battle-command-skill-1", skillId, "change");
    input("db-field-battle-command-subset-1", "Replacement subset", "input");
    const replacement = store.getCurrent().database.battleCommands?.[1];
    expect(replacement).toEqual(expect.objectContaining({ skillId, skillSubsetName: "Replacement subset" }));
    expect(store.getCurrent().database.classes).toEqual(authoredBefore);
    // Assert the actual consequence before ID uniqueness, so RED exposes both fallback fields.
    expect(battleCommandsForActor(store.getCurrent(), actorId)).toEqual(runtimeBefore);
    expect(studio.resolvedStudioCommands(store.getCurrent(), classId, false)).toEqual(runtimeBefore);
    expect(replacement?.id).toBe("cmd_004");

    input("db-command-class-select", classId, "change");
    const place = control(`db-command-place-${replacement?.id}`);
    expect(place.getAttribute("disabled")).toBeNull();
    place.dispatchEvent(new Event("click"));
    const commands = store.getCurrent().database.classes.find((row) => row.id === classId)?.battleCommands;
    expect(commands?.map((row) => row.id)).toEqual([original.id, replacement?.id, "cmd_change"]);
    expect(battleCommandsForActor(store.getCurrent(), actorId).find((row) => row.id === original.id)).toEqual(runtimeBefore[0]);
  }, 60_000);
});
