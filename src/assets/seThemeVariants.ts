// assets/seThemeVariants.ts
// 고정 SE 상수(상자·동전·징글·문)의 변형 풀. 같은 시드는 같은 id, 다른 시드는 다른 후보.
//
// 규칙:
//   1) 순수 함수. Math.random 없음(mulberry32). 예외를 던지지 않는다.
//   2) 풀이 비거나 exclude 로 비어도 빈 문자열이거나 원본 풀의 한 id 를 돌려 준다.
//   3) seed 가 없는 호출자는 각 모듈의 기본 상수를 그대로 쓴다(이 피커를 타지 않음).

import { mulberry32 } from "@/util/rng";

export type SeVariantContext = {
  readonly seed?: number;
  readonly exclude?: readonly string[];
};

/** 나무 상자·서랍 열기. 기본값 cc0-se-osx-wooded-box-open. */
export const CHEST_OPEN_SE_POOL = [
  "cc0-se-osx-wooded-box-open",
  "cc0-se-ors-item-wood-01",
  "cc0-se-osx-wooden-01",
  "cc0-se-orp-inventory-wood-small",
] as const;

/** 금화 입수. 기본값 cc0-se-orp-inventory-coin. */
export const LOOT_GOLD_SE_POOL = [
  "cc0-se-orp-inventory-coin",
  "cc0-se-ors-item-coins-01",
  "cc0-se-ors-item-coins-02",
  "cc0-se-orp-inventory-coin2",
] as const;

/** 아이템 입수 — 종소리. 기본값 bell-01. (Kenney 8-bit 징글은 2026-10-07 저작권 정리로 지웠다.) */
export const LOOT_ITEM_SE_POOL = [
  "cc0-se-osx-bell-01",
  "cc0-se-osx-bell-02",
  "cc0-se-osx-bell-03",
] as const;

/**
 * 문 열기. 기본값 cc0-se-osx-door-open. (Kenney 문 소리는 2026-10-07 저작권 정리로 지웠다.)
 * 닫기 풀과 같은 길이·같은 인덱스 = 같은 팩 짝(OSX open/close-01).
 * 열기+닫기 한 클립(osx-door-01/02, orp-world-door)은 제외 —
 * 카탈로그에 「문 여닫기」로 등록된 2.6초대 클립이라 입장 시 어색하다.
 */
export const DOOR_OPEN_SE_POOL = [
  "cc0-se-osx-door-open",
] as const;

/** 문 닫기 — 열기 풀과 같은 길이라 같은 시드면 같은 인덱스로 짝이 맞는다. */
export const DOOR_CLOSE_SE_POOL = [
  "cc0-se-osx-door-close-01",
] as const;

export const SE_VARIANT_POOLS = {
  chestOpen: CHEST_OPEN_SE_POOL,
  lootGold: LOOT_GOLD_SE_POOL,
  lootItem: LOOT_ITEM_SE_POOL,
  doorOpen: DOOR_OPEN_SE_POOL,
  doorClose: DOOR_CLOSE_SE_POOL,
} as const;

/**
 * 풀에서 시드로 하나 고른다. 같은 (pool, seed, exclude) 는 항상 같은 id.
 * 예외를 던지지 않는다 — 빈 풀은 "".
 */
export function pickSeVariant(
  pool: readonly string[],
  seed: number,
  exclude?: readonly string[],
): string {
  if (pool.length === 0) return "";
  const excluded = new Set(exclude ?? []);
  const available = pool.filter((id) => !excluded.has(id));
  const candidates = available.length > 0 ? available : pool;
  const rng = mulberry32(typeof seed === "number" && Number.isFinite(seed) ? seed : 1);
  const index = Math.floor(rng() * candidates.length);
  return candidates[index] ?? candidates[0] ?? "";
}

/** seed 가 없으면 fallback(기존 상수). 있으면 풀에서 고르고, 비면 fallback. */
export function resolveSeVariant(
  pool: readonly string[],
  fallback: string,
  context?: SeVariantContext,
): string {
  if (typeof context?.seed !== "number") return fallback;
  return pickSeVariant(pool, context.seed, context.exclude) || fallback;
}
