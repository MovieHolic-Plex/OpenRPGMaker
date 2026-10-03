// 일본 도시(jp_city) 조수 연결 — 조수가 칩셋·건물 조립 도구·참고문서 길을 «볼 수 있는가». 배경: src/ai/jpCityPolicy.ts 머리 주석.
// 순수 라우팅·지시문·도구 오류 문장만 본다(모델 호출 없음). 이 파일은 2026-10-04 작성 시 실행하지 않았다 — 같은 단언을 bun 스크립트로 확인했다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { requestsModernMap } from "@/ai/modernTilesetPolicy";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { JP_CITY_EXPOSED_TOOLS, jpCityTargetFor, formatJpCityNote } from "@/ai/jpCityPolicy";
import { TASK_RECIPES, buildTaskRecipes } from "@/ai/toolCapabilityIndex";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { getTool } from "@/editor/tools/toolRegistry";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { declaredIntent, fixedDeclarer } from "./intentFixture";
import type { ToolContext } from "@/editor/tools/types";

const START = "map_blank_start";

function projectWithJpMap() {
  const ctx: ToolContext = { project: createBlankProject(), currentMapId: START, approvedTilesetFamilies: ["oprn-jp"] };
  const made = runTool(ctx, "create_map", { name: "상가 거리", width: 40, height: 30, tilesetId: "jp_city", id: "jpmap" });
  expect(made.ok).toBe(true);
  return ctx;
}

describe("jp_city 대상 판정", () => {
  const project = createBlankProject();
  const create = declaredIntent({ mode: "create", space: "outdoor" });

  it("일본 상가 거리·칩셋 이름을 말한 생성 요청은 새 맵 대상이다", () => {
    expect(jpCityTargetFor(project, create, "일본 상가 거리 맵 만들어 줘", START, false)).toEqual({});
    expect(jpCityTargetFor(project, create, "jp_city 로 맵 하나", START, false)).toEqual({});
  });
  it("무관한 요청·실내·질문·NPC 는 대상이 아니다", () => {
    expect(jpCityTargetFor(project, create, "성 하나 만들어줘", START, false)).toBeNull();
    expect(jpCityTargetFor(project, declaredIntent({ mode: "create", space: "interior" }), "일본 이자카야 실내", START, false)).toBeNull();
    expect(jpCityTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "일본 상가 거리가 뭐야", START, false)).toBeNull();
    expect(jpCityTargetFor(project, declaredIntent({ mode: "create", space: "none" }), "일본 편의점 점원 NPC", START, false)).toBeNull();
  });
  it("대상 맵이 jp_city 이면 문구와 무관하게 그 맵이다", () => {
    const { project: p } = projectWithJpMap();
    expect(jpCityTargetFor(p, declaredIntent({ mode: "modify", space: "outdoor" }), "여기 편의점 하나 지어줘", "jpmap", false)).toEqual({ mapId: "jpmap", lived: false });
  });
});

describe("PAW 전용 현대 맵 게이트", () => {
  it("jp_city 를 직접 부르거나 PAW 가 없는데 일본 상가를 «현대»로 말하면 게이트가 물러선다", () => {
    const project = createBlankProject();
    expect(requestsModernMap(project, "현대 일본 상가 거리 맵 만들어줘 (jp_city 칩셋)", [START])).toBe(false);
    expect(requestsModernMap(project, "현대 일본 상가 거리 맵 만들어줘", [START])).toBe(false);
  });
  it("PAW 와 무관한 현대 학교 요청은 여전히 게이트를 켠다", () => {
    expect(requestsModernMap(createBlankProject(), "현대 학교 교실 맵 만들어줘", [])).toBe(true);
  });
});

describe("지시문", () => {
  it("모든 시스템 프롬프트에 jp_city 길 한 줄이 있고, jp_city 맵이 범위에 있으면 상세 순서가 더 붙는다", () => {
    const ctx = projectWithJpMap();
    const plain = buildPiAgentSystemPrompt(ctx.project, [START]).filter((line) => line.includes("jp_city"));
    const scoped = buildPiAgentSystemPrompt(ctx.project, ["jpmap"]).filter((line) => line.includes("jp_city"));
    expect(plain).toHaveLength(1);
    expect(scoped).toHaveLength(2);
    expect(scoped.join("\n")).toContain("layer \"2\"");
    expect(scoped.join("\n")).toContain("build_jp_city_building");
  });
  it("의도 노트는 PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다 — 노트는 task 에 실려 게이트를 켠다", () => {
    const note = formatJpCityNote({}, null) + formatJpCityNote({ mapId: "jpmap", lived: false }, { id: "jpmap", width: 40, height: 30 })
      + formatJpCityNote({ mapId: "jpmap", lived: true }, null);
    expect(note).not.toMatch(/현대|모던|modern|contemporary/iu);
  });
  it("buildPiIntentNote 는 jp_city 대상이면 숲마을 노트를 jp_city 노트로 바꾼다", () => {
    const project = createBlankProject();
    const intent = declaredIntent({ mode: "create", space: "outdoor", tools: ["author_village"] });
    const note = buildPiIntentNote({ project, intent, targetMap: null, selection: null, jpCity: {}, requestText: "일본 상가 거리" })!;
    expect(note).toContain("jp_city");
    expect(note).not.toContain("[마을 시공]");
  });
  it("태스크 레시피에 jp-city 가 있고 이름이 전부 실제 도구다", () => {
    const recipe = TASK_RECIPES.find((entry) => entry.id === "jp-city")!;
    expect(recipe).toBeDefined();
    expect(recipe.write).toContain("build_jp_city_building");
    for (const name of [...recipe.read, ...recipe.verify]) expect(getTool(name)?.mode, name).toBe("read");
    for (const name of recipe.write) expect(getTool(name)?.mode, name).toBe("write");
    expect(buildTaskRecipes()).toContain("jp-city:");
  });
});

