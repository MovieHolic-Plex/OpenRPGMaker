import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { detectHouses, houseVarietyReport, roofColorForKit, shapeLabel } from "@/editor/tools/houseVariety";
import { getTool } from "@/editor/tools/toolRegistry";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

type HousePlan = Record<string, unknown>;

const MAP_ID = "map_village";

/** 빈 시드에는 맵이 0개다 — 야외 맵 하나를 깔고 시작한다. 시작 좌표는 중앙(20,14). */
function project(): ToolContext {
  const context: ToolContext = { project: createEmptyToolProject("집 다양성 테스트") };
  const created = runTool(context, "create_map", { name: "마을", width: 40, height: 28, id: MAP_ID });
  if (!created.ok) throw new Error(`맵 생성 실패: ${created.summary}`);
  return context;
}

function firstMapId(_context: ToolContext): string {
  return MAP_ID;
}

function targetMap(context: ToolContext, mapId: string): GameMap {
  const map = context.project.maps[mapId];
  if (map === undefined) throw new Error(`맵 없음: ${mapId}`);
  return map;
}

function plan(overrides: HousePlan): HousePlan {
  return { interior: "exterior-only", door: true, windows: {}, yard: [], ...overrides };
}

function authorLots(context: ToolContext, mapId: string, houses: readonly HousePlan[]): ReturnType<typeof runTool> {
  return runTool(context, "author_house", { kind: "lots", mapId, seed: 7, houses });
}

/** 쓰기 툴의 비차단 경고는 diff.warnings 로 흐른다(읽기 툴만 최상위 warnings). */
function writeWarnings(result: ReturnType<typeof runTool>): string {
  return (result.diff?.warnings ?? []).join(" ");
}

describe("houseVariety — 타일에서 집을 되읽는다", () => {
  it("templateId로 시공한 집의 모양을 카탈로그 id로 복원한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = authorLots(context, mapId, [
      plan({ kitId: "blue-stone", templateId: "l", wings: [{ x: 2, y: 2, w: 6, h: 8 }] }),
      plan({ kitId: "bright-plaster", templateId: "t-porch", wings: [{ x: 14, y: 2, w: 8, h: 9 }] }),
      plan({ kitId: "amber-wood", templateId: "barn-low", wings: [{ x: 2, y: 16, w: 6, h: 5 }] }),
    ]);
    expect(result.ok, result.summary).toBe(true);

    const detected = detectHouses(targetMap(context, mapId));
    const shapes = detected.map((house) => house.templateId).sort();
    expect(shapes).toEqual(["barn-low", "l", "t-porch"]);
    const kits = detected.map((house) => house.kitId).sort();
    expect(kits).toEqual(["amber-wood", "blue-stone", "bright-plaster"]);
  });

  it("같은 모양·같은 킷을 반복하면 monotonous로 판정한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = authorLots(context, mapId, [
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 2, y: 2, w: 6, h: 6 }] }),
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 12, y: 2, w: 6, h: 6 }] }),
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 22, y: 2, w: 6, h: 6 }] }),
    ]);
    expect(result.ok, result.summary).toBe(true);

    const report = houseVarietyReport(detectHouses(targetMap(context, mapId)));
    expect(report.houses).toBe(3);
    expect(report.distinctShapes).toBe(1);
    expect(report.distinctRoofColors).toBe(1);
    expect(report.verdict).toBe("monotonous");
    expect(report.repeatedShapes).toEqual([["rect-small", 3]]);
    expect(report.unusedTemplateIds).toContain("courtyard");
    expect(report.advice.join(" ")).toMatch(/templateId/);
  });

  it("모양·지붕색을 갈라 놓으면 diverse로 판정한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = authorLots(context, mapId, [
      plan({ kitId: "blue-stone", templateId: "l", wings: [{ x: 2, y: 2, w: 6, h: 8 }] }),
      plan({ kitId: "bright-plaster", templateId: "rect-2f", wings: [{ x: 12, y: 2, w: 7, h: 9 }] }),
      // 앵커 w/h 는 카탈로그(5×4)로 대체되지만, 파서의 wing 하한(h≥5)은 통과해야 한다.
      plan({ kitId: "timber-hall", templateId: "cottage-low", wings: [{ x: 24, y: 2, w: 5, h: 5 }] }),
    ]);
    expect(result.ok, result.summary).toBe(true);

    const report = houseVarietyReport(detectHouses(targetMap(context, mapId)));
    expect(report.distinctShapes).toBe(3);
    expect(report.distinctRoofColors).toBe(3);
    expect(report.verdict).toBe("diverse");
  });

  it("kitId 6종은 지붕색 3군으로 접힌다", () => {
    expect(roofColorForKit("blue-stone")).toBe("blue");
    expect(roofColorForKit("slate-wood")).toBe("blue");
    expect(roofColorForKit("bright-plaster")).toBe("orange");
    expect(roofColorForKit("amber-wood")).toBe("orange");
    expect(roofColorForKit("timber-hall")).toBe("red");
    expect(roofColorForKit("aframe-stone")).toBe("red");
  });

  it("카탈로그에 없는 모양은 custom 치수로 표기한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    // templateId 없이 카탈로그에 없는 치수(9×7)를 직접 준다.
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "slate-wood",
      wings: [{ x: 3, y: 3, w: 9, h: 7 }],
      interior: "exterior-only",
      door: true,
    });
    expect(result.ok, result.summary).toBe(true);
    const detected = detectHouses(targetMap(context, mapId));
    expect(detected).toHaveLength(1);
    expect(detected[0]?.templateId).toBeNull();
    expect(shapeLabel(detected[0]!)).toMatch(/^custom 9x/);
  });
});

