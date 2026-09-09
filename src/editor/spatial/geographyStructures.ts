import { isWorldWaterTile } from "@/project/defaults/worldCoastMapping";
import type { SpatialFloorArea, SpatialPoint } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { WORLD_STRUCTURE_TOOLS } from "../tools/worldStructureTools";
import { SpatialCompileError } from "./compilerTypes";

export function mountainSurface(material: string): "grass" | "dirt" | "snow" | undefined {
  switch (material) {
    case "mountain:grass": return "grass";
    case "mountain:dirt": return "dirt";
    case "mountain:snow": return "snow";
    default: return undefined;
  }
}

/** Run the existing primitive in an isolated map table; it owns one private atlas copy. */
export function geographyMountains(project: Project, map: GameMap, areas: readonly SpatialFloorArea[]): void {
  const tool = WORLD_STRUCTURE_TOOLS.find(tool => tool.name === "author_world_mountain");
  if (!tool) throw new TypeError("Missing World mountain primitive");
  for (const area of areas) {
    const surface = mountainSurface(area.material);
    if (!surface) continue;
    switch (area.kind) {
      case "polygon": throw new SpatialCompileError("material", `${map.id}:${area.material}: rectangle required`);
      case "rect":
        tool.run({ ...project, maps: { ...project.maps, [map.id]: map } }, { mapId: map.id, surface,
          tiers: [{ x: area.x, y: area.y, width: area.width, height: area.height, stairX: area.x + Math.floor(area.width / 2) }] });
        break;
      default: area satisfies never;
    }
  }
}

/** Only straight, authored water spans acquire bridges; corners in water are unsupported. */
export function geographyBridges(project: Project, map: GameMap, cells: readonly SpatialPoint[]): void {
  const tool = WORLD_STRUCTURE_TOOLS.find(tool => tool.name === "author_world_bridge");
  if (!tool) throw new TypeError("Missing World bridge primitive");
  for (let index = 0; index < cells.length; index++) {
    const first = cells[index];
    if (!first || !isWorldWaterTile(map.lowerTiles[first.y * map.width + first.x] ?? -1) || (map.upperTiles[first.y * map.width + first.x] ?? -1) >= 0) continue;
    const previous = cells[index - 1];
    if (!previous) throw new SpatialCompileError("connection", `${map.id}: bridge starts in water`);
    const dx = first.x - previous.x, dy = first.y - previous.y;
    let last = first;
    while (index + 1 < cells.length) {
      const next = cells[index + 1];
      if (!next || !isWorldWaterTile(map.lowerTiles[next.y * map.width + next.x] ?? -1)) break;
      if (next.x - last.x !== dx || next.y - last.y !== dy) throw new SpatialCompileError("connection", `${map.id}: curved bridge`);
      last = next;
      index++;
    }
    const next = cells[index + 1];
    if (!next || next.x - last.x !== dx || next.y - last.y !== dy) throw new SpatialCompileError("connection", `${map.id}: bridge landing`);
    tool.run({ ...project, maps: { ...project.maps, [map.id]: map } }, { mapId: map.id,
      x: Math.min(first.x, last.x), y: Math.min(first.y, last.y),
      length: Math.abs(last.x - first.x) + Math.abs(last.y - first.y) + 1, orientation: dx === 0 ? "vertical" : "horizontal", style: "span" });
  }
}
