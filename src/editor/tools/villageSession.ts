// Multi-turn village build: living checklist + one layer per advance.
// Voyager/SceneCraft-style: observe → act(skill) → verify → next open item.

import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { loadSession as loadFromBag, saveSession as saveToBag, sessionExists } from "@/editor/roomHarness/sessionStore";
import type { GameMap, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { CONSTRUCTION_TOOLS_V3 } from "./v3";
import {
  loadVillagePlan,
  normalizeVillagePlan,
  storeVillagePlan,
  type VillageBuildLayerId,
  type VillagePlan,
} from "./villagePlan";
import {
  buildTerrainConstraintMasks,
  applyTerrainPassFromMasks,
  type TerrainConstraintMasks,
} from "./villageTerrainPass";
import { countBroadleaf2x2, evaluateVillageLook, type VillageFix, type VillageLookReport } from "./villageEvaluate";
import { checkReachability } from "@/project/lint/reachability";
import { MAP_TOOLS } from "./mapTools";
import { buildVillageDomain } from "./villageBuilder";
import { RECT_SCHEMA, VILLAGE_HOUSE_PLAN_SCHEMA, VILLAGE_NPC_PLAN_SCHEMA } from "./schemaShapes";
import {
  coerceForestDensity,
  DEFAULT_FOREST_DENSITY,
  FOREST_DENSITIES,
  forestDensityFromText,
  forestPlacementPlan,
  treeFootprintCells,
} from "./forestDensity";

const CONIFER_GROUP = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
const BROADLEAF_2X2_GROUP = `${COMBINED_TOWN_HARNESS_PREFIX}broadleaf-tree-2x2`;
// 침엽수 패스가 먼지 돌기 때문에 커버리지를 다 썬으면 뒤의 2×2 활엽수가 자리를 못 찾아
// forest_big 게이트(군락≥3)가 굴다. 달려서 밀도 지분을 미리 나눠 갖는다.
const CONIFER_COVERAGE_SHARE = 0.45;

export type ChecklistStatus = "pending" | "open" | "done" | "skipped" | "failed";

export type VillageLayerId = VillageBuildLayerId;

export interface VillageChecklistItem {
  readonly id: VillageLayerId;
  readonly title: string;
  status: ChecklistStatus;
  readonly note?: string;
  lastVerify?: string;
  attempts: number;
}

export interface VillageBuildSession {
  readonly version: 1;
  readonly id: string;
  readonly query: string;
  planId: string;
  mapId?: string;
  readonly seed: number;
  readonly budgetTurns: number;
  turnsUsed: number;
  status: "active" | "complete" | "failed";
  checklist: VillageChecklistItem[];
  memory: string[];
  doorFronts?: readonly { x: number; y: number }[];
  lastLook?: VillageLookReport;
  settlementSummary?: string;
  /** plan에 안 들어가는 build_village 추가 의도(레이아웃·폭 등) */
  buildOverrides?: Record<string, unknown>;
}

const VILLAGE_SESSION_BAG = "villageSessions";

const LAYER_TITLES: Record<VillageLayerId, string> = {
  plan: "계획 확정",
  map: "빈 맵 생성",
  settlement: "집→길→울타리·마당·NPC",
  water: "강/호수 지형",
  forest_conifer: "침엽수 숲",
  forest_big: "2×2 활엽수 군락",
  critique: "도달·문 비평",
  look: "룩+상식 게이트",
};

export const VILLAGE_TREE_ASSETS = [
  {
    id: CONIFER_GROUP,
    label: "침엽수 1×2",
    footprint: "1x2",
    tags: ["tree", "conifer", "1x2"],
  },
  {
    id: BROADLEAF_2X2_GROUP,
    label: "활엽수 2×2",
    footprint: "2x2",
    tags: ["tree", "broadleaf", "2x2", "large"],
  },
] as const;

export const VILLAGE_SESSION_TOOLS: readonly ToolDefinition[] = [
  {
    name: "list_village_tree_assets",
    description:
      "마을/숲 시공에 쓸 수 있는 나무 스탬프 카탈로그(침엽수 1×2, 활엽수 2×2). " +
      "plant_tree_clusters / place_props 전에 조회. 맵 변경 없음.",
    mode: "read",
    parameters: { type: "object", properties: {} },
    invalidArgsExample: {},
    run(): ToolExecResult {
      return {
        summary: `나무 에셋 ${VILLAGE_TREE_ASSETS.length}종 (2×2 활엽수 포함)`,
        data: { assets: VILLAGE_TREE_ASSETS },
      };
    },
  },
  {
    name: "start_village_session",
    description:
      "멀티턴 마을 시공 세션을 시작한다. plan을 저장하고 living checklist를 연다. " +
      "이어서 advance_village_build를 반복하거나 run_village_session으로 자동 진행. " +
      "한 방에 끝내려면 run_village_pipeline(숏컷)도 가능하나, 2×2 나무·레이어 검증은 세션 경로가 기본.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string" },
        query: { type: "string" },
        planId: { type: "string" },
        seed: { type: "integer" },
        width: { type: "integer" },
        height: { type: "integer" },
        mapName: { type: "string" },
        budgetTurns: { type: "integer", description: "기본 12" },
        houses: { type: "array", items: VILLAGE_HOUSE_PLAN_SCHEMA },
        npcs: { type: "array", items: VILLAGE_NPC_PLAN_SCHEMA },
        pathStyle: { type: "string" },
        settlementLayout: { type: "string" },
        roadWidth: { type: "integer" },
        buildOrder: {
          type: "array",
          description:
            "LLM 시공 순서. 예 호수마을: [plan,map,water,settlement,forest_conifer,forest_big,critique,look]. " +
            "일반 마을은 water 없이 settlement 먼저. 생략 시 쿼리 상식으로 자동.",
          items: { type: "string" },
        },
      },
    },
    invalidArgsExample: {
      theme: "강촌마을",
      query: "강촌마을",
      seed: 101,
      width: 50,
      height: 50,
      buildOrder: ["plan", "map", "water", "settlement", "forest_conifer", "forest_big", "critique", "look"],
    },
    run(draft, args): ToolExecResult {
      return startVillageSession(draft, args);
    },
  },
  {
    name: "get_village_session",
    description: "세션 상태·체크리스트·메모리·다음 open 레이어를 조회한다(맵 변경 없음).",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "vses_1" },
    run(project, args): ToolExecResult {
      const sessionId = String(args.sessionId ?? "").trim();
      const session = loadSession(project, sessionId);
      if (!session) throw new ToolError(sessionNotFoundMessage(sessionId), { code: "session-not-found" });
      return {
        summary: sessionSummaryLine(session),
        data: sessionView(session),
      };
    },
  },
  {
    name: "evaluate_village_layer",
    description:
      "체크리스트 레이어 단위 검증. layer 생략 시 마지막 진행 레이어 또는 전체 요약. " +
      "실패 시 해당 레이어를 open/failed로 되돌릴 수 있는 힌트 반환.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        mapId: { type: "string" },
        layer: {
          type: "string",
          enum: ["water", "forest_conifer", "forest_big", "settlement", "critique", "look", "all"],
        },
      },
    },
    invalidArgsExample: { sessionId: "vses_1", layer: "forest_big" },
    run(project, args): ToolExecResult {
      return evaluateVillageLayerTool(project, args);
    },
  },
  {
    name: "plant_tree_clusters",
    description:
      "숲 레이어 스킬: 지정 영역에 나무 군락을 심는다. " +
      "style=broadleaf-2x2(기본 권장 대목) | conifer | mixed. " +
      "density=sparse|normal|dense|impassable(기본 dense). 숲·삼림=dense, 울창한·빽빽한·밀림·통행 불가=impassable. " +
      "count 를 비우면 밀도×영역 면적으로 그루 수를 산출한다 — 직접 준 작은 count 로는 숲이 되지 않는다. " +
      "카탈로그는 list_village_tree_assets. 강촌 숲은 conifer 후 broadleaf-2x2를 따로 호출.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        area: {
          ...RECT_SCHEMA,
          description: "{x,y,w,h}. 생략 시 맵 가장자리 띠 또는 세션 forest 마스크",
        },
        style: { type: "string", enum: ["conifer", "broadleaf-2x2", "mixed"] },
        density: {
          type: "string",
          enum: [...FOREST_DENSITIES],
          description: "밀도(기본 dense). impassable = 빈틈 없이 맞닿게 채워 그 지대를 통행 불가로 만든다",
        },
        count: { type: "integer", description: "생략 권장 — density 와 영역 면적에서 자동 산출된다" },
        minGap: { type: "integer" },
        seed: { type: "integer" },
        sessionId: { type: "string", description: "있으면 forest 마스크 영역 우선" },
      },
      required: ["mapId"],
    },
    invalidArgsExample: {
      mapId: "map_village_1",
      style: "broadleaf-2x2",
      density: "dense",
    },
    run(draft, args): ToolExecResult {
      return plantTreeClusters(draft, args);
    },
  },
  {
    name: "advance_village_build",
    description:
      "세션 체크리스트에서 다음 open 레이어 하나만 시공/검증한다. " +
      "매 턴 1 레이어(settlement / water / forest_conifer / forest_big / critique / look). " +
      "에이전트 multi-turn 기본 경로.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        forceLayer: {
          type: "string",
          description: "특정 레이어를 강제로 다시 연다(open→실행)",
        },
      },
      required: ["sessionId"],
    },
    invalidArgsExample: { sessionId: "vses_1" },
    run(draft, args): ToolExecResult {
      return advanceVillageBuild(draft, args);
    },
  },
  {
    name: "run_village_session",
    description:
      "start(또는 기존 sessionId) 후 advance를 완료/예산까지 반복. " +
      "멀티턴 시공 자동 드라이버. 2×2 활엽수·레이어 게이트 포함. " +
      "원샷 숏컷 run_village_pipeline 대신 품질 경로로 사용.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        theme: { type: "string" },
        query: { type: "string" },
        seed: { type: "integer" },
        width: { type: "integer" },
        height: { type: "integer" },
        mapName: { type: "string" },
        budgetTurns: { type: "integer" },
        houses: { type: "array", items: VILLAGE_HOUSE_PLAN_SCHEMA },
        npcs: { type: "array", items: VILLAGE_NPC_PLAN_SCHEMA },
        pathStyle: { type: "string" },
        settlementLayout: { type: "string" },
        roadWidth: { type: "integer" },
        buildOrder: { type: "array", items: { type: "string" } },
        maxAdvances: { type: "integer", description: "기본 = budgetTurns" },
      },
    },
    invalidArgsExample: {
      theme: "강촌마을",
      query: "강촌마을",
      seed: 101,
      width: 50,
      height: 50,
      buildOrder: ["plan", "map", "water", "settlement", "forest_conifer", "forest_big", "critique", "look"],
    },
    run(draft, args): ToolExecResult {
      return runVillageSession(draft, args);
    },
  },
];

