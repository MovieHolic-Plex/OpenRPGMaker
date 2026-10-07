// src/harnesses/map-objects/editor/items.ts
/**
 * 맵 기물 = 사용자가 공방에서 정의한 새 기물뿐이다(다시 찍을 번들 사양이 없다).
 * 정의에 구워 넣을 칩셋 id 와, 그때 칩셋 그림에서 뽑은 팔레트가 들어 있다.
 */
import { makePalette } from "@/harnesses/_core/workshop/grid";
import type { ItemDefinition, Palette, Rgba, WorkshopItem } from "@/harnesses/_core/workshop/types";

export const TILE = 16;
/** 가로·발밑 칸 상한(나무·작은 건물 정도까지) */
export const MAX_TILES_W = 4;
export const MAX_TILES_H = 3;
/** 발밑 위로 솟는 px 상한(키 큰 나무 3칸) */
export const MAX_RISE = 48;

/** 칩셋에 구울 때 통행·층을 정하는 종류 — 손 도트 실내와 같은 넷(project/workshopTiles.ts HAND_KINDS) */
export const MAP_KIND_LABELS: Readonly<Record<string, string>> = {
  floor: "서 있는 물건(발밑 막힘)",
  wall: "벽 앞 물건(발밑 막힘)",
  hang: "벽에 거는 것",
  flat: "바닥 무늬(밟고 지나감)",
};

export function mapItemFromDefinition(def: ItemDefinition): WorkshopItem {
  const drawn = def.tilesH * TILE + def.rise;
  const height = Math.ceil(drawn / TILE) * TILE;
  return {
    key: def.key, title: def.title, description: def.description, kind: def.kind, category: def.category,
    width: def.tilesW * TILE, height, padTop: height - drawn, footRows: def.tilesH, risePx: def.rise,
    isNew: true, refs: def.refs, use: def.use, ...(def.tilesetId ? { tilesetId: def.tilesetId } : {}),
  };
}

const rgbaOf = (hex: string): Rgba => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
const GRAYS = ["#101010", "#383838", "#606060", "#888888", "#b0b0b0", "#d8d8d8", "#f8f8f8"];

/** 정의에 적힌 팔레트(#rrggbb)를 c:0… 키로. 없으면(옛 정의) 회색 단만 — 그래도 그릴 수는 있다. */
export function paletteFromHexes(hexes: readonly string[] | undefined): Palette {
  const list = (hexes?.length ? hexes : GRAYS).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex));
  const seen = new Set<string>();
  return makePalette(list.flatMap((hex) => {
    const lower = hex.toLowerCase();
    if (seen.has(lower)) return [];
    seen.add(lower);
    return [{ key: `c:${seen.size - 1}`, rgba: rgbaOf(lower) }];
  }));
}
