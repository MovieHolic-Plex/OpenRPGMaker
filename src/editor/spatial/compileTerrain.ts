import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { interiorRoomRects } from "@/project/interiorRoomFootprint";
import { assertNever } from "@/project/spatial/domain";
import type { SpaceDesign, SpatialFloorArea, SpatialPoint } from "@/project/spatial/types";
import type { GameMap, TilesetDef } from "@/project/types";
import { resolveMaterialSlots } from "../operators/materialSlots";
import { resolveAutotile } from "../tools/v3/rmTypeExpander";
import { SpatialCompileError } from "./compilerTypes";

/** Integer cell centers define coverage; polygon boundaries are included. */
function inArea(area: SpatialFloorArea, point: SpatialPoint): boolean {
  switch (area.kind) {
    case "rect": return point.x >= area.x && point.y >= area.y && point.x < area.x + area.width && point.y < area.y + area.height;
    case "polygon": {
      let inside = false;
      for (const [index, a] of area.points.entries()) {
        const b = area.points[(index + 1) % area.points.length];
        if (!b) continue;
        const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
        if (cross === 0 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
          && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true;
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    }
    default: return assertNever(area);
  }
}

/** Uses authored/bundled material-slot resolution and the existing terrain autotiler. */
export function compileTerrain(space: Extract<SpaceDesign, { environment: "outdoor" }>, tileset: TilesetDef, mapId: string): GameMap {
  if (space.wall !== "none") throw new SpatialCompileError("material", `${space.id}.wall:${space.wall}`);
  const slots = resolveMaterialSlots(tileset);
  const map: GameMap = { id: mapId, name: space.name, tilesetId: tileset.id, tileSize: tileset.tileSize,
    width: space.width, height: space.height, lowerTiles: new Array<number>(space.width * space.height).fill(-1),
    upperTiles: new Array<number>(space.width * space.height).fill(-1), events: [] };
  // Shared room geometry owns coverage. Unpainted lower=-1 is blocked engine void,
  // so terrain, object placement masks and port reachability agree on the cutouts.
  const cells = interiorRoomRects({ x: 0, y: 0, w: space.width, h: space.height, shape: space.shape })
    .flatMap(box => Array.from({ length: box.h }, (_, y) =>
      Array.from({ length: box.w }, (_, x) => ({ x: box.x + x, y: box.y + y }))).flat());
  const coverage = new Set(cells.map(cell => cell.y * map.width + cell.x));
  const areas: readonly SpatialFloorArea[] = [
    { kind: "rect", x: 0, y: 0, width: space.width, height: space.height, material: space.floor }, ...space.floorAreas,
  ];
  for (const area of areas) {
    const slot = Object.values(slots).find(slot => slot.id === area.material);
    const body = slot?.body ?? slot?.tiles[0];
    if (!slot || slot.layer !== "lower" || slot.pair || body === undefined || body < 0 || body >= tileset.count) {
      throw new SpatialCompileError("material", `${space.id}.material:${area.material}`);
    }
    for (const cell of cells) {
      if (inArea(area, cell)) map.lowerTiles[cell.y * map.width + cell.x] = body;
    }
  }
  for (const group of autotileGroupsForTileset(tileset)) {
    resolveAutotile(group, cells, map, (x, y) => coverage.has(y * map.width + x));
  }
  return map;
}
