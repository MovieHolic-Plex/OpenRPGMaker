import { describe, expect, it } from "vitest";
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
