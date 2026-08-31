import { describe, expect, it } from "vitest";
import {
  BUILTIN_WORLD_GEN_KEYWORD_RULES,
  broadleafCountFor,
  coniferCountFor,
  DEFAULT_WORLD_GEN_RULES,
  forestBandDepth,
  lakeDiameter,
  matchWorldGenKeywords,
  resolveWorldGenKeywordRules,
  resolveWorldGenRules,
  riverBandDepth,
  waterShapeFor,
  WORLD_GEN_BOUNDS,
} from "@/project/worldGenRules";
import { WORLD_GEN_PRESETS } from "@/project/worldGenPresets";
import { inferRequirementsFromQuery } from "@/editor/tools/villageRequirements";
import { buildTerrainConstraintMasks } from "@/editor/tools/villageTerrainPass";

const MAP = { width: 60, height: 44 } as const;

describe("worldGenRules 기본값은 예전 하드코딩과 같다", () => {
  it("규칙이 없으면 예전 상수 그대로 해석한다", () => {
    const rules = resolveWorldGenRules(undefined);
    expect(rules.water.riverBandRatio).toBe(0.12);
    expect(rules.water.riverBandMin).toBe(4);
    expect(rules.water.riverBandMax).toBe(6);
    expect(rules.water.lakeRatioWithRiver).toBe(0.14);
    expect(rules.water.lakeRatioAlone).toBe(0.28);
    expect(rules.forest.depthRatio).toBe(0.14);
    expect(rules.forest.coniferAreaPerTree).toBe(10);
    expect(rules.forest.broadleafMaxCount).toBe(10);
  });

  it("계산 헬퍼가 예전 식과 같은 값을 낸다", () => {
    const shortSide = 44;
    const water = DEFAULT_WORLD_GEN_RULES.water;
    const forest = DEFAULT_WORLD_GEN_RULES.forest;
    expect(riverBandDepth(shortSide, water)).toBe(Math.min(6, Math.max(4, Math.floor(shortSide * 0.12))));
    expect(lakeDiameter(shortSide, water, true)).toBe(Math.max(8, Math.floor(shortSide * 0.14)));
    expect(lakeDiameter(shortSide, water, false)).toBe(Math.max(8, Math.floor(shortSide * 0.28)));
    expect(forestBandDepth(shortSide, forest)).toBe(Math.max(4, Math.floor(shortSide * 0.14)));
    expect(coniferCountFor(300, forest)).toBe(Math.max(8, Math.floor(300 / 10)));
    expect(broadleafCountFor(300, forest)).toBe(Math.max(4, Math.min(10, Math.floor(300 / 28))));
  });

  it("auto 수면 모양은 정사각 허용 오차로 원/타원을 고른다", () => {
    const water = DEFAULT_WORLD_GEN_RULES.water;
    expect(waterShapeFor(10, 11, water)).toBe("circle");
    expect(waterShapeFor(10, 30, water)).toBe("ellipse");
    expect(waterShapeFor(10, 30, { ...water, shape: "rect" })).toBe("rect");
  });
});

describe("낱말 규칙", () => {
  it("내장 규칙이 예전 정규식 판정을 재현한다", () => {
    expect(inferRequirementsFromQuery("강촌마을").landmarks).toEqual(
      expect.arrayContaining(["river", "forest"]),
    );
    expect(inferRequirementsFromQuery("호수 마을").landmarks).toEqual(
      expect.arrayContaining(["lake", "forest"]),
    );
    expect(inferRequirementsFromQuery("항구 어촌").landmarks).toEqual(
      expect.arrayContaining(["harbor", "river"]),
    );
    expect(inferRequirementsFromQuery("장터 도시").landmarks).toContain("market");
  });

  it("제외 낱말은 발동을 막는다", () => {
    expect(inferRequirementsFromQuery("강원 지방").landmarks).not.toContain("river");
    expect(inferRequirementsFromQuery("도시 중심").landmarks).not.toContain("forest");
  });

  it("빈 프롬프트는 아무 지형도 요구하지 않는다", () => {
    expect(matchWorldGenKeywords("   ", BUILTIN_WORLD_GEN_KEYWORD_RULES).landmarks).toEqual([]);
  });

  it("저자 규칙이 새 낱말을 추가한다", () => {
    const rules = resolveWorldGenRules({
      keywords: [{ id: "mine", label: "용암", words: ["용암", "화산"], landmarks: ["lake"] }],
    });
    expect(matchWorldGenKeywords("화산 아래 촌락", rules.keywords).landmarks).toContain("lake");
  });

  it("같은 id 로 내장 규칙을 끌 수 있다", () => {
    const merged = resolveWorldGenKeywordRules({
      keywords: [{ id: "builtin-lake", label: "호수", words: ["호수"], landmarks: ["lake"], enabled: false }],
    });
    const lake = merged.find((rule) => rule.id === "builtin-lake");
    expect(lake?.enabled).toBe(false);
    expect(matchWorldGenKeywords("호수 마을", merged).landmarks).not.toContain("lake");
  });

  it("useBuiltinKeywords=false 면 내장 규칙이 전부 빠진다", () => {
    const merged = resolveWorldGenKeywordRules({ useBuiltinKeywords: false });
    expect(merged).toEqual([]);
  });
});

