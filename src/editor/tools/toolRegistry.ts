// editor/tools/toolRegistry.ts
// 모든 툴(읽기+쓰기)의 단일 레지스트리. 툴 추가 = 각 *Tools.ts 배열에 한 줄 추가로 끝난다.
// toOpenAiTools()로 OpenAI function calling `tools` 배열을 자동 파생한다.

import { BATTLE_TOOLS } from "./battleTools";
import { CLUSTER_RULE_TOOLS } from "./clusterRuleTools";
import { DB_TOOLS } from "./dbTools";
import { ENDING_TOOLS } from "./endingTools";
import { EVENT_TOOLS } from "./eventTools";
import { EXPORT_TOOLS } from "./exportTools";
import { MAP_GEN_TOOLS } from "./generateMapTool";
import { GROUP_LAYOUT_TOOLS } from "./groupLayoutTools";
import { GROUP_SAMPLE_TOOLS } from "./groupSampleTool";
import { HISTORY_TOOLS } from "./historyTools";
import { HOUSE_KIT_TOOLS } from "./houseKitTools";
import { HOUSE_LOT_TOOLS } from "./houseLotTools";
import { INVESTIGATION_TOOLS } from "./investigationTools";
import { LIGHTING_TOOLS } from "./lightingTools";
import { MAP_TOOLS } from "./mapTools";
import { PALETTE_PRESET_TOOLS } from "./palettePresetTools";
import { PLAY_TOOLS } from "./playTools";
import { PLACEMENT_TOOLS } from "./placementTools";
import { QUERY_TOOLS } from "./queryTools";
import { QUEST_TOOLS } from "./questTools";
import { RANGE_CLASSIFY_TOOLS } from "./rangeClassifyTools";
import { REFACTOR_TOOLS } from "./refactorTools";
import { STORY_TOOLS } from "./storyTools";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import { TIME_TOOLS } from "./timeTools";
import type { JsonSchema, ToolDefinition, ToolDomain } from "./types";
import { V1_TILE_SUPERSEDED } from "./v2";
import { CONSTRUCTION_TOOLS_V3, VOCABULARY_TOOLS_V3 } from "./v3";
import { CASTLE_TOOLS } from "./castleBuilder";
import { VILLAGE_TOOLS } from "./villageBuilder";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { WORLD_TOOLS } from "./worldTools";
import { TILE_QUERY_TOOLS } from "./tileQueryTool";
import { getActiveToolDomainInfo } from "@/editor/assistantToolMode";

export { PLACEMENT_TOOLS };

// 구 비전/샘플 조회 등은 tile_query로 통합 — 레지스트리에 남아 있으면 deprecated.
export const LEGACY_TILE_KNOWLEDGE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["set_group_layout", "propose_tile_vocabulary"],
  ["suggest_group_from_range", "propose_tile_vocabulary"],
  ["render_group_sample", "tile_query"],
  ["show_tile_grid", "tile_query"],
  ["show_tiles", "tile_query"],
]);

// 레거시 툴 이름에 deprecated + supersededBy 부여 (LLM 비노출, getTool 실행 호환).
function tagLegacy(tools: readonly ToolDefinition[]): readonly ToolDefinition[] {
  return tools.map((tool) => {
    if (tool.deprecated) return tool;
    const superseded =
      V1_TILE_SUPERSEDED.get(tool.name) ?? LEGACY_TILE_KNOWLEDGE_SUPERSEDED.get(tool.name);
    if (superseded) {
      return { ...tool, version: tool.version ?? (1 as const), deprecated: true, supersededBy: superseded };
    }
    return { ...tool, version: tool.version ?? (1 as const) };
  });
}

// ── 컨텍스트 모드 도메인 태깅(§2.2.2) ────────────────────────────────────────
// 노출 정책의 단일 소스: 패밀리 배열 단위 일괄 태깅 + 이름 단위 오버라이드.
// "core"는 모든 모드 상시 노출(스펙 §2.2.2의 정확한 5종).
const CORE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "create_map", "resize_map", "get_project_summary", "list_resources", "tile_query",
]);

