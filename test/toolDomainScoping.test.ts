// 컨텍스트 모드 툴 스코핑 T4 (2026-07-07 타일 시공 흐름 재설계 §2.2).
// - tile 모드: v3 프리미티브 + 코어만 노출(~12개), 옛 타일 지식 툴 0개.
// - event 모드: 이벤트 툴 포함, 타일 프리미티브 제외.
// - deprecated 는 어떤 모드에서도 노출되지 않는다.
// - 모드 판정은 UI 상태에서만 결정론으로 계산된다(원칙 0).

import { afterEach, describe, expect, it } from "vitest";
import {
  computeActiveToolDomains,
  computeAssistantToolMode,
  resetAssistantToolDomainMemory,
} from "@/editor/assistantToolMode";
import { editorState } from "@/editor/editorState";
import { allTools, getTool, toOpenAiTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED, type ToolDefinition, type ToolDomain } from "@/editor/tools";
import { CONSTRUCTION_WRITE_ROUTE_MANIFEST, PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS } from "@/editor/construction/routeManifest";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";
import { declaredIntent } from "./intentFixture";

const OLD_TILE_TOOLS = [...LEGACY_TILE_KNOWLEDGE_SUPERSEDED.keys()];
const V3_PRIMITIVES = ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase"];
const CORE_TOOLS = ["create_map", "resize_map", "get_project_summary", "list_resources", "tile_query"];

function exposedNames(mode?: "tile" | "map" | "event" | "database"): Set<string> {
  return new Set(toOpenAiTools(undefined, mode ? { mode } : {}).map((tool) => tool.function.name));
}

