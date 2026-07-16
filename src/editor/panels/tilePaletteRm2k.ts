import { TILE_SIZE } from "@/assets/bundled";
import type { Layer } from "@/editor/editorState";
import { tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { isDefaultTilesetTexture, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { CHIPSET_TILE_GROUPS, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { AutotileGroup, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

// RM2003식 단일 타일 팔레트 — 그룹/시트 보기 분리 없이 가로 6칸 고정 리플로우.
// 오토타일 그룹(autotileGroupsForTileset)은 그룹당 대표 1칸(외딴/anchor 타일)으로
// 맨 앞에 축약 노출하고, variantMap 출력 전용 변형 타일은 일반 나열에서 숨긴다.
// 물(호수/폭포)은 오토타일 그룹이 아니라 별도 애니메이션 프레임 체계지만,
// RM2003과 동일하게 대표 1칸(물=0, 폭포=93)으로 축약한다.

export const RM2K_PALETTE_COLUMNS = 6;
const RM2K_CELL_SIZE = TILE_SIZE * 2;

export type Rm2kAutotileEntry = {
  readonly id: string;
  readonly name: string;
  /** 대표 칸 = 클릭 시 선택되는 타일. 오토타일 그룹은 mask 0(외딴/anchor) 변형. */
  readonly representativeTile: number;
};

export type Rm2kPaletteModel = {
  /** 팔레트 상단에 1칸씩 노출되는 오토타일(+물) 대표 목록. */
  readonly autotiles: readonly Rm2kAutotileEntry[];
  /** 대표/변형 축약 이후 일반 나열되는 타일 인덱스(오름차순). */
  readonly tileIds: readonly number[];
};

type MakeRm2kPaletteArgs = {
  readonly layer: Exclude<Layer, "event">;
  readonly onSelectTile: (index: number) => void;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
};

/** 그룹의 대표(anchor) 타일 — 이웃이 전혀 없는 mask 0 변형(외딴 점). 없으면 첫 멤버. */
export function autotileRepresentativeTile(group: AutotileGroup): number {
  const isolated = group.variantMap["0"];
  if (typeof isolated === "number") return isolated;
  return group.memberTileIds[0] ?? -1;
}

function variantOutputTiles(group: AutotileGroup): readonly number[] {
  return Object.values(group.variantMap).filter((value): value is number => typeof value === "number");
}

type CollapsedEntrySource = {
  readonly id: string;
  readonly name: string;
  readonly representativeTile: number;
  /** 일반 나열에서 숨길 변형/프레임 타일들(대표 포함). */
  readonly collapsedTiles: readonly number[];
};

function collapsedEntrySources(tileset: TilesetDef): readonly CollapsedEntrySource[] {
  const sources: CollapsedEntrySource[] = [];
  if (isDefaultTilesetTexture(tileset)) {
    // 물(호수 몸통+물가) — 0~2열 애니 프레임 블록 전체를 대표 1칸으로.
    sources.push({
      id: "chipset_lake_water",
      name: "물",
      representativeTile: CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames[0] ?? 0,
      collapsedTiles: [
        ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
        ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
      ],
    });
    // 폭포 — 3~5열 애니 프레임 블록.
    sources.push({
      id: "chipset_waterfall",
      name: "폭포",
      representativeTile: CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames[0] ?? 93,
      collapsedTiles: [...CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames],
    });
  }
  for (const group of autotileGroupsForTileset(tileset)) {
    sources.push({
      id: group.id,
      name: group.name,
      representativeTile: autotileRepresentativeTile(group),
      collapsedTiles: variantOutputTiles(group),
    });
  }
  return sources;
}

export function buildRm2kPaletteModel(tileset: TilesetDef, layer: Exclude<Layer, "event">): Rm2kPaletteModel {
  const hidden = new Set<number>();
  const usedRepresentatives = new Set<number>();
  const autotiles: Rm2kAutotileEntry[] = [];
  for (const source of collapsedEntrySources(tileset)) {
    for (const tile of source.collapsedTiles) {
      if (tile >= 0 && tile < tileset.count) hidden.add(tile);
    }
    const representative = source.representativeTile;
    if (representative < 0 || representative >= tileset.count) continue;
    hidden.add(representative);
    if (usedRepresentatives.has(representative)) continue;
    if (!tileVisibleOnLayer(tileset, representative, layer)) continue;
    usedRepresentatives.add(representative);
    autotiles.push({ id: source.id, name: source.name, representativeTile: representative });
  }
  const tileIds: number[] = [];
  for (let index = 0; index < tileset.count; index += 1) {
    if (hidden.has(index)) continue;
    if (!tileVisibleOnLayer(tileset, index, layer)) continue;
    tileIds.push(index);
  }
  return { autotiles, tileIds };
}

/**
 * 팔레트에 실제로 노출되는 칸으로 매핑 — 숨겨진 변형/프레임 타일은 대표 칸으로.
 * (맵 스포이트 → 팔레트 스크롤 하이라이트에서 사용)
 */
export function rm2kPaletteDisplayTile(tileset: TilesetDef, tile: number): number {
  for (const source of collapsedEntrySources(tileset)) {
    const representative = source.representativeTile;
    if (representative < 0 || representative >= tileset.count) continue;
    if (tile === representative) return representative;
    if (source.collapsedTiles.includes(tile)) return representative;
  }
  return tile;
}

export function makeRm2kPalette(args: MakeRm2kPaletteArgs): HTMLElement {
  const model = buildRm2kPaletteModel(args.tileset, args.layer);
  const sheet = el("div", {
    class: "chipset-sheet tile-palette rm2k-palette",
    dataset: { testid: "tile-palette" },
    attrs: { style: `--chipset-cell:${RM2K_CELL_SIZE}px` },
  });
  const grid = el("div", {
    class: "chipset-grid rm2k-palette-grid",
    dataset: { testid: "rm2k-palette-grid" },
    attrs: {
      // 6열 고정 리플로우 — 미디어쿼리의 auto-fill 재정의를 이기도록 인라인으로 못박는다.
      style: `grid-template-columns:repeat(${RM2K_PALETTE_COLUMNS}, var(--chipset-cell))`,
    },
  });
  for (const entry of model.autotiles) {
    grid.append(makeRm2kCell(args, entry.representativeTile, entry.name));
  }
  for (const tileId of model.tileIds) {
    grid.append(makeRm2kCell(args, tileId));
  }
  sheet.append(grid);
  return sheet;
}

function makeRm2kCell(args: MakeRm2kPaletteArgs, tileId: number, autotileName?: string): HTMLButtonElement {
  const title = autotileName !== undefined
    ? `${tileId} ${autotileName} (오토타일 — 이웃에 맞춰 자동 성형)`
    : rm2kTileTitle(args.tileset, tileId);
  const cell = el("button", {
    class: "chipset-tile"
      + (args.selectedTile === tileId ? " active" : "")
      + (autotileName !== undefined ? " rm2k-autotile" : ""),
    attrs: {
      title,
      type: "button",
      "aria-label": title,
      style: tilesetTileBackgroundStyle(args.tileset, tileId, "var(--chipset-cell)"),
    },
    dataset: { testid: `chipset-tile-${tileId}`, tileIndex: String(tileId) },
    on: {
      // 선택은 pointerdown에서 즉시 — click(down+up 쌍)은 도중에 패널이 재구축되면 증발한다.
      pointerdown: (event) => {
        if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
        event.preventDefault();
        args.onSelectTile(tileId);
      },
      click: (event) => event.preventDefault(),
    },
  });
  if (autotileName !== undefined) {
    cell.append(el("span", {
      class: "rm2k-autotile-badge",
      text: "◆",
      attrs: { "aria-hidden": "true" },
    }));
  }
  return cell;
}

function rm2kTileTitle(tileset: TilesetDef, tileId: number): string {
  if (isDefaultTilesetTexture(tileset)) {
    return `${tileDisplayLabelForIndex(tileId)} / AI: ${tileAiLabelForIndex(tileId)}`;
  }
  const label = tileset.tileMeta?.[tileId]?.label?.trim();
  return label ? `${tileId} ${label}` : `타일 ${tileId}`;
}
