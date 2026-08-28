import { describe, expect, it } from "vitest";
import { computeSwingDamage } from "@/battle/action/combatMath";
import { normalizeEnemyActionProfile } from "@/project/actionCombat";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";

// 광산 1층(map_mine_1f)이 스폰하는 적 + 원거리 적의 액션 프로필 저작 계약.
// 정규화를 통과한 레코드가 의도한 공격 kind 와 0 이상의 데미지를 유지하고,
// 기본 주인공(공격력 45, 보너스 0)의 조준 스윙으로 죽이려면 3~8방이 필요해야 한다.
// rand = () => 0.5 는 variance 1.0 (분산 없음) 이므로 계산이 결정적이다.

const NO_VARIANCE = () => 0.5;
const DEFAULT_PLAYER_ATTACK = 45;
const SWING_BONUS = 0;

function findEnemy(id: string) {
  const enemy = defaultBattleRecords().enemies.find((e) => e.id === id);
  expect(enemy, `${id} 레코드가 기본 DB 에 있어야 한다`).toBeTruthy();
  return enemy!;
}

function swingsToKill(maxHp: number, defense: number): number {
  let hp = maxHp;
  let swings = 0;
  while (hp > 0 && swings < 1000) {
    hp -= computeSwingDamage({
      attackerAttack: DEFAULT_PLAYER_ATTACK,
      defenderDefense: defense,
      bonus: SWING_BONUS,
      rand: NO_VARIANCE,
    });
    swings += 1;
  }
  return swings;
}

describe("광산 적 액션 프로필 저작", () => {
  it("동굴 박쥐 — 빠른 근접 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
    const raw = findEnemy("enemy_cave_bat");
    expect(raw.stats.maxHp).toBeGreaterThan(25); // 리밸런스: 원래 25 는 한방 컷이었다
    const profile = normalizeEnemyActionProfile(raw.actionProfile);
    expect(profile).toBeTruthy();
    expect(profile!.attack!.kind).toBe("melee");
    expect(profile!.attack!.damage).toBeGreaterThan(0);
    // 빠른 근접: 짧은 선딜
    expect(profile!.attack!.windupMs).toBeLessThan(500);
    expect(profile!.contactDamage).toBeGreaterThan(0);
    expect(profile!.aggroRange).toBeGreaterThan(0);
    expect(profile!.moveIntervalMs).toBeGreaterThan(0);
    expect(profile!.knockbackResist).toBeGreaterThanOrEqual(0);

    const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
    expect(swings).toBeGreaterThanOrEqual(3);
    expect(swings).toBeLessThanOrEqual(8);
  });

  it("돌 골렘 — 무거운 근접 공격(긴 선딜/높은 데미지) 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
    const raw = findEnemy("enemy_stone_golem");
    expect(raw.stats.maxHp).toBeGreaterThan(30); // 리밸런스: 원래 30
    const profile = normalizeEnemyActionProfile(raw.actionProfile);
    expect(profile).toBeTruthy();
    expect(profile!.attack!.kind).toBe("melee");
    expect(profile!.attack!.damage).toBeGreaterThan(0);
    // 무거운 근접: 긴 선딜(텔레그래프) + 박쥐보다 높은 데미지
    expect(profile!.attack!.windupMs).toBeGreaterThanOrEqual(900);
    expect(profile!.attack!.damage).toBeGreaterThan(14);
    expect(profile!.contactDamage).toBeGreaterThan(0);
    expect(profile!.knockbackResist).toBeGreaterThan(0); // 무거워서 밀리지 않는다

    const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
    expect(swings).toBeGreaterThanOrEqual(3);
    expect(swings).toBeLessThanOrEqual(8);
  });

  it("광산 해골 궁수 — 투사체 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
    const raw = findEnemy("enemy_mine_skel_archer");
    const profile = normalizeEnemyActionProfile(raw.actionProfile);
    expect(profile).toBeTruthy();
    expect(profile!.attack!.kind).toBe("projectile");
    expect(profile!.attack!.damage).toBeGreaterThan(0);
    expect(profile!.attack!.range).toBeGreaterThan(1); // 근접 부채꼴보다 먼 사거리
    expect(profile!.contactDamage).toBeGreaterThan(0);
    expect(profile!.aggroRange).toBeGreaterThan(0);
    expect(profile!.moveIntervalMs).toBeGreaterThan(0);

    const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
    expect(swings).toBeGreaterThanOrEqual(3);
    expect(swings).toBeLessThanOrEqual(8);
  });

  it("적 타격 데미지가 기본 주인공(maxHp 514)에게 의미 있어야 한다 — 안 피하면 60초 안에 죽는다", () => {
    // 순수 산수 검증: 각 적의 (공격 사이클 데미지)가 유의미한 비중이어야 한다.
    const bat = normalizeEnemyActionProfile(findEnemy("enemy_cave_bat").actionProfile)!;
    const golem = normalizeEnemyActionProfile(findEnemy("enemy_stone_golem").actionProfile)!;
    const archer = normalizeEnemyActionProfile(findEnemy("enemy_mine_skel_archer").actionProfile)!;
    // 박쥐 사이클: windup+recover+cooldown 동안 damage 한 방.
    const batDps = (bat.attack!.damage + bat.contactDamage!) / ((bat.attack!.windupMs + bat.attack!.recoverMs + bat.attack!.cooldownMs!) / 1000);
    // 골렘은 텔레그래프가 길지만 한 방이 무겁다.
    const golemDps = (golem.attack!.damage + golem.contactDamage!) / ((golem.attack!.windupMs + golem.attack!.recoverMs + golem.attack!.cooldownMs!) / 1000);
    // 궁수는 원거리에서 사격.
    const archerDps = (archer.attack!.damage + archer.contactDamage!) / ((archer.attack!.windupMs + archer.attack!.recoverMs + archer.attack!.cooldownMs!) / 1000);
    // 어떤 적이든 계속 붙어 있으면 60초 안에 514 를 깎을 수 있어야 한다 → 평균 DPS >= 9.
    expect(batDps).toBeGreaterThanOrEqual(9);
    expect(golemDps).toBeGreaterThanOrEqual(9);
    expect(archerDps).toBeGreaterThanOrEqual(9);
  });
});
