import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { createPresentationLedger } from "@/player/battlePresentation";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

// 포켓몬 스킨은 HP 바가 다 줄어든 뒤에 쓰러진다 — 막타 순간 원장이 defeated 를 세우면 쓰러짐 연출과
// 적 HP 행 숨김이 바가 줄기도 전에 돌았다(2026-10-02 적대적 리뷰). deferDefeat 는 쓰러짐 표시만 미룬다.

function ledger() {
  const runtime = createBattleRuntime({ project: deserialize(JSON.stringify(strictFixture)), troopId: "troop_strict_training", canEscape: false, canLose: true, rng: () => 0.5 });
  const before = runtime.snapshot();
  const enemy = before.enemies[0];
  return { presentation: createPresentationLedger(before), enemyId: enemy.id, hp: enemy.hp };
}

describe("presentation ledger deferDefeat", () => {
  it("막타 뒤 쓰러짐 표시는 풀어 줄 때까지 미뤄지고, HP 는 바로 0 이다", () => {
    const { presentation, enemyId, hp } = ledger();
    presentation.applyFeedback({ targetId: enemyId, amount: hp + 50, critical: false, healing: false });
    expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
    const release = presentation.deferDefeat(enemyId);
    expect(presentation.vitalsFor(enemyId)).toMatchObject({ hp: 0, defeated: false });
    // 미루는 동안 한 번 더 맞아도 쓰러짐은 서지 않는다.
    presentation.applyFeedback({ targetId: enemyId, amount: 3, critical: false, healing: false });
    expect(presentation.vitalsFor(enemyId)?.defeated).toBe(false);
    release();
    expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
    release();
    expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
  });

  it("살아 있는 대상에는 아무것도 하지 않고, 미루는 중 회복하면 풀어도 서지 않는다", () => {
    const { presentation, enemyId, hp } = ledger();
    presentation.deferDefeat(enemyId)();
    expect(presentation.vitalsFor(enemyId)?.defeated).toBe(false);
    presentation.applyFeedback({ targetId: enemyId, amount: hp, critical: false, healing: false });
    const release = presentation.deferDefeat(enemyId);
    presentation.applyFeedback({ targetId: enemyId, amount: 5, critical: false, healing: true });
    release();
    expect(presentation.vitalsFor(enemyId)).toMatchObject({ hp: 5, defeated: false });
  });
});