export function storeSession(project: Project, session: VillageBuildSession): void {
  saveToBag(project, VILLAGE_SESSION_BAG, session);
}

export function loadSession(project: Project, sessionId: string): VillageBuildSession | undefined {
  return loadFromBag<VillageBuildSession>(project, VILLAGE_SESSION_BAG, sessionId);
}

function startVillageSession(draft: Project, args: Record<string, unknown>): ToolExecResult {
  let plan: VillagePlan;
  if (typeof args.planId === "string" && args.planId.trim()) {
    const existing = loadVillagePlan(draft, args.planId.trim());
    if (!existing) throw new ToolError(`planId 없음: ${args.planId}`, { code: "plan-not-found" });
    plan = existing;
  } else {
    const seed = typeof args.seed === "number" ? args.seed : 1;
    const { plan: next, ok, issues } = normalizeVillagePlan(
      {
        theme: args.theme ?? args.query ?? "마을",
        query: args.query ?? args.theme,
        seed,
        width: args.width,
        height: args.height,
        mapName: args.mapName,
        pathStyle: args.pathStyle,
        settlementLayout: args.settlementLayout,
        roadWidth: args.roadWidth,
        houses: args.houses,
        npcs: args.npcs,
        buildOrder: args.buildOrder,
      },
      seed,
    );
    if (!ok) {
      throw new ToolError(`계획 실패: ${issues.map((i) => i.message).join(" / ")}`, { code: "invalid-plan" });
    }
    storeVillagePlan(draft, next);
    plan = next;
  }

  const seed = plan.seed;
  const sessionId = uniqueSessionId(draft, seed);
  const query = typeof args.query === "string" && args.query.trim()
    ? args.query.trim()
    : plan.theme;
  const budgetTurns = clampInt(args.budgetTurns, 12, 4, 40);
  const needsWater = plan.requirements.landmarks.some((k) =>
    k === "river" || k === "lake" || k === "harbor",
  );
  const needsForest = plan.requirements.landmarks.includes("forest")
    || plan.edgeTrees !== "none";

  // LLM buildOrder 우선 — plan.normalize가 상식 기반 기본 순서를 채움
  const layerOrder = plan.buildOrder.length > 0 ? plan.buildOrder : ["plan", "map", "settlement", "critique", "look"] as VillageLayerId[];

  const checklist: VillageChecklistItem[] = layerOrder.map((id) => {
    let status: ChecklistStatus = "pending";
    if (id === "plan") status = "done";
    else if (id === "map") status = "open";
    else if (id === "water" && !needsWater) status = "skipped";
    else if ((id === "forest_conifer" || id === "forest_big") && !needsForest) status = "skipped";
    return {
      id,
      title: LAYER_TITLES[id] ?? id,
      status,
      attempts: id === "plan" ? 1 : 0,
      note: id === "plan" ? plan.summary : undefined,
      lastVerify: id === "plan" ? "ok" : undefined,
    };
  });

  // first pending after plan/map chain: open map only; others stay pending until previous done
  openNextPendings(checklist);

  const buildOverrides: Record<string, unknown> = {};
  if (args.settlementLayout !== undefined) buildOverrides.settlementLayout = args.settlementLayout;
  if (args.roadWidth !== undefined) buildOverrides.roadWidth = args.roadWidth;
  if (args.pathStyle !== undefined) buildOverrides.pathStyle = args.pathStyle;
  if (args.houses !== undefined) buildOverrides.houses = args.houses;
  if (args.npcs !== undefined) buildOverrides.npcs = args.npcs;
  if (args.width !== undefined) buildOverrides.width = args.width;
  if (args.height !== undefined) buildOverrides.height = args.height;
  if (args.mapName !== undefined) buildOverrides.name = args.mapName;

  const session: VillageBuildSession = {
    version: 1,
    id: sessionId,
    query,
    planId: plan.id,
    seed,
    budgetTurns,
    turnsUsed: 0,
    status: "active",
    checklist,
    memory: [
      `query=${query}`,
      `plan=${plan.id} · ${plan.summary}`,
      `requirements=${plan.requirements.landmarks.join(",") || "none"}`,
      `buildOrder=${layerOrder.join("→")}`,
    ],
    buildOverrides: Object.keys(buildOverrides).length > 0 ? buildOverrides : undefined,
  };
  storeSession(draft, session);

  return {
    summary: `마을 세션 시작 ${sessionId} · plan ${plan.id} · checklist ${checklist.filter((c) => c.status !== "skipped").length} steps`,
    data: {
      sessionId,
      planId: plan.id,
      plan,
      session: sessionView(session),
      treeAssets: VILLAGE_TREE_ASSETS,
      next: `advance_village_build({ sessionId: "${sessionId}" }) 반복 또는 run_village_session({ sessionId: "${sessionId}" })`,
    },
  };
}

