import { declaredIntent } from "./intentFixture";
import { describe, expect, it } from "vitest";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { activeTools, toOpenAiTools, type ToolDefinition, type ToolDomain } from "@/editor/tools";

function makeTool(name: string, domain: ToolDomain): ToolDefinition {
  return {
    name,
    description: name,
    mode: domain === "core" ? "read" : "write",
    domains: [domain],
    parameters: { type: "object", properties: {} },
    run: () => ({ summary: name }),
  };
}

function makeQuotaTestTools(withPinnedTileTool = false): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    ...Array.from({ length: 5 }, (_, index) => makeTool(`core_tool_${index}`, "core")),
    ...Array.from({ length: 12 }, (_, index) => makeTool(`database_tool_${index}`, "database")),
    ...Array.from({ length: 12 }, (_, index) =>
      makeTool(withPinnedTileTool && index === 0 ? "place_props" : `tile_tool_${index}`, "tile")
    ),
    ...Array.from({ length: 12 }, (_, index) => makeTool(`quest_tool_${index}`, "quest")),
    ...Array.from({ length: 12 }, (_, index) => makeTool(`world_tool_${index}`, "world")),
  ];
  return tools;
}

function exposedByDomainPrefix(names: readonly string[], prefix: string): number {
  return names.filter((name) => name.startsWith(prefix)).length;
}

function scopedNames(domains: ReadonlySet<ToolDomain>): string[] {
  return activeTools().filter((tool) => !tool.domains || tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain))).map((tool) => tool.name);
}

function activeDomains(): ReadonlySet<ToolDomain> {
  resetAssistantToolDomainMemory();
  return computeActiveToolDomains(declaredIntent({ tools: ["upsert_item", "build_wall", "define_quest", "plan_world"] }));
}

describe("lossless domain exposure", () => {
  it("retains every eligible tool including the last registered domain", () => {
    const exposed = toOpenAiTools(makeQuotaTestTools(), { domains: activeDomains() });
    const names = exposed.map((tool) => tool.function.name);

    expect(exposed).toHaveLength(53);
    expect(exposedByDomainPrefix(names, "core_tool_")).toBe(5);
    for (const prefix of ["database_tool_", "tile_tool_", "quest_tool_", "world_tool_"]) {
      expect(exposedByDomainPrefix(names, prefix), prefix).toBe(12);
    }
    expect(names).toContain("world_tool_0");
  });

  it("a formerly pinned tool cannot evict another capability", () => {
    const exposed = toOpenAiTools(makeQuotaTestTools(true), { domains: activeDomains() });
    const names = exposed.map((tool) => tool.function.name);

    expect(names).toContain("place_props");
    expect(exposed).toHaveLength(53);
    for (const prefix of ["database_tool_", "quest_tool_", "world_tool_"]) {
      expect(exposedByDomainPrefix(names, prefix), prefix).toBe(12);
    }
  });

  it("preserves deterministic registry order", () => {
    const tools = makeQuotaTestTools();
    const domains = activeDomains();
    const first = toOpenAiTools(tools, { domains }).map((tool) => tool.function.name);
    const second = toOpenAiTools(tools, { domains }).map((tool) => tool.function.name);
    expect(second).toEqual(first);

    const registryOrder = tools.map((tool) => tool.name).filter((name) => first.includes(name));
    expect(first).toEqual(registryOrder);
  });

  it("tile 모드에서 실내 세션 하네스 도구가 노출된다", () => {
    const names = toOpenAiTools(undefined, { mode: "tile" }).map((tool) => tool.function.name);
    for (const name of [
      "start_interior_room_session",
      "advance_interior_room_build",
      "evaluate_interior_room",
      "furnish_interior_space",
      "run_interior_room_pipeline",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("canonical house/village routes coexist with every eligible multi-domain tool", () => {
    resetAssistantToolDomainMemory();
    const domains = computeActiveToolDomains(
      declaredIntent({ space: "outdoor", needsPlan: true, tools: ["author_village", "author_house", "place_npc", "upsert_item", "define_quest", "plan_world"] }),
    );

    const names = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);

    expect(names).toEqual(scopedNames(domains));
    expect(names).toContain("author_house");
    expect(names).toContain("author_village");
  });

  it("exposes define_quest and verify_quest when core+quest domains are active", () => {
    const domains = new Set<ToolDomain>(["core", "quest"]);

    const names = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);

    expect(names).toEqual(scopedNames(domains));
    expect(names).toContain("define_quest");
    expect(names).toContain("verify_quest");
  });

  it("exposes plan_world when core+world domains are active", () => {
    const domains = new Set<ToolDomain>(["core", "world"]);

    const names = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);

    expect(names).toEqual(scopedNames(domains));
    expect(names).toContain("plan_world");
  });

  it("exposes farm spatial write tools when core+database domains are active", () => {
    const domains = new Set<ToolDomain>(["core", "database"]);
    const names = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    expect(names).toEqual(scopedNames(domains));
    for (const name of [
      "create_farm_plot",
      "upsert_farm_building_type",
      "upsert_home_decoration_type",
      "upsert_farm_animal_building",
      "set_session_farm_state",
    ]) {
      expect(names, name).toContain(name);
    }
  });
});
