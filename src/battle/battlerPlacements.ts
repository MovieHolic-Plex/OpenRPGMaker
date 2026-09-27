import { BATTLE_SKINS } from "@/battle/skins/registry";
import type { BattleSkinId } from "@/battle/skins/types";

export function classicEnemyFormation(index: number): { x: number; y: number } {
  return { x: 84 + (index % 2) * 44, y: 52 + index * 36 };
}

export type BattlerPartyFacing = "front" | "back" | "hidden";

export interface SkinBattlerPlacement {
  readonly enemy: (i: number, n: number) => { x: number; y: number };
  readonly party: (i: number, n: number) => { x: number; y: number };
  readonly partyFacing: BattlerPartyFacing;
  readonly partyMax?: number;
  readonly partyScale?: number;
}

export const RM2000_PARTY_SLOTS: Readonly<Record<number, readonly number[]>> = {
  1: [72],
  2: [72, 248],
  3: [56, 160, 264],
  4: [44, 116, 204, 276],
};

/** 정면 구도(유리 뼈대): 적만 필드에 선다. */
const FRONTVIEW: SkinBattlerPlacement = {
  partyFacing: "hidden",
  enemy: (i, n) => ({
    x: Math.round(160 + (i - (n - 1) / 2) * 70),
    y: n <= 1 ? 124 : 104 + (i % 2) * 8,
  }),
  party: (i, n) => ({ x: RM2000_PARTY_SLOTS[Math.min(4, Math.max(1, n))]![i] ?? 160, y: 160 }),
};

/** 측면 구도(유리 뼈대): 적은 왼쪽 두 줄, 아군 전투 시트는 오른쪽 사선 열. */
const SIDEVIEW: SkinBattlerPlacement = {
  partyFacing: "front",
  enemy: (i, n) => ({
    x: Math.round(108 + (i - (n - 1) / 2) * 48),
    y: n <= 1 ? 124 : 112 + (i % 2) * 12,
  }),
  // 아군 4명 가로 간격 32 RM px(스프라이트 1.25배). 22 면 다음 배우가 앞 배우를 38% 덮어 2·3번은
  // 실루엣만 남았다(2026-09-14 실측). 시작 x 196 → 마지막 292 + 반폭 24 = 316 으로 무대(320) 안에 든다.
  party: (i) => ({ x: 196 + i * 32, y: 84 + i * 25 }),
};

/** 도트 측면: 발끝은 접지 띠 안에, 네 아군은 오른쪽 사선으로 내려선다. */
const RETRO_SIDEVIEW: SkinBattlerPlacement = {
  partyFacing: "front",
  enemy: (i, n) => {
    const columns = Math.ceil(n / 2);
    // 세 마리까지 한 줄, 그 이상은 최대 두 줄로 나눈다.
    const seats = n <= 3 ? n : columns;
    const column = n <= 3 ? i : i % columns;
    return { x: seats <= 1 ? 96 : Math.round(42 + column * 108 / (seats - 1)),
      y: n <= 3 ? 128 + (i % 2) * 12 : 118 + Math.floor(i / columns) * 22 };
  },
  party: (i) => ({ x: 230 + i * 20, y: 88 + i * 16 }),
};

export const BATTLER_PLACEMENTS: Record<BattleSkinId, SkinBattlerPlacement> = {
  pokemon: { partyFacing: "back", partyMax: 1, partyScale: 1.25, enemy: (i, n) => (n <= 1 ? { x: 239, y: 92 } : { x: 250 - i * 58, y: 100 - (i % 2) * 14 }), party: () => ({ x: 76, y: 152 }) },
  rm2000: FRONTVIEW,
  rm2003: SIDEVIEW,
  // 유리 뼈대 변형(2026-09-25): 구도가 같으면 배치도 같다 — 정면은 rm2000, 측면은 rm2003 을 그대로 쓴다.
  // 예전 스킨별 배치표는 각자 CSS 와 짝이었고, CSS 를 지우면서 함께 걷었다.
  octopath: SIDEVIEW,
  chrono: SIDEVIEW,
  bravely: SIDEVIEW,
  dragonquest: FRONTVIEW,
  ff: SIDEVIEW,
  mother: FRONTVIEW,
  goldensun: SIDEVIEW,
  mv: FRONTVIEW,
  vxace: FRONTVIEW,
  // 도트 측면 전투의 독립 접지·간격 계약.
  retro2003: RETRO_SIDEVIEW,
};

export const CANONICAL_SIDEVIEW_ANCHOR_X = 84;

export const MANUAL_FRONTAL_DAMPING = 0.5;

export interface CanonicalEnemyPosition {
  readonly x?: number;
  readonly y?: number;
}