function advanceVillageBuild(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const sessionId = String(args.sessionId ?? "").trim();
  const session = loadSession(draft, sessionId);
  if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  if (session.status === "complete") {
    return {
      summary: `세션 이미 완료: ${sessionId}`,
      data: sessionView(session),
    };
  }
  if (session.turnsUsed >= session.budgetTurns) {
    session.status = "failed";
    session.memory.push(`budget exhausted (${session.budgetTurns})`);
    storeSession(draft, session);
    throw new ToolError(`세션 턴 예산 초과 (${session.budgetTurns})`, { code: "budget-exceeded" });
  }

  if (typeof args.forceLayer === "string" && args.forceLayer.trim()) {
    const id = args.forceLayer.trim() as VillageLayerId;
    const item = session.checklist.find((c) => c.id === id);
    if (item && item.status !== "skipped") {
      item.status = "open";
    }
  }

  openNextPendings(session.checklist);
  // Prefer explicitly open; allow failed only when forceLayer reopened it to open
  const item = session.checklist.find((c) => c.status === "open")
    ?? (typeof args.forceLayer === "string"
      ? session.checklist.find((c) => c.id === args.forceLayer && c.status === "failed")
      : undefined);
  if (!item) {
    const failed = session.checklist.find((c) => c.status === "failed");
    if (failed) {
      session.status = "failed";
      storeSession(draft, session);
      return {
        summary: `세션 실패: ${failed.id} — ${failed.lastVerify ?? ""}`,
        data: sessionView(session),
      };
    }
    if (session.checklist.every((c) => c.status === "done" || c.status === "skipped")) {
      session.status = "complete";
      storeSession(draft, session);
      return {
        summary: `세션 완료: ${sessionId}`,
        data: sessionView(session),
      };
    }
    session.status = "failed";
    storeSession(draft, session);
    return {
      summary: `세션 정체: ${sessionId}`,
      data: sessionView(session),
    };
  }
  if (item.status === "failed") item.status = "open";

  session.turnsUsed += 1;
  item.attempts += 1;
  const plan = loadVillagePlan(draft, session.planId);
  if (!plan) throw new ToolError(`plan 없음: ${session.planId}`, { code: "plan-not-found" });

  const warnings: string[] = [];
  let layerData: Record<string, unknown> = {};

  // If a prior layer is failed and we're not force-retrying it, refuse to skip
  const blocked = session.checklist.find(
    (c) => c.status === "failed" && c.id !== item.id,
  );
  if (blocked && !args.forceLayer) {
    session.turnsUsed -= 1;
    item.attempts -= 1;
    storeSession(draft, session);
    throw new ToolError(
      `이전 레이어 실패: ${blocked.id} (${blocked.lastVerify ?? ""}) — forceLayer로 재시도`,
      { code: "layer-blocked" },
    );
  }

  try {
    switch (item.id) {
      case "plan":
        item.status = "done";
        item.lastVerify = "ok";
        break;
      case "map":
        layerData = stepCreateMap(draft, session, plan, args);
        item.status = "done";
        item.lastVerify = `mapId=${session.mapId}`;
        session.memory.push(`map created ${session.mapId}`);
        break;
      case "settlement":
        layerData = stepSettlement(draft, session, plan, warnings);
        {
          // 다른 레이어와 동일하게 실측 verify를 거친다 — build_village 호출 성공 ≠ 집 시공 성공.
          const v = verifyLayer(draft, session, "settlement");
          item.lastVerify = v.detail;
          item.status = v.ok ? "done" : "failed";
          if (!v.ok) session.memory.push(`settlement fail: ${v.detail}`);
          else session.memory.push(`settlement: ${session.settlementSummary ?? "ok"}`);
        }
        break;
      case "water":
        layerData = stepWater(draft, session, plan, warnings);
        {
          const v = verifyLayer(draft, session, "water");
          item.lastVerify = v.detail;
          item.status = v.ok ? "done" : "failed";
          if (!v.ok) session.memory.push(`water fail: ${v.detail}`);
        }
        break;
      case "forest_conifer":
        layerData = stepForestConifer(draft, session, plan, warnings);
        {
          const v = verifyLayer(draft, session, "forest_conifer");
          item.lastVerify = v.detail;
          item.status = v.ok ? "done" : "failed";
          if (!v.ok) session.memory.push(`forest_conifer fail: ${v.detail}`);
        }
        break;
      case "forest_big":
        layerData = stepForestBig(draft, session, plan, warnings);
        {
          const v = verifyLayer(draft, session, "forest_big");
          item.lastVerify = v.detail;
          item.status = v.ok ? "done" : "failed";
          if (!v.ok) session.memory.push(`forest_big fail: ${v.detail}`);
          else session.memory.push(`forest_big: ${v.detail}`);
        }
        break;
      case "critique":
        layerData = stepCritique(draft, session);
        {
          const ok = layerData.ok === true;
          item.lastVerify = String(layerData.summary ?? "");
          item.status = ok ? "done" : "failed";
          if (!ok) session.memory.push(`critique fail: ${item.lastVerify}`);
        }
        break;
      case "look":
        layerData = stepLook(draft, session, plan);
        {
          const report = layerData.report as VillageLookReport | undefined;
          const ok = report?.ok === true;
          item.lastVerify = report
            ? `score=${report.score} ok=${report.ok}`
            : "no report";
          item.status = ok ? "done" : "failed";
          session.lastLook = report;
          if (!ok) session.memory.push(`look fail: ${report?.issues[0] ?? "?"}`);
        }
        break;
      default:
        throw new ToolError(`알 수 없는 레이어: ${item.id}`, { code: "invalid-layer" });
    }
  } catch (err) {
    item.status = "failed";
    item.lastVerify = err instanceof Error ? err.message : String(err);
    session.memory.push(`${item.id} error: ${item.lastVerify}`);
    storeSession(draft, session);
    throw err;
  }

  openNextPendings(session.checklist);
  if (session.checklist.every((c) => c.status === "done" || c.status === "skipped")) {
    session.status = "complete";
  } else if (
    session.checklist.some((c) => c.status === "failed")
    && session.turnsUsed >= session.budgetTurns
  ) {
    session.status = "failed";
  }

  storeSession(draft, session);
  const nextOpen = session.checklist.find((c) => c.status === "open" || c.status === "failed");

  return {
    summary:
      `advance ${item.id} → ${item.status}` +
      (session.mapId ? ` · map ${session.mapId}` : "") +
      (nextOpen ? ` · next ${nextOpen.id}` : " · complete"),
    data: {
      sessionId: session.id,
      layer: item.id,
      layerStatus: item.status,
      layerData,
      session: sessionView(session),
      next: nextOpen
        ? `advance_village_build({ sessionId: "${session.id}" })`
        : "done",
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function runVillageSession(draft: Project, args: Record<string, unknown>): ToolExecResult {
  let sessionId = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
  const log: unknown[] = [];

  if (!sessionId) {
    const started = startVillageSession(draft, args);
    sessionId = String((started.data as { sessionId: string }).sessionId);
    log.push({ start: started.data });
  }

  const session0 = loadSession(draft, sessionId);
  if (!session0) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  const maxAdvances = clampInt(args.maxAdvances, session0.budgetTurns, 1, 40);

  for (let i = 0; i < maxAdvances; i += 1) {
    const session = loadSession(draft, sessionId)!;
    if (session.status === "complete" || session.status === "failed") break;
    if (session.checklist.every((c) => c.status === "done" || c.status === "skipped")) {
      session.status = "complete";
      storeSession(draft, session);
      break;
    }

    // one retry: reopen failed layers with attempts < 2
    let forceLayer: string | undefined;
    const failed = session.checklist.find((c) => c.status === "failed");
    if (failed) {
      if (failed.attempts < 2) {
        failed.status = "open";
        forceLayer = failed.id;
        storeSession(draft, session);
      } else {
        session.status = "failed";
        session.memory.push(`stuck on ${failed.id}: ${failed.lastVerify ?? ""}`);
        storeSession(draft, session);
        break;
      }
    }

    const result = advanceVillageBuild(draft, {
      sessionId,
      ...(forceLayer ? { forceLayer } : {}),
    });
    log.push({
      turn: i + 1,
      summary: result.summary,
      layer: (result.data as { layer?: string })?.layer,
      status: (result.data as { layerStatus?: string })?.layerStatus,
    });

    const after = loadSession(draft, sessionId)!;
    if (after.status === "complete" || after.status === "failed") break;
  }

  const final = loadSession(draft, sessionId)!;
  const look = final.lastLook;
  return {
    summary:
      final.status === "complete"
        ? `마을 세션 완료 ${sessionId} · map ${final.mapId} · look ${look?.score ?? "?"}`
        : `마을 세션 ${final.status} ${sessionId} · turns ${final.turnsUsed}`,
    data: {
      ok: final.status === "complete" && (look?.ok !== false),
      sessionId,
      planId: final.planId,
      mapId: final.mapId,
      status: final.status,
      turnsUsed: final.turnsUsed,
      evaluation: look,
      session: sessionView(final),
      log,
    },
  };
}

function stepCreateMap(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
  _args: Record<string, unknown>,
): Record<string, unknown> {
  const createMap = MAP_TOOLS.find((t) => t.name === "create_map");
  if (!createMap) throw new Error("create_map 툴 없음");
  const width = plan.width ?? 50;
  const height = plan.height ?? 50;
  const name = plan.mapName ?? plan.theme ?? "마을";
  const id = `map_village_${session.seed >>> 0}_${width}x${height}`;
  // reuse if exists
  if (draft.maps[id]) {
    session.mapId = id;
    return { mapId: id, reused: true };
  }
  // unique if collision
  let mapId = id;
  let n = 1;
  while (draft.maps[mapId]) {
    mapId = `${id}_${n}`;
    n += 1;
  }
  createMap.run(draft, { id: mapId, name, width, height, border: "none" });
  session.mapId = mapId;
  if (!draft.startMapId) draft.startMapId = mapId;
  return { mapId, width, height, name };
}

function stepSettlement(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
  warnings: string[],
): Record<string, unknown> {
  if (!session.mapId) throw new ToolError("map 레이어 먼저", { code: "order" });
  const result = buildVillageDomain(draft, {
    planId: plan.id,
    mapId: session.mapId,
    skipTerrain: true,
    edgeTrees: "none", // forest layers handle trees
    fences: plan.fences,
    decor: plan.decor,
    seed: plan.seed,
    ...(session.buildOverrides ?? {}),
  });
  if (result.warnings) warnings.push(...result.warnings);
  const data = (result.data ?? {}) as {
    houses?: { front: { x: number; y: number } }[];
    housesBuilt?: number;
    doorsConnected?: number;
    critique?: { ok?: boolean };
  };
  session.doorFronts = data.houses?.map((h) => h.front) ?? [];
  session.settlementSummary = result.summary;
  return {
    summary: result.summary,
    housesBuilt: data.housesBuilt,
    doorsConnected: data.doorsConnected,
    doorFronts: session.doorFronts,
  };
}

function stepWater(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
  warnings: string[],
): Record<string, unknown> {
  const map = requireMap(draft, session.mapId);
  const masks = buildTerrainConstraintMasks(map, plan.requirements);
  const waterOnly: TerrainConstraintMasks = {
    ...masks,
    forestRects: [],
    notes: masks.notes.filter((n) => n.includes("water") || n.includes("lake")),
  };
  // clear forest roles for this pass (water only)
  const roles = [...masks.roles];
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] === "forest") roles[i] = "buildable";
  }
  const applied = applyTerrainPassFromMasks(
    draft,
    map,
    { ...waterOnly, roles: roles as TerrainConstraintMasks["roles"] },
    warnings,
  );
  return { waterOps: applied.waterOps, notes: applied.notes };
}

