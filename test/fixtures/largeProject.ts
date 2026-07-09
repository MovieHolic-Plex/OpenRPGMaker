import { createBlankProject } from "@/project/defaults";
import type { GameMap, MapTreeNode, Project } from "@/project/types";

export function createLargeProjectFixture(mapCount = 50, width = 40, height = 40): Project {
  const project = createBlankProject();
  const template = project.maps[project.startMapId]!;
  const maps: Record<string, GameMap> = {};
  const children: MapTreeNode[] = [];
  for (let index = 0; index < mapCount; index += 1) {
    const id = `large_map_${String(index + 1).padStart(2, "0")}`;
    maps[id] = createLargeMap(template, id, `대형 맵 ${index + 1}`, width, height, index);
    if (index > 0) children.push({ mapId: id, children: [] });
  }
  project.maps = maps;
  project.startMapId = "large_map_01";
  project.startPos = { x: 1, y: 1 };
  project.mapTree = { mapId: project.startMapId, children };
  return project;
}

function createLargeMap(
  template: GameMap,
  id: string,
  name: string,
  width: number,
  height: number,
  seed: number
): GameMap {
  const lowerTiles = new Array<number>(width * height);
  const upperTiles = new Array<number>(width * height).fill(-1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      lowerTiles[y * width + x] = (x + y + seed) % 17 === 0 ? 4 : 1;
    }
  }
  return {
    ...structuredClone(template),
    id,
    name,
    width,
    height,
    lowerTiles,
    upperTiles,
    events: [],
  };
}
