import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { enemyActionDirectorState } from "@/player/battleDirectorDom";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 2026-11-10 fs-combo-cancel: 불꽃 십자참(2연타) 둘째 타가 「카엘이 불꽃 십자참을 사용했다!」로 읽혀 혼자 쓴 기술처럼 보였다(6/6).
describe("연계기 다단 타격의 후속 문장", () => {
  const before = createBattleRuntime({ project: deserialize(JSON.stringify(battleFixture)), troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
  const hero = before.actors[0]!;
  const target = before.enemies[0]!;
  const entry = { userRecordId: hero.recordId, userId: hero.id, targetId: target.id, hit: true, amount: 10, critical: false, skillName: "합동기" };

  it("연계 참가자가 있으면 참가자 이름으로 연계기를 부른다", () => {
    const line = enemyActionDirectorState({ ...entry, comboActorIds: [hero.recordId, "actor_partner"] }, before).lines.join(" ");
    expect(line).toContain("의 연계기 — 합동기!");
    expect(line).not.toContain("사용했다");
  });

  it("일반 기술은 그대로 「…을 사용했다!」", () => {
    expect(enemyActionDirectorState(entry, before).lines.join(" ")).toContain("합동기를 사용했다!");
  });
});
