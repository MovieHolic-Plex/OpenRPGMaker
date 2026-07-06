// test/toolRegistry.test.ts
// 툴 레지스트리 스키마 유효성 + dry-run 불변성 + 커밋 게이트 검증.

import { describe, expect, it } from "vitest";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { allTools, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

describe("toolRegistry", () => {
  it("모든 툴이 유효한 OpenAI 함수 스키마를 산출한다", () => {
    const openai = toOpenAiTools();
    expect(openai.length).toBe(allTools().length);
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
