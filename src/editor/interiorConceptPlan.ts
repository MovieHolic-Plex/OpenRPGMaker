/** Every editor-created interior resolves its contents from the project's concept bundles.
 * Geometry supplied by the caller remains useful for individual rooms; linked houses
 * use the facility's authored layout as well. The tile pipeline itself stays reusable.
 */
import {
  conceptOverlayFor, conceptPlaceFloorTile, conceptPlaceRole,
  layoutConceptFacility, liveBundlesForTileset, resolveConceptFacility, thingsForPlace,
  type ConceptOverlayRoom, type ResolvedConceptFacility,
} from "./conceptBundleResolve";
import { plansStructurallyEqual } from "./conceptFacilityScore";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { interiorVocabFromTileset, type InteriorRoomPlan, type RoomSpec } from "./interiorRoomPipeline";
import { ConceptPlanError, facilityAsPlan, parseConceptPlan } from "./conceptPlan";
import { interiorObjectById } from "./interiorObjectCatalog";
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


/**
 * 해석된 시설이 코드 초안 그대로인가 — 초안은 최종 도면이 아니라 씨앗이다(2026-09-12).
 * 저작된 꾸러미(사용자가 DB에서 구조를 고친 값)만 집 실내의 도면 정본이 된다. 초안 그대로면
 * createHouseInteriorMap 이 절차 도면(scale × program)으로 실루엣을 내고, 초안의 장소·물건은
 * 방 테마에 씨앗처럼 묶여 들어간다(bindInteriorConceptPlan).
 * place_concept 가 한 번이라도 돌면 초안 복제본이 scratch 에 얹히므로(ensureConceptBundles)
 * 참조가 아니라 구조로 비교한다 — 구조가 같으면 여전히 초안이다.
 */
export function isCodeDraftFacility(resolved: ResolvedConceptFacility): boolean {
  const templateBundle = CONCEPT_FACILITY_TEMPLATES.find((bundle) => bundle.id === resolved.bundle.id);
  const templateFacility = templateBundle?.facilities.find((facility) => facility.id === resolved.facility.id);
  if (!templateBundle || !templateFacility) return false;
  const template = facilityAsPlan(templateBundle, templateFacility);
  const current = facilityAsPlan(resolved.bundle, resolved.facility);
  return (template.layout ?? "row") === (current.layout ?? "row")
    && (template.wall ?? "cream") === (current.wall ?? "cream")
    && plansStructurallyEqual(template, current);
}

/**
 * 호출자가 설계한 연결 실내(place_concept plan 모양)를 꾸러미로 푼다.
 * 생략하면 undefined 를 돌려주고 경고를 남긴다 — 꾸러미 템플릿을 그대로 찍으면 모든 집의 실내가
 * 같은 도면이 된다(2026-09-11 사용자 지적: "도면 기반으로 똑같은 것만 찍어낸다").
 * 물건 어휘는 프로젝트의 실내 타일셋이 정본이다(place_concept 과 같은 규칙).
 */
export function resolveDesignedInterior(
  project: Project,
  raw: unknown,
  options: { readonly label: string; readonly warnings: string[] },
): ResolvedConceptFacility | undefined {
  if (raw === undefined) {
    options.warnings.push(
      "실내를 설계하지 않아 개념 꾸러미 템플릿을 그대로 시공했다 — 모든 집의 실내가 같은 도면이 된다. "
      + "interiorPlan(장소 수·크기·구역·층·물건)을 넘겨 요청에 맞게 설계하라.",
    );
    return undefined;
  }
  const tilesetId = TILESET;
  const vocab = interiorVocabFromTileset(project.tilesets[tilesetId]);
  try {
    const parsed = parseConceptPlan(raw, {
      facilityId: "designed",
      facilityLabel: options.label,
      bundleId: "designed",
      resolveObject: (objectId) => vocab.objectsById.get(objectId) ?? interiorObjectById(objectId),
    });
    return { tilesetId, bundle: parsed.bundle, facility: parsed.facility };
  } catch (error) {
    if (error instanceof ConceptPlanError) throw new ToolError(error.message, { code: error.code });
    throw error;
  }
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
