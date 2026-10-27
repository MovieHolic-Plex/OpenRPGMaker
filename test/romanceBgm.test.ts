import { describe, expect, it } from "vitest";
import { BGM_CATALOG } from "../src/assets/bgmCatalog";
import { recommendMapBgm } from "../src/assets/bgmThemeRecommendation";
import { runTool } from "../src/editor/tools";
import { createBlankProject } from "../src/project/defaults";

const EVERYDAY_CATEGORIES = ["찻집 · 대화", "서점 · 비 오는 실내", "옥상 · 도시 저녁", "공원 · 도시 저녁", "귀환 · 조용한 대화", "도시 광장 · 저녁", "온실 · 휴식 · 대화", "마을 · 휴식", "회관 · 공동체", "연못 · 휴식"];

describe("현대 일상 장소(연애·학원·직장물) BGM", () => {
  it("캠퍼스·교실·카페·사무실 이름은 잔잔한 일상 곡 카테고리에서 고른다", () => {
    for (const name of ["캠퍼스 교정", "본관 강의실", "학생회관 동아리방", "로스터리 카페 & 라운지", "기획팀 오피스", "옥상", "편의점"]) {
      for (const seed of [1, 2, 3]) {
        const track = BGM_CATALOG.find((t) => t.id === recommendMapBgm(name, seed));
        expect(EVERYDAY_CATEGORIES, `${name}/${seed} → ${track?.category}`).toContain(track?.category);
      }
    }
  });

  it("기존 마을·숲 테마는 그대로다", () => {
    expect(recommendMapBgm("마을", 7)).toBe(recommendMapBgm("village", 7));
    expect(recommendMapBgm("깊은 숲", 3)).toBe(recommendMapBgm("forest", 3));
  });

  it("일본 현대 실내를 새로 지으면 BGM 이 비지 않는다, 환상 실내도 곡을 받는다", () => {
    const ctx = { project: createBlankProject() };
    const jp = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", name: "집", floor: "flooring", wall: "cloth", layout: { program: "house-1f" } });
    expect(jp.ok, jp.summary).toBe(true);
    expect(ctx.project.maps[(jp.data as { mapId: string }).mapId]?.bgm?.mode).toBe("custom");
    const fantasy = runTool(ctx, "build_hand_interior_room", { name: "빵집", floor: "plank", wall: "plaster", layout: { program: "bakery" } });
    expect(fantasy.ok, fantasy.summary).toBe(true);
    // #3226(2026-10-22): 환상 실내도 새로 지으면 무음으로 남지 않게 마을 곡이 기본으로 붙는다.
    expect(ctx.project.maps[(fantasy.data as { mapId: string }).mapId]?.bgm?.mode).toBe("custom");
  });
});
