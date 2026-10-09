import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertCatalogClassCommand, reorderEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBlankProject } from "@/project/defaults";
import type { ClassBattleCommand } from "@/project/types";

const attack: ClassBattleCommand = { id: "attack", name: "Strike", kind: "attack" };
const item: ClassBattleCommand = { id: "item", name: "Pack", kind: "item" };
const footer: ClassBattleCommand = { id: "cmd_change", name: "교체", kind: "switch" };
const catalog: ClassBattleCommand = { id: "magic", name: "Flame arts", kind: "skillSubset", skillId: "skill_fire", skillSubsetName: "Fire" };
const menu = () => Object.freeze([Object.freeze({ ...attack }), Object.freeze({ ...item }), Object.freeze({ ...footer })]);

describe("battle command studio placement", () => {
  it.each([0, 1, 2])("copies a catalog command into insertion slot %i without mutating inputs", (index) => {
    const commands = menu();
    const source = Object.freeze({ ...catalog });
    const result = insertCatalogClassCommand(commands, source, index);
    if (!result.ok) throw new Error(result.reason);
    const expected = [attack, item];
    expected.splice(index, 0, catalog);
    expect(result.commands).toEqual([...expected, footer]);
    expect(result.commands[index]).not.toBe(source);
    expect(commands).toEqual([attack, item, footer]);
    expect(source).toEqual(catalog);
  });

  it("feeds inserted order and copied skill fields to the real actor runtime", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("missing starter actor/class");
    project.system.monsterCollection = false;
    project.database.battleCommands = [{ ...catalog, name: "Different global name", skillId: "skill_other" }];
    const result = insertCatalogClassCommand(menu(), catalog, 1);
    if (!result.ok) throw new Error(result.reason);
    klass.battleCommands = result.commands;
    expect(battleCommandsForActor(project, actor.id, { includeSwitch: true })).toEqual([
      attack, { ...catalog, kind: "skill" }, item, footer,
    ]);
  });

  it.each([["attack", 1], ["item", 0]] as const)("moves %s to final index %i preserving runtime linkage", (id, index) => {
    const commands = menu();
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("missing starter actor/class");
    project.system.monsterCollection = false;
    project.database.battleCommands = [{ ...attack, skillId: "skill_linked" }];
    const result = reorderEditableClassCommand(commands, id, index);
    if (!result.ok) throw new Error(result.reason);
    expect(result.commands).toEqual([item, attack, footer]);
    expect(result.commands[0]).not.toBe(commands[1]);
    klass.battleCommands = result.commands;
    expect(battleCommandsForActor(project, actor.id).map((entry) => entry.id)).toEqual(["item", "attack"]);
    expect(battleCommandsForActor(project, actor.id).find((entry) => entry.id === "attack")?.skillId).toBe("skill_linked");
    expect(commands).toEqual([attack, item, footer]);
  });

  it.each([-1, 3, 0.5, NaN, Infinity])("rejects invalid insertion index %s", (index) => {
    const commands = menu();
    expect(insertCatalogClassCommand(commands, catalog, index)).toEqual({ ok: false, reason: "invalid-index" });
    expect(commands).toEqual([attack, item, footer]);
  });

  it.each([-1, 2, 0.5, NaN, Infinity])("rejects invalid reorder index %s", (index) => {
    const commands = menu();
    expect(reorderEditableClassCommand(commands, "attack", index)).toEqual({ ok: false, reason: "invalid-index" });
    expect(commands).toEqual([attack, item, footer]);
  });

  it("distinguishes duplicate, missing, locked footer, and unchanged actions", () => {
    const commands = menu();
    expect(insertCatalogClassCommand(commands, attack, 0)).toEqual({ ok: false, reason: "duplicate-command" });
    expect(insertCatalogClassCommand(commands, undefined, 0)).toEqual({ ok: false, reason: "missing-command" });
    expect(reorderEditableClassCommand(commands, "deleted", 0)).toEqual({ ok: false, reason: "missing-command" });
    expect(insertCatalogClassCommand(commands, footer, 0)).toEqual({ ok: false, reason: "locked-command" });
    expect(reorderEditableClassCommand(commands, "cmd_change", 0)).toEqual({ ok: false, reason: "locked-command" });
    expect(reorderEditableClassCommand(commands, "attack", 0)).toEqual({ ok: false, reason: "unchanged" });
    expect(commands).toEqual([attack, item, footer]);
  });

  it("accepts and reorders six editable rows but rejects a seventh without losing rows", () => {
    const five = Array.from({ length: 5 }, (_, index) => ({ ...attack, id: `row_${index}` }));
    const result = insertCatalogClassCommand([...five, footer], catalog, 5);
    if (!result.ok) throw new Error(result.reason);
    expect(result.commands).toEqual([...five, catalog, footer]);
    expect(insertCatalogClassCommand(result.commands, item, 6)).toEqual({ ok: false, reason: "capacity" });
    expect(result.commands).toEqual([...five, catalog, footer]);
    const moved = reorderEditableClassCommand(result.commands, "magic", 0);
    if (!moved.ok) throw new Error(moved.reason);
    expect(moved.commands).toEqual([catalog, ...five, footer]);
  });

  it("rejects an already over-cap menu without silently truncating it", () => {
    const commands = Object.freeze([...Array.from({ length: 7 }, (_, index) => ({ ...attack, id: `row_${index}` })), footer]);
    const before = structuredClone(commands);
    expect(insertCatalogClassCommand(commands, catalog, 0)).toEqual({ ok: false, reason: "capacity" });
    expect(reorderEditableClassCommand(commands, "row_0", 1)).toEqual({ ok: false, reason: "capacity" });
    expect(commands).toEqual(before);
  });

  it("seals an empty menu with the existing fixed footer contract", () => {
    expect(insertCatalogClassCommand([], catalog, 0)).toEqual({ ok: true, commands: [catalog, footer] });
  });
});


