/**
 * 실내 방 하네스(villager-room-v1) 세션 툴 — 공유 엔진(roomHarness/engine) 위임 래퍼.
 * plan → floor → walls → furniture → entrance → critique. 툴 이름은 실내 전용 유지.
 * furnish_interior_space는 실내 전용 확장(공간 단위 재시공).
 */
import {
  furnishInteriorSpace,
  INTERIOR_ROOM_THEMES,
  INTERIOR_THEME_MODIFIERS,
  interiorVocabFromTileset,
  type InteriorRoomPlan,
  type InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import {
  advanceRoomBuild,
  ensureRoomSessionForMap,
  evaluateRoom,
  listRoomDemos,
  listRoomSessions,
  loadRoomSession,
  runRoomPipeline,
  saveRoomSession,
  startRoomSession,
} from "@/editor/roomHarness/engine";
import { INTERIOR_ROOM_KIT } from "@/editor/roomHarness/interiorKit";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA, RECT_SCHEMA, REPLACE_EXISTING_SCHEMA } from "./schemaShapes";

const KIT = INTERIOR_ROOM_KIT.kitId;

/** 방 구조 bbox — RECT + 방 역할/재질. items:{type:"object"} 로 두면 모델이 `rooms:[{}]` 만 보낸다. */
const INTERIOR_ROOM_RECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
    theme: { type: "string" },
    floorTile: { type: "integer" },
  },
  required: ["x", "y", "w", "h"],
};

// 엔진 data에 실내 advance 툴 이름 next 힌트를 얹는다.
function withNext(res: ToolExecResult, sessionId: string): ToolExecResult {
  const data = res.data as { done?: boolean } | undefined;
  const done = data?.done ?? false;
  return { ...res, data: { ...(res.data as object), next: done ? null : `advance_interior_room_build({ sessionId: "${sessionId}" })` } };
}

