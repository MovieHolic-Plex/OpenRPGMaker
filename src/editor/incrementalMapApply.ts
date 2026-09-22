import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import type { ProjectChangeCell } from "@/project/store";

/** 이보다 많은 칸은 화면 창 전체 재렌더가 더 싸다. */
const MAX_INCREMENTAL_CELLS = 2048;

/**
 * 조수 적용이 지금 맵의 칸만 바꿨으면 그 칸 목록을 돌려준다.
 * 맵 크기·타일셋·맵 추가/삭제·맵 밖의 참조가 바뀌면 null — 그때는 전체 재렌더가 맞다.
 */
export function mapCellApply(
  before: Project,
  after: Project,
  preferredMapId: string | null,
): { readonly mapId: MapId; readonly cells: readonly ProjectChangeCell[] } | null {
  const beforeRecord = before as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])) {
    if (key === "maps") continue;
    if (beforeRecord[key] !== afterRecord[key]) return null;
  }
  const dirty: string[] = [];
  for (const id of new Set([...Object.keys(before.maps), ...Object.keys(after.maps)])) {
    const left = before.maps[id];
    const right = after.maps[id];
    if (left === right) continue;
    if (!left || !right) return null;
    if (left.width !== right.width || left.height !== right.height || left.tilesetId !== right.tilesetId || left.tileSize !== right.tileSize) return null;
    dirty.push(id);
  }
  if (dirty.length === 0) return null;
  const mapId = (preferredMapId && dirty.includes(preferredMapId) ? preferredMapId : dirty[0]) as MapId;
  const cells = changedCells(before.maps[mapId] as GameMap, after.maps[mapId] as GameMap);
  if (cells.length === 0 || cells.length > MAX_INCREMENTAL_CELLS) return null;
  return { mapId, cells };
}

function changedCells(before: GameMap, after: GameMap): ProjectChangeCell[] {
  const cells: ProjectChangeCell[] = [];
  const width = Math.min(before.width, after.width);
  const height = Math.min(before.height, after.height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = y * before.width + x;
      const right = y * after.width + x;
      if (before.lowerTiles[left] !== after.lowerTiles[right] || stackAt(before.lowerTileStacks, left) !== stackAt(after.lowerTileStacks, right)) {
        cells.push({ x, y, layer: "lower" });
      }
      if (before.upperTiles?.[left] !== after.upperTiles?.[right] || stackAt(before.upperTileStacks, left) !== stackAt(after.upperTileStacks, right)) {
        cells.push({ x, y, layer: "upper" });
      }
    }
  }
  const beforeEvents = new Map(before.events.map((event) => [event.id, event]));
  const afterEvents = new Map(after.events.map((event) => [event.id, event]));
  for (const id of new Set([...beforeEvents.keys(), ...afterEvents.keys()])) {
    const left = beforeEvents.get(id);
    const right = afterEvents.get(id);
    if (left === right) continue;
    if (left) cells.push({ x: left.x, y: left.y, layer: "event" });
    if (right && (!left || left.x !== right.x || left.y !== right.y || eventBodyChanged(left, right))) {
      cells.push({ x: right.x, y: right.y, layer: "event" });
    }
  }
  return cells;
}

function stackAt(stacks: Record<number, number[]> | undefined, index: number): string {
  const stack = stacks?.[index];
  return stack ? stack.join(",") : "";
}

function eventBodyChanged(left: GameEvent, right: GameEvent): boolean {
  return left.name !== right.name || left.pages !== right.pages || left.commands !== right.commands;
}
