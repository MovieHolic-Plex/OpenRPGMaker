// @vitest-environment happy-dom

import { expect, it, describe } from "vitest";
import { walkField, walkSelect, walkGroupComposition } from "@/editor/panels/walkEncounterOptions";
import { renderEnemyRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { battleEventCommandRuntimeSupport, m2CommandRuntimeClassification } from "@/project/eventCommands/runtimeSupport";
import type { EnemyRecord } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("walkEncounterOptions", () => {
  isolateTimers();
  it("keeps unnamed authored records selectable with a visible identifier", () => {
    const select = walkSelect([{ id: "var_0001", name: "" }], "var_0001", () => undefined);
    expect(select.options[0]?.textContent?.trim()).not.toBe("");
    expect(select.value).toBe("var_0001");
  });
  it("assigns the field name explicitly without incorporating its option labels", () => {
    const select = walkSelect([{ id: "a", name: "option-a" }], "a", () => undefined);
    const field = walkField("field-a", select);
    expect(select.getAttribute("aria-label")).toBe(field.querySelector("span")?.textContent);
  });
  it("counts repeated and hidden authored members instead of using the legacy enemy list", () => {
    const strip = walkGroupComposition({ id: "group", name: "Group", enemyIds: ["wrong"], autoAlign: false, battleEventPages: [], members: [
      { enemyId: "a", x: 0, y: 0 }, { enemyId: "a", x: 1, y: 1, hidden: true }, { enemyId: "b", x: 2, y: 2 },
    ] });
    expect(Array.from(strip.children).map((child) => ({ ...(child as HTMLElement).dataset }))).toEqual([
      { enemyId: "a", count: "2", hiddenCount: "1" }, { enemyId: "b", count: "1", hiddenCount: "0" },
    ]);
  });
  it("counts legacy enemyIds when no formation was authored and preserves an empty authored formation", () => {
    const troop = { id: "group", name: "Group", enemyIds: ["a", "a"], autoAlign: true, battleEventPages: [] };
    expect(walkGroupComposition(troop).querySelector<HTMLElement>("[data-enemy-id=a]")?.dataset.count).toBe("2");
    expect(walkGroupComposition({ ...troop, members: [] }).querySelector("[data-enemy-id]")).toBeNull();
  });
});

// Adversarial unit checks for fixes 3/4/5 (temp QA file — delete after run).
describe("zz-qa-fixes", () => {
  isolateTimers();
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
});
