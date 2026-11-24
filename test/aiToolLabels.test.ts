import { describe, expect, it } from "vitest";
import { TOOL_LABELS, toolGroup, toolIconKey, toolLabel, toolLabelSummary } from "@/editor/panels/aiToolLabels";
import { DECK_ICON_NAMES } from "@/editor/panels/aiDeckIcons";
import { activeTools } from "@/editor/tools/toolRegistry";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { createTranslator } from "@/i18n/translator";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";

describe("aiToolLabels — 툴 이름을 사람 말로", () => {
  it("아는 툴은 한국어 라벨로 부른다", () => {
    // Break: 사전 항목이 빠지거나 오타가 나면 로그 행이 함수 이름을 그대로 보인다.
    expect(toolLabel("place_npc")).toBe("NPC 배치");
    expect(toolLabel("find_layout_regions")).toBe("빈 자리 찾기");
    expect(toolLabel("get_map_region")).toBe("영역 읽기");
    // author_house 는 제거됐다 — 야외 집은 place_terrain_house 가 짓는다.
    expect(toolLabel("place_terrain_house")).toBe("지형 위 집 놓기");
  });

  it("웹 검색은 사전에 있다 — 없으면 화면에 영문 함수명이 그대로 보인다", () => {
    // Break(2026-09-21 실측): 사전에서 빠지면 조수가 검색할 때마다 작업 타임라인이 영문을 보여 준다.
    expect(toolLabel("web_search")).toBe("웹 검색");
    // 바깥 검색이므로 돋보기 아이콘·조회 그룹이다.
    expect(toolIconKey("web_search")).toBe("search");
    expect(toolGroup("web_search")).toBe("inspect");
  });

  it.each([
    [en, "List small-task actions", "Apply small-task action"],
    [ja, "小さな作業の操作一覧を取得", "小さな作業の操作を適用"],
    [zh, "列出小任务操作", "应用小任务操作"],
  ] as const)("작은 일 동작 두 개를 표시 언어로 번역한다 (%#)", (catalog, list, apply) => {
    const translator = createTranslator(catalog);
    expect(translator.translate(toolLabel("list_small_task_primitives"))).toBe(list);
    expect(translator.translate(toolLabel("apply_small_task_primitive"))).toBe(apply);
  });

  it("모르는 툴은 원문의 밑줄만 공백으로 푼다 — 지어내지 않는다", () => {
    // Break: 폴백이 빈 문자열이나 원문 그대로(밑줄 포함)를 돌려준다.
    expect(toolLabel("weird_new_tool")).toBe("weird new tool");
  });

  it("아이콘 키는 조회·편집 계열로 갈리고 폴백은 접두어로 정한다", () => {
    // Break: 조회 툴에 편집 아이콘이 붙거나 폴백이 undefined 다.
    expect(toolIconKey("get_map_region")).toBe("grid");
    expect(toolIconKey("place_npc")).toBe("user");
    expect(toolIconKey("place_terrain_house")).toBe("house"); // author_house 제거 뒤의 집 도구.
    expect(toolIconKey("get_something_new")).toBe("search");
    expect(toolIconKey("nothing_known")).toBe("wrench");
    expect(toolGroup("list_whatever")).toBe("inspect");
    expect(toolGroup("stamp_object")).toBe("build"); // stamp_structure 제거 뒤의 찍기 도구.
  });

  it("사전의 모든 아이콘 키는 실제 아이콘 이름이다", () => {
    // Break: 사전에 존재하지 않는 아이콘 키를 적으면 렌더 시 SHAPES[name] 이 undefined 다.
    const names = new Set<string>(DECK_ICON_NAMES);
    for (const [tool, entry] of Object.entries(TOOL_LABELS)) {
      expect(names.has(entry.icon), `${tool} → ${entry.icon}`).toBe(true);
    }
  });

  it("요약은 라벨을 화살표로 잇고 넷을 넘으면 줄임표", () => {
    // Break: 구분자가 바뀌거나 상한이 없어 헤더 한 줄이 넘친다.
    expect(toolLabelSummary(["get_map_region", "find_layout_regions"])).toBe("영역 읽기 → 빈 자리 찾기");
    // stamp_structure 는 제거됐다 — 찍기는 stamp_object 다.
    expect(toolLabelSummary(["get_map_region", "find_layout_regions", "stamp_object", "place_npc", "set_shop_stock"]))
      .toBe("영역 읽기 → 빈 자리 찾기 → 공용 오브젝트 찍기 → NPC 배치 → …");
    expect(toolLabelSummary([])).toBe("");
  });

  it("모델에 노출되는 모든 툴은 사전에 있다 — 없으면 작업 과정에 영문 함수명이 보인다", () => {
    // Break(2026-09-23 실측): 248개 중 160개가 사전에 없어 「read tileset reference」 가 그대로 보였다.
    const missing = activeTools().map(tool => tool.name).filter(name => !TOOL_LABELS[name]);
    expect(missing).toEqual([]);
  });

  it("조수 v2 동사도 모두 사전에 있다 — v2 가 기본이 된 뒤 작업 표시에 «make place» 같은 영문이 떴다(qa1124 20개)", () => {
    // Break: v2 동사를 더하고 사전을 빠뜨리면 여기서 잡힌다. todo 는 단계로 세지 않는 조용한 도구다.
    const env = { ctx: { project: { maps: {} } }, request: { task: "", mapIds: [] }, emit() {}, record() {}, checkpoint: async () => {} } as never;
    const names = createV2Tools(env, new V2Session()).map(tool => tool.name).filter(name => name !== "todo");
    expect(names.length).toBeGreaterThan(20);
    expect(names.filter(name => !TOOL_LABELS[name])).toEqual([]);
  });
});
