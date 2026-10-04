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

// ── 도트 측면 적 진형(retro2003) ─────────────────────────────────────────────────────────
// 적 발 위치가 설 수 있는 구역(무대 논리 좌표 320×160). 아군은 오른쪽 x 222~294.
// 아래 한계 142 = 아군 마지막 발(136)보다 조금 아래, HUD 위.
const RETRO_ZONE = { left: 34, right: 150, top: 92, bottom: 142, cx: 92, cy: 117 } as const;
type Offsets = readonly (readonly [number, number])[];
/** 마리 수별 진형 후보(구역 중심 기준 오프셋). 첫 번째가 자동 정렬 기본값. 순서의 마지막이 아군 쪽(앞). */
export const RETRO_ENEMY_FORMATIONS: Readonly<Record<number, readonly { readonly name: string; readonly seats: Offsets }[]>> = {
  1: [{ name: "single", seats: [[-4, 4]] }],
  2: [
    { name: "diagonal", seats: [[-28, -18], [22, 16]] },
    { name: "column", seats: [[-8, -22], [8, 22]] },
  ],
  3: [
    { name: "triangle", seats: [[-36, -24], [-36, 24], [26, 0]] },
    { name: "wedge", seats: [[-30, 0], [22, -24], [22, 24]] },
    { name: "column", seats: [[-6, -26], [10, 0], [-6, 26]] },
    { name: "diagonal", seats: [[-44, -24], [0, 0], [44, 24]] },
  ],
  4: [
    { name: "diamond", seats: [[-44, 0], [0, -26], [0, 26], [44, 0]] },
    { name: "stagger", seats: [[-36, -22], [12, -22], [-12, 22], [36, 22]] },
    { name: "arrow", seats: [[-48, -26], [-48, 26], [-2, -12], [40, 14]] },
  ],
  5: [
    { name: "cross", seats: [[-46, -24], [-46, 24], [0, 0], [46, -24], [46, 24]] },
    { name: "wedge", seats: [[-48, -26], [-48, 26], [-4, -14], [-4, 14], [44, 0]] },
  ],
};

function retroSeat(offset: readonly [number, number]): { x: number; y: number } {
  return {
    x: Math.round(Math.max(RETRO_ZONE.left, Math.min(RETRO_ZONE.right, RETRO_ZONE.cx + offset[0]))),
    y: Math.round(Math.max(RETRO_ZONE.top, Math.min(RETRO_ZONE.bottom, RETRO_ZONE.cy + offset[1]))),
  };
}

/** 진형 한 벌. 6마리 이상은 세 줄 엇갈림. `variant` 는 후보 번호(넘치면 돌아간다). */
export function retroEnemyFormation(n: number, variant = 0): { x: number; y: number }[] {
  const options = RETRO_ENEMY_FORMATIONS[n];
  if (options) return options[variant % options.length]!.seats.map(retroSeat);
  const rows = 3;
  const columns = Math.ceil(n / rows);
  return Array.from({ length: n }, (_, i) => {
    const column = Math.floor(i / rows);
    const row = i % rows;
    return retroSeat([Math.round(-48 + column * 96 / Math.max(1, columns - 1)) + (row % 2) * 14, -26 + row * 26]);
  });
}

/**
 * 수동 트룹을 도트 측면 구역에 앉힌다. 저작 좌표에 **모양**(삼각형·사선·세로)이 있으면 그 모양을 구역에 맞춰
 * 줄이고, 한 줄이거나 뭉쳐 있으면 진형 후보 중 하나를 쓴다(좌표에서 뽑은 번호라 같은 트룹은 늘 같은 진형).
 * 예전에는 y 를 118~140 으로 눌러 모든 트룹이 가로 한 줄이었다.
 */
export function retroManualFormation(canonicals: readonly CanonicalEnemyPosition[]): { x: number; y: number }[] {
  const n = canonicals.length;
  const valid = canonicals.every((c) => Number.isFinite(c?.x) && Number.isFinite(c?.y));
  const hash = canonicals.reduce((sum, c, i) => sum + Math.round(c?.x ?? 0) * (i + 3) + Math.round(c?.y ?? 0) * (i + 7), n);
  const fallback = () => retroEnemyFormation(n, Math.abs(hash));
  if (!valid || n <= 1) return n <= 1 ? retroEnemyFormation(n) : fallback();
  const xs = canonicals.map((c) => c.x!);
  const ys = canonicals.map((c) => c.y!);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  if (spanY < 20) return fallback();
  const width = Math.min(RETRO_ZONE.right - RETRO_ZONE.left - 8, Math.max(40, spanX * 0.62));
  const height = Math.min(RETRO_ZONE.bottom - RETRO_ZONE.top - 4, Math.max(36, spanY * 0.9));
  const seats = canonicals.map((c) => retroSeat([
    spanX === 0 ? 0 : ((c.x! - Math.min(...xs)) / spanX - 0.5) * width,
    ((c.y! - Math.min(...ys)) / spanY - 0.5) * height,
  ]));
  const crowded = seats.some((seat, i) => seats.slice(0, i).some((prior) => Math.abs(prior.x - seat.x) < 30 && Math.abs(prior.y - seat.y) < 18));
  return crowded ? fallback() : seats;
}

/** 도트 측면: 적은 왼쪽 구역에 진형으로, 아군은 오른쪽 사선(뒤=위·왼쪽 → 앞=아래·오른쪽). 아군 도트는 왼쪽을 본다. */
const RETRO_SIDEVIEW: SkinBattlerPlacement = {
  partyFacing: "front",
  enemy: (i, n) => retroEnemyFormation(n)[i] ?? retroSeat([0, 0]),
  // 96px(정수 2배) 도트 넷이 크게 겹치지 않게 가로 24·세로 18 간격. 마지막 발 y 136 은 HUD 위다.
  party: (i) => ({ x: 222 + i * 24, y: 82 + i * 18 }),
};

export const BATTLER_PLACEMENTS: Record<BattleSkinId, SkinBattlerPlacement> = {
  pokemon: { partyFacing: "back", partyMax: 1, partyScale: 1.25, enemy: (i, n) => (n <= 1 ? { x: 239, y: 92 } : { x: 250 - i * 58, y: 100 - (i % 2) * 14 }), party: () => ({ x: 76, y: 152 }) },
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
  if (BATTLE_SKINS[skinId]?.motionStyle === "retro") {
    const cy = canonical?.y;
    return { x: Math.max(RETRO_ZONE.left, Math.min(RETRO_ZONE.right, cx)),
      y: cy != null && Number.isFinite(cy) ? Math.max(RETRO_ZONE.top, Math.min(RETRO_ZONE.bottom, cy * 2 / 3)) : fallback.y };
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
  // 도트 측면: 저작 모양을 살리거나 진형 후보를 고른다(retroManualFormation).
  if (BATTLE_SKINS[skinId]?.motionStyle === "retro") return retroManualFormation(canonicals);
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