function stepForestConifer(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
  warnings: string[],
): Record<string, unknown> {
  const map = requireMap(draft, session.mapId);
  const masks = buildTerrainConstraintMasks(map, plan.requirements);
  const areas = masks.forestRects.length > 0
    ? masks.forestRects
    : edgeBands(map);
  const density = forestDensityFromText(session.query) ?? DEFAULT_FOREST_DENSITY;
  let placed = 0;
  for (let i = 0; i < areas.length; i += 1) {
    const area = areas[i]!;
    const shape = forestPlacementPlan({
      area,
      footprintCells: treeFootprintCells("침엽수"),
      density,
      share: CONIFER_COVERAGE_SHARE,
    });
    placed += placeProps(draft, {
      mapId: map.id,
      area,
      material: "침엽수",
      count: shape.count,
      minGap: shape.minGap,
      naturalness: shape.naturalness,
      packing: shape.packing,
      seed: session.seed + 7700 + i * 13,
    }, warnings);
  }
  return { placed, style: "conifer", areas: areas.length, density };
}

function stepForestBig(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
  warnings: string[],
): Record<string, unknown> {
  const map = requireMap(draft, session.mapId);
  const masks = buildTerrainConstraintMasks(map, plan.requirements);
  const areas = masks.forestRects.length > 0
    ? masks.forestRects
    : edgeBands(map);
  const density = forestDensityFromText(session.query) ?? DEFAULT_FOREST_DENSITY;
  let placed = 0;
  for (let i = 0; i < areas.length; i += 1) {
    const area = areas[i]!;
    const shape = forestPlacementPlan({
      area,
      footprintCells: treeFootprintCells("활엽수"),
      density,
      share: 1 - CONIFER_COVERAGE_SHARE,
    });
    placed += placeProps(draft, {
      mapId: map.id,
      area,
      material: "활엽수",
      count: shape.count,
      minGap: shape.minGap,
      naturalness: shape.naturalness,
      packing: shape.packing,
      seed: session.seed + 8800 + i * 17,
    }, warnings);
  }
  // also sprinkle a few near river if water present
  if (masks.waterRects.length > 0) {
    const w = masks.waterRects[0]!;
    const bank = {
      x: Math.min(map.width - 4, w.x + w.w),
      y: Math.max(1, w.y + 2),
      w: Math.min(6, map.width - (w.x + w.w) - 1),
      h: Math.max(4, w.h - 4),
    };
    if (bank.w >= 2 && bank.h >= 2) {
      placed += placeProps(draft, {
        mapId: map.id,
        area: bank,
        material: "활엽수",
        count: 2,
        minGap: 3,
        naturalness: 0.5,
        seed: session.seed + 9900,
      }, warnings);
    }
  }
  return { placed, style: "broadleaf-2x2", areas: areas.length, density };
}