describe("studio DOM integration", () => {
  let restore: () => void;
  let host: HTMLElement;
  let rerender: () => void;
  let studio: typeof import("@/editor/panels/databaseBattleCommandStudio");
  let store: typeof import("@/project/store")["store"];
  let history: typeof import("@/editor/mapEditHistory");
  const node = (id: string): HTMLElement => {
    const result = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!result) throw new Error(`Missing control ${id}`);
    return result;
  };
  beforeEach(async () => {
    const { installFakeDom } = await import("./fakeDom");
    restore = installFakeDom();
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    ({ store } = await import("@/project/store"));
    history = await import("@/editor/mapEditHistory");
    studio = await import("@/editor/panels/databaseBattleCommandStudio");
    const project = createBlankProject();
    const klass = project.database.classes[0];
    if (!klass) throw new Error("missing class");
    klass.battleCommands = [];
    project.database.classes = [klass, { ...klass, id: "other_class", battleCommands: [{ ...item }] }];
    project.database.battleCommands = [{ ...attack }, { ...catalog }];
    store.replace(project);
    history.resetMapEditHistory();
    host = document.createElement("div");
    rerender = () => {
      const palette = document.createElement("div");
      for (const command of store.getCurrent().database.battleCommands ?? []) {
        const card = document.createElement("article");
        card.dataset.testid = `catalog-${command.id}`;
        studio.attachCatalogPlacement(card, command, rerender);
        palette.append(card);
      }
      host.replaceChildren(studio.battleCommandPlacement(palette, rerender));
    };
    rerender();
    const select = node("db-command-class-select");
    if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
    select.value = klass.id;
    select.dispatchEvent(new Event("change"));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); restore(); });

  function dragEvent(type: string, transfer: { getData: (type: string) => string; setData: (type: string, value: string) => void }): Event {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    return event;
  }
  function transfer() {
    const values = new Map<string, string>();
    return { getData: (type: string) => values.get(type) ?? "", setData: (type: string, value: string) => { values.set(type, value); } };
  }
  it("selects without mutation, snapshots/labells placement, and undoes exact class arrays", () => {
    const before = structuredClone(store.getCurrent().database.classes);
    const updates = vi.spyOn(store, "update");
    const select = node("db-command-class-select");
    if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
    select.value = "other_class";
    select.dispatchEvent(new Event("change"));
    expect(updates).not.toHaveBeenCalled();
    expect(history.getMapEditHistoryMarker()).toBe(0);
    node("db-command-place-magic").dispatchEvent(new Event("click"));
    expect(store.getCurrent().database.classes[0]).toEqual(before[0]);
    expect(store.getCurrent().database.classes[1]?.battleCommands).toEqual([item, catalog, footer]);
    expect(updates).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ scope: "database", collection: "classes", label: expect.any(String) }));
    expect(history.getMapEditHistoryMarker()).toBe(1);
    node("db-command-undo").dispatchEvent(new Event("click"));
    expect(store.getCurrent().database.classes).toEqual(before);
  });
  it("rejects malformed, stale, duplicate, full and cross-class drags without mutations or snapshots", () => {
    const updates = vi.spyOn(store, "update");
    node("db-command-slot-0").dispatchEvent(dragEvent("drop", transfer()));
    expect(updates).not.toHaveBeenCalled();
    const stale = transfer();
    node("catalog-magic").dispatchEvent(dragEvent("dragstart", stale));
    store.update((project) => { project.database.battleCommands = [{ ...attack }, { ...catalog, skillId: "new_skill" }]; });
    updates.mockClear();
    node("db-command-slot-0").dispatchEvent(dragEvent("drop", stale));
    expect(updates).not.toHaveBeenCalled();
    const crossClass = transfer();
    node("catalog-attack").dispatchEvent(dragEvent("dragstart", crossClass));
    const select = node("db-command-class-select");
    if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
    select.value = "other_class";
    select.dispatchEvent(new Event("change"));
    node("db-command-slot-0").dispatchEvent(dragEvent("drop", crossClass));
    expect(updates).not.toHaveBeenCalled();
    store.update((project) => {
      const klass = project.database.classes.find((row) => row.id === "other_class");
      if (klass) klass.battleCommands = [attack, ...Array.from({ length: 5 }, (_, index) => ({ ...item, id: `full_${index}` })), footer];
    });
    rerender();
    updates.mockClear();
    for (const id of ["attack", "magic"]) {
      const data = transfer();
      node(`catalog-${id}`).dispatchEvent(dragEvent("dragstart", data));
      node("db-command-slot-0").dispatchEvent(dragEvent("drop", data));
    }
    expect(updates).not.toHaveBeenCalled();
    expect(history.getMapEditHistoryMarker()).toBe(0);
  });
  it("uses the latest catalog values and preserves existing class overrides", () => {
    store.update((project) => {
      const klass = project.database.classes[0];
      if (klass) klass.battleCommands = [{ ...attack, name: "override", skillId: "private_skill" }, footer];
      project.database.battleCommands = [{ ...attack, name: "global" }, { ...catalog, skillId: "latest_skill" }];
    });
    rerender();
    node("db-command-place-magic").dispatchEvent(new Event("click"));
    expect(store.getCurrent().database.classes[0]?.battleCommands).toEqual([{ ...attack, name: "override", skillId: "private_skill" }, { ...catalog, skillId: "latest_skill" }, footer]);
  });
  it("resets an unapplied CSS preset without creating a project mutation", () => {
    node("db-command-css-preset").dispatchEvent(new Event("click"));
    expect(host.querySelector<HTMLTextAreaElement>('[data-testid="db-command-css-input"]')?.value).not.toBe("");
    node("db-command-css-reset").dispatchEvent(new Event("click"));
    expect(host.querySelector<HTMLTextAreaElement>('[data-testid="db-command-css-input"]')?.value).toBe("");
    expect(store.getCurrent().system.battleCommandCss).toBeUndefined();
    expect(history.getMapEditHistoryMarker()).toBe(0);
  });
  it("preserves a CSS draft across unrelated studio rerenders", () => {
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="db-command-css-input"]');
    if (!input) throw new Error("missing CSS input");
    input.value = ".command { color: #123456; }";
    input.dispatchEvent(new Event("input"));
    rerender();
    expect(host.querySelector<HTMLTextAreaElement>('[data-testid="db-command-css-input"]')?.value).toBe(".command { color: #123456; }");
    expect(store.getCurrent().system.battleCommandCss).toBeUndefined();
  });
  it("renders runtime-authority labels while preserving resolved command identity", async () => {
    const { battleCommandKindLabel } = await import("@/player/battleCommandDom");
    const { resolveTerms } = await import("@/project/terms");
    const project = createBlankProject();
    const klass = project.database.classes.find((entry) => entry.id === "class_hero");
    if (!klass) throw new Error("missing default hero class");
    store.replace(project);
    rerender();
    const select = node("db-command-class-select");
    if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
    select.value = klass.id;
    select.dispatchEvent(new Event("change"));
    const before = structuredClone(studio.resolvedStudioCommands(project, klass.id, false));
    const terms = resolveTerms(project);
    const labels = Array.from(node("db-battle-command-preview").querySelectorAll("li"), (row) => row.textContent);
    expect(labels).toEqual(before.map((command) => battleCommandKindLabel(command, terms)));
    expect(studio.resolvedStudioCommands(project, klass.id, false)).toEqual(before);
    expect(store.getCurrent().database.classes).toEqual(project.database.classes);
  });
  it("previews selected classes without actors and honors fallback/capture/switch rules", () => {
    const project = structuredClone(store.getCurrent());
    project.database.actors = [];
    project.system.monsterCollection = false;
    const klass = project.database.classes[0];
    if (!klass) throw new Error("missing class");
    klass.battleCommands = [{ ...catalog }, footer];
    expect(studio.resolvedStudioCommands(project, klass.id, false)).toEqual([{ ...catalog, kind: "skill" }]);
    expect(studio.resolvedStudioCommands(project, klass.id, true)).toEqual([{ ...catalog, kind: "skill" }, footer]);
    klass.battleCommands = [];
    expect(studio.resolvedStudioCommands(project, klass.id, false).map((row) => row.kind)).toEqual(["attack", "skill", "item", "defend", "escape"]);
    project.system.monsterCollection = true;
    expect(studio.resolvedStudioCommands(project, klass.id, false).at(-1)?.kind).toBe("capture");
    expect(project.database.actors).toEqual([]);
    expect(klass.battleCommands).toEqual([]);
  });
});
