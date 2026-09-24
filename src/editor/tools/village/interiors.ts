// editor/tools/village/interiors.ts
// 집 실내 — 내부 맵 생성·등록, 문 이벤트 연결, 맵 트리 배선.

import { createHouseDoorEvent, createHouseDoorStepEvent, createHouseInteriorMap, registerInteriorMaps, stampHouseDoorBackground } from "@/editor/houseInteriors";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { appendToTree, findTreeNode, removeFromTree } from "@/project/mapTree";
import type { GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import {
  uniqueId,
  type BuiltHouse,
  type NpcText,
  type VillageHouseInteriorRef,
} from "./constants";
import { npcText } from "./npcs";

/** 날개 합집합 칸 수. 카탈로그에 없는 id(커스텀 형태)는 bbox 면적. */
export function exteriorFootprintArea(templateId: string, bbox: { w: number; h: number }): number {
  const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === templateId);
  if (!def) return bbox.w * bbox.h;
  const cells = new Set<string>();
  for (const wing of def.wings) {
    for (let y = 0; y < wing.h; y += 1) {
      for (let x = 0; x < wing.w; x += 1) {
        cells.add(`${wing.x + x},${wing.y + y}`);
      }
    }
  }
  return cells.size;
}

/** 마을 하네스가 만든 문 이벤트 id — seed 는 숫자라 author_house 의 `map id` 시작 id와 갈라진다. */
const VILLAGE_DOOR_EVENT_ID = /^ev_house_door_\d+_/;
/** 마을 하네스 실내 맵 id — `map_house_interior_<숫자 seed>_<map>_<n>`. author_house 는 map id 로 시작한다. */
const VILLAGE_INTERIOR_MAP_ID = /^map_house_interior_\d+_/;

/** 명령 트리에서 transfer.destination 맵 id를 모은다(문 이벤트의 pages·commands 재귀). */
function collectTransferTargets(value: unknown, out: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) collectTransferTargets(entry, out);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
  for (const entry of Object.values(record)) collectTransferTargets(entry, out);
}

/**
 * author_village 재실행이 이전 시공의 실내를 고아로 남긴다(2026-09-24 연애 도그푸딩 romance-r2:
 * `uniqueId` 가 새 interior id(`_2` 접미사)를 뽑고 문은 새 interior 를 가리키는데 옛 interior
 * 맵·트리는 그대로 → unreachable-map 막힘 3건). 시공 전에 이 맵이 소유한 마을 실내를 정리한다.
 * 소유 판정 두 갈래: (1) 지금 문이 transfer 로 가리키는 interior, (2) 이 맵의 트리 자식 중
 * 마을 실내 id 패턴(`_숫자 seed_`). author_house 실내는 패턴이 달라 건드리지 않는다.
 */
function purgeStaleVillageInteriors(draft: Project, map: GameMap): number {
  const staleDoorIds = new Set(
    map.events
      .filter((event) => VILLAGE_DOOR_EVENT_ID.test(event.id))
      .flatMap((event) => [event.id, `${event.id}_step`]),
  );
  const staleInteriors = new Set<string>();
  for (const event of map.events) {
    if (staleDoorIds.has(event.id)) collectTransferTargets(event, staleInteriors);
  }
  const mapNode = findTreeNode(draft.mapTree, map.id);
  if (mapNode) {
    for (const child of mapNode.children) {
      if (VILLAGE_INTERIOR_MAP_ID.test(child.mapId)) staleInteriors.add(child.mapId);
    }
  }
  if (staleDoorIds.size === 0 && staleInteriors.size === 0) return 0;
  if (staleDoorIds.size > 0) {
    map.events = map.events.filter((event) => !staleDoorIds.has(event.id));
  }
  let removed = 0;
  for (const interiorId of staleInteriors) {
    // 층 맵(`${id}_f2` …)은 interior 의 tree child라 removeFromTree 가 subtree째 뽑는다.
    for (const id of Object.keys(draft.maps)) {
      if (id === interiorId || id.startsWith(`${interiorId}_f`)) {
        delete draft.maps[id];
        removed += 1;
      }
    }
    if (removeFromTree(draft.mapTree, interiorId as MapId)) removed += 1;
  }
  return removed;
}

export function createVillageHouseInteriors(
  draft: Project,
  map: GameMap,
  houses: readonly BuiltHouse[],
  overrides: readonly Partial<NpcText>[],
  seed: number,
  warnings: string[] = [],
): VillageHouseInteriorRef[] {
  const refs: VillageHouseInteriorRef[] = [];
  const purged = purgeStaleVillageInteriors(draft, map);
  if (purged > 0) warnings.push(`재시공: 이전 마을 실내 정리 ${purged}건(도달 불가로 남기지 않기)`);
  const mapPart = map.id.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index] as BuiltHouse;
    // Prefer explicit house plan owner; fall back to NPC slot name (legacy heuristic).
    const owner = house.ownerName?.trim() || npcText(index, overrides).name;
    const base = `${seed >>> 0}_${mapPart}_${index + 1}`;
    let interiorMapId = uniqueId(draft, "map_house_interior", base);
    const doorEventId = uniqueId(draft, "ev_house_door", base);
    const exitEventId = uniqueId(draft, "ev_house_exit", base);
    const footprintArea = exteriorFootprintArea(house.templateId, house.bbox);
    const interiorSeed = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    const interior = createHouseInteriorMap({
      project: draft,
      id: interiorMapId,
      name: `${owner}의 집 내부`,
      returnMapId: map.id,
      returnX: house.front.x,
      returnY: house.front.y,
      exitEventId,
      seed: interiorSeed,
      exterior: {
        stories: house.stories,
        kitId: house.kitId,
        footprintArea,
        templateId: house.templateId,
        ownerName: owner,
        ...(house.program ? { program: house.program } : {}),
      },
    });
    interiorMapId = interior.map.id;
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
    stampHouseDoorBackground(map, house.doorAt);
    upsertEvent(map.events, createHouseDoorEvent({
      eventId: doorEventId,
      x: house.doorAt.x,
      y: house.doorAt.y,
      interiorMapId,
      kitId: house.kitId,
      name: `${owner}의 집 문`,
      entryX: interior.entry.x,
      entryY: interior.entry.y,
      seed: interiorSeed,
    }));
    // 열린 문 기본값: 문 앞 통행 칸에 밟으면 열리는 발판 — 문 칸은 벽이라 밟히지 않는다.
    // 문 앞이 맵 밖이면 발판을 생략한다(문 스프라이트만 남는다).
    if (house.doorAt.y + 1 < map.height) {
      upsertEvent(map.events, createHouseDoorStepEvent({
        eventId: `${doorEventId}_step`,
        doorEventId,
        x: house.doorAt.x,
        y: house.doorAt.y + 1,
        interiorMapId,
        name: `${owner}의 집 문`,
        entryX: interior.entry.x,
        entryY: interior.entry.y,
      }));
    }
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
      designSource: interior.interiorSource,
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
