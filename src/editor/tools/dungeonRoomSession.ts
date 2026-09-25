/**
 * 던전 방 하네스(dungeon-room-v1) 세션 툴 — 공유 엔진(roomHarness/engine) 위임 래퍼.
 * start → advance 반복(멀티턴) 또는 run 원샷 + evaluate + list. 툴 이름은 던전 전용 유지.
 */
import { DUNGEON_ROOM_KIT_ID, DUNGEON_ROOM_THEMES, evaluateDungeonRoom, type DungeonRoomPlan } from "@/editor/dungeonRoomPipeline";
import {
  advanceRoomBuild,
  evaluateRoom,
  listRoomDemos,
  runRoomPipeline,
  startRoomSession,
} from "@/editor/roomHarness/engine";
import { DUNGEON_DESIGN_PROPERTIES } from "./dungeonDesignSchema";
import { REPLACE_EXISTING_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const KIT = DUNGEON_ROOM_KIT_ID;

// 엔진 data에 던전 advance 툴 이름 next 힌트를 얹는다(툴 이름은 키트별).
function withNext(res: ToolExecResult, sessionId: string): ToolExecResult {
  const data = res.data as { done?: boolean } | undefined;
  const done = data?.done ?? false;
  return { ...res, data: { ...(res.data as object), next: done ? null : `advance_dungeon_room_build({ sessionId: "${sessionId}" })` } };
}

export const DUNGEON_ROOM_SESSION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "start_dungeon_room_session",
    description:
      "연결 던전 멀티턴 시공. 방의 역할·연결(graph), seed, character를 지정한다. 테마 용암/석재/얼음. "
      + "절차: plan(방·연결) → ceiling(공간 윤곽) → wall(천장 하단 정방향 벽) "
      + "→ floor → hazard(공동 단차·위험지형·철로·맥락 소품) → critique. "
      + "이어서 advance_dungeon_room_build 반복 또는 run_dungeon_room_pipeline 원샷.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        ...DUNGEON_DESIGN_PROPERTIES,
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer", description: "기본 48. 연결 던전은 최소 18, 단일 방은 최소 8." },
        height: { type: "integer", description: "기본 40. 연결 던전은 최소 18, 단일 방은 최소 8." },
        theme: { type: "string", enum: [...DUNGEON_ROOM_THEMES] },
        hazard: { type: "boolean", description: "단차·위험지형 배치. 기본 true. 소품과 광산 운반선은 character를 따른다." },
        replaceExisting: REPLACE_EXISTING_SCHEMA,
      },
      required: ["mapId", "theme"],
    },
    invalidArgsExample: { mapId: "map_dungeon_lava_1", theme: "lava" },
    invalidArgsHint: "mapId(새 맵 id)와 theme(lava|stone|ice)을 지정하라. 기존 맵 id 를 넣으면 그 맵이 삭제된다.",
    run(draft, args): ToolExecResult {
      const res = startRoomSession(draft, KIT, args);
      const sessionId = (res.data as { sessionId: string }).sessionId;
      return withNext(res, sessionId);
    },
  },
  {
    name: "advance_dungeon_room_build",
    description:
      "던전 세션 체크리스트에서 다음 open 레이어 하나만 시공/검증한다. "
      + "순서: ceiling → wall → floor → hazard → critique.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        forceLayer: { type: "string", enum: ["ceiling", "wall", "floor", "hazard", "critique"] },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "room_dungeon-room-v1_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const forceLayer = args.forceLayer ? String(args.forceLayer) : undefined;
      return withNext(advanceRoomBuild(draft, sessionId, forceLayer), sessionId);
    },
  },
  {
    name: "run_dungeon_room_pipeline",
    description:
      "던전을 공간 구조부터 생성한다. 기본 connected: 역할별 방·굽은 통로·순환 길 → 천장 하단 직선 벽 → 공동의 단차 → 통로를 보존한 소품. "
      + "theme(lava/stone/ice), character(cavern/mine/crystal/crypt), path(straight|cave|winding, 세계관과 이번 요청), seed와 graph(방·연결)를 지정한다. "
      + "theme별: lava = 적암 바닥(301)·붉은 벽, 가장 큰 방을 가로지르는 불의 강 하나 + 판자 다리(141, 통행 가능)와 방마다 불규칙한 용암 웅덩이(통행 불가), 갈색 바위·화로·바닥 불길, 수정·여신상 없음, landmark altar는 제단 마법진(3×3). "
      + "stone = 흙 바닥, 큰 방의 바위 단차 두 줄 + 판자 다리, 회색 바위·수정 방. ice = 눈 바닥, 얼음 능선, 수정 무리. (crypt는 테마와 무관하게 석재 묘실.) "
      + "생성 후 evaluate_dungeon_room으로 통행·지지·철로를 검사하고 show_map_region으로 전체 시각 검토하라. demo는 기존 작은 단일 방이다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        ...DUNGEON_DESIGN_PROPERTIES,
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer", description: "기본 48. 연결 던전은 최소 18, 단일 방은 최소 8." },
        height: { type: "integer", description: "기본 40. 연결 던전은 최소 18, 단일 방은 최소 8." },
        theme: { type: "string", enum: [...DUNGEON_ROOM_THEMES] },
        hazard: { type: "boolean", description: "단차·위험지형 배치. 기본 true. 소품과 광산 운반선은 character를 따른다." },
        demo: { type: "string", enum: [...DUNGEON_ROOM_THEMES], description: "데모 플랜 사용(테마만 지정)" },
        replaceExisting: REPLACE_EXISTING_SCHEMA,
      },
    },
    invalidArgsExample: { mapId: "map_dungeon_lava_1", theme: "lava" },
    invalidArgsHint: "mapId(새 맵 id)와 theme(lava|stone|ice) 또는 demo(lava|stone|ice)를 지정하라.",
    run(draft, args): ToolExecResult {
      const result = runRoomPipeline(draft, KIT, args);
      const data = result.data as { ok?: boolean; plan?: DungeonRoomPlan };
      if (data.plan?.layout === "connected" && data.ok === false) throw new ToolError(`던전 구조 검사 실패: ${(result.warnings ?? []).join("; ")}`, { code: "invalid-args" });
      return result;
    },
  },
  {
    name: "evaluate_dungeon_room",
    description:
      "던전 세션을 평가한다(ok/score/issues). 연결 던전은 실제 방 도달성·벽 지지·소품 조립·철로 접속을 검사한다. 기존 단일 방은 "
      + "바닥 · hazard 시 판자 다리 통행. 불합격이면 issues대로 수정 후 재평가하라.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        mapId: { type: "string", description: "원샷 생성/재로드 후에는 mapId로 저장된 설계를 평가한다." },
        attempt: { type: "integer", description: "자가 수정 루프 회차(기본 1)" },
      },

    },
    invalidArgsExample: { sessionId: "room_dungeon-room-v1_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const attempt = args.attempt !== undefined ? Math.floor(Number(args.attempt)) : 1;
      if (sessionId) return evaluateRoom(draft, sessionId, attempt);
      const mapId = String(args.mapId ?? "");
      const map = draft.maps[mapId];
      if (!map || map.roomHarnessPlan?.kitId !== KIT) throw new ToolError("던전 sessionId 또는 생성된 mapId를 지정하세요.", { code: "invalid-args" });
      const report = evaluateDungeonRoom(map, map.roomHarnessPlan.plan as DungeonRoomPlan, attempt, draft);
      return { summary: report.ok ? "던전 구조 검사 통과. 전체 시각 검토 필요." : "던전 구조 수정 필요", data: { mapId, report } };
    },
  },
  {
    name: "list_dungeon_room_themes",
    description: "dungeon-room-v1 테마 3종(용암/석재/얼음)과 데모 플랜을 나열한다.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(): ToolExecResult {
      return listRoomDemos(KIT);
    },
  },
];
