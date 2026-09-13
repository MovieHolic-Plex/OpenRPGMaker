import { isPassableLanding } from "@/project/collision";
import { interiorRoomRects } from "@/project/interiorRoomFootprint";
import { assertNever, own } from "@/project/spatial/domain";
import type { SpaceDesign, SpatialPoint } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { isConceptFloorMaterial, isConceptWallMaterial } from "@/project/types/conceptBundle";
import { CONCEPT_FLOOR_TILES } from "../conceptBundleResolve";
import { applyInteriorRoomLayer, createEmptyRoomMap, type InteriorRoomPlan } from "../interiorRoomPipeline";
import { compileTerrain } from "./compileTerrain";
import { containsPoint } from "./compileObjects";
import { SpatialCompileError } from "./compilerTypes";

/** The floor's explicit size is preserved; the shell backend needs 2 side / 4 north / 2 south padding. */
export function spaceLayout(project: Project, space: SpaceDesign, identity: { readonly mapId: string; readonly seed: number }) {
  const tileset = own(project.tilesets, space.tilesetId);
  const localEntry: SpatialPoint = space.ports[0] ?? { x: Math.floor(space.width / 2), y: space.height - 1 };
  switch (space.environment) {
    case "interior": {
      if (space.tilesetId !== "easyrpg_chipset_interior") throw new SpatialCompileError("atlas", space.tilesetId);
      if (!isConceptFloorMaterial(space.floor)) throw new SpatialCompileError("material", `${space.id}.floor:${space.floor}`);
      if (!isConceptWallMaterial(space.wall)) throw new SpatialCompileError("material", `${space.id}.wall:${space.wall}`);
      const room = { id: space.id, x: 2, y: 4, w: space.width, h: space.height, shape: space.shape, theme: space.id };
      const entry = { x: room.x + localEntry.x, y: room.y + localEntry.y };
      const boxes = interiorRoomRects(room);
      if (!boxes.some(box => containsPoint({ x: box.x, y: box.y, width: box.w, height: box.h }, entry))) {
        throw new SpatialCompileError("entry", `${space.id}@${localEntry.x},${localEntry.y}`);
      }
      const rooms = space.interiorLayout?.rooms.map(part => ({ id: part.id,
        x: room.x + part.x, y: room.y + part.y, w: part.width, h: part.height,
        shape: "rect" as const, theme: space.id })) ?? [room];
      const plan: InteriorRoomPlan = { ...identity, name: space.name, tilesetId: tileset.id,
        width: space.width + 4, height: space.height + 6, wings: [], rooms, door: entry,
        ...(space.interiorLayout ? { innerDoors: space.interiorLayout.doorways.map(p => ({ x: room.x + p.x, y: room.y + p.y })) } : {}),
        theme: space.id, floorTile: CONCEPT_FLOOR_TILES[space.floor], wallMaterial: space.wall,
        concept: { bundleId: space.id, facilityId: space.id, facilityLabel: space.name,
          rooms: Object.fromEntries(rooms.map(part => [part.id, { placeId: part.id, placeLabel: space.interiorLayout?.rooms.find(r => r.id === part.id)?.name ?? space.name, role: space.role, things: [] }])) } };
      let map = createEmptyRoomMap(plan);
      // No entrance self-transfer, legacy filler, or live vocabulary lookup is authorized.
      for (const layer of ["plan", "floor", "walls", "furniture"] as const) {
        const result = applyInteriorRoomLayer(map, plan, layer, { objectsById: new Map(), kindsById: new Map() });
        if (!result.ok || result.warnings.length) throw new SpatialCompileError("raster", `${space.id}:${result.warnings.join(";")}`);
        map = result.map;
      }
      map.roomHarnessPlan = { kitId: "villager-room-v1", plan };
      const floor = map.lowerTiles.map((_, i) => (!space.interiorLayout || isPassableLanding(project, map, i % map.width, Math.floor(i / map.width))) && boxes.some(box => containsPoint({ x: box.x, y: box.y, width: box.w, height: box.h },
        { x: i % map.width, y: Math.floor(i / map.width) })));
      return { map, room, entry, floor, role: space.role };
    }
    case "outdoor": {
      const map = compileTerrain(space, tileset, identity.mapId);
      return { map, room: { id: space.id, x: 0, y: 0, w: space.width, h: space.height }, entry: localEntry,
        floor: map.lowerTiles.map((_, i) => isPassableLanding(project, map, i % map.width, Math.floor(i / map.width))), role: "room" as const };
    }
    default: return assertNever(space);
  }
}
