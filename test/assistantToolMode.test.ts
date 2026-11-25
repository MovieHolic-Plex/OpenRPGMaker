import { describe, expect, it, afterEach } from "vitest";
import { computeActiveToolDomains, computeAssistantToolMode, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { toOpenAiTools, activeTools, allTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED, type ToolDefinition, type ToolDomain } from "@/editor/tools";
import { ESCALATION_DENYLIST, MAX_CAPABILITY_ESCALATED_TOOLS, capabilityEscalationSchemas } from "@/ai/capabilityEscalation";
import { mentionedToolSchemas } from "@/ai/planToolExposure";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";
import { declaredIntent } from "./intentFixture";
import { isolateTimers } from "./mergedTeardown";

describe("aiCapabilityEscalation", () => {
  isolateTimers();
  const TITLE_REQUEST = "타이틀 화면 바꿔줘";
  // 선언 없는(폴백) 턴의 도메인 슬라이스 — 코어 + UI 도메인만. 승격은 이 슬라이스 밖의 능력을 되살린다.
  function domainExposedNames(_text: string): Set<string> {
    const domains = computeActiveToolDomains(null);
    return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
  }
  function names(schemas: readonly { readonly function: { readonly name: string } }[]): string[] {
    return schemas.map((schema) => schema.function.name);
  }
  describe("자연어 능력 승격 리졸버", () => {
    it("finds tools outside an explicitly scoped caller catalog", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      // 케이스 전제: 도메인 슬라이스에도, 정확한 이름 언급 승격에도 없다.
      expect(exposed.has("set_title_screen")).toBe(false);
      expect(names(mentionedToolSchemas(TITLE_REQUEST))).not.toContain("set_title_screen");

      expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toContain("set_title_screen");
    });

    it("빈 문자열·공백·구두점만 있는 입력은 예외 없이 []", () => {
      for (const text of ["", "   ", "\n\t ", "!!!", " ... ?! ", "---"]) {
        expect(capabilityEscalationSchemas(text, new Set()), JSON.stringify(text)).toEqual([]);
      }
    });

    it("이미 노출된 툴은 다시 반환하지 않는다", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      const first = names(capabilityEscalationSchemas(TITLE_REQUEST, exposed));
      expect(first.length).toBeGreaterThan(0);
      const withAll = names(capabilityEscalationSchemas(TITLE_REQUEST, new Set([...exposed, ...first])));
      for (const name of first) expect(withAll).not.toContain(name);
    });

    it("deprecated(supersededBy) 툴은 절대 반환하지 않는다", () => {
      const deprecated = allTools().filter((tool) => tool.deprecated === true && tool.supersededBy);
      expect(deprecated.length).toBeGreaterThan(0);
      const active = new Set(activeTools().map((tool) => tool.name));
      for (const tool of deprecated) {
        const returned = names(capabilityEscalationSchemas(`${tool.name} ${tool.description}`, new Set()));
        expect(returned, tool.name).not.toContain(tool.name);
        for (const name of returned) expect(active.has(name), name).toBe(true);
      }
    });

    it("bounds optional search suggestions without truncating the native catalog", () => {
      for (const text of [TITLE_REQUEST, "속성 상성표 설정하고 세이브 시작 지점도 바꾸고 장비랑 직업도 추가해줘"]) {
        expect(capabilityEscalationSchemas(text, new Set()).length).toBeLessThanOrEqual(MAX_CAPABILITY_ESCALATED_TOOLS);
      }
      const all = toOpenAiTools(activeTools());
      expect(all.length).toBeGreaterThan(128);
      expect(names(all)).toEqual(activeTools().map((tool) => tool.name));
      expect(capabilityEscalationSchemas(TITLE_REQUEST, new Set(names(all)))).toEqual([]);
    });

    // 되돌릴 수 없는 폐기 툴은 어휘가 아무리 맞아도 자동으로 얹히지 않는다.
    it("폐기 툴은 이름·설명을 그대로 던져도 승격되지 않는다", () => {
      const byName = new Map(allTools().map((tool) => [tool.name, tool] as const));
      for (const name of ESCALATION_DENYLIST) {
        const tool = byName.get(name);
        expect(tool, name).toBeDefined();
        const returned = names(capabilityEscalationSchemas(`${name} ${tool!.description}`, new Set()));
        expect(returned, name).not.toContain(name);
      }
    });

    it("부분 재작업 요청이 프로젝트 폐기 툴을 끌어오지 않는다", () => {
      for (const text of ["이 맵 상점 재고를 초기화해줘", "이 맵 처음부터 다시 칠해줘", "여기 지워버리고 다시 깔아줘"]) {
        const returned = names(capabilityEscalationSchemas(text, new Set()));
        expect(returned, text).not.toContain("reset_project");
        expect(returned, text).not.toContain("remove_map");
      }
    });

    it("같은 입력은 같은 순서를 낸다", () => {
      const exposed = domainExposedNames(TITLE_REQUEST);
      expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toEqual(
        names(capabilityEscalationSchemas(TITLE_REQUEST, exposed)),
      );
    });
  });
});