// 혼합 패밀리(QUERY_TOOLS 등)의 이름 단위 도메인 교정.
const NAME_DOMAIN_OVERRIDES: ReadonlyMap<string, readonly ToolDomain[]> = new Map([
  ["get_map_region", ["map"]],
  ["check_reachability", ["map"]],
  ["highlight_map_region", ["map"]],
  ["find_events", ["event"]],
  ["get_event", ["event"]],
  ["find_switch_usage", ["event"]],
  ["list_npc_graphics", ["event"]],
  ["get_database_records", ["database"]],
  ["query_tiles", ["tile"]],
  // 흙길 오토타일 — MAP_TOOLS에 있어도 타일 시공 도메인에서 써야 한다(lay_path만 열려 길이 안 깔리던 문제).
  ["paint_road", ["tile", "map"]],
  ["run_lint", ["system"]],
  ["list_project_commits", ["system"]],
]);

function withDomain(tools: readonly ToolDefinition[], domain: ToolDomain): readonly ToolDefinition[] {
  return tools.map((tool) => ({
    ...tool,
    domains: CORE_TOOL_NAMES.has(tool.name)
      ? (["core"] as const)
      : tool.domains
        ? tool.domains
        : (NAME_DOMAIN_OVERRIDES.get(tool.name) ?? [domain]),
  }));
}

// 레지스트리 순서: 정공법(v3) 먼저 → 활성 맵/이벤트… → 레거시(deprecated) 엔진 호환.
export const TOOL_REGISTRY: readonly ToolDefinition[] = tagLegacy([
  ...withDomain(VOCABULARY_TOOLS_V3, "tile"),
  ...withDomain(CONSTRUCTION_TOOLS_V3, "tile"),
  ...withDomain(HOUSE_KIT_TOOLS, "tile"),
  ...withDomain(HOUSE_LOT_TOOLS, "tile"),
  ...withDomain(VILLAGE_TOOLS, "tile"),
  ...withDomain(CASTLE_TOOLS, "tile"),
  ...withDomain(TILE_QUERY_TOOLS, "tile"),
  ...withDomain(MAP_TOOLS, "map"),
  ...withDomain(MAP_GEN_TOOLS, "map"),
  ...withDomain(EVENT_TOOLS, "event"),
  ...withDomain(INVESTIGATION_TOOLS, "event"),
  ...withDomain(LIGHTING_TOOLS, "event"),
  ...withDomain(ENDING_TOOLS, "event"),
  ...withDomain(DB_TOOLS, "database"),
  ...withDomain(WORLD_TOOLS, "world"),
  ...withDomain(PALETTE_PRESET_TOOLS, "tile"),
  ...withDomain(QUEST_TOOLS, "quest"),
  ...withDomain(STORY_TOOLS, "quest"),
  ...withDomain(BATTLE_TOOLS, "battle"),
  ...withDomain(REFACTOR_TOOLS, "system"),
  ...withDomain(HISTORY_TOOLS, "system"),
  ...withDomain(TIME_TOOLS, "system"),
  ...withDomain(EXPORT_TOOLS, "system"),
  ...withDomain(PLAY_TOOLS, "system"),
  ...withDomain(QUERY_TOOLS, "map"),
  ...withDomain(TILE_METADATA_TOOLS, "tile"),
  ...withDomain(CLUSTER_RULE_TOOLS, "tile"),
  ...withDomain(GROUP_LAYOUT_TOOLS, "tile"),
  ...withDomain(GROUP_SAMPLE_TOOLS, "tile"),
  ...withDomain(VISION_QUERY_TOOLS, "map"),
  ...withDomain(PLACEMENT_TOOLS, "tile"),
  ...withDomain(RANGE_CLASSIFY_TOOLS, "tile"),
]);