describe("T4 — toOpenAiTools 모드 스코핑", () => {
  it("옛 타일 지식 툴 11종은 deprecated(비노출)이며 실행 호환(supersededBy)이 유지된다", () => {
    const byName = new Map(allTools().map((tool) => [tool.name, tool]));
    const exposed = exposedNames();
    for (const [name, replacement] of LEGACY_TILE_KNOWLEDGE_SUPERSEDED) {
      const tool = byName.get(name);
      expect(tool, name).toBeDefined();
      expect(tool!.deprecated, name).toBe(true);
      expect(tool!.supersededBy, name).toBe(replacement);
      expect(exposed.has(name), name).toBe(false);
    }
  });

  it("tile 모드: v3 프리미티브 + 코어 노출, propose 비노출, 옛 타일 툴 0개", () => {
    const exposed = exposedNames("tile");
    for (const name of ["paint_road", ...V3_PRIMITIVES, ...CORE_TOOLS]) {
      expect(exposed.has(name), name).toBe(true);
    }
    expect(exposed.has("propose_tile_vocabulary")).toBe(false);
    for (const name of OLD_TILE_TOOLS) expect(exposed.has(name), name).toBe(false);
    for (const name of ["upsert_event", "place_npc", "upsert_item", "plan_world", "create_quest"]) {
      expect(exposed.has(name), name).toBe(false);
    }
    expect(exposed.size).toBeGreaterThanOrEqual(12);
    expect(exposed.size).toBeLessThanOrEqual(40);
  });

  it("event 모드: 이벤트 툴 포함, 타일 프리미티브 제외, 코어는 상시", () => {
    const exposed = exposedNames("event");
    for (const name of ["upsert_event", "place_npc", "move_event", "find_events", "get_event", ...CORE_TOOLS]) {
      expect(exposed.has(name), name).toBe(true);
    }
    for (const name of V3_PRIMITIVES) expect(exposed.has(name), name).toBe(false);
  });

  it("deprecated 는 어떤 모드에서도 0개", () => {
    const deprecated = new Set(allTools().filter((tool) => tool.deprecated === true).map((tool) => tool.name));
    for (const mode of [undefined, "tile", "map", "event", "database"] as const) {
      const exposed = exposedNames(mode);
      for (const name of deprecated) expect(exposed.has(name), `${mode ?? "all"}:${name}`).toBe(false);
    }
  });

  it("canonical construction만 write surface에 남고 legacy write는 직접 실행 metadata만 유지한다", () => {
    // Given: the canonical migration matrix and the real registry/browser catalog.
    const browserNames = new Set(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name)));
    const exposed = exposedNames();

    // When: canonical, compatibility, and read-only construction routes are inspected.
    const legacyWrites = CONSTRUCTION_WRITE_ROUTE_MANIFEST.filter((route) => route.supersededBy !== null);

    // Then: canonical writes are public first-class tools, legacy writes are hidden but executable,
    // and read diagnostics remain public. Independent interior tools are unaffected.
    expect(allTools().slice(0, 8).map((tool) => tool.name)).toEqual(expect.arrayContaining(["author_house", "author_village"]));
    expect(getTool("author_house")?.domains).toEqual(["tile"]);
    expect(getTool("author_village")?.domains).toEqual(["tile", "map"]);
    for (const name of ["author_house", "author_village"]) {
      expect(exposed.has(name), name).toBe(true);
      expect(browserNames.has(name), name).toBe(true);
    }
    for (const route of legacyWrites) {
      const tool = getTool(route.name);
      expect(tool, route.name).toBeDefined();
      expect(tool?.deprecated, route.name).toBe(true);
      expect(tool?.supersededBy, route.name).toBe(route.supersededBy);
      expect(exposed.has(route.name), route.name).toBe(false);
      expect(browserNames.has(route.name), route.name).toBe(false);
    }
    for (const route of PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS) {
      expect(getTool(route.name)?.mode, route.name).toBe("read");
      expect(exposed.has(route.name), route.name).toBe(true);
      expect(browserNames.has(route.name), route.name).toBe(true);
    }
    expect(exposed.has("start_interior_room_session")).toBe(true);
  });

  it("mode 없으면 종전 동작(deprecated 만 제외한 전체 노출)", () => {
    const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
    expect(toOpenAiTools().length).toBe(exposedCount);
  });

  it("다도메인 유니온은 노출 상한(40)을 지키고 weak-only 도메인부터 제거하며 database 활성 시 DB 툴 전량을 유지한다", () => {
    const tools = makeExposureTestTools();
    resetAssistantToolDomainMemory();
    const domains = computeActiveToolDomains(declaredIntent({ tools: ["upsert_item", "build_wall", "define_quest", "plan_world"] }));
    const exposed = toOpenAiTools(tools, { domains });
    const names = new Set(exposed.map((tool) => tool.function.name));

    expect(exposed.length).toBeLessThanOrEqual(40);
    expect(names.has("deprecated_tool")).toBe(false);
    for (let index = 0; index < 8; index += 1) {
      expect(names.has(`database_tool_${index}`), `database_tool_${index}`).toBe(true);
    }
    // 스킬 키워드가 battle weak 도 열 수 있음 — 상한 내 DB 전량 유지가 핵심
  });
});

describe("T4 — computeAssistantToolMode (UI 상태 결정론)", () => {
  const restores: (() => void)[] = [];
  afterEach(() => {
    while (restores.length > 0) restores.pop()?.();
    editorState.set({ layer: "lower", tool: "paint" });
    resetAssistantToolDomainMemory();
  });

  it("DOM 없음(헤드리스) → map (판정 불가 기본)", () => {
    expect(computeAssistantToolMode()).toBe("map");
  });

  it("좌측 타일 팔레트가 보이고 타일 레이어 편집 중이면 tile", () => {
    restores.push(installFakeDom());
    document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
    editorState.set({ layer: "lower", tool: "paint" });
    expect(computeAssistantToolMode()).toBe("tile");
  });

  it("이벤트 레이어/도구면 event, DB 모달이 열려 있으면 database 가 우선한다", () => {
    restores.push(installFakeDom());
    document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
    editorState.set({ layer: "event" });
    expect(computeAssistantToolMode()).toBe("event");
    document.body.append(el("div", { dataset: { testid: "database-modal" } }));
    expect(computeAssistantToolMode()).toBe("database");
  });
});

