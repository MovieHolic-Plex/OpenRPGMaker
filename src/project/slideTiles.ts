// project/slideTiles.ts
// 미끄러지는 바닥(tileset.slideTiles) 판정. 순수 함수(Phaser/DOM 무관).
// 포켓몬 회전 화살표·얼음 바닥 문법: 화살표 칸에 서면 그 방향으로, 얼음 칸에 서면 들어온 방향 그대로
// 다음 칸으로 저절로 미끄러지고, 정지 칸이나 막힌 칸 앞에서 멈춘다.

import type { GameMap, SlideRule, TilesetDef } from "./types";
import { inBounds } from "./collision";
import { topTileInStack } from "./mapOverlayTiles";

export interface SlideStep {
  readonly dx: number;
  readonly dy: number;
  /** arrow: 화살표가 밀어낸 미끄러짐 — 일반 바닥에서도 멈추지 않고 정지 칸·벽까지 간다. ice: 얼음 위에서만 이어진다. */
  readonly kind: "arrow" | "ice";
}

const DIR_DELTA: Record<"up" | "down" | "left" | "right", { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

/** 칸 (x,y) 의 미끄러짐 규칙. 위층부터 보고 처음 만난 규칙 타일이 정한다. 없으면 null. */
export function slideRuleAt(tileset: TilesetDef, map: GameMap, x: number, y: number): SlideRule | null {
  const rules = tileset.slideTiles;
  if (!rules || !inBounds(map, x, y)) return null;
  const i = y * map.width + x;
  const tiles = [
    map.upperOverlayTiles?.[i] ?? -1,
    topTileInStack(map, "upper", i) ?? map.upperTiles[i] ?? -1,
    map.lowerOverlayTiles?.[i] ?? -1,
    topTileInStack(map, "lower", i) ?? map.lowerTiles[i] ?? -1,
  ];
  for (const tile of tiles) {
    if (tile < 0) continue;
    const rule = rules[String(tile)];
    if (rule) return rule;
  }
  return null;
}

/**
 * 한 걸음(stepDx, stepDy)을 마치고 (x,y) 에 섰을 때 이어서 미끄러질 방향. null 이면 멈춘다.
 * 화살표는 방향을 정하고(그 뒤 일반 바닥에서도 계속 간다 — 원작 회전 바닥), 얼음은 들어온 방향을 잇되 얼음을 벗어나면 멈추고,
 * 정지 칸은 언제나 멈춘다. `sliding` 은 이 걸음이 이미 미끄러지던 중이었는지(직전 상태).
 */
export function slideAfterStep(
  tileset: TilesetDef, map: GameMap, x: number, y: number, stepDx: number, stepDy: number,
  sliding: SlideStep["kind"] | null = null,
): SlideStep | null {
  const rule = slideRuleAt(tileset, map, x, y);
  const moved = stepDx !== 0 || stepDy !== 0;
  if (rule === "stop") return null;
  if (rule === "ice") return moved ? { dx: Math.sign(stepDx), dy: Math.sign(stepDy), kind: "ice" } : null;
  if (rule) return { ...DIR_DELTA[rule], kind: "arrow" };
  return sliding === "arrow" && moved ? { dx: Math.sign(stepDx), dy: Math.sign(stepDy), kind: "arrow" } : null;
}