const TOOL_BY_NAME = new Map<string, ToolDefinition>(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_BY_NAME.get(name);
}

export function allTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY;
}

/** LLM/UI에 보여줄 활성 툴만 (deprecated 제외). */
export function activeTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY.filter((tool) => tool.deprecated !== true);
}

export interface OpenAiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

// 컨텍스트 모드 노출 옵션(§2.2.2). mode가 없으면 종전대로 deprecated만 거른다.
export interface ToolExposureOptions {
  readonly domains?: ReadonlySet<ToolDomain>;
  readonly mode?: ToolDomain;
}

// 다도메인 region AI에서 place_props·place_npc가 함께 남도록 여유.
// 주의: 이 핀 목록은 전역이다(일반 채팅 등 region-task 이외 흐름도 공유) — 여기 추가한
// 도구만큼 다른 비핀 도구가 상한(40) 경합에서 밀려날 수 있다(2026-07-10 라이브 실측 수정으로
// place_chest 등 region 가이드 도구를 추가하며 확인). 도메인별 페어 슬라이스 등 상한
// 알고리즘 자체의 개선은 별도 과제로 남겨뒀다.
const MAX_EXPOSED_TOOLS = 40;
const PINNED_TOOLS_BY_DOMAIN: ReadonlyMap<ToolDomain, ReadonlySet<string>> = new Map([
  ["tile", new Set([
    "place_props",
    "build_house_kit",
    "build_house_lots", // 집 위치+마당 꾸밈 의도(LLM) → 산포 좌표(코드)
    "build_castle", // 성채 모듈(지붕면/성벽/원형타워) 결정론 시공
    "fill_region",
    "build_wall",
    "paint_road", // 흙길/모래 8방 오토타일 — lay_path만 핀되면 AI가 길을 안 깔거나 비성형 경로로 감
    "lay_path",
    "tile_query",
    "propose_tile_vocabulary",
  ])],
  ["event", new Set([
    "place_npc", "make_villager", "list_npc_graphics", "find_events", "get_event",
    // 영역 작업 quest-trigger/mood/door-transfer 가이드 대표 도구(2026-07-10 라이브 실측 수정) —
    // event 도메인 안에서도 EVENT_TOOLS/LIGHTING_TOOLS 뒤쪽 정의라 상한(40) 슬라이스에서 밀려
    // place_chest 등이 노출 안 되던 문제.
    "place_chest", "place_savepoint", "set_scene_mood", "set_lighting_volume", "create_transfer_pair",
  ])],
  ["map", new Set([
    "get_map_region", "show_map_region", "get_project_summary",
    // 영역 작업 transform/battle-trap 가이드 대표 도구(2026-07-10 라이브 실측 수정).
    "mirror_region", "set_encounter_table",
  ])],
]);
const WRITE_HEAVY_DOMAIN_ORDER: ReadonlyMap<ToolDomain, number> = new Map([
  ["tile", 0],
  ["event", 1],
  ["database", 2],
  ["battle", 3],
  ["quest", 4],
  ["world", 5],
  ["map", 6],
  ["system", 7],
  ["core", 8],
]);

function domainsFromOptions(opts: ToolExposureOptions): ReadonlySet<ToolDomain> | undefined {
  if (opts.domains) return opts.domains;
  if (!opts.mode) return undefined;
  return new Set<ToolDomain>(["core", opts.mode]);
}

// 도메인 스코핑 판정: 도메인 없는 툴은 범용(항상), core는 상시, 그 외엔 활성 도메인과 교집합이 있어야 노출.
function exposedInDomains(tool: ToolDefinition, domains: ReadonlySet<ToolDomain> | undefined): boolean {
  if (domains === undefined || !tool.domains) return true;
  return tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain));
}

