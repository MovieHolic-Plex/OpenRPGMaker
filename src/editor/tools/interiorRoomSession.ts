/**
 * Multi-turn interior room session tools (village_session analogue).
 * plan → floor → walls → furniture → entrance → critique
 */
import {
  applyInteriorRoomLayer,
  createEmptyRoomMap,
  ensureInteriorRoomHarness,
  evaluateInteriorRoom,
  furnishInteriorSpace,
  INTERIOR_ROOM_BUILD_ORDER,
  INTERIOR_ROOM_DEMO_PLANS,
  INTERIOR_ROOM_KIT_ID,
  INTERIOR_ROOM_THEMES,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
  type InteriorRoomSession,
  type InteriorRoomTheme,
  type RoomLayer,
  type Wing,
} from "@/editor/interiorRoomPipeline";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type SessionBag = {
  interiorRoomSessions?: Record<string, InteriorRoomSession>;
};

function bagOf(project: Project): SessionBag {
  return project as Project & SessionBag;
}

function saveSession(project: Project, session: InteriorRoomSession): void {
  const bag = bagOf(project);
  bag.interiorRoomSessions = { ...(bag.interiorRoomSessions ?? {}), [session.id]: session };
}

function loadSession(project: Project, sessionId: string): InteriorRoomSession | null {
  return bagOf(project).interiorRoomSessions?.[sessionId] ?? null;
}

// 세션이 만든 맵은 맵 트리에도 올라가야 에디터 맵 목록/전환 UI에 보인다(mapTools의 create_map 관례).
function registerMapInTree(draft: Project, mapId: string): void {
  if (!draft.maps[draft.mapTree.mapId]) {
    draft.mapTree = { mapId, children: [] };
  } else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((child) => child.mapId === mapId)) {
    draft.mapTree.children.push({ mapId, children: [] });
  }
}

function parsePlan(args: Record<string, unknown>): InteriorRoomPlan {
  const mapId = String(args.mapId ?? "").trim();
  const name = String(args.name ?? mapId).trim();
  const width = Math.floor(Number(args.width ?? 16));
  const height = Math.floor(Number(args.height ?? 13));
  const theme = String(args.theme ?? "bedroom") as InteriorRoomTheme;
  if (!INTERIOR_ROOM_THEMES.includes(theme)) {
    throw new ToolError(`theme must be ${INTERIOR_ROOM_THEMES.join("|")}`, { code: "invalid-args" });
  }
  const door = args.door as { x?: number; y?: number } | undefined;
  if (!mapId || !door || typeof door.x !== "number" || typeof door.y !== "number") {
    throw new ToolError("mapId + door:{x,y} required", { code: "invalid-args" });
  }
  const wingsRaw = args.wings as Wing[] | undefined;
  const roomsRaw = args.rooms as Array<{ id?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown; theme?: unknown }> | undefined;
  const hasRooms = Array.isArray(roomsRaw) && roomsRaw.length > 0;
  if (!hasRooms && (!Array.isArray(wingsRaw) || wingsRaw.length === 0)) {
    throw new ToolError("wings 또는 rooms 필요: 바닥 bbox 배열 {x,y,w,h} (rooms는 {id,x,y,w,h,theme?})", {
      code: "invalid-args",
    });
  }
  const wings = (Array.isArray(wingsRaw) ? wingsRaw : []).map((w) => ({
    x: Math.floor(Number(w.x)),
    y: Math.floor(Number(w.y)),
    w: Math.floor(Number(w.w)),
    h: Math.floor(Number(w.h)),
  }));
  const rooms = hasRooms
    ? roomsRaw.map((r: Record<string, unknown>, index) => {
        const roomTheme = r.theme !== undefined ? (String(r.theme) as InteriorRoomTheme) : undefined;
        if (roomTheme !== undefined && !INTERIOR_ROOM_THEMES.includes(roomTheme)) {
          throw new ToolError(`rooms[${index}].theme must be ${INTERIOR_ROOM_THEMES.join("|")}`, { code: "invalid-args" });
        }
        return {
          id: String(r.id ?? `room_${index}`),
          x: Math.floor(Number(r.x)),
          y: Math.floor(Number(r.y)),
          w: Math.floor(Number(r.w)),
          h: Math.floor(Number(r.h)),
          theme: roomTheme,
          // 방별 바닥 재질(돌 12, 널 102, 돗자리 139 등) — 2026-07-13 노출.
          floorTile: r.floorTile !== undefined ? Math.floor(Number(r.floorTile)) : undefined,
        };
      })
    : undefined;
  const innerDoorsRaw = args.innerDoors as Array<{ x?: unknown; y?: unknown }> | undefined;
  const innerDoors = Array.isArray(innerDoorsRaw)
    ? innerDoorsRaw.map((d) => ({ x: Math.floor(Number(d.x)), y: Math.floor(Number(d.y)) }))
    : undefined;
  // 2026-07-13: 바닥/벽 재질 노출 — 이 필드들이 없으면 어시스턴트가 스크립트 전용 기능을 못 쓴다.
  const wallMaterial = args.wallMaterial !== undefined ? String(args.wallMaterial) : undefined;
  if (wallMaterial !== undefined && !["cream", "gold-brick", "stone-brick"].includes(wallMaterial)) {
    throw new ToolError(`wallMaterial must be cream|gold-brick|stone-brick`, { code: "invalid-args" });
  }
  return {
    mapId,
    name,
    width,
    height,
    wings,
    rooms,
    innerDoors,
    door: { x: Math.floor(door.x), y: Math.floor(door.y) },
    theme,
    // seed 미지정 시 매번 새 판을 뽑는다(구버그: 상수 1로 고정 → 재생성이 항상 동일).
    // 뽑힌 시드는 플랜에 기록되어 세션 내 재적용·재현이 가능하다.
    seed: args.seed !== undefined ? Math.floor(Number(args.seed)) : Date.now() % 1_000_000,
    floorTile: args.floorTile !== undefined ? Math.floor(Number(args.floorTile)) : undefined,
    wallMaterial: wallMaterial as InteriorRoomPlan["wallMaterial"],
  };
}