describe("T4 — computeActiveToolDomains (선언 유니온 + TTL)", () => {
  afterEach(() => {
    resetAssistantToolDomainMemory();
    editorState.set({ layer: "lower", tool: "paint" });
  });

  it("선언한 툴의 도메인이 결정론으로 열린다 — 문장은 보지 않는다", () => {
    const enemy = computeActiveToolDomains(declaredIntent({ tools: ["simulate_battle", "upsert_enemy"] }));
    for (const domain of ["core", "map", "battle", "database"] as const) expect(enemy.has(domain)).toBe(true);
    const wall = computeActiveToolDomains(declaredIntent({ tools: ["build_wall"] }));
    for (const domain of ["core", "map", "tile"] as const) expect(wall.has(domain)).toBe(true);
    expect(computeActiveToolDomains(null).size).toBe(2);
  });

  it("야외 시공 선언은 tile 을 열어 canonical 마을 시공이 노출된다", () => {
    const domains = computeActiveToolDomains(declaredIntent({ space: "outdoor", tools: ["author_village"] }));
    expect(domains.has("map")).toBe(true);
    expect(domains.has("tile")).toBe(true);
    const names = new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
    expect(names.has("author_village")).toBe(true);
  });

  it("수정 선언은 편집 3도메인을 열고 상한(40) 안에서 채우기 툴이 노출된다", () => {
    const domains = computeActiveToolDomains(declaredIntent({ mode: "modify" }));
    for (const domain of ["tile", "map", "event"] as const) expect(domains.has(domain)).toBe(true);
    const list = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    expect(list.length).toBeLessThanOrEqual(40);
    expect(list).toContain("fill_region");
  });

  it("system 툴을 선언하면 canonical 툴이 cap 안에서 노출된다", () => {
    const resetDomains = computeActiveToolDomains(declaredIntent({ tools: ["reset_project"], resetsContext: true }));
    const resetExposed = toOpenAiTools(undefined, { domains: resetDomains });
    expect(resetDomains.has("system")).toBe(true);
    expect(resetExposed.length).toBeLessThanOrEqual(40);
    expect(resetExposed.some((tool) => tool.function.name === "reset_project")).toBe(true);

    const nightDomains = computeActiveToolDomains(declaredIntent({ tools: ["configure_time_system"] }));
    const nightExposed = toOpenAiTools(undefined, { domains: nightDomains });
    expect(nightDomains.has("system")).toBe(true);
    expect(nightExposed.length).toBeLessThanOrEqual(40);
    expect(nightExposed.some((tool) => tool.function.name === "configure_time_system")).toBe(true);
  });
});

function makeExposureTestTools(): ToolDefinition[] {
  const make = (name: string, domain: ToolDomain, deprecated = false): ToolDefinition => ({
    name,
    description: name,
    mode: domain === "core" ? "read" : "write",
    domains: [domain],
    parameters: { type: "object", properties: {} },
    ...(deprecated ? { deprecated: true } : {}),
    run: () => ({ summary: name }),
  });
  return [
    ...Array.from({ length: 5 }, (_, index) => make(`core_tool_${index}`, "core")),
    ...Array.from({ length: 8 }, (_, index) => make(`database_tool_${index}`, "database")),
    ...Array.from({ length: 8 }, (_, index) => make(`tile_tool_${index}`, "tile")),
    ...Array.from({ length: 8 }, (_, index) => make(`battle_tool_${index}`, "battle")),
    ...Array.from({ length: 8 }, (_, index) => make(`quest_tool_${index}`, "quest")),
    ...Array.from({ length: 8 }, (_, index) => make(`world_tool_${index}`, "world")),
    make("deprecated_tool", "core", true),
  ];
}
