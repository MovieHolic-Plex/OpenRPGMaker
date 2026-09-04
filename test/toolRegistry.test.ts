// test/toolRegistry.test.ts
// 툴 레지스트리 스키마 유효성 + dry-run 불변성 + 커밋 게이트 검증.

import { describe, expect, it } from "vitest";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { PINNED_TOOLS_BY_DOMAIN, allTools, getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function descriptionFor(name: string): string {
  const tool = allTools().find((entry) => entry.name === name);
  expect(tool).toBeDefined();
  return tool?.description ?? "";
}

describe("toolRegistry", () => {
  it("모든 툴이 유효한 OpenAI 함수 스키마를 산출한다", () => {
    const openai = toOpenAiTools();
    // v2 재구축(2026-07-07): deprecated v1 타일 툴은 LLM에 노출되지 않는다.
    const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
    expect(openai.length).toBe(exposedCount);
    expect(allTools().length).toBeGreaterThan(exposedCount);
    const seen = new Set<string>();
    for (const tool of openai) {
      expect(tool.type).toBe("function");
      // name 패턴 + 유일성.
      expect(tool.function.name).toMatch(NAME_PATTERN);
      expect(seen.has(tool.function.name)).toBe(false);
      seen.add(tool.function.name);
      // description은 비어있지 않은 한국어 설명.
      expect(tool.function.description.length).toBeGreaterThan(0);
      // parameters는 object 타입 JSON Schema.
      expect(tool.function.parameters.type).toBe("object");
      expect(typeof tool.function.parameters).toBe("object");
    }
  });

  it("저수준 이벤트 툴 description은 고수준 툴 우선 라우팅을 먼저 안내한다", () => {
    expect({
      upsert_event: descriptionFor("upsert_event"),
      upsert_common_event: descriptionFor("upsert_common_event"),
    }).toMatchInlineSnapshot(`
      {
        "upsert_common_event": "먼저 위 고수준 툴이 목적에 맞는지 확인하라(트랩=place_trap, 퍼즐=compile_puzzle, 컷신=script_cutscene 등). 이 툴은 커스텀 로직 전용. 커먼 이벤트를 등록/수정한다. trigger: none(호출 전용)/auto/parallel, 조건 스위치 지정 가능.",
        "upsert_event": "먼저 위 고수준 툴이 목적에 맞는지 확인하라(트랩=place_trap, 퍼즐=compile_puzzle, 컷신=script_cutscene 등). 이 툴은 커스텀 로직 전용. GameEvent를 추가하거나 기존 이벤트를 부분 수정한다. 기존 id이면 입력에 포함한 최상위 필드만 바꾸고, 생략한 pages/commands/graphic/characterId/좌표 등은 보존한다. 빈 배열처럼 명시한 값은 그대로 반영한다. NPC/주민/대화 이벤트 배치는 place_npc, 스케줄만 바꿀 때는 set_npc_schedule을 우선 사용하라.",
      }
    `);
  });

  it("모든 툴 정의가 read/write 모드와 실행 함수를 가진다", () => {
    for (const tool of allTools()) {
      expect(["read", "write"]).toContain(tool.mode);
      expect(typeof tool.run).toBe("function");
    }
  });

  it("dry-run이 원본 project를 변형하지 않는다", () => {
    const project = createEmberQuestProject();
    const serialized = JSON.stringify(project);
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "create_map", { name: "실험 맵", width: 12, height: 10 }, { dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.diff?.mapsAdded).toBe(1);
    // 원본은 직렬화 기준으로 완전히 동일해야 한다(참조 동일성 + 내용 동일성).
    expect(ctx.project).toBe(project);
    expect(JSON.stringify(project)).toBe(serialized);
  });

  it("dry-run이 아닌 실행은 ctx.project를 새 프로젝트로 교체한다", () => {
    const project = createEmberQuestProject();
    const ctx: ToolContext = { project };
    const before = JSON.stringify(project);
    const result = runTool(ctx, "create_map", { name: "실험 맵", width: 12, height: 10 }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(ctx.project).not.toBe(project);
    // 원본 객체는 그대로(툴은 draft에만 적용).
    expect(JSON.stringify(project)).toBe(before);
    expect(Object.keys(ctx.project.maps).length).toBe(Object.keys(project.maps).length + 1);
  });

  it("물 위에 NPC를 놓으면 근처 통행 가능 칸으로 자동 조정된다 (에이전틱 착지)", () => {
    const project = createEmberQuestProject();
    const ctx: ToolContext = { project };
    // 잿불 마을의 연못(25,18)~(29,22)은 물 타일 → 통행 불가. 이전에는 ok:false였지만
    // 이제 반경 3칸 내 통행 가능 칸으로 자동 착지한다(요청 좌표는 warnings/summary에 남는다).
    const result = runTool(
      ctx,
      "place_npc",
      { mapId: "map_ember_village", x: 27, y: 20, name: "물위 NPC", pages: [{ lines: ["안녕"] }] },
      { dryRun: false }
    );
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { x: number; y: number; adjusted: boolean };
    expect(data.adjusted).toBe(true);
    expect(`${data.x},${data.y}`).not.toBe("27,20");
    expect(result.summary).toContain("자동 조정");
    // 착지 좌표는 실제로 통행 가능해야 한다.
    const map = ctx.project.maps["map_ember_village"];
    const npc = map.events.find((event) => event.x === data.x && event.y === data.y);
    expect(npc).toBeDefined();
  });

  it("게이트: 통행 불가 시작 위치는 거부된다", () => {
    const project = createEmberQuestProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "set_start_position", { mapId: "map_ember_village", x: 0, y: 0 }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("start-impassable");
  });

  it("빈 프로젝트 시드는 맵/아이템/적/트룹이 비어 있다", () => {
    const project = createEmptyToolProject();
    expect(Object.keys(project.maps).length).toBe(0);
    expect(project.database.items.length).toBe(0);
    expect(project.database.enemies.length).toBe(0);
    expect(project.database.troops.length).toBe(0);
  });

  it("list_resources가 resourceSearch에 위임한다(charset 검색)", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "list_resources", { kind: "charset", query: "슬라임" }, {});
    expect(result.ok).toBe(true);
    const matches = (result.data as { matches: Array<{ id: string; label: string }> }).matches;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.id.startsWith("charset:")).toBe(true);
  });

  it("list_npc_graphics가 자유 질의로 구조화 메타데이터를 반환한다", () => {
    expect(allTools().map((tool) => tool.name)).toContain("list_npc_graphics");
    expect(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("list_npc_graphics");
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "list_npc_graphics", { query: "old woman" }, {});
    expect(result.ok, result.summary).toBe(true);
    const matches = (result.data as {
      matches: Array<{ textureKey: string; characterIndex: number; label: string; gender?: string; age?: string; tags: readonly string[] }>;
    }).matches;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatchObject({ gender: "female", age: "elder" });
    expect(matches[0]?.textureKey).toMatch(/^tex_easyrpg_charset_/);
    expect(typeof matches[0]?.characterIndex).toBe("number");
  });

  it("place_npc의 graphic.query가 charset 시맨틱으로 해석된다", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    runTool(ctx, "create_map", { name: "테스트", width: 10, height: 10, id: "m_test" }, { dryRun: false });
    const result = runTool(
      ctx,
      "place_npc",
      { mapId: "m_test", x: 4, y: 4, name: "슬라임 손님", graphic: { query: "슬라임" }, pages: [{ lines: ["…"] }] },
      { dryRun: false }
    );
    expect(result.ok).toBe(true);
    const map = ctx.project.maps.m_test;
    const npc = map.events.find((event) => event.id === (result.data as { eventId: string }).eventId);
    expect(npc?.pages?.[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_monster1");
  });

  it("place_npc graphic.query가 사람 차셋 라벨을 해석한다(여관 주인 → people5 idx6)", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    runTool(ctx, "create_map", { name: "여관", width: 10, height: 10, id: "m_inn" }, { dryRun: false });
    const result = runTool(
      ctx,
      "place_npc",
      { mapId: "m_inn", x: 4, y: 4, name: "여관 주인", graphic: { query: "여관 주인" }, pages: [{ lines: ["어서 오세요"] }] },
      { dryRun: false }
    );
    expect(result.ok).toBe(true);
    const npc = ctx.project.maps.m_inn.events.find((event) => event.id === (result.data as { eventId: string }).eventId);
    expect(npc?.pages?.[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_people5");
  });

  it("무매칭 graphic.query는 후보 안내와 함께 거부된다", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    runTool(ctx, "create_map", { name: "빈맵", width: 8, height: 8, id: "m_blank" }, { dryRun: false });
    const result = runTool(
      ctx,
      "place_npc",
      { mapId: "m_blank", x: 3, y: 3, name: "미지", graphic: { query: "존재하지않는리소스xyz" }, pages: [{ lines: ["?"] }] },
      { dryRun: false }
    );
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("graphic-not-found");
    expect(result.issues?.[0]?.message).toContain("list_resources");
  });

  it("list_resources가 tile 검색을 지원한다(표지판 → tile:320)", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "list_resources", { kind: "tile", query: "표지판" }, {});
    expect(result.ok).toBe(true);
    const matches = (result.data as { matches: Array<{ id: string }> }).matches;
    expect(matches.some((match) => match.id === "tile:320")).toBe(true);
  });

  it("잘못된 인자는 커밋 전에 검증 오류로 거부된다", () => {
    const project = createEmptyToolProject();
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "create_map", { name: "이름만" }, { dryRun: true });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-args")).toBe(true);
  });
});

