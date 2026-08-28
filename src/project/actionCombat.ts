// project/actionCombat.ts
// 실시간 액션 전투 옵트인 패키지의 스키마 정규화 + 런타임 설정 해석.
// timeSystem/monsterCollection과 같은 패턴: 생략 시 레거시(턴제 라우팅) 유지.

import { GUARD_MAX_DAMAGE_REDUCTION_PERCENT } from "@/battle/action/guard";

import type {
  ActionCombatHudConfig,
  ActionSkillProfile,
  ActionWeaponProfile,
  EnemyActionAttack,
  EnemyActionProfile,
  GameMap,
  Project,
  SystemActionCombat,
} from "@/project/types";

export const DEFAULT_PLAYER_IFRAMES_MS = 800;
export const DEFAULT_SWING_COOLDOWN_MS = 350;
export const DEFAULT_SWING_RANGE = 1;
export const DEFAULT_DODGE_STAMINA_COST = 25;
export const DEFAULT_DODGE_IFRAMES_MS = 300;
export const DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT = 50;
export const DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC = 20;

export interface ResolvedActionCombatConfig {
  readonly playerIframesMs: number;
  readonly swingCooldownMs: number;
  readonly swingDamageBonus: number;
  readonly swingRange: number;
  readonly hearts: boolean;
  /** 스태미나 바 **표시** 여부(hud.stamina). 소모 규칙과 무관. */
  readonly stamina: boolean;
  /** 스태미나 소모 규칙이 도는가. 액션 전투 맵에서는 기본 true. */
  readonly staminaEnabled: boolean;
  readonly dodgeStaminaCost: number;
  readonly dodgeIframesMs: number;
  /** 가드 중 피해 감소율(%). 0..90. */
  readonly guardDamageReductionPercent: number;
  /** 가드 유지 초당 스태미나 소모. */
  readonly guardStaminaDrainPerSec: number;
  readonly enemyHpBars: "always" | "damaged" | "never";
  readonly fourWayMovement: boolean;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function clamp01(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(0, n));
}

