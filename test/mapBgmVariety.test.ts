// 테마별 맵 BGM 자동 선택 — generate_map/create_map 이 전부 같은 기본곡을 쓰지 않게 지킨다.
import { describe, expect, it } from "vitest";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { BGM_CATALOG, findBgmTrack, type BgmCatalogTrack } from "@/assets/bgmCatalog";
import { findBgmRuntimeEntry, isBgmCatalogResourceId } from "@/assets/bgmCatalogRuntime";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

function catalogId(resourceId: string): string {
  expect(isBgmCatalogResourceId(resourceId), `${resourceId} 가 카탈로그에 없다`).toBe(true);
  expect(findBgmTrack(resourceId), resourceId).toBeDefined();
  expect(findBgmRuntimeEntry(resourceId), resourceId).toBeDefined();
  return resourceId;
}

function sceneText(track: BgmCatalogTrack): string {
  return [track.title, track.category, track.brief, ...track.tags].join("\n");
}

describe("recommendMapBgm", () => {
  it("village/forest/cave 가 같은 시드에서도 서로 다른 곡이다", () => {
    const village = catalogId(recommendMapBgm("village", 1));
    const forest = catalogId(recommendMapBgm("forest", 1));
    const cave = catalogId(recommendMapBgm("cave", 1));
    expect(new Set([village, forest, cave]).size).toBe(3);
  });

  it("같은 시드는 결정적이다", () => {
    expect(recommendMapBgm("forest", 42)).toBe(recommendMapBgm("forest", 42));
    expect(recommendMapBgm("마을", 7)).toBe(recommendMapBgm("village", 7));
    expect(recommendMapBgm("깊은 숲", 3)).toBe(recommendMapBgm("forest", 3));
    expect(recommendMapBgm("고블린 동굴", 11)).toBe(recommendMapBgm("cave", 11));
  });

  it("시드가 바뀌면 후보가 여러 곡일 때 다른 곡을 고른다", () => {
    expect(recommendMapBgm("forest", 1)).not.toBe(recommendMapBgm("forest", 99));
  });

  it("한국어 키워드 마을/숲/동굴/던전/밤/전투 도 카탈로그 곡을 고른다", () => {
    for (const name of ["마을", "숲", "동굴", "던전", "밤", "전투"]) {
      catalogId(recommendMapBgm(name, 1));
    }
    expect(recommendMapBgm("마을", 1)).not.toBe(recommendMapBgm("숲", 1));
    expect(recommendMapBgm("동굴", 1)).not.toBe(recommendMapBgm("전투", 1));
  });

  it("모르는 이름은 필드 폴백으로 카탈로그 곡을 돌려 주고 죽지 않는다", () => {
    const unknown = catalogId(recommendMapBgm("zzzz-not-a-theme-xyz", 1));
    expect(findBgmTrack(unknown)?.category).toMatch(/필드|초원|장거리/);
    expect(catalogId(recommendMapBgm("", Number.NaN))).toBe(STARTER_DEFAULT_BGM_ID);
  });

  it("excludeIds 는 같은 시드에서 다른 후보로 밀어낸다", () => {
    const first = catalogId(recommendMapBgm("forest", 1));
    const second = catalogId(recommendMapBgm("forest", 1, [first]));
    expect(second).not.toBe(first);
  });

  it("마을/숲/동굴은 심리스 루프 곡을 고른다", () => {
    for (const theme of ["village", "forest", "cave"] as const) {
      const id = catalogId(recommendMapBgm(theme, 1));
      expect(findBgmRuntimeEntry(id)?.loop, id).toBe(true);
    }
  });

  it("forest-village/숲 마을 은 village, deep-forest/깊은 숲 은 forest", () => {
    const seed = 1;
    expect(recommendMapBgm("forest-village", seed)).toBe(recommendMapBgm("village", seed));
    expect(recommendMapBgm("숲 마을", seed)).toBe(recommendMapBgm("village", seed));
    expect(recommendMapBgm("deep-forest", seed)).toBe(recommendMapBgm("forest", seed));
    expect(recommendMapBgm("깊은 숲", seed)).toBe(recommendMapBgm("forest", seed));
  });

  it("설명에 맞는 곡을 전부 exclude 하면 스타터 id 로 떨어진다", () => {
    const exclude = BGM_CATALOG.map((track) => track.id).filter((id) => id !== STARTER_DEFAULT_BGM_ID);
    expect(catalogId(recommendMapBgm("village", 1, exclude))).toBe(STARTER_DEFAULT_BGM_ID);
  });

  it("테마 낱말에 없는 장소 이름은 곡 설명에서 찾는다", () => {
    const id = catalogId(recommendMapBgm("등불항구", 1));
    expect(id).not.toBe(STARTER_DEFAULT_BGM_ID);
    expect(sceneText(findBgmTrack(id)!)).toMatch(/항구/);
  });

  it("기획 설명에만 있는 장소도 고른다", () => {
    const id = catalogId(recommendMapBgm("여관", 1));
    expect(findBgmTrack(id)?.brief).toMatch(/여관/);
  });

  it("프로젝트에 덮어쓴 설명을 이름과 대조한다", () => {
    const target = BGM_CATALOG[0]!.id;
    const place = "힣퀴뷁촥";
    expect(recommendMapBgm(place, 1, undefined, {
      descriptions: { [target]: `이 곡은 ${place} 장면을 위한 음악이다.` },
    })).toBe(target);
  });
});
describe("자동 BGM 다양성 (seed 생략 반복)", () => {
  it("generate_map을 seed 없이 같은 테마로 두 번 만들면 다른 곡이다 (풀이 허용할 때)", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const first = runTool(
      ctx,
      "generate_map",
      { theme: "village", width: 12, height: 12, id: "gen_variety_1", chokepoints: 0 },
      { dryRun: false },
    );
    const second = runTool(
      ctx,
      "generate_map",
      { theme: "village", width: 12, height: 12, id: "gen_variety_2", chokepoints: 0 },
      { dryRun: false },
    );
    expect(first.ok, first.summary).toBe(true);
    expect(second.ok, second.summary).toBe(true);
    const firstBgm = (first.data as { bgmResourceId: string }).bgmResourceId;
    const secondBgm = (second.data as { bgmResourceId: string }).bgmResourceId;
    catalogId(firstBgm);
    catalogId(secondBgm);
    expect(secondBgm).not.toBe(firstBgm);
  });

  it("같은 id로 재생하면 같은 BGM이다", () => {
    const runOnce = (): string => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        { theme: "forest", width: 12, height: 12, id: "gen_replay", chokepoints: 0 },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      return (result.data as { bgmResourceId: string }).bgmResourceId;
    };
    expect(runOnce()).toBe(runOnce());
  });

  it("create_map도 seed 없이 같은 이름 반복이면 다른 곡이다 (풀이 허용할 때)", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const first = runTool(
      ctx,
      "create_map",
      { name: "숲속 마을", width: 8, height: 8, id: "map_variety_1" },
      { dryRun: false },
    );
    const second = runTool(
      ctx,
      "create_map",
      { name: "숲속 마을", width: 8, height: 8, id: "map_variety_2" },
      { dryRun: false },
    );
    expect(first.ok, first.summary).toBe(true);
    expect(second.ok, second.summary).toBe(true);
    const firstBgm = (first.data as { bgmResourceId: string }).bgmResourceId;
    const secondBgm = (second.data as { bgmResourceId: string }).bgmResourceId;
    catalogId(firstBgm);
    catalogId(secondBgm);
    expect(secondBgm).not.toBe(firstBgm);
  });
});