function toolPrimaryDomain(tool: ToolDefinition): ToolDomain | undefined {
  return tool.domains?.find((domain) => domain !== "core") ?? tool.domains?.[0];
}

function domainPriority(domain: ToolDomain, domains: ReadonlySet<ToolDomain>): number {
  if (domain === "core") return 0;
  const info = getActiveToolDomainInfo(domains);
  if (!info) return 4;
  if (domain === info.uiDomain) return 1;
  if (info.strongIntentDomains.has(domain)) return 2;
  if (info.recentDomains.has(domain)) return 3;
  if (info.weakIntentDomains.has(domain)) return 5;
  return 4;
}

function removableDomains(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): ToolDomain[] {
  const active = new Set<ToolDomain>();
  for (const tool of exposed) {
    const domain = toolPrimaryDomain(tool);
    if (domain && domain !== "core") active.add(domain);
  }
  active.delete("database");
  // 강한 의도/UI 도메인은 통째로 드롭하지 않는다(region: tile+event 동시 필요).
  // recent/weak/map 보조만 도메인 단위로 빼고, 나머지는 pin+상한 슬라이스.
  return [...active]
    .filter((domain) => domainPriority(domain, domains) >= 3)
    .sort((a, b) => {
      const priority = domainPriority(b, domains) - domainPriority(a, domains);
      if (priority !== 0) return priority;
      return (WRITE_HEAVY_DOMAIN_ORDER.get(b) ?? 99) - (WRITE_HEAVY_DOMAIN_ORDER.get(a) ?? 99);
    });
}

function isPinnedTool(tool: ToolDefinition, domains: ReadonlySet<ToolDomain>): boolean {
  if (tool.domains?.includes("core")) return true;
  for (const domain of tool.domains ?? []) {
    if (!domains.has(domain)) continue;
    if (PINNED_TOOLS_BY_DOMAIN.get(domain)?.has(tool.name)) return true;
  }
  return false;
}

function trimToExposureCap(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): readonly ToolDefinition[] {
  if (exposed.length <= MAX_EXPOSED_TOOLS) return exposed;
  const pinned = exposed.filter((tool) => isPinnedTool(tool, domains));
  const rest = exposed.filter((tool) => !isPinnedTool(tool, domains));
  const room = Math.max(0, MAX_EXPOSED_TOOLS - pinned.length);
  return [...pinned, ...rest.slice(0, room)].slice(0, MAX_EXPOSED_TOOLS);
}

function applyExposureLimit(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain> | undefined): readonly ToolDefinition[] {
  if (domains === undefined || exposed.length <= MAX_EXPOSED_TOOLS) return exposed;
  const removable = removableDomains(exposed, domains);
  // 단일 활성 도메인(event/map 등)만 남은 상태에서는 제거할 약한 도메인이 없다.
  // 여기서 slice 하면 조회 보조 툴이 잘려 원래 모드가 망가지므로 다도메인 폭주에만 상한을 적용한다.
  if (removable.length <= 1) return trimToExposureCap(exposed, domains);
  const removed = new Set<ToolDomain>();
  let limited = [...exposed];
  for (const domain of removable) {
    if (limited.length <= MAX_EXPOSED_TOOLS) break;
    removed.add(domain);
    limited = limited.filter((tool) => {
      if (tool.domains?.includes("core") || !tool.domains) return true;
      return !tool.domains.some((toolDomain) => removed.has(toolDomain));
    });
  }
  return trimToExposureCap(limited, domains);
}

// OpenAI Chat Completions `tools` 배열로 변환. deprecated 툴은 어떤 모드에서도 노출하지 않는다.
export function toOpenAiTools(tools: readonly ToolDefinition[] = TOOL_REGISTRY, opts: ToolExposureOptions = {}): OpenAiTool[] {
  const domains = domainsFromOptions(opts);
  return applyExposureLimit(
    tools.filter((tool) => tool.deprecated !== true && exposedInDomains(tool, domains)),
    domains
  )
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
}