export const INTERIOR_ROOM_SESSION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "start_interior_room_session",
    description:
      "**새** 주민 집 실내(villager-room-v1)를 새 mapId 로 시공하는 멀티턴 세션을 시작한다. " +
      "절차: plan → floor(bbox 바닥) → walls → furniture → entrance(입구 이벤트) → critique. " +
      "wings는 통행 바닥 bbox 합집합. 벽은 floor 이후 세운다. 침대 355|356은 hard 좌우 쌍. " +
      "이어서 advance_interior_room_build 반복 또는 run_interior_room_pipeline 원샷. " +
      "**기존 실내 맵을 고치는 요청에는 쓰지 마라** — 그 맵을 대상으로 furnish_interior_space / " +
      "fill_region / tile_erase / place_props 를 써라. 이미 있는 mapId 를 넘기면 map-exists 로 거부된다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer" },
        height: { type: "integer" },
        wings: {
          type: "array",
          description: "바닥 bbox들 [{x,y,w,h}] — rooms 미사용 시 필수",
          items: RECT_SCHEMA,
        },
        rooms: {
          type: "array",
          description:
            "공간 구조 bbox [{id,x,y,w,h,theme?,floorTile?}] — 상하 인접 방은 3행 간격(파티션). "
            + "지정 시 wings 대신 사용. '실내'는 상위 개념이고 배치는 공간(방) 단위: 방마다 역할 테마"
            + "(기본 7종 또는 타일셋에 저장한 방 종류 id)와 바닥 재질을 준다. "
            + "corridor는 복도 — 바닥 점유물 없이 벽 장식·전시물만 놓인다(저택 통로에 사용).",
          items: INTERIOR_ROOM_RECT_SCHEMA,
        },
        innerDoors: {
          type: "array",
          description: "방 사이 파티션 개구부 [{x,y}] — 파티션 최상단(트림 행) 좌표",
          items: COORD_SCHEMA,
        },
        door: { ...COORD_SCHEMA, description: "{x,y} 남측 입구(floor 남 경계)" },
        theme: {
          type: "string",
          description:
            "방 종류 id. 기본값 bedroom|study|dining|kitchen|storage|tavern|corridor. "
            + "데이터베이스 구조물 탭의 타일셋 방 종류 id 도 받는다.",
        },
        tilesetId: {
          type: "string",
          description: "가구·방 종류를 읽을 타일셋. 생략 시 실내 칩셋 easyrpg_chipset_interior",
        },
        themeModifiers: {
          type: "array",
          items: { type: "string", enum: [...INTERIOR_THEME_MODIFIERS] },
          description: "역할 테마에 겹쳐 쓰는 조합형 분위기: rustic|luxury|sacred|scholarly|martial",
        },
        seed: { type: "integer", description: "배치 난수 시드 — 같은 플랜이라도 시드가 다르면 가구 배치가 달라진다" },
        floorTile: { type: "integer", description: "기본 바닥 재질(예: 돌 12, 널 102, 돗자리 139). 미지정=나무 72" },
        wallMaterial: {
          type: "string",
          enum: ["cream", "gold-brick", "stone-brick"],
          description: "벽면 재질 — gold-brick은 귀족 저택(식당 러그도 붉은 카펫)",
        },
        replaceExisting: REPLACE_EXISTING_SCHEMA,
      },
      required: ["mapId", "door", "theme"],
    },
    invalidArgsExample: {
      mapId: "map_interior_demo",
      name: "데모 침실",
      width: 16,
      height: 13,
      wings: [{ x: 2, y: 5, w: 12, h: 5 }],
      door: { x: 8, y: 9 },
      theme: "bedroom",
    },
    run(draft, args): ToolExecResult {
      const res = startRoomSession(draft, KIT, args);
      const sessionId = (res.data as { sessionId: string }).sessionId;
      return withNext(res, sessionId);
    },
  },
  {
    name: "advance_interior_room_build",
    description:
      "실내 세션 체크리스트에서 다음 open 레이어 하나만 시공/검증한다. " +
      "순서: floor → walls → furniture → entrance → critique.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        forceLayer: {
          type: "string",
          enum: ["floor", "walls", "furniture", "entrance", "critique"],
        },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "room_villager-room-v1_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const forceLayer = args.forceLayer ? String(args.forceLayer) : undefined;
      return withNext(advanceRoomBuild(draft, sessionId, forceLayer), sessionId);
    },
  },
  {
    name: "run_interior_room_pipeline",
    description:
      "**새** 실내 방을 새 mapId 로 원샷 절차 생성한다(floor bbox→walls→furniture→entrance→critique). " +
      "멀티턴 품질 경로가 기본이면 start_interior_room_session을 써라. " +
      "침대는 355|356 hard 쌍, 벽면 장식과 바닥 잔해(깨진 유리 등)를 구분한다. " +
      "**기존 실내 맵 수정에는 쓰지 마라** — 이미 있는 mapId 는 map-exists 로 거부되고, " +
      "고치려면 furnish_interior_space / fill_region / tile_erase / place_props 를 그 맵에 직접 쓴다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer" },
        height: { type: "integer" },
        wings: { type: "array", items: RECT_SCHEMA, description: "바닥 bbox들 [{x,y,w,h}]" },
        rooms: { type: "array", items: INTERIOR_ROOM_RECT_SCHEMA, description: "방 구조 bbox [{id,x,y,w,h,theme?}]" },
        innerDoors: { type: "array", items: COORD_SCHEMA, description: "파티션 개구부 [{x,y}]" },
        door: COORD_SCHEMA,
        theme: { type: "string" },
        tilesetId: { type: "string" },
        themeModifiers: {
          type: "array",
          items: { type: "string", enum: [...INTERIOR_THEME_MODIFIERS] },
          description: "역할 테마에 겹쳐 쓰는 조합형 분위기: rustic|luxury|sacred|scholarly|martial",
        },
        seed: { type: "integer" },
        demo: {
          type: "string",
          enum: [...INTERIOR_ROOM_THEMES],
          description: "데모 플랜 사용 시 wings/door 생략 가능",
        },
        replaceExisting: REPLACE_EXISTING_SCHEMA,
      },
    },
    invalidArgsExample: { demo: "bedroom" },
    run(draft, args): ToolExecResult {
      const res = runRoomPipeline(draft, KIT, args);
      const mapId = (res.data as { mapId: string }).mapId;
      const events = (draft.maps[mapId]?.events ?? []).map((e) => ({
        id: e.id,
        name: e.pages?.[0]?.name ?? e.id,
        x: e.x,
        y: e.y,
      }));
      return { ...res, data: { ...(res.data as object), events } };
    },
  },
  {
    name: "furnish_interior_space",
    description:
      "실내 세션의 공간(방) 하나만 철거하고 지정 테마로 다시 시공한다 — 공간 단위 하네싱의 실행 도구. "
      + "furniture 레이어 전체 재실행 없이 방별로 배치를 다듬을 때 쓴다(테마 교체·재추첨). "
      + "방 범위의 가구·벽 장식·러그를 걷어내고 역할 테마 문법으로 재배치한 뒤 전체 통행 보정을 다시 돌린다. "
      + "시공 후 evaluate_interior_room으로 재평가하라.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: {
          type: "string",
          description:
            "고칠 실내 맵 id — sessionId 없이 이것만으로 동작한다(이전 턴/이전 세션에 만든 맵도 가능). "
            + "sessionId 와 함께 주면 sessionId 가 우선한다.",
        },
        sessionId: { type: "string", description: "이번 대화에서 시작한 세션 id(있을 때만). 없으면 mapId 를 써라." },
        roomId: { type: "string", description: "플랜 rooms[].id — 재시공할 공간" },
        theme: {
          type: "string",
          description: "역할 테마 교체(미지정 시 기존 테마 유지). 기본 7종 또는 타일셋 방 종류 id",
        },
        modifiers: {
          type: "array",
          items: { type: "string", enum: [...INTERIOR_THEME_MODIFIERS] },
          description: "이 방에만 적용할 조합형 분위기 modifier 목록",
        },
        seed: { type: "integer", description: "이 공간만의 배치 재추첨 시드(미지정 시 플랜 시드 파생)" },
      },
      required: ["roomId"],
    },
    invalidArgsExample: { mapId: "map_interior_demo", roomId: "hall", theme: "corridor" },
    invalidArgsHint: "mapId(고칠 실내 맵) 또는 sessionId 중 하나와 roomId 를 지정하라.",
    run(draft, args): ToolExecResult {
      const explicitSessionId = String(args.sessionId ?? "").trim();
      const mapIdArg = String(args.mapId ?? "").trim();
      // sessionId 우선. 없으면 mapId 로 세션을 확보한다(맵에 남은 roomHarnessPlan 으로 재수립).
      let session = explicitSessionId ? loadRoomSession(draft, explicitSessionId) : null;
      if (!session && explicitSessionId && !mapIdArg) {
        throw new ToolError(
          `session 없음: ${explicitSessionId} — 세션은 대화 밖으로 보존되지 않습니다. `
            + `mapId 로 대상 맵을 지목하세요(list_interior_room_sessions 로 살아 있는 세션 확인).`,
          { code: "session-not-found" },
        );
      }
      if (!session) {
        if (!mapIdArg) {
          throw new ToolError("mapId 또는 sessionId 중 하나는 필요하다", { code: "invalid-args" });
        }
        session = ensureRoomSessionForMap(draft, mapIdArg);
      }
      const sessionId = session.id;
      const map = draft.maps[session.mapId];
      if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
      const plan = session.plan as InteriorRoomPlan;
      if (!plan.rooms || plan.rooms.length === 0) {
        throw new ToolError("rooms 플랜이 아닌 세션 — 공간 단위 재시공은 rooms 구조에서만 가능", { code: "invalid-args" });
      }
      const roomId = String(args.roomId ?? "").trim();
      if (session.lockedRoomIds.includes(roomId)) {
        throw new ToolError(`잠긴 방은 재시공할 수 없습니다: ${roomId}`, { code: "room-locked" });
      }
      const theme = args.theme !== undefined ? String(args.theme).trim() : undefined;
      if (theme !== undefined && !theme) {
        throw new ToolError("theme 이 비어 있다", { code: "invalid-args" });
      }
      const seed = args.seed !== undefined ? Math.floor(Number(args.seed)) : undefined;
      const modifiers = args.modifiers === undefined
        ? undefined
        : [...new Set((args.modifiers as unknown[]).map((value) => String(value) as InteriorThemeModifier))];
      if (modifiers?.some((modifier) => !INTERIOR_THEME_MODIFIERS.includes(modifier))) {
        throw new ToolError(`modifiers must contain ${INTERIOR_THEME_MODIFIERS.join("|")}`, { code: "invalid-args" });
      }
      let outcome: { plan: InteriorRoomPlan; warnings: string[] };
      try {
        outcome = furnishInteriorSpace(
          map,
          plan,
          roomId,
          theme,
          seed,
          modifiers,
          interiorVocabFromTileset(draft.tilesets[plan.tilesetId ?? map.tilesetId]),
        );
      } catch (error) {
        throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" });
      }
      const logLine = `[space:${roomId}] theme=${theme ?? "유지"} seed=${seed ?? "플랜 파생"} warnings=${outcome.warnings.length}`;
      const issues = outcome.warnings.map((message) => ({
        code: message.startsWith("walkability:") ? "walkability" : "room-warning",
        severity: message.startsWith("walkability:") ? "error" as const : "warning" as const,
        message,
        mapId: session.mapId,
        layer: `room:${roomId}`,
        roomId,
      }));
      // 맵에 박힌 플랜도 같이 갱신한다 — 다음 턴/재오픈 때 mapId 로 복원할 플랜이 최신이어야 한다.
      map.roomHarnessPlan = { kitId: session.kitId, plan: structuredClone(outcome.plan) };
      saveRoomSession(draft, {
        ...session,
        plan: outcome.plan,
        log: [...session.log, logLine],
        checkpoints: [...session.checkpoints, {
          index: session.checkpoints.length,
          layer: `room:${roomId}`,
          state: issues.some((issue) => issue.severity === "error") ? "failed" : "done",
          summary: logLine,
          issues,
          mapSnapshot: structuredClone(map),
        }],
      });
      return {
        summary: `공간 재시공 ${roomId}${theme ? ` → ${theme}` : ""}${outcome.warnings.length ? ` (경고 ${outcome.warnings.length})` : ""}`,
        data: {
          sessionId,
          mapId: session.mapId,
          roomId,
          theme: theme ?? null,
          warnings: outcome.warnings,
          next: `evaluate_interior_room({ sessionId: "${sessionId}" })`,
        },
      };
    },
  },
  {
    name: "evaluate_interior_room",
    description:
      "실내 세션의 완성 맵을 평가한다(villageEvaluate 계약 정렬: ok/score/issues/metrics/feedbackForLlm). " +
      "검사: 테마 필수 가구 매니페스트 · 문 기준 통행 연결성(가구=장애물) · 사분면 밀도 균형. " +
      "불합격이면 feedbackForLlm 지침대로 수정 후 재평가하라.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        attempt: { type: "integer", description: "자가 수정 루프 회차(기본 1)" },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "room_villager-room-v1_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const attempt = args.attempt !== undefined ? Math.floor(Number(args.attempt)) : 1;
      return evaluateRoom(draft, sessionId, attempt);
    },
  },
  {
    name: "list_interior_room_demos",
    description: "villager-room-v1 데모 플랜 6종(침실/서재/식탁/주방/창고/선술집)을 나열한다.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(): ToolExecResult {
      return listRoomDemos(KIT);
    },
  },
  {
    name: "list_interior_room_sessions",
    description:
      "살아 있는 방 하네스 세션과 방 하네스로 시공된 실내 맵을 나열한다. "
      + "기존 실내 맵을 고치기 전에 이걸로 대상 mapId 와 방 id(rooms[].id)를 확인하라 — "
      + "그다음 furnish_interior_space({ mapId, roomId }) 로 방 단위 재시공한다.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(draft): ToolExecResult {
      const sessions = listRoomSessions(draft).map((session) => ({
        sessionId: session.id,
        kitId: session.kitId,
        mapId: session.mapId,
        checklist: session.checklist,
        roomIds: ((session.plan as InteriorRoomPlan).rooms ?? []).map((room) => room.id),
      }));
      // 세션은 직렬화되지 않으므로 맵에 박힌 플랜이 더 넓은 진실이다.
      const authoredMaps = Object.values(draft.maps)
        .filter((map) => map.roomHarnessPlan !== undefined)
        .map((map) => ({
          mapId: map.id,
          name: map.name,
          kitId: map.roomHarnessPlan!.kitId,
          roomIds: ((map.roomHarnessPlan!.plan as InteriorRoomPlan).rooms ?? []).map((room) => room.id),
        }));
      return {
        summary: `세션 ${sessions.length}개 · 방 하네스 맵 ${authoredMaps.length}개`,
        data: { sessions, authoredMaps },
      };
    },
  },
];
