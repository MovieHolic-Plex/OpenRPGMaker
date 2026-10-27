import { bundledTilesetById } from "../defaults/defaultAssets";
import { interiorObjectById, type InteriorObjectDef } from "../defaults/interiorObjectCatalog";
import { EASYRPG_INTERIOR_TILESET_ID as INTERIOR_TILESET_ID } from "../mapCreateSpec";
import type { StructureKitDef, TilesetDef } from "../types";
import type { SpatialAssetContext, SpatialGraphic } from "./types";

// Derive the identity AND layout from the shipped declaration, not the caller's ID/name.
// Retain only the immutable atlas signature, not another tileset/catalog registry.
// EasyRPG 실내 시트는 2026-10-07 저작권 정리로 번들에서 빠졌다 — 없으면 내장 기물은 어느 타일셋에도 맞지 않는다.
// 첫 사용 때 한 번만 읽는다(모듈 평가 때 번들 전체를 만들면 부팅이 0.6s 늦는다 — bundledTilesetById 머리말).
type BundledInteriorAtlas = Readonly<{ image: TilesetDef["image"]; kind: TilesetDef["kind"]; tileSize: number; tilesPerRow: number; count: number }>;
let bundledInteriorAtlasMemo: BundledInteriorAtlas | null | undefined;
function bundledInteriorAtlas(): BundledInteriorAtlas | null {
  if (bundledInteriorAtlasMemo !== undefined) return bundledInteriorAtlasMemo;
  const tileset = bundledTilesetById(INTERIOR_TILESET_ID);
  bundledInteriorAtlasMemo = tileset
    ? Object.freeze({
      image: Object.freeze({ ...tileset.image }), kind: tileset.kind,
      tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow, count: tileset.count,
    })
    : null;
  return bundledInteriorAtlasMemo;
}

export type ResolvedSpatialGraphic =
  | { readonly source: "authored"; readonly kit: StructureKitDef }
  | { readonly source: "builtin"; readonly object: InteriorObjectDef };

function eligibleInteriorAtlas(tileset: TilesetDef): boolean {
  const atlas = bundledInteriorAtlas();
  return atlas !== null
    && tileset.image.type === "bundled"
    && atlas.image.type === "bundled"
    && tileset.image.id === atlas.image.id
    && tileset.tileSize === atlas.tileSize
    && tileset.tilesPerRow === atlas.tilesPerRow
    && tileset.count === atlas.count
    && (tileset.kind === undefined || tileset.kind === atlas.kind)
    && (tileset.tileGrafts === undefined || tileset.tileGrafts.length === 0);
}

/** Live lookup only. An authored kit is authoritative even when a consumer cannot rasterize it.
 * Frozen compositions consume their owner-keyed snapshot cells instead of this resolver.
 */
export function resolveSpatialGraphic(
  assets: Pick<SpatialAssetContext, "tilesets">,
  graphic: SpatialGraphic,
): ResolvedSpatialGraphic | undefined {
  const tileset = Object.hasOwn(assets.tilesets, graphic.tilesetId) ? assets.tilesets[graphic.tilesetId] : undefined;
  if (!tileset) return undefined;
  const kit = tileset.structureKits?.find(entry => entry.id === graphic.kitId);
  if (kit) return { source: "authored", kit };
  if (!eligibleInteriorAtlas(tileset)) return undefined;
  const object = interiorObjectById(graphic.kitId);
  return object === undefined ? undefined : { source: "builtin", object };
}
