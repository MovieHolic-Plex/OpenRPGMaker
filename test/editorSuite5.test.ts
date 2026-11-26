import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { normalizeClassRecord, normalizeEnemyRecord } from "@/project/databaseRecordModel";
import { reorderEditableClassCommand, insertCatalogClassCommand, editableClassCommands, moveEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import type { ClassBattleCommand, EnemyActionPattern } from "@/project/types";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { batchApplyCells, interpolateCells } from "@/editor/databaseAnimationCellOps";
import { updateEnemyRecord } from "@/editor/databaseRecordMutators";
import { clampElementListCount, resizeElementRecords } from "@/editor/databaseElementList";
import { applyEnemyActionBehaviourMode, enemyActionBehaviourMode } from "@/editor/databaseEnemyActionMode";
import { isolateTimers } from "./mergedTeardown";
import { duplicateInto } from "@/editor/databaseCopy";
import { DATABASE_FIELD_SUPPORT, databaseFieldSupport, databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import { FakeElement, installFakeDom } from "./fakeDom";
import { deleteSwitch, deleteVariable } from "@/editor/actions";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { resourceReferenceMessage, switchVariableReferenceMessage, databaseReferenceMessage } from "@/editor/databaseReferences";
import { DEFAULT_TROOP_ID } from "@/project/defaults";
import { store } from "@/project/store";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";

describe("databaseClassCommandOrder", () => {
  isolateTimers();
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
});

describe("databaseCopy", () => {
  isolateTimers();
  type NamedRecord = { readonly id: string; name: string };
  // fix(db): " Copy" 하드코딩 접미사를 "사본"으로 바꾸면서, 이름 충돌 시 번호가 증가해야
  // 한다는 계약(P6)을 고정한다 — 반복 복제나 이미 "…사본" 접미사가 붙은 레코드를 다시
  // 복제해도 "…사본 사본" 같은 접미사 중첩이 생기지 않아야 한다.
  describe("duplicateInto — 사본 naming", () => {
    it("appends ' 사본' on the first duplicate", () => {
      const records: NamedRecord[] = [{ id: "a", name: "슬라임" }];
      duplicateInto(records, "a", "b");
      expect(records[1]?.name).toBe("슬라임 사본");
    });

    it("increments a trailing number when the plain 사본 name is already taken", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
      ];
      duplicateInto(records, "a", "c");
      expect(records[2]?.name).toBe("슬라임 사본 2");
    });

    it("keeps incrementing past existing numbered copies", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
        { id: "c", name: "슬라임 사본 2" },
      ];
      duplicateInto(records, "a", "d");
      expect(records[3]?.name).toBe("슬라임 사본 3");
    });

    it("duplicating an already-copied record uses the root name, not a nested suffix", () => {
      const records: NamedRecord[] = [
        { id: "a", name: "슬라임" },
        { id: "b", name: "슬라임 사본" },
      ];
      duplicateInto(records, "b", "c");
      expect(records[2]?.name).toBe("슬라임 사본 2");
      expect(records[2]?.name).not.toContain("사본 사본");
    });
  });
});