export const INTERIOR_ROOM_SESSION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "start_interior_room_session",
    description:
      "주민 집 실내(villager-room-v1) 멀티턴 시공 세션을 시작한다. " +
      "절차: plan → floor(bbox 바닥) → walls → furniture → entrance(입구 이벤트) → critique. " +
      "wings는 통행 바닥 bbox 합집합. 벽은 floor 이후 세운다. 침대 355|356은 hard 좌우 쌍. " +
      "이어서 advance_interior_room_build 반복 또는 run_interior_room_pipeline 원샷.",
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
          items: { type: "object" },
        },
        rooms: {
          type: "array",
          description:
            "공간 구조 bbox [{id,x,y,w,h,theme?,floorTile?}] — 상하 인접 방은 3행 간격(파티션). "
            + "지정 시 wings 대신 사용. '실내'는 상위 개념이고 배치는 공간(방) 단위: 방마다 역할 테마"
            + "(bedroom|study|dining|kitchen|storage|tavern|corridor)와 바닥 재질을 준다. "
            + "corridor는 복도 — 바닥 점유물 없이 벽 장식·전시물만 놓인다(저택 통로에 사용).",
          items: { type: "object" },
        },
        innerDoors: {
          type: "array",
          description: "방 사이 파티션 개구부 [{x,y}] — 파티션 최상단(트림 행) 좌표",
          items: { type: "object" },
        },
        door: { type: "object", description: "{x,y} 남측 입구(floor 남 경계)" },
        theme: { type: "string", enum: [...INTERIOR_ROOM_THEMES] },
        seed: { type: "integer", description: "배치 난수 시드 — 같은 플랜이라도 시드가 다르면 가구 배치가 달라진다" },
        floorTile: { type: "integer", description: "기본 바닥 재질(예: 돌 12, 널 102, 돗자리 139). 미지정=나무 72" },
        wallMaterial: {
          type: "string",
          enum: ["cream", "gold-brick", "stone-brick"],
          description: "벽면 재질 — gold-brick은 귀족 저택(식당 러그도 붉은 카펫)",
        },
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
      ensureInteriorRoomHarness(draft);
      const plan = parsePlan(args);
      const sessionId = `iroom_${plan.mapId}_${Date.now().toString(36)}`;
      const checklist = Object.fromEntries(
        INTERIOR_ROOM_BUILD_ORDER.map((l) => [l, l === "plan" ? "done" : "open"]),
      ) as InteriorRoomSession["checklist"];
      const map = createEmptyRoomMap(plan);
      draft.maps[plan.mapId] = map;
      registerMapInTree(draft, plan.mapId);
      const session: InteriorRoomSession = {
        id: sessionId,
        plan,
        checklist,
        mapId: plan.mapId,
        log: [`[plan] wings=${plan.wings.length} theme=${plan.theme}`],
      };
      saveSession(draft, session);
      return {
        summary: `실내 세션 ${sessionId} 시작 · map=${plan.mapId}`,
        data: {
          sessionId,
          kitId: INTERIOR_ROOM_KIT_ID,
          plan,
          checklist: session.checklist,
          next: `advance_interior_room_build({ sessionId: "${sessionId}" })`,
          buildOrder: INTERIOR_ROOM_BUILD_ORDER,
        },
      };
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
    invalidArgsExample: { sessionId: "iroom_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const session = loadSession(draft, sessionId);
      if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
      ensureInteriorRoomHarness(draft);
      const force = args.forceLayer as RoomLayer | undefined;
      const layer =
        force
        ?? INTERIOR_ROOM_BUILD_ORDER.find((l) => l !== "plan" && session.checklist[l] === "open");
      if (!layer) {
        return {
          summary: "모든 레이어 완료",
          data: { sessionId, checklist: session.checklist, done: true },
        };
      }
      const map = draft.maps[session.mapId];
      if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
      const result = applyInteriorRoomLayer(map, session.plan, layer);
      draft.maps[session.mapId] = result.map;
      session.checklist[layer] = result.ok ? "done" : "failed";
      session.log.push(`[${layer}] ${result.summary}`);
      saveSession(draft, session);
      const next = INTERIOR_ROOM_BUILD_ORDER.find((l) => session.checklist[l] === "open");
      return {
        summary: result.summary,
        data: {
          sessionId,
          layer,
          ok: result.ok,
          warnings: result.warnings,
          checklist: session.checklist,
          next: next
            ? `advance_interior_room_build({ sessionId: "${sessionId}" })`
            : null,
          done: !next,
        },
      };
    },
  },
  {
    name: "run_interior_room_pipeline",
    description:
      "실내 방을 원샷 절차 생성한다(floor bbox→walls→furniture→entrance→critique). " +
      "멀티턴 품질 경로가 기본이면 start_interior_room_session을 써라. " +
      "침대는 355|356 hard 쌍, 벽면 장식과 바닥 잔해(깨진 유리 등)를 구분한다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer" },
        height: { type: "integer" },
        wings: { type: "array", items: { type: "object" } },
        rooms: { type: "array", items: { type: "object" }, description: "방 구조 bbox [{id,x,y,w,h,theme?}]" },
        innerDoors: { type: "array", items: { type: "object" }, description: "파티션 개구부 [{x,y}]" },
        door: { type: "object" },
        theme: { type: "string", enum: [...INTERIOR_ROOM_THEMES] },
        seed: { type: "integer" },
        demo: {
          type: "string",
          enum: [...INTERIOR_ROOM_THEMES],
          description: "데모 플랜 사용 시 wings/door 생략 가능",
        },
      },
    },
    invalidArgsExample: {
      demo: "bedroom",
    },
    run(draft, args): ToolExecResult {
      ensureInteriorRoomHarness(draft);
      let plan: InteriorRoomPlan;
      const demo = args.demo ? String(args.demo) : "";
      if (demo) {
        const found = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === demo);
        if (!found) throw new ToolError(`unknown demo ${demo}`, { code: "invalid-args" });
        plan = found;
        if (args.mapId) plan = { ...plan, mapId: String(args.mapId) };
        if (args.name) plan = { ...plan, name: String(args.name) };
      } else {
        plan = parsePlan(args);
      }
      const result = runInteriorRoomPipeline(plan);
      draft.maps[plan.mapId] = result.map;
      registerMapInTree(draft, plan.mapId);
      return {
        summary: result.ok
          ? `실내 파이프라인 완료 ${plan.mapId}`
          : `실내 파이프라인 이슈 ${result.warnings.length}`,
        data: {
          kitId: INTERIOR_ROOM_KIT_ID,
          plan,
          log: result.log,
          warnings: result.warnings,
          ok: result.ok,
          events: (result.map.events ?? []).map((e) => ({ id: e.id, name: e.name, x: e.x, y: e.y })),
        },
      };
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
        sessionId: { type: "string" },
        roomId: { type: "string", description: "플랜 rooms[].id — 재시공할 공간" },
        theme: {
          type: "string",
          enum: [...INTERIOR_ROOM_THEMES],
          description: "역할 테마 교체(미지정 시 기존 테마 유지). corridor=복도(바닥 점유물 없음)",
        },
        seed: { type: "integer", description: "이 공간만의 배치 재추첨 시드(미지정 시 플랜 시드 파생)" },
      },
      required: ["sessionId", "roomId"],
    },
    invalidArgsExample: { sessionId: "iroom_1", roomId: "hall", theme: "corridor" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const session = loadSession(draft, sessionId);
      if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
      const map = draft.maps[session.mapId];
      if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
      if (!session.plan.rooms || session.plan.rooms.length === 0) {
        throw new ToolError("rooms 플랜이 아닌 세션 — 공간 단위 재시공은 rooms 구조에서만 가능", { code: "invalid-args" });
      }
      const roomId = String(args.roomId ?? "").trim();
      const theme = args.theme !== undefined ? (String(args.theme) as InteriorRoomTheme) : undefined;
      if (theme !== undefined && !INTERIOR_ROOM_THEMES.includes(theme)) {
        throw new ToolError(`theme must be ${INTERIOR_ROOM_THEMES.join("|")}`, { code: "invalid-args" });
      }
      const seed = args.seed !== undefined ? Math.floor(Number(args.seed)) : undefined;
      let outcome: { plan: InteriorRoomPlan; warnings: string[] };
      try {
        outcome = furnishInteriorSpace(map, session.plan, roomId, theme, seed);
      } catch (error) {
        throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" });
      }
      const nextSession = { ...session, plan: outcome.plan };
      nextSession.log.push(`[space:${roomId}] theme=${theme ?? "유지"} seed=${seed ?? "플랜 파생"} warnings=${outcome.warnings.length}`);
      saveSession(draft, nextSession);
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
    invalidArgsExample: { sessionId: "iroom_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const session = loadSession(draft, sessionId);
      if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
      const map = draft.maps[session.mapId];
      if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
      const attempt = args.attempt !== undefined ? Math.floor(Number(args.attempt)) : 1;
      const report = evaluateInteriorRoom(map, session.plan, attempt);
      return {
        summary: report.ok
          ? `실내 평가 합격 (score ${report.score})`
          : `실내 평가 ${report.issues.length}건 (score ${report.score})`,
        data: { sessionId, mapId: session.mapId, report },
      };
    },
  },
  {
    name: "list_interior_room_demos",
    description: "villager-room-v1 데모 플랜 6종(침실/서재/식탁/주방/창고/선술집)을 나열한다.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(): ToolExecResult {
      return {
        summary: `데모 ${INTERIOR_ROOM_DEMO_PLANS.length}종`,
        data: { kitId: INTERIOR_ROOM_KIT_ID, plans: INTERIOR_ROOM_DEMO_PLANS },
      };
    },
  },
];
