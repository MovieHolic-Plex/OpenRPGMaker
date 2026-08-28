import { computeContactDamage, computeSwingDamage } from "@/battle/action/combatMath";
import { resolveDodgeStep, tickDodgeIframes } from "@/battle/action/dodge";
import { guardedDamage, resolveGuardStep } from "@/battle/action/guard";
import { resolveStaggerOnHit, tickStagger, type ActionModeName } from "@/battle/action/stagger";
import type { EnemyActionAttack } from "@/project/types";

export interface ActionSimPlayer {
  readonly maxHp: number;
  readonly attack: number;
  readonly swingCooldownMs: number;
  readonly swingDamageBonus?: number;
  /** 회피·가드에 쓰는 스태미나. 생략 시 100. */
  readonly stamina?: number;
  /** 회피 1회 비용. 생략 시 25. */
  readonly dodgeCost?: number;
  /** 성공한 회피가 열어주는 무적 창(ms). 생략 시 300. */
  readonly dodgeIframesMs?: number;
  /** 가드 중 피해 감소율(%). 생략 시 50. */
  readonly guardReductionPercent?: number;
  /** 가드 유지 초당 스태미나 소모. 생략 시 10. */
  readonly guardDrainPerSec?: number;
}

export interface ActionSimEnemy {
  readonly maxHp: number;
  readonly defense: number;
  readonly contactDamage: number;
  readonly attack?: EnemyActionAttack;
}

export interface ActionSimResult {
  readonly winner: "player" | "enemy" | "timeout";
  readonly durationMs: number;
  readonly playerSwings: number;
  readonly enemyStrikes: number;
  readonly playerHpLeft: number;
  readonly enemyHpLeft: number;
}

const SIM_MAX_MS = 120_000;
const STEP_MS = 50;
const DEFAULT_STAMINA = 100;
const DEFAULT_DODGE_COST = 25;
const DEFAULT_DODGE_IFRAMES_MS = 300;
const DEFAULT_GUARD_REDUCTION_PERCENT = 50;
const DEFAULT_GUARD_DRAIN_PER_SEC = 10;
const NO_ATTACK_CONTACT_PULSE_MS = 1000;
const NO_ATTACK_FALLBACK_COOLDOWN_MS = 1200;

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * 균형 시뮬레이터 — 씬이 쓰는 순수 규칙 모듈을 그대로 소비한다.
 * 스윙/접촉 피해는 combatMath, 피격 경직은 stagger, 회비·가드 스태미나
 * 경제는 dodge/guard 모듈이 소유하고, 여기서는 그 모듈들을 50ms 스텝으로
 * 돌리는 자리 배치(누가 언제 입력을 넣는가)만 책임진다.
 */
