// project/counterTiles.ts
// 카운터 속성(RPG Maker 「카운터」 플래그). 주인공 정면 칸이 카운터·탁자면 조사 버튼이 그 너머 칸의 이벤트에 닿는다 —
// 상점 주인을 카운터 뒤에 세우고, 식탁 건너편에 앉은 사람에게 말을 걸 수 있게 한다(2026-10-22 사용자 요청).
//
// 데이터 계약: `TilesetDef.counterTiles` = 카운터 속성을 가진 타일 번호 목록. 통행과는 별개다(카운터 칸은 보통 막힘).
//   - undefined = 저자가 정한 적 없음. 이름표(카운터·탁자·책상·식탁·counter·table·desk) + 막힘 통행에서 고른 기본값을 쓴다
//     (`deriveCounterTiles`). 번들 칩셋(손 도트 실내 v5·버들항·jp_city …)과 옛 저장본·내보낸 게임이 모두 손대지 않고 동작한다.
//   - 배열 = 저자(편집기 「카운터」 칸·조수 set_tile_rules counter)가 정한 목록. [] 이면 카운터 없음.
// 판정은 칸의 1~4층 중 하나라도 목록에 있으면 카운터다.

import type { GameMap, TilesetDef } from "./types";
import { cellLayerTiles } from "./mapLayers";

/** 조사 버튼이 연속한 카운터 칸을 몇 칸까지 넘는가. 2×2 탁자·두 줄 카운터까지 넘고, 그 너머 한 칸을 본다. */
export const MAX_COUNTER_REACH = 2;

type CounterSource = Pick<TilesetDef, "counterTiles" | "passability" | "tileMeta" | "count">;

const explicitSets = new WeakMap<readonly number[], ReadonlySet<number>>();
/** 기본값은 타일셋 객체마다 한 번 고른다. 통행·이름표 배열이 바뀌면(편집기 수정은 새 배열) 다시 고른다. */
const derivedSets = new WeakMap<object, { passability: unknown; tileMeta: unknown; set: ReadonlySet<number> }>();

function counterSet(tileset: CounterSource): ReadonlySet<number> | null {
  const list = tileset.counterTiles;
  if (list) {
    if (list.length === 0) return null;
    let set = explicitSets.get(list);
    if (!set) {
      set = new Set(list);
      explicitSets.set(list, set);
    }
    return set;
  }
  if (!tileset.tileMeta || tileset.tileMeta.length === 0) return null;
  const cached = derivedSets.get(tileset);
  if (cached && cached.passability === tileset.passability && cached.tileMeta === tileset.tileMeta) return cached.set.size ? cached.set : null;
  const set = new Set(deriveCounterTiles(tileset));
  derivedSets.set(tileset, { passability: tileset.passability, tileMeta: tileset.tileMeta, set });
  return set.size ? set : null;
}

/** 지금 효력이 있는 카운터 타일 목록(저자 목록, 없으면 기본값). 편집기 표시·조수 응답용. */
export function effectiveCounterTiles(tileset: CounterSource): number[] {
  return [...(counterSet(tileset) ?? [])].sort((a, b) => a - b);
}

export function isCounterTile(tileset: CounterSource, tile: number): boolean {
  return tile >= 0 && (counterSet(tileset)?.has(tile) ?? false);
}

/** 칸 (x,y) 가 카운터인가. 맵 밖·속성 없는 타일셋이면 false. */
export function isCounterCell(tileset: CounterSource | null | undefined, map: GameMap, x: number, y: number): boolean {
  if (!tileset) return false;
  const set = counterSet(tileset);
  if (!set) return false;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  for (const tile of cellLayerTiles(map, i)) if (tile >= 0 && set.has(tile)) return true;
  return false;
}

/**
 * 정면 칸부터 연속한 카운터 칸을 넘으며 조사 대상 칸을 고른다. 각 칸에서 `hasTarget` 가 참이면 그 칸이 대상이다.
 * 카운터가 아닌 칸을 만나면 그 칸까지만 보고 멈춘다. 대상이 없으면 null.
 * 첫 칸(정면)은 호출자가 이미 봤으므로 넘긴다 — 여기서는 정면이 카운터일 때 그 너머만 본다.
 */
export function counterReachTarget(
  tileset: CounterSource | null | undefined,
  map: GameMap,
  front: { readonly x: number; readonly y: number },
  delta: { readonly x: number; readonly y: number },
  hasTarget: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  if (!tileset || !counterSet(tileset)) return null;
  let x = front.x;
  let y = front.y;
  for (let crossed = 0; crossed < MAX_COUNTER_REACH; crossed += 1) {
    if (!isCounterCell(tileset, map, x, y)) return null;
    x += delta.x;
    y += delta.y;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    if (hasTarget(x, y)) return { x, y };
  }
  return null;
}

const COUNTER_LABEL = /카운터|계산대|탁자|책상|식탁|접수대|바 테이블|(?<![a-z])(?:counter|table|desk|register)s?(?![a-z])/iu;
/** 탁자 위에 얹는 물건·의자처럼 이름에 「탁자」가 들어가도 카운터가 아닌 것. */
const NOT_COUNTER_LABEL = /의자|걸상|stool|chair|탁상 물건|탁자 위|on table/iu;

/**
 * 이름표와 통행에서 카운터 칸을 고른다: 막힘(네 방향 모두 닫힘) + 가구·이름에 카운터/탁자/책상 낱말.
 * 카운터 윗면처럼 지나갈 수 있는 칸(★·통과)은 넣지 않는다 — 그 칸에는 주인이 선다.
 */
export function deriveCounterTiles(tileset: Pick<TilesetDef, "passability" | "tileMeta" | "count">): number[] {
  const out: number[] = [];
  const meta = tileset.tileMeta ?? [];
  const count = Math.min(tileset.count, tileset.passability.length);
  for (let tile = 0; tile < count; tile += 1) {
    const pass = tileset.passability[tile];
    if (!pass || pass.up || pass.down || pass.left || pass.right) continue;
    const m = meta[tile];
    if (!m) continue;
    const text = `${m.label ?? ""} ${(m.tags ?? []).join(" ")}`;
    if (!COUNTER_LABEL.test(text) || NOT_COUNTER_LABEL.test(text)) continue;
    if (m.role && !/furniture|object|prop|가구|기물/iu.test(m.role)) continue;
    out.push(tile);
  }
  return out;
}

/**
 * 편집기·조수 공용: 한 타일의 카운터 속성을 켜고 끈다. 처음 고치면 기본값을 목록으로 굳힌 뒤 그 한 칸만 바꾼다
 * (나머지 기본 카운터가 사라지지 않게). 바뀌었으면 true.
 */
export function setCounterTile(tileset: TilesetDef, tile: number, on: boolean): boolean {
  const list = tileset.counterTiles ?? effectiveCounterTiles(tileset);
  const has = list.includes(tile);
  if (has === on) return false;
  tileset.counterTiles = on ? [...list, tile].sort((a, b) => a - b) : list.filter((t) => t !== tile);
  return true;
}
