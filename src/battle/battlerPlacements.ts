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

export const BATTLER_PLACEMENTS: Record<BattleSkinId, SkinBattlerPlacement> = {
  pokemon: { partyFacing: "back", partyMax: 1, partyScale: 1.25, enemy: (i, n) => (n <= 1 ? { x: 239, y: 92 } : { x: 250 - i * 58, y: 100 - (i % 2) * 14 }), party: () => ({ x: 76, y: 152 }) },
  rm2000: {
    partyFacing: "hidden",
    enemy: (i, n) => ({
      x: Math.round(160 + (i - (n - 1) / 2) * 70),
      y: n <= 1 ? 124 : 104 + (i % 2) * 8,
    }),
    party: (i, n) => ({ x: RM2000_PARTY_SLOTS[Math.min(4, Math.max(1, n))]![i] ?? 160, y: 160 }),
  },
  rm2003: {
    partyFacing: "front",
    enemy: (i, n) => ({
      x: Math.round(108 + (i - (n - 1) / 2) * 48),
      y: n <= 1 ? 124 : 112 + (i % 2) * 12,
    }),
    // 아군 4명 가로 간격 32 RM px(스프라이트 1.25배). 22 면 다음 배우가 앞 배우를 38% 덮어 2·3번은
    // 실루엣만 남았다(2026-09-14 실측). 시작 x 196 → 마지막 292 + 반폭 24 = 316 으로 무대(320) 안에 든다.
    party: (i) => ({ x: 196 + i * 32, y: 84 + i * 25 }),
  },
  octopath: { partyFacing: "back", partyScale: 1.15, enemy: (i) => ({ x: 72 + (i % 2) * 54, y: 47 + Math.floor(i / 2) * 27 }), party: (i) => ({ x: 236 + (i % 2) * 42, y: 88 + Math.floor(i / 2) * 52 }) },
  chrono: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 250 - i * 50, y: 48 }), party: (i) => ({ x: 62 + (i % 2) * 42, y: 104 + Math.floor(i / 2) * 30 }) },
  bravely: { partyFacing: "back", partyScale: 1.35, enemy: (i) => ({ x: 64 + (i % 2) * 60, y: 47 + Math.floor(i / 2) * 27 }), party: (i) => ({ x: 218 + (i % 2) * 50, y: 84 + Math.floor(i / 2) * 56 }) },
  dragonquest: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 60, y: 68 }), party: () => ({ x: 160, y: 150 }) },
  ff: { partyFacing: "front", partyScale: 1.2, enemy: (i, n) => ({ x: 120 + (i - (n - 1) / 2) * 52, y: 46 }), party: (i) => ({ x: 242, y: 62 + i * 36 }) },
  mother: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 50, y: 48 }), party: () => ({ x: 160, y: 150 }) },
  goldensun: { partyFacing: "back", partyScale: 1.4, enemy: (i, n) => ({ x: 116 + (i - (n - 1) / 2) * 50, y: 46 }), party: (i) => ({ x: 232 + (i % 2) * 40, y: 92 + Math.floor(i / 2) * 48 }) },
  mv: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 52, y: 60 }), party: () => ({ x: 160, y: 150 }) },
  vxace: { partyFacing: "hidden", enemy: (i, n) => ({ x: 112 + (i - (n - 1) / 2) * 52, y: 96 }), party: () => ({ x: 112, y: 150 }) },
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