export function simulateActionCombat(player: ActionSimPlayer, enemy: ActionSimEnemy, seed = 1): ActionSimResult {
  const rand = lcg(seed);
  let playerHp = player.maxHp;
  let enemyHp = enemy.maxHp;
  let swingTimer = 0;
  let playerSwings = 0;
  let enemyStrikes = 0;

  let stamina = player.stamina ?? DEFAULT_STAMINA;
  const dodgeCost = player.dodgeCost ?? DEFAULT_DODGE_COST;
  const dodgeIframesMs = player.dodgeIframesMs ?? DEFAULT_DODGE_IFRAMES_MS;
  const guardReductionPercent = player.guardReductionPercent ?? DEFAULT_GUARD_REDUCTION_PERCENT;
  const guardDrainPerSec = player.guardDrainPerSec ?? DEFAULT_GUARD_DRAIN_PER_SEC;
  let iframesRemainingMs = 0;
  let guardDamageMultiplier = 1;

  const attack = enemy.attack;
  const fallbackCooldownMs = attack?.cooldownMs ?? NO_ATTACK_FALLBACK_COOLDOWN_MS;
  let enemyMode: ActionModeName = "combat";
  let phaseTimer = attack ? fallbackCooldownMs : NO_ATTACK_CONTACT_PULSE_MS;
  let staggerRemainingMs = 0;
  let armCooldownOnStaggerEnd = 0;

  for (let t = 0; t < SIM_MAX_MS; t += STEP_MS) {
    // 플레이어 수비 틱: 선딜 중엔 회피를 시도하고, 회피가 없으면 가드를 든다.
    // 스태미나는 회피 비용과 가드 드레인이 같은 통장을 쓴다 — 규칙 모듈 소유.
    const dodge = resolveDodgeStep({
      stamina,
      cost: dodgeCost,
      iframesMs: dodgeIframesMs,
      activeIframesMs: iframesRemainingMs,
      deltaMs: STEP_MS,
      requested: enemyMode === "windup",
    });
    stamina = dodge.stamina;
    iframesRemainingMs = dodge.iframesRemainingMs;
    const guard = resolveGuardStep({
      stamina,
      reductionPercent: guardReductionPercent,
      drainPerSec: guardDrainPerSec,
      deltaMs: STEP_MS,
      requested: true,
      dodging: dodge.invulnerable,
    });
    stamina = guard.stamina;
    guardDamageMultiplier = guard.damageMultiplier;

    // 플레이어 스윙. 맞은 적은 stagger 모듈로 경직에 들어가고,
    // 진행 중이던 선딜은 끊긴다(cancelWindup).
    swingTimer -= STEP_MS;
    if (swingTimer <= 0 && enemyHp > 0) {
      swingTimer = player.swingCooldownMs;
      playerSwings += 1;
      enemyHp -= computeSwingDamage({
        attackerAttack: player.attack,
        defenderDefense: enemy.defense,
        bonus: player.swingDamageBonus ?? 0,
        rand,
      });
      if (enemyHp <= 0) {
        return { winner: "player", durationMs: t, playerSwings, enemyStrikes, playerHpLeft: playerHp, enemyHpLeft: Math.max(0, enemyHp) };
      }
      const stagger = resolveStaggerOnHit({ mode: enemyMode });
      enemyMode = stagger.mode;
      staggerRemainingMs = stagger.modeTimerMs;
      // 선딜을 끊었으면 경직이 끝난 뒤 재발화 쿨다운을 걸어준다.
      // 아니라면 기존 남은 시간(phaseTimer)을 그대로 이어 간다.
      armCooldownOnStaggerEnd = stagger.cancelWindup ? fallbackCooldownMs : 0;
    }

    // 적 행동 틱. 경직 중에는 tickStagger 만 흐르고, 끝나면 쿨다운을 존중한 채
    // 전투로 돌아온다(끊긴 공격이 즉시 재발화하지 않게 armCooldown 으로 되돌린다).
    if (enemyMode === "stagger") {
      // 경직 중에도 남은 쿨다운은 함께 흐른다 — 씬과 같이 tickStagger 에
      // 현재 남은 쿨다운을 넘기고, 끝날 때 armCooldown 만큼만 보정한다.
      phaseTimer = Math.max(0, phaseTimer - STEP_MS);
      const tick = tickStagger({
        modeTimerMs: staggerRemainingMs,
        deltaMs: STEP_MS,
        attackCooldownMs: phaseTimer,
        armCooldownMs: armCooldownOnStaggerEnd,
      });
      staggerRemainingMs = tick.modeTimerMs;
      if (tick.mode === "combat") {
        enemyMode = "combat";
        armCooldownOnStaggerEnd = 0;
      }
      continue;
    }

    phaseTimer -= STEP_MS;
    if (phaseTimer > 0) continue;
    switch (enemyMode) {
      case "combat": {
        if (!attack) {
          // 접촉 펄스 — 양은 combatMath 의 computeContactDamage 가 정한다.
          playerHp -= incomingDamage(
            computeContactDamage({ contactDamage: enemy.contactDamage, enemyAttack: 0, defenderDefense: 0 })
          );
          enemyStrikes += 1;
          phaseTimer = NO_ATTACK_CONTACT_PULSE_MS;
          break;
        }
        enemyMode = "windup";
        phaseTimer = attack.windupMs;
        break;
      }
      case "windup": {
        // 예고된 타격 — 근접 피해도 combatMath 의 변동 규칙을 그대로 쓴다.
        const profile = enemy.attack;
        if (!profile) break;
        const raw = computeSwingDamage({ attackerAttack: profile.damage, defenderDefense: 0, bonus: 0, rand });
        playerHp -= incomingDamage(raw);
        enemyStrikes += 1;
        enemyMode = "recover";
        phaseTimer = profile.recoverMs;
        break;
      }
      case "recover": {
        enemyMode = "combat";
        phaseTimer = fallbackCooldownMs;
        break;
      }
    }
    if (playerHp <= 0) {
      return { winner: "enemy", durationMs: t, playerSwings, enemyStrikes, playerHpLeft: Math.max(0, playerHp), enemyHpLeft: enemyHp };
    }
  }
  return { winner: "timeout", durationMs: SIM_MAX_MS, playerSwings, enemyStrikes, playerHpLeft: playerHp, enemyHpLeft: enemyHp };

  function incomingDamage(raw: number): number {
    if (tickDodgeIframes(iframesRemainingMs, 0) > 0) return 0;
    return guardedDamage(raw, guardDamageMultiplier);
  }
}
