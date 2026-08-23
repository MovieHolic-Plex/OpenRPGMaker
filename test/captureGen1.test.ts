// Gen1 포획 공식 — battleModel 게이트 계약.
//  (1) rm2k3(기본/생략)는 기존 공식 그대로 (monsterCollection.test.ts 의 4개 경계값 보존)
//  (2) gen1 은 (3M-2H)/3M HP 항 + 상태 보너스. 0~1 저장 도메인 유지(255 약분).
//  (3) "재우고 잡기": 수면 ×2 가 실제 확률로 나타난다 — Gen1 핵심 전략의 성립 증명.
import { describe, expect, it } from "vitest";
import { captureStatusMultiplier, captureSuccessRate } from "@/project/monsterCollection";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import type { BattleRuntime } from "@/battle/types";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

describe("captureSuccessRate — gen1 게이트", () => {
  it("rm2k3(옵션 생략)는 기존 공식이 바이트 단위로 유지된다", () => {
    // monsterCollection.test.ts:65-68 과 같은 값 — 옵션 없는 호출이 영원히 이 값이어야 한다.
    expect(captureSuccessRate(0.5, 100, 100, 1)).toBeCloseTo(0.15);
    expect(captureSuccessRate(0.5, 1, 100, 1)).toBeCloseTo(0.4965);
    // model: "rm2k3" 명시도 동일 경로다.
    expect(captureSuccessRate(0.5, 100, 100, 1, { model: "rm2k3", statusMultiplier: 2 })).toBeCloseTo(0.15);
  });

  it("gen1: 만HP 1/3, 빈사 ≈1 — (3M-2H)/3M HP 항", () => {
    // 만HP: hpRatio 1 → (3-2)/3 = 1/3
    expect(captureSuccessRate(1, 100, 100, 1, { model: "gen1" })).toBeCloseTo(1 / 3);
    // 빈사(HP 1%): (3-0.02)/3 ≈ 0.9933
    expect(captureSuccessRate(1, 1, 100, 1, { model: "gen1" })).toBeCloseTo(2.98 / 3);
    // 절반: (3-1)/3 = 2/3
    expect(captureSuccessRate(0.45, 50, 100, 1, { model: "gen1" })).toBeCloseTo(0.45 * (2 / 3));
  });

  it("gen1: 상태 보너스가 곱해지고 1.0 에서 클램프된다", () => {
    const awake = captureSuccessRate(0.3, 100, 100, 1, { model: "gen1" });
    const asleep = captureSuccessRate(0.3, 100, 100, 1, { model: "gen1", statusMultiplier: 2 });
    expect(asleep).toBeCloseTo(awake * 2);
    // 수면 + 빈사 + 고배율 볼 → 1.0 클램프
    expect(captureSuccessRate(0.9, 1, 100, 3, { model: "gen1", statusMultiplier: 2 })).toBe(1);
  });

  it("captureStatusMultiplier: 수면/빙결 ×2, 독/화상/마비 ×1.5, 최대값 하나만", () => {
    expect(captureStatusMultiplier([])).toBe(1);
    expect(captureStatusMultiplier(["state_sleep"])).toBe(2);
    expect(captureStatusMultiplier(["state_freeze"])).toBe(2);
    expect(captureStatusMultiplier(["state_poison"])).toBe(1.5);
    expect(captureStatusMultiplier(["state_burn"])).toBe(1.5);
    expect(captureStatusMultiplier(["state_paralysis"])).toBe(1.5);
    // 복수 상태: Gen1 은 곱하지 않는다 — 2 × 1.5 = 3 이 아니라 max(2, 1.5) = 2.
    expect(captureStatusMultiplier(["state_poison", "state_sleep"])).toBe(2);
    // 무관 상태는 1.
    expect(captureStatusMultiplier(["state_attack_up"])).toBe(1);
  });

  it("런타임 통합: gen1 데모에서 '재우고 잡기'가 성립한다 (같은 roll, 각성 실패 / 수면 성공)", () => {
    // 상태 부여는 정석 경로(battleRuntimeStates.test.ts 패턴)를 쓴다: support 스킬 +
    // stateEffects 100%. support 는 hit:true 에 데미지 0 이라 — 데미지 스킬로 재우면
    // HP 가 깎여 (3M-2H)/3M 항이 같이 올라가 수면 효과와 구분이 안 된다.
    const SLEEP_SKILL = "skill_test_sleep_powder";
    const withSleepSkill = (project: Project): void => {
      project.database.skills.push({
        id: SLEEP_SKILL,
        name: "수면 가루",
        scope: "enemy",
        power: 0,
        description: "테스트 전용 — 대상을 재운다.",
        type: "normal",
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        variance: 0,
        hitRate: 100,
        effect: { kind: "support" },
        stateEffects: [{ stateId: "state_sleep", chance: 100, operation: "add" }],
      });
    };
    const starter = (project: Project): MonsterInstance => ({
      instanceId: "mon_test_1",
      speciesId: scarloxySpeciesId("sparchu"),
      level: 5,
      exp: 0,
      skillIds: [SLEEP_SKILL],
      friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    });
    const makeRuntime = (roll: number): { runtime: BattleRuntime; project: Project } => {
      const project = createScarloxyPokemonDemoProject();
      withSleepSkill(project);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        // battleFlow 는 이제 데모 system 기본값(strict)을 탄다 — 명시하지 않는 것 자체가 검증.
        sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 3 } },
        captureLocation: { mapId: "map_pkmn_route", x: 1, y: 1 },
        partyMonsters: [starter(project)],
        // 상수 rng — 포획 판정(runtime.ts applyCapture 의 roll)도 이 값이다.
        rng: () => roll,
      });
      return { runtime, project };
    };

    // 데모 야생종 captureRate 에서 경계 roll 을 계산: awakeRate ≤ roll < sleepRate.
    const probe = createScarloxyPokemonDemoProject();
    const wildSpeciesId = (() => {
      const troop = probe.database.troops.find((record) => record.id === "troop_pkmn_grass_a");
      const enemy = probe.database.enemies.find((record) => record.id === troop?.members?.[0]?.enemyId);
      if (!enemy?.speciesId) throw new Error("missing wild species for troop_pkmn_grass_a");
      return enemy.speciesId;
    })();
    const species = (probe.database.monsterSpecies ?? []).find((record) => record.id === wildSpeciesId);
    if (!species) throw new Error(`missing species record: ${wildSpeciesId}`);
    const awakeRate = captureSuccessRate(species.captureRate, 100, 100, 1, { model: "gen1" });
    const sleepRate = captureSuccessRate(species.captureRate, 100, 100, 1, { model: "gen1", statusMultiplier: 2 });
    expect(sleepRate).toBeGreaterThan(awakeRate);
    const roll = (awakeRate + sleepRate) / 2;

    // 대조군: 재우지 않고 1라운드에 바로 던진다 → roll ≥ awakeRate 라 실패.
    const awake = makeRuntime(roll);
    awake.runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    expect(awake.runtime.snapshot().capturedMonsters).toHaveLength(0);

    // 실험군: 1라운드 수면 가루(데미지 0, HP 불변) → 2라운드 같은 roll 로 성공.
    // 수면 자연회복(2턴째부터 35%)은 2라운드 upkeep 시점에 stateTurns 가 1이라 아직
    // 굴리지 않는다 — rng 소비 없음, 잠든 채 포획 판정에 도달한다.
    const sleep = makeRuntime(roll);
    sleep.runtime.performActorCommand({ kind: "skill", skillId: SLEEP_SKILL, targetEnemyId: "enemy-1" });
    const enemyAfterSleep = sleep.runtime.snapshot().enemies[0];
    expect(enemyAfterSleep?.stateIds).toContain("state_sleep");
    expect(enemyAfterSleep?.hp).toBe(enemyAfterSleep?.maxHp);
    sleep.runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    expect(sleep.runtime.snapshot().capturedMonsters).toHaveLength(1);
    expect(sleep.runtime.snapshot().capturedMonsters[0]?.speciesId).toBe(wildSpeciesId);
  });
});
