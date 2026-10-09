// test/parity/dataIntegrityRoundTrip.test.ts
// Invariant: editor mutations across every collection survive serialize->deserialize losslessly,
// keep references valid, never leak runtime-only fields, and referenced records cannot be deleted.
import { describe, expect, it } from "vitest";
import { DEFAULT_SKILL_ID } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  editorProject,
  referenceIssues,
  updateDatabaseRecord,
} from "./parityRig";

describe("editor->player data-integrity round-trip", () => {
  // 컬렉션마다 1회씩 총 12회 변이 + 2회 왕복이라 이 파일에서 가장 무겁다. store.update 는 호출마다
  // 프로젝트 전체를 복제·정규화하는 안전 경로를 타므로(실측 호출당 ~620ms, 이 테스트 13.9s) 부하 걸린
  // CI 러너에서 기본 15s 를 넘겨 parity 단계가 죽었다. 이 테스트만 넉넉히 준다.
  it("mutations across every collection persist losslessly with zero reference issues", () => {
    const before = editorProject(() => {});
    const counts = {
      items: before.database.items.length,
      skills: before.database.skills.length,
    };

    const project = editorProject(() => {
      const db = store.getCurrent().database;
      updateDatabaseRecord("actors", db.actors[0].id, { name: "parity-actor" });
      updateDatabaseRecord("classes", db.classes[0].id, { name: "parity-class" });
      updateDatabaseRecord("skills", db.skills[0].id, { name: "parity-skill" });
      updateDatabaseRecord("items", db.items[0].id, { name: "parity-item" });
      updateDatabaseRecord("equipment", db.equipment[0].id, { name: "parity-equip" });
      updateDatabaseRecord("enemies", db.enemies[0].id, { name: "parity-enemy" });
      updateDatabaseRecord("troops", db.troops[0].id, { name: "parity-troop" });
      updateDatabaseRecord("states", db.states[0].id, { name: "parity-state" });
      updateDatabaseRecord("battleAnimations", db.battleAnimations[0].id, { name: "parity-anim" });
      addDatabaseRecord("items");
      duplicateDatabaseRecord("skills", db.skills[0].id);
    });

    const names = [
      ...project.database.actors.map((r) => r.name),
      ...project.database.classes.map((r) => r.name),
      ...project.database.skills.map((r) => r.name),
      ...project.database.items.map((r) => r.name),
      ...project.database.equipment.map((r) => r.name),
      ...project.database.enemies.map((r) => r.name),
      ...project.database.troops.map((r) => r.name),
      ...project.database.states.map((r) => r.name),
      ...project.database.battleAnimations.map((r) => r.name),
    ];
    for (const marker of ["parity-actor", "parity-class", "parity-skill", "parity-item", "parity-equip", "parity-enemy", "parity-troop", "parity-state", "parity-anim"]) {
      expect(names).toContain(marker);
    }
    expect(project.database.items.length).toBe(counts.items + 1);
    expect(project.database.skills.length).toBe(counts.skills + 1);
    expect(referenceIssues(project)).toEqual([]);
  }, 60_000);

  it("round-trip is idempotent (no data added or lost on repeated save/load)", () => {
    const once = editorProject(() => updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { name: "idempotent-skill" }));
    const twice = deserialize(serialize(once));
    expect(twice).toEqual(once);
  });

  it("a referenced record cannot be deleted and survives the round-trip", () => {
    let blocked: { ok: boolean } = { ok: true };
    const project = editorProject(() => {
      blocked = deleteDatabaseRecord("skills", DEFAULT_SKILL_ID);
    });
    expect(blocked.ok).toBe(false);
    expect(project.database.skills.some((record) => record.id === DEFAULT_SKILL_ID)).toBe(true);
  });

  it("serialized project keeps the canonical shape and leaks no runtime-only root fields", () => {
    const project = editorProject(() => updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { name: "shape-skill" }));
    const json = JSON.parse(serialize(project)) as Record<string, unknown> & { database: { skills: unknown[] } };
    expect(json.database).toBeDefined();
    expect(json.maps).toBeDefined();
    expect(json.system).toBeDefined();
    expect(Array.isArray(json.database.skills)).toBe(true);
    expect(json.runtime).toBeUndefined();
    expect(json.playSession).toBeUndefined();
  });
});
