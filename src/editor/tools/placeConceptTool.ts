import {
  conceptFacilityLevels,
  conceptOverlayFor,
  ensureConceptBundles,
  layoutConceptFacility,
  listLiveConceptFacilityLabels,
  resolveConceptFacility,
  type ConceptRoomLayout,
  type ResolvedConceptFacility,
} from "@/editor/conceptBundleResolve";
import { innDesignVariants } from "@/editor/conceptInnVariants";
import {
  CONCEPT_PLAN_ENUMS,
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
  linkConceptTransfers,
  listConceptConnections,
  type ConceptTransferTarget,
} from "@/editor/interiorConceptEvents";
import { INTERIOR_ROOM_TILESET_ID, interiorVocabFromTileset } from "@/editor/interiorRoomPipeline";
import { runRoomPipeline } from "@/editor/roomHarness/engine";
import { INTERIOR_ROOM_KIT } from "@/editor/roomHarness/interiorKit";
import { conceptChipLabel } from "@/project/types/conceptBundle";
import type { GameMap, Project } from "@/project/types";
import { deterministicRng } from "@/util/rng";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { REPLACE_EXISTING_SCHEMA } from "./schemaShapes";

const KIT = INTERIOR_ROOM_KIT.kitId;

const PLAN_SCHEMA = {
  type: "object",
  description:
    "모델이 설계한 시설. get_concept_facility(query) 가 돌려준 템플릿을 요청에 맞게 고쳐 그대로 넘기라 — 방 수(count)·크기(size)·바닥·벽·층·물건 추가/제외. "
    + "좌표는 코드가 정한다. objectId 는 vocabulary[].id 에서만. 템플릿의 required 물건을 뾄으면 경고(거부 아님). 생략하면 템플릿 그대로.",
  properties: {
    layout: {
      type: "string",
      enum: [...CONCEPT_PLAN_ENUMS.layouts],
      description: "도면 문법. row=방 줄→복도→홀(기본). double-row=객실은 복도 북쪽, 날개(주방·창고)는 홀 옆.",
    },
    wall: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.walls], description: "벽 재질. 생략=cream" },
    places: {
      type: "array",
      description: "장소 목록. entrance(정문 홀) 하나, walkway(복도) 0~1, 나머지 room. row 는 홀→복도→방 줄, double-row 는 북 방 줄→복도→홀+남쪽 날개.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          role: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.roles], description: "생략=room" },
          size: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.sizes], description: "s 5×3 · m 7×4 · l 9×5. 생략=m" },
          count: { type: "integer", description: `같은 장소 개수 1..${CONCEPT_PLAN_ENUMS.countMax}(객실 ×3). 생략=1` },
          floor: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.floors], description: "생략=wood" },
          level: { type: "integer", description: `층 1..${CONCEPT_PLAN_ENUMS.levelMax}. 2 이상은 <mapId>_<n>f 별도 맵 + 계단. 생략=1` },
          zone: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.zones], description: "double-row 에서 north=복도 위 객실, south=홀 옆 날개. 생략 시 주방·창고 라벨은 south" },
        },
        required: ["id"],
      },
    },
    things: {
      type: "array",
      description: "물건 목록. 각 물건은 어느 장소(placeIds)에 놓이는지와 능력 칩(chips)을 가진다.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          objectId: { type: "string", description: "get_concept_facility 의 vocabulary[].id" },
          placeIds: { type: "array", items: { type: "string" } },
          chips: {
            type: "array",
            items: { type: "string" },
            description: `내장 ${Object.entries(CONCEPT_PLAN_ENUMS.chipLabels).map(([id, label]) => `${id}=${label}`).join(" · ")} · 자유 칩(영문·숫자·-_·1~32자, 엔진 무동작 메모)도 된다`,
          },
          required: { type: "boolean", description: "자리가 없으면 경고를 내는 핵심 물건" },
        },
        required: ["objectId", "placeIds"],
      },
    },
  },
  required: ["places"],
} as const;

function seedFromMapId(mapId: string): number {
  return Math.floor(deterministicRng(1, "place_concept", mapId)() * 0x7fffffff);
}

