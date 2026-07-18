// editor/tools/villageBuilder.ts
// 3층: plan_village(계층 계획) → build_village(제약 시공) → critique_village(비평 루프).

import { findCharsetSemantic, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { stampFootprintHouseKit, type FootprintWing, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import { createHouseDoorEvent, createHouseInteriorMap } from "@/editor/houseInteriors";
import { appendToTree } from "@/editor/mapTreeActions";
import { applyMapDeletion } from "@/project/mapDeletion";
import { DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import { EVENT_TOOLS } from "./eventTools";
import {
  isYardDecorKind,
  materialForYardDecor,
  yardAreaForHouse,
  yardScatterParams,
  type YardDecorKind,
} from "./houseLotDecor";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { CONSTRUCTION_TOOLS_V3 } from "./v3";
import {
  loadVillagePlan,
  MAX_HOUSES,
  MIN_HOUSES,
  normalizeVillagePlan,
  storeVillagePlan,
  storeVillageSpec,
  villagePlanToBuildArgs,
  villagePlanToBuildSpec,
  type EdgeTrees,
  type KitMix,
  type PlazaLayout,
  type PlazaStyle,
  type RoadStyle,
  type YardStyle,
} from "./villagePlan";
import {
  evaluateVillageLook,
  planPatchFromLookReport,
  type VillageLookReport,
} from "./villageEvaluate";
import {
  runTerrainConstraintPass,
  villageBuildAreaFromMasks,
} from "./villageTerrainPass";
import { inferRequirementsFromQuery } from "./villageRequirements";
import { checkReachability } from "@/project/lint/reachability";
import { validateBuildSpec, type BuildSpec } from "@/ai/buildSpec";

/** 주거 배치 패턴 — seed/쿼리로 갈라서 같은 템플릿만 반복하지 않는다. */
type SettlementLayout = "plaza-ring" | "street-grid" | "clusters";

interface VillageIntent {
  readonly theme: string;
  readonly pathStyle: RoadStyle;
  readonly kitMix: KitMix;
  readonly yardStyle: YardStyle;
  readonly plazaStyle: PlazaStyle;
  readonly edgeTrees: EdgeTrees;
  readonly plazaLayout: PlazaLayout;
  readonly roadWidth: number;
  readonly roadNaturalness: number;
  readonly settlementLayout: SettlementLayout;
  /** 집 순서별 마당 태그(LLM). 짧으면 스타일 팩으로 패딩. */
  readonly houseYards: readonly (readonly YardDecorKind[])[];
  /** 집 순서별 키트 강제(LLM). 없으면 kitMix. */
  readonly houseKits: readonly (HouseKitId | undefined)[];
}

const MIN_SIZE = 36;
const MAX_SIZE = 256;
const DEFAULT_SIZE = 50;
const DEFAULT_HOUSES = 8;
// 집 수 경계는 villagePlan에서 단일 소스로 가져온다(MIN_HOUSES=4 / MAX_HOUSES=32).
const PLAZA_WIDTH = 8;
const PLAZA_HEIGHT = 6;
const HOUSE_MARGIN = 2;
/** 마을 길 기본 폭(칸). 예전은 1칸 폴리라인만 써서 실핀처럼 보였다. */
const DEFAULT_ROAD_WIDTH = 2;
const MAX_ROAD_WIDTH = 3;
/** 집 bbox 바깥 1칸 필지에 울타리(상단 투명 오버레이). HOUSE_MARGIN=2라 이웃 집과 겹치지 않는다. */
const FENCE_LOT_MARGIN = 1;
/** 문 앞 남쪽 울타리 게이트 반폭(총 3칸: door.x±1). 길·NPC 동선 확보. */
const FENCE_GATE_HALF_WIDTH = 1;
const FENCE_TOP_LEFT = 378;
const FENCE_TOP_RAIL = 379;
const FENCE_TOP_RIGHT = 380;
const FENCE_SIDE_RAIL = 408;
const FENCE_BOTTOM_RIGHT = 410;
const FENCE_BOTTOM_LEFT = 438;
const FENCE_TILES = new Set<number>([
  FENCE_TOP_LEFT,
  FENCE_TOP_RAIL,
  FENCE_TOP_RIGHT,
  FENCE_SIDE_RAIL,
  FENCE_BOTTOM_RIGHT,
  FENCE_BOTTOM_LEFT,
  409,
  439,
]);
const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;
const WINDOW_TILES = new Set<number>([85, 87]);
/** 감사·울타리 정리용 — 흙길+모래 모두 길로 본다. */
const ROAD_TILES = new Set<number>([
  ...DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds,
  ...DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds,
]);
const DEFAULT_ROAD_STYLE: RoadStyle = "sand";
const HOUSE_KITS: readonly HouseKitId[] = ["blue-stone", "bright-plaster"];
/** 집마다 seed로 고르는 마당 꾸밈 테마(place_props 태그). */
const YARD_THEMES: readonly (readonly YardDecorKind[])[] = [
  ["mailbox", "flowers"],
  ["firewood", "pot"],
  ["bench_h", "jar"],
  ["fruit_box", "flowers"],
  ["wood_box", "pot"],
  ["sign", "mailbox"],
  ["flowers", "jar"],
  ["bench_v", "flowers"],
  ["firewood", "jar", "flowers"],
  ["mailbox", "pot", "wood_box"],
];
const YARD_STYLE_POOLS: Record<YardStyle, readonly (readonly YardDecorKind[])[]> = {
  mixed: YARD_THEMES,
  garden: [
    ["flowers", "pot"],
    ["flowers", "jar"],
    ["bench_h", "flowers"],
    ["pot", "jar", "flowers"],
    ["bench_v", "flowers"],
  ],
  workshop: [
    ["firewood", "wood_box"],
    ["mailbox", "wood_box"],
    ["firewood", "pot"],
    ["sign", "wood_box"],
    ["firewood", "jar"],
  ],
  market: [
    ["fruit_box", "wood_box"],
    ["bench_h", "fruit_box"],
    ["sign", "mailbox"],
    ["fruit_box", "pot"],
    ["bench_h", "jar"],
  ],
  minimal: [["mailbox"], ["flowers"], ["pot"], ["sign"], ["jar"]],
};
const VILLAGE_NPC_GRAPHIC_REFS: readonly (readonly [textureKey: string, characterIndex: number])[] = [
  ["tex_easyrpg_charset_people1", 0],
  ["tex_easyrpg_charset_people2", 0],
  ["tex_easyrpg_charset_people3", 4],
  ["tex_easyrpg_charset_people4", 3],
  ["tex_easyrpg_charset_people5", 6],
  ["tex_easyrpg_charset_people1", 1],
  ["tex_easyrpg_charset_people2", 1],
  ["tex_easyrpg_charset_people3", 6],
  ["tex_easyrpg_charset_people4", 6],
  ["tex_easyrpg_charset_people5", 1],
  ["tex_easyrpg_charset_people1", 3],
  ["tex_easyrpg_charset_people2", 3],
  ["tex_easyrpg_charset_people5", 3],
  ["tex_easyrpg_charset_people1", 5],
  ["tex_easyrpg_charset_people5", 5],
  ["tex_easyrpg_charset_people1", 6],
  ["tex_easyrpg_charset_people5", 7],
  ["tex_easyrpg_charset_people1", 7],
];

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface HouseTemplate {
  readonly id: "rect-large" | "rect-small" | "l" | "u";
  readonly name: string;
  readonly w: number;
  readonly h: number;
  wingsAt(x: number, y: number): FootprintWing[];
}

interface HouseCandidate {
  readonly template: HouseTemplate;
  readonly bbox: Rect;
}

interface BuiltHouse {
  readonly bbox: Rect;
  readonly doorAt: Point;
  readonly front: Point;
  readonly kitId: HouseKitId;
}

interface VillageHouseInteriorRef {
  readonly houseIndex: number;
  readonly ownerName: string;
  readonly interiorMapId: MapId;
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly entry: Point;
  readonly exit: Point;
  readonly returnTo: Point;
}

interface Plaza {
  readonly rect: Rect;
  readonly centerRow: number;
  readonly centerX: number;
}

interface NpcText {
  readonly name: string;
  readonly lines: readonly string[];
}

interface VillageAudit {
  readonly doorsConnected: number;
  readonly doorsIntact: number;
  readonly roadInsideHouses: number;
  readonly roadComponents: number;
  readonly npcCount: number;
  readonly npcsWithText: number;
  readonly windowCount: number;
  readonly fencedHouses: number;
  readonly fenceTiles: number;
}

const HOUSE_TEMPLATES: readonly HouseTemplate[] = [
  {
    id: "rect-large",
    name: "직사각 대",
    w: 8,
    h: 7,
    wingsAt: (x, y) => [{ x, y, w: 8, h: 7 }],
  },
  {
    id: "rect-small",
    name: "직사각 소",
    w: 6,
    h: 6,
    wingsAt: (x, y) => [{ x, y, w: 6, h: 6 }],
  },
  {
    id: "l",
    name: "ㄱ자",
    w: 6,
    h: 8,
    wingsAt: (x, y) => [
      { x, y, w: 3, h: 8 },
      { x: x + 3, y, w: 3, h: 6 },
    ],
  },
  {
    id: "u",
    name: "ㄷ자",
    w: 8,
    h: 8,
    wingsAt: (x, y) => [
      { x, y, w: 8, h: 5 },
      { x, y: y + 5, w: 3, h: 3 },
      { x: x + 5, y: y + 5, w: 3, h: 3 },
    ],
  },
];

const DEFAULT_NPCS: readonly NpcText[] = [
  { name: "민재", lines: ["소라가 아침마다 우물가를 챙겨 줘요.", "이 길만 따라가면 광장까지 금방입니다."] },
  { name: "소라", lines: ["민재가 고친 지붕 덕분에 비가 새지 않아요.", "오늘은 장터에 풋고추가 많이 나왔대요."] },
  { name: "대길", lines: ["새벽에 닭이 울면 남쪽 밭으로 나갑니다.", "광장 대로가 이어져서 짐 나르기가 편해졌어요."] },
  { name: "연화", lines: ["집집마다 창문을 닦아 두니 마을이 밝아졌네요."] },
  { name: "준호", lines: ["동쪽 길은 해 질 무렵에도 잘 보여요.", "아이들이 광장에서 술래잡기를 합니다."] },
  { name: "다솜", lines: ["저녁 국거리로 무를 썰어 두었어요.", "촌장님은 늘 마을 길부터 살피세요."] },
  { name: "태식", lines: ["보라가 부탁한 장작은 광장 옆에 쌓아 두었습니다."] },
  { name: "보라", lines: ["태식 아저씨가 장작을 챙겨 줘서 오늘 밤은 따뜻하겠어요."] },
  { name: "한결", lines: ["서쪽 끝부터 동쪽 끝까지 길이 하나로 이어졌습니다.", "이제 손님도 헤매지 않겠군요."] },
  { name: "미선", lines: ["광장에 두 사람이 더 있으니 장터가 북적이는 것 같아요.", "필요한 물건이 있으면 해 지기 전에 들르세요."] },
];

const createMapTool = requireTool(MAP_TOOLS, "create_map");
const paintRoadTool = requireTool(MAP_TOOLS, "paint_road");
const placeNpcTool = requireTool(EVENT_TOOLS, "place_npc");
const placePropsTool = requireTool(CONSTRUCTION_TOOLS_V3, "place_props");

export const VILLAGE_TOOLS: readonly ToolDefinition[] = [
  {
    name: "plan_village",
    description:
      "마을 계층 계획을 검증·정규화한다(맵 타일은 변경하지 않음). " +
      "theme·pathStyle·yardStyle·plazaStyle·edgeTrees·plazaLayout·houses[{kitId,yard,ownerName}]·npcs·" +
      "buildOrder(시공 레이어 순서: 호수/강이면 water를 settlement 앞)를 넣으면 " +
      "정규화된 VillagePlan + 한 줄 요약 + issues를 돌려준다. 이어서 run_village_session / advance_village_build 또는 build_village({ planId }). " +
      "settlement 내부는 항상 집→길. 빈 계획 금지 — 테마 마을이면 theme을 반드시 넣을 것.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string", description: "마을 테마/사용자 쿼리(예: 강촌마을). 강·숲·장터 등 필수 스펙을 자동 추출한다." },
        query: { type: "string", description: "theme과 별도 원문 쿼리. 있으면 스펙 추출에 우선." },
        pathStyle: { type: "string", enum: ["sand", "dirt"] },
        kitMix: { type: "string", enum: ["mixed", "blue-stone", "bright-plaster"] },
        yardStyle: { type: "string", enum: ["mixed", "garden", "workshop", "market", "minimal"] },
        plazaStyle: { type: "string", enum: ["market", "garden", "empty"] },
        edgeTrees: { type: "string", enum: ["conifer", "dense", "none"] },
        plazaLayout: { type: "string", enum: ["center", "north", "south", "west", "east"] },
        houses: {
          type: "array",
          description: "집 계획 [{kitId?, yard?, ownerName?}]. 개수만 쓰려면 houseCount.",
          items: { type: "object" },
        },
        houseCount: { type: "integer", description: "집 수(4~32). houses 없을 때 사용." },
        housePlans: { type: "array", items: { type: "object" }, description: "houses 별칭" },
        npcs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
          },
        },
        fences: { type: "boolean" },
        decor: { type: "boolean" },
        interior: { type: "boolean" },
        seed: { type: "integer" },
        mapName: { type: "string" },
        name: { type: "string", description: "mapName 별칭" },
        width: { type: "integer" },
        height: { type: "integer" },
        buildOrder: {
          type: "array",
          description:
            "시공 레이어 순서(LLM 기획). 호수/강: water를 settlement 앞. settlement 내부는 집→길 고정. " +
            "예: [plan,map,water,settlement,forest_conifer,forest_big,critique,look]",
          items: { type: "string" },
        },
        id: { type: "string", description: "계획 id(없으면 자동 생성)" },
      },
      required: ["theme"],
    },
    invalidArgsExample: {
      theme: "강가 어촌 장터",
      pathStyle: "sand",
      yardStyle: "market",
      plazaLayout: "south",
      buildOrder: ["plan", "map", "water", "settlement", "forest_conifer", "forest_big", "critique", "look"],
      houses: [
        { kitId: "bright-plaster", yard: ["fruit_box", "bench_h"], ownerName: "어부" },
        { kitId: "blue-stone", yard: ["mailbox", "flowers"], ownerName: "포구지기" },
        { kitId: "bright-plaster", yard: ["wood_box", "pot"] },
        { kitId: "blue-stone", yard: ["sign", "jar"] },
      ],
      npcs: [{ name: "어부", lines: ["오늘 파도가 잔잔하구나."] }],
      seed: 42,
    },
    run(draft, args): ToolExecResult {
      const raw = { ...args };
      if (raw.houses === undefined && raw.housePlans !== undefined) raw.houses = raw.housePlans;
      if (raw.houses === undefined && typeof raw.houseCount === "number") raw.houses = raw.houseCount;
      const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
      const { plan, issues, ok } = normalizeVillagePlan(raw, seed);
      if (!ok) {
        throw new ToolError(
          `마을 계획 검증 실패: ${issues.filter((i) => i.severity === "error").map((i) => i.message).join(" / ")}`,
          { code: "invalid-plan" },
        );
      }
      storeVillagePlan(draft, plan);
      const mapW = plan.width ?? DEFAULT_SIZE;
      const mapH = plan.height ?? DEFAULT_SIZE;
      const draftSpec = villagePlanToBuildSpec(plan, "__pending_map__", mapW, mapH);
      const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);
      return {
        summary: `마을 계획 확정: ${plan.summary}`,
        data: {
          planId: plan.id,
          plan,
          previewSummary: plan.summary,
          draftSpec,
          issues,
          next:
            `materialize_village_spec({ planId: "${plan.id}", mapId }) 또는 ` +
            `run_village_pipeline({ planId: "${plan.id}" }) / build_village({ planId })`,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  },
  {
    name: "materialize_village_spec",
    description:
      "plan_village 결과를 set_build_spec 형태의 BuildSpec으로 파생·검증한다. " +
      "맵이 이미 있어야 한다(mapId). 통과 시 planId에 스펙을 저장. " +
      "에이전트 세션에서는 이 data.spec으로 set_build_spec을 호출하면 된다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        mapId: { type: "string" },
      },
      required: ["planId", "mapId"],
    },
    invalidArgsExample: { planId: "vplan_1", mapId: "map_village_1" },
    run(draft, args): ToolExecResult {
      const planId = String(args.planId ?? "").trim();
      const mapId = String(args.mapId ?? "").trim();
      const plan = loadVillagePlan(draft, planId);
      if (!plan) throw new ToolError(`planId '${planId}' 없음 — plan_village 먼저.`, { code: "plan-not-found" });
      const map = draft.maps[mapId];
      if (!map) throw new ToolError(`맵 없음: ${mapId}`, { code: "map-not-found", mapId });
      const spec = villagePlanToBuildSpec(plan, mapId, map.width, map.height);
      const issues = validateBuildSpec(draft, spec);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        throw new ToolError(
          `스펙 검증 실패: ${errors.map((e) => e.message).join(" / ")}`,
          { code: "spec-invalid" },
        );
      }
      storeVillageSpec(draft, planId, spec);
      return {
        summary: `마을 스펙 확정: assets ${spec.assets.length} · ${spec.title ?? plan.theme}`,
        data: {
          planId,
          mapId,
          spec,
          issues,
          next: `set_build_spec에 동일 spec 제출 후 build_village({ planId: "${planId}", mapId: "${mapId}" })`,
        },
      };
    },
  },
  {
    name: "evaluate_village_look",
    description:
      "시공 후 룩+구조 게이트. 결정론 휴리스틱으로 테마/밀도/광장/나무/도달을 평가하고 " +
      "실패 시 fixes·feedbackForLlm을 반환한다(맵 변경 없음). " +
      "멀티모달 LLM은 show_map_region 이미지와 함께 같은 fixes 스키마로 보완 가능. " +
      "실패 시 revise_village_plan 또는 run_village_pipeline 재시도.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        planId: { type: "string" },
        attempt: { type: "integer" },
        maxAttempts: { type: "integer" },
        doorFronts: { type: "array", items: { type: "object" } },
      },
      required: ["mapId"],
    },
    invalidArgsExample: { mapId: "map_village_1", planId: "vplan_1", attempt: 1 },
    run(project, args): ToolExecResult {
      const mapId = String(args.mapId ?? "");
      const planId = typeof args.planId === "string" ? args.planId : undefined;
      const plan = planId ? loadVillagePlan(project, planId) : undefined;
      const doorFronts = Array.isArray(args.doorFronts)
        ? args.doorFronts
            .filter((e): e is { x: number; y: number } =>
              typeof e === "object" && e !== null
              && typeof (e as { x?: unknown }).x === "number"
              && typeof (e as { y?: unknown }).y === "number")
            .map((e) => ({ x: e.x, y: e.y }))
        : undefined;
      const report = evaluateVillageLook({
        project,
        mapId,
        plan,
        doorFronts,
        attempt: typeof args.attempt === "number" ? args.attempt : 1,
        maxAttempts: typeof args.maxAttempts === "number" ? args.maxAttempts : 2,
      });
      return {
        summary: report.ok
          ? `마을 룩 게이트 통과 (score ${report.score})`
          : `마을 룩 게이트 실패 (score ${report.score}) — ${report.issues[0] ?? "이슈"}`,
        data: report,
      };
    },
  },
  {
    name: "revise_village_plan",
    description:
      "evaluate_village_look 실패 시 feedback fixes를 plan에 패치해 새 planId로 저장한다(맵 변경 없음). " +
      "이어서 materialize_village_spec + build_village 또는 run_village_pipeline.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        evaluation: { type: "object", description: "evaluate_village_look의 data 전체" },
      },
      required: ["planId", "evaluation"],
    },
    invalidArgsExample: { planId: "vplan_1", evaluation: { ok: false, attempt: 1, fixes: [] } },
    run(draft, args): ToolExecResult {
      const planId = String(args.planId ?? "").trim();
      const plan = loadVillagePlan(draft, planId);
      if (!plan) throw new ToolError(`planId '${planId}' 없음`, { code: "plan-not-found" });
      const evaluation = args.evaluation as VillageLookReport;
      const patch = planPatchFromLookReport(plan, evaluation);
      const { plan: next, issues, ok } = normalizeVillagePlan(patch, plan.seed + 1);
      if (!ok) {
        throw new ToolError(`계획 패치 실패: ${issues.map((i) => i.message).join(" / ")}`, { code: "invalid-plan" });
      }
      storeVillagePlan(draft, next);
      return {
        summary: `계획 개정: ${plan.id} → ${next.id} · ${next.summary}`,
        data: {
          previousPlanId: plan.id,
          planId: next.id,
          plan: next,
          previewSummary: next.summary,
          next: `run_village_pipeline({ planId: "${next.id}" }) 또는 build_village({ planId: "${next.id}" })`,
        },
      };
    },
  },
  {
    name: "run_village_pipeline",
    description:
      "plan→(맵 생성)→스펙 파생·검증→build→critique/look 평가. 실패 시 plan 패치 후 최대 maxAttempts회 재시공. " +
      "planId 또는 theme 등 plan 인자. 에디터/에이전트 원큐 파이프라인.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        maxAttempts: { type: "integer", description: "기본 2" },
        theme: { type: "string" },
        seed: { type: "integer" },
        width: { type: "integer" },
        height: { type: "integer" },
        pathStyle: { type: "string" },
        yardStyle: { type: "string" },
        plazaStyle: { type: "string" },
        plazaLayout: { type: "string" },
        edgeTrees: { type: "string" },
        houses: { type: "array", items: { type: "object" } },
        npcs: { type: "array", items: { type: "object" } },
      },
    },
    invalidArgsExample: { planId: "vplan_1", maxAttempts: 2 },
    run(draft, args): ToolExecResult {
      return runVillagePipeline(draft, args);
    },
  },
  {
    name: "critique_village",
    description:
      "시공된 마을의 비평 루프: 문 연결·길 성분·시작점→문 앞 도달을 검사한다. " +
      "build_village 직후 호출. 실패 시 issues와 수정 힌트를 반환(맵은 변경하지 않음).",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        doorFronts: {
          type: "array",
          description: "[{x,y}] 문 앞 좌표. 생략 시 맵 이벤트 중 문 transfer 근처를 추정하지 않고 start만 검사.",
          items: { type: "object" },
        },
      },
      required: ["mapId"],
    },
    invalidArgsExample: { mapId: "map_village_1" },
    run(project, args): ToolExecResult {
      return critiqueVillageMap(project, args);
    },
  },
  {
    name: "build_village",
    description:
      "집 키트 기반 마을을 한 번에 시공한다(제약 시공기). " +
      "**권장:** plan_village 후 build_village({ planId }) 또는 build_village({ plan }). " +
      "또는 theme·housePlans·npcs 등 의도 필드를 직접 전달. " +
      "코드가 광장/길/집/울타리/소품/NPC를 시공하고, data.critique에 문 연결·도달 요약을 넣는다. " +
      "집 좌표를 직접 찍으려면 build_house_lots.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string", description: "plan_village가 돌려준 계획 id" },
        plan: { type: "object", description: "VillagePlan 객체(plan_village 결과 plan 필드)" },
        mapId: { type: "string", description: "기존 맵에 시공한다. 최소 36x36 필요." },
        name: { type: "string", description: "새 맵 이름(기본: 마을 50x50)" },
        width: { type: "integer", description: "새 맵 가로(기본 50, 36~256)" },
        height: { type: "integer", description: "새 맵 세로(기본 50, 36~256)" },
        theme: {
          type: "string",
          description:
            "마을 테마 한 줄(예: 강가 어촌, 산골 광산촌, 장터 마을). pathStyle/yardStyle 등 미지정 시 휴리스틱으로 추론한다.",
        },
        fences: { type: "boolean", description: "집 필지 울타리(기본 true). false면 울타리를 깔지 않는다." },
        decor: {
          type: "boolean",
          description: "마당 소품·외곽 나무·광장 꾸밈(기본 true). false면 소품 산포 생략.",
        },
        pathStyle: {
          type: "string",
          enum: ["sand", "dirt"],
          description: "길 재질. 기본 sand. theme 힌트로 덮일 수 있음.",
        },
        kitMix: {
          type: "string",
          enum: ["mixed", "blue-stone", "bright-plaster"],
          description: "집 키트 믹스(기본 mixed). houses[].kitId가 있으면 집 단위가 우선.",
        },
        yardStyle: {
          type: "string",
          enum: ["mixed", "garden", "workshop", "market", "minimal"],
          description: "마당 꾸밈 스타일 팩(기본 mixed). houses[].yard가 있으면 집 단위가 우선.",
        },
        plazaStyle: {
          type: "string",
          enum: ["market", "garden", "empty"],
          description: "광장 소품(기본 market=벤치+꽃, garden=꽃 위주, empty=없음).",
        },
        skipTerrain: {
          type: "boolean",
          description:
            "true면 강/숲 terrain 패스를 생략한다. multi-turn 세션(advance_village_build)이 water/forest 레이어를 따로 시공할 때 사용.",
        },
        edgeTrees: {
          type: "string",
          enum: ["conifer", "dense", "none"],
          description: "맵 가장자리 나무(기본 conifer, dense=더 많음, none=없음).",
        },
        plazaLayout: {
          type: "string",
          enum: ["center", "north", "south", "west", "east"],
          description: "광장 위치 바이어스(기본 center).",
        },
        bounds: {
          type: "object",
          description: "기존 맵 안에서 마을을 배치할 경계 사각형. 지정 시 그 안에 광장/집/길/NPC를 배치한다.",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            w: { type: "integer" },
            h: { type: "integer" },
          },
          required: ["x", "y", "w", "h"],
        },
        houses: { type: "integer", description: "목표 집 수(기본 8, 4~32). housePlans가 있으면 그 길이가 우선." },
        housePlans: {
          type: "array",
          description:
            "LLM 집 단위 의도 [{kitId?, yard: 태그[]}]. 길이=집 수. " +
            "yard: firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|sign. " +
            "좌표(wings)는 코드가 잡는다 — 좌표까지 직접 찍으려면 build_house_lots.",
          items: {
            type: "object",
            properties: {
              kitId: { type: "string", enum: ["blue-stone", "bright-plaster"] },
              yard: { type: "array", items: { type: "string" }, description: "마당 꾸밈 태그" },
            },
          },
        },
        seed: { type: "integer", description: "결정론 PRNG 시드(기본 1)" },
        interior: { type: "boolean", description: "집마다 내부 맵과 Object1 문 이벤트를 생성(기본 true). false면 기존 외장/문 타일만 만든다." },
        doorEvent: { type: "boolean", description: "Object1 문 이벤트와 내부 맵을 생성(기본 true, interior:false면 비활성)" },
        windows: {
          type: "object",
          description: "창문 자동 배치 옵션(기본: 켜짐). {enabled:false}로 끄고, {spacing:N}으로 창문 사이 벽 칸 수 지정(기본 2). boolean 도 하위 호환으로 수용.",
          properties: {
            enabled: { type: "boolean", description: "창문 배치 여부(기본 true)" },
            spacing: { type: "integer", description: "창문 사이 벽 칸 수(기본 2)" },
          },
        },
        npcs: {
          type: "array",
          description: "LLM이 쓰는 이름/대사 오버라이드. [{name, lines:string[]}] 순서대로 소비(집 주민+광장 2명).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    invalidArgsExample: {
      planId: "vplan_abc",
      seed: 7,
    },
    run(draft, args): ToolExecResult {
      const merged = mergePlanIntoBuildArgs(draft, args);
      const seed = integerArg(merged, "seed", 1);
      const housePlan = coerceHousePlan(merged.houses, merged.housePlans);
      const targetHouses = housePlan.count;
      const interiorEnabled = merged.interior !== false;
      const doorEventEnabled = merged.doorEvent !== false;
      const fencesEnabled = merged.fences !== false;
      const decorEnabled = merged.decor !== false;
      const intent = resolveVillageIntent(merged, housePlan);
      const windows = coerceWindows(merged.windows);
      const overrides = npcOverrides(merged.npcs);
      const warnings: string[] = [];
      if (!intent.theme && !hasExplicitVillageIntent(merged) && !merged.planId) {
        warnings.push(
          "계획/의도 없이 기본 레시피로 시공했다. " +
            "plan_village → build_village({ planId }) 또는 theme·housePlans·npcs를 넘겨라.",
        );
      }
      // create_map name/size may come from plan
      if (merged.name !== undefined) args = { ...args, name: merged.name };
      if (merged.width !== undefined) args = { ...args, width: merged.width };
      if (merged.height !== undefined) args = { ...args, height: merged.height };
      const createArgs = { ...args, ...merged };
      const mapId = typeof createArgs.mapId === "string" && String(createArgs.mapId).trim().length > 0
        ? String(createArgs.mapId).trim()
        : createVillageMap(draft, createArgs, seed);
      const map = requireVillageMap(draft, mapId);
      // 쿼리 상식 스펙: 강/호수 자리를 비운 채 주거 영역만 시공
      const planForReq = typeof merged.planId === "string" ? loadVillagePlan(draft, merged.planId) : undefined;
      const requirements = planForReq?.requirements
        ?? (typeof intent.theme === "string" && intent.theme
          ? inferRequirementsFromQuery(intent.theme)
          : undefined);
      const baseArea = villageBuildArea(map, createArgs.bounds);
      // E 하이브리드: requirements → 제약 마스크 → buildable 영역
      const reserved = villageBuildAreaFromMasks(map, requirements);
      const area = intersectRects(baseArea, reserved);
      assertBuildAreaSize(map, area);
      if (requirements && requirements.landmarks.length > 0) {
        warnings.push(`상식 스펙 적용: ${requirements.mustExist.join(", ")}`);
      }

      const upperBefore = [...map.upperTiles];
      const rng = mulberry32(seed);
      const plaza = villagePlaza(area, intent.plazaLayout, intent.settlementLayout, rng);
      // 자연 시공 순서: 집 배치 → 광장·대로·집 연결 길(얽기설기) → 문 복구 → 울타리
      // (예전엔 길→집이라 길이 집 자리를 선점하는 느낌이 났음)
      const houses = buildHouses(map, area, plaza, targetHouses, rng, windows, intent, warnings);
      paintPlazaAndAvenue(draft, map, plaza, area, intent, seed, warnings);
      // 집마다 문 앞에서 광장까지 우회 연결 — 폭 2 길
      connectHousesToRoads(draft, map, area, plaza, houses, intent, seed, warnings);
      // 넓은 길이 문 타일을 덮을 수 있음 — 문 하단/상단을 다시 찍는다.
      restoreHouseDoors(map, houses);
      // 길은 다 깐 뒤 울타리(길 칸 스킵)
      if (fencesEnabled) placeHouseLotFences(map, houses);

      // E 지형 패스: 마스크의 water/forest를 fill_region·place_props로 채움 (솔버 교체 포인트)
      // multi-turn 세션은 skipTerrain=true 후 water/forest_big 레이어로 분리 시공
      const skipTerrain = args.skipTerrain === true || merged.skipTerrain === true;
      let landmarkNotes: string[] = [];
      if (!skipTerrain && requirements && requirements.landmarks.length > 0) {
        const terrain = runTerrainConstraintPass(draft, map, requirements, warnings);
        landmarkNotes = [...terrain.notes];
        if (terrain.notes.length > 0) warnings.push(`terrainPass: ${terrain.notes.join("; ")}`);
        restoreHouseDoors(map, houses);
      } else if (skipTerrain) {
        landmarkNotes = ["skipTerrain: multi-turn forest/water layers"];
      }

      let decorPlaced = 0;
      if (decorEnabled) {
        decorPlaced = placeVillageDecor(draft, map, area, plaza, houses, seed, intent, warnings);
      }
      const houseInteriors = interiorEnabled && doorEventEnabled
        ? createVillageHouseInteriors(draft, map, houses, overrides, seed)
        : [];
      placeVillageNpcs(draft, map, area, houses, plaza, overrides, seed, warnings);

      // 시작 좌표가 집/울타리 아래로 가면 커밋이 거부된다 — 광장 길로 옮긴다.
      ensureVillageStartPosition(draft, map, plaza);

      const audit = auditVillage(map, houses, upperBefore, area);
      if (houses.length < targetHouses) warnings.push(`집 수 미달: ${houses.length}/${targetHouses}`);
      if (audit.doorsConnected < houses.length) warnings.push(`문 연결 미달: ${audit.doorsConnected}/${houses.length}`);
      if (audit.doorsIntact < houses.length) warnings.push(`문 타일 훼손: ${houses.length - audit.doorsIntact}곳`);
      if (audit.roadInsideHouses > 0) warnings.push(`집 내부를 침범한 도로 ${audit.roadInsideHouses}칸`);
      if (audit.roadComponents !== 1) warnings.push(`길 연결 성분 미달: ${audit.roadComponents}`);
      if (audit.npcCount !== houses.length + 2) warnings.push(`NPC 수 미달: ${audit.npcCount}/${houses.length + 2}`);
      if (audit.npcsWithText !== audit.npcCount) warnings.push(`대사 없는 NPC: ${audit.npcCount - audit.npcsWithText}명`);
      if (interiorEnabled && houseInteriors.length !== houses.length) warnings.push(`내부 생성 미달: ${houseInteriors.length}/${houses.length}`);
      if (fencesEnabled && audit.fencedHouses < houses.length) {
        warnings.push(`울타리 미달: ${audit.fencedHouses}/${houses.length}`);
      }

      const doorFronts = houses.map((house) => house.front);
      const critique = critiqueBuiltVillage(draft, map, doorFronts);
      if (!critique.ok) {
        warnings.push(`비평 루프: ${critique.summary}`);
        for (const issue of critique.issues) warnings.push(issue);
      }

      const themeLabel = intent.theme ? `「${intent.theme}」 ` : "";
      const reqNote = requirements && requirements.landmarks.length > 0
        ? ` 필수[${requirements.landmarks.join(",")}]`
        : "";
      return {
        summary:
          `마을 시공 ${themeLabel}: 집 ${houses.length}/${targetHouses}, 울타리 ${fencesEnabled ? audit.fencedHouses : 0}/${houses.length}, ` +
          `길 ${intent.pathStyle}, 마당 ${intent.yardStyle}, 광장 ${intent.plazaStyle}/${intent.plazaLayout}, ` +
          `소품 ${decorEnabled ? decorPlaced : 0}, 문 연결 ${audit.doorsConnected}/${houses.length}, ` +
          `길 성분 ${audit.roadComponents}, NPC ${audit.npcCount}, 내부 ${houseInteriors.length} (창문 ${audit.windowCount}).` +
          `${reqNote} 비평: ${critique.ok ? "통과" : "이슈"}.`,
        data: {
          mapId,
          bounds: area,
          requirements: requirements ?? undefined,
          landmarks: landmarkNotes,
          planId: typeof merged.planId === "string" ? merged.planId : undefined,
          theme: intent.theme || undefined,
          critique,
          intent: {
            pathStyle: intent.pathStyle,
            kitMix: intent.kitMix,
            yardStyle: intent.yardStyle,
            plazaStyle: intent.plazaStyle,
            edgeTrees: intent.edgeTrees,
            plazaLayout: intent.plazaLayout,
            roadWidth: intent.roadWidth,
            roadNaturalness: intent.roadNaturalness,
            settlementLayout: intent.settlementLayout,
          },
          housesBuilt: houses.length,
          fencesEnabled,
          fencedHouses: fencesEnabled ? audit.fencedHouses : 0,
          fenceTiles: fencesEnabled ? audit.fenceTiles : 0,
          pathStyle: intent.pathStyle,
          decorEnabled,
          decorPlaced: decorEnabled ? decorPlaced : 0,
          doorsConnected: audit.doorsConnected,
          doorsIntact: audit.doorsIntact,
          roadComponents: audit.roadComponents,
          npcCount: audit.npcCount,
          interiorCount: houseInteriors.length,
          doorEventCount: houseInteriors.length,
          houses: houses.map((house, index) => {
            const interiorRef = houseInteriors[index];
            return {
              index,
              kitId: house.kitId,
              doorAt: house.doorAt,
              front: house.front,
              ownerName: npcText(index, overrides).name,
              ...(interiorRef
                ? {
                    interiorMapId: interiorRef.interiorMapId,
                    doorEventId: interiorRef.doorEventId,
                    exitEventId: interiorRef.exitEventId,
                    entry: interiorRef.entry,
                    exit: interiorRef.exit,
                    returnTo: interiorRef.returnTo,
                  }
                : {}),
            };
          }),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  },
];

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

function integerArg(args: Record<string, unknown>, key: string, fallback: number, min?: number, max?: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  }
  if (min !== undefined && value < min) throw new ToolError(`${key}는 ${min} 이상이어야 합니다.`, { code: "invalid-args" });
  if (max !== undefined && value > max) throw new ToolError(`${key}는 ${max} 이하여야 합니다.`, { code: "invalid-args" });
  return value;
}

