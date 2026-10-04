// panels/tilePaletteFilter.ts
// 타일 검색·분류 필터의 단일 출처.
//
// 왜 뽑아냈나:
//   이 로직은 tilePalette.ts 안의 비공개 함수였고 activeTileCategory·tileSearchQuery·
//   recentTiles 라는 **모듈 전역**을 직접 읽었다. 구조물 편집기가 같은 검색·분류를 쓰려면
//   그 전역을 공유하게 되어 맵 팔레트의 필터가 편집기와 함께 움직인다.
//   그래서 상태는 호출부가 들고, 이 파일은 순수 계산만 한다.
//
//   분류 규칙을 편집기 쪽에 복사하지 않은 이유는 같은 규칙이 두 곳에서 갈라지기 때문이다 —
//   이 저장소에는 이미 타일 칠하기 구현이 셋(Phaser 맵 / 구조물 / 타일셋 AI 예시)이라
//   같은 판단을 또 복제하면 나중에 어느 쪽이 정본인지 알 수 없게 된다.

import { isDefaultTilesetTexture } from "@/editor/tilesetImage";
import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { TilesetDef } from "@/project/types";

export type TileCategoryId = "all" | "recent" | "terrain" | "water" | "house" | "fence" | "decor";

export type TileCategory = {
  readonly id: TileCategoryId;
  readonly label: string;
};

export const TILE_CATEGORIES: readonly TileCategory[] = [
  // 기본은 "전체" — 단일 면에서 "최근"을 기본으로 두면 첫 페인트에 팔레트가 거의 비어 보인다.
  { id: "all", label: "전체" },
  { id: "recent", label: "최근" },
  { id: "terrain", label: "지형" },
  { id: "water", label: "물" },
  { id: "house", label: "집" },
  { id: "fence", label: "울타리" },
  { id: "decor", label: "장식" },
] as const;

export function tileMatchesCategory(
  category: TileCategoryId,
  tags: readonly string[],
  usage: string,
  layer: "lower" | "upper",
): boolean {
  if (category === "all") return true;
  if (category === "recent") return true;
  if (category === "terrain") return layer === "lower" && ["terrain", "path", "edge", "detail"].includes(usage);
  if (category === "water") return tags.some((tag) => ["water", "lake", "shore", "waterfall"].includes(tag));
  if (category === "house") return tags.includes("house") || tags.includes("building") || tags.includes("roof");
  if (category === "fence") return tags.includes("fence");
  return usage === "decoration" || layer === "upper";
}

/** 업로드·번들 타일셋의 tileMeta 는 role 이 비어 있고 tags 만 있다 — 그래서 「지형」 분류가 0칸이 됐다. 땅을 이루는 태그로 usage 를 추정한다. */
const TERRAIN_TAGS: readonly string[] = ["grass", "road", "plaza", "sand", "walk", "path", "cliff", "terrain", "ground", "dirt"];
function inferTerrainUsage(tags: readonly string[]): string {
  return tags.some((tag) => TERRAIN_TAGS.includes(tag)) ? "terrain" : "";
}

export type TileFilterState = {
  readonly category: TileCategoryId;
  readonly query: string;
  /** "최근" 분류의 원본. 최근 순으로 정렬돼 있어야 한다. */
  readonly recent: readonly number[];
};

/**
 * 필터를 통과하는 타일 인덱스. 순서는 입력 순서를 유지한다 —
 * "최근" 분류만 recent 배열의 순서를 따른다.
 */
export function filterTileIndexes(tileset: TilesetDef, state: TileFilterState): readonly number[] {
  const normalizedQuery = state.query.trim().toLowerCase();
  const source = state.category === "recent"
    ? state.recent.filter((index) => index < tileset.count)
    : Array.from({ length: tileset.count }, (_, index) => index);
  const combined = isDefaultTilesetTexture(tileset);

  return source.filter((index) => {
    if (combined) {
      const tile = describeChipsetTile(index);
      if (!tileMatchesCategory(state.category, tile.tags, tile.usage, tileset.priority[index] ?? "lower")) return false;
      if (normalizedQuery.length === 0) return true;
      return [
        String(index),
        tile.label,
        tile.description,
        tile.aiLabel,
        tile.key,
        tile.tags.join(" "),
        tileDisplayLabelForIndex(index),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    }
    const meta = tileset.tileMeta?.[index];
    const tags = meta?.tags ?? (meta?.role ? [meta.role] : []);
    if (!tileMatchesCategory(state.category, tags, meta?.role ?? inferTerrainUsage(tags), tileset.priority[index] ?? "lower")) return false;
    if (normalizedQuery.length === 0) return true;
    return [String(index), meta?.label ?? "", meta?.description ?? "", meta?.role ?? "", tags.join(" ")]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}