export function normalizeActionCombatHud(hud: ActionCombatHudConfig | undefined): ActionCombatHudConfig | undefined {
  if (!hud || typeof hud !== "object") return undefined;
  const out: ActionCombatHudConfig = {};
  if (hud.hearts !== undefined) out.hearts = hud.hearts === true;
  if (hud.stamina !== undefined) out.stamina = hud.stamina === true;
  if (hud.enemyHpBars === "always" || hud.enemyHpBars === "damaged" || hud.enemyHpBars === "never") {
    out.enemyHpBars = hud.enemyHpBars;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeActionCombatConfig(config: Partial<SystemActionCombat> | undefined): SystemActionCombat | undefined {
  if (!config || typeof config !== "object") return undefined;
  const hud = normalizeActionCombatHud(config.hud);
  const out: SystemActionCombat = { enabled: config.enabled === true };
  if (config.playerIframesMs !== undefined) out.playerIframesMs = clampInt(config.playerIframesMs, 0, 10000, DEFAULT_PLAYER_IFRAMES_MS);
  if (config.swingCooldownMs !== undefined) out.swingCooldownMs = clampInt(config.swingCooldownMs, 50, 5000, DEFAULT_SWING_COOLDOWN_MS);
  if (config.swingDamageBonus !== undefined) out.swingDamageBonus = clampInt(config.swingDamageBonus, 0, 9999, 0);
  // 에디터에서 켤 수 있는 토글이므로 정규화가 값을 삼키면 안 된다(기본 false 는 저장하지 않는다).
  if (config.fourWayMovement === true) out.fourWayMovement = true;
  if (config.dodgeStaminaCost !== undefined) out.dodgeStaminaCost = clampInt(config.dodgeStaminaCost, 0, 100, DEFAULT_DODGE_STAMINA_COST);
  if (config.dodgeIframesMs !== undefined) out.dodgeIframesMs = clampInt(config.dodgeIframesMs, 0, 3000, DEFAULT_DODGE_IFRAMES_MS);
  if (config.guardDamageReductionPercent !== undefined) {
    out.guardDamageReductionPercent = clampInt(config.guardDamageReductionPercent, 0, GUARD_MAX_DAMAGE_REDUCTION_PERCENT, DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT);
  }
  if (config.guardStaminaDrainPerSec !== undefined) {
    out.guardStaminaDrainPerSec = clampInt(config.guardStaminaDrainPerSec, 0, 100, DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC);
  }
  if (hud) out.hud = hud;
  return out;
}

export const DEFAULT_ATTACK_COOLDOWN_MS = 1200;
export const DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC = 6;

export function normalizeActionWeaponProfile(profile: Partial<ActionWeaponProfile> | undefined): ActionWeaponProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  const out: ActionWeaponProfile = {};
  if (profile.swingRange !== undefined) out.swingRange = clampInt(profile.swingRange, 1, 5, 1);
  if (profile.swingCooldownMs !== undefined) out.swingCooldownMs = clampInt(profile.swingCooldownMs, 50, 5000, DEFAULT_SWING_COOLDOWN_MS);
  if (profile.swingDamageBonus !== undefined) out.swingDamageBonus = clampInt(profile.swingDamageBonus, 0, 9999, 0);
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeActionSkillProfile(profile: Partial<ActionSkillProfile> | undefined): ActionSkillProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  if (profile.kind !== "projectile") return undefined;
  const out: ActionSkillProfile = {
    kind: "projectile",
    damage: clampInt(profile.damage, 1, 9999, 1),
    range: clampInt(profile.range, 1, 20, 8),
  };
  if (profile.speedTilesPerSec !== undefined) out.speedTilesPerSec = clampInt(profile.speedTilesPerSec, 1, 30, DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC);
  if (profile.itemCost && typeof profile.itemCost.itemId === "string" && profile.itemCost.itemId.length > 0) {
    out.itemCost = { itemId: profile.itemCost.itemId, amount: clampInt(profile.itemCost.amount, 1, 99, 1) };
  }
  return out;
}

export function normalizeEnemyActionAttack(attack: Partial<EnemyActionAttack> | undefined): EnemyActionAttack | undefined {
  if (!attack || typeof attack !== "object") return undefined;
  if (attack.kind !== "melee" && attack.kind !== "projectile" && attack.kind !== "dash") return undefined;
  const out: EnemyActionAttack = {
    kind: attack.kind,
    windupMs: clampInt(attack.windupMs, 100, 5000, 500),
    recoverMs: clampInt(attack.recoverMs, 0, 5000, 500),
    damage: clampInt(attack.damage, 1, 9999, 1),
    range: clampInt(attack.range, 1, 20, 1),
  };
  if (attack.cooldownMs !== undefined) out.cooldownMs = clampInt(attack.cooldownMs, 0, 30000, DEFAULT_ATTACK_COOLDOWN_MS);
  if (attack.projectileSpeedTilesPerSec !== undefined) {
    out.projectileSpeedTilesPerSec = clampInt(attack.projectileSpeedTilesPerSec, 1, 30, DEFAULT_PROJECTILE_SPEED_TILES_PER_SEC);
  }
  return out;
}

export function normalizeEnemyActionProfile(profile: Partial<EnemyActionProfile> | undefined): EnemyActionProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  const out: EnemyActionProfile = {};
  if (profile.contactDamage !== undefined) out.contactDamage = clampInt(profile.contactDamage, 0, 9999, 0);
  if (profile.moveIntervalMs !== undefined) out.moveIntervalMs = clampInt(profile.moveIntervalMs, 50, 10000, 500);
  if (profile.aggroRange !== undefined) out.aggroRange = clampInt(profile.aggroRange, 1, 30, 5);
  if (profile.knockbackResist !== undefined) out.knockbackResist = clamp01(profile.knockbackResist);
  const attack = normalizeEnemyActionAttack(profile.attack);
  if (attack) out.attack = attack;
  return Object.keys(out).length > 0 ? out : undefined;
}

// 액션 전투 활성 조건: 시스템 패키지 enabled + 맵 옵트인(actionCombat: true).
// 둘 다 명시되어야 한다 — 어느 하나만 켜진 프로젝트/맵은 레거시 턴제로 남는다.
export function isActionCombatMap(project: Project, map: GameMap | undefined | null): boolean {
  return project.system.actionCombat?.enabled === true && map?.actionCombat === true;
}

export function resolveActionCombatConfig(project: Project): ResolvedActionCombatConfig {
  const raw = project.system.actionCombat;
  return {
    playerIframesMs: clampInt(raw?.playerIframesMs, 0, 10000, DEFAULT_PLAYER_IFRAMES_MS),
    swingCooldownMs: clampInt(raw?.swingCooldownMs, 50, 5000, DEFAULT_SWING_COOLDOWN_MS),
    swingDamageBonus: clampInt(raw?.swingDamageBonus, 0, 9999, 0),
    swingRange: DEFAULT_SWING_RANGE,
    hearts: raw?.hud?.hearts !== false,
    // hud.stamina 는 표시 토글일 뿐이다. 소모/회피 규칙은 액션 맵에서 항상 돈다.
    stamina: raw?.hud?.stamina === true,
    staminaEnabled: true,
    dodgeStaminaCost: clampInt(raw?.dodgeStaminaCost, 0, 100, DEFAULT_DODGE_STAMINA_COST),
    dodgeIframesMs: clampInt(raw?.dodgeIframesMs, 0, 3000, DEFAULT_DODGE_IFRAMES_MS),
    guardDamageReductionPercent: clampInt(raw?.guardDamageReductionPercent, 0, GUARD_MAX_DAMAGE_REDUCTION_PERCENT, DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT),
    guardStaminaDrainPerSec: clampInt(raw?.guardStaminaDrainPerSec, 0, 100, DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC),
    enemyHpBars: raw?.hud?.enemyHpBars ?? "damaged",
    fourWayMovement: raw?.fourWayMovement === true,
  };
}