describe("author_house — 형태 어휘", () => {
  it("templateId가 wings를 카탈로그 날개로 전개한다(비사각 ㄱ자)", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "amber-wood",
      templateId: "l",
      // w/h 는 앵커용 더미 — 카탈로그(6×8)가 이긴다.
      wings: [{ x: 5, y: 4, w: 3, h: 5 }],
      interior: "exterior-only",
      door: true,
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { houses: { wings: readonly { x: number; y: number; w: number; h: number }[] }[] };
    expect(data.houses[0]?.wings).toEqual([
      { x: 5, y: 4, w: 3, h: 8 },
      { x: 8, y: 4, w: 3, h: 6 },
    ]);
  });

  it("stories를 주면 외장 벽 밴드와 실내 층수가 함께 올라간다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "blue-stone",
      wings: [{ x: 3, y: 3, w: 7, h: 9 }],
      stories: 2,
      interior: "linked-interior",
      door: true,
      ownerName: "촌장",
    });
    expect(result.ok, result.summary).toBe(true);
    const interiorIds = Object.keys(context.project.maps).filter((id) => id.startsWith("map_house_interior"));
    expect(interiorIds.length).toBeGreaterThan(0);
    // 2층 외장은 벽 밴드가 5행이라 1층(3행)보다 지붕이 얕다 — 모양 서명이 달라진다.
    const twoStory = detectHouses(targetMap(context, mapId))[0];
    expect(twoStory?.wallRows).toBe(5);

    const oneStoryContext = project();
    const oneStoryMapId = firstMapId(oneStoryContext);
    const oneStoryResult = runTool(oneStoryContext, "author_house", {
      kind: "single",
      mapId: oneStoryMapId,
      kitId: "blue-stone",
      wings: [{ x: 3, y: 3, w: 7, h: 9 }],
      stories: 1,
      interior: "exterior-only",
      door: true,
    });
    expect(oneStoryResult.ok, oneStoryResult.summary).toBe(true);
    const oneStory = detectHouses(targetMap(oneStoryContext, oneStoryMapId))[0];
    expect(oneStory?.wallRows).toBe(3);
    // 점유 마스크는 같은 7×9 직사각형이다 — 벽 밴드까지 서명에 실어야 층수 변화가 보인다.
    expect(twoStory?.bbox).toEqual(oneStory?.bbox);
    expect(twoStory?.shapeKey).not.toBe(oneStory?.shapeKey);
  });

  it("chimney·lowWall이 실제로 시공에 반영된다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = authorLots(context, mapId, [
      plan({ kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 6, h: 6 }], chimney: true }),
      plan({ kitId: "amber-wood", wings: [{ x: 14, y: 2, w: 6, h: 5 }], lowWall: true }),
    ]);
    expect(result.ok, result.summary).toBe(true);
    const detected = detectHouses(targetMap(context, mapId));
    expect(detected.some((house) => house.chimney)).toBe(true);
  });

  it("모르는 templateId는 쓸 수 있는 카탈로그 목록과 함께 거부한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "blue-stone",
      templateId: "no-such-shape",
      wings: [{ x: 3, y: 3, w: 6, h: 6 }],
      interior: "exterior-only",
      door: true,
    });
    expect(result.ok).toBe(false);
    // 스키마 enum 게이트가 파서보다 먼저 잡는다 — 모델이 바로 고르도록 34종을 되돌려 준다.
    const issues = JSON.stringify(result.issues);
    expect(issues).toMatch(/templateId/);
    expect(issues).toMatch(/courtyard/);
    expect(issues).toMatch(/rooftop-deck/);
  });

  it("결과에 다양성 리포트를 싣고 단조로우면 경고한다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const result = authorLots(context, mapId, [
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 2, y: 2, w: 6, h: 6 }] }),
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 12, y: 2, w: 6, h: 6 }] }),
    ]);
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { variety?: { verdict: string; distinctShapes: number } };
    expect(data.variety?.verdict).toBe("monotonous");
    expect(data.variety?.distinctShapes).toBe(1);
    expect(writeWarnings(result)).toMatch(/monotonous/);
  });

  it("스키마가 34종 templateId를 전부 노출한다", () => {
    const tool = getTool("author_house");
    expect(tool).toBeDefined();
    const schema = JSON.stringify(tool?.parameters);
    for (const def of HOUSE_TEMPLATE_DEFS) {
      expect(schema, `templateId 누락: ${def.id}`).toContain(`"${def.id}"`);
    }
  });
});

