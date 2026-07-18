// editor/tools/village/interiors.ts
// 집 실내 — 내부 맵 생성·등록, 문 이벤트 연결, 맵 트리 배선.

import { createHouseDoorEvent, createHouseInteriorMap, registerInteriorMaps } from "@/editor/houseInteriors";
import { appendToTree } from "@/editor/mapTreeActions";
import type { GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import {
  uniqueId,
  type BuiltHouse,
  type NpcText,
  type VillageHouseInteriorRef,
} from "./constants";
import { npcText } from "./npcs";

export function createVillageHouseInteriors(
  draft: Project,
  map: GameMap,
  houses: readonly BuiltHouse[],
  overrides: readonly Partial<NpcText>[],
  seed: number,
  warnings: string[] = [],
): VillageHouseInteriorRef[] {
  const refs: VillageHouseInteriorRef[] = [];
  const mapPart = map.id.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index] as BuiltHouse;
    // Prefer explicit house plan owner; fall back to NPC slot name (legacy heuristic).
    const owner = house.ownerName?.trim() || npcText(index, overrides).name;
    const base = `${seed >>> 0}_${mapPart}_${index + 1}`;
    const interiorMapId = uniqueId(draft, "map_house_interior", base);
    const doorEventId = uniqueId(draft, "ev_house_door", base);
    const exitEventId = uniqueId(draft, "ev_house_exit", base);
    const footprintArea = house.bbox.w * house.bbox.h;
    const interior = createHouseInteriorMap({
      id: interiorMapId,
      name: `${owner}의 집 내부`,
      returnMapId: map.id,
      returnX: house.front.x,
      returnY: house.front.y,
      exitEventId,
      seed: (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0,
      exterior: {
        stories: house.stories,
        kitId: house.kitId,
        footprintArea,
        templateId: house.templateId,
        ownerName: owner,
        ...(house.program ? { program: house.program } : {}),
      },
    });
    if (interior.warnings?.length) {
      warnings.push(`내부(${owner}): ${interior.warnings.slice(0, 4).join("; ")}`);
    }
    registerInteriorMaps(draft, interior);
    appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
    // 서브맵 체인: 1F → 2F → 3F
    let parentFloorId = interiorMapId;
    for (const floor of interior.floors) {
      if (floor.floor <= 1) continue;
      appendTreeChildOnce(draft.mapTree, floor.mapId, parentFloorId);
      parentFloorId = floor.mapId;
    }
    upsertEvent(map.events, createHouseDoorEvent({
      eventId: doorEventId,
      x: house.doorAt.x,
      y: house.doorAt.y,
      interiorMapId,
      kitId: house.kitId,
      name: `${owner}의 집 문`,
      entryX: interior.entry.x,
      entryY: interior.entry.y,
    }));
    refs.push({
      houseIndex: index,
      ownerName: owner,
      interiorMapId,
      doorEventId,
      exitEventId,
      entry: interior.entry,
      exit: interior.exit,
      returnTo: house.front,
      scale: interior.scale,
      program: interior.program,
      stories: interior.stories,
      ...(interior.upperMapId ? { upperMapId: interior.upperMapId } : {}),
      floorMapIds: interior.floors.map((f) => f.mapId),
    });
  }
  return refs;
}

function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}
