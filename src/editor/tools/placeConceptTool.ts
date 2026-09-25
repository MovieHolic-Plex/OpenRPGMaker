import {
  conceptFacilityLevels,
  conceptOverlayFor,
  constructionBundlesForTileset,
  ensureConceptBundles,
  isInteriorConstructionTileset,
  layoutConceptFacility,
  resolveConstructionFacility,
  type ConceptRoomLayout,
  type ResolvedConceptFacility,
} from "@/editor/conceptBundleResolve";
import { innDesignVariants } from "@/editor/conceptInnVariants";
import { facilityDesignVariants } from "@/editor/conceptFacilityVariants";
import {
  ConceptPlanError,
  conceptVocabulary,
  facilityAsPlan,
  missingRequiredFromTemplate,
  parseConceptPlan,
} from "@/editor/conceptPlan";
import { plansStructurallyEqual, scoreConceptFacility } from "@/editor/conceptFacilityScore";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import {
  convertEntranceToDescent,
  findConceptDescent,
  linkConceptTransfers,
  listConceptConnections,
  type ConceptTransferTarget,
} from "@/editor/interiorConceptEvents";
import { INTERIOR_ROOM_TILESET_ID, interiorVocabFromTileset } from "@/editor/interiorRoomPipeline";
import { runRoomPipeline } from "@/editor/roomHarness/engine";
import { INTERIOR_ROOM_KIT } from "@/editor/roomHarness/interiorKit";
import { conceptChipLabel } from "@/project/types/conceptBundle";
import { conceptFacilityTemplateLabels } from "@/project/defaults/conceptFacilityTemplates";
import type { GameMap, Project } from "@/project/types";
import { deterministicRng } from "@/util/rng";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { CONCEPT_PLAN_SCHEMA, REPLACE_EXISTING_SCHEMA } from "./schemaShapes";
import { getCanonicalConcept, placeCanonicalConcept } from "./spatialConceptTools";

const KIT = INTERIOR_ROOM_KIT.kitId;

/**
 * 같은 역할의 대체 물건 — 모델이 템플릿 물건을 베끼지 않고 골라 쓸 재료.
 * 실측(2026-09-11): 초안 19종이 쓰는 물건 47종은 소수(창·상자·선반·탁자…)에 쏠려 있고,
 * 그래서 "무엇을 대신 쓸 수 있는지"를 응답에 실어 변주를 유도한다.
 */
const CONCEPT_VOCABULARY_GROUPS: readonly { readonly role: string; readonly ids: readonly string[] }[] = [
  { role: "잠자리", ids: ["bed_v", "bed_h", "care_bed"] },
  { role: "난방·조리 (3×3 석조 화로는 홀·거실 북벽이나 복도 끝 — 작은 방에 밀어 넣지 않는다)", ids: ["stove", "hearth", "stone_hearth_lit", "stone_hearth_unlit", "flue", "cauldron", "kettle"] },
  { role: "식사·작업대", ids: ["dining_table", "table_long", "table_wood", "table_white", "tea_table", "work_table", "reading_table", "study_desk", "teacher_desk", "counter", "consultation_table", "altar_table", "table_round", "altar_stone"] },
  { role: "수납·적재", ids: ["cabinet", "bookshelf", "shelf_jars", "display", "fruit_shelf", "crate", "barrel", "box", "jars", "grain", "bucket", "ladder", "box_wood", "swordbox_tall"] },
  { role: "좌석", ids: ["table_chairs", "stool", "chair_back", "chair_red", "chair_fallen"] },
  { role: "바닥깔개", ids: ["rug_mat", "rug_red", "rug"] },
  { role: "벽장식·전시", ids: ["window", "window_white", "window_lattice", "glass_pane", "picture", "clock", "mirror", "mirror_grand", "bust", "armor", "armor_leather", "sword_rack", "tavern_sign", "religious", "crystal", "piano", "plant", "curtain_red", "curtain_tail"] },
  { role: "통행·층계", ids: ["stairs", "stairs_small", "stairs_plain", "stairs_horizontal", "stairs_down", "ladder_tall"] },
  { role: "작은 소품", ids: ["vase_flowers", "bottle_set", "jar_stone", "glass_shards", "cauldron", "kettle"] },
];


function seedFromMapId(mapId: string): number {
  return Math.floor(deterministicRng(1, "place_concept", mapId)() * 0x7fffffff);
}