describe("databaseFieldSupport", () => {
  isolateTimers();
  const EXPECTED_FIELDS = [
    "imageResourceId",
    "iconResourceId",
    "consumptionLimit",
    "usableActorIds",
    "usableClassIds",
    "seedParameterBonuses",
    // 스키마·런타임에는 있었으나 저작 UI 가 없어 공시도 없던 세 필드(아이템 탭 기능 추가).
    "stateEffects",
    "animationId",
    "careProfile",
    "usageMessage",
    "equipmentProfile",
    "twoHanded",
    "accuracy",
    "criticalRate",
    "usableAsItemSkillId",
    "stateInflictIds",
    "stateInflictionChance",
    "stateResistanceChance",
    // 적의 투명·비행·색조는 화면에서 지운 칸이라(2026-10-02) 공시도 없다.
  ];
  describe("database field support descriptor", () => {
    it("is the unique exhaustive source for the eighteen-field truth contract", () => {
      expect(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).toEqual(EXPECTED_FIELDS);
      expect(new Set(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).size).toBe(18);
      expect(DATABASE_FIELD_SUPPORT.filter((entry) => entry.support === "runtime").map((entry) => entry.field)).toEqual([
        "imageResourceId",
        "iconResourceId",
        "consumptionLimit",
        "usableActorIds",
        "usableClassIds",
        "seedParameterBonuses",
        "stateEffects",
        "animationId",
        "careProfile",
        "twoHanded",
        "accuracy",
        "criticalRate",
        "usableAsItemSkillId",
        "stateInflictIds",
        "stateInflictionChance",
        "stateResistanceChance",
      ]);
      expect(databaseFieldSupport("usageMessage").support).toBe("editorOnly");
      expect(databaseFieldSupport("equipmentProfile").support).toBe("editorOnly");
    });

    it("describes imagery in the current inventory, equipment menu and shop", () => {
      for (const field of ["imageResourceId", "iconResourceId"]) {
        const help = databaseFieldSupport(field).help;
        expect(help).toContain("데이터베이스");
        expect(help).toContain("상점");
        expect(help).toContain("피커");
        expect(help).toContain("미리보기");
        expect(help).toContain("요약");
        expect(help).toContain("인벤토리");
        expect(help).toContain("전투");
        expect(help).toContain("장비 메뉴");
        expect(help).toContain("아이콘을 우선");
        expect(databaseFieldSupport(field).support).toBe("runtime");
      }
    });

    it("renders support state directly from the descriptor", () => {
      const restore = installFakeDom();
      try {
        const notice = databaseFieldSupportNotice("consumptionLimit", "usageMessage");
        const children = (notice as unknown as FakeElement).childNodes as FakeElement[];
        // 접힌 details: [summary, p, p]
        expect(children).toHaveLength(3);
        expect(notice.tagName).toBe("DETAILS");
        expect(children[0]!.tagName).toBe("SUMMARY");
        expect(children[1]!.dataset.runtimeSupport).toBe("runtime");
        expect(children[2]!.dataset.runtimeSupport).toBe("editorOnly");
      } finally {
        restore();
      }
    });
  });
});

