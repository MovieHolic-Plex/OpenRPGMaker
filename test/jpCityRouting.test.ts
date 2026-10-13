// jp_city 라우팅 — 일본이라는 말 없이 도시 거리를 말한 요청은 «프로젝트에 jp_city 맵이 있을 때만» jp_city 로 간다. 이 파일은 작성 시 실행하지 않았다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { describesCityStreet, jpCityTargetFor, JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE, formatJpCityNote } from "@/ai/jpCityPolicy";
import { declaredIntent } from "./intentFixture";
import type { ToolContext } from "@/editor/tools/types";

const START = "map_blank_start";
const create = declaredIntent({ mode: "create", space: "outdoor" });

function withJpMap() {
  const ctx: ToolContext = { project: createBlankProject(), currentMapId: START, approvedTilesetFamilies: ["oprn-jp"] };
  expect(runTool(ctx, "create_map", { name: "상가", width: 50, height: 36, tilesetId: "jp_city", id: "jpmap" }).ok).toBe(true);
  return ctx.project;
}

describe("도시 거리 낱말", () => {
  it.each(["현대 번화가 만들어줘", "상점가 거리 하나", "도심 맵", "시가지 지어줘", "주택가 동네 거리", "downtown shopping street", "residential area"])("%s", (text) => {
    expect(describesCityStreet(text)).toBe(true);
  });
  it.each(["미국풍 번화가", "new york downtown", "modern_city 도심", "성 하나 만들어줘", "숲속 마을"])("%s 는 아니다", (text) => {
    expect(describesCityStreet(text)).toBe(false);
  });
});

describe("jpCityTargetFor — 일본 낱말 없는 요청", () => {
  it("프로젝트에 jp_city 맵이 있으면 새 맵 생성 요청도 jp_city 로 간다", () => {
    expect(jpCityTargetFor(withJpMap(), create, "현대 번화가 만들어줘", START, false)).toEqual({});
  });
  it("jp_city 맵이 없으면 약한 낱말(주택가·골목)만으로는 가지 않는다", () => {
    expect(jpCityTargetFor(createBlankProject(), create, "주택가 골목 만들어줘", START, false)).toBeNull();
  });
  it("jp_city 맵이 없어도 분명한 현대 도시 낱말(번화가·상점가·도심)은 jp_city 로 간다(2026-10-13 실시험 0/10 수정)", () => {
    for (const text of ["현대 도시 상점가 거리를 하천이 흐르게 만들어 줘", "번화가 만들어줘", "도심 맵"]) {
      expect(jpCityTargetFor(createBlankProject(), create, text, START, false)).toEqual({});
    }
  });
  it("미국풍·성 요청은 빈 프로젝트에서도 가지 않는다", () => {
    for (const text of ["미국풍 번화가", "new york downtown", "성 하나 만들어줘"]) {
      expect(jpCityTargetFor(createBlankProject(), create, text, START, false)).toBeNull();
    }
  });
  it("미국풍 낱말이 있으면 jp_city 맵이 있어도 가지 않는다", () => {
    expect(jpCityTargetFor(withJpMap(), create, "미국풍 번화가 만들어줘", START, false)).toBeNull();
  });
  it("실내·질문은 여전히 제외", () => {
    expect(jpCityTargetFor(withJpMap(), declaredIntent({ mode: "create", space: "interior" }), "번화가 가게 실내", START, false)).toBeNull();
    expect(jpCityTargetFor(withJpMap(), declaredIntent({ mode: "question", space: "outdoor" }), "번화가가 뭐야", START, false)).toBeNull();
  });
});

describe("compose 우선 지침", () => {
  it("포인터·상세·노트가 compose_jp_city_street 를 기본으로 말하고 PAW 게이트 낱말을 쓰지 않는다", () => {
    for (const text of [JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE, formatJpCityNote({}, null), formatJpCityNote({ mapId: "m", lived: false }, null)]) {
      expect(text).toContain("compose_jp_city_street");
      expect(text).not.toMatch(/현대|모던|modern|contemporary/iu);
    }
    expect(JP_CITY_DETAIL_LINE).toContain("replace:true");
    expect(JP_CITY_DETAIL_LINE).toContain("link_jp_city_interior");
  });
});