function stepCritique(draft: Project, session: VillageBuildSession): Record<string, unknown> {
  const map = requireMap(draft, session.mapId);
  const doorFronts = session.doorFronts ?? [];
  const start = draft.startMapId === map.id
    ? draft.startPos
    : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  if (doorFronts.length === 0) {
    return {
      ok: false,
      summary: "문 앞 좌표 0개 — settlement가 집을 만들지 못했거나 문이 유실됐다. settlement 레이어를 재시공하라.",
      reachable: 0,
      targets: 0,
    };
  }
  const reach = checkReachability(draft, map.id, start, [...doorFronts]);
  const ok = reach.reachable;
  return {
    ok,
    summary: ok
      ? `도달 통과 ${doorFronts.length}/${doorFronts.length}`
      : `도달 실패 ${reach.unreachable.length}/${doorFronts.length}`,
    reachable: doorFronts.length - reach.unreachable.length,
    targets: doorFronts.length,
    unreachable: reach.unreachable,
  };
}

function stepLook(
  draft: Project,
  session: VillageBuildSession,
  plan: VillagePlan,
): Record<string, unknown> {
  if (!session.mapId) throw new ToolError("map 없음", { code: "order" });
  const report = evaluateVillageLook({
    project: draft,
    mapId: session.mapId,
    plan,
    doorFronts: session.doorFronts,
    attempt: session.turnsUsed,
    maxAttempts: session.budgetTurns,
  });
  // require 2x2 trees when forest is in checklist
  const needBig = session.checklist.some((c) => c.id === "forest_big" && c.status !== "skipped");
  if (needBig) {
    const map = draft.maps[session.mapId]!;
    const clusters = countBroadleaf2x2(map);
    if (clusters < 3) {
      const patched: VillageLookReport = {
        ...report,
        ok: false,
        score: Math.min(report.score, 0.55),
        issues: [...report.issues, `2×2 활엽수 군락 부족 (${clusters}<3)`],
        feedbackForLlm:
          `${report.feedbackForLlm}\nplant_tree_clusters({ style: "broadleaf-2x2", count: 6 }) 후 재평가.`,
        metrics: {
          ...report.metrics,
          // metrics type may not include tree2x2 — keep base
        },
      };
      return { report: patched, tree2x2Clusters: clusters };
    }
    return { report, tree2x2Clusters: clusters };
  }
  return { report };
}

