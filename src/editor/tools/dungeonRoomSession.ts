/**
 * 던전 방 하네스 세션 툴 — run_dungeon_room_pipeline(원샷) + list_dungeon_room_themes.
 * dungeon-room-v1 파이프라인(dungeonRoomPipeline.ts)을 LLM 툴로 노출한다.
 */
import {
  DUNGEON_ROOM_DEMO_PLANS,
  DUNGEON_ROOM_KIT_ID,
  DUNGEON_ROOM_THEMES,
  ensureDungeonRoomHarness,
  runDungeonRoomPipeline,
  type DungeonRoomPlan,
  type DungeonRoomTheme,
} from "@/editor/dungeonRoomPipeline";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project } from "@/project/types";

function registerMapInTree(draft: Project, mapId: string): void {
  if (!draft.maps[draft.mapTree.mapId]) {
    draft.mapTree = { mapId, children: [] };
  } else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((child) => child.mapId === mapId)) {
    draft.mapTree.children.push({ mapId, children: [] });
  }
}

function parsePlan(args: Record<string, unknown>): DungeonRoomPlan {
  const theme = String(args.theme ?? "").trim() as DungeonRoomTheme;
  if (!DUNGEON_ROOM_THEMES.includes(theme)) {
    throw new ToolError(`theme must be ${DUNGEON_ROOM_THEMES.join("|")}`, { code: "invalid-args" });
  }
  const mapId = String(args.mapId ?? `map_dungeon_${theme}`).trim();
  const name = String(args.name ?? mapId).trim();
  const width = Math.max(8, Math.floor(Number(args.width ?? 26)));
  const height = Math.max(8, Math.floor(Number(args.height ?? 18)));
  const hazard = args.hazard === undefined ? true : Boolean(args.hazard);
  return { mapId, name, width, height, theme, hazard };
}

export const DUNGEON_ROOM_SESSION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "run_dungeon_room_pipeline",
    description:
      "던전 방을 원샷 절차 생성한다(ceiling→wall→floor→hazard). 테마 용암/석재/얼음. "
      + "2D 쿼터뷰 규칙: 테마 천장(공허)이 방을 감싸고 벽 면은 천장 하단(남향)에만 직선 [좌끝·증식·우끝]으로 보인다. "
      + "중앙에 위험지형(용암/구덩이/급류) + 상위 레이어 판자 다리. demo로 기본 26×18 데모 생성 가능.",
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
      ensureDungeonRoomHarness(draft);
      let plan: DungeonRoomPlan;
      const demo = args.demo ? String(args.demo) : "";
      if (demo) {
        const found = DUNGEON_ROOM_DEMO_PLANS.find((p) => p.theme === demo);
        if (!found) throw new ToolError(`unknown demo ${demo}`, { code: "invalid-args" });
        plan = found;
        if (args.mapId) plan = { ...plan, mapId: String(args.mapId) };
        if (args.name) plan = { ...plan, name: String(args.name) };
      } else {
        plan = parsePlan(args);
      }
      const result = runDungeonRoomPipeline(plan);
      draft.maps[plan.mapId] = result.map;
      registerMapInTree(draft, plan.mapId);
      return {
        summary: result.ok ? `던전 파이프라인 완료 ${plan.mapId} (${plan.theme})` : `던전 파이프라인 경고 ${result.warnings.length}`,
        warnings: result.warnings,
        data: { kitId: DUNGEON_ROOM_KIT_ID, plan, log: result.log, ok: result.ok },
      };
    },
  },
  {
    name: "list_dungeon_room_themes",
    description: "dungeon-room-v1 테마 3종(용암/석재/얼음)과 데모 플랜을 나열한다.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(): ToolExecResult {
      return { summary: `테마 ${DUNGEON_ROOM_THEMES.length}종`, data: { kitId: DUNGEON_ROOM_KIT_ID, themes: DUNGEON_ROOM_THEMES, plans: DUNGEON_ROOM_DEMO_PLANS } };
    },
  },
];