describe("도구 노출", () => {
  it("jp_city 요청·맵이면 첫 요청부터 조립 도구·참고문서·도로 키트 도구가 보인다(author_village 선언이어도)", async () => {
    const ctx = projectWithJpMap();
    const turn = await classifyPlainPiTurn({
      project: ctx.project, text: "일본 상가 거리 맵 만들어 줘", currentMapId: START, selection: null, hasActivePlan: false,
      autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer({ mode: "create", space: "outdoor", tools: ["author_village"] }), piTeam: false,
    });
    for (const name of JP_CITY_EXPOSED_TOOLS) expect(turn.initialToolNames, name).toContain(name);
    expect(turn.plan.villageContract).toBeUndefined();
    expect(turn.intentNote).toContain("[일본 거리 시공 — jp_city]");
    expect(turn.intentNote).not.toContain("[마을 시공 — 버들항]");
  });
  it("조립 도구와 부품 조회 도구는 짝으로 승격된다", () => {
    const names = capabilityEscalatedToolNames("일본 상가 건물 짓기", new Set());
    if (names.includes("build_jp_city_building")) expect(names).toContain("list_jp_city_building_parts");
    if (names.includes("list_jp_city_building_parts")) expect(names).toContain("build_jp_city_building");
  });
});

describe("build_jp_city_building 오류는 다음 행동을 알려 준다", () => {
  const build = (ctx: ToolContext, over: Record<string, unknown> = {}) => runTool(ctx, "build_jp_city_building", {
    mapId: "jpmap", x: 4, y: 12, w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 }, ...over,
  });
  it("빈 jp_city 맵의 문 앞 막힘은 fill_region 인자를 돌려주고, 그대로 깔면 지어진다", () => {
    const ctx = projectWithJpMap();
    const failed = build(ctx);
    expect(failed.ok).toBe(false);
    const message = failed.issues?.[0]?.message ?? "";
    expect(message).toContain("DOOR_BLOCKED");
    expect(message).toContain("fill_region(");
    expect(message).toContain("referencePurpose:\"jp-start\"");
    const filled = runTool(ctx, "fill_region", { mapId: "jpmap", rect: { x: 5, y: 13, w: 4, h: 3 }, material: "보도 연석", referencePurpose: "jp-start" });
    expect(filled.ok).toBe(true);
    expect(build(ctx).ok).toBe(true);
  });
  it("모르는 부품 id 는 조회 도구를, 좁은 폭은 최소 폭을 알려 준다", () => {
    const ctx = projectWithJpMap();
    const message = build(ctx, { w: 2, ground: "gr.nope" }).issues?.[0]?.message ?? "";
    expect(message).toContain("list_jp_city_building_parts");
    expect(message).toContain("최소 3");
  });
  it("jp_city 가 아닌 맵에서는 create_map 길을 알려 준다", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
    const message = runTool(ctx, "build_jp_city_building", { mapId: START, x: 4, y: 12, w: 6, ground: "gr.konbini.0" }).issues?.[0]?.message ?? "";
    expect(message).toContain("create_map");
    expect(message).toContain("ask_tileset_change");
  });
  it("에디터 층 한계로 거부되는 예제 셋은 stamp_object 레시피 키트를 알려 준다", () => {
    const hit = runTool({ project: createBlankProject() }, "list_jp_city_building_parts", { example: "machiya_izakaya" });
    expect(hit.summary).toContain("kit:jp_city/jp-recipe-machiya-izakaya");
  });
});

describe("새 맵 길", () => {
  it("다른 계열 맵을 보는 중이면 create_map 이 계열 변경으로 거부하고 ask_tileset_change 를 가리킨다", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
    const refused = runTool(ctx, "create_map", { name: "상가", width: 30, height: 20, tilesetId: "jp_city" });
    expect(refused.ok).toBe(false);
    expect(refused.issues?.[0]?.code).toBe("tileset-family-change");
    expect(refused.issues?.[0]?.message).toContain("ask_tileset_change");
  });
});

describe("참고문서 쪽은 읽은 증거로 인정되게 잘리지 않는다", () => {
  it("12,000자를 넘는 jp-dict-groups 첫 쪽도 read_tileset_reference 결과가 dataTruncated 가 아니다", async () => {
    const project = createBlankProject();
    const tool = createPiToolset({ project, currentMapId: START }, {}).find((entry) => entry.name === "read_tileset_reference")!;
    const result = await tool.execute("call-1", { tilesetId: "jp_city", categoryId: "jp-start", documentId: "jp-dict-groups", offset: 0 } as never, undefined as never);
    const text = (result.content[0] as { text: string }).text;
    expect(text.length).toBeGreaterThan(12_000);
    expect(JSON.parse(text).dataTruncated).not.toBe(true);
  });
});
