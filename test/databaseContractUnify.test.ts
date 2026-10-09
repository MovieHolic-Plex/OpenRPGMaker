import { beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, updateDatabaseRecord, type DatabaseCollection } from "@/editor/databaseActions";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_ANIMATION_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_ENEMY_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_ITEM_ID,
  DEFAULT_SKILL_ID,
  DEFAULT_STATE_ID,
  DEFAULT_TROOP_ID,
} from "@/project/defaults";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeActorRecord } from "@/project/actorModel";
import {
  normalizeClassRecord,
  normalizeEnemyRecord,
  normalizeEquipmentRecord,
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeStateRecord,
  normalizeTroopRecord,
} from "@/project/databaseRecordModel";
import { store } from "@/project/store";

const NORMALIZERS: Record<DatabaseCollection, (r: any) => any> = {
  actors: normalizeActorRecord,
  classes: normalizeClassRecord,
  skills: normalizeSkillRecord,
  items: normalizeItemRecord,
  equipment: normalizeEquipmentRecord,
  enemies: normalizeEnemyRecord,
  troops: normalizeTroopRecord,
  states: normalizeStateRecord,
  battleAnimations: normalizeBattleAnimationRecord,
};

const DEFAULT_ID: Record<DatabaseCollection, string> = {
  actors: DEFAULT_ACTOR_ID,
  classes: DEFAULT_CLASS_ID,
  skills: DEFAULT_SKILL_ID,
  items: DEFAULT_ITEM_ID,
  equipment: DEFAULT_EQUIPMENT_ID,
  enemies: DEFAULT_ENEMY_ID,
  troops: DEFAULT_TROOP_ID,
  states: DEFAULT_STATE_ID,
  battleAnimations: DEFAULT_ANIMATION_ID,
};

function findRecord(collection: DatabaseCollection, id: string): any {
  const db = store.getCurrent().database as any;
  return db[collection].find((entry: any) => entry.id === id);
}

describe("Database write/normalize contract — single kernel (G002)", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("C001: updateDatabaseRecord normalizes ALL 9 collections (parity with normalize*Record)", () => {
    const cases: ReadonlyArray<{ collection: DatabaseCollection; patch: Record<string, unknown> }> = [
      { collection: "actors", patch: { name: "영웅개명", initialLevel: 5 } },
      { collection: "classes", patch: { name: "전사" } },
      { collection: "skills", patch: { name: "화염", power: 30 } },
      { collection: "items", patch: { name: "회복약", price: 80 } },
      { collection: "equipment", patch: { name: "강철검", price: 200 } },
      { collection: "enemies", patch: { name: "슬라임킹" } },
      { collection: "troops", patch: { name: "슬라임 무리" } },
      { collection: "states", patch: { name: "독", priority: 7 } },
      { collection: "battleAnimations", patch: { name: "타격", scope: "allTargets" } },
    ];

    for (const { collection, patch } of cases) {
      const id = DEFAULT_ID[collection];
      const before = structuredClone(findRecord(collection, id));
      updateDatabaseRecord(collection, id, patch);
      const after = findRecord(collection, id);
      const normalize = NORMALIZERS[collection];
      const expected = normalize({ ...before, ...patch });
      expect(after, `${collection}: stored record must equal normalize*Record(merged)`).toEqual(expected);
    }
  });

  it("C002a: UI path drops unknown fields (does not persist them)", () => {
    const before = structuredClone(findRecord("skills", DEFAULT_SKILL_ID));
    updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { bogusField: 999, name: "이름만" } as any);
    const after = findRecord("skills", DEFAULT_SKILL_ID);
    expect((after as any).bogusField).toBeUndefined();
    expect(after.name).toBe("이름만");
    expect(after.scope).toBe(before.scope);
  });

  it("C002b: actors malformed patch is normalized (maxLevel < initialLevel clamped)", () => {
    const id = DEFAULT_ACTOR_ID;
    const before = findRecord("actors", id);
    updateDatabaseRecord("actors", id, { initialLevel: 50, maxLevel: 5 } as any);
    const after = findRecord("actors", id);
    expect(after.maxLevel).toBeGreaterThanOrEqual(after.initialLevel);
    expect(after.maxLevel).toBe(normalizeActorRecord({ ...before, initialLevel: 50, maxLevel: 5 }).maxLevel);
  });

  it("C002c: UI and AI paths converge — same patch yields records equal to normalize*Record(canonical)", () => {
    const convergence: ReadonlyArray<{
      collection: DatabaseCollection;
      tool: string;
      argKey: string;
      patch: Record<string, unknown>;
    }> = [
      { collection: "actors", tool: "upsert_actor", argKey: "actor", patch: { name: "수렴영웅", initialLevel: 7 } },
      { collection: "skills", tool: "upsert_skill", argKey: "skill", patch: { name: "수렴스킬", power: 18 } },
      { collection: "items", tool: "upsert_item", argKey: "item", patch: { name: "수렴아이템", price: 50 } },
      { collection: "equipment", tool: "upsert_equipment", argKey: "equipment", patch: { name: "수렴검", price: 120 } },
      { collection: "classes", tool: "upsert_class", argKey: "class", patch: { name: "수렴직업" } },
      { collection: "enemies", tool: "upsert_enemy", argKey: "enemy", patch: { name: "수렴적" } },
      { collection: "troops", tool: "upsert_troop", argKey: "troop", patch: { name: "수렴무리" } },
      { collection: "states", tool: "upsert_state", argKey: "state", patch: { name: "수렴상태", priority: 4 } },
    ];

    for (const { collection, tool, argKey, patch } of convergence) {
      const id = DEFAULT_ID[collection];
      const normalize = NORMALIZERS[collection];

      const ctxUi: ToolContext = { project: structuredClone(store.getCurrent()) };
      store.replace(ctxUi.project);
      const beforeUi = structuredClone(findRecord(collection, id));
      updateDatabaseRecord(collection, id, patch);
      const uiResult = structuredClone(findRecord(collection, id));

      const ctxAi: ToolContext = { project: createBlankProject() };
      const beforeAi = structuredClone(ctxAi.project.database[collection].find((e: any) => e.id === id));
      const result = runTool(ctxAi, tool, { [argKey]: { id, ...patch } }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const aiResult = (ctxAi.project.database as any)[collection].find((e: any) => e.id === id);

      const canonicalUi = normalize({ ...beforeUi, ...patch });
      const canonicalAi = normalize({ ...beforeAi, ...patch });
      expect(uiResult, `${collection} UI result must equal canonical normalize`).toEqual(canonicalUi);
      expect(aiResult, `${collection} AI result must equal canonical normalize`).toEqual(canonicalAi);
      expect(uiResult, `${collection} UI and AI must converge to identical normalized record`).toEqual(aiResult);
    }
  });

  it("C003: addDatabaseRecord normalizes newly-created states and battleAnimations", () => {
    const stateId = addDatabaseRecord("states");
    const newState = findRecord("states", stateId);
    expect(newState).toEqual(normalizeStateRecord({ id: stateId, name: "새 상태" }));

    const animId = addDatabaseRecord("battleAnimations");
    const newAnim = findRecord("battleAnimations", animId);
    expect(newAnim).toEqual(normalizeBattleAnimationRecord({ id: animId, name: "새 애니메이션" }));
    expect(newAnim.large).toBe(false);
    expect(newAnim.scope).toBe("singleTarget");
    expect(Array.isArray(newAnim.frames)).toBe(true);
    expect(Array.isArray(newAnim.timings)).toBe(true);
  });
});
