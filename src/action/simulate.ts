import { computeSwingDamage } from "@/action/combatMath";
import type { EnemyActionAttack } from "@/project/types";

export interface ActionSimPlayer {
  readonly maxHp: number;
  readonly attack: number;
  readonly swingCooldownMs: number;
  readonly swingDamageBonus?: number;
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

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function simulateActionCombat(player: ActionSimPlayer, enemy: ActionSimEnemy, seed = 1): ActionSimResult {
  const rand = lcg(seed);
  let playerHp = player.maxHp;
  let enemyHp = enemy.maxHp;
  let swingTimer = 0;
  let playerSwings = 0;
  let enemyStrikes = 0;
  let enemyPhase: "windup" | "recover" | "cooldown" = "cooldown";
  let phaseTimer = enemy.attack?.cooldownMs ?? 1200;

  for (let t = 0; t < SIM_MAX_MS; t += STEP_MS) {
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
    }

    phaseTimer -= STEP_MS;
    if (phaseTimer > 0) continue;
    switch (enemyPhase) {
      case "cooldown": {
        if (!enemy.attack) {
          playerHp -= Math.max(1, enemy.contactDamage);
          enemyStrikes += 1;
          phaseTimer = 1000;
          break;
        }
        enemyPhase = "windup";
        phaseTimer = enemy.attack.windupMs;
        break;
      }
      case "windup": {
        playerHp -= Math.max(1, enemy.attack?.damage ?? enemy.contactDamage);
        enemyStrikes += 1;
        enemyPhase = "recover";
        phaseTimer = enemy.attack?.recoverMs ?? 500;
        break;
      }
      case "recover": {
        enemyPhase = "cooldown";
        phaseTimer = enemy.attack?.cooldownMs ?? 1200;
        break;
      }
    }
    if (playerHp <= 0) {
      return { winner: "enemy", durationMs: t, playerSwings, enemyStrikes, playerHpLeft: Math.max(0, playerHp), enemyHpLeft: enemyHp };
    }
  }
  return { winner: "timeout", durationMs: SIM_MAX_MS, playerSwings, enemyStrikes, playerHpLeft: playerHp, enemyHpLeft: enemyHp };
}