function coerceWindows(value: unknown): HouseKitWindowsOption | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return false;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("windows는 boolean 또는 {enabled?, spacing?} 객체여야 합니다.", { code: "invalid-args" });
  }
  if ((value as Record<string, unknown>).enabled === false) return false;
  const spacing = (value as Record<string, unknown>).spacing;
  if (spacing === undefined) return {};
  if (typeof spacing !== "number" || !Number.isInteger(spacing) || spacing < 0) {
    throw new ToolError("windows.spacing은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return { spacing };
}

function createVillageMap(draft: Project, args: Record<string, unknown>, seed: number): string {
  const width = integerArg(args, "width", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = integerArg(args, "height", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const name = typeof args.name === "string" && args.name.trim().length > 0 ? args.name.trim() : "마을 50x50";
  const id = uniqueId(draft, "map_village", `${seed >>> 0}_${width}x${height}`);
  createMapTool.run(draft, { id, name, width, height, border: "none" });
  return id;
}

function requireVillageMap(draft: Project, mapId: string): GameMap {
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  return map;
}

function villageBuildArea(map: GameMap, value: unknown): Rect {
  if (value === undefined) return { x: 0, y: 0, w: map.width, h: map.height };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("bounds는 {x,y,w,h} 객체여야 합니다.", { code: "invalid-args", mapId: map.id });
  }
  const bounds = value as Record<string, unknown>;
  for (const field of ["x", "y", "w", "h"] as const) {
    if (typeof bounds[field] !== "number" || !Number.isInteger(bounds[field]) || !Number.isFinite(bounds[field])) {
      throw new ToolError(`bounds.${field}는 정수여야 합니다.`, { code: "invalid-args", mapId: map.id });
    }
  }
  return { x: bounds.x as number, y: bounds.y as number, w: bounds.w as number, h: bounds.h as number };
}

function assertBuildAreaSize(map: GameMap, area: Rect): void {
  if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height) {
    throw new ToolError(`build_village bounds가 맵 경계를 벗어납니다: ${area.x},${area.y},${area.w}x${area.h}`, {
      code: "bounds-out-of-map",
      mapId: map.id,
    });
  }
  if (area.w < MIN_SIZE || area.h < MIN_SIZE) {
    throw new ToolError(`build_village는 최소 ${MIN_SIZE}x${MIN_SIZE} 영역이 필요합니다: ${area.w}x${area.h}`, {
      code: area.w === map.width && area.h === map.height ? "map-too-small" : "bounds-too-small",
      mapId: map.id,
    });
  }
}

function uniqueId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function villagePlaza(
  area: Rect,
  layout: PlazaLayout = "center",
  settlement: SettlementLayout = "plaza-ring",
  rng?: Rng,
): Plaza {
  // 광장 크기: settlement에 따라 가변 (고정 8×6만 쓰지 않음)
  let pw = PLAZA_WIDTH;
  let ph = PLAZA_HEIGHT;
  if (settlement === "street-grid") {
    pw = 6;
    ph = 6;
  } else if (settlement === "clusters") {
    pw = 7 + (rng ? Math.floor(rng() * 3) : 1);
    ph = 5 + (rng ? Math.floor(rng() * 3) : 1);
  } else if (rng) {
    pw = 7 + Math.floor(rng() * 4); // 7~10
    ph = 5 + Math.floor(rng() * 3); // 5~7
  }
  pw = Math.min(pw, Math.max(4, area.w - 10));
  ph = Math.min(ph, Math.max(4, area.h - 10));

  let x = area.x + Math.floor(area.w / 2) - Math.floor(pw / 2);
  let y = area.y + Math.floor(area.h / 2) - Math.floor(ph / 2);
  const margin = HOUSE_MARGIN + 2;
  if (layout === "north") y = area.y + margin + Math.floor(area.h * 0.22);
  if (layout === "south") y = area.y + area.h - margin - ph - Math.floor(area.h * 0.18);
  if (layout === "west") x = area.x + margin + Math.floor(area.w * 0.18);
  if (layout === "east") x = area.x + area.w - margin - pw - Math.floor(area.w * 0.18);
  // clusters: 광장을 약간 비틀어 대칭 깨기
  if (settlement === "clusters" && rng) {
    x += Math.floor((rng() - 0.5) * 4);
    y += Math.floor((rng() - 0.5) * 3);
  }
  x = clamp(x, area.x + margin, area.x + area.w - margin - pw);
  y = clamp(y, area.y + margin, area.y + area.h - margin - ph);
  return {
    rect: { x, y, w: pw, h: ph },
    centerRow: y + Math.floor(ph / 2),
    centerX: x + Math.floor(pw / 2),
  };
}

interface HousePlanCoerced {
  readonly count: number;
  readonly yards: readonly (readonly YardDecorKind[])[];
  readonly kits: readonly (HouseKitId | undefined)[];
}

function coerceHousePlan(housesArg: unknown, housePlansArg: unknown): HousePlanCoerced {
  if (Array.isArray(housePlansArg) && housePlansArg.length > 0) {
    const yards: YardDecorKind[][] = [];
    const kits: (HouseKitId | undefined)[] = [];
    for (let i = 0; i < housePlansArg.length; i += 1) {
      const entry = housePlansArg[i];
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new ToolError(`housePlans[${i}]는 객체여야 합니다.`, { code: "invalid-args" });
      }
      const record = entry as Record<string, unknown>;
      const kit = record.kitId;
      if (kit !== undefined && kit !== "blue-stone" && kit !== "bright-plaster") {
        throw new ToolError(`housePlans[${i}].kitId는 blue-stone|bright-plaster여야 합니다.`, { code: "invalid-args" });
      }
      kits.push(kit as HouseKitId | undefined);
      yards.push(coerceYardTags(record.yard, `housePlans[${i}].yard`));
    }
    const count = Math.min(MAX_HOUSES, Math.max(MIN_HOUSES, housePlansArg.length));
    return { count, yards: yards.slice(0, count), kits: kits.slice(0, count) };
  }
  const count = typeof housesArg === "number" && Number.isInteger(housesArg)
    ? Math.min(MAX_HOUSES, Math.max(MIN_HOUSES, housesArg))
    : DEFAULT_HOUSES;
  if (housesArg !== undefined && (typeof housesArg !== "number" || !Number.isInteger(housesArg))) {
    throw new ToolError("houses는 정수이거나 housePlans 배열을 쓰세요.", { code: "invalid-args" });
  }
  return { count, yards: [], kits: [] };
}

