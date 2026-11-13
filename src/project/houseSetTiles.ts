// 집 벌 칸 → 원본 킷 칸. 벌 집은 맵에 «벌 그림판 이식 칸» 으로 찍힌다(project/houseSetKit.ts) — 칸 번호를 킷의 칸 번호와 견주어
// 건물·문을 찾는 곳(입구 찾기 · 건물 표시 · 낮 빛 그림자 · 문 낱말 판독 · 채우기의 건물 판정 …)은 이 표로 벌 칸을 원본 칸으로 읽어야
// 벌 집을 원본 킷과 같은 집으로 알아본다. 벌을 쓰지 않는 타일셋에서는 빈 표다(값이 그대로 돌아온다).
// 숲 구성의 «다른 개체» 나무(project/standKit.ts — 숲 그림판 이식 칸)도 같은 표로 원본 나무 킷의 칸으로 읽는다.
// 그림 조각 표(assets/houseSets.ts · assets/tilesetStands.ts)와 타일셋만 본다 — 찍기 쪽(objectStamp)을 끌어오지 않아 플레이어도 쓸 수 있다.
import { houseSetTableFor } from "@/assets/houseSets";
import { tilesetStandTableFor } from "@/assets/tilesetStands";
import type { StructureKitDef, TilesetDef } from "./types";

const tileAt = (kit: StructureKitDef, x: number, y: number): number => {
  const row = kit.rows[y];
  const upper = row?.upperTiles?.[x] ?? -1;
  return upper >= 0 ? upper : row?.tiles?.[x] ?? -1;
};

const EMPTY: ReadonlyMap<number, number> = new Map();
/** 벌 그림판 칸 → [원본 킷 id, x, y] (표마다 한 번). */
const sheetCells = new WeakMap<object, Map<number, readonly [string, number, number]>>();
/** 이식 목록(배열)마다 — 도구가 이식을 덧붙이면 길이가 달라져 다시 만든다. */
const cache = new WeakMap<object, { readonly length: number; readonly kits: number; readonly map: ReadonlyMap<number, number> }>();

/**
 * 벌 그림 칸 → 원본 칸. 이 타일셋에 붙은 벌 이식 칸마다 «원본 킷의 같은 자리 칸 번호» 를 돌려준다(벌을 쓰지 않는 타일셋은 빈 표).
 * 그림판 칸은 그림(킷 묶음 · 변형)마다 따로 구워져 있어(굽기 bake.py) 칸 하나가 원본 킷의 한 자리만 가리킨다.
 */
export function houseSetBaseTiles(tileset: Pick<TilesetDef, "id" | "tileGrafts" | "structureKits"> | undefined): ReadonlyMap<number, number> {
  const grafts = tileset?.tileGrafts;
  if (!tileset || !grafts?.length) return EMPTY;
  const table = houseSetTableFor(tileset.id);
  const stands = tilesetStandTableFor(tileset.id);
  if (!table && !stands) return EMPTY;
  const kitCount = tileset.structureKits?.length ?? 0;
  const hit = cache.get(grafts);
  if (hit && hit.length === grafts.length && hit.kits === kitCount) return hit.map;
  let out: Map<number, number> | undefined;
  let kits: Map<string, StructureKitDef> | undefined;
  for (const graft of grafts) {
    const from = table && graft.sourceChipset === table.texture ? table : stands && graft.sourceChipset === stands.texture ? stands : undefined;
    if (!from) continue;
    let cells = sheetCells.get(from);
    if (!cells) {
      cells = new Map();
      const note = (kitId: string, rows: readonly (readonly number[])[]): void => rows.forEach((row, y) => row.forEach((cell, x) => { if (cell >= 0 && !cells!.has(cell)) cells!.set(cell, [kitId, x, y]); }));
      if (from === table) for (const set of Object.values(table.sets)) for (const [kitId, variants] of Object.entries(set.kits)) for (const rows of variants) note(kitId, rows);
      // 숲 그림판: 변형 칸은 (킷, 그림)마다 따로 구워져 있다(bake_stands.py) — 칸 하나가 원본 나무 킷의 한 자리만 가리킨다
      else for (const stand of Object.values(stands!.stands)) for (const [kitId, variants] of Object.entries(stand.variants ?? {})) for (const rows of variants) note(kitId, rows);
      sheetCells.set(from, cells);
    }
    kits ??= new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
    const at = cells.get(graft.sourceTile);
    const kit = at && kits.get(at[0]);
    const base = kit ? tileAt(kit, at![1], at![2]) : -1;
    if (base >= 0) (out ??= new Map()).set(graft.targetTile, base);
  }
  const map = out ?? EMPTY;
  cache.set(grafts, { length: grafts.length, kits: kitCount, map });
  return map;
}

const SAME = (tile: number): number => tile;

/** 칸 번호를 «킷이 아는 번호» 로 읽는 함수 — 벌 칸이면 원본 킷의 같은 자리 칸, 아니면 그대로. */
export function kitBaseTile(tileset: Pick<TilesetDef, "id" | "tileGrafts" | "structureKits"> | undefined): (tile: number) => number {
  const base = houseSetBaseTiles(tileset);
  return base.size ? (tile) => base.get(tile) ?? tile : SAME;
}
