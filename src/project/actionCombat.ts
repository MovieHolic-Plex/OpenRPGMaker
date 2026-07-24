// project/actionCombat.ts
// 실시간 액션 전투 옵트인 패키지의 스키마 정규화 + 런타임 설정 해석.
// timeSystem/monsterCollection과 같은 패턴: 생략 시 레거시(턴제 라우팅) 유지.

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

export interface ResolvedActionCombatConfig {
  readonly playerIframesMs: number;
  readonly swingCooldownMs: number;
  readonly swingDamageBonus: number;
  readonly swingRange: number;
  readonly hearts: boolean;
  readonly stamina: boolean;
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
    stamina: raw?.hud?.stamina === true,
    enemyHpBars: raw?.hud?.enemyHpBars ?? "damaged",
    fourWayMovement: raw?.fourWayMovement === true,
  };
}