// 노출 상한(40) 핀 목록의 무효 핀 방지 가드.
// toOpenAiTools()가 deprecated를 먼저 걸러내므로, deprecated 툴을 핀해도 노출은 되지 않는다.
describe("PINNED_TOOLS_BY_DOMAIN", () => {
  it("핀된 툴은 모두 실존하고 deprecated가 아니다", () => {
    for (const [domain, names] of PINNED_TOOLS_BY_DOMAIN) {
      for (const name of names) {
        const tool = getTool(name);
        expect(tool, `핀된 툴이 레지스트리에 없다: ${name} (domain=${domain})`).toBeDefined();
        expect(
          tool?.deprecated,
          `핀된 툴이 deprecated 다: ${name} (domain=${domain}, supersededBy=${tool?.supersededBy}) — 노출 필터가 먼저 걸러 핀이 무효하다`,
        ).not.toBe(true);
      }
    }
  });

  it("pins quest persist tools and world facades", () => {
    expect(PINNED_TOOLS_BY_DOMAIN.get("quest")).toEqual(new Set([
      "author_story_arc",
      "define_quest",
      "create_quest",
      "verify_quest",
      "lint_quest",
      "generate_walkthrough",
    ]));
    expect(PINNED_TOOLS_BY_DOMAIN.get("world")).toEqual(new Set([
      "plan_world",
      "build_world",
      "link_maps",
      "lint_world",
    ]));
  });
});