function plantTreeClusters(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const mapId = String(args.mapId ?? "").trim();
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵 없음: ${mapId}`, { code: "map-not-found" });
  const style = coerceStyle(args.style);
  const seed = typeof args.seed === "number" ? args.seed : 1;
  const density = coerceForestDensity(args.density);
  const warnings: string[] = [];

  let areas: { x: number; y: number; w: number; h: number }[] = [];
  if (args.area && typeof args.area === "object") {
    const a = args.area as { x?: number; y?: number; w?: number; h?: number };
    areas = [{ x: a.x ?? 0, y: a.y ?? 0, w: a.w ?? map.width, h: a.h ?? map.height }];
  } else if (typeof args.sessionId === "string") {
    const session = loadSession(draft, args.sessionId);
    const plan = session ? loadVillagePlan(draft, session.planId) : undefined;
    if (plan) {
      const masks = buildTerrainConstraintMasks(map, plan.requirements);
      areas = masks.forestRects.length > 0 ? [...masks.forestRects] : edgeBands(map);
    }
  }
  if (areas.length === 0) areas = edgeBands(map);

  const materials =
    style === "mixed"
      ? (["침엽수", "활엽수"] as const)
      : style === "conifer"
        ? (["침엽수"] as const)
        : (["활엽수"] as const);

  let placed = 0;
  let requested = 0;
  for (let g = 0; g < materials.length; g += 1) {
    const material = materials[g]!;
    for (let i = 0; i < areas.length; i += 1) {
      const area = areas[i]!;
      const shape = forestPlacementPlan({
        area,
        footprintCells: treeFootprintCells(material),
        density,
        share: 1 / materials.length,
      });
      const count = typeof args.count === "number"
        ? Math.max(1, Math.floor(args.count / materials.length / areas.length))
        : shape.count;
      const minGap = typeof args.minGap === "number" ? Math.max(0, args.minGap) : shape.minGap;
      requested += count;
      placed += placeProps(draft, {
        mapId,
        area,
        material,
        count,
        minGap,
        naturalness: shape.naturalness,
        packing: shape.packing,
        seed: seed + g * 100 + i * 17,
      }, warnings);
    }
  }

  const clusters = countBroadleaf2x2(map);
  const coverage = forestCoverageRatio(map, areas);
  return {
    summary: `나무 군락 시공: style=${style}, density=${density}, placed≈${placed}/${requested}, 2×2군락=${clusters}, 나무 덮은 비율 ${Math.round(coverage * 100)}%`,
    data: {
      mapId,
      style,
      density,
      placed,
      requested,
      treeCoverage: coverage,
      tree2x2Clusters: clusters,
      materials: [...materials],
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function evaluateVillageLayerTool(project: Project, args: Record<string, unknown>): ToolExecResult {
  const sessionId = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
  const session = sessionId ? loadSession(project, sessionId) : undefined;
  const mapId = typeof args.mapId === "string" && args.mapId
    ? args.mapId
    : session?.mapId;
  if (!mapId) throw new ToolError("mapId 또는 sessionId 필요", { code: "invalid-args" });
  const layer = typeof args.layer === "string" ? args.layer : "all";
  const sessionView: Pick<VillageBuildSession, "mapId" | "doorFronts" | "planId"> = session
    ? { mapId: session.mapId, doorFronts: session.doorFronts, planId: session.planId }
    : { mapId, doorFronts: undefined, planId: "" };
  if (layer === "all") {
    const layers = ["water", "forest_conifer", "forest_big", "settlement", "critique", "look"] as const;
    const results = layers.map((l) => verifyLayer(project, sessionView as VillageBuildSession, l));
    return {
      summary: `레이어 검증: ${results.filter((r) => r.ok).length}/${results.length} 통과`,
      data: { results },
    };
  }
  const v = verifyLayer(
    project,
    sessionView as VillageBuildSession,
    layer as VillageLayerId,
  );
  return {
    summary: v.ok ? `레이어 ${layer} 통과` : `레이어 ${layer} 실패: ${v.detail}`,
    data: v,
  };
}

function verifyLayer(
  project: Project,
  session: Pick<VillageBuildSession, "mapId" | "doorFronts" | "planId">,
  layer: VillageLayerId | string,
): {
  ok: boolean;
  layer: string;
  detail: string;
  metrics?: Record<string, number>;
  issues?: readonly string[];
  fixes?: readonly VillageFix[];
} {
  const mapId = session.mapId;
  if (!mapId || !project.maps[mapId]) {
    return { ok: false, layer, detail: "맵 없음" };
  }
  const map = project.maps[mapId]!;
  const plan = session.planId ? loadVillagePlan(project, session.planId) : undefined;

  if (layer === "water") {
    const water = countWater(map);
    const need = plan?.requirements.landmarks.some((k) => k === "river" || k === "lake" || k === "harbor");
    if (!need) return { ok: true, layer, detail: "물 스펙 없음(스킵)", metrics: { water } };
    const ok = water >= 30;
    return { ok, layer, detail: `waterCells=${water}`, metrics: { water } };
  }
  if (layer === "forest_conifer") {
    const trees = countTreeCells(map);
    const ok = trees >= 15;
    return { ok, layer, detail: `treeCells=${trees}`, metrics: { trees } };
  }
  if (layer === "forest_big") {
    const clusters = countBroadleaf2x2(map);
    const ok = clusters >= 3;
    return {
      ok,
      layer,
      detail: `tree2x2Clusters=${clusters}`,
      metrics: { tree2x2Clusters: clusters },
    };
  }
  if (layer === "settlement") {
    const houses = (session.doorFronts?.length ?? 0);
    const ok = houses >= 4 || Object.keys(map.events ?? {}).length >= 4;
    return { ok, layer, detail: `doorFronts=${houses}`, metrics: { doorFronts: houses } };
  }
  if (layer === "critique") {
    const doors = session.doorFronts ?? [];
    if (doors.length === 0) return { ok: false, layer, detail: "doorFronts=0 — settlement 미완, 도달성 검증 불가" };
    const start = project.startMapId === map.id
      ? project.startPos
      : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const reach = checkReachability(project, map.id, start, [...doors]);
    return {
      ok: reach.reachable,
      layer,
      detail: reach.reachable
        ? `reachable ${doors.length}/${doors.length}`
        : `unreachable ${reach.unreachable.length}`,
    };
  }
  if (layer === "look") {
    const report = evaluateVillageLook({
      project,
      mapId,
      plan: plan ?? undefined,
      doorFronts: session.doorFronts,
    });
    const clusters = countBroadleaf2x2(map);
    const needBig = plan?.requirements.landmarks.includes("forest");
    const ok = report.ok && (!needBig || clusters >= 3);
    // 지적과 수정안을 반드시 함께 돌려준다. 점수만 주면(`score=0.34`) 무엇을 고쳐야 할지 알 수 없다 —
    // 실제로 이 값들이 계산된 뒤 버려지고 있었다(2026-07-26).
    return {
      ok,
      layer,
      detail: ok
        ? `score=${report.score} 2x2=${clusters}`
        : `score=${report.score} 2x2=${clusters} — ${report.issues.join(" / ")}`,
      metrics: { score: report.score, tree2x2Clusters: clusters },
      issues: report.issues,
      fixes: report.fixes,
    };
  }
  return { ok: true, layer, detail: "n/a" };
}

// --- helpers ---

function openNextPendings(checklist: VillageChecklistItem[]): void {
  // Sequential: only first pending becomes open. failed stays failed (retry is explicit).
  let opened = false;
  for (const item of checklist) {
    if (item.status === "done" || item.status === "skipped") continue;
    if (item.status === "failed") {
      // do not auto-convert; run_village_session may reopen if attempts < 2
      opened = true; // block later layers until resolved
      continue;
    }
    if (!opened) {
      if (item.status === "pending" || item.status === "open") {
        item.status = "open";
        opened = true;
      }
    } else if (item.status === "open") {
      item.status = "pending";
    }
  }
}

/**
 * 없는 세션 id 에 대한 메시지. 방 하네스 세션 id(`room_…`)를 마을 세션 툴에 넣는 혼동이 흔하므로
 * 올바른 툴을 지목한다 — 2026-08-23 실측: `get_village_session` 이 room 세션 id 를 받고
 * "session 없음" 만 돌려줘 모델이 어디로 가야 할지 알 수 없었다.
 */
function sessionNotFoundMessage(sessionId: string): string {
  if (sessionId.startsWith("room_")) {
    return `session 없음: ${sessionId} — 이 id는 실내/던전 방 하네스 세션입니다. advance_interior_room_build 또는 evaluate_interior_room을 sessionId와 함께 사용하세요.`;
  }
  return `session 없음: ${sessionId} — start_village_session이 돌려준 sessionId(vses_…)를 사용하세요.`;
}

function sessionView(session: VillageBuildSession) {
  const open = session.checklist.filter((c) => c.status === "open" || c.status === "failed");
  return {
    id: session.id,
    status: session.status,
    planId: session.planId,
    mapId: session.mapId,
    query: session.query,
    turnsUsed: session.turnsUsed,
    budgetTurns: session.budgetTurns,
    checklist: session.checklist,
    memory: session.memory.slice(-12),
    nextLayers: open.map((c) => c.id),
    doorFronts: session.doorFronts?.length ?? 0,
    lastLookOk: session.lastLook?.ok,
    lastLookScore: session.lastLook?.score,
  };
}

function sessionSummaryLine(session: VillageBuildSession): string {
  const done = session.checklist.filter((c) => c.status === "done").length;
  const total = session.checklist.filter((c) => c.status !== "skipped").length;
  return `세션 ${session.id}: ${session.status} · ${done}/${total} · next=${session.checklist.find((c) => c.status === "open")?.id ?? "—"}`;
}

function uniqueSessionId(draft: Project, seed: number): string {
  let n = 1;
  let id = `vses_${seed >>> 0}`;
  while (sessionExists(draft, VILLAGE_SESSION_BAG, id)) {
    id = `vses_${seed >>> 0}_${n}`;
    n += 1;
  }
  return id;
}

function requireMap(draft: Project, mapId: string | undefined): GameMap {
  if (!mapId) throw new ToolError("mapId 없음 — map 레이어 먼저", { code: "order" });
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵 없음: ${mapId}`, { code: "map-not-found" });
  return map;
}

