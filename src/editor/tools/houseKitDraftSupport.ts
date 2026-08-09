import { appendToTree } from "@/project/mapTree";
import { isPassable, tilePassability } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { ToolError } from "./types";

export function uniqueProjectId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

export function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

export function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}

export function ensureDoorFrontPassable(
  project: Project,
  map: GameMap,
  door: { readonly x: number; readonly y: number },
): string | undefined {
  const front = { x: door.x, y: door.y + 1 };
  if (front.x < 0 || front.y < 0 || front.x >= map.width || front.y >= map.height) {
    throw new ToolError("문 앞이 맵 밖입니다 — 남쪽에 여유를 두세요", {
      code: "house-door-front-out-of-bounds",
      mapId: map.id,
      x: front.x,
      y: front.y,
    });
  }
  if (isPassable(project, map, front.x, front.y)) return undefined;
  const index = front.y * map.width + front.x;
  map.lowerTiles[index] = chooseDoorFrontGroundTile(project, map, front);
  map.upperTiles[index] = TILE.EMPTY;
  clearTileStacksAt(map, index);
  return `문 앞 (${front.x},${front.y}) 통행 확보 — 지면으로 정리`;
}

export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function chooseDoorFrontGroundTile(project: Project, map: GameMap, center: { readonly x: number; readonly y: number }): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return TILE.GRASS;
  const counts = new Map<number, number>();
  for (let y = center.y - 2; y <= center.y + 2; y += 1) {
    for (let x = center.x - 2; x <= center.x + 2; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const tile = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
      if (tile === TILE.EMPTY) continue;
      const passability = tilePassability(tileset, tile, TILE.EMPTY);
      if (!passability.up && !passability.down && !passability.left && !passability.right) continue;
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
  }
  let bestTile: number = TILE.GRASS;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count <= bestCount) continue;
    bestTile = tile;
    bestCount = count;
  }
  return bestTile;
}

function clearTileStacksAt(map: GameMap, index: number): void {
  if (map.lowerTileStacks?.[index]) {
    delete map.lowerTileStacks[index];
    if (Object.keys(map.lowerTileStacks).length === 0) delete map.lowerTileStacks;
  }
  if (map.upperTileStacks?.[index]) {
    delete map.upperTileStacks[index];
    if (Object.keys(map.upperTileStacks).length === 0) delete map.upperTileStacks;
  }
}
