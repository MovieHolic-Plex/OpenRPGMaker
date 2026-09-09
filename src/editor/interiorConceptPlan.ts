/** Every editor-created interior resolves its contents from the project's concept bundles.
 * Geometry supplied by the caller remains useful for individual rooms; linked houses
 * use the facility's authored layout as well. The tile pipeline itself stays reusable.
 */
import {
  conceptOverlayFor, conceptPlaceFloorTile, conceptPlaceRole,
  layoutConceptFacility, liveBundlesForTileset, resolveConceptFacility, thingsForPlace,
  type ConceptOverlayRoom, type ResolvedConceptFacility,
} from "./conceptBundleResolve";
import type { InteriorRoomPlan, RoomSpec } from "./interiorRoomPipeline";
import type { HouseInteriorProgram } from "./houseInteriors";
import type { Project } from "@/project/types";
import { ToolError } from "./tools/types";
import { bindCanonicalInteriorPlan } from "./spatial/legacyInteriorPlan";
import { PLACE_ALIASES } from "./interiorPlaceAliases";

const TILESET = "easyrpg_chipset_interior";
const PROGRAM_FACILITIES: Readonly<Record<HouseInteriorProgram, string>> = {
  dwelling: "house", manor: "house", shop: "shop", inn: "inn",
  workshop: "smithy", study: "library",
};

export function resolveHouseConcept(project: Project, program: HouseInteriorProgram): ResolvedConceptFacility {
  // Prefer an authored facility for the exact program (e.g. the expanded manor).
  // Older projects that only have a house keep their existing house composition.
  const facility = resolveConceptFacility(project, program, TILESET)
    ?? resolveConceptFacility(project, PROGRAM_FACILITIES[program], TILESET);
  if (!facility) throw new ToolError(
    `집 내부의 개념 꾸러미(${PROGRAM_FACILITIES[program]})가 없습니다. get_concept_facility로 현재 꾸러미를 읽고 place_concept(plan)으로 실내를 설계하세요.`,
    { code: "concept-not-found" },
  );
  return facility;
}

export function conceptHouseFloorPlan(
  resolved: ResolvedConceptFacility,
  input: { mapId: string; name: string; seed: number; level: number },
): InteriorRoomPlan {
  const { bundle, facility, tilesetId } = resolved;
  const authoredLevels = new Set(bundle.places.filter(p => facility.placeIds.includes(p.id)).map(p => p.level ?? 1));
  // An exterior may request more stories than the template. Reuse its authored
  // rooms upstairs; deleted places/objects are never resurrected from defaults.
  const level = authoredLevels.has(input.level) ? input.level : authoredLevels.size ? Math.min(...authoredLevels) : 1;
  const layout = layoutConceptFacility(bundle, facility, { level });
  return {
    mapId: input.mapId, name: input.name, seed: input.seed, tilesetId,
    width: layout.width, height: layout.height, door: layout.door,
    wings: layout.rooms.map(({ x, y, w, h }) => ({ x, y, w, h })),
    rooms: layout.rooms, innerDoors: layout.innerDoors,
    theme: layout.rooms[0]?.theme ?? "bedroom",
    wallMaterial: layout.wallMaterial,
    concept: conceptOverlayFor(bundle, facility, layout),
  };
}

/** Called before the engine records the plan, so reload/evaluation sees the same contents. */
export function bindInteriorConceptPlan(plan: InteriorRoomPlan, project: Project): InteriorRoomPlan {
  const tilesetId = plan.tilesetId ?? TILESET;
  if (tilesetId !== TILESET) throw new ToolError(
    "개념 실내 시공은 실내 칩셋에서만 지원합니다. get_concept_facility로 지원되는 구성을 확인하세요.",
    { code: "invalid-tileset" },
  );
  if (project.spatialAuthoring !== undefined && !plan.concept) return bindCanonicalInteriorPlan(plan, project);
  const bundles = liveBundlesForTileset(project, tilesetId);
  if (!bundles.length) throw new ToolError(
    "개념 꾸러미가 비어 있습니다. 사용할 장소·물건을 개념 꾸러미에 등록한 뒤 실내를 설계하세요.",
    { code: "concept-bundle-empty", mapId: plan.mapId },
  );
  if (plan.concept) {
    if (!plan.rooms?.length || plan.rooms.some(room => !plan.concept!.rooms[room.id])) {
      throw new ToolError("모든 방에 개념 장소·물건 구성이 필요합니다. get_concept_facility를 읽고 place_concept(plan)으로 설계하세요.", { code: "concept-plan-incomplete", mapId: plan.mapId });
    }
    return plan;
  }
  const candidates = bundles.flatMap(bundle => bundle.places
    .filter(place => bundle.facilities.some(f => f.placeIds.includes(place.id)))
    .map(place => ({ bundle, place })));
  const sourceRooms: readonly RoomSpec[] = plan.rooms?.length ? plan.rooms : plan.wings.map((wing, i) => ({
    ...wing, id: `room_${i + 1}`, theme: plan.theme,
  }));
  const overlay: Record<string, ConceptOverlayRoom> = {};
  const rooms = sourceRooms.map(room => {
    const query = room.theme ?? plan.theme;
    const alias = PLACE_ALIASES[query];
    const match = (alias && candidates.find(c => c.bundle.id === alias[0] && c.place.id === alias[1]))
      || candidates.find(c => `${c.bundle.id}/${c.place.id}` === query || c.place.id === query || c.place.label === query);
    if (!match) throw new ToolError(
      `개념 꾸러미에서 장소 "${query}"를 찾지 못했습니다. get_concept_facility로 장소·물건을 읽고 새 구성을 place_concept(plan)에 넘기세요.`,
      { code: bundles.length ? "concept-place-not-found" : "concept-bundle-empty", mapId: plan.mapId },
    );
    const { bundle, place } = match;
    overlay[room.id] = {
      placeId: place.id, placeLabel: place.label, role: conceptPlaceRole(place),
      things: thingsForPlace(bundle, place.id).map(thing => ({
        thingId: thing.id, objectId: thing.objectId, label: thing.label,
        chips: [...thing.chips], required: Boolean(thing.required),
      })),
    };
    return { ...room, floorTile: room.floorTile ?? plan.floorTile ?? conceptPlaceFloorTile(place) };
  });
  return {
    ...plan, rooms,
    concept: { bundleId: "composed", facilityId: "composed", facilityLabel: plan.name, rooms: overlay },
  };
}