describe("규칙이 실제 마스크를 움직인다", () => {
  it("호수 비율을 키우면 물 사각이 커진다", () => {
    const req = inferRequirementsFromQuery("호수 마을");
    const base = buildTerrainConstraintMasks(MAP, req, undefined, resolveWorldGenRules(undefined));
    const wide = buildTerrainConstraintMasks(
      MAP,
      req,
      undefined,
      resolveWorldGenRules({ water: { lakeRatioAlone: 0.5 } }),
    );
    const baseLake = base.waterRects[0]!;
    const wideLake = wide.waterRects[0]!;
    expect(wideLake.w).toBeGreaterThan(baseLake.w);
  });

  it("숲 깊이 비율을 키우면 숲 밴드가 깊어진다", () => {
    const req = inferRequirementsFromQuery("숲속 마을");
    const base = buildTerrainConstraintMasks(MAP, req, undefined, resolveWorldGenRules(undefined));
    const deep = buildTerrainConstraintMasks(
      MAP,
      req,
      undefined,
      resolveWorldGenRules({ forest: { depthRatio: 0.35 } }),
    );
    const baseBand = Math.min(base.forestRects[0]!.w, base.forestRects[0]!.h);
    const deepBand = Math.min(deep.forestRects[0]!.w, deep.forestRects[0]!.h);
    expect(deepBand).toBeGreaterThan(baseBand);
  });

  it("저자가 방향을 고정하면 추론된 방향을 덮는다", () => {
    const req = inferRequirementsFromQuery("호수 마을", resolveWorldGenRules({ water: { side: "south" } }));
    expect(req.riverSide).toBe("south");
    expect(req.forestSide).toBe("north");
  });

  it("숲 방향도 따로 고정할 수 있다", () => {
    const req = inferRequirementsFromQuery(
      "강촌마을",
      resolveWorldGenRules({ water: { side: "west" }, forest: { side: "north" } }),
    );
    expect(req.riverSide).toBe("west");
    expect(req.forestSide).toBe("north");
  });
});

describe("정규화", () => {
  it("범위를 벗어난 값은 경계로 잘린다", () => {
    const rules = resolveWorldGenRules({
      water: { riverBandRatio: 99, lakeMinSize: -5 },
      forest: { coniferGap: 0, coniferNaturalness: 4 },
    });
    expect(rules.water.riverBandRatio).toBe(WORLD_GEN_BOUNDS.riverBandRatio.max);
    expect(rules.water.lakeMinSize).toBe(WORLD_GEN_BOUNDS.lakeMinSize.min);
    expect(rules.forest.coniferGap).toBe(WORLD_GEN_BOUNDS.coniferGap.min);
    expect(rules.forest.coniferNaturalness).toBe(WORLD_GEN_BOUNDS.coniferNaturalness.max);
  });

  it("최대가 최소보다 작으면 최소로 끌어올린다", () => {
    const rules = resolveWorldGenRules({
      water: { riverBandMin: 12, riverBandMax: 3 },
      forest: { broadleafMinCount: 20, broadleafMaxCount: 2 },
    });
    expect(rules.water.riverBandMax).toBe(12);
    expect(rules.forest.broadleafMaxCount).toBe(20);
  });

  it("쓰레기 값은 기본값으로 떨어진다", () => {
    const rules = resolveWorldGenRules({
      water: { riverBandRatio: Number.NaN, shape: "banana" as never, side: "up" as never },
    });
    expect(rules.water.riverBandRatio).toBe(0.12);
    expect(rules.water.shape).toBe("auto");
    expect(rules.water.side).toBe("auto");
  });
});

describe("예시 프리셋", () => {
  it("모든 프리셋이 해석되고 자기 id 를 들고 있다", () => {
    for (const preset of WORLD_GEN_PRESETS) {
      expect(preset.rules.presetId).toBe(preset.id);
      expect(() => resolveWorldGenRules(preset.rules)).not.toThrow();
    }
  });

  it("프리셋 예시 프롬프트가 노린 지형을 실제로 만든다", () => {
    const lake = WORLD_GEN_PRESETS.find((preset) => preset.id === "preset-wide-lake")!;
    const req = inferRequirementsFromQuery(lake.exampleQuery, resolveWorldGenRules(lake.rules));
    expect(req.landmarks).toContain("lake");
    const masks = buildTerrainConstraintMasks(MAP, req, undefined, resolveWorldGenRules(lake.rules));
    expect(masks.waterRects.length).toBeGreaterThan(0);
  });

  it("빽빽한 숲 프리셋이 기본보다 나무를 많이 심는다", () => {
    const dense = WORLD_GEN_PRESETS.find((preset) => preset.id === "preset-deep-forest")!;
    const denseForest = resolveWorldGenRules(dense.rules).forest;
    expect(coniferCountFor(600, denseForest)).toBeGreaterThan(
      coniferCountFor(600, DEFAULT_WORLD_GEN_RULES.forest),
    );
  });
});