describe("look_at_houses — 비전 관찰 툴", () => {
  it("깔린 집을 세고 타일 그리드와 리포트를 함께 준다", () => {
    const context = project();
    const mapId = firstMapId(context);
    const built = authorLots(context, mapId, [
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 2, y: 2, w: 6, h: 6 }] }),
      plan({ kitId: "blue-stone", templateId: "rect-small", wings: [{ x: 12, y: 2, w: 6, h: 6 }] }),
    ]);
    expect(built.ok, built.summary).toBe(true);

    const result = runTool(context, "look_at_houses", { mapId });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      houses: readonly { shape: string; kitId: string; roofColor: string }[];
      variety: { verdict: string; advice: readonly string[] };
      lower: readonly number[][];
      upper: readonly number[][];
    };
    expect(data.houses).toHaveLength(2);
    expect(data.houses.map((house) => house.shape)).toEqual(["rect-small", "rect-small"]);
    expect(data.variety.verdict).toBe("monotonous");
    expect(data.lower.length).toBeGreaterThan(0);
    expect(data.upper.length).toBe(data.lower.length);
    expect((result.warnings ?? []).join(" ")).toMatch(/monotonous/);
  });

  it("집이 없으면 0채로 보고하고 경고하지 않는다", () => {
    const context = project();
    const result = runTool(context, "look_at_houses", { mapId: firstMapId(context) });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { houses: readonly unknown[]; variety: { verdict: string } };
    expect(data.houses).toHaveLength(0);
    expect(data.variety.verdict).toBe("diverse");
    expect(result.warnings ?? []).toHaveLength(0);
  });

  it("영역을 일부만 주면 거부한다", () => {
    const context = project();
    const result = runTool(context, "look_at_houses", { mapId: firstMapId(context), x: 0, y: 0 });
    expect(result.ok).toBe(false);
  });
});
