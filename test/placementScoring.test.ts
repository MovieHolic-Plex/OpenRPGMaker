import { describe, expect, it } from "vitest";

import { placementSoftPenalty } from "@/editor/tools/placementScoring";
import type { GameMap, TileGroupMetadata } from "@/project/types";

describe("placementSoftPenalty", () => {
  it("규칙이 없으면 0을 반환한다", () => {
    // Given: 소프트/미디엄 규칙이 없는 그룹.
    const group = groupWithRules();

    // When: 후보 점수를 계산한다.
    const penalty = placementSoftPenalty({ candidate: rect(0, 0), group, map: blankMap(), placed: [] });

    // Then: 배치 선호도가 중립이다.
    expect(penalty).toBe(0);
  });

  it("soft spacing은 가까운 후보에 더 큰 벌점을 주고 최소 간격 이상이면 0이다", () => {
    // Given: 빈칸 거리 3을 선호하는 소프트 간격 규칙.
    const group = groupWithRules([{ id: "gap", kind: "spacing", params: { minGap: 3 }, strength: "soft" }]);
    const placed = [rect(0, 0)];

    // When: 가까운 후보와 충분히 떨어진 후보를 비교한다.
    const near = placementSoftPenalty({ candidate: rect(2, 0), group, map: blankMap(), placed });
    const far = placementSoftPenalty({ candidate: rect(4, 0), group, map: blankMap(), placed });

    // Then: 가까운 후보만 벌점을 받는다.
    expect(near).toBeGreaterThan(far);
    expect(far).toBe(0);
  });

  it("medium spacing은 같은 위반에서 soft보다 큰 벌점을 준다", () => {
    // Given: 같은 간격 규칙을 soft와 medium 강도로 둔 두 그룹.
    const soft = groupWithRules([{ id: "soft-gap", kind: "spacing", params: { minGap: 3 }, strength: "soft" }]);
    const medium = groupWithRules([{ id: "medium-gap", kind: "spacing", params: { minGap: 3 }, strength: "medium" }]);

    // When: 같은 후보를 평가한다.
    const softPenalty = placementSoftPenalty({ candidate: rect(2, 0), group: soft, map: blankMap(), placed: [rect(0, 0)] });
    const mediumPenalty = placementSoftPenalty({ candidate: rect(2, 0), group: medium, map: blankMap(), placed: [rect(0, 0)] });

    // Then: medium 선호가 더 강하게 작동한다.
    expect(mediumPenalty).toBeGreaterThan(softPenalty);
  });

  it("count max를 넘기는 후보에는 벌점을 준다", () => {
    // Given: 맵당 최대 2개를 선호하는 그룹에 이미 2개가 놓여 있다.
    const group = groupWithRules([{ id: "max-count", kind: "count", params: { max: 2 }, strength: "soft" }]);

    // When: 새 후보를 하나 더 평가한다.
    const penalty = placementSoftPenalty({ candidate: rect(9, 9), group, map: blankMap(), placed: [rect(0, 0), rect(4, 0)] });

    // Then: 초과분만큼 벌점이 생긴다.
    expect(penalty).toBeGreaterThan(0);
  });
});

function rect(x: number, y: number): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  return { h: 1, w: 1, x, y };
}

function groupWithRules(rules: TileGroupMetadata["rules"] = []): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "배치 점수 테스트 그룹",
    id: "test-group",
    name: "테스트 그룹",
    placementRules: "",
    role: "prop",
    rules,
    tileIds: [1],
  };
}

function blankMap(): GameMap {
  return {
    events: [],
    height: 12,
    id: "map",
    lowerTiles: Array.from({ length: 144 }, () => 0),
    name: "테스트 맵",
    tileSize: 16,
    tilesetId: "tileset",
    upperTiles: Array.from({ length: 144 }, () => -1),
    width: 12,
  };
}
