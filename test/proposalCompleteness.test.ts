import { describe, expect, it } from "vitest";
import {
  proposalCompletenessWarningLines,
  proposalCompletenessWarnings,
  proposalHasChangedMap,
  type ProposalCompletenessCall,
} from "@/ai/proposalCompleteness";
import type { BuildSpec } from "@/ai/buildSpec";
import type { ChangeSummary } from "@/editor/tools/types";

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function call(
  name: string,
  args: Record<string, unknown>,
  overrides: Partial<ChangeSummary>,
  data?: unknown
): ProposalCompletenessCall {
  return { name, args, result: { ok: true, diff: changeSummary(overrides), data } };
}

const SPEC: BuildSpec = {
  mapId: "m1",
  title: "연못 장식",
  assets: [
    { id: "연못", kind: "water", x: 2, y: 3, w: 4, h: 3 },
    { id: "꽃장식", kind: "decor", x: 8, y: 3, w: 5, h: 4 },
  ],
};

describe("proposal completeness lint", () => {
  it("스펙 에셋을 모두 건드리면 경고가 없다", () => {
    const warnings = proposalCompletenessWarnings({
      buildSpec: SPEC,
      calls: [
        call("paint_tiles", { mapId: "m1", mode: "rect", layer: "lower", tile: 42, from: { x: 2, y: 3 }, to: { x: 5, y: 5 } }, { tilesChanged: 12 }),
        call("scatter_object", { mapId: "m1", groupId: "flowers", area: { x: 8, y: 3, w: 5, h: 4 }, count: 4 }, { tilesChanged: 8 }, { placed: 4 }),
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("스펙 에셋 일부가 체인지셋과 교차하지 않으면 구체 경고를 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      buildSpec: SPEC,
      calls: [
        call("paint_tiles", { mapId: "m1", mode: "rect", layer: "lower", tile: 42, from: { x: 2, y: 3 }, to: { x: 5, y: 5 } }, { tilesChanged: 12 }),
      ],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("⚠ 미이행:");
    expect(warnings[0]).toContain("'꽃장식'(decor) (8,3) 5×4");
    expect(warnings[0]).not.toContain("'연못'");
  });

  it("스펙이 없고 편집 요청인데 체인지셋이 비면 0건 경고를 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "연못 주변 꾸며줘",
      calls: [],
    });

    expect(warnings).toEqual(["⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건)."]);
  });

  it("스펙이 없고 요청 수량보다 실제 배치가 크게 적으면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "나무 10개 배치해줘",
      calls: [
        call("scatter_object", { mapId: "m1", groupId: "tree", area: { x: 1, y: 1, w: 12, h: 12 }, count: 10 }, { tilesChanged: 9 }, { placed: 3 }),
      ],
    });

    expect(warnings).toEqual(["⚠ 미이행: 요청 수량 10개 대비 실제 배치 3개입니다."]);
  });

  it("스펙이 없고 수량에 근접하게 배치했으면 침묵한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "나무 10개 배치해줘",
      calls: [
        call("scatter_object", { mapId: "m1", groupId: "tree", area: { x: 1, y: 1, w: 12, h: 12 }, count: 10 }, { tilesChanged: 21 }, { placed: 7 }),
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("맵 크기 숫자 같은 차원 표기는 배치 수량으로 오인하지 않는다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "24×18 맵 만들어줘",
      calls: [
        call("create_map", { id: "m2", name: "새 맵", width: 24, height: 18 }, { mapsAdded: 1 }),
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("경고 라인은 ToolResult diff.warnings에서 중복 없이 읽는다", () => {
    const warnings = ["⚠ 미이행: 밑그림 에셋 '꽃장식'(decor) (8,3) 5×4 영역을 변경하지 않았습니다."];
    const calls = [
      call("paint_tiles", { mapId: "m1", mode: "cells", layer: "upper", tile: 88, cells: [{ x: 2, y: 3 }] }, { tilesChanged: 1, warnings }),
      call("paint_tiles", { mapId: "m1", mode: "cells", layer: "upper", tile: 88, cells: [{ x: 3, y: 3 }] }, { tilesChanged: 1, warnings }),
    ];

    expect(proposalCompletenessWarningLines(calls)).toEqual(warnings);
  });

  it("origin 기반 집 도구도 스펙 맵 변경 근거로 본다", () => {
    const calls = [
      call("build_house", { mapId: "m1", origin: { x: 4, y: 4 }, width: 6, height: 7, material: "wood" }, { tilesChanged: 42 }),
    ];

    expect(proposalHasChangedMap(calls, "m1")).toBe(true);
    expect(proposalHasChangedMap(calls, "m2")).toBe(false);
  });
});
