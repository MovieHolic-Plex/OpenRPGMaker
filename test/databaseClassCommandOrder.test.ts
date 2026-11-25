import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeClassRecord, normalizeEnemyRecord } from "@/project/databaseRecordModel";
import { reorderEditableClassCommand, insertCatalogClassCommand, editableClassCommands, moveEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import type { ClassBattleCommand, EnemyActionPattern } from "@/project/types";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { batchApplyCells, interpolateCells } from "@/editor/databaseAnimationCellOps";
import { updateEnemyRecord } from "@/editor/databaseRecordMutators";
import { clampElementListCount, resizeElementRecords } from "@/editor/databaseElementList";
import { applyEnemyActionBehaviourMode, enemyActionBehaviourMode } from "@/editor/databaseEnemyActionMode";
import { isolateTimers } from "./mergedTeardown";

describe("databaseBattleCommandDuplicateRows", () => {
  isolateTimers();
  const first: ClassBattleCommand = { id: "shared", name: "First Skill", kind: "skill", skillId: "skill_a" };
  const second: ClassBattleCommand = { id: "shared", name: "Second Skill", kind: "skill", skillId: "skill_b", skillSubsetName: "Private" };
  const item: ClassBattleCommand = { id: "item", name: "Pack", kind: "item" };
  const footer: ClassBattleCommand = { id: "cmd_change", name: "교체", kind: "switch" };
  describe("legacy duplicate command row occurrences", () => {
    let restore: () => void;
    let host: HTMLElement;
    let rerender: () => void;
    let store: typeof import("@/project/store")["store"];
    let history: typeof import("@/editor/mapEditHistory");
    const node = (id: string): HTMLElement => {
      const result = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!result) throw new Error(`Missing control ${id}`);
      return result;
    };
    const rows = () => Array.from(host.querySelectorAll<HTMLElement>('[data-testid="db-command-menu-row"]'));
    const action = (index: number, name: "up" | "down" | "remove") => {
      const row = rows()[index];
      if (!row) throw new Error(`Missing row ${index}`);
      // Row-scoped lookup supports both normal-ID and occurrence-specific testids.
      const button = Array.from(row.querySelectorAll<HTMLElement>("button")).find((entry) => entry.dataset.testid?.startsWith(`db-command-${name}-`) || entry.dataset.testid === `db-command-occurrence-${index}-${name}`);
      if (!button) throw new Error(`Missing row action ${name}`);
      return button;
    };
    const commands = () => store.getCurrent().database.classes[0]!.battleCommands;
    const click = (button: HTMLElement) => button.dispatchEvent(new Event("click"));
    function transfer() {
      const values = new Map<string, string>();
      return { getData: (type: string) => values.get(type) ?? "", setData: (type: string, value: string) => { values.set(type, value); } };
    }
    function dragEvent(type: string, dataTransfer: ReturnType<typeof transfer>) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      return event;
    }
    beforeEach(async () => {
      const { installFakeDom } = await import("./fakeDom");
      restore = installFakeDom();
      vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
      ({ store } = await import("@/project/store"));
      history = await import("@/editor/mapEditHistory");
      const studio = await import("@/editor/panels/databaseBattleCommandStudio");
      const project = createBlankProject();
      const klass = normalizeClassRecord({ ...project.database.classes[0]!, battleCommands: [first, second, item, footer] });
      expect(klass.battleCommands).toEqual([first, second, item, footer]);
      project.database.classes = [klass];
      store.replace(project);
      history.resetMapEditHistory();
      host = document.createElement("div");
      rerender = () => host.replaceChildren(studio.battleCommandPlacement(document.createElement("div"), rerender));
      rerender();
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); restore(); });

    it.each([0, 1])("removes only occurrence %i and undoes to the exact normalized class data", (index) => {
      const before = structuredClone(store.getCurrent().database.classes);
      const updates = vi.spyOn(store, "update");
      click(action(index, "remove"));
      expect(commands()).toEqual([index === 0 ? second : first, item, footer]);
      expect(updates).toHaveBeenCalledTimes(1);
      expect(history.getMapEditHistoryMarker()).toBe(1);
      click(node("db-command-undo"));
      expect(store.getCurrent().database.classes).toStrictEqual(before);
    });

    it.each(["up", "down"] as const)("moves the second occurrence %s without changing its overrides and undoes exactly", (direction) => {
      const before = structuredClone(store.getCurrent().database.classes);
      click(action(1, direction));
      expect(commands()).toEqual(direction === "up" ? [second, first, item, footer] : [first, item, second, footer]);
      expect(history.getMapEditHistoryMarker()).toBe(1);
      click(node("db-command-undo"));
      expect(store.getCurrent().database.classes).toStrictEqual(before);
    });

    it.each([0, 3])("drags the second occurrence into gap %i", (gap) => {
      const before = structuredClone(store.getCurrent().database.classes);
      const data = transfer();
      rows()[1]!.dispatchEvent(dragEvent("dragstart", data));
      node(`db-command-slot-${gap}`).dispatchEvent(dragEvent("drop", data));
      expect(commands()).toEqual(gap === 0 ? [second, first, item, footer] : [first, item, second, footer]);
      expect(history.getMapEditHistoryMarker()).toBe(1);
      click(node("db-command-undo"));
      expect(store.getCurrent().database.classes).toStrictEqual(before);
    });

    it.each(["remove", "up", "down", "drag-before", "drag-after"] as const)("rejects stale occurrence %s without a mutation or snapshot", (operation) => {
      const retained = operation.startsWith("drag") ? rows()[1]! : action(1, operation as "remove" | "up" | "down");
      const data = transfer();
      if (operation === "drag-before") retained.dispatchEvent(dragEvent("dragstart", data));
      store.update((project) => { project.database.classes[0]!.battleCommands = [second, first, item, footer]; });
      const before = structuredClone(store.getCurrent().database.classes);
      const updates = vi.spyOn(store, "update");
      if (operation.startsWith("drag")) {
        if (operation === "drag-after") retained.dispatchEvent(dragEvent("dragstart", data));
        node("db-command-slot-3").dispatchEvent(dragEvent("drop", data));
      } else click(retained);
      expect(updates).not.toHaveBeenCalled();
      expect(history.getMapEditHistoryMarker()).toBe(0);
      expect(store.getCurrent().database.classes).toStrictEqual(before);
    });

    it("removes one over-cap occurrence without truncating rows or changing interleaved fixed footer overrides", () => {
      const legacyFooter = { ...footer, name: "Legacy switch", skillId: "switch_override" };
      const legacy = [first, legacyFooter, second, ...Array.from({ length: 5 }, (_, index) => ({ ...item, id: `item_${index}` })), footer];
      store.update((project) => { project.database.classes[0]!.battleCommands = legacy; });
      rerender();
      const before = structuredClone(store.getCurrent().database.classes);
      click(action(1, "up"));
      expect(commands()).toEqual(legacy);
      expect(history.getMapEditHistoryMarker()).toBe(0);
      click(action(1, "remove"));
      expect(commands()).toEqual(legacy.filter((_row, index) => index !== 2));
      click(node("db-command-undo"));
      expect(store.getCurrent().database.classes).toStrictEqual(before);
    });

    it("rejects an ambiguous ID-only reorder rather than choosing the first occurrence", () => {
      const before = Object.freeze([first, second, item, footer]);
      expect(reorderEditableClassCommand(before, "shared", 2)).toEqual({ ok: false, reason: "duplicate-command" });
      expect(before).toEqual([first, second, item, footer]);
    });
  });
});