function placeProps(
  draft: Project,
  args: Record<string, unknown>,
  warnings: string[],
): number {
  const tool = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "place_props");
  if (!tool) {
    warnings.push("place_props 없음");
    return 0;
  }
  try {
    const result = tool.run(draft, args);
    if (result.warnings) warnings.push(...result.warnings);
    const placed = (result.data as { placed?: number } | undefined)?.placed;
    return typeof placed === "number" ? placed : Number(args.count ?? 0);
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err));
    return 0;
  }
}

function edgeBands(map: GameMap): { x: number; y: number; w: number; h: number }[] {
  const pad = 1;
  const d = Math.max(4, Math.floor(Math.min(map.width, map.height) * 0.12));
  return [
    { x: pad, y: pad, w: map.width - pad * 2, h: d },
    { x: pad, y: map.height - pad - d, w: map.width - pad * 2, h: d },
    { x: pad, y: pad + d, w: d, h: Math.max(1, map.height - pad * 2 - d * 2) },
    { x: map.width - pad - d, y: pad + d, w: d, h: Math.max(1, map.height - pad * 2 - d * 2) },
  ];
}

const TREE_UPPER_TILES = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER_TILES = new Set([290, 291, 292, 293]);

function isTreeCell(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  const u = map.upperTiles[i] ?? 0;
  const l = map.lowerTiles[i] ?? 0;
  return TREE_UPPER_TILES.has(u) || TREE_LOWER_TILES.has(l) || TREE_LOWER_TILES.has(u);
}

