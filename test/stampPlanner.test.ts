// 바로 깔기 모델 계획 층 — 파싱·허용 목록·대상 사각형 자르기. 네트워크 없음.
import { describe, expect, it } from "vitest";
import {
  buildStampPlannerUserPayload,
  buildStampRepairPrompt,
  clampRectToTarget,
  parseStampPlan,
  STAMP_MAX_STEPS,
  validateStampStep,
  type StampPlanFacts,
} from "@/ai/stampPlanner";

const FACTS: StampPlanFacts = {
  text: "땅을 동그랗게, 물을 동그랗게 옆에 나무",
  mapId: "map_a",
  mapWidth: 40,
  mapHeight: 30,
  target: { x: 10, y: 5, w: 20, h: 10 },
  targetIsSelection: true,
  tilesetId: "forest_harmony",
  fillMaterials: ["흙", "잔디", "물"],
  materialHint: "소품·지형 material 라벨 예: 침엽수(prop)",
};

describe("parseStampPlan", () => {
  it("splits one sentence into several steps inside the target", () => {
    const raw = JSON.stringify({
      steps: [
        { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 8, h: 10 }, material: "흙", shape: "circle" }, label: "왼쪽 흙 원" },
        { tool: "fill_region", args: { rect: { x: 18, y: 5, w: 8, h: 10 }, material: "물", shape: "circle" }, label: "가운데 물 원" },
        { tool: "place_props", args: { area: { x: 26, y: 5, w: 4, h: 10 }, material: "침엽수", density: "impassable" }, label: "오른쪽 나무" },
      ],
    });
    const plan = parseStampPlan(raw, FACTS);
    expect(plan.error).toBeUndefined();
    expect(plan.dropped).toEqual([]);
    expect(plan.steps.map((step) => step.tool)).toEqual(["fill_region", "fill_region", "place_props"]);
    expect(plan.steps[0]!.args).toEqual({ mapId: "map_a", rect: { x: 10, y: 5, w: 8, h: 10 }, material: "흙", shape: "circle" });
    expect(plan.steps[2]!.args).toMatchObject({ mapId: "map_a", area: { x: 26, y: 5, w: 4, h: 10 }, density: "impassable" });
  });

  it("reads fenced JSON and chatter around it", () => {
    const raw = "여기 있습니다\n```json\n{\"steps\":[{\"tool\":\"tile_erase\",\"args\":{}}]}\n```";
    const plan = parseStampPlan(raw, FACTS);
    expect(plan.steps).toHaveLength(1);
    // rect 가 없으면 대상 전체.
    expect(plan.steps[0]!.args).toEqual({ mapId: "map_a", rect: FACTS.target, layer: "both" });
  });

  it("reports unreadable output", () => {
    expect(parseStampPlan("not json", FACTS).error).toBeDefined();
    expect(parseStampPlan("{\"foo\":1}", FACTS).error).toBeDefined();
  });

  it("drops tools outside the allow-list and steps without material", () => {
    const raw = JSON.stringify({
      steps: [
        { tool: "delete_map", args: {} },
        { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 2, h: 2 } } },
        { tool: "place_props", args: { material: "침엽수" } },
      ],
    });
    const plan = parseStampPlan(raw, FACTS);
    expect(plan.steps.map((step) => step.tool)).toEqual(["place_props"]);
    expect(plan.dropped).toHaveLength(2);
    expect(plan.dropped[0]).toContain("delete_map");
  });

  it("caps the number of steps", () => {
    const steps = Array.from({ length: STAMP_MAX_STEPS + 3 }, () => ({ tool: "tile_erase", args: {} }));
    const plan = parseStampPlan(JSON.stringify({ steps }), FACTS);
    expect(plan.steps).toHaveLength(STAMP_MAX_STEPS);
    expect(plan.dropped.length).toBeGreaterThan(0);
  });
});

describe("clamping to the target rect", () => {
  it("cuts rects that leave the target and drops ones fully outside", () => {
    expect(clampRectToTarget({ x: 0, y: 0, w: 15, h: 8 }, FACTS.target)).toEqual({ x: 10, y: 5, w: 5, h: 3 });
    expect(clampRectToTarget({ x: 25, y: 12, w: 50, h: 50 }, FACTS.target)).toEqual({ x: 25, y: 12, w: 5, h: 3 });
    expect(clampRectToTarget({ x: 0, y: 0, w: 5, h: 5 }, FACTS.target)).toBeNull();
    expect(clampRectToTarget({ x: 12, y: 6, w: 0, h: 3 }, FACTS.target)).toBeNull();
    // 모델이 width/height 로 적어도 받는다.
    expect(clampRectToTarget({ x: 12, y: 6, width: 2, height: 3 }, FACTS.target)).toEqual({ x: 12, y: 6, w: 2, h: 3 });
  });

  it("clamps road points and door positions into the target", () => {
    const road = validateStampStep({ tool: "paint_road", args: { points: [{ x: 0, y: 0 }, { x: 99, y: 7 }] } }, FACTS);
    expect("step" in road && road.step.args.points).toEqual([{ x: 10, y: 5 }, { x: 29, y: 7 }]);
    const door = validateStampStep({ tool: "place_door", args: { at: { x: 100, y: 100 }, material: "문" } }, FACTS);
    expect("step" in door && door.step.args.at).toEqual({ x: 29, y: 14 });
  });

  it("drops a fill whose rect lies fully outside the target", () => {
    const check = validateStampStep({ tool: "fill_region", args: { rect: { x: 0, y: 0, w: 3, h: 3 }, material: "물" } }, FACTS);
    expect("dropped" in check).toBe(true);
  });

  it("gives non-tree props a count when no density is given", () => {
    const check = validateStampStep({ tool: "place_props", args: { area: { x: 10, y: 5, w: 2, h: 3 }, material: "나무 상자" } }, FACTS);
    expect("step" in check && check.step.args).toMatchObject({ count: 6, packing: "dense" });
  });

  it("keeps a house at least 3x5 and single", () => {
    const check = validateStampStep({ tool: "author_house", args: { wings: [{ x: 12, y: 6, w: 2, h: 2 }] } }, FACTS);
    expect("step" in check && check.step.args).toMatchObject({ kind: "single", wings: [{ x: 12, y: 6, w: 3, h: 5 }], interior: "exterior-only", door: false });
  });
});

describe("prompts", () => {
  it("puts the real tileset labels in the user payload", () => {
    const payload = JSON.parse(buildStampPlannerUserPayload(FACTS)) as Record<string, unknown>;
    expect(payload.fillMaterials).toEqual(["흙", "잔디", "물"]);
    expect(payload.sentence).toBe(FACTS.text);
    expect(payload.target).toMatchObject({ x: 10, y: 5, w: 20, h: 10, source: "user selection" });
  });

  it("repair prompt carries the tool error and omits mapId", () => {
    const text = buildStampRepairPrompt([{
      step: { tool: "fill_region", args: { mapId: "map_a", rect: FACTS.target, material: "땅" }, label: "땅" },
      error: "라벨/설명이 \"땅\" 인 타일을 찾지 못했습니다. 채울 수 있는 재료: \"흙\"",
    }]);
    expect(text).toContain("찾지 못했습니다");
    expect(text).not.toContain("map_a");
  });
});