describe("generate_map BGM", () => {
  it("테마마다 custom BGM 을 심고 요약/data 에 담는다", () => {
    const ids = new Set<string>();
    for (const theme of ["village", "forest", "cave"] as const) {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        { theme, width: 12, height: 12, seed: 1, id: `gen_${theme}`, chokepoints: 0 },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { bgmResourceId: string };
      const map = ctx.project.maps[`gen_${theme}`]!;
      expect(map.bgm).toEqual({ mode: "custom", resourceId: data.bgmResourceId });
      expect(result.summary).toContain(data.bgmResourceId);
      catalogId(data.bgmResourceId);
      ids.add(data.bgmResourceId);
    }
    expect(ids.size).toBe(3);
  });

  it("명시적 bgmResourceId 가 있으면 자동 선택을 건너뛴다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "generate_map",
      {
        theme: "village",
        width: 12,
        height: 12,
        seed: 1,
        id: "gen_bgm_id",
        chokepoints: 0,
        bgmResourceId: STARTER_BATTLE_BGM_ID,
      },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.gen_bgm_id?.bgm).toEqual({
      mode: "custom",
      resourceId: STARTER_BATTLE_BGM_ID,
    });
    expect((result.data as { bgmResourceId: string }).bgmResourceId).toBe(STARTER_BATTLE_BGM_ID);
  });

  it("명시적 bgm custom 이 있으면 자동 선택을 건너뛴다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "generate_map",
      {
        theme: "forest",
        width: 12,
        height: 12,
        seed: 1,
        id: "gen_bgm_custom",
        chokepoints: 0,
        bgm: { mode: "custom", resourceId: STARTER_DEFAULT_BGM_ID },
      },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.gen_bgm_custom?.bgm).toEqual({
      mode: "custom",
      resourceId: STARTER_DEFAULT_BGM_ID,
    });
  });

  it("명시적 bgm none 은 무음으로 심는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "generate_map",
      {
        theme: "cave",
        width: 12,
        height: 12,
        seed: 1,
        id: "gen_bgm_none",
        chokepoints: 0,
        bgm: { mode: "none" },
      },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.gen_bgm_none?.bgm).toEqual({ mode: "none" });
  });
});