/** 시공 보고용 실측 — 지정 rect 들에서 나무가 덮은 칸 비율(0~1). 중복 rect 는 칸 단위로 합집합. */
function forestCoverageRatio(
  map: GameMap,
  areas: readonly { x: number; y: number; w: number; h: number }[],
): number {
  const cells = new Set<number>();
  let treed = 0;
  for (const area of areas) {
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const key = y * map.width + x;
        if (cells.has(key)) continue;
        cells.add(key);
        if (isTreeCell(map, x, y)) treed += 1;
      }
    }
  }
  return cells.size === 0 ? 0 : treed / cells.size;
}

function countTreeCells(map: GameMap): number {
  const upper = new Set([260, 261, 262, 263, 289]);
  const lower = new Set([290, 291, 292, 293]);
  let n = 0;
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    const u = map.upperTiles[i] ?? 0;
    const l = map.lowerTiles[i] ?? 0;
    if (upper.has(u) || lower.has(l) || lower.has(u)) n += 1;
  }
  return n;
}

function countWater(map: GameMap): number {
  let n = 0;
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    const t = map.lowerTiles[i] ?? TILE.EMPTY;
    if (isLakeAutotileTile(t) || isWaterChipsetTile(t) || t === TILE.WATER) n += 1;
  }
  return n;
}

function coerceStyle(value: unknown): "conifer" | "broadleaf-2x2" | "mixed" {
  if (value === "conifer" || value === "mixed" || value === "broadleaf-2x2") return value;
  return "broadleaf-2x2";
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
