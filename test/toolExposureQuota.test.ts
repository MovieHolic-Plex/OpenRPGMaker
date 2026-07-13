// 노출 상한(40) 도메인별 라운드로빈 쿼터 (toolRegistry.trimToExposureCap).
// 종전 레지스트리 순서 슬라이스의 두 가지 결함을 회귀 고정한다:
//  1. 등록 후순위 도메인 전멸 — world처럼 늦게 등록된 패밀리가 상한에서 통째로 밀림.
//  2. 핀 추가 비용의 전가 — 핀 1개가 늘 때마다 마지막 도메인 툴만 밀려남.
// 쿼터 이후에는 활성 도메인마다 최소 ⌊room/도메인 수⌋개가 보장되고,
// 핀 비용은 전 도메인에 분산된다.

import { describe, expect, it } from "vitest";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { toOpenAiTools, type ToolDefinition, type ToolDomain } from "@/editor/tools";

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

// 등록 순서: core → database → tile → quest → world. 총 53개(> 상한 40).
// 네 도메인 모두 강한 의도로 열리므로 도메인 단위 제거가 불가능해 쿼터 트림 경로를 탄다.
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

function activeDomains(): ReadonlySet<ToolDomain> {
  resetAssistantToolDomainMemory();
  // 아이템(database)·벽(tile)·퀘스트(quest)·세계관(world) — 전부 강한 의도.
  return computeActiveToolDomains("아이템 벽 퀘스트 세계관");
}

describe("노출 상한 도메인 쿼터", () => {
  it("상한 초과 시 등록 후순위 도메인(world)도 공정 지분을 받는다", () => {
    const exposed = toOpenAiTools(makeQuotaTestTools(), { domains: activeDomains() });
    const names = exposed.map((tool) => tool.function.name);

    expect(exposed.length).toBeLessThanOrEqual(40);
    // 코어(핀)는 전량 유지.
    expect(exposedByDomainPrefix(names, "core_tool_")).toBe(5);
    // room 35를 4개 도메인이 나눠 가지므로 각 도메인 최소 8개.
    for (const prefix of ["database_tool_", "tile_tool_", "quest_tool_", "world_tool_"]) {
      expect(exposedByDomainPrefix(names, prefix), prefix).toBeGreaterThanOrEqual(8);
    }
    // 종전 슬라이스라면 world는 0개였다(53개 중 마지막 12개 등록) — 회귀 고정.
    expect(names).toContain("world_tool_0");
  });

  it("핀 추가 비용은 특정 도메인 전멸이 아니라 전 도메인에 분산된다", () => {
    // tile 도메인에 실제 핀 이름(place_props)을 심는다 → 핀 6개, room 34.
    const exposed = toOpenAiTools(makeQuotaTestTools(true), { domains: activeDomains() });
    const names = exposed.map((tool) => tool.function.name);

    expect(names).toContain("place_props");
    expect(exposed.length).toBeLessThanOrEqual(40);
    // 핀이 늘어도 여전히 모든 도메인이 최소 ⌊34/4⌋=8개를 유지한다.
    for (const prefix of ["database_tool_", "quest_tool_", "world_tool_"]) {
      expect(exposedByDomainPrefix(names, prefix), prefix).toBeGreaterThanOrEqual(8);
    }
  });

  it("트림 결과는 결정론적이고 레지스트리 순서를 유지한다", () => {
    const tools = makeQuotaTestTools();
    const domains = activeDomains();
    const first = toOpenAiTools(tools, { domains }).map((tool) => tool.function.name);
    const second = toOpenAiTools(tools, { domains }).map((tool) => tool.function.name);
    expect(second).toEqual(first);

    // 순서 안정성: 노출된 이름들의 상대 순서가 등록 순서와 일치.
    const registryOrder = tools.map((tool) => tool.name).filter((name) => first.includes(name));
    expect(first).toEqual(registryOrder);
  });

  // 실제 레지스트리 회귀: 실내 하네스 도구(빌드-인테리어 스킬의 실행 경로)가 tile 모드
  // 상한(40) 트림에서 잘려나가면 스킬 프롬프트가 지시하는 도구를 챗봇이 못 부른다.
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
});
