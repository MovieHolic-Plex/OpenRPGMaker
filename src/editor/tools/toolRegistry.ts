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
import { TILE_TOOLS_V2, V1_TILE_SUPERSEDED } from "./v2";
import { CONSTRUCTION_TOOLS_V3, V2_TILE_SUPERSEDED, VOCABULARY_TOOLS_V3 } from "./v3";
import { CASTLE_TOOLS } from "./castleBuilder";
import { VILLAGE_TOOLS } from "./villageBuilder";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { WORLD_TOOLS } from "./worldTools";
import { getActiveToolDomainInfo } from "@/editor/assistantToolMode";

export { PLACEMENT_TOOLS };

// 툴 홍수 제거(2026-07-07 §2.2.1): v3 승인 어휘 흐름과 경쟁하는 옛 타일 지식 툴을
// LLM 노출에서 제외한다(getTool/실행 호환 유지). 작은 모델이 v3 정공법 대신 이 툴들로 새던 문제.
export const LEGACY_TILE_KNOWLEDGE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["tile_group", "propose_tile_vocabulary"],
  ["set_group_layout", "propose_tile_vocabulary"],
  ["suggest_group_from_range", "propose_tile_vocabulary"],
  ["tile_metadata", "propose_tile_vocabulary"],
  ["tile_cluster_rule", "propose_tile_vocabulary"],
  ["render_group_sample", "tile_query"],
  ["show_tile_grid", "tile_query"],
  ["show_tiles", "tile_query"],
]);

// v2 재구축(2026-07-07): 모든 기존 툴은 version 1로 태깅하고, 타일 계열 v1은 v2 대체와 함께
// deprecated 처리한다(LLM 노출 제외 — getTool/실행 호환은 유지).
// v3 공정 프리미티브(V3B): v2 배치 4종도 같은 방식으로 deprecated 마킹한다(version 2 유지).
// 옛 타일 지식 툴(§2.2.1)도 동일 방식 — supersededBy는 v3 정공법 진입점을 가리킨다.
function tagV1(tools: readonly ToolDefinition[]): readonly ToolDefinition[] {
  return tools.map((tool) => {
    const supersededByV1 = V1_TILE_SUPERSEDED.get(tool.name);
    if (supersededByV1) return { ...tool, version: 1 as const, deprecated: true, supersededBy: supersededByV1 };
    const supersededByV2 = V2_TILE_SUPERSEDED.get(tool.name);
    if (supersededByV2) return { ...tool, version: tool.version ?? (2 as const), deprecated: true, supersededBy: supersededByV2 };
    const supersededByV3 = LEGACY_TILE_KNOWLEDGE_SUPERSEDED.get(tool.name);
    if (supersededByV3) return { ...tool, version: tool.version ?? (1 as const), deprecated: true, supersededBy: supersededByV3 };
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

// 레지스트리(순서 = 카탈로그 표시 순서). v3 승인 보캐뷸러리 → v2 타일 툴 순으로 앞에 온다.
export const TOOL_REGISTRY: readonly ToolDefinition[] = tagV1([
  ...withDomain(VOCABULARY_TOOLS_V3, "tile"),
  ...withDomain(CONSTRUCTION_TOOLS_V3, "tile"),
  ...withDomain(HOUSE_KIT_TOOLS, "tile"),
  ...withDomain(HOUSE_LOT_TOOLS, "tile"),
  ...withDomain(VILLAGE_TOOLS, "tile"),
  ...withDomain(CASTLE_TOOLS, "tile"),
  ...withDomain(TILE_TOOLS_V2, "tile"),
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
  ...withDomain(QUERY_TOOLS, "map"), // 혼합 패밀리 — NAME_DOMAIN_OVERRIDES가 우선한다.
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
  ["event", new Set(["place_npc", "make_villager", "list_npc_graphics", "find_events", "get_event"])],
  ["map", new Set(["get_map_region", "show_map_region", "get_project_summary"])],
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
