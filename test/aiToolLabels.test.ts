import { describe, expect, it } from "vitest";
import { TOOL_LABELS, toolGroup, toolIconKey, toolLabel, toolLabelSummary } from "@/editor/panels/aiToolLabels";
import { DECK_ICON_NAMES } from "@/editor/panels/aiDeckIcons";

describe("aiToolLabels — 툴 이름을 사람 말로", () => {
  it("아는 툴은 한국어 라벨로 부른다", () => {
    // Break: 사전 항목이 빠지거나 오타가 나면 로그 행이 함수 이름을 그대로 보인다.
    expect(toolLabel("place_npc")).toBe("NPC 배치");
    expect(toolLabel("find_layout_regions")).toBe("빈 자리 찾기");
    expect(toolLabel("get_map_region")).toBe("영역 읽기");
    expect(toolLabel("author_house")).toBe("집 짓기");
  });

  it("모르는 툴은 원문의 밑줄만 공백으로 푼다 — 지어내지 않는다", () => {
    // Break: 폴백이 빈 문자열이나 원문 그대로(밑줄 포함)를 돌려준다.
    expect(toolLabel("weird_new_tool")).toBe("weird new tool");
  });

  it("아이콘 키는 조회·편집 계열로 갈리고 폴백은 접두어로 정한다", () => {
    // Break: 조회 툴에 편집 아이콘이 붙거나 폴백이 undefined 다.
    expect(toolIconKey("get_map_region")).toBe("grid");
    expect(toolIconKey("place_npc")).toBe("user");
    expect(toolIconKey("author_house")).toBe("house");
    expect(toolIconKey("get_something_new")).toBe("search");
    expect(toolIconKey("nothing_known")).toBe("wrench");
    expect(toolGroup("list_whatever")).toBe("inspect");
    expect(toolGroup("stamp_structure")).toBe("build");
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
    expect(toolLabelSummary(["get_map_region", "find_layout_regions", "stamp_structure", "place_npc", "set_shop_stock"]))
      .toBe("영역 읽기 → 빈 자리 찾기 → 건물 찍기 → NPC 배치 → …");
    expect(toolLabelSummary([])).toBe("");
  });
});