function resolveObjectFor(draft: Project, tilesetId: string) {
  const vocab = interiorVocabFromTileset(draft.tilesets[tilesetId]);
  return (objectId: string) => vocab.objectsById.get(objectId) ?? interiorObjectById(objectId);
}

/** 시공 가능한 시설명 — 꾸러미가 비면 번들 기본값(여관·민가). */
function constructionFacilityLabels(draft: Project, tilesetId: string): readonly string[] {
  return [...new Set(constructionBundlesForTileset(draft, tilesetId).flatMap((bundle) => bundle.facilities.map((facility) => facility.label)))];
}

function parsePlanOrThrow(raw: unknown, options: Parameters<typeof parseConceptPlan>[1]): ReturnType<typeof parseConceptPlan> {
  try {
    return parseConceptPlan(raw, options);
  } catch (error) {
    if (error instanceof ConceptPlanError) throw new ToolError(error.message, { code: error.code });
    throw error;
  }
}

export const PLACE_CONCEPT_TOOL: ToolDefinition = {
  name: "place_concept",
  // 설명의 시설 단어(등록된 초안 + 주막·도서관·성당 별칭)와
  // 「지어줘 · 만들어줘」는 자연어 승격(capabilityEscalation, matchScore ≥ 20) 용이다 — 지우면 승격이 죽는다.
  description:
    "모든 신규 실내·방을 개념 꾸러미로 설계해 시공한다. 침실·주방·작업실 등 일반 방도 이 경로다. 여관 지어줘 · 상점 만들어줘 · 주막 · 도서관 · 성당 · "
    + `${conceptFacilityTemplateLabels().join(" · ")} 처럼 시설명을 부르는 요청에 쓴다. `
    + "순서: get_concept_facility(query) 로 템플릿(사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 고친 장소·물건)과 물건 어휘를 읽고, "
    + "요청(방 수·크기·분위기·층·내용물)에 맞게 고친 plan 을 넘기라. 수식어가 없어도 템플릿을 그대로 복사하지 말고 설계를 다듬어라. "
    + "**plan 은 필수다 — 생략하거나 템플릿을 그대로 복사하면 거부된다(모든 실내가 같은 도면으로 찍힌다).** 사용자가 템플릿 그대로를 명시했을 때만 template:true. "
    + "query 는 시설명(여관·상점·대장간…) 또는 꾸러미 id — 템플릿에 없는 시설도 plan 이 있으면 짓는다. "
    + "장소에 2층 이상이 있으면 층마다 맵(<mapId>_2f)을 짓고 계단으로 잇는다(data.floors). "
    + "방 종류 requiredRoles 로 시설을 합성하지 마라. 새 mapId 가 필요하다. "
    + "기존 실내 맵을 고치는 요청에는 쓰지 마라. "
    + "개념 꾸러미 시설을 요청받으면 야외 집(author_house)을 짓지 말고 이 툴로 새 mapId 실내를 시공한다 — "
    + "create_map 만 하고 멈추지 말 것. "
    + "tilesetId 는 실내 칩셋 또는 tibo_interior_expanded. 꾸러미가 빈 새 프로젝트는 번들 기본값 여관·민가를 템플릿으로 쓴다. "
    + "Tibo 킷(책장·약재장 같은 480번 이후 소품)은 이 도구가 고르지 않는다 — 시공 뒤 list_spatial_designs({kind:\"object\",query}) 의 kit:tibo_interior_expanded/<kitId> 를 stamp_object 로 찍어라. "
    + "canonical(spatialAuthoring 문서가 있는) 프로젝트에서는 계약이 다르다: plan 인자는 거부되고 query 는 canonical 설계를 가리킨다 — "
    + "설계 저작은 list_spatial_designs → get_spatial_design → upsert_spatial_design, 시공은 preview_spatial_build → apply_spatial_build 체인을 쓴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "시설 이름 또는 꾸러미/시설 id. 예: 여관 · 상점 · 대장간",
      },
      mapId: { type: "string", description: "새로 만들 실내 맵 id" },
      name: { type: "string", description: "맵 이름. 생략 시 시설명" },
      tilesetId: {
        type: "string",
        description: "시공 칩셋. easyrpg_chipset_interior(생략 시) 또는 tibo_interior_expanded(0~479칸이 같은 그림 — 벽·바닥·가구 번호 동일)",
      },
      plan: CONCEPT_PLAN_SCHEMA,
      template: {
        type: "boolean",
        description:
          "**사용자가 「템플릿 그대로」를 명시했을 때만** true. 꾸러미 템플릿을 설계 없이 그대로 시공한다(전부 같은 실내가 된다). 설계를 넘기는 정상 경로는 plan 이다.",
      },
      seed: { type: "integer", description: "가구 배치 변주 시드. 생략 시 mapId 에서 파생(같은 mapId 는 같은 배치)" },
      replaceExisting: REPLACE_EXISTING_SCHEMA,
    },
    required: ["query", "mapId"],
  },
  invalidArgsExample: { query: "여관", mapId: "map_inn_1" },
  run(draft, args): ToolExecResult {
    if (draft.spatialAuthoring !== undefined) return placeCanonicalConcept(draft, args);
    const query = String(args.query ?? "").trim();
    const mapId = String(args.mapId ?? "").trim();
    if (!query) throw new ToolError("query 가 비어 있다 — 시설명(여관·상점·대장간)을 넣어라", { code: "invalid-args" });
    if (!mapId) throw new ToolError("mapId 가 비어 있다", { code: "invalid-args" });
    const tilesetId = args.tilesetId !== undefined
      ? String(args.tilesetId).trim()
      : INTERIOR_ROOM_TILESET_ID;
    // Phase 5: 시공 파이프라인의 벽·바닥·가구 타일 번호가 실내 칩셋 번호다. Tibo 확장 시트는 0~479칸이
    // 같은 그림이라 함께 받는다. 다른 칩셋은 꾸러미 저작(구성)까지만 열고 시공은 거부한다.
    if (!isInteriorConstructionTileset(tilesetId)) {
      throw new ToolError(
        `개념 시설 시공은 실내 칩셋(${INTERIOR_ROOM_TILESET_ID} 또는 tibo_interior_expanded)에서만 된다 — "${tilesetId}" 칩셋의 벽·바닥·가구 타일 번호가 없다. ` +
        "꾸러미 저작(장소·물건 구성)은 그 칩셋 탭에서 하고, 시공은 실내 칩셋에서 place_concept 하라.",
        { code: "invalid-tileset" },
      );
    }
    ensureConceptBundles(draft, tilesetId);
    const hasPlan = args.plan !== undefined && args.plan !== null;
    // Phase 5: 실내 칩셋 스코프로만 푼다 — unscoped 폴백을 타면 실외 칩셋의 꾸러미가
    // 실내 타일 번호로 시공되는 누수가 생긴다. 실외 전용 시설명은 concept-not-found가 정직하다.
    // 꾸러미가 비어 있으면(초안 폐기 뒤 새 프로젝트) 번들 기본값 여관·민가를 템플릿으로 읽는다.
    const template = resolveConstructionFacility(draft, query, tilesetId);
    if (!template && !hasPlan) {
      const available = constructionFacilityLabels(draft, tilesetId);
      throw new ToolError(
        `개념 꾸러미에서 "${query}" 시설을 찾지 못했다. 지금 부를 수 있는 시설: ${available.join(" · ") || "없음"}. `
        + "템플릿에 없는 시설은 get_concept_facility 로 어휘를 읽고 plan 을 설계해 넘기라.",
        { code: "concept-not-found" },
      );
    }
    const planWarnings: string[] = [];
    let resolved: ResolvedConceptFacility;
    if (hasPlan) {
      const facilityLabel = String(args.name ?? "").trim() || template?.facility.label || query;
      const parsed = parsePlanOrThrow(args.plan, {
        facilityId: template?.facility.id ?? "planned",
        facilityLabel,
        bundleId: template?.bundle.id ?? "planned",
        resolveObject: resolveObjectFor(draft, template?.tilesetId ?? tilesetId),
      });
      if (template) planWarnings.push(...missingRequiredFromTemplate(template.bundle, template.facility, parsed.bundle));
      resolved = { tilesetId: template?.tilesetId ?? tilesetId, bundle: parsed.bundle, facility: parsed.facility };
    } else if (template) {
      resolved = template;
    } else {
      throw new ToolError(`"${query}" 시설을 풀 수 없다`, { code: "concept-not-found" });
    }
    // 설계가 정본이다 — 템플릿을 그대로 찍으면 모든 실내가 같은 도면이 된다(2026-09-11 사용자 지적:
    // "도면 기반으로 똑같은 것만 찍어낸다"). 생략·복사는 거부하고, 명시적 탈출구(template:true)만 통과시킨다.
    const useTemplate = args.template === true;
    if (!hasPlan && !useTemplate) {
      throw new ToolError(
        `plan 없이 "${query}" 를 시공하면 꾸러미 템플릿이 그대로 찍혀 모든 실내가 같은 도면이 된다 — 이 툴은 설계를 요구한다. `
        + `get_concept_facility(query:"${query}") 로 템플릿·물건 어휘·levers 를 읽고, 장소 수(count)·크기(size)·구역(zone)·층(level)·물건(objectId)을 요청에 맞게 바꿔 plan 으로 넘겨라. `
        + "사용자가 「템플릿 그대로」를 명시했을 때만 template:true 로 시공한다.",
        { code: "concept-plan-required", mapId },
      );
    }
    const templatePlan = template ? facilityAsPlan(template.bundle, template.facility) : undefined;
    const plannedPlan = hasPlan ? facilityAsPlan(resolved.bundle, resolved.facility) : undefined;
    if (hasPlan && !useTemplate && templatePlan && plannedPlan && plansStructurallyEqual(templatePlan, plannedPlan)) {
      throw new ToolError(
        `설계가 "${query}" 템플릿과 구조가 같다 — 이대로면 방금 전 실내와 같은 도면이 또 나온다. `
        + "장소 수·크기·구역·층·물건(objectId) 중 둘 이상을 요청에 맞게 바꿔 다시 넘겨라. "
        + "사용자가 템플릿 그대로를 명시했다면 template:true 로 시공한다.",
        { code: "concept-plan-identical", mapId },
      );
    }
    // Phase 5: plan 경로에서 template이 실외 칩셋이면 시공하지 않는다.
    if (!isInteriorConstructionTileset(resolved.tilesetId)) {
      throw new ToolError(
        `개념 시설 시공은 실내 칩셋(${INTERIOR_ROOM_TILESET_ID} 또는 tibo_interior_expanded)에서만 된다 — "${query}" 시설은 "${resolved.tilesetId}" 칩셋의 꾸러미다.`,
        { code: "invalid-tileset" },
      );
    }
    const name = String(args.name ?? "").trim() || resolved.facility.label;
    // 층: 장소 `level` 이 둘 이상이면 층마다 맵을 짓는다. 1층 = mapId, 위층 = `<mapId>_<n>f`.
    // 한 층이면 종전과 같다(도면 옵션 없이 전부).
    const levels = conceptFacilityLevels(resolved.bundle, resolved.facility);
    const multi = levels.length > 1;
    // 층마다 건물 외곽을 맞춘다: 먼저 각 층의 자연 폭을 재고, 가장 넓은 층의 밴드 폭으로 다시 편다.
    const bandWidth = multi
      ? Math.max(...levels.map((level) => {
          const probe = layoutConceptFacility(resolved.bundle, resolved.facility, { level });
          return Math.max(...probe.rooms.filter((room) => room.role !== "room").map((room) => room.w), 0);
        }))
      : 0;
    const floors = levels.map((level, index) => ({
      level,
      mapId: index === 0 ? mapId : `${mapId}_${level}f`,
      name: index === 0 ? name : `${name} ${level}층`,
      layout: layoutConceptFacility(resolved.bundle, resolved.facility, multi ? { level, minBandWidth: bandWidth } : {}),
    }));
    const seed = args.seed !== undefined ? Math.floor(Number(args.seed)) : seedFromMapId(mapId);
    const results: ToolExecResult[] = [];
    for (const floor of floors) {
      const overlay = conceptOverlayFor(resolved.bundle, resolved.facility, floor.layout);
      results.push(runRoomPipeline(draft, KIT, {
        mapId: floor.mapId,
        name: floor.name,
        width: floor.layout.width,
        height: floor.layout.height,
        theme: floor.layout.rooms.find((room) => room.role === "entrance")?.theme ?? floor.layout.rooms[0]?.theme ?? "storage",
        door: floor.layout.door,
        rooms: floor.layout.rooms.map(({ id, x, y, w, h, theme, floorTile, shape }) => ({
          id, x, y, w, h, theme, ...(shape ? { shape } : {}), ...(floorTile !== undefined ? { floorTile } : {}),
        })),
        innerDoors: [...floor.layout.innerDoors],
        tilesetId: resolved.tilesetId,
        seed,
        replaceExisting: args.replaceExisting,
        ...(floor.layout.wallMaterial ? { wallMaterial: floor.layout.wallMaterial } : {}),
        concept: overlay,
      }));
    }
    const res = results[0]!;
    const layout = floors[0]!.layout;
    const linkWarnings: string[] = [];
    if (multi) {
      // 계단 연결. 아래층 계단(transfer 칩) → 위층 착지(위층 문 자리 바로 북쪽 바닥). 위층 문 자리 → 「계단 내려가기」
      // → 아래층 계단 앞(계단 남쪽 한 칸). 맨 위층의 계단도 아래로 잇는다. 아래층에 계단이 없으면 정문 앞으로 내려온다.
      for (let index = 0; index < floors.length; index += 1) {
        const floor = floors[index]!;
        const map = draft.maps[floor.mapId];
        if (!map) continue;
        const above = floors[index + 1];
        const below = floors[index - 1];
        if (above) {
          linkConceptTransfers(map, floor.layout.door, upperLanding(above.layout, above.mapId, draft.maps[above.mapId]));
        }
        if (below) {
          const belowMap = draft.maps[below.mapId];
          const arrival = belowMap ? stairArrival(belowMap, below.layout, below.mapId) : null;
          const target = arrival ?? { mapId: below.mapId, x: below.layout.door.x, y: below.layout.door.y - 1 };
          if (!arrival) {
            linkWarnings.push(`concept: ${below.level}층에 계단(transfer 칩) 물건이 없다 — ${floor.level}층에서 내려오면 ${below.level}층 정문 앞에 선다`);
          }
          convertEntranceToDescent(map, target, resolved.facility.label);
          if (!above) linkConceptTransfers(map, floor.layout.door, target);
        }
      }
    }
    const used = resolved.facility.placeIds.map((placeId) => {
      const place = resolved.bundle.places.find((entry) => entry.id === placeId);
      const things = resolved.bundle.things.filter((thing) => thing.placeIds.includes(placeId));
      return {
        placeId,
        placeLabel: place?.label ?? placeId,
        ...(place?.level !== undefined && place.level > 1 ? { level: place.level } : {}),
        things: things.map((thing) => ({
          id: thing.id,
          label: thing.label,
          objectId: thing.objectId,
          required: Boolean(thing.required),
          chips: thing.chips.map((chip) => conceptChipLabel(chip)),
        })),
      };
    });
    const connections = floors.flatMap((floor) => {
      const map = draft.maps[floor.mapId];
      return map ? listConceptConnections(map).map((entry) => ({ mapId: floor.mapId, level: floor.level, ...entry })) : [];
    });
    const rooms = floors.flatMap((floor) => floor.layout.rooms.map((room) => ({
      roomId: room.id,
      ...(room.shape ? { shape: room.shape } : {}),
      placeId: room.placeId,
      role: room.role,
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
      ...(room.floorTile !== undefined ? { floorTile: room.floorTile } : {}),
      ...(multi ? { level: floor.level, mapId: floor.mapId } : {}),
    })));
    // 층이 둘 이상이면 시공 중 나온 「연결 대상이 없다」 경고는 위에서 이었으므로 뺀다.
    const mergedWarnings = [
      ...planWarnings,
      ...results.flatMap((entry) => entry.warnings ?? []).filter((line) => !multi || !line.includes("맵 연결 대상이 없다")),
    ];
    const roomCount = floors.reduce((sum, floor) => sum + floor.layout.rooms.length, 0);
    const floorNote = multi ? `, ${floors.slice(1).map((floor) => `${floor.level}층 ${floor.mapId}`).join(" · ")}` : "";
    const builtMap = draft.maps[mapId];
    const overlay = conceptOverlayFor(resolved.bundle, resolved.facility, layout);
    // templatePlan·plannedPlan 은 게이트에서 이미 계산했다(위). 여기서는 탈출구 사용 여부만 기록한다.
    const designNote = useTemplate
      ? "template:true 로 꾸러미 템플릿을 그대로 시공했다 — 이 실내는 설계된 도면이 아니다. 요청에 맞추려면 plan 을 넘겨라."
      : undefined;
    const review = builtMap
      ? scoreConceptFacility({
          map: builtMap,
          rooms: rooms.filter((room) => room.level === undefined || room.level === floors[0]!.level),
          door: layout.door,
          warnings: [...mergedWarnings, ...linkWarnings],
          levels,
          overlay,
          template: templatePlan,
          planned: plannedPlan,
        })
      : undefined;
    return {
      ...res,
      warnings: [...mergedWarnings, ...linkWarnings],
      summary: `${resolved.facility.label} 개념 꾸러미로 ${mapId} 시공 — 방 ${roomCount}개, 정문 (${layout.door.x},${layout.door.y})${floorNote}`,
      data: {
        ...(res.data as object),
        query,
        bundleId: resolved.bundle.id,
        facilityId: resolved.facility.id,
        facilityLabel: resolved.facility.label,
        tilesetId: resolved.tilesetId,
        planned: hasPlan,
        designSource: hasPlan ? "planned" : "template",
        seed,
        used,
        rooms,
        floors: floors.map((floor) => ({ level: floor.level, mapId: floor.mapId, name: floor.name })),
        wallMaterial: layout.wallMaterial ?? "cream",
        door: layout.door,
        connections,
        ...(review ? { review } : {}),
        ...(designNote ? { designNote } : {}),
      },
    };
  },
};

