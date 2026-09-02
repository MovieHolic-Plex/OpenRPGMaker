import {
  conceptOverlayFor,
  ensureConceptBundles,
  layoutConceptFacility,
  listLiveConceptFacilityLabels,
  resolveConceptFacility,
} from "@/editor/conceptBundleResolve";
import { listConceptConnections } from "@/editor/interiorConceptEvents";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { runRoomPipeline } from "@/editor/roomHarness/engine";
import { INTERIOR_ROOM_KIT } from "@/editor/roomHarness/interiorKit";
import { CONCEPT_CHIP_LABELS } from "@/project/types/conceptBundle";
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
    + "query 는 시설명(여관·상점·대장간…) 또는 꾸러미 id. 장소·물건·칩·바닥·벽 재질은 그 나무를 따른다. "
    + "방 종류 requiredRoles 로 시설을 합성하지 마라. 새 mapId 가 필요하다. "
    + "기존 실내 맵을 고치는 요청에는 쓰지 마라.",
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
    const layout = layoutConceptFacility(resolved.bundle, resolved.facility);
    const overlay = conceptOverlayFor(resolved.bundle, resolved.facility, layout);
    const name = String(args.name ?? "").trim() || resolved.facility.label;
    const res = runRoomPipeline(draft, KIT, {
      mapId,
      name,
      width: layout.width,
      height: layout.height,
      theme: layout.rooms.find((room) => room.role === "entrance")?.theme ?? layout.rooms[0]?.theme ?? "storage",
      door: layout.door,
      rooms: layout.rooms.map(({ id, x, y, w, h, theme, floorTile }) => ({
        id, x, y, w, h, theme, ...(floorTile !== undefined ? { floorTile } : {}),
      })),
      innerDoors: [...layout.innerDoors],
      tilesetId: resolved.tilesetId,
      seed: args.seed !== undefined ? Math.floor(Number(args.seed)) : 7,
      replaceExisting: args.replaceExisting,
      ...(layout.wallMaterial ? { wallMaterial: layout.wallMaterial } : {}),
      concept: overlay,
    });
    const used = resolved.facility.placeIds.map((placeId) => {
      const place = resolved.bundle.places.find((entry) => entry.id === placeId);
      const things = resolved.bundle.things.filter((thing) => thing.placeIds.includes(placeId));
      return {
        placeId,
        placeLabel: place?.label ?? placeId,
        things: things.map((thing) => ({
          id: thing.id,
          label: thing.label,
          objectId: thing.objectId,
          required: Boolean(thing.required),
          chips: thing.chips.map((chip) => CONCEPT_CHIP_LABELS[chip]),
        })),
      };
    });
    const builtMap = draft.maps[mapId];
    const connections = builtMap ? listConceptConnections(builtMap) : [];
    const rooms = layout.rooms.map((room) => ({
      roomId: room.id,
      placeId: room.placeId,
      role: room.role,
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
      ...(room.floorTile !== undefined ? { floorTile: room.floorTile } : {}),
    }));
    return {
      ...res,
      summary: `${resolved.facility.label} 개념 꾸러미로 ${mapId} 시공 — 방 ${layout.rooms.length}개, 정문 (${layout.door.x},${layout.door.y})`,
      data: {
        ...(res.data as object),
        query,
        bundleId: resolved.bundle.id,
        facilityId: resolved.facility.id,
        facilityLabel: resolved.facility.label,
        tilesetId: resolved.tilesetId,
        used,
        rooms,
        wallMaterial: layout.wallMaterial ?? "cream",
        door: layout.door,
        // 계단·문의 맵 연결 지점. target 이 이 맵의 정문이면 아직 미연결 — create_transfer_pair 로 잇는다.
        connections,
      },
    };
  },
};