describe("databaseReferences", () => {
  isolateTimers();
  describe("databaseReferenceGuards", () => {
    isolateTimers();
    function firstMapId(): string {
      return Object.keys(store.getCurrent().maps)[0] ?? "";
    }
    describe("database reference guards for command-bearing records", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });

      it("blocks deleting records referenced by map event command branches", () => {
        const actorId = addDatabaseRecord("actors");
        const equipmentId = addDatabaseRecord("equipment");
        const mapId = firstMapId();
        updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
        updateDatabaseRecord("equipment", equipmentId, { equippableActorIds: [], equippableClassIds: [] });

        store.update((project) => {
          project.maps[mapId]?.events.push({
            id: "ev_command_refs",
            x: 0,
            y: 0,
            trigger: { kind: "action" },
            commands: [
              {
                kind: "choices",
                options: [{ text: "Equip", branch: [{ kind: "changeEquipment", actorId, slot: "weapon", equipmentId }] }],
                cancelBehavior: "branch",
                cancelBranch: [{ kind: "changeParty", actorId, action: "add" }],
              },
            ],
          });
        });

        expect(deleteDatabaseRecord("actors", actorId)).toMatchObject({ ok: false });
        expect(deleteDatabaseRecord("equipment", equipmentId)).toMatchObject({ ok: false });
      });

      it("blocks deleting records referenced by common event commands and nested shop branches", () => {
        const itemId = addDatabaseRecord("items");
        store.update((project) => {
          const commonEvent = project.commonEvents[0] ?? { id: "ce_refs", name: "Reference CE", trigger: "none", commands: [] };
          if (!project.commonEvents[0]) project.commonEvents.push(commonEvent);
          commonEvent.commands.push({
            kind: "shop",
            itemIds: [],
            branchOnTransaction: true,
            transactionBranch: [{ kind: "changeItem", itemId, op: "+=", amount: 1 }],
          });
        });

        const result = deleteDatabaseRecord("items", itemId);

        expect(result.ok).toBe(false);
        // fix(db): 삭제 거부 메시지는 "무엇이"뿐 아니라 "어디서"(커먼 이벤트 이름) 참조하는지도 밝힌다.
        if (!result.ok) {
          expect(result.message).toContain("커먼 이벤트");
          expect(result.message).toContain("Reference CE");
        }
      });

      it("names the referencing map and event in the deletion-block message", () => {
        const actorId = addDatabaseRecord("actors");
        const mapId = firstMapId();
        updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
        const mapName = store.getCurrent().maps[mapId]?.name ?? "";
        expect(mapName.length).toBeGreaterThan(0);

        store.update((project) => {
          project.maps[mapId]?.events.push({
            id: "ev_named_location",
            x: 2,
            y: 3,
            trigger: { kind: "action" },
            pages: [{ id: "page_1", name: "이름 있는 이벤트", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }],
            commands: [{ kind: "changeParty", actorId, action: "add" }],
          });
        });

        const result = deleteDatabaseRecord("actors", actorId);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toContain(mapName);
          expect(result.message).toContain("이름 있는 이벤트");
          expect(result.message).toContain("ev_named_location");
        }
      });

      it("names the first referencing record for direct field references (e.g. a class learning a skill)", () => {
        const skillId = addDatabaseRecord("skills");
        const classId = store.getCurrent().database.classes[0]?.id ?? "";
        const className = store.getCurrent().database.classes[0]?.name ?? "";
        expect(classId).not.toBe("");
        updateDatabaseRecord("classes", classId, { learnedSkills: [{ level: 1, skillId }] });

        const result = deleteDatabaseRecord("skills", skillId);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toContain(className);
          expect(result.message).toContain("배웁니다");
        }
      });

      it("appends an '외 N-1건' summary when more than one location references the record", () => {
        const actorId = addDatabaseRecord("actors");
        updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
        const mapId = firstMapId();

        store.update((project) => {
          project.maps[mapId]?.events.push(
            { id: "ev_ref_1", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "changeParty", actorId, action: "add" }] },
            { id: "ev_ref_2", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "changeParty", actorId, action: "remove" }] }
          );
        });

        const result = deleteDatabaseRecord("actors", actorId);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toContain("외 1건");
      });

      it("blocks deleting records referenced by battle event page commands and conditions", () => {
        const actorId = addDatabaseRecord("actors");
        const enemyId = addDatabaseRecord("enemies");
        updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
        updateDatabaseRecord("enemies", enemyId, { skillIds: [] });

        store.update((project) => {
          const troop = project.database.troops.find((record) => record.id === DEFAULT_TROOP_ID);
          if (!troop) return;
          troop.battleEventPages.push({
            id: "battle_refs",
            name: "Battle refs",
            span: "battle",
            conditions: [
              { kind: "actorHp", actorId, minPercent: 0, maxPercent: 50 },
              { kind: "enemyTurn", enemyId, turn: 1 },
            ],
            commands: [{ kind: "recoverAll", actorId }],
          });
        });

        expect(deleteDatabaseRecord("actors", actorId)).toMatchObject({ ok: false });
        expect(deleteDatabaseRecord("enemies", enemyId)).toMatchObject({ ok: false });
      });

      it("finds nested command switch, variable, and resource references", () => {
        const mapId = firstMapId();
        store.update((project) => {
          project.switches = [{ id: "sw_nested", name: "Nested Switch" }];
          project.variables = [{ id: "var_nested", name: "Nested Variable" }];
          project.assets.uploaded.ref_sound = {
            id: "ref_sound",
            name: "Reference Sound",
            kind: "sound",
            dataUrl: "data:audio/ogg;base64,T2dnUw==",
            meta: {},
          };
          project.maps[mapId]?.events.push({
            id: "ev_nested_refs",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [{
              kind: "loop",
              body: [{
                kind: "fork",
                condition: { kind: "switch", switchId: "sw_nested", value: true },
                then: [{ kind: "setVariable", variableId: "var_nested", op: "+=", value: { kind: "var", id: "var_nested" } }],
                else: [{ kind: "playAudio", resourceId: "ref_sound", loop: false }],
              }],
            }],
          });
        });

        expect(switchVariableReferenceMessage("switch", "sw_nested")).toContain("스위치");
        expect(switchVariableReferenceMessage("variable", "var_nested")).toContain("변수");
        expect(resourceReferenceMessage("ref_sound")).toContain("이벤트 명령");
      });

      it("deletes unreferenced records while keeping referenced records blocked", () => {
        const referencedActorId = addDatabaseRecord("actors");
        const unreferencedActorId = addDatabaseRecord("actors");
        const mapId = firstMapId();
        updateDatabaseRecord("actors", referencedActorId, { initialEquipment: {} });
        updateDatabaseRecord("actors", unreferencedActorId, { initialEquipment: {} });
        store.update((project) => {
          project.maps[mapId]?.events.push({
            id: "ev_actor_ref",
            x: 0,
            y: 0,
            trigger: { kind: "action" },
            commands: [{ kind: "changeParty", actorId: referencedActorId, action: "add" }],
          });
        });

        expect(deleteDatabaseRecord("actors", referencedActorId)).toMatchObject({ ok: false });
        expect(deleteDatabaseRecord("actors", unreferencedActorId)).toEqual({ ok: true });
        expect(store.getCurrent().database.actors.some((actor) => actor.id === unreferencedActorId)).toBe(false);
      });

      // fix(db): 복합 조건(all/any/not) 안에만 있는 참조도 삭제 가드가 봐야 한다.
      // 예전에는 leaf 조건만 검사해서, AND 그룹 안의 스위치가 경고 없이 삭제되고
      // 남은 조건이 조용히 절대 발동하지 않는 상태가 됐다.
      function pushPageWithConditions(mapId: string, eventId: string, conditions: unknown[]): void {
        store.update((project) => {
          project.maps[mapId]?.events.push({
            id: eventId,
            x: 4,
            y: 4,
            trigger: { kind: "action" },
            pages: [{
              id: `${eventId}_page`,
              name: "복합 조건 페이지",
              conditions: conditions as never,
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
            }],
            commands: [],
          });
        });
      }

      it("blocks deleting a switch referenced only inside an 'all' page condition group", () => {
        const mapId = firstMapId();
        store.update((project) => {
          project.switches = [{ id: "sw_in_all", name: "All Switch" }];
        });
        pushPageWithConditions(mapId, "ev_all_group", [
          { kind: "all", conditions: [{ kind: "switch", switchId: "sw_in_all", value: true }] },
        ]);

        expect(switchVariableReferenceMessage("switch", "sw_in_all")).not.toBeNull();
        expect(deleteSwitch("sw_in_all")).toMatchObject({ ok: false });
        expect(store.getCurrent().switches.some((entry) => entry.id === "sw_in_all")).toBe(true);
      });

      it("blocks deleting a variable referenced only inside a 'not' page condition", () => {
        const mapId = firstMapId();
        store.update((project) => {
          project.variables = [{ id: "var_in_not", name: "Not Variable" }];
        });
        pushPageWithConditions(mapId, "ev_not_group", [
          { kind: "not", condition: { kind: "variable", variableId: "var_in_not", op: ">=", value: 3 } },
        ]);

        expect(switchVariableReferenceMessage("variable", "var_in_not")).not.toBeNull();
        expect(deleteVariable("var_in_not")).toMatchObject({ ok: false });
        expect(store.getCurrent().variables.some((entry) => entry.id === "var_in_not")).toBe(true);
      });

      it("blocks deleting an item referenced only inside an 'any' page condition group", () => {
        const itemId = addDatabaseRecord("items");
        const mapId = firstMapId();
        pushPageWithConditions(mapId, "ev_any_group", [
          {
            kind: "any",
            conditions: [
              { kind: "gold", op: ">=", amount: 10 },
              { kind: "item", itemId, present: true },
            ],
          },
        ]);

        expect(deleteDatabaseRecord("items", itemId)).toMatchObject({ ok: false });
        expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(true);
      });

      it("blocks deleting a switch that a switch item activates", () => {
        const switchItem = store.getCurrent().database.items.find(
          (item) => item.type === "switch" && item.switchId
        );
        expect(switchItem).toBeDefined();

        expect(switchVariableReferenceMessage("switch", switchItem!.switchId!)).not.toBeNull();
        expect(deleteSwitch(switchItem!.switchId!)).toMatchObject({ ok: false });
        expect(store.getCurrent().switches.some((entry) => entry.id === switchItem!.switchId)).toBe(true);
      });

      it("blocks deleting a switch that a skill switch effect activates", () => {
        store.update((project) => {
          project.switches.push({ id: "sw_skill_effect", name: "스킬 스위치" });
          const skill = project.database.skills[0];
          skill.effect = { kind: "switch", switchId: "sw_skill_effect" };
        });

        expect(switchVariableReferenceMessage("switch", "sw_skill_effect")).not.toBeNull();
        expect(deleteSwitch("sw_skill_effect")).toMatchObject({ ok: false });
        expect(store.getCurrent().switches.some((entry) => entry.id === "sw_skill_effect")).toBe(true);
      });

      it("still deletes a switch that has no references at all", () => {
        store.update((project) => {
          project.switches = [{ id: "sw_orphan", name: "Orphan Switch" }];
        });

        expect(switchVariableReferenceMessage("switch", "sw_orphan")).toBeNull();
        expect(deleteSwitch("sw_orphan")).toEqual({ ok: true });
        // 세션 슬롯이 남아 있으면 ensureSwitchVariableSlots가 이름 없는 슬롯을 되살리므로
        // "정의가 사라졌다"는 이름으로 확인한다.
        expect(store.getCurrent().switches.some((entry) => entry.name === "Orphan Switch")).toBe(false);
      });
    });
  });
  describe("databaseStatesGuardEquipmentDefense", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    /** States delete guard must cover equipment.stateDefenseIds, not just stateInflictIds —
     *  otherwise deleting a defended-against state leaves a dangling ref with no warning. */
    describe("states delete guard covers equipment defense", () => {
      it("blocks deleting a state referenced only by equipment.stateDefenseIds", () => {
        const project = store.getCurrent();
        const state = project.database.states[1] ?? project.database.states[0];
        if (!state) throw new Error("no states in fixture");
        const stateId = state.id;
        store.update((draft) => {
          for (const skill of draft.database.skills) {
            skill.stateEffects = (skill.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
          }
          for (const item of draft.database.items) {
            item.stateEffects = (item.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
            item.healStateIds = (item.healStateIds ?? []).filter((id) => id !== stateId);
            item.equipmentProfile.stateInflictIds = item.equipmentProfile.stateInflictIds.filter((id) => id !== stateId);
            item.equipmentProfile.stateDefenseIds = item.equipmentProfile.stateDefenseIds.filter((id) => id !== stateId);
          }
          for (const equip of draft.database.equipment) {
            equip.stateInflictIds = equip.stateInflictIds.filter((id) => id !== stateId);
            equip.stateDefenseIds = equip.stateDefenseIds.filter((id) => id !== stateId);
          }
          draft.database.equipment[0]!.stateDefenseIds = [stateId];
        });
        expect(databaseReferenceMessage("states", stateId)).not.toBeNull();
      });
    });
  });
  describe("saveAndReferences", () => {
    isolateTimers();
    function mkSession(): PlaySession {
      return {
        switches: {},
        selfSwitches: { ev1: { A: true } },
        variables: {},
        timers: {},
        gold: 750,
        inventory: { potion: 3 },
        partyActorIds: [],
        monsterInstances: {},
        monsterParty: [],
        monsterBox: [],
        classOverrides: {},
        actorSkillIds: {},
        actorExperience: {},
        actorLevels: {},
        actorVitals: {},
        eventLocations: {},
        erasedEventIds: [],
        npcTravelStates: {},
        followers: [],
        followerTrail: [],
        actorEquipment: {},
        actorRows: {},
        currentMapId: "m1",
        x: 5,
        y: 6,
        lighting: { ambient: 0, sources: [] },
        mapOverrides: {},
        flags: {},
        audio: {},
        pictures: {},
        playTimeSeconds: 0,
      };
    }
    function mkSessionWithMeta(): PlaySession {
      const session = mkSession();
      session.playTimeSeconds = 3661; // 1h 1m 1s
      return session;
    }
    describe("세이브 직렬화 — gold/selfSwitches", () => {
      it("gold 가 스냅샷에 저장되고 로드 후 복원된다", () => {
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, mkSession());

        expect(snapshot.session.gold).toBe(750);

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.gold).toBe(750);
      });

      it("selfSwitches 가 스냅샷에 저장되고 로드 후 복원된다", () => {
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, mkSession());

        expect(snapshot.session.selfSwitches?.ev1?.A).toBe(true);

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.selfSwitches.ev1?.A).toBe(true);
      });

      it("playTimeSeconds 가 스냅샷에 저장되고 복원된다", () => {
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, mkSessionWithMeta());

        expect(snapshot.playTimeSeconds).toBe(3661);
        expect(snapshot.session.playTimeSeconds).toBe(3661);

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.playTimeSeconds).toBe(3661);
      });

      it("현재 맵 이름이 스냅샷 메타데이터에 저장된다", () => {
        const project = createBlankProject();
        const firstMapId = Object.keys(project.maps)[0]!;
        project.maps[firstMapId]!.name = "시작 마을";
        const session = mkSession();
        session.currentMapId = firstMapId;

        const snapshot = createSaveSnapshot(project, session);

        expect(snapshot.mapName).toBe("시작 마을");
      });

      it("대표 파티 레벨이 슬롯 메타데이터에 저장된다", () => {
        const project = createBlankProject();
        const actorId = project.database.actors[0]!.id;
        const session = mkSession();
        session.partyActorIds = [actorId];
        session.actorLevels = { [actorId]: 7 };

        const snapshot = createSaveSnapshot(project, session);

        expect(snapshot.partyLevel).toBe(7);
      });

      it("erasedEventIds 가 스냅샷에 저장되고 로드 후 복원된다", () => {
        const project = createBlankProject();
        const session = mkSession();
        session.erasedEventIds = ["ev_erased"];

        const snapshot = createSaveSnapshot(project, session);
        const restored = applySaveSnapshot(project, snapshot);

        expect(snapshot.session.erasedEventIds).toEqual(["ev_erased"]);
        expect(restored.erasedEventIds).toEqual(["ev_erased"]);
      });
    });
    describe("스위치/변수 삭제 참조 경고", () => {
      beforeEach(() => {
        // store 에 테스트용 프로젝트를 올린다.
        const project = createBlankProject();
        project.switches = [{ id: "sw1", name: "문 열림" }];
        project.variables = [{ id: "var1", name: "카운트" }];
        store.replace(project);
      });

      afterEach(() => {
        store.replace(createBlankProject());
      });

      it("참조되지 않은 스위치는 경고 없이 삭제 가능하다", () => {
        expect(switchVariableReferenceMessage("switch", "sw1")).toBeNull();
      });

      it("참조되지 않은 변수는 경고 없이 삭제 가능하다", () => {
        expect(switchVariableReferenceMessage("variable", "var1")).toBeNull();
      });

      it("명령에서 참조 중인 스위치는 경고를 반환한다", () => {
        const project = store.getCurrent();
        project.maps[Object.keys(project.maps)[0]!].events.push({
          id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
          commands: [{ kind: "setSwitch", switchId: "sw1", value: true }],
        });
        store.replace(project);

        expect(switchVariableReferenceMessage("switch", "sw1")).not.toBeNull();
      });

      it("fork 조건에서 참조 중인 변수는 경고를 반환한다", () => {
        const project = store.getCurrent();
        project.maps[Object.keys(project.maps)[0]!].events.push({
          id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
          commands: [{
            kind: "fork",
            condition: { kind: "variable", variableId: "var1", op: ">=", value: 5 },
            then: [{ kind: "text", body: "hi" }],
          }],
        });
        store.replace(project);

        expect(switchVariableReferenceMessage("variable", "var1")).not.toBeNull();
      });
    });
  });
});