/** 위층 착지 — 위층 문 자리 바로 북쪽(문 밴드 안 바닥). 문 자리엔 「계단 내려가기」 이벤트가 선다. */
function upperLanding(layout: ConceptRoomLayout, mapId: string, map?: GameMap): ConceptTransferTarget {
  const stairs = map ? findConceptDescent(map) : undefined;
  if (stairs) return { mapId, x: stairs.x, y: stairs.y + 1 };
  return { mapId, x: layout.door.x, y: layout.door.y - 1 };
}

export const GET_CONCEPT_FACILITY_TOOL: ToolDefinition = {
  name: "get_concept_facility",
  description:
    "모든 신규 실내(일반 방·시설)를 지으려면 이것을 먼저 부른다. 시설(꾸러미가 빈 새 프로젝트는 번들 기본값 여관·민가)의 "
    + "템플릿(사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 정해 둔 장소·물건)과 이 타일셋에서 쓸 수 있는 물건 어휘(vocabulary)를 돌려준다. "
    + "이 응답의 plan 을 요청에 맞게 고쳐 place_concept({query, mapId, plan}) 에 넘기라 — 그래야 장소 수·크기·내용물이 다른 시설이 생긴다. "
    + "query가 없거나 미등록 시설이면 sources에 현재 꾸러미의 장소·물건 구성을 돌려준다. 이를 조합해 새 실내 plan을 설계하라. 읽기 전용 — 맵을 건들지 않는다. "
    + "canonical(spatialAuthoring) 프로젝트에서는 꾸러미 대신 canonical 설계와 쓸 체인(tools 필드)을 돌려준다 — 그 경우 plan 흐름이 아니라 spatial_* 도구를 쓴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "시설 이름 또는 id. 예: 여관 · 상점 · 대장간" },
      tilesetId: { type: "string", description: "생략 시 실내 칩셋 easyrpg_chipset_interior. tibo_interior_expanded 도 같은 꾸러미·어휘를 돌려준다" },
    },
  },
  invalidArgsExample: { query: "여관" },
  run(draft, args): ToolExecResult {
    if (draft.spatialAuthoring !== undefined) return getCanonicalConcept(draft, args);
    const tilesetId = args.tilesetId !== undefined ? String(args.tilesetId).trim() : INTERIOR_ROOM_TILESET_ID;
    // Phase 5: 읽기 도구는 쓰지 않는다 — 실외 칩셋의 ensure 빈 배열 쓰기를 건너뛴다.
    // liveBundlesForTileset이 미시드 실외를 []로 읽으므로 동작은 같다.
    const query = String(args.query ?? "").trim();
    const vocabulary = conceptVocabulary(interiorVocabFromTileset(draft.tilesets[tilesetId]), INTERIOR_OBJECT_CATALOG);
    const facilities = constructionFacilityLabels(draft, tilesetId);
    // Phase 5: 요청 칩셋 스코프로만 푼다 — 실외 시설명을 실내 템플릿으로 둔갑시키지 않는다.
    const resolved = query
      ? resolveConstructionFacility(draft, query, tilesetId)
      : undefined;
    if (!resolved) {
      const sources = constructionBundlesForTileset(draft, tilesetId).flatMap(bundle => bundle.facilities.map(facility => ({
        bundleId: bundle.id, facilityId: facility.id, facilityLabel: facility.label,
        plan: facilityAsPlan(bundle, facility),
      })));
      return {
        summary: query
          ? `템플릿에 "${query}" 시설이 없다 — sources의 장소·물건을 조합해 plan을 설계하고 place_concept에 넘겨라. 물건 어휘 ${vocabulary.length}종`
          : `시설 템플릿 ${facilities.length}종 · 물건 어휘 ${vocabulary.length}종`,
        data: { query, facilities, template: null, sources, vocabulary },
      };
    }
    const plan = facilityAsPlan(resolved.bundle, resolved.facility);
    const variants = resolved.facility.label === "여관" || resolved.facility.id === "inn"
      ? innDesignVariants() : facilityDesignVariants(resolved.facility.id);
    return {
      summary: `시설 「${resolved.facility.label}」 템플릿 — 장소 ${plan.places.length}·물건 ${plan.things.length} · 물건 어휘 ${vocabulary.length}종. `
        + (variants.length > 0 ? `variants ${variants.length}종. ` : "")
        + "이건 출발점이다 — 그대로 넘기지 말고 사용자 문장과 배경(미을 규모·분위기)에 맞게 장소 수·크기·바닥·물건 구성을 고쳐 plan 으로 넘기라.",
      data: {
        query,
        designHint: {
          rule: "사용자의 요청과 현재 template의 개별 수정이 우선이다. variants는 공간 구성 참고이며 사용자에게 없는 물건을 무조건 다시 넣는 초기화 명령이 아니다. 수식어가 없어도 용도와 규모를 정하고, 요청에 맞게 장소 수·크기·layout·물건을 바꿔 plan으로 넘겨라. 탁자와 러그, 조리 도구와 화덕, 같은 종류 재고를 묶고 문 접근로를 비워라. **템플릿 물건을 그대로 베끼면 모든 실내가 같은 구조물로 채워진다 — 같은 역할(vocabularyGroups)의 다른 물건을 최소 둘 이상 골라라.**",
          keep: plan.things.filter((thing) => thing.required).map((thing) => thing.objectId),
          levers: [
            "plan.layout row|double-row|wing (wing=세로 복도, 방이 동·서에 붙고 홀이 남쪽 끝)",
            "places[].shape rect|l|alcove (ㄱ자·벽감으로 방 실루엣을 바꾼다)",
            "places[].zone north|south (double-row)",
            "places[].count 1..4",
            "places[].size s|m|l",
            "places[].floor wood|stone|plank|mat",
            "wall cream|gold-brick|stone-brick",
            "things[] 에 vocabulary[].id 추가/제거 — vocabularyGroups 의 같은 역할 대체품",
            "places[].level 2 로 위층",
          ],
          vocabularyGroups: CONCEPT_VOCABULARY_GROUPS,
        },
        facilities,
        template: {
          facilityId: resolved.facility.id,
          facilityLabel: resolved.facility.label,
          tilesetId: resolved.tilesetId,
          plan,
        },
        variants,
        vocabulary,
        vocabularyGroups: CONCEPT_VOCABULARY_GROUPS,
      },
    };
  },
};

/** 아래층 계단 앞 — 첫 계단(transfer 칩) 이벤트의 남쪽 한 칸(같은 방 안이면), 아니면 계단 칸. 계단이 없으면 null. */
function stairArrival(map: GameMap, layout: ConceptRoomLayout, mapId: string): ConceptTransferTarget | null {
  const first = listConceptConnections(map)[0];
  if (!first) return null;
  const room = layout.rooms.find((entry) => first.x >= entry.x && first.x < entry.x + entry.w && first.y >= entry.y && first.y < entry.y + entry.h);
  const south = { x: first.x, y: first.y + 1 };
  const inside = room ? south.y < room.y + room.h : false;
  return { mapId, ...(inside ? south : { x: first.x, y: first.y }) };
}
