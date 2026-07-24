import {
  iceDiagonalRole,
  stampIceDiagonalColumns,
  type IceDiagonalColumn,
} from "@/project/defaults/iceDiagonalTerrain";
import { TILE } from "@/project/defaults/constants";
import {
  ICE_GRAND_EXPANSE_CEILING_TILE,
  ICE_GRAND_EXPANSE_FLOOR_TILE,
  ICE_GRAND_EXPANSE_HEIGHT,
  ICE_GRAND_EXPANSE_REGION_BASES,
  ICE_GRAND_EXPANSE_RIDGES,
  ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN,
  ICE_GRAND_EXPANSE_WIDTH,
  type IceGrandExpanseRegionBase,
  type IceGrandExpanseRidgeConfig,
  type IceGrandExpanseTerrainPolygon,
  type IceGrandExpanseTerrainRoutePlan,
} from "@/project/defaults/iceGrandExpansePlan";
import {
  IceGrandExpanseTerrainError,
  validateIceGrandExpanseRidgeConfig,
  type IceGrandExpanseRoleCounts,
} from "@/project/defaults/iceGrandExpanseRidges";
import {
  fillSmallVoids,
  outlinedSnowTile,
  paintBarriers,
  paintCliffFringe,
  paintRouteOutline,
} from "@/project/defaults/iceGrandExpanseTerrainShape";

export type IceGrandExpanseTerrainInput = {
  readonly ridgeConfigs: readonly IceGrandExpanseRidgeConfig[];
  readonly regionBases: readonly IceGrandExpanseRegionBase[];
  readonly routePlan?: IceGrandExpanseTerrainRoutePlan;
};

export type IceGrandExpanseTerrain = {
  readonly width: typeof ICE_GRAND_EXPANSE_WIDTH;
  readonly height: typeof ICE_GRAND_EXPANSE_HEIGHT;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly ceilingMask: Uint8Array;
  readonly columns: readonly IceDiagonalColumn[];
  readonly roleCounts: IceGrandExpanseRoleCounts;
  readonly routeMaterialMask: Uint8Array;
  readonly nodeMaterialMask: Uint8Array;
  readonly regionMaterialMask: Uint8Array;
  readonly basinMaterialMask: Uint8Array;
  readonly passableMaterialMask: Uint8Array;
};

const DEFAULT_INPUT: IceGrandExpanseTerrainInput = {
  ridgeConfigs: ICE_GRAND_EXPANSE_RIDGES,
  regionBases: ICE_GRAND_EXPANSE_REGION_BASES,
  routePlan: ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN,
};

type TerrainMasks = {
  readonly snow: Uint8Array;
  readonly ceiling: Uint8Array;
  readonly route: Uint8Array;
  readonly node: Uint8Array;
  readonly region: Uint8Array;
  readonly basin: Uint8Array;
  readonly passable: Uint8Array;
};

const BASIN_TILES = [69, 70, 71, 99, 100, 101] as const;

function createMasks(cellCount: number): TerrainMasks {
  const ceiling = new Uint8Array(cellCount);
  ceiling.fill(1);
  return {
    snow: new Uint8Array(cellCount),
    ceiling,
    route: new Uint8Array(cellCount),
    node: new Uint8Array(cellCount),
    region: new Uint8Array(cellCount),
    basin: new Uint8Array(cellCount),
    passable: new Uint8Array(cellCount),
  };
}

function fixedBoundaryMask(cellCount: number): Uint8Array {
  const mask = new Uint8Array(cellCount);
  for (let y = 0; y < ICE_GRAND_EXPANSE_HEIGHT; y += 1) for (let x = 0; x < ICE_GRAND_EXPANSE_WIDTH; x += 1) {
    if (x < 2 || y < 2 || x >= ICE_GRAND_EXPANSE_WIDTH - 2 || y >= ICE_GRAND_EXPANSE_HEIGHT - 2) mask[y * ICE_GRAND_EXPANSE_WIDTH + x] = 1;
  }
  return mask;
}

