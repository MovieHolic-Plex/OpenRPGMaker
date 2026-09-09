import type { HouseStructureKitDef } from "../types";
import { resolveSpatialGraphic } from "./assets";
import { assertNever, freezeSpatial, SpatialOperationError } from "./domain";
import { SPATIAL_SIZE_MAX, type SpatialAssetContext, type SpatialGraphic, type SpatialKitSnapshot } from "./types";

/** Legacy parametric houses need a caller-owned pure backend. No editor import or fallback.
 * The adapter returns the complete selected raster, not a deferred recipe or placeholder.
 */
export type SpatialRasterAdapter = (graphic: SpatialGraphic, kit: Readonly<HouseStructureKitDef>) => SpatialKitSnapshot;
export type SpatialResolutionContext = SpatialAssetContext & { readonly rasterizeHouse?: SpatialRasterAdapter };

export function snapshotGraphic(context: SpatialResolutionContext, graphic: SpatialGraphic): SpatialKitSnapshot {
  const resolved = resolveSpatialGraphic(context, graphic);
  const path = `${graphic.tilesetId}/${graphic.kitId}`;
  if (!resolved) throw new SpatialOperationError("missing", path);
  let snapshot: SpatialKitSnapshot;
  switch (resolved.source) {
    case "builtin": snapshot = { ...graphic, width: resolved.object.width, height: resolved.object.height,
      cells: resolved.object.cells.map(({ dx, dy, layer, tile }) => ({ x: dx, y: dy, layer, tile })) }; break;
    case "authored": {
      const kit = resolved.kit;
      switch (kit.kind) {
        case "house": {
          if (!context.rasterizeHouse) throw new SpatialOperationError("raster", `${path}: unsupported authored house`);
          snapshot = context.rasterizeHouse(freezeSpatial({ ...graphic }), freezeSpatial(structuredClone(kit)));
          break;
        }
        case "section": {
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
          snapshot = { ...graphic, width, height, cells };
          break;
        }
        default: return assertNever(kit);
      }
      break;
    }
    default: return assertNever(resolved);
  }
  if (snapshot.tilesetId !== graphic.tilesetId || snapshot.kitId !== graphic.kitId || snapshot.cells.length === 0) {
    throw new SpatialOperationError("raster", `${path}: incomplete or mismatched raster`);
  }
  return snapshot;
}