describe("databaseBattleCommandStudio", () => {
  isolateTimers();
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
      const labels = Array.from(node("db-battle-command-preview").querySelectorAll(".battle-command .battle-command-text strong"), (row) => row.textContent);
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
});

describe("databaseSixSurfaces", () => {
  isolateTimers();
  describe("database six-surface pure mutators", () => {
    it("resizes element list with unique ids and clamps count", () => {
      const base = resizeElementRecords([], 3);
      expect(base).toHaveLength(3);
      expect(new Set(base.map((entry) => entry.id)).size).toBe(3);
      expect(resizeElementRecords(base, 1)).toHaveLength(1);
      expect(clampElementListCount(0)).toBe(1);
      expect(clampElementListCount(200)).toBe(99);
    });

    it("reorders editable class battle commands and keeps change at the end", () => {
      const commands: ClassBattleCommand[] = [
        { id: "a", name: "공격", kind: "attack" },
        { id: "b", name: "기술", kind: "skill" },
        { id: "c", name: "아이템", kind: "item" },
        { id: "cmd_change", name: "교체", kind: "switch" },
      ];
      const moved = moveEditableClassCommand(commands, 0, 1);
      expect(editableClassCommands(moved).map((entry) => entry.id)).toEqual(["b", "a", "c"]);
      expect(moved.at(-1)?.id).toBe("cmd_change");
    });

    it("applies enemy action basic/skill modes and keeps basic attack through normalize/update", () => {
      const action: EnemyActionPattern = {
        skillId: "skill_heal",
        priority: 10,
        condition: { kind: "always" },
        switchOnAfterAction: { enabled: false },
        switchOffAfterAction: { enabled: false },
      };
      expect(enemyActionBehaviourMode(action)).toBe("skill");
      const basic = applyEnemyActionBehaviourMode(action, "basic");
      expect(basic.skillId).toBe("");
      expect(enemyActionBehaviourMode(basic)).toBe("basic");
      const skill = applyEnemyActionBehaviourMode(basic, "skill", "skill_fire");
      expect(skill.skillId).toBe("skill_fire");

      // Real shipped path: dialog OK → updateEnemyRecord → normalizeEnemyRecord must not drop basic attacks.
      const project = createBlankProject();
      const enemy = project.database.enemies[0];
      if (!enemy) throw new Error("missing default enemy");
      updateEnemyRecord(project.database, enemy.id, {
        actions: [basic, { ...action, skillId: "skill_heal", priority: 20 }],
      });
      const saved = project.database.enemies.find((entry) => entry.id === enemy.id);
      expect(saved?.actions.some((entry) => entry.skillId === "")).toBe(true);
      expect(saved?.actions.some((entry) => entry.skillId === "skill_heal")).toBe(true);
      expect(saved?.skillIds).not.toContain("");
      expect(saved?.skillIds).toContain("skill_heal");

      const renorm = normalizeEnemyRecord(saved!);
      expect(renorm.actions.filter((entry) => entry.skillId === "")).toHaveLength(1);
    });

    it("batch-applies and interpolates animation cells", () => {
      const cells = [
        { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true },
        { pattern: 1, x: 10, y: 20, zoom: 100, opacity: 200, visible: true },
      ];
      const batched = batchApplyCells(cells, { zoom: 150, opacity: 100 });
      expect(batched.every((cell) => cell.zoom === 150 && cell.opacity === 100)).toBe(true);
      expect(batched[0]?.pattern).toBe(0);
      expect(batched[1]?.pattern).toBe(1);

      const mid = interpolateCells(
        [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 0, visible: true }],
        [{ pattern: 4, x: 10, y: 20, zoom: 200, opacity: 200, visible: true }],
        0.5,
      );
      expect(mid[0]).toMatchObject({ pattern: 2, x: 5, y: 10, zoom: 150, opacity: 100 });
    });
  });
});