function markDisk(mask: Uint8Array, center: readonly [number, number]): void {
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const x = center[0] + offsetX;
      const y = center[1] + offsetY;
      if (x >= 0 && y >= 0 && x < ICE_GRAND_EXPANSE_WIDTH && y < ICE_GRAND_EXPANSE_HEIGHT) mask[y * ICE_GRAND_EXPANSE_WIDTH + x] = 1;
    }
  }
}

function markPolygon(mask: Uint8Array, polygon: IceGrandExpanseTerrainPolygon): void {
  for (let y = 0; y < ICE_GRAND_EXPANSE_HEIGHT; y += 1) {
    for (let x = 0; x < ICE_GRAND_EXPANSE_WIDTH; x += 1) {
      let inside = false;
      for (let current = 0, previous = polygon.points.length - 1; current < polygon.points.length; previous = current, current += 1) {
        const a = polygon.points[current];
        const b = polygon.points[previous];
        if (a === undefined || b === undefined) continue;
        const crosses = (a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
        if (crosses) inside = !inside;
      }
      if (inside) mask[y * ICE_GRAND_EXPANSE_WIDTH + x] = 1;
    }
  }
}

function markRoutes(mask: Uint8Array, routePlan: IceGrandExpanseTerrainRoutePlan): void {
  for (const route of routePlan.routes) {
    for (let pointIndex = 1; pointIndex < route.waypoints.length; pointIndex += 1) {
      const from = route.waypoints[pointIndex - 1];
      const to = route.waypoints[pointIndex];
      if (from === undefined || to === undefined) continue;
      const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
      for (let step = 0; step <= steps; step += 1) {
        const ratio = steps === 0 ? 0 : step / steps;
        markDisk(mask, [Math.round(from[0] + (to[0] - from[0]) * ratio), Math.round(from[1] + (to[1] - from[1]) * ratio)]);
      }
    }
  }
}

function markRect(mask: Uint8Array, rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) mask[y * ICE_GRAND_EXPANSE_WIDTH + x] = 1;
  }
}

function markRidgeSupport(masks: TerrainMasks, columns: readonly IceDiagonalColumn[]): void {
  for (const column of columns) {
    for (let y = column.topY; y <= column.bottomY + 1; y += 1) {
      for (let x = column.x - 1; x <= column.x + 1; x += 1) {
        if (x < 0 || x >= ICE_GRAND_EXPANSE_WIDTH || y >= ICE_GRAND_EXPANSE_HEIGHT) continue;
        const index = y * ICE_GRAND_EXPANSE_WIDTH + x;
        masks.snow[index] = 1;
        masks.region[index] = 1;
      }
    }
  }
}

function paintMaterials(lowerTiles: number[], masks: TerrainMasks): void {
  for (let index = 0; index < lowerTiles.length; index += 1) {
    if (masks.snow[index] === 1) {
      lowerTiles[index] = outlinedSnowTile(masks.snow, ICE_GRAND_EXPANSE_WIDTH, index);
      masks.ceiling[index] = 0;
      masks.passable[index] = 1;
    } else if (masks.basin[index] === 1) {
      lowerTiles[index] = BASIN_TILES[index % BASIN_TILES.length] ?? 70;
      masks.ceiling[index] = 0;
    }
  }
}

function applyRoutePlan(masks: TerrainMasks, routePlan: IceGrandExpanseTerrainRoutePlan): void {
  for (const region of routePlan.regions) markPolygon(masks.region, region);
  masks.snow.set(masks.region);
  for (const basin of routePlan.basins) markPolygon(masks.basin, basin);
  for (let index = 0; index < masks.basin.length; index += 1) if (masks.basin[index] === 1) masks.snow[index] = 0;
  markRoutes(masks.route, routePlan);
  for (const node of routePlan.nodes) markRect(masks.node, node);
  for (let index = 0; index < masks.snow.length; index += 1) if (masks.route[index] === 1 || masks.node[index] === 1) masks.snow[index] = 1;
  for (const clearing of routePlan.clearings) for (let y = clearing[1] - 1; y <= clearing[1] + 1; y += 1) {
    for (let x = clearing[0] - 1; x <= clearing[0] + 1; x += 1) {
      const index = y * ICE_GRAND_EXPANSE_WIDTH + x;
      masks.snow[index] = 1;
      masks.basin[index] = 0;
    }
  }
}

