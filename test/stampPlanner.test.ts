// 바로 깔기 모델 계획 층 — 파싱·허용 목록·대상 사각형 자르기. 네트워크 없음.
import { describe, expect, it } from "vitest";
import {
  buildStampPlannerUserPayload,
  buildStampRepairPrompt,
  clampRectToTarget,
  classifyFastPathCommand,
  FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
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

  it("validates place_house inside the target and converts house walls to place_house", () => {
    const check = validateStampStep({ tool: "place_house", args: { area: { x: 12, y: 6, w: 8, h: 7 }, size: "small", count: 2 } }, FACTS);
    expect("step" in check && check.step.args).toMatchObject({ area: { x: 12, y: 6, w: 8, h: 7 }, size: "small", count: 2, stories: 1 });
    const converted = parseStampPlan(JSON.stringify({
      steps: [
        { tool: "build_wall", args: { rect: { x: 12, y: 6, w: 7, h: 6 }, material: "벽" } },
        { tool: "place_door", args: { at: { x: 15, y: 11 }, material: "문" } },
      ],
    }), { ...FACTS, text: "여기에 작은 집 지어줘" });
    expect(converted.steps.map((step) => step.tool)).toEqual(["place_house"]);
  });

  it("validates place_dungeon_room and converts dungeon wall+fill plans into place_dungeon_room", () => {
    const check = validateStampStep(
      { tool: "place_dungeon_room", args: { area: { x: 10, y: 5, w: 10, h: 8 }, kind: "room", hazard: "lava" } },
      FACTS,
    );
    expect("step" in check && check.step.args).toMatchObject({
      area: { x: 10, y: 5, w: 10, h: 8 },
      kind: "room",
      hazard: "lava",
    });
    const converted = parseStampPlan(
      JSON.stringify({
        steps: [
          { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 10, h: 8 }, material: "흙" }, label: "던전 방 바닥" },
          { tool: "build_wall", args: { rect: { x: 10, y: 5, w: 10, h: 8 }, material: "벽" }, label: "던전 방 외벽" },
        ],
      }),
      { ...FACTS, text: "던전 입구 방과 계단" },
    );
    expect(converted.steps.map((step) => step.tool)).toEqual(["place_dungeon_room"]);
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

describe("3-Tier Fast-Path Command Classification & Guard Contract", () => {
  it("classifies Tier 1 direct spatial ops (place, erase, move) as allowed", () => {
    expect(classifyFastPathCommand("돌 우물과 가로등 두 개 깔아줘")).toMatchObject({
      tier: "SPATIAL_DIRECT_OP",
      allowed: true,
      spatialOp: "place",
    });
    expect(classifyFastPathCommand("오른쪽 위 나무 지워줘")).toMatchObject({
      tier: "SPATIAL_DIRECT_OP",
      allowed: true,
      spatialOp: "erase",
    });
    expect(classifyFastPathCommand("광장 분수대 없애줘")).toMatchObject({
      tier: "SPATIAL_DIRECT_OP",
      allowed: true,
      spatialOp: "erase",
    });
    expect(classifyFastPathCommand("우물을 광장 한가운데로 옮겨줘")).toMatchObject({
      tier: "SPATIAL_DIRECT_OP",
      allowed: true,
      spatialOp: "move",
    });
    expect(classifyFastPathCommand("집을 오른쪽으로 4칸 옮겨줘")).toMatchObject({
      tier: "SPATIAL_DIRECT_OP",
      allowed: true,
      spatialOp: "move",
    });
  });

  it("hard-rejects Tier 2 quest, narrative, boss/puzzle event, party recruitment, and shop/inn wiring requests", () => {
    for (const sentence of [
      "퀘스트 세우기",
      "마을 촌장한테 퀘스트 만들어줘",
      "대장간 보스전 이벤트 만들어줘",
      "석상 퍼즐 기믹 짜줘",
      "동료 영입 이벤트 만들어줘",
      "상점 숙소 기능 배선해줘",
      "NPC 대화 스토리 짜줘",
    ]) {
      const res = classifyFastPathCommand(sentence);
      expect(res.allowed).toBe(false);
      expect(res.tier).toBe("QUEST_OR_NARRATIVE_REJECTED");
      expect(res.code).toBe("FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT");
      expect(res.guidance).toBe(FAST_PATH_QUEST_OR_EVENT_GUIDANCE);
    }
  });

  it("validates erase_object and move_object steps", () => {
    const eraseCheck = validateStampStep(
      { tool: "erase_object", args: { query: "나무", region: "오른쪽 위" } },
      { ...FACTS, text: "오른쪽 위 나무 지워줘" },
    );
    expect("step" in eraseCheck && eraseCheck.step.tool).toBe("erase_object");
    expect("step" in eraseCheck && eraseCheck.step.args).toMatchObject({
      query: "나무",
      region: "오른쪽 위",
    });

    const moveCheck = validateStampStep(
      { tool: "move_object", args: { query: "집", dx: 4, dy: 0 } },
      { ...FACTS, text: "집을 오른쪽으로 4칸 옮겨줘" },
    );
    expect("step" in moveCheck && moveCheck.step.tool).toBe("move_object");
    expect("step" in moveCheck && moveCheck.step.args).toMatchObject({
      query: "집",
      dx: 4,
      dy: 0,
    });
  });

  it("validates all 22 extended fast-path tools and allows guild boards and lever+gate pairs", () => {
    expect(classifyFastPathCommand("모험가 길드와 의뢰 게시판 만들어줘").allowed).toBe(true);
    expect(classifyFastPathCommand("레버와 열리는 철문 깔아줘").allowed).toBe(true);
    const tools = [
      "place_bridge",
      "carve_waterfall_pond",
      "carve_lake_island",
      "retheme_season_biome",
      "build_market_bazaar",
      "build_harbor_dock",
      "build_farm_ranch",
      "build_rail_crossing",
      "place_inn",
      "place_church_healer",
      "place_guild_board",
      "place_travel_portal",
      "place_roaming_enemies",
      "place_switch_and_gate",
      "place_camp_rest",
      "place_mimic_and_sparkles",
      "repeat_line_or_grid",
      "mirror_region",
      "enclose_with_wall",
      "auto_connect_roads",
      "populate_crowd",
      "set_mood_weather",
    ] as const;
    for (const tool of tools) {
      const check = validateStampStep({ tool, args: { area: FACTS.target } }, { ...FACTS, text: "여관과 마을 사람들로 꾸며줘" });
      expect("step" in check, `Expected ${tool} to validate`).toBe(true);
      if ("step" in check) expect(check.step.tool).toBe(tool);
    }
  });
});
