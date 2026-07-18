/**
 * 던전 방 하네스(dungeon-room-v1) 세션 툴 — 공유 엔진(roomHarness/engine) 위임 래퍼.
 * start → advance 반복(멀티턴) 또는 run 원샷 + evaluate + list. 툴 이름은 던전 전용 유지.
 */
import { DUNGEON_ROOM_KIT_ID, DUNGEON_ROOM_THEMES } from "@/editor/dungeonRoomPipeline";
import {
  advanceRoomBuild,
  evaluateRoom,
  listRoomDemos,
  runRoomPipeline,
  startRoomSession,
} from "@/editor/roomHarness/engine";
import type { ToolDefinition, ToolExecResult } from "./types";

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
      "던전 방(dungeon-room-v1) 멀티턴 시공 세션을 시작한다. 테마 용암/석재/얼음. "
      + "절차: plan → ceiling(테마 천장 공허 프레임) → wall(천장 하단 직선 벽 [좌끝·가로증식·우끝], 대각 금지) "
      + "→ floor → hazard(중앙 위험지형 + 상위 레이어 판자 다리) → critique. "
      + "이어서 advance_dungeon_room_build 반복 또는 run_dungeon_room_pipeline 원샷.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer", description: "기본 26 (최소 8)" },
        height: { type: "integer", description: "기본 18 (최소 8)" },
        theme: { type: "string", enum: [...DUNGEON_ROOM_THEMES] },
        hazard: { type: "boolean", description: "중앙 위험지형+다리 배치. 기본 true" },
      },
      required: ["theme"],
    },
    invalidArgsExample: { theme: "lava" },
    invalidArgsHint: "theme(lava|stone|ice)을 지정하라.",
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
      "던전 방을 원샷 절차 생성한다(ceiling→wall→floor→hazard). 테마 용암/석재/얼음. "
      + "2D 쿼터뷰: 테마 천장(공허)이 방을 감싸고 벽 면은 천장 하단(남향)에만 직선 [좌끝·가로증식·우끝]으로 보인다. "
      + "중앙에 위험지형(용암/구덩이/급류) + 상위 레이어 판자 다리. demo로 기본 26×18 데모 생성 가능. "
      + "멀티턴 품질 경로는 start_dungeon_room_session을 써라.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        name: { type: "string" },
        width: { type: "integer", description: "기본 26 (최소 8)" },
        height: { type: "integer", description: "기본 18 (최소 8)" },
        theme: { type: "string", enum: [...DUNGEON_ROOM_THEMES] },
        hazard: { type: "boolean", description: "중앙 위험지형+다리 배치. 기본 true" },
        demo: { type: "string", enum: [...DUNGEON_ROOM_THEMES], description: "데모 플랜 사용(테마만 지정)" },
      },
    },
    invalidArgsExample: { theme: "lava" },
    invalidArgsHint: "theme(lava|stone|ice) 또는 demo(lava|stone|ice)를 지정하라.",
    run(draft, args): ToolExecResult {
      return runRoomPipeline(draft, KIT, args);
    },
  },
  {
    name: "evaluate_dungeon_room",
    description:
      "던전 세션 완성 맵을 평가한다(ok/score/issues). 검사: 천장 프레임 · 천장 하단 직선 벽(대각 부재) · "
      + "바닥 · hazard 시 판자 다리 통행. 불합격이면 issues대로 수정 후 재평가하라.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        attempt: { type: "integer", description: "자가 수정 루프 회차(기본 1)" },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "room_dungeon-room-v1_1" },
    run(draft, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const attempt = args.attempt !== undefined ? Math.floor(Number(args.attempt)) : 1;
      return evaluateRoom(draft, sessionId, attempt);
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
