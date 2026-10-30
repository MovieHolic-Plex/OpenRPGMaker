// project/restMenu.ts
// ESC 메뉴 「쉬기」 — 플레이어가 고른 시각(아침·정오·저녁·자정)까지 시간을 흘린다(2026-10-30, 사냥꾼 계약 공백 E).
// 설정은 system.timeSystem.restMenu 에 있고, 시간 시스템이 켜져 있어야 항목이 보인다.
// 이 파일은 순수 규칙(정규화·대기 분 계산·거절 사유)만 갖는다. 화면 전환·시간 진행은 player/restMenuRuntime.ts.
import { resolveTimeSystem, type GameTime, type ResolvedTimeSystemConfig } from "./gameTime";
import type { PlaySession } from "./session";
import type { GameMap, Project } from "./types";

export const REST_TARGETS = ["morning", "noon", "evening", "midnight"] as const;
export type RestTarget = (typeof REST_TARGETS)[number];

/** 목표 시각(시). 자정은 24시다 — 이 시계는 하루가 dayEndHour(기본 26)까지 이어지므로 같은 날 24:00 이다. */
export const REST_TARGET_HOURS: Readonly<Record<RestTarget, number>> = { morning: 6, noon: 12, evening: 18, midnight: 24 };
export const REST_TARGET_LABELS: Readonly<Record<RestTarget, string>> = { morning: "아침", noon: "정오", evening: "저녁", midnight: "자정" };

export const REST_ALLOW_ON_MAPS = ["all", "safe"] as const;
export type RestAllowOnMaps = (typeof REST_ALLOW_ON_MAPS)[number];

export interface RestMenuConfig {
  readonly enabled: boolean;
  /**
   * all(기본) = 어느 맵에서나 쉴 수 있다(추격 중만 거절).
   * safe = 적이 나오지 않는 맵(필드 스폰·랜덤 인카운터 없음)이나 맵의 안전지대(safeZones) 안에서만.
   */
  readonly allowOnMaps?: RestAllowOnMaps;
  /** 고를 수 있는 목표 시각. 생략하면 넷 다. */
  readonly targets?: readonly RestTarget[];
  /** 쉬고 나면 파티 HP 를 모두 채운다. 기본 false(물약을 쓰게). */
  readonly recoverHp?: boolean;
}

export interface ResolvedRestMenu {
  readonly allowOnMaps: RestAllowOnMaps;
  readonly targets: readonly RestTarget[];
  readonly recoverHp: boolean;
}

export function isRestTarget(value: unknown): value is RestTarget {
  return typeof value === "string" && (REST_TARGETS as readonly string[]).includes(value);
}

/** 저장·도구·편집기가 같이 쓰는 정규화. 모양이 틀린 값은 버리고, 목표 시각은 REST_TARGETS 순서로 중복 없이. */
export function normalizeRestMenu(value: unknown): RestMenuConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const targets = Array.isArray(raw.targets) ? REST_TARGETS.filter((target) => (raw.targets as unknown[]).includes(target)) : undefined;
  return {
    enabled: raw.enabled === true,
    ...(raw.allowOnMaps === "safe" ? { allowOnMaps: "safe" as const } : {}),
    ...(targets && targets.length > 0 && targets.length < REST_TARGETS.length ? { targets } : {}),
    ...(raw.recoverHp === true ? { recoverHp: true } : {}),
  };
}

/** 시간 시스템이 켜져 있고 쉬기도 켰을 때만 값이 있다. */
export function resolveRestMenu(project: Project): ResolvedRestMenu | undefined {
  if (!resolveTimeSystem(project)) return undefined;
  const config = project.system.timeSystem?.restMenu;
  if (!config?.enabled) return undefined;
  const targets = config.targets?.filter(isRestTarget) ?? [];
  return {
    allowOnMaps: config.allowOnMaps === "safe" ? "safe" : "all",
    targets: targets.length > 0 ? REST_TARGETS.filter((target) => targets.includes(target)) : REST_TARGETS,
    recoverHp: config.recoverHp === true,
  };
}

/**
 * 지금부터 다음 `target` 시각까지 흘릴 게임 분. 지금이 정확히 그 시각이면 다음 날 같은 시각이다.
 * 하루 범위(dayStartHour..dayEndHour) 밖의 시각이면 undefined — 예: 하루가 22시에 끝나면 자정은 오지 않는다.
 * 날 경계를 넘는 대기는 advanceGameTime 이 「종료 → 다음 날 시작」으로 접으므로 그 산술에 맞춰 센다.
 */
export function minutesUntilRestTarget(time: GameTime, target: RestTarget, system: ResolvedTimeSystemConfig): number | undefined {
  const start = system.dayStartHour * 60;
  const end = system.dayEndHour * 60;
  let at = REST_TARGET_HOURS[target] * 60;
  if (at < start) at += 24 * 60;
  if (at >= end) return undefined;
  const now = time.hour * 60 + time.minute;
  if (at > now) return at - now;
  return Math.max(0, end - now) + (at - start);
}

export type RestRefusal = "time-off" | "pursuit" | "unsafe-map";

export const REST_REFUSAL_TEXT: Readonly<Record<RestRefusal, string>> = {
  "time-off": "지금은 쉴 수 없습니다",
  pursuit: "쫓기는 중에는 쉴 수 없습니다",
  "unsafe-map": "이곳은 위험해서 쉴 수 없습니다",
};

/** 쉬기를 거절할 사유. 없으면 undefined. 메뉴 행의 흐림과 실제 실행이 같은 판정을 쓴다. */
export function restRefusal(project: Project, session: PlaySession, map: GameMap | undefined): RestRefusal | undefined {
  const rest = resolveRestMenu(project);
  if (!rest || !session.gameTime) return "time-off";
  if (Object.values(session.horror?.pursuits ?? {}).some((pursuit) => pursuit?.active === true)) return "pursuit";
  if (rest.allowOnMaps === "safe" && map && !mapIsSafeForRest(map, session)) return "unsafe-map";
  return undefined;
}

function mapIsSafeForRest(map: GameMap, point: { readonly x: number; readonly y: number }): boolean {
  const inSafeZone = (map.safeZones ?? []).some((zone) => point.x >= zone.x && point.y >= zone.y
    && point.x < zone.x + Math.max(0, zone.w) && point.y < zone.y + Math.max(0, zone.h));
  if (inSafeZone) return true;
  const randomEncounters = (map.encounterRate ?? 0) > 0 && ((map.encounterTable?.length ?? 0) > 0 || (map.troopIds?.length ?? 0) > 0);
  return (map.fieldSpawns?.length ?? 0) === 0 && !randomEncounters;
}
