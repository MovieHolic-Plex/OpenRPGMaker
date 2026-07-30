import { newCommand } from "@/editor/eventCommandFactory";
import { isPassable } from "@/project/collision";
import type { Command, GameMap, MapId, Project } from "@/project/types";

export type EventBeginnerTemplateId =
  | "talking-npc"
  | "treasure-chest"
  | "transfer"
  | "shop"
  | "battle";

export type EventBeginnerTemplateResult =
  | { readonly command: Command; readonly unavailableReason?: never }
  | { readonly command?: never; readonly unavailableReason: string };

function newCommandOfKind<K extends Command["kind"]>(kind: K): Extract<Command, { kind: K }> {
  return newCommand(kind) as Extract<Command, { kind: K }>;
}

/**
 * Creates a usable starter command from records that exist in the current
 * project. A template never invents a map/item/troop id: if the project has no
 * suitable record, the caller gets an explicit reason and must not insert a
 * broken command.
 */
export function buildEventBeginnerTemplate(
  project: Project,
  mapId: MapId,
  eventId: string,
  templateId: EventBeginnerTemplateId,
): EventBeginnerTemplateResult {
  switch (templateId) {
    case "talking-npc":
      return { command: { kind: "text", body: "안녕하세요." } };
    case "treasure-chest":
      return { command: { kind: "openChest", chestId: `storage_${eventId}` } };
    case "transfer": {
      const destination = transferDestination(project, mapId);
      if (!destination) {
        return { unavailableReason: "통행 가능한 맵 칸이 없습니다. 맵을 먼저 만든 뒤 다시 시도하세요." };
      }
      return {
        command: {
          ...newCommandOfKind("transfer"),
          mapId: destination.mapId,
          x: destination.x,
          y: destination.y,
        },
      };
    }
    case "shop": {
      const itemIds = project.database.items.map((item) => item.id).filter(Boolean).slice(0, 8);
      if (itemIds.length === 0) {
        return { unavailableReason: "상점에 넣을 아이템이 없습니다. 데이터베이스에서 아이템을 먼저 추가하세요." };
      }
      return { command: { ...newCommandOfKind("shop"), itemIds } };
    }
    case "battle": {
      const configured = project.system.initialTroopId;
      const troopId = project.database.troops.some((troop) => troop.id === configured)
        ? configured
        : project.database.troops[0]?.id;
      if (!troopId) {
        return { unavailableReason: "시작할 적 그룹이 없습니다. 데이터베이스에서 적 그룹을 먼저 추가하세요." };
      }
      return { command: { ...newCommandOfKind("battleProcessing"), troopId } };
    }
  }
}

function transferDestination(
  project: Project,
  currentMapId: MapId,
): { readonly mapId: MapId; readonly x: number; readonly y: number } | null {
  const maps = Object.values(project.maps);
  const candidates = [
    ...maps.filter((map) => map.id !== currentMapId),
    ...maps.filter((map) => map.id === currentMapId),
  ];
  for (const map of candidates) {
    const preferred = map.id === project.startMapId
      ? project.startPos
      : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const cell = nearestPassableCell(project, map, preferred.x, preferred.y);
    if (cell) return { mapId: map.id, ...cell };
  }
  return null;
}

function nearestPassableCell(
  project: Project,
  map: GameMap,
  preferredX: number,
  preferredY: number,
): { readonly x: number; readonly y: number } | null {
  const originX = clamp(Math.trunc(preferredX), 0, map.width - 1);
  const originY = clamp(Math.trunc(preferredY), 0, map.height - 1);
  const usable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y);
  if (usable(originX, originY)) return { x: originX, y: originY };

  const maxRadius = Math.max(map.width, map.height);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (usable(x, y)) return { x, y };
      }
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