function resolveObjectFor(draft: Project, tilesetId: string) {
  const vocab = interiorVocabFromTileset(draft.tilesets[tilesetId]);
  return (objectId: string) => vocab.objectsById.get(objectId) ?? interiorObjectById(objectId);
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
  // 설명의 시설 단어(여관 · 민가 · 상점 · 술집 · 주막 · 서재 · 도서관 · 대장간 · 교회 · 성당 · 창고 · 길드)와
  // 「지어줘 · 만들어줘」는 자연어 승격(capabilityEscalation, matchScore ≥ 20) 용이다 — 지우면 승격이 죽는다.
  description:
    "시설 실내를 설계대로 시공한다. 여관 지어줘 · 상점 만들어줘 · 술집 · 주막 · 민가 · 서재 · 도서관 · "
    + "대장간 · 교회 · 성당 · 창고 · 길드 처럼 시설명을 부르는 요청에 쓴다. "
    + "순서: get_concept_facility(query) 로 템플릿(사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 고친 장소·물건)과 물건 어휘를 읽고, "
    + "요청(방 수·크기·분위기·층·내용물)에 맞게 고친 plan 을 넘기라. 수식어가 없어도 템플릿을 그대로 복사하지 말고 설계를 다듬어라. "
    + "plan 을 생략하면 템플릿 그대로 짓는다. 좌표·벽·문·이벤트는 코드가 정한다(방 bbox 를 찍지 마라). "
    + "query 는 시설명(여관·상점·대장간…) 또는 꾸러미 id — 템플릿에 없는 시설도 plan 이 있으면 짓는다. "
    + "장소에 2층 이상이 있으면 층마다 맵(<mapId>_2f)을 짓고 계단으로 잇는다(data.floors). "
    + "방 종류 requiredRoles 로 시설을 합성하지 마라. 새 mapId 가 필요하다. "
    + "기존 실내 맵을 고치는 요청에는 쓰지 마라. "
    + "개념 꾸러미 시설을 요청받으면 야외 집(author_house)을 짓지 말고 이 툴로 새 mapId 실내를 시공한다 — "
    + "create_map 만 하고 멈추지 말 것.",
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
        description: "꾸러미를 읽을 타일셋. 생략 시 실내 칩셋 easyrpg_chipset_interior",
      },
      plan: PLAN_SCHEMA,
      seed: { type: "integer", description: "가구 배치 변주 시드. 생략 시 mapId 에서 파생(같은 mapId 는 같은 배치)" },
      replaceExisting: REPLACE_EXISTING_SCHEMA,
    },
    required: ["query", "mapId"],
  },
  invalidArgsExample: { query: "여관", mapId: "map_inn_1" },
  run(draft, args): ToolExecResult {
    const query = String(args.query ?? "").trim();
    const mapId = String(args.mapId ?? "").trim();
    if (!query) throw new ToolError("query 가 비어 있다 — 시설명(여관·상점·대장간)을 넣어라", { code: "invalid-args" });
    if (!mapId) throw new ToolError("mapId 가 비어 있다", { code: "invalid-args" });
    const tilesetId = args.tilesetId !== undefined
      ? String(args.tilesetId).trim()
      : INTERIOR_ROOM_TILESET_ID;
    // Phase 5: 시공 파이프라인의 벽·바닥·가구 타일 번호가 실내 칩셋 하드코딩이다.
    // 다른 칩셋은 꾸러미 저작(구성)까지만 열고, 시공은 실내 칩셋에서만 받는다.
    if (tilesetId !== INTERIOR_ROOM_TILESET_ID) {
      throw new ToolError(
        `개념 시설 시공은 실내 칩셋(${INTERIOR_ROOM_TILESET_ID})에서만 된다 — "${tilesetId}" 칩셋의 벽·바닥·가구 타일 번호가 없다. ` +
        "꾸러미 저작(장소·물건 구성)은 그 칩셋 탭에서 하고, 시공은 실내 칩셋에서 place_concept 하라.",
        { code: "invalid-tileset" },
      );
    }
    ensureConceptBundles(draft, tilesetId);
    const tileset = draft.tilesets[tilesetId];
    const hasPlan = args.plan !== undefined && args.plan !== null;
    if (!hasPlan && tileset?.scratchConceptBundles?.length === 0) {
      throw new ToolError(
        "이 타일셋의 개념 꾸러미가 비어 있다. plan 을 설계해 넘기거나, 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 시설 템플릿을 만들거나 초안(여관·민가·상점…)을 넣어라.",
        { code: "concept-bundle-empty" },
      );
    }
    // Phase 5: 실내 칩셋 스코프로만 푼다 — unscoped 폴백을 타면 실외 칩셋의 꾸러미가
    // 실내 타일 번호로 시공되는 누수가 생긴다. 실외 전용 시설명은 concept-not-found가 정직하다.
    const template = resolveConceptFacility(draft, query, tilesetId);
    if (!template && !hasPlan) {
      const available = listLiveConceptFacilityLabels(draft, tilesetId);
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
    // Phase 5: plan 경로에서 template이 실외 칩셋이면 시공하지 않는다.
    if (resolved.tilesetId !== INTERIOR_ROOM_TILESET_ID) {
      throw new ToolError(
        `개념 시설 시공은 실내 칩셋(${INTERIOR_ROOM_TILESET_ID})에서만 된다 — "${query}" 시설은 "${resolved.tilesetId}" 칩셋의 꾸러미다.`,
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
        rooms: floor.layout.rooms.map(({ id, x, y, w, h, theme, floorTile }) => ({
          id, x, y, w, h, theme, ...(floorTile !== undefined ? { floorTile } : {}),
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
          linkConceptTransfers(map, floor.layout.door, upperLanding(above.layout, above.mapId));
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
    const templatePlan = template ? facilityAsPlan(template.bundle, template.facility) : undefined;
    const plannedPlan = hasPlan ? facilityAsPlan(resolved.bundle, resolved.facility) : undefined;
    let designNote: string | undefined;
    if (!hasPlan) {
      designNote = "plan 을 생략해 템플릿 그대로 시공했다. get_concept_facility 의 variants 를 보고 설계를 넘겨라.";
    } else if (templatePlan && plannedPlan && plansStructurallyEqual(templatePlan, plannedPlan)) {
      designNote = "설계가 템플릿과 같다. 장소 수·크기·물건 중 둘 이상을 바꿔라.";
    }
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
function upperLanding(layout: ConceptRoomLayout, mapId: string): ConceptTransferTarget {
  return { mapId, x: layout.door.x, y: layout.door.y - 1 };
}

export const GET_CONCEPT_FACILITY_TOOL: ToolDefinition = {
  name: "get_concept_facility",
  description:
    "시설 실내를 지으려면 이것을 먼저 부른다. 여관·상점·대장간·술집·민가·교회·창고·길드·서재 시설의 "
    + "템플릿(사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 정해 둔 장소·물건)과 이 타일셋에서 쓸 수 있는 물건 어휘(vocabulary)를 돌려준다. "
    + "이 응답의 plan 을 요청에 맞게 고쳐 place_concept({query, mapId, plan}) 에 넘기라 — 그래야 장소 수·크기·내용물이 다른 시설이 생긴다. "
    + "query 를 생략하면 지금 부를 수 있는 시설 라벨과 어휘만 돌려준다. 읽기 전용 — 맵을 건들지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "시설 이름 또는 id. 예: 여관 · 상점 · 대장간" },
      tilesetId: { type: "string", description: "생략 시 실내 칩셋 easyrpg_chipset_interior" },
    },
  },
  invalidArgsExample: { query: "여관" },
  run(draft, args): ToolExecResult {
    const tilesetId = args.tilesetId !== undefined ? String(args.tilesetId).trim() : INTERIOR_ROOM_TILESET_ID;
    // Phase 5: 읽기 도구는 쓰지 않는다 — 실외 칩셋의 ensure 빈 배열 쓰기를 건너뛴다.
    // liveBundlesForTileset이 미시드 실외를 []로 읽으므로 동작은 같다.
    if (tilesetId === INTERIOR_ROOM_TILESET_ID) ensureConceptBundles(draft, tilesetId);
    const query = String(args.query ?? "").trim();
    const vocabulary = conceptVocabulary(interiorVocabFromTileset(draft.tilesets[tilesetId]), INTERIOR_OBJECT_CATALOG);
    const facilities = listLiveConceptFacilityLabels(draft, tilesetId);
    // Phase 5: 요청 칩셋 스코프로만 푼다 — 실외 시설명을 실내 템플릿으로 둔갑시키지 않는다.
    const resolved = query
      ? resolveConceptFacility(draft, query, tilesetId)
      : undefined;
    if (!resolved) {
      return {
        summary: query
          ? `템플릿에 "${query}" 시설이 없다 — plan 을 직접 설계해 place_concept 에 넘길 수 있다. 물건 어휘 ${vocabulary.length}종`
          : `시설 템플릿 ${facilities.length}종 · 물건 어휘 ${vocabulary.length}종`,
        data: { query, facilities, template: null, vocabulary },
      };
    }
    const plan = facilityAsPlan(resolved.bundle, resolved.facility);
    const variants = resolved.facility.label === "여관" || resolved.facility.id === "inn" ? innDesignVariants() : [];
    return {
      summary: `시설 「${resolved.facility.label}」 템플릿 — 장소 ${plan.places.length}·물건 ${plan.things.length} · 물건 어휘 ${vocabulary.length}종. `
        + (variants.length > 0 ? `variants ${variants.length}종. ` : "")
        + "이건 출발점이다 — 그대로 넘기지 말고 사용자 문장과 배경(미을 규모·분위기)에 맞게 장소 수·크기·바닥·물건 구성을 고쳐 plan 으로 넘기라.",
      data: {
        query,
        designHint: {
          rule: "템플릿을 그대로 복사해 넘기지 마라. 수식어가 없어도 규모·분위기·layout 을 네가 정해라. variants[] 중 하나를 고르거나 섞어 장소 수·크기·layout·물건을 바꿔 plan 으로 넘겨라.",
          keep: plan.things.filter((thing) => thing.required).map((thing) => thing.objectId),
          levers: ["plan.layout row|double-row", "places[].zone north|south", "places[].count 1..4", "places[].size s|m|l", "places[].floor wood|stone|plank|mat", "wall cream|gold-brick|stone-brick", "things[] 에 vocabulary[].id 추가/제거", "places[].level 2 로 위층"],
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
