import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { LEGACY_RM_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { openMapContextMenu, type MapContextMenuPoint } from "@/editor/panels/mapContextMenu";
import { tileInfoFixMenuItem } from "@/editor/panels/tileMetaFixPopover";
import { tileMetaLocked } from "@/project/tilesetPalette";
import type { TileMetadataSource, TilesetDef } from "@/project/types";

export type TilesetTileContext = {
  readonly tile: number;
  readonly currentLabel: string;
  readonly currentAiLabel: string;
  readonly layer: "lower" | "upper";
  readonly repeatRole: string;
  readonly terrainTag: number;
  readonly tags: readonly string[];
  readonly metadataSource: TileMetadataSource;
  readonly userLocked: boolean;
};

export function resolveTilesetTileContext(tileset: TilesetDef, tile: number): TilesetTileContext {
  const meta = tileset.tileMeta?.[tile];
  if (meta && (meta.label.trim().length > 0 || meta.description.trim().length > 0)) {
    return {
      tile,
      currentLabel: meta.label || `Tile ${tile}`,
      currentAiLabel: meta.description || "사용자가 저장한 타일 메타데이터입니다.",
      layer: tileset.priority[tile] === "upper" ? "upper" : "lower",
      repeatRole: meta.repeatability ?? meta.role ?? "auto",
      terrainTag: meta.terrainTag ?? tileset.terrain[tile] ?? 0,
      tags: [meta.role ?? "metadata", meta.source ?? "user"],
      metadataSource: meta.source ?? "user",
      userLocked: tileMetaLocked(meta),
    };
  }
  if (isDefaultBundledTileset(tileset)) {
    const bundled = describeChipsetTile(tile);
    return {
      tile,
      currentLabel: bundled.label,
      currentAiLabel: bundled.aiLabel,
      layer: bundled.layer,
      repeatRole: bundled.repeatRole,
      terrainTag: bundled.terrainTag,
      tags: bundled.tags,
      metadataSource: "bundled-default",
      userLocked: false,
    };
  }
  return {
    tile,
    currentLabel: `Tile ${tile}`,
    currentAiLabel: "아직 분류되지 않은 타일입니다. 이미지와 사용자 선택을 기준으로 판단해야 합니다.",
    layer: tileset.priority[tile] === "upper" ? "upper" : "lower",
    repeatRole: "auto",
    terrainTag: tileset.terrain[tile] ?? 0,
    tags: ["unknown"],
    metadataSource: "unknown",
    userLocked: false,
  };
}

export function openTilesetTileContextMenu(options: {
  readonly point: MapContextMenuPoint;
  readonly rerender: () => void;
  readonly tile: number;
  readonly tileset: TilesetDef;
}): void {
  openMapContextMenu({
    items: [
      tileInfoFixMenuItem({
        point: options.point,
        rerender: options.rerender,
        tile: options.tile,
        tilesetId: options.tileset.id,
      }),
    ],
    mapId: options.tileset.id,
    mapName: `${options.tileset.name} ${options.tile}번 타일`,
    point: options.point,
  });
}

export function isDefaultBundledTileset(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY;
}
