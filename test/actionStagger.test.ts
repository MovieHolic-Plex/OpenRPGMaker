import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAGGER_MS,
  canActInMode,
  resolveStaggerOnHit,
  tickStagger,
  type ActionModeName,
} from "@/battle/action/stagger";

// 씬(updateEnemyModes)의 모드 전이를 그대로 축소한 미니 리듀서.
// 스태거 규칙이 실제 소비처에서 어떻게 동작하는지 순수하게 재현한다.
interface MiniEnemy {
  mode: ActionModeName;
  modeTimerMs: number;
  attackCooldownMs: number;
  strikes: number;
}

const ATTACK = { windupMs: 400, cooldownMs: 1200 } as const;

function stepFrame(enemy: MiniEnemy, deltaMs: number): void {
  enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);
  switch (enemy.mode) {
    case "combat": {
      if (enemy.attackCooldownMs > 0) break;
      enemy.mode = "windup";
      enemy.modeTimerMs = ATTACK.windupMs;
      break;
    }
    case "windup": {
      enemy.modeTimerMs -= deltaMs;
      if (enemy.modeTimerMs <= 0) {
        enemy.strikes += 1;
        enemy.mode = "recover";
        enemy.modeTimerMs = 200;
      }
      break;
    }
    case "stagger": {
      const out = tickStagger({
        modeTimerMs: enemy.modeTimerMs,
        deltaMs,
        attackCooldownMs: enemy.attackCooldownMs,
        armCooldownMs: ATTACK.cooldownMs,
      });
      enemy.mode = out.mode;
      enemy.modeTimerMs = out.modeTimerMs;
      enemy.attackCooldownMs = out.attackCooldownMs;
      break;
    }
    case "recover": {
      enemy.modeTimerMs -= deltaMs;
      if (enemy.modeTimerMs <= 0) {
        enemy.mode = "combat";
        enemy.attackCooldownMs = ATTACK.cooldownMs;
      }
      break;
    }
    default:
      break;
  }
}

describe("resolveStaggerOnHit", () => {
  it("windup 중 피격은 선딜을 끊고 스태거로 바꾼다", () => {
    const out = resolveStaggerOnHit({ mode: "windup" });
    expect(out.mode).toBe("stagger");
    expect(out.modeTimerMs).toBe(DEFAULT_STAGGER_MS);
    expect(out.cancelWindup).toBe(true);
    expect(out.cancelDash).toBe(false);
  });

  it("dash 중 피격은 진행 중인 돌진 상태를 버린다", () => {
    const out = resolveStaggerOnHit({ mode: "dash" });
    expect(out.cancelWindup).toBe(false);
    expect(out.cancelDash).toBe(true);
    expect(out.mode).toBe("stagger");
  });

  it("combat/recover 중 피격도 스태거로 들어가되 취소할 것이 없다", () => {
    for (const mode of ["combat", "recover"] as const) {
      const out = resolveStaggerOnHit({ mode });
      expect(out.mode).toBe("stagger");
      expect(out.cancelWindup).toBe(false);
      expect(out.cancelDash).toBe(false);
    }
  });

  it("저작된 스태거 길이를 존중하고 쓰레기 값은 기본값으로 클램프한다", () => {
    expect(resolveStaggerOnHit({ mode: "windup", staggerMs: 90 }).modeTimerMs).toBe(90);
    expect(resolveStaggerOnHit({ mode: "windup", staggerMs: -5 }).modeTimerMs).toBe(0);
    expect(resolveStaggerOnHit({ mode: "windup", staggerMs: Number.NaN }).modeTimerMs).toBe(DEFAULT_STAGGER_MS);
  });
});

describe("canActInMode", () => {
  it("스태거 동안에는 행동하지 않는다", () => {
    expect(canActInMode("stagger")).toBe(false);
    expect(canActInMode("combat")).toBe(true);
    expect(canActInMode("windup")).toBe(true);
    expect(canActInMode("dash")).toBe(true);
    expect(canActInMode("recover")).toBe(true);
  });
});

describe("tickStagger", () => {
  it("창이 남아 있으면 스태거를 유지한다", () => {
    const out = tickStagger({ modeTimerMs: 220, deltaMs: 60, attackCooldownMs: 0, armCooldownMs: 1200 });
    expect(out.mode).toBe("stagger");
    expect(out.modeTimerMs).toBe(160);
    expect(out.attackCooldownMs).toBe(0);
  });

  it("창이 끝나면 전투로 돌아가고 공격 쿨다운을 채운다", () => {
    const out = tickStagger({ modeTimerMs: 40, deltaMs: 60, attackCooldownMs: 0, armCooldownMs: 1200 });
    expect(out.mode).toBe("combat");
    expect(out.modeTimerMs).toBe(0);
    expect(out.attackCooldownMs).toBe(1200);
  });

  it("이미 남아 있는 더 긴 쿨다운을 짧게 줄이지 않는다", () => {
    const out = tickStagger({ modeTimerMs: 10, deltaMs: 20, attackCooldownMs: 2000, armCooldownMs: 1200 });
    expect(out.mode).toBe("combat");
    expect(out.attackCooldownMs).toBe(2000);
  });
});

describe("스태거 시나리오(씬 전이 축소판)", () => {
  it("선딜 중 맞은 적은 그 공격을 못 때리고, 스태거가 끝난 뒤 쿨다운을 지나 다시 노린다", () => {
    const enemy: MiniEnemy = { mode: "windup", modeTimerMs: 120, attackCooldownMs: 0, strikes: 0 };

    const hit = resolveStaggerOnHit({ mode: enemy.mode });
    enemy.mode = hit.mode;
    enemy.modeTimerMs = hit.modeTimerMs;

    // 원래 선딜이 끝났을 시점을 지나도 타격은 발생하지 않는다.
    for (let frame = 0; frame < 8; frame += 1) stepFrame(enemy, 16);
    expect(enemy.strikes).toBe(0);
    expect(enemy.mode).toBe("stagger");
    expect(canActInMode(enemy.mode)).toBe(false);

    // 스태거 창이 끝나면 전투 복귀 + 쿨다운이 걸려 있다.
    for (let frame = 0; frame < 8; frame += 1) stepFrame(enemy, 16);
    expect(enemy.mode).toBe("combat");
    // 복귀 프레임 이후로도 몇 프레임 더 흘렀으니 정확한 값이 아니라 "거의 만땅"을 본다.
    expect(enemy.attackCooldownMs).toBeGreaterThan(ATTACK.cooldownMs - 100);
    expect(enemy.strikes).toBe(0);

    // 쿨다운이 다 흐른 뒤에야 다음 선딜이 시작되고 타격이 나온다.
    for (let frame = 0; frame < 200; frame += 1) stepFrame(enemy, 16);
    expect(enemy.strikes).toBe(1);
  });
});
