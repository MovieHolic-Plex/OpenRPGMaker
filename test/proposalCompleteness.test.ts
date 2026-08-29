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
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
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

  it("실내 요청에 야외 집 키트만 쓰면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "연금술사의 집 이라는 실내 를 하나 만드렁줘",
      calls: [
        call("build_house_kit", { mapId: "m1", kitId: "bright-plaster", wings: [{ x: 4, y: 5, w: 12, h: 10 }] }, { tilesChanged: 80 }),
      ],
    });
    expect(warnings.some((line) => line.includes("실내 요청") && line.includes("author_house"))).toBe(true);
  });

  // 수정 요청에 "새 실내 맵을 시공하세요" 경고를 붙이면 그 경고가 자동 완료를 막아 모델을 신축으로
  // 밀어붙인다 — 사용자가 본 증상(고쳐 달랬는데 맵이 하나 더 생김) 그 자체다.
  it("실내 수정 요청에는 신축 경고를 붙이지 않는다", () => {
    for (const requestText of ["이 침실 가구 배치를 개선해줘", "실내 맵 조명 좀 고쳐줘"]) {
      const warnings = proposalCompletenessWarnings({
        requestText,
        calls: [call("place_props", { mapId: "m1", material: "나무 상자", count: 2 }, { tilesChanged: 2 })],
      });
      expect(warnings.some((line) => line.includes("start_interior_room_session")), requestText).toBe(false);
    }
  });

  it("실내 요청에 create_map만 하면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "실내 맵 하나 만들어줘",
      calls: [call("create_map", { name: "새로운 시작의 터전", width: 30, height: 30 }, { mapsAdded: 1 })],
    });
    expect(warnings.some((line) => line.includes("빈 맵만"))).toBe(true);
  });

  it("실내 세션 툴을 쓰면 실내 경고가 없다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "연금술사 실내 만들어줘",
      calls: [
        call("start_interior_room_session", { mapId: "map_interior_1", door: { x: 8, y: 10 }, theme: "study" }, { mapsAdded: 1, tilesChanged: 40 }),
      ],
    });
    expect(warnings.filter((line) => line.includes("실내"))).toEqual([]);
  });

  it("진행 지시에서 체인지셋이 비면 질문 대신 실행 힌트를 붙인다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "진행하라고",
      calls: [],
    });

    expect(warnings).toEqual(["⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건). 진행 지시였으므로 질문 대신 실행했어야 합니다."]);
  });

  it("진행 약속으로 끝났는데 쓰기 툴이 없으면 약속-후-침묵 경고를 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "오른쪽 아래에 호수 만들어줘",
      assistantText: "다시 설계하겠습니다. 잠시만 기다려 주세요!",
      calls: [],
    });

    expect(warnings).toEqual(["⚠ 미이행: 진행을 약속했지만 실제 변경이 없습니다(체인지셋 0건). 질문 대신 실행했어야 합니다."]);
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

  it("집 3채 NPC 5명 요청에서 집 1채뿐이면 수량 미이행 경고를 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "40x40 맵에 작은 집 3채 NPC 5명 배치해줘",
      calls: [
        call("build_house_kit", { mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }] }, { tilesChanged: 36 }),
      ],
    });

    expect(warnings).toEqual(["⚠ 미이행: 요청 수량 8개 대비 실제 배치 1개입니다."]);
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

  it("canonical construction calls fulfill nested target BuildSpec coverage and exact counts", () => {
    // Given: one canonical house proposal and one canonical village proposal.
    const houseSpec: BuildSpec = {
      mapId: "m1",
      assets: [{ id: "집", kind: "house", x: 3, y: 4, w: 8, h: 7 }],
    };
    const houseCalls = [call(
      "author_house",
      { kind: "single", mapId: "m1", wings: [{ x: 3, y: 4, w: 8, h: 7 }] },
      { tilesChanged: 50 },
      { construction: { counts: { requested: 1, actual: 1 } } },
    )];
    const villageCalls = [call(
      "author_village",
      { target: { kind: "existing", mapId: "m1", bounds: { x: 2, y: 2, w: 20, h: 18 } }, houseCount: 6, countPolicy: "exact" },
      { tilesChanged: 180 },
      { construction: { counts: { requested: 6, actual: 6 } } },
    )];

    // When/Then: canonical regions count as real map changes and exact requested counts do not warn.
    expect(proposalCompletenessWarnings({ buildSpec: houseSpec, calls: houseCalls })).toEqual([]);
    expect(proposalHasChangedMap(villageCalls, "m1")).toBe(true);
    expect(proposalCompletenessWarnings({ requestText: "집 6채 마을 만들어줘", calls: villageCalls }))
      .not.toContainEqual(expect.stringContaining("요청 수량"));
  });
});
