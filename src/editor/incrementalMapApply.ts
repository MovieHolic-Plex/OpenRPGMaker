import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { jsonEqual } from "@/util/structuralJson";
import type { ProjectChangeCell } from "@/project/store";

/** 이보다 많은 칸은 화면 창 전체 재렌더가 더 싸다. */
const MAX_INCREMENTAL_CELLS = 2048;
const HEAVY_KEYS = new Set(["tilesets", "database", "assets"]);
const CELL_FIELDS = new Set(["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits", "lowerTileStacks", "upperTileStacks"]);

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
    // 체크포인트는 NDJSON 에서 다시 읽은 문서라 무거운 키(타일셋·DB·자산)만 스토어 객체를 물려받고 나머지는 새 객체다.
    // 참조만 보면 내용이 같은 meta 하나로도 전체 재렌더(100×100 맵에서 체크포인트마다 약 1.2s)로 떨어졌다(2026-09-28 실측).
    // 참조가 다를 때만 내용을 대조한다. 무거운 키는 대조하지 않는다 — 바뀌었으면 전체 재렌더가 맞고, 수십 MB 대조가 재렌더보다 비싸다.
    if (beforeRecord[key] === afterRecord[key]) continue;
    if (HEAVY_KEYS.has(key) || !jsonEqual(beforeRecord[key], afterRecord[key])) return null;
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
  // 칸 목록은 한 맵만 싣는다. 다른 맵은 새 객체여도(체크포인트 재구성) 내용이 같아야 한다 — 다르면 그 맵 구독자가 알림을 놓친다.
  for (const id of dirty) {
    if (id !== mapId && !jsonEqual(before.maps[id], after.maps[id])) return null;
  }
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
      if (layerTileAt(before, 1, left) !== layerTileAt(after, 1, right)
        || layerTileAt(before, 2, left) !== layerTileAt(after, 2, right)
        || shadowAt(before, left) !== shadowAt(after, right)
        || stackAt(before.lowerTileStacks, left) !== stackAt(after.lowerTileStacks, right)) {
        cells.push({ x, y, layer: "lower" });
      }
      if (layerTileAt(before, 3, left) !== layerTileAt(after, 3, right)
        || layerTileAt(before, 4, left) !== layerTileAt(after, 4, right)
        || stackAt(before.upperTileStacks, left) !== stackAt(after.upperTileStacks, right)) {
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

/** Direct tools may clone unchanged inputs. Prove a single tile-only map edit before
 * using replace's single-map descriptor; event/metadata/global edits retain full notification.
 * Share equivalent inputs only in a comparison view, never mutate the authored result.
 */
export function toolMapCellApply(before: Project, after: Project): ReturnType<typeof mapCellApply> {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key !== "maps" && !jsonEqual(Reflect.get(before, key), Reflect.get(after, key))) return null;
  }
  let changedMapId: string | null = null;
  for (const id of new Set([...Object.keys(before.maps), ...Object.keys(after.maps)])) {
    const left = before.maps[id];
    const right = after.maps[id];
    if (left === right || jsonEqual(left, right)) continue;
    if (!left || !right || changedMapId !== null) return null;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (!CELL_FIELDS.has(key) && !jsonEqual(Reflect.get(left, key), Reflect.get(right, key))) return null;
    }
    changedMapId = id;
  }
  if (changedMapId === null) return null;
  const left = before.maps[changedMapId]!;
  const right = after.maps[changedMapId]!;
  return mapCellApply(before, {
    ...before,
    maps: { ...before.maps, [changedMapId]: { ...right, events: left.events } },
  }, changedMapId);
}
