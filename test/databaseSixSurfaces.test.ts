import { describe, expect, it } from "vitest";
import { batchApplyCells, interpolateCells } from "@/editor/databaseAnimationCellOps";
import { editableClassCommands, moveEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import { updateEnemyRecord } from "@/editor/databaseRecordMutators";
import { clampElementListCount, resizeElementRecords } from "@/editor/databaseElementList";
import { applyEnemyActionBehaviourMode, enemyActionBehaviourMode } from "@/editor/databaseEnemyActionMode";
import { createBlankProject } from "@/project/defaults";
import { normalizeEnemyRecord } from "@/project/databaseRecordModel";
import type { ClassBattleCommand, EnemyActionPattern } from "@/project/types";

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
