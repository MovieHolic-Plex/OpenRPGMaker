import {
  conceptFacilityLevels,
  conceptOverlayFor,
  ensureConceptBundles,
  layoutConceptFacility,
  listLiveConceptFacilityLabels,
  resolveConceptFacility,
  type ConceptRoomLayout,
} from "@/editor/conceptBundleResolve";
import {
  convertEntranceToDescent,
  linkConceptTransfers,
  listConceptConnections,
  type ConceptTransferTarget,
} from "@/editor/interiorConceptEvents";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { runRoomPipeline } from "@/editor/roomHarness/engine";
import { INTERIOR_ROOM_KIT } from "@/editor/roomHarness/interiorKit";
import { CONCEPT_CHIP_LABELS } from "@/project/types/conceptBundle";
import type { GameMap } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { REPLACE_EXISTING_SCHEMA } from "./schemaShapes";

const KIT = INTERIOR_ROOM_KIT.kitId;

export const PLACE_CONCEPT_TOOL: ToolDefinition = {
  name: "place_concept",
  // 설명의 시설 단어(여관 · 민가 · 상점 · 술집 · 주막 · 서재 · 도서관 · 대장간 · 교회 · 성당 · 창고 · 길드)와
  // 「지어줘 · 만들어줘」는 자연어 승격(capabilityEscalation, matchScore ≥ 20) 용이다 — 지우면 승격이 죽는다.
  description:
    "타일셋 개념 꾸러미로 시설 실내를 시공한다. 여관 지어줘 · 상점 만들어줘 · 술집 · 주막 · 민가 · 서재 · 도서관 · "
    + "대장간 · 교회 · 성당 · 창고 · 길드 처럼 시설명을 부르면 "
    + "사용자가 데이터베이스 「임시 → 개념 꾸러미」에서 고친 나무가 정본이다. "
    + "query 는 시설명(여관·상점·대장간…) 또는 꾸러미 id. 장소·물건·칩·바닥·벽 재질·층은 그 나무를 따른다. "
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
      seed: { type: "integer", description: "가구 배치 난수 시드" },
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
    ensureConceptBundles(draft, tilesetId);
    const tileset = draft.tilesets[tilesetId];
    if (tileset?.scratchConceptBundles?.length === 0) {
      throw new ToolError(
        "이 타일셋의 개념 꾸러미가 비어 있다. 데이터베이스 「임시 → 개념 꾸러미」에서 시설을 만들거나 초안(여관·민가·상점…)을 넣어라.",
        { code: "concept-bundle-empty" },
      );
    }
    const resolved = resolveConceptFacility(draft, query, tilesetId)
      ?? resolveConceptFacility(draft, query);
    if (!resolved) {
      const available = listLiveConceptFacilityLabels(draft);
      throw new ToolError(
        `개념 꾸러미에서 "${query}" 시설을 찾지 못했다. 지금 부를 수 있는 시설: ${available.join(" · ") || "없음"}. `
        + "다른 시설은 데이터베이스 「임시 → 개념 꾸러미」에서 초안을 넣거나 만들어라.",
        { code: "concept-not-found" },
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
    const seed = args.seed !== undefined ? Math.floor(Number(args.seed)) : 7;
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
          chips: thing.chips.map((chip) => CONCEPT_CHIP_LABELS[chip]),
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
    const mergedWarnings = results.flatMap((entry) => entry.warnings ?? []).filter((line) => !multi || !line.includes("맵 연결 대상이 없다"));
    const roomCount = floors.reduce((sum, floor) => sum + floor.layout.rooms.length, 0);
    const floorNote = multi ? `, ${floors.slice(1).map((floor) => `${floor.level}층 ${floor.mapId}`).join(" · ")}` : "";
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
        used,
        rooms,
        floors: floors.map((floor) => ({ level: floor.level, mapId: floor.mapId, name: floor.name })),
        wallMaterial: layout.wallMaterial ?? "cream",
        door: layout.door,
        // 계단·문의 맵 연결 지점. target 이 이 맵의 정문이면 아직 미연결 — create_transfer_pair 로 잇는다.
        // 층이 둘 이상이면 층 사이는 코드가 이미 이었다.
        connections,
      },
    };
  },
};

/** 위층 착지 — 위층 문 자리 바로 북쪽(문 밴드 안 바닥). 문 자리엔 「계단 내려가기」 이벤트가 선다. */
function upperLanding(layout: ConceptRoomLayout, mapId: string): ConceptTransferTarget {
  return { mapId, x: layout.door.x, y: layout.door.y - 1 };
}

/** 아래층 계단 앞 — 첫 계단(transfer 칩) 이벤트의 남쪽 한 칸(같은 방 안이면), 아니면 계단 칸. 계단이 없으면 null. */
function stairArrival(map: GameMap, layout: ConceptRoomLayout, mapId: string): ConceptTransferTarget | null {
  const first = listConceptConnections(map)[0];
  if (!first) return null;
  const room = layout.rooms.find((entry) => first.x >= entry.x && first.x < entry.x + entry.w && first.y >= entry.y && first.y < entry.y + entry.h);
  const south = { x: first.x, y: first.y + 1 };
  const inside = room ? south.y < room.y + room.h : false;
  return { mapId, ...(inside ? south : { x: first.x, y: first.y }) };
}