function coerceYardTags(value: unknown, label: string): YardDecorKind[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError(`${label}는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  const out: YardDecorKind[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isYardDecorKind(item)) {
      throw new ToolError(
        `${label} 태그 '${String(item)}'는 지원하지 않습니다. firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|sign`,
        { code: "invalid-args" },
      );
    }
    out.push(item);
  }
  return out;
}

function hasExplicitVillageIntent(args: Record<string, unknown>): boolean {
  return Boolean(
    (typeof args.theme === "string" && args.theme.trim())
    || args.pathStyle !== undefined
    || args.kitMix !== undefined
    || args.yardStyle !== undefined
    || args.plazaStyle !== undefined
    || args.edgeTrees !== undefined
    || args.plazaLayout !== undefined
    || (Array.isArray(args.housePlans) && args.housePlans.length > 0)
    || (Array.isArray(args.npcs) && args.npcs.length > 0),
  );
}

function resolveVillageIntent(args: Record<string, unknown>, housePlan: HousePlanCoerced): VillageIntent {
  const theme = typeof args.theme === "string" ? args.theme.trim() : "";
  const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
  const inferred = inferIntentFromTheme(theme);
  const pathStyle = args.pathStyle !== undefined ? coercePathStyle(args.pathStyle) : (inferred.pathStyle ?? DEFAULT_ROAD_STYLE);
  const kitMix = coerceEnum(args.kitMix, ["mixed", "blue-stone", "bright-plaster"] as const, inferred.kitMix ?? "mixed", "kitMix");
  const yardStyle = coerceEnum(args.yardStyle, ["mixed", "garden", "workshop", "market", "minimal"] as const, inferred.yardStyle ?? "mixed", "yardStyle");
  const plazaStyle = coerceEnum(args.plazaStyle, ["market", "garden", "empty"] as const, inferred.plazaStyle ?? "market", "plazaStyle");
  const edgeTrees = coerceEnum(args.edgeTrees, ["conifer", "dense", "none"] as const, inferred.edgeTrees ?? "conifer", "edgeTrees");
  const plazaLayout = coerceEnum(args.plazaLayout, ["center", "north", "south", "west", "east"] as const, inferred.plazaLayout ?? "center", "plazaLayout");
  // 길 폭·자연도·배치 패턴: 명시 인자 없으면 seed로 다양화 (전부 1칸 직선 금지)
  const roadWidth = typeof args.roadWidth === "number" && Number.isInteger(args.roadWidth)
    ? Math.min(MAX_ROAD_WIDTH, Math.max(2, args.roadWidth))
    : (seed % 2 === 0 ? 3 : DEFAULT_ROAD_WIDTH);
  const roadNaturalness = typeof args.roadNaturalness === "number" && Number.isFinite(args.roadNaturalness)
    ? Math.min(1, Math.max(0.35, args.roadNaturalness))
    : 0.4 + ((seed >>> 3) % 4) * 0.1; // 0.4~0.7
  // plaza-ring을 기본으로 두고 seed로 가끔만 변형 (항상 clusters면 집 수가 줄어 회귀)
  const defaultSettlement: SettlementLayout = seed % 5 === 0
    ? "clusters"
    : seed % 3 === 0
      ? "street-grid"
      : "plaza-ring";
  const settlementLayout = coerceEnum(
    args.settlementLayout,
    ["plaza-ring", "street-grid", "clusters"] as const,
    defaultSettlement,
    "settlementLayout",
  );
  return {
    theme,
    pathStyle,
    kitMix,
    yardStyle,
    plazaStyle,
    edgeTrees,
    plazaLayout,
    roadWidth,
    roadNaturalness,
    settlementLayout,
    houseYards: housePlan.yards,
    houseKits: housePlan.kits,
  };
}

function inferIntentFromTheme(theme: string): Partial<Pick<VillageIntent, "pathStyle" | "kitMix" | "yardStyle" | "plazaStyle" | "edgeTrees" | "plazaLayout">> {
  if (!theme) return {};
  const t = theme.toLowerCase();
  if (/어촌|항구|바다|호수|강가|해안|coast|harbor|lake|river|beach|sand/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", plazaLayout: "south", edgeTrees: "conifer" };
  }
  if (/장터|시장|market|fair|축제/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", edgeTrees: "conifer" };
  }
  if (/농|밭|촌락|farm|rural|목장|목축/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "dense", plazaLayout: "center" };
  }
  if (/광산|산골|mine|mountain|채석/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "workshop", plazaStyle: "empty", edgeTrees: "dense", kitMix: "blue-stone" };
  }
  if (/정원|꽃|garden/.test(t)) {
    return { pathStyle: "sand", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "conifer" };
  }
  return {};
}

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ToolError(`${label}는 ${allowed.join("|")} 중 하나여야 합니다.`, { code: "invalid-args" });
}

function coercePathStyle(value: unknown): RoadStyle {
  if (value === undefined) return DEFAULT_ROAD_STYLE;
  if (value === "sand" || value === "dirt") return value;
  throw new ToolError("pathStyle는 \"sand\" 또는 \"dirt\"여야 합니다.", { code: "invalid-args" });
}

function villageTool(name: string): ToolDefinition {
  const tool = VILLAGE_TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new Error(`마을 툴 없음: ${name}`);
  return tool;
}

function intersectRects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/** plan → build → spec → look 평가 → 실패 시 plan 패치 재시공. */
function runVillagePipeline(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const maxAttempts = typeof args.maxAttempts === "number" && Number.isInteger(args.maxAttempts)
    ? Math.min(3, Math.max(1, args.maxAttempts))
    : 2;

  let planId = typeof args.planId === "string" ? args.planId.trim() : "";
  let plan = planId ? loadVillagePlan(draft, planId) : undefined;

  if (!plan) {
    const theme = typeof args.theme === "string" && args.theme.trim() ? args.theme.trim() : "평범한 마을";
    const planned = villageTool("plan_village").run(draft, { ...args, theme });
    planId = String((planned.data as { planId: string }).planId);
    plan = loadVillagePlan(draft, planId);
  }
  if (!plan || !planId) throw new ToolError("파이프라인에 계획이 없다.", { code: "plan-not-found" });

  const log: Record<string, unknown>[] = [];
  let lastBuildData: Record<string, unknown> | undefined;
  let lastEval: VillageLookReport | undefined;
  let lastSummary = "";

  // 재시공 시 지울 대상을 이번 파이프라인이 만든 맵으로 한정하기 위해 시작 시점 맵 집합을 스냅샷.
  const preExistingMapIds = new Set(Object.keys(draft.maps));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 재시도: 이전 시도가 만든 마을 맵만 제거한다. (구버그: draft.maps={}로 사용자의 무관 맵까지 전체 삭제)
    if (attempt > 1) prunePipelineMaps(draft, preExistingMapIds);

    try {
      const built = villageTool("build_village").run(draft, { planId });
      lastSummary = built.summary;
      lastBuildData = (built.data ?? {}) as Record<string, unknown>;
      log.push({ step: "build", attempt, summary: built.summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push({ step: "build", attempt, error: message });
      throw err;
    }

    const mapId = String(lastBuildData.mapId ?? "");
    try {
      const specResult = villageTool("materialize_village_spec").run(draft, { planId, mapId });
      log.push({ step: "spec", attempt, summary: specResult.summary, spec: (specResult.data as { spec?: BuildSpec })?.spec });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push({ step: "spec", attempt, error: message });
      // 스펙 실패해도 룩 평가는 진행 (시공은 이미 됨)
    }

    const houses = Array.isArray(lastBuildData.houses) ? lastBuildData.houses as { front: { x: number; y: number } }[] : [];
    lastEval = evaluateVillageLook({
      project: draft,
      mapId,
      plan: loadVillagePlan(draft, planId),
      doorFronts: houses.map((house) => house.front),
      attempt,
      maxAttempts,
    });
    log.push({
      step: "evaluate",
      attempt,
      ok: lastEval.ok,
      score: lastEval.score,
      issues: lastEval.issues,
      feedbackForLlm: lastEval.feedbackForLlm,
    });

    if (lastEval.ok) {
      return {
        summary: `마을 파이프라인 성공 (${attempt}/${maxAttempts}): ${lastSummary}`,
        data: {
          ok: true,
          planId,
          mapId,
          attempt,
          maxAttempts,
          evaluation: lastEval,
          build: lastBuildData,
          log,
        },
      };
    }

    if (attempt < maxAttempts) {
      const revised = villageTool("revise_village_plan").run(draft, {
        planId,
        evaluation: lastEval,
      });
      planId = String((revised.data as { planId: string }).planId);
      plan = loadVillagePlan(draft, planId);
      log.push({ step: "revise", attempt, planId, summary: revised.summary, feedback: lastEval.feedbackForLlm });
    }
  }

  return {
    summary: `마을 파이프라인 종료(룩 미통과 ${maxAttempts}회): score ${lastEval?.score ?? 0}`,
    data: {
      ok: false,
      planId,
      mapId: lastBuildData?.mapId,
      attempt: maxAttempts,
      maxAttempts,
      evaluation: lastEval,
      build: lastBuildData,
      log,
    },
    warnings: lastEval?.issues ? [...lastEval.issues] : ["룩 게이트 미통과"],
  };
}

/**
 * 마을 파이프라인 재시공 시, 이번 실행이 새로 만든 맵만 제거한다(사용자의 기존 맵은 보존).
 * 각 맵은 applyMapDeletion으로 참조(트리/연결/이벤트 transfer 등)까지 정리하며 안전 삭제한다.
 */
export function prunePipelineMaps(draft: Project, preExistingMapIds: ReadonlySet<string>): void {
  for (const id of Object.keys(draft.maps)) {
    if (!preExistingMapIds.has(id)) applyMapDeletion(draft, id);
  }
}

/** planId / plan 객체를 build_village 인자로 펼친다. */
function mergePlanIntoBuildArgs(draft: Project, args: Record<string, unknown>): Record<string, unknown> {
  let fromPlan: Record<string, unknown> = {};
  if (typeof args.plan === "object" && args.plan !== null && !Array.isArray(args.plan)) {
    const { plan, ok, issues } = normalizeVillagePlan(args.plan, typeof args.seed === "number" ? args.seed : 1);
    if (!ok) {
      throw new ToolError(
        `plan 검증 실패: ${issues.filter((i) => i.severity === "error").map((i) => i.message).join(" / ")}`,
        { code: "invalid-plan" },
      );
    }
    storeVillagePlan(draft, plan);
    fromPlan = villagePlanToBuildArgs(plan);
  } else if (typeof args.planId === "string" && args.planId.trim()) {
    const stored = loadVillagePlan(draft, args.planId.trim());
    if (!stored) {
      throw new ToolError(
        `planId '${args.planId}' 계획을 찾을 수 없다. 같은 턴/초안에서 plan_village를 먼저 호출하라.`,
        { code: "plan-not-found" },
      );
    }
    fromPlan = villagePlanToBuildArgs(stored);
  }
  // 명시 인자가 plan 기본값을 덮어쓴다.
  return { ...fromPlan, ...args };
}

function ensureVillageStartPosition(draft: Project, map: GameMap, plaza: Plaza): void {
  draft.startMapId = map.id;
  const candidates: Point[] = [
    { x: plaza.centerX, y: plaza.centerRow },
    { x: plaza.rect.x + 1, y: plaza.rect.y + 1 },
    { x: plaza.rect.x + Math.floor(plaza.rect.w / 2), y: plaza.rect.y + plaza.rect.h - 1 },
  ];
  for (const point of candidates) {
    if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) continue;
    const lower = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    // 모래/흙길 타일이면 우선. 아니면 잔디(GRASS)도 허용.
    if (ROAD_TILES.has(lower) || lower === TILE.GRASS) {
      draft.startPos = { x: point.x, y: point.y };
      return;
    }
  }
  draft.startPos = { x: plaza.centerX, y: plaza.centerRow };
}

function critiqueBuiltVillage(
  project: Project,
  map: GameMap,
  doorFronts: readonly Point[],
): { readonly ok: boolean; readonly summary: string; readonly issues: readonly string[]; readonly reachableDoors: number } {
  const issues: string[] = [];
  const start = project.startMapId === map.id
    ? project.startPos
    : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const targets = doorFronts.length > 0 ? doorFronts : [start];
  let reachableDoors = 0;
  try {
    const result = checkReachability(project, map.id, start, [...targets]);
    reachableDoors = targets.length - result.unreachable.length;
    if (!result.reachable) {
      issues.push(`시작점(${start.x},${start.y})에서 도달 불가 ${result.unreachable.length}/${targets.length}곳`);
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  return {
    ok: issues.length === 0,
    summary: issues.length === 0
      ? `시작→문앞 전부 도달 (${reachableDoors}/${targets.length})`
      : issues.join("; "),
    issues,
    reachableDoors,
  };
}

function critiqueVillageMap(project: Project, args: Record<string, unknown>): ToolExecResult {
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  const map = project.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  const fronts: Point[] = [];
  if (Array.isArray(args.doorFronts)) {
    for (const entry of args.doorFronts) {
      if (typeof entry !== "object" || entry === null) continue;
      const rec = entry as Record<string, unknown>;
      if (typeof rec.x === "number" && typeof rec.y === "number") fronts.push({ x: rec.x, y: rec.y });
    }
  }
  // 문 앞 미지정 시: 이벤트 위치(문 이벤트) 남쪽 1칸을 후보로.
  if (fronts.length === 0) {
    for (const event of map.events) {
      fronts.push({ x: event.x, y: Math.min(map.height - 1, event.y + 1) });
    }
  }
  const critique = critiqueBuiltVillage(project, map, fronts.slice(0, 24));
  return {
    summary: `마을 비평: ${critique.summary}`,
    data: critique,
  };
}

function paintPlazaAndAvenue(
  draft: Project,
  map: GameMap,
  plaza: Plaza,
  area: Rect,
  intent: VillageIntent,
  seed: number,
  warnings: string[]
): void {
  const pathStyle = intent.pathStyle;
  const width = intent.roadWidth;
  const naturalness = intent.roadNaturalness;
  // 1) 광장 면 전체 포장 (예전엔 테두리 1칸 링만 그려 광장이 텅 비어 보였음)
  paintFilledRectRoad(draft, map, plaza.rect, pathStyle, seed, warnings);
  // 2) 횡단 대로 — 폭 2~3 + 자연 흔들림
  paintWideRoad(draft, map, pathStyle, [
    { x: area.x + 2, y: plaza.centerRow },
    { x: area.x + area.w - 3, y: plaza.centerRow },
  ], width, naturalness, seed + 11, warnings);
  // 3) 세로 스파인 (street-grid / clusters 에서 더 두드러짐)
  if (intent.settlementLayout !== "plaza-ring" || width >= 2) {
    paintWideRoad(draft, map, pathStyle, [
      { x: plaza.centerX, y: area.y + 2 },
      { x: plaza.centerX, y: area.y + area.h - 3 },
    ], Math.max(2, width - 1), naturalness * 0.85, seed + 22, warnings);
  }
}

/** 직사각 영역 전체를 길로 채운 뒤 오토타일 성형. */
function paintFilledRectRoad(
  draft: Project,
  map: GameMap,
  rect: Rect,
  pathStyle: RoadStyle,
  seed: number,
  warnings: string[],
): void {
  // 행 단위 폴리라인으로 채움 (paint_road 재사용 → 오토타일 유지)
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    paintWideRoad(draft, map, pathStyle, [
      { x: rect.x, y },
      { x: rect.x + rect.w - 1, y },
    ], 1, 0, seed + y, warnings);
  }
}

/**
 * 폭 width 칸 도로. naturalness=0이면 직선 평행선, >0이면 wobble+폭 확장.
 * 예전 마을 빌더는 항상 width=1·naturalness=0 이라 실핀 길이었다.
 */
function paintWideRoad(
  draft: Project,
  map: GameMap,
  pathStyle: RoadStyle,
  points: readonly Point[],
  width: number,
  naturalness: number,
  seed: number,
  warnings: string[],
): void {
  const w = Math.max(1, Math.min(MAX_ROAD_WIDTH, Math.floor(width)));
  // 1) 직선 중심선 먼저 — 연결성 보장 (wobble만 쓰면 길이 끊김)
  runNested(paintRoadTool, draft, {
    mapId: map.id,
    style: pathStyle,
    naturalness: 0,
    seed,
    points: points.map((p) => ({ x: p.x, y: p.y })),
  }, warnings);
  // 2) 평행 오프셋으로 폭 2~3 (전부 직선)
  if (w >= 2) {
    const horizontal = Math.abs(points[points.length - 1]!.x - points[0]!.x)
      >= Math.abs(points[points.length - 1]!.y - points[0]!.y);
    const offsets = w >= 3 ? [-1, 1] : [1];
    for (const off of offsets) {
      const shifted = points.map((p) => (
        horizontal ? { x: p.x, y: p.y + off } : { x: p.x + off, y: p.y }
      ));
      runNested(paintRoadTool, draft, {
        mapId: map.id,
        style: pathStyle,
        naturalness: 0,
        seed: seed + 100 + off * 3,
        points: shifted,
      }, warnings);
    }
  }
  // 흔들림(wobble)은 연결 성분을 깨뜨려 마을 감사(roadComponents=1)를 깨므로 쓰지 않는다.
  // 폭은 평행 오프셋으로만 확보. (자연스러움 파라미터는 향후 부분 경로용으로 예약)
  void naturalness;
  void seed;
}

function runNested(tool: ToolDefinition, draft: Project, args: Record<string, unknown>, warnings: string[]): ToolExecResult {
  const result = tool.run(draft, args);
  if (result.warnings) warnings.push(...result.warnings);
  return result;
}

function buildHouses(
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  target: number,
  rng: Rng,
  windows: HouseKitWindowsOption | undefined,
  intent: VillageIntent,
  warnings: string[]
): BuiltHouse[] {
  const candidates = shuffled(houseCandidates(area, plaza, target, intent.settlementLayout), rng);
  const houses: BuiltHouse[] = [];
  const tryCandidates = (list: readonly HouseCandidate[]): void => {
    for (const candidate of list) {
      if (houses.length >= target) break;
      if (!canPlaceHouse(area, plaza.rect, houses, candidate.bbox)) continue;
      const forced = intent.houseKits[houses.length];
      const kitId = forced
        ?? (intent.kitMix === "mixed"
          ? (HOUSE_KITS[Math.floor(rng() * HOUSE_KITS.length)] as HouseKitId)
          : intent.kitMix);
      const result = stampFootprintHouseKit(map, {
        kitId,
        wings: candidate.template.wingsAt(candidate.bbox.x, candidate.bbox.y),
        windows,
      });
      if (!result.ok || !result.doorAt) {
        warnings.push(`집 시공 실패(${candidate.template.name}): ${result.reason ?? "문 좌표 없음"}`);
        continue;
      }
      const doorAt = result.doorAt;
      map.lowerTiles[(doorAt.y - 1) * map.width + doorAt.x] = DOOR_TOP_TILE;
      map.lowerTiles[doorAt.y * map.width + doorAt.x] = DOOR_BOTTOM_TILE;
      houses.push({ bbox: candidate.bbox, doorAt, front: { x: doorAt.x, y: doorAt.y + 1 }, kitId });
    }
  };
  tryCandidates(candidates);
  // 변형 레이아웃에서 집이 모자라면 고전 위·아래 밴드로 보충
  if (houses.length < target && intent.settlementLayout !== "plaza-ring") {
    tryCandidates(shuffled(houseCandidates(area, plaza, target, "plaza-ring"), rng));
  }
  return houses;
}

function houseCandidates(
  area: Rect,
  plaza: Plaza,
  target: number,
  settlement: SettlementLayout = "plaza-ring",
): HouseCandidate[] {
  const minTemplateWidth = Math.min(...HOUSE_TEMPLATES.map((template) => template.w));
  const wantedColumns = Math.ceil(target / 2);
  const maxColumns = Math.max(1, Math.floor(area.w / (minTemplateWidth + HOUSE_MARGIN * 2)));
  const columns = Math.max(1, Math.min(wantedColumns, maxColumns));
  const allTemplatesFit = columns * 8 + (columns - 1) * HOUSE_MARGIN * 2 + HOUSE_MARGIN * 2 <= area.w;
  const slotWidth = allTemplatesFit ? 8 : minTemplateWidth;
  const templates = HOUSE_TEMPLATES.filter((template) => template.w <= slotWidth);
  const span = columns * slotWidth + (columns - 1) * HOUSE_MARGIN * 2;
  const xStart = area.x + Math.max(HOUSE_MARGIN, Math.floor((area.w - span) / 2));
  const candidates: HouseCandidate[] = [];

  // 공통: 광장 위·아래 밴드
  for (let col = 0; col < columns; col += 1) {
    const slotX = xStart + col * (slotWidth + HOUSE_MARGIN * 2);
    for (const template of templates) {
      const x = slotX + Math.floor((slotWidth - template.w) / 2);
      candidates.push({ template, bbox: { x, y: plaza.rect.y - HOUSE_MARGIN - template.h, w: template.w, h: template.h } });
      candidates.push({ template, bbox: { x, y: plaza.rect.y + plaza.rect.h + HOUSE_MARGIN, w: template.w, h: template.h } });
    }
  }

  // street-grid / clusters: 광장 좌·우 밴드도 후보에 넣어 배치가 위·아래만 되지 않게
  if (settlement === "street-grid" || settlement === "clusters") {
    const rowStep = 7;
    for (let row = area.y + HOUSE_MARGIN; row + 6 < area.y + area.h - HOUSE_MARGIN; row += rowStep) {
      if (row + 6 > plaza.rect.y - 2 && row < plaza.rect.y + plaza.rect.h + 2) continue;
      for (const template of templates) {
        candidates.push({
          template,
          bbox: {
            x: plaza.rect.x - HOUSE_MARGIN - template.w,
            y: row,
            w: template.w,
            h: template.h,
          },
        });
        candidates.push({
          template,
          bbox: {
            x: plaza.rect.x + plaza.rect.w + HOUSE_MARGIN,
            y: row,
            w: template.w,
            h: template.h,
          },
        });
      }
    }
  }

  // clusters: 광장에서 떨어진 코너 클러스터 후보
  if (settlement === "clusters") {
    const corners = [
      { x: area.x + HOUSE_MARGIN + 1, y: area.y + HOUSE_MARGIN + 1 },
      { x: area.x + area.w - HOUSE_MARGIN - 9, y: area.y + HOUSE_MARGIN + 1 },
      { x: area.x + HOUSE_MARGIN + 1, y: area.y + area.h - HOUSE_MARGIN - 9 },
      { x: area.x + area.w - HOUSE_MARGIN - 9, y: area.y + area.h - HOUSE_MARGIN - 9 },
    ];
    for (const corner of corners) {
      for (const template of templates) {
        candidates.push({
          template,
          bbox: { x: corner.x, y: corner.y, w: template.w, h: template.h },
        });
      }
    }
  }

  return candidates;
}

function canPlaceHouse(area: Rect, plaza: Rect, houses: readonly BuiltHouse[], bbox: Rect): boolean {
  if (bbox.x < area.x + HOUSE_MARGIN || bbox.y < area.y + HOUSE_MARGIN) return false;
  if (bbox.x + bbox.w > area.x + area.w - HOUSE_MARGIN) return false;
  if (bbox.y + bbox.h > area.y + area.h - HOUSE_MARGIN) return false;
  if (rectsOverlap(bbox, expandRect(plaza, HOUSE_MARGIN))) return false;
  return houses.every((house) => !rectsOverlap(expandRect(bbox, HOUSE_MARGIN), house.bbox));
}

function expandRect(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = temp;
  }
  return copy;
}

function connectHousesToRoads(
  draft: Project,
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  intent: VillageIntent,
  seed: number,
  warnings: string[]
): void {
  const pathStyle = intent.pathStyle;
  const leftEdge = plaza.rect.x;
  const rightEdge = plaza.rect.x + plaza.rect.w - 1;
  const plazaTop = plaza.rect.y;
  const plazaBottom = plaza.rect.y + plaza.rect.h - 1;
  for (let hi = 0; hi < houses.length; hi += 1) {
    const house = houses[hi] as BuiltHouse;
    const points: Point[] = [house.front];
    if (house.front.y <= plazaTop) {
      // 광장 위 밴드: 문 앞에서 광장 위 변까지 곧장 내려간다(집을 지나지 않음).
      points.push({ x: house.front.x, y: plazaTop }, { x: clamp(house.front.x, leftEdge, rightEdge), y: plazaTop });
    } else {
      // 광장 아래 밴드: 문은 집 남쪽에 있으므로 곧장 광장으로 올리면 집을 관통한다.
      // 집 옆(마진 보장) 복도 열로 우회해 광장 아래 변으로 올라간다.
      const rightCorridor = house.bbox.x + house.bbox.w;
      const corridorX = rightCorridor <= area.x + area.w - 2 ? rightCorridor : house.bbox.x - 1;
      points.push(
        { x: corridorX, y: house.front.y },
        { x: corridorX, y: plazaBottom },
        { x: clamp(corridorX, leftEdge, rightEdge), y: plazaBottom }
      );
    }
    // 진입로 폭 2 + 약한 흔들림 — 집 배치 후 얽기설기 연결 (직선만이면 부자연스러움)
    paintWideRoad(
      draft,
      map,
      pathStyle,
      points,
      2,
      Math.max(0.25, intent.roadNaturalness * 0.5),
      seed + 300 + hi * 17,
      warnings,
    );
  }
}

function restoreHouseDoors(map: GameMap, houses: readonly BuiltHouse[]): void {
  for (const house of houses) {
    const { x, y } = house.doorAt;
    if (y > 0 && y < map.height && x >= 0 && x < map.width) {
      map.lowerTiles[y * map.width + x] = DOOR_BOTTOM_TILE;
      map.lowerTiles[(y - 1) * map.width + x] = DOOR_TOP_TILE;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
      map.upperTiles[(y - 1) * map.width + x] = TILE.EMPTY;
    }
  }
}

/**
 * 마을 소품 레이어.
 * LLM 의도(intent.houseYards / yardStyle / plazaStyle / edgeTrees) → place_props 좌표는 코드.
 */
function placeVillageDecor(
  draft: Project,
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  seed: number,
  intent: VillageIntent,
  warnings: string[]
): number {
  let placed = 0;
  const pool = YARD_STYLE_POOLS[intent.yardStyle];
  for (let i = 0; i < houses.length; i += 1) {
    const house = houses[i] as BuiltHouse;
    const fromPlan = intent.houseYards[i];
    const theme = (fromPlan && fromPlan.length > 0
      ? fromPlan
      : pool[i % pool.length]) as readonly YardDecorKind[];
    const yardArea = yardAreaForHouse(
      map,
      [{ x: house.bbox.x, y: house.bbox.y, w: house.bbox.w, h: house.bbox.h }],
      house.doorAt,
      { depth: 3, pad: 1 },
    );
    for (let d = 0; d < theme.length; d += 1) {
      const kind = theme[d] as YardDecorKind;
      const scatter = yardScatterParams(kind);
      placed += placePropsCount(draft, {
        mapId: map.id,
        area: yardArea,
        material: materialForYardDecor(kind),
        count: 1,
        minGap: scatter.minGap,
        naturalness: scatter.naturalness,
        seed: seed + i * 100 + d * 7 + 11,
      }, warnings);
    }
  }

  const plazaInner = {
    x: plaza.rect.x + 1,
    y: plaza.rect.y + 1,
    w: Math.max(1, plaza.rect.w - 2),
    h: Math.max(1, plaza.rect.h - 2),
  };
  if (intent.plazaStyle === "market") {
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: plazaInner,
      material: "벤치",
      count: 2,
      minGap: 2,
      naturalness: 0.45,
      seed: seed + 901,
    }, warnings);
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: plazaInner,
      material: "꽃",
      count: 3,
      minGap: 1,
      naturalness: 0.55,
      seed: seed + 902,
    }, warnings);
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: plazaInner,
      material: "가로 탁자",
      count: 1,
      minGap: 2,
      naturalness: 0.4,
      seed: seed + 903,
    }, warnings);
  } else if (intent.plazaStyle === "garden") {
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: plazaInner,
      material: "꽃",
      count: 6,
      minGap: 1,
      naturalness: 0.65,
      seed: seed + 901,
    }, warnings);
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: plazaInner,
      material: "벤치",
      count: 1,
      minGap: 2,
      naturalness: 0.5,
      seed: seed + 902,
    }, warnings);
  }

  if (intent.edgeTrees !== "none") {
    const edgePad = 1;
    const density = intent.edgeTrees === "dense" ? 12 : 18;
    const edgeBands: Rect[] = [
      { x: area.x + edgePad, y: area.y + edgePad, w: Math.max(1, area.w - edgePad * 2), h: 3 },
      { x: area.x + edgePad, y: area.y + area.h - edgePad - 3, w: Math.max(1, area.w - edgePad * 2), h: 3 },
      { x: area.x + edgePad, y: area.y + edgePad + 3, w: 3, h: Math.max(1, area.h - edgePad * 2 - 6) },
      { x: area.x + area.w - edgePad - 3, y: area.y + edgePad + 3, w: 3, h: Math.max(1, area.h - edgePad * 2 - 6) },
    ];
    for (let b = 0; b < edgeBands.length; b += 1) {
      const band = edgeBands[b] as Rect;
      if (band.w < 2 || band.h < 2) continue;
      const treeCount = Math.max(2, Math.floor((band.w * band.h) / density));
      placed += placePropsCount(draft, {
        mapId: map.id,
        area: band,
        material: "침엽수",
        count: treeCount,
        minGap: 2,
        naturalness: 0.55,
        seed: seed + 1000 + b * 17,
      }, warnings);
    }
  }

  return placed;
}

function placePropsCount(
  draft: Project,
  args: Record<string, unknown>,
  warnings: string[]
): number {
  try {
    const result = runNested(placePropsTool, draft, args, warnings);
    const data = result.data as Record<string, unknown> | undefined;
    if (typeof data?.placed === "number") return data.placed;
    return typeof args.count === "number" ? args.count : 0;
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err));
    return 0;
  }
}

/** 집 본체 바깥 1칸 직사각 울타리. 문 앞 남쪽 변에 3칸 게이트를 비운다. */
function placeHouseLotFences(map: GameMap, houses: readonly BuiltHouse[]): void {
  for (const house of houses) {
    placeLotFence(map, house);
  }
}

function placeLotFence(map: GameMap, house: BuiltHouse): void {
  const lot = expandRect(house.bbox, FENCE_LOT_MARGIN);
  if (lot.w < 2 || lot.h < 2) return;
  const lastX = lot.x + lot.w - 1;
  const lastY = lot.y + lot.h - 1;
  const gateY = lastY;
  const gateXs = new Set<number>();
  for (let dx = -FENCE_GATE_HALF_WIDTH; dx <= FENCE_GATE_HALF_WIDTH; dx += 1) {
    gateXs.add(house.doorAt.x + dx);
  }
  // front 좌표도 게이트에 포함(문 1칸 아래가 남쪽 변과 어긋나는 키트 대비).
  for (let dx = -FENCE_GATE_HALF_WIDTH; dx <= FENCE_GATE_HALF_WIDTH; dx += 1) {
    gateXs.add(house.front.x + dx);
  }

  const setFence = (x: number, y: number, tile: number): void => {
    if (!pointInMap(map, { x, y })) return;
    if (y === gateY && gateXs.has(x)) return;
    // 길 위에는 울타리를 올리지 않음(게이트·진입로)
    if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) return;
    map.upperTiles[y * map.width + x] = tile;
  };

  for (let x = lot.x + 1; x < lastX; x += 1) {
    setFence(x, lot.y, FENCE_TOP_RAIL);
    setFence(x, lastY, FENCE_TOP_RAIL);
  }
  for (let y = lot.y + 1; y < lastY; y += 1) {
    setFence(lot.x, y, FENCE_SIDE_RAIL);
    setFence(lastX, y, FENCE_SIDE_RAIL);
  }
  setFence(lot.x, lot.y, FENCE_TOP_LEFT);
  setFence(lastX, lot.y, FENCE_TOP_RIGHT);
  setFence(lot.x, lastY, FENCE_BOTTOM_LEFT);
  setFence(lastX, lastY, FENCE_BOTTOM_RIGHT);
}

function houseHasFence(map: GameMap, house: BuiltHouse): boolean {
  const lot = expandRect(house.bbox, FENCE_LOT_MARGIN);
  const lastX = lot.x + lot.w - 1;
  const lastY = lot.y + lot.h - 1;
  // 필지 둘레 어디든 울타리 타일이 있으면 OK (길 폭 때문에 모서리만 보면 놓침)
  for (let x = lot.x; x <= lastX; x += 1) {
    for (const y of [lot.y, lastY]) {
      if (pointInMap(map, { x, y }) && FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  for (let y = lot.y; y <= lastY; y += 1) {
    for (const x of [lot.x, lastX]) {
      if (pointInMap(map, { x, y }) && FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  return false;
}

function countFenceTiles(map: GameMap, area: Rect): number {
  let count = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) count += 1;
    }
  }
  return count;
}

function createVillageHouseInteriors(
  draft: Project,
  map: GameMap,
  houses: readonly BuiltHouse[],
  overrides: readonly Partial<NpcText>[],
  seed: number
): VillageHouseInteriorRef[] {
  const refs: VillageHouseInteriorRef[] = [];
  const mapPart = map.id.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index] as BuiltHouse;
    const owner = npcText(index, overrides).name;
    const base = `${seed >>> 0}_${mapPart}_${index + 1}`;
    const interiorMapId = uniqueId(draft, "map_house_interior", base);
    const doorEventId = uniqueId(draft, "ev_house_door", base);
    const exitEventId = uniqueId(draft, "ev_house_exit", base);
    const interior = createHouseInteriorMap({
      id: interiorMapId,
      name: `${owner}의 집 내부`,
      returnMapId: map.id,
      returnX: house.front.x,
      returnY: house.front.y,
      exitEventId,
      seed: (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0,
    });
    draft.maps[interiorMapId] = interior.map;
    appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
    upsertEvent(map.events, createHouseDoorEvent({
      eventId: doorEventId,
      x: house.doorAt.x,
      y: house.doorAt.y,
      interiorMapId,
      kitId: house.kitId,
      name: `${owner}의 집 문`,
    }));
    refs.push({
      houseIndex: index,
      ownerName: owner,
      interiorMapId,
      doorEventId,
      exitEventId,
      entry: interior.entry,
      exit: interior.exit,
      returnTo: house.front,
    });
  }
  return refs;
}

function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function placeVillageNpcs(
  draft: Project,
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  plaza: Plaza,
  overrides: readonly Partial<NpcText>[],
  seed: number,
  warnings: string[]
): void {
  const occupied = new Set<string>();
  const placements = [
    ...houses.map((house, index) => npcPointNearHouseFront(map, area, house, index, occupied)),
    { x: plaza.centerX - 1, y: plaza.centerRow },
    { x: plaza.centerX + 1, y: plaza.centerRow },
  ];
  const graphics = seededVillageNpcGraphics(seed);
  for (let index = 0; index < placements.length; index += 1) {
    const point = placements[index] as Point;
    const text = npcText(index, overrides);
    const graphic = graphics[index % graphics.length] as CharsetSemanticEntry;
    runNested(placeNpcTool, draft, {
      mapId: map.id,
      x: point.x,
      y: point.y,
      name: text.name,
      graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex },
      movement: "random",
      pages: [{ lines: text.lines }],
      id: uniqueEventId(draft, map.id, seed, index),
    }, warnings);
  }
}

function seededVillageNpcGraphics(seed: number): readonly CharsetSemanticEntry[] {
  const entries = VILLAGE_NPC_GRAPHIC_REFS.map(([textureKey, characterIndex]) => findCharsetSemantic(textureKey, characterIndex))
    .filter((entry): entry is CharsetSemanticEntry => entry !== undefined);
  if (entries.length === 0) throw new Error("마을 NPC 그래픽 후보가 비어 있습니다.");
  const rng = mulberry32((seed ^ 0x6d2b79f5) >>> 0);
  const offset = Math.floor(rng() * entries.length);
  return [...entries.slice(offset), ...entries.slice(0, offset)];
}

function npcPointNearHouseFront(map: GameMap, area: Rect, house: BuiltHouse, index: number, occupied: Set<string>): Point {
  const leftFirst = index % 2 === 0;
  const candidates = leftFirst
    ? [
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x - 2, y: house.front.y },
        { x: house.front.x + 2, y: house.front.y },
      ]
    : [
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x + 2, y: house.front.y },
        { x: house.front.x - 2, y: house.front.y },
      ];
  for (const point of candidates) {
    if (!pointInMap(map, point)) continue;
    if (!pointInRect(point, area)) continue;
    if (point.x === house.front.x && point.y === house.front.y) continue;
    if (point.x === house.doorAt.x && point.y === house.doorAt.y) continue;
    if (pointInRect(point, house.bbox)) continue;
    const key = coordKey(point.x, point.y);
    if (occupied.has(key)) continue;
    occupied.add(key);
    return point;
  }
  const fallback = house.front;
  occupied.add(coordKey(fallback.x, fallback.y));
  return fallback;
}

function pointInMap(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function pointInRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}

function uniqueEventId(draft: Project, mapId: string, seed: number, index: number): string {
  const mapPart = mapId.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  const base = `ev_village_${seed >>> 0}_${mapPart}_${index + 1}`;
  let id = base;
  let suffix = 2;
  const existing = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (existing.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function npcOverrides(value: unknown): Partial<NpcText>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError("npcs는 [{name, lines}] 배열이어야 합니다.", { code: "invalid-args" });
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ToolError(`npcs[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const record = entry as Record<string, unknown>;
    const name = record.name;
    const lines = record.lines;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      throw new ToolError(`npcs[${index}].name은 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
    }
    if (lines !== undefined && (!Array.isArray(lines) || !lines.every((line) => typeof line === "string" && line.length > 0))) {
      throw new ToolError(`npcs[${index}].lines는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
    }
    return {
      ...(typeof name === "string" ? { name: name.trim() } : {}),
      ...(Array.isArray(lines) ? { lines: lines as string[] } : {}),
    };
  });
}