// 컨텍스트 모드 툴 스코핑 T4 (2026-07-07 타일 시공 흐름 재설계 §2.2).
// - tile 모드: v3 프리미티브 + 코어만 노출(~12개), 옛 타일 지식 툴 0개.
// - event 모드: 이벤트 툴 포함, 타일 프리미티브 제외.
// - deprecated 는 어떤 모드에서도 노출되지 않는다.
// - 모드 판정은 UI 상태에서만 결정론으로 계산된다(원칙 0).
describe("toolDomainScoping", () => {
  isolateTimers();
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
      expect([...exposed]).toEqual(eligibleNames(activeTools(), new Set(["tile"])));
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

    // Removed it "canonical construction만 write surface에": author_house and author_village were removed from the tool registry on purpose.

    it("mode 없으면 종전 동작(deprecated 만 제외한 전체 노출)", () => {
      const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
      expect(toOpenAiTools().length).toBe(exposedCount);
    });

    it("multi-domain filters retain every eligible tool, including database tools", () => {
      const tools = makeExposureTestTools();
      resetAssistantToolDomainMemory();
      const domains = computeActiveToolDomains(declaredIntent({ tools: ["upsert_item", "build_wall", "define_quest", "plan_world"] }));
      const exposed = toOpenAiTools(tools, { domains });
      const names = new Set(exposed.map((tool) => tool.function.name));

      expect([...names]).toEqual(eligibleNames(tools, domains));
      expect(names.has("deprecated_tool")).toBe(false);
      for (let index = 0; index < 8; index += 1) {
        expect(names.has(`database_tool_${index}`), `database_tool_${index}`).toBe(true);
      }
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

    // Removed it "야외 시공 선언은 tile 을 열어": author_village was removed from the tool registry on purpose.

    it("modify intent exposes all three editing domains without pruning", () => {
      const domains = computeActiveToolDomains(declaredIntent({ mode: "modify" }));
      for (const domain of ["tile", "map", "event"] as const) expect(domains.has(domain)).toBe(true);
      const list = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
      expect(list).toEqual(eligibleNames(activeTools(), domains));
      expect(list).toContain("fill_region");
    });

    it("system intent exposes every system capability", () => {
      const resetDomains = computeActiveToolDomains(declaredIntent({ tools: ["reset_project"], resetsContext: true }));
      const resetExposed = toOpenAiTools(undefined, { domains: resetDomains });
      expect(resetDomains.has("system")).toBe(true);
      expect(resetExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), resetDomains));
      expect(resetExposed.some((tool) => tool.function.name === "reset_project")).toBe(true);

      const nightDomains = computeActiveToolDomains(declaredIntent({ tools: ["configure_time_system"] }));
      const nightExposed = toOpenAiTools(undefined, { domains: nightDomains });
      expect(nightDomains.has("system")).toBe(true);
      expect(nightExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), nightDomains));
      expect(nightExposed.some((tool) => tool.function.name === "configure_time_system")).toBe(true);
    });
  });
  function eligibleNames(tools: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): string[] {
    return tools.filter((tool) => !tool.deprecated && (!tool.domains || tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain)))).map((tool) => tool.name);
  }
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
});
