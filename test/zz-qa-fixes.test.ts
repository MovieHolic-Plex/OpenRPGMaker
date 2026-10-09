// @vitest-environment happy-dom
// Adversarial unit checks for fixes 3/4/5 (temp QA file — delete after run).
import { describe, expect, it } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { battleEventCommandRuntimeSupport, m2CommandRuntimeClassification } from "@/project/eventCommands/runtimeSupport";
import type { EnemyRecord } from "@/project/types";

function enemyWith(resourceId: string | undefined): EnemyRecord {
  return {
    id: "enemy_qa",
    name: "QA",
    monsterResourceId: resourceId,
    stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 },
    rewards: { exp: 0, gold: 0 },
    actions: [],
    stateRates: {},
  } as unknown as EnemyRecord;
}

describe("fix 3: m2-109-result-summary classification", () => {
  it("does not throw and classifies as editor-only in troop context", () => {
    expect(() => m2CommandRuntimeClassification("m2-109-result-summary")).not.toThrow();
    const support = battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: "m2-109-result-summary", fields: {} });
    expect(support).toBe("editor-only");
  });

  it("every persisted m2 id used by the troop panel is classifiable (no crash path)", () => {
    for (const id of ["m2-101-enemy-encounter", "m2-102-change-battleback", "m2-109-result-summary"]) {
      expect(() => battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: id, fields: {} }), id).not.toThrow();
    }
  });
});

describe("fix 4: generated-resource preview slot", () => {
  it("renders a neutral slot with no button for generated- resources", () => {
    const form = document.createElement("div");
    renderEnemyRecordForm(form, enemyWith("generated-qa-monster"));
    const slot = form.querySelector(".db-neutral-resource-slot.generated");
    expect(slot).not.toBeNull();
    expect(slot!.querySelector("button")).toBeNull();
  });

  it("empty resource renders an empty neutral slot, also buttonless", () => {
    const form = document.createElement("div");
    renderEnemyRecordForm(form, enemyWith(undefined));
    const slot = form.querySelector(".db-neutral-resource-slot.empty");
    expect(slot).not.toBeNull();
    expect(slot!.querySelector("button")).toBeNull();
  });
});
