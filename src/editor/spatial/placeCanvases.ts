import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import type { SpatialAuthoringDocument, SpatialId, SpatialPoint } from "@/project/spatial/types";
import { SPATIAL_SIZE_MAX } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { SpatialCompileError } from "./compilerTypes";
import type { PlaceSurface } from "./placeLayout";

export type PlacedSurface = { readonly surface: PlaceSurface; readonly map: GameMap; readonly offset: SpatialPoint };

/** Same-atlas outdoor surfaces share a level canvas; interior floors remain distinct maps. */
export function placeCanvases(context: { readonly project: Project; readonly document: SpatialAuthoringDocument; readonly rootId: SpatialId }, surfaces: readonly PlaceSurface[]): readonly PlacedSurface[] {
  const groups = new Map<string, PlaceSurface[]>();
  for (const surface of surfaces) {
    const atlas = surface.raster.map.tilesetId;
    const id = surface.outdoor ? `spatial-place:${context.rootId.length}:${context.rootId}:${surface.level}:${atlas.length}:${atlas}` : surface.raster.map.id;
    const group = groups.get(id) ?? [];
    group.push(surface);
    groups.set(id, group);
  }
  const placed: PlacedSurface[] = [];
  for (const [id, group] of groups) {
    const first = group[0];
    if (!first) throw new SpatialCompileError("raster", id);
    const origin = { x: Math.min(0, ...group.map(surface => surface.outdoor ? surface.world.x : 0)),
      y: Math.min(0, ...group.map(surface => surface.outdoor ? surface.world.y : 0)) };
    const width = Math.max(...group.map(surface => surface.raster.map.width + (surface.outdoor ? surface.world.x - origin.x : 0)));
    const height = Math.max(...group.map(surface => surface.raster.map.height + (surface.outdoor ? surface.world.y - origin.y : 0)));
    const previous = context.project.maps[id];
    const owners = Object.values(context.document.occurrences).filter(occurrence => group.some(surface => surface.occurrence.id === occurrence.id))
      .flatMap(occurrence => occurrence.bindings.filter(binding => isOwnedSpatialBinding(binding) && binding.mapId === id));
    if (previous && !owners.length) throw new SpatialCompileError("ownership", id);
    const size = { width: Math.max(width, previous?.width ?? 0), height: Math.max(height, previous?.height ?? 0) };
    if (size.width > SPATIAL_SIZE_MAX || size.height > SPATIAL_SIZE_MAX) throw new SpatialCompileError("clipped", id);
    const base = first.raster.map;
    const map: GameMap = { ...(previous ?? (first.outdoor ? { id, name: base.name, tilesetId: base.tilesetId, tileSize: base.tileSize } : base)),
      id, ...size, lowerTiles: new Array<number>(size.width * size.height).fill(-1),
      upperTiles: new Array<number>(size.width * size.height).fill(-1), events: [...previous?.events ?? []] };
    if (previous) {
      for (const layer of ["lower", "upper"] as const) {
        const tiles = `${layer}Tiles` as const;
        const stacks = `${layer}TileStacks` as const;
        for (let y = 0; y < previous.height; y++) for (let x = 0; x < previous.width; x++) {
          map[tiles][y * map.width + x] = previous[tiles][y * previous.width + x] ?? -1;
        }
        if (previous[stacks]) map[stacks] = Object.fromEntries(Object.entries(previous[stacks]).map(([index, stack]) =>
          [Math.floor(Number(index) / previous.width) * map.width + Number(index) % previous.width, stack]));
      }
    }
    const occupied = new Set<number>();
    for (const surface of group) {
      const offset = surface.outdoor ? { x: surface.world.x - origin.x, y: surface.world.y - origin.y } : { x: 0, y: 0 };
      const raster = surface.raster.map;
      for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
        const index = (y + offset.y) * map.width + x + offset.x;
        if (occupied.has(index) || map.lowerTiles[index] !== -1 || map.upperTiles[index] !== -1
          || map.lowerTileStacks?.[index]?.length || map.upperTileStacks?.[index]?.length) throw new SpatialCompileError("ownership", `${id}@${x + offset.x},${y + offset.y}`);
        occupied.add(index);
        map.lowerTiles[index] = raster.lowerTiles[y * raster.width + x] ?? -1;
        map.upperTiles[index] = raster.upperTiles[y * raster.width + x] ?? -1;
        for (const layer of ["lowerTileStacks", "upperTileStacks"] as const) {
          const stack = raster[layer]?.[y * raster.width + x];
          if (stack) (map[layer] ??= {})[index] = [...stack];
        }
      }
      for (const event of raster.events) {
        const translated = { ...event, x: event.x + offset.x, y: event.y + offset.y };
        if (map.events.some(existing => existing.id === event.id || existing.x === translated.x && existing.y === translated.y)) {
          throw new SpatialCompileError("ownership", event.id);
        }
        map.events.push(translated);
      }
      placed.push({ surface, map, offset });
    }
    context.project.maps[id] = map;
  }
  return placed;
}