function npcText(index: number, overrides: readonly Partial<NpcText>[]): NpcText {
  const base = DEFAULT_NPCS[index % DEFAULT_NPCS.length] as NpcText;
  const override = overrides[index];
  const name = override?.name ?? (index < DEFAULT_NPCS.length ? base.name : `${base.name}${Math.floor(index / DEFAULT_NPCS.length) + 1}`);
  const lines = override?.lines && override.lines.length > 0 ? override.lines : base.lines;
  return { name, lines };
}

function auditVillage(map: GameMap, houses: readonly BuiltHouse[], upperBefore: readonly number[], area: Rect): VillageAudit {
  const doorsConnected = houses.filter((house) => doorHasRoad(map, house.doorAt)).length;
  // 문 타일 자체가 살아있는지(도로 관통 등으로 덮이지 않았는지)도 직접 검사한다.
  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
  const doorsIntact = houses.filter(
    (house) => lowerAt(house.doorAt.x, house.doorAt.y) === DOOR_BOTTOM_TILE && lowerAt(house.doorAt.x, house.doorAt.y - 1) === DOOR_TOP_TILE
  ).length;
  let roadInsideHouses = 0;
  for (const house of houses) {
    for (let y = house.bbox.y; y < house.bbox.y + house.bbox.h; y += 1) {
      for (let x = house.bbox.x; x < house.bbox.x + house.bbox.w; x += 1) {
        if (ROAD_TILES.has(lowerAt(x, y))) roadInsideHouses += 1;
      }
    }
  }
  const roadComponents = countRoadComponents(map, area);
  const fencedHouses = houses.filter((house) => houseHasFence(map, house)).length;
  const fenceTiles = countFenceTiles(map, area);
  const npcEvents = map.events.filter(isNpcEvent);
  const npcsWithText = npcEvents.filter(eventHasText).length;
  let windowCount = 0;
  for (let i = 0; i < map.upperTiles.length; i += 1) {
    if (upperBefore[i] !== map.upperTiles[i] && WINDOW_TILES.has(map.upperTiles[i] ?? TILE.EMPTY)) windowCount += 1;
  }
  return {
    doorsConnected,
    doorsIntact,
    roadInsideHouses,
    roadComponents,
    npcCount: npcEvents.length,
    npcsWithText,
    windowCount,
    fencedHouses,
    fenceTiles,
  };
}

function doorHasRoad(map: GameMap, door: Point): boolean {
  for (let y = door.y + 1; y <= door.y + 3; y += 1) {
    for (let x = door.x - 1; x <= door.x + 1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  return false;
}

function countRoadComponents(map: GameMap, area: Rect): number {
  const road = new Set<string>();
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) road.add(coordKey(x, y));
    }
  }
  let components = 0;
  while (road.size > 0) {
    const first = road.values().next().value as string | undefined;
    if (!first) break;
    components += 1;
    const stack = [first];
    road.delete(first);
    while (stack.length > 0) {
      const key = stack.pop() as string;
      const point = pointFromKey(key);
      for (const next of [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
      ]) {
        const nextKey = coordKey(next.x, next.y);
        if (!road.has(nextKey)) continue;
        road.delete(nextKey);
        stack.push(nextKey);
      }
    }
  }
  return components;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

function pointFromKey(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

function isNpcEvent(event: GameEvent): boolean {
  return event.id.startsWith("ev_village_");
}

function eventHasText(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) => page.commands.some(isTextCommand));
}

function isTextCommand(command: Command): boolean {
  return command.kind === "text";
}
