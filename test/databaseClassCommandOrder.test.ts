import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeClassRecord, normalizeEnemyRecord } from "@/project/databaseRecordModel";
import { reorderEditableClassCommand, editableClassCommands, moveEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import type { ClassBattleCommand, EnemyActionPattern } from "@/project/types";
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
