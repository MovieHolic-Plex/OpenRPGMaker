import { resolveSpatialGraphic } from "./assets";
import { assertNever, SpatialOperationError } from "./domain";
import { SPATIAL_SIZE_MAX, type SpatialAssetContext, type SpatialGraphic, type SpatialKitSnapshot } from "./types";

export type SpatialResolutionContext = SpatialAssetContext;

/**
 * 이 그래픽이 실제로 어느 아틀라스 픽셀 크기로 찍히는가.
 *
 * 스냅샷에 박아 두면 나중에 타일셋 쪽 크기가 바뀌어도 이미 찍힌 배치의 픽셀 의미가
 * 보존되고, 검증이 어긋남을 잡아낼 수 있다. 타일셋이 사라졌으면 undefined — 해석 불가를
 * 0 이나 기본값으로 뭉개지 않는다.
 */
export function graphicTileSize(context: SpatialResolutionContext, graphic: SpatialGraphic): number | undefined {
  return context.tilesets[graphic.tilesetId]?.tileSize;
}

export function snapshotGraphic(context: SpatialResolutionContext, graphic: SpatialGraphic): SpatialKitSnapshot {
  const resolved = resolveSpatialGraphic(context, graphic);
  const path = `${graphic.tilesetId}/${graphic.kitId}`;
  const tileSize = graphicTileSize(context, graphic);
  const pixelSize = tileSize === undefined ? {} : { tileSize };
  if (!resolved) throw new SpatialOperationError("missing", path);
  let snapshot: SpatialKitSnapshot;
  switch (resolved.source) {
    case "builtin": snapshot = { ...graphic, width: resolved.object.width, height: resolved.object.height,
      ...pixelSize,
      interior: {id: resolved.object.id, snap: resolved.object.snap, role: resolved.object.role ?? "decoration"},
      cells: resolved.object.cells.map(({ dx, dy, layer, tile }) => ({ x: dx, y: dy, layer, tile })) }; break;
    case "authored": {
      const kit = resolved.kit;
      // 구 저장 데이터의 파라메트릭 집 킷(kind:"house")은 제거된 개념 — 인터트 데이터다.
      if (kit.kind !== "section") {
        throw new SpatialOperationError("raster", `${path}: unsupported kit kind`);
      }
      const { width, height } = kit;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
        || width > SPATIAL_SIZE_MAX || height > SPATIAL_SIZE_MAX || kit.rows.length !== height) {
        throw new SpatialOperationError("raster", `${path}: section dimensions`);
      }
      // The existing expansion lives in editor/structureKitModel; preserve its exact
      // lower-then-upper, nonempty-cell order here without reversing the dependency.
      const cells: SpatialKitSnapshot["cells"][number][] = [];
      kit.rows.forEach((row, y) => {
        if (row.tiles.length !== width || (row.upperTiles !== undefined && row.upperTiles.length !== width)) {
          throw new SpatialOperationError("raster", `${path}: row ${y}`);
        }
        row.tiles.forEach((tile, x) => {
          if (tile !== -1) cells.push({ x, y, layer: "lower", tile });
          const upper = row.upperTiles?.[x];
          if (upper !== undefined && upper !== -1) cells.push({ x, y, layer: "upper", tile: upper });
        });
      });
      snapshot = { ...graphic, width, height, cells,
        ...pixelSize,
        ...(graphic.tilesetId === "easyrpg_chipset_interior" && kit.ai?.snap ? {interior: {id: kit.id, snap: kit.ai.snap, role: kit.ai.interiorRole ?? "decoration"}} : {}) };
      break;
    }
    default: return assertNever(resolved);
  }
  // Wall mounts are painted above the structural wall by the established composer.
  // Freeze that effective raster as well, so validation/ownership describe the pixels actually emitted.
  if (snapshot.interior?.snap === "wall-any") snapshot = {...snapshot, cells: snapshot.cells.map(cell => ({...cell, layer: "upper" as const}))};
  if (snapshot.tilesetId !== graphic.tilesetId || snapshot.kitId !== graphic.kitId || snapshot.cells.length === 0) {
    throw new SpatialOperationError("raster", `${path}: incomplete or mismatched raster`);
  }
  return snapshot;
}