export function resolveSkinEnemyPosition(
  skinId: BattleSkinId,
  canonical: CanonicalEnemyPosition | undefined,
  index: number,
  count: number,
  autoAlign: boolean,
): { x: number; y: number } {
  const placement = BATTLER_PLACEMENTS[skinId];
  const fallback = placement.enemy(index, count);
  if (autoAlign) return fallback;
  const cx = canonical?.x;
  if (cx == null || !Number.isFinite(cx)) return fallback;
  // 옛 트룹의 0..240 y를 그대로 쓰면 새 접지 띠 위에 뜬다. 이 스킨만 안전 구간에 맞춘다.
  if (skinId === "retro2003") {
    const cy = canonical?.y;
    return { x: Math.max(40, Math.min(150, cx)),
      y: cy != null && Number.isFinite(cy) ? Math.max(118, Math.min(140, cy * 2 / 3)) : fallback.y };
  }
  const layout = BATTLE_SKINS[skinId]?.layout;
  if (layout === "sideview" || layout === "active") {
    // 측면/액티브: 우측 아군과 겹치지 않게 x>150 저작값은 고전 좌측 진형으로 당긴다(SC12).
    // battleX 후처리와 같은 규칙이라 DOM·미리보기가 같은 값을 본다.
    const recentered = cx > 150 ? classicEnemyFormation(index).x : cx;
    const cy = canonical?.y;
    return {
      x: Math.max(0, Math.min(320, recentered)),
      y:
        cy != null && Number.isFinite(cy)
          ? Math.max(0, Math.min(160, (cy * 2) / 3))
          : fallback.y,
    };
  }
  return {
    x: Math.max(0, Math.min(320, Math.round(fallback.x + (cx - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING))),
    y: fallback.y,
  };
}

export function resolveManualFrontalRow(
  skinId: BattleSkinId,
  canonicalXs: readonly number[],
): number[] {
  const n = canonicalXs.length;
  const fallbackXs = canonicalXs.map((_, i) => BATTLER_PLACEMENTS[skinId].enemy(i, n).x);
  const valid = canonicalXs.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return fallbackXs;
  const mean = valid.reduce((sum, x) => sum + x, 0) / valid.length;
  const shift = (mean - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING;
  return fallbackXs.map((x) => Math.max(0, Math.min(320, Math.round(x + shift))));
}

export function resolveSkinEnemyPositions(
  skinId: BattleSkinId,
  canonicals: readonly CanonicalEnemyPosition[],
  autoAlign: boolean,
): { x: number; y: number }[] {
  const n = canonicals.length;
  if (autoAlign) {
    return canonicals.map((c, i) => resolveSkinEnemyPosition(skinId, c, i, n, true));
  }
  const layout = BATTLE_SKINS[skinId]?.layout;
  if (layout === "frontview" || layout === "firstperson") {
    const row = resolveManualFrontalRow(
      skinId,
      canonicals.map((c) => c?.x ?? Number.NaN),
    );
    return canonicals.map((_, i) => ({
      x: row[i] ?? BATTLER_PLACEMENTS[skinId].enemy(i, n).x,
      y: BATTLER_PLACEMENTS[skinId].enemy(i, n).y,
    }));
  }
  const resolved = canonicals.map((c, i) => resolveSkinEnemyPosition(skinId, c, i, n, false));
  if (layout !== "sideview" && layout !== "active") return resolved;
  if (skinId === "retro2003") {
    // 접지 구간으로 옮긴 수동 좌표가 뭉치면 트룹 전체를 같은 자동 진형으로 정렬한다.
    const crowded = resolved.some((seat, i) => resolved.slice(0, i).some((prior) =>
      Math.abs(prior.x - seat.x) < 44 && Math.abs(prior.y - seat.y) < 20));
    return crowded ? canonicals.map((_, i) => RETRO_SIDEVIEW.enemy(i, n)) : resolved;
  }

  // 측면 수동 배치: 저작 x>150 을 고전 진형 x 로 접는 규칙이 index 별 충돌을 보지 않아 두 적이
  // **같은 좌표**에 서서 한 마리만 보였다(2026-09-14 실측, troop_slime_pair 128/192 → 둘 다 128).
  // 앞선 적과 x·y 가 모두 가까우면 고전 진형의 y(52+36i)로 내려 세운다.
  const placed: { x: number; y: number }[] = [];
  const clamp = (candidate: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.max(0, Math.min(320, Math.round(candidate.x))),
    y: Math.max(0, Math.min(160, Math.round(candidate.y))),
  });
  return resolved.map((position, index) => {
    const collides = (candidate: { x: number; y: number }): boolean =>
      placed.some((prior) => Math.abs(prior.x - candidate.x) < 24 && Math.abs(prior.y - candidate.y) < 24);
    // 후보 순서: 저작값 → 이 스킨의 자동 진형 자리 → 오른쪽 48 → 아래 40. 첫 비충돌 후보를 쓴다.
    const candidates = [
      position,
      BATTLER_PLACEMENTS[skinId].enemy(index, n),
      clamp({ x: position.x + 48, y: position.y }),
      clamp({ x: position.x, y: position.y + 40 }),
      clamp({ x: position.x - 48, y: position.y + 40 }),
    ];
    const next = candidates.find((candidate) => !collides(candidate)) ?? candidates[candidates.length - 1];
    placed.push(next);
    return next;
  });
}