describe("create_map BGM", () => {
  it("맵 이름 키워드로 테마를 읽어 자동 지정한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      { name: "고블린 동굴", width: 8, height: 8, id: "map_cave", seed: 1 },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { bgmResourceId: string };
    expect(ctx.project.maps.map_cave?.bgm).toEqual({ mode: "custom", resourceId: data.bgmResourceId });
    catalogId(data.bgmResourceId);
    expect(sceneText(findBgmTrack(data.bgmResourceId)!)).toMatch(/동굴|광산|광물/);
  });

  it("명시적 bgmResourceId 가 있으면 자동 선택을 건너뛴다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      { name: "마을", width: 8, height: 8, id: "map_explicit", bgmResourceId: STARTER_DEFAULT_BGM_ID },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_explicit?.bgm).toEqual({
      mode: "custom",
      resourceId: STARTER_DEFAULT_BGM_ID,
    });
  });

  it("bgm none 은 무음으로 심는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      { name: "마을", width: 8, height: 8, id: "map_bgm_none", bgm: { mode: "none" } },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_bgm_none?.bgm).toEqual({ mode: "none" });
  });

  it("bgm parent 는 상속으로 심는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      { name: "마을", width: 8, height: 8, id: "map_bgm_parent", bgm: { mode: "parent" } },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_bgm_parent?.bgm).toEqual({ mode: "parent" });
  });

  it("bgm custom 객체는 지정 곡을 심는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      {
        name: "마을",
        width: 8,
        height: 8,
        id: "map_bgm_custom",
        bgm: { mode: "custom", resourceId: STARTER_BATTLE_BGM_ID },
      },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_bgm_custom?.bgm).toEqual({
      mode: "custom",
      resourceId: STARTER_BATTLE_BGM_ID,
    });
  });

  it("bgm 객체에 mode 가 없으면 거절한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = runTool(
      ctx,
      "create_map",
      { name: "마을", width: 8, height: 8, id: "map_bgm_empty", bgm: {} },
      { dryRun: false },
    );
    expect(result.ok, result.summary).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(result.issues?.[0]?.message ?? result.summary).toMatch(/mode/);
    expect(ctx.project.maps.map_bgm_empty).toBeUndefined();
  });

  it("같은 id로 재생하면 같은 BGM이다 (id 유도 결정성)", () => {
    const runOnce = (): string => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "달빛 마을", width: 8, height: 8, id: "map_replay" },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      const bgm = ctx.project.maps.map_replay?.bgm;
      expect(bgm?.mode).toBe("custom");
      const resourceId = (bgm as { resourceId: string }).resourceId;
      catalogId(resourceId);
      return resourceId;
    };
    expect(runOnce()).toBe(runOnce());
  });
});
