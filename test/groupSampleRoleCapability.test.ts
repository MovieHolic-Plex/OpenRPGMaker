import { describe, expect, it } from "vitest";
import { buildGroupSample, type GroupSampleInput } from "@/ai/groupSampleBuilder";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";

describe("buildGroupSample — 역할별 샘플 모양 (특성화)", () => {
  it("wall 은 문법이 없어도 나인슬라이스 크기로 나온다", () => {
    const sample = buildGroupSample(defaultTileset(), {
      role: "wall",
      tileIds: [15, 16, 17, 45, 46, 47, 75, 76, 77],
    });
    expect(sample.w).toBe(3);
    expect(sample.h).toBe(3);
  });

  it("문법 없는 prop 은 정확히 2타일일 때만 세로 쌍이다", () => {
    const tileset = defaultTileset();
    // verticalSample 은 침엽수 3그루를 한 칸씩 띄워 늘어놓는다 → 5x2.
    const pair = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292] });
    expect(pair.w).toBe(5);
    expect(pair.h).toBe(2);

    // 3개 이상은 세로로 묶지 않는다 (소품 가방 방어, groupSampleBuilder.ts:58 주석).
    // fallbackSample 로 떨어져 한 줄(h=1)이 된다 — 세로 쌍이면 h=2 가 됐을 것이다.
    const bag = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292, 289] });
    expect(bag.w).toBe(3);
    expect(bag.h).toBe(1);
  });

  it("roof 는 전용 샘플 경로를 탄다", () => {
    // 5타일을 준다. roofSample 은 폭을 4로 자르고 남는 타일을 둘째 줄로 접어 4x2 를 만든다
    // (groupSampleBuilder.ts:128-129). fallbackSample 은 같은 입력에 5x1 을 준다(:141).
    // 2타일(w=2,h=1)로는 두 경로의 답이 같아 이 테스트가 아무것도 증명하지 못한다 —
    // sampleAs:"roof" 를 표에서 지워도 통과했다. 5타일에서만 w·h 가 둘 다 갈린다.
    const sample = buildGroupSample(defaultTileset(), { role: "roof", tileIds: [404, 405, 406, 407, 408] });
    expect(sample.w).toBe(4);
    expect(sample.h).toBe(2);
  });
});

describe("buildGroupSample — 레이어·배경 (특성화)", () => {
  it("prop 타일은 상위 레이어에 놓인다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    const placedUpper = sample.upper.some((tile) => tile === 289);
    expect(placedUpper).toBe(true);
  });

  it("prop 샘플은 배경에 잔디가 깔린다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    // backdropTile 이 defaultGrassTile 을 깔면 lower 에 잔디가 있다.
    expect(sample.lower.some((tile) => tile >= 0)).toBe(true);
  });

  it("terrain 샘플은 배경을 깔지 않는다", () => {
    // 배경은 emptySample 의 lowerTile 로 들어가므로 **lower** 를 봐야 한다.
    // upper 를 보면 terrain 타일이 애초에 lower 로 가기 때문에 무조건 통과한다.
    //
    // 그리고 배경이 보이는 칸이 있어야 한다. fallbackSample 은 w = tileIds.length 라
    // 모든 칸이 타일로 덮여 배경을 가린다. horizontal_expandable 문법은 w=5 를 만들고
    // 양 끝에만 캡을 놓으므로(groupSampleBuilder.ts:107-116) 가운데 3칸이 배경 그대로 남는다.
    const tileset = defaultTileset();
    // parts 가 비어 있으면 repeatBody 가 없어 가운데가 EMPTY 로 채워진다(:187-189).
    // preserveCaps·repeat 는 groupSampleBuilder 가 읽지 않지만 타입상 필수다.
    const grammar: NonNullable<GroupSampleInput["patternGrammar"]> = {
      kind: "horizontal_expandable",
      parts: [],
      preserveCaps: true,
      repeat: "body",
    };
    const terrain = buildGroupSample(tileset, { role: "terrain", tileIds: [303, 304], patternGrammar: grammar });
    expect(terrain.w).toBe(5);
    // needsBackdrop 이 terrain 에 켜지면 이 세 칸이 잔디(240)로 채워져 실패한다.
    expect([terrain.lower[1], terrain.lower[2], terrain.lower[3]].every((tile) => tile < 0)).toBe(true);

    // 대조군 — needsBackdrop:true 인 prop 은 같은 문법에서 가운데가 잔디로 채워진다.
    const prop = buildGroupSample(tileset, { role: "prop", tileIds: [303, 304], patternGrammar: grammar });
    expect([prop.lower[1], prop.lower[2], prop.lower[3]].every((tile) => tile >= 0)).toBe(true);
  });
});