function applyConnectors(terrain: { readonly lower: readonly number[]; readonly upper: number[]; readonly masks: TerrainMasks }, routePlan: IceGrandExpanseTerrainRoutePlan): void {
  for (const connector of routePlan.connectors) {
    for (let y = connector.y; y < connector.y + connector.height; y += 1) for (let x = connector.x; x < connector.x + connector.width; x += 1) {
      const index = y * ICE_GRAND_EXPANSE_WIDTH + x;
      terrain.masks.route[index] = 1;
      terrain.masks.passable[index] = 1;
      terrain.masks.ceiling[index] = 0;
      if (iceDiagonalRole(terrain.lower[index] ?? TILE.EMPTY) !== null) terrain.upper[index] = ICE_GRAND_EXPANSE_FLOOR_TILE;
    }
  }
  for (let index = 0; index < terrain.lower.length; index += 1) {
    if (terrain.masks.route[index] === 1 && iceDiagonalRole(terrain.lower[index] ?? TILE.EMPTY) !== null) {
      terrain.upper[index] = ICE_GRAND_EXPANSE_FLOOR_TILE;
      terrain.masks.passable[index] = 1;
    }
  }
}

export function buildIceGrandExpanseTerrain(input: IceGrandExpanseTerrainInput = DEFAULT_INPUT): IceGrandExpanseTerrain {
  const cellCount = ICE_GRAND_EXPANSE_WIDTH * ICE_GRAND_EXPANSE_HEIGHT;
  const lowerTiles = new Array<number>(cellCount).fill(ICE_GRAND_EXPANSE_CEILING_TILE);
  const upperTiles = new Array<number>(cellCount).fill(TILE.EMPTY);
  const masks = createMasks(cellCount);
  const routePlan = input.routePlan ?? ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN;
  applyRoutePlan(masks, routePlan);
  const provisionalColumns = validateIceGrandExpanseRidgeConfig(input.ridgeConfigs, fixedBoundaryMask(cellCount)).columns;
  markRidgeSupport(masks, provisionalColumns);
  fillSmallVoids(masks.snow, masks.basin, ICE_GRAND_EXPANSE_WIDTH, 24);
  paintMaterials(lowerTiles, masks);
  paintCliffFringe(lowerTiles, masks.snow, masks.basin, ICE_GRAND_EXPANSE_WIDTH);
  paintRouteOutline(lowerTiles, masks.route, masks.node, ICE_GRAND_EXPANSE_WIDTH);
  const validation = validateIceGrandExpanseRidgeConfig(input.ridgeConfigs, masks.ceiling);
  const stamped = stampIceDiagonalColumns({
    width: ICE_GRAND_EXPANSE_WIDTH,
    height: ICE_GRAND_EXPANSE_HEIGHT,
    lower: lowerTiles,
  }, validation.columns);
  if (!stamped.ok) throw new IceGrandExpanseTerrainError("RIDGE_STAMP_REJECTED");
  for (let index = 0; index < stamped.lower.length; index += 1) if (iceDiagonalRole(stamped.lower[index] ?? TILE.EMPTY) !== null) masks.passable[index] = 0;
  applyConnectors({ lower: stamped.lower, upper: upperTiles, masks }, routePlan);
  paintBarriers({ upper: upperTiles, passable: masks.passable, barriers: routePlan.barriers, clearings: routePlan.clearings, width: ICE_GRAND_EXPANSE_WIDTH });
  return {
    width: ICE_GRAND_EXPANSE_WIDTH,
    height: ICE_GRAND_EXPANSE_HEIGHT,
    lowerTiles: stamped.lower,
    upperTiles,
    ceilingMask: masks.ceiling,
    columns: validation.columns,
    roleCounts: validation.roleCounts,
    routeMaterialMask: masks.route,
    nodeMaterialMask: masks.node,
    regionMaterialMask: masks.region,
    basinMaterialMask: masks.basin,
    passableMaterialMask: masks.passable,
  };
}
