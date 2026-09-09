import { describe, expect, it } from "vitest";
import {
  proposalCompletenessWarningLines,
  proposalCompletenessWarnings,
  proposalHasChangedMap,
  proposalChangedRegions,
  proposalCallChangedSomething,
  type ProposalCompletenessCall,
} from "@/ai/proposalCompleteness";
import type { BuildSpec } from "@/ai/buildSpec";
import { declaredIntent } from "./intentFixture";
import type { ChangeSummary } from "@/editor/tools/types";
import { runTool } from "@/editor/tools";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, nativePaintCall, preservedPaintContext } from "./fixtures/preservedPaint";

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

describe("native preserved paint completeness", () => {
  it("covers P7's 80 changed floor cells and 24 already-correct walls across three assets", () => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const walls = nativePaintCall(ctx, WALL_PAINT_ARGS);
    expect(floor.result).toMatchObject({ ok: true, diff: { tilesChanged: 80 }, data: { tilesTouched: 80, skippedClusterCells: 0 } });
    expect(walls.result).toMatchObject({ ok: true, diff: { tilesChanged: 0 }, data: { tilesTouched: 24, skippedClusterCells: 0 } });
    expect(proposalHasChangedMap([walls], "map_basement")).toBe(false);
    expect(proposalCallChangedSomething(walls)).toBe(false);
    expect(proposalChangedRegions([walls])).toEqual([]);
    expect(proposalChangedRegions([floor, walls])).toHaveLength(80);
    expect(proposalCompletenessWarnings({ buildSpec: PRESERVED_PAINT_SPEC, calls: [floor, walls], project: ctx.project })).toEqual([]);
    expect(proposalCompletenessWarnings({ buildSpec: PRESERVED_PAINT_SPEC, calls: [floor, walls] })).toHaveLength(1);
  });

  it.each(["missing", "failed", "missing-diff", "missing-receipt", "missing-layer", "invalid-layer", "short-receipt", "skipped", "wrong-tile", "wrong-map"] as const)("retains the warning for %s operation evidence", (failure) => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const walls = nativePaintCall(ctx, WALL_PAINT_ARGS);
    const invalid: ProposalCompletenessCall = {
      ...walls,
      args: { ...walls.args, ...(failure === "wrong-tile" ? { tile: 342 } : {}), ...(failure === "wrong-map" ? { mapId: "elsewhere" } : {}) },
      result: {
        ...walls.result, ok: failure !== "failed",
        diff: failure === "missing-diff" ? undefined : walls.result.diff,
        data: failure === "missing-receipt" ? undefined : {
          ...(walls.result.data as Record<string, unknown>),
          ...(failure === "missing-layer" ? { effectiveLayer: undefined } : failure === "invalid-layer" ? { effectiveLayer: "both" } : {}),
          tilesTouched: failure === "short-receipt" ? 23 : 24, skippedClusterCells: failure === "skipped" ? 1 : 0,
        },
      },
    };
    expect(proposalCompletenessWarnings({ buildSpec: PRESERVED_PAINT_SPEC, calls: failure === "missing" ? [floor] : [floor, invalid], project: ctx.project })).toHaveLength(1);
  });

  it.each(["partial", "duplicate", "out-of-bounds", "failed-args"] as const)("does not discharge full coverage with a native %s paint", (failure) => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const cells = failure === "out-of-bounds" ? [...WALL_PAINT_ARGS.cells, { x: 12, y: 0 }]
      : failure === "partial" ? WALL_PAINT_ARGS.cells.slice(1)
      : [WALL_PAINT_ARGS.cells[1], ...WALL_PAINT_ARGS.cells.slice(1)];
    const walls = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, cells, ...(failure === "failed-args" ? { layer: "invalid" } : {}) });
    expect(walls.result.ok).toBe(failure !== "failed-args");
    if (failure === "out-of-bounds") expect(walls.result.data).toMatchObject({ tilesTouched: 24, skippedClusterCells: 1 });
    expect(proposalCompletenessWarnings({ buildSpec: PRESERVED_PAINT_SPEC, calls: [floor, walls], project: ctx.project })).toHaveLength(1);
  });

  it("uses the native effective layer and requires that exact asset layer", () => {
    const ctx = preservedPaintContext();
    const walls = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, layer: "upper" });
    // Tile 306 is lower-only: the requested upper is not the effective layer.
    expect(walls.result).toMatchObject({ ok: true, diff: { tilesChanged: 0 }, data: { tilesTouched: 24 } });
    const wallSpec = { ...PRESERVED_PAINT_SPEC, assets: PRESERVED_PAINT_SPEC.assets.slice(1) };
    expect(proposalCompletenessWarnings({ buildSpec: wallSpec, calls: [walls], project: ctx.project })).toEqual([]);
    expect(proposalCompletenessWarnings({ buildSpec: { ...wallSpec, assets: wallSpec.assets.map(asset => ({ ...asset, layer: "upper" })) }, calls: [walls], project: ctx.project })).toHaveLength(1);
  });

  it.each(["complete", "partial", "wrong-tile", "rect", "skipped", "failed"] as const)("checks a native %s repair after an earlier one-cell no-op", (repairKind) => {
    const ctx = preservedPaintContext();
    const cells = WALL_PAINT_ARGS.cells.filter(cell => cell.y === 0);
    const spec = { ...PRESERVED_PAINT_SPEC, assets: [PRESERVED_PAINT_SPEC.assets[1]] };
    const seed = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, tile: 112, cells: cells.slice(1) });
    expect(seed.result).toMatchObject({ ok: true, diff: { tilesChanged: 11 } });
    const partial = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, cells: [cells[0]] });
    expect(partial.result).toMatchObject({ ok: true, diff: { tilesChanged: 0 }, data: { tilesTouched: 1, skippedClusterCells: 0 } });
    const repair = nativePaintCall(ctx, {
      ...WALL_PAINT_ARGS,
      cells: repairKind === "partial" ? [cells[1]] : repairKind === "skipped" ? [...cells, { x: 12, y: 0 }] : cells,
      tile: repairKind === "wrong-tile" ? 342 : 306,
      ...(repairKind === "rect" ? { mode: "rect", from: cells[0], to: cells[11] } : {}),
      ...(repairKind === "failed" ? { layer: "invalid" } : {}),
    });
    expect(repair.result.ok).toBe(repairKind !== "failed");
    if (repairKind === "complete") {
      expect(repair.result).toMatchObject({ diff: { tilesChanged: 11 }, data: { tilesTouched: 12, skippedClusterCells: 0 } });
      expect(ctx.project.maps.map_basement.lowerTiles.slice(0, 12)).toEqual(Array(12).fill(306));
      expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [repair], project: ctx.project })).toEqual([]);
      expect(proposalCallChangedSomething(partial)).toBe(false);
      expect(proposalCallChangedSomething(repair)).toBe(true);
      expect(proposalChangedRegions([partial, repair])).toHaveLength(12);
      expect(proposalCompletenessWarnings({ requestText: "타일 160개 추가해줘", calls: [partial, repair], project: ctx.project })).toHaveLength(1);
      for (const failure of ["missing", "short", "layer", "skipped", "failed"] as const) {
        const invalid: ProposalCompletenessCall = { ...repair, result: { ...repair.result,
          ok: failure !== "failed",
          data: failure === "missing" ? undefined : { ...(repair.result.data as Record<string, unknown>),
            ...(failure === "short" ? { tilesTouched: 11 } : {}),
            ...(failure === "layer" ? { effectiveLayer: "upper" } : {}),
            ...(failure === "skipped" ? { skippedClusterCells: 1 } : {}),
          },
        } };
        expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [partial, invalid], project: ctx.project }), failure).toHaveLength(1);
      }
    }
    if (repairKind === "skipped") expect(repair.result.data).toMatchObject({ tilesTouched: 12, skippedClusterCells: 1 });
    expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [partial, repair], project: ctx.project }))
      .toHaveLength(repairKind === "complete" ? 0 : 1);
  });

  it.each(["lower", "upper"] as const)("keeps historical upper execution coverage after native metadata moves the tile home to lower (%s asset)", (assetLayer) => {
    const ctx = preservedPaintContext();
    const cells = WALL_PAINT_ARGS.cells.filter(cell => cell.y === 0);
    const tilesetId = ctx.project.maps.map_basement.tilesetId;
    const setup = runTool(ctx, "set_tile_rules", { tilesetId, entries: [{ tile: 306, layer: "upper" }], confirmedByUser: true });
    expect(setup).toMatchObject({ ok: true, diff: { tilesChanged: 0, tilesetsChanged: 1 } });
    expect(tileLayerHome(ctx.project.tilesets[tilesetId], 306)).toBe("upper");
    const upper = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, cells, layer: "upper" });
    expect(upper.result).toMatchObject({ ok: true, diff: { tilesChanged: 12 } });
    const historical = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, cells, layer: "lower" });
    expect(historical.result).toMatchObject({ ok: true, diff: { tilesChanged: 0 }, data: { tilesTouched: 12, skippedClusterCells: 0 } });
    const before = structuredClone(ctx.project.maps.map_basement);
    expect(before.lowerTiles.slice(0, 12)).toEqual(Array(12).fill(306));
    expect(before.upperTiles.slice(0, 12)).toEqual(Array(12).fill(306));
    const spec = { ...PRESERVED_PAINT_SPEC, assets: [{ ...PRESERVED_PAINT_SPEC.assets[1], layer: assetLayer }] };
    const expectedWarnings = assetLayer === "upper" ? 0 : 1;
    expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [historical], project: ctx.project })).toHaveLength(expectedWarnings);
    const args = { tilesetId, entries: [{ tile: 306, layer: "lower" }], confirmedByUser: true };
    const metadata = { name: "set_tile_rules", args, result: runTool(ctx, "set_tile_rules", args) };
    expect(metadata.result).toMatchObject({ ok: true, diff: { tilesChanged: 0, tilesetsChanged: 1 } });
    expect(tileLayerHome(ctx.project.tilesets[tilesetId], 306)).toBe("lower");
    expect(ctx.project.maps.map_basement.lowerTiles).toEqual(before.lowerTiles);
    expect(ctx.project.maps.map_basement.upperTiles).toEqual(before.upperTiles);
    expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [historical, metadata], project: ctx.project })).toHaveLength(expectedWarnings);
    expect(historical.result.data).toMatchObject({ effectiveLayer: "upper" });
    expect(Object.isFrozen(historical.result.data)).toBe(true);
    // Ledger serialization keeps structured execution evidence, without summary prose.
    const serialized: ProposalCompletenessCall = JSON.parse(JSON.stringify({ name: historical.name, args: historical.args,
      result: { ok: historical.result.ok, diff: historical.result.diff, data: historical.result.data } }));
    expect(proposalCompletenessWarnings({ buildSpec: spec, calls: [serialized, metadata], project: ctx.project })).toHaveLength(expectedWarnings);
  });

  it("checks the current applied cells after later native edits, not the old success or the invalidating diff", () => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const walls = nativePaintCall(ctx, WALL_PAINT_ARGS);
    const overwrite = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, cells: [{ x: 0, y: 0 }], tile: 342 });
    expect(overwrite.result).toMatchObject({ ok: true, diff: { tilesChanged: 1 } });
    const calls = [floor, walls, overwrite];
    const perAsset = PRESERVED_PAINT_SPEC.assets.map(asset => proposalCompletenessWarnings({
      buildSpec: { ...PRESERVED_PAINT_SPEC, assets: [asset] }, calls, project: ctx.project,
    }).length);
    expect(perAsset).toEqual([0, 1, 0]);
  });

  it.each([false, true])("never substitutes the sparse cells bounding box for interior coverage (changed=%s)", (changed) => {
    const ctx = preservedPaintContext();
    const walls = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, tile: changed ? 342 : 306 });
    expect(walls.result).toMatchObject({ ok: true, diff: { tilesChanged: changed ? 24 : 0 } });
    expect(proposalCompletenessWarnings({ buildSpec: { ...PRESERVED_PAINT_SPEC, assets: [PRESERVED_PAINT_SPEC.assets[0]] }, calls: [walls], project: ctx.project })).toHaveLength(1);
  });

  it("does not let unrelated no-ops discharge terrain or non-terrain obligations", () => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const unrelated = nativePaintCall(ctx, { ...WALL_PAINT_ARGS, tile: 112, cells: [{ x: 0, y: 1 }] });
    expect(unrelated.result).toMatchObject({ ok: true, diff: { tilesChanged: 0 } });
    expect(proposalCompletenessWarnings({ buildSpec: PRESERVED_PAINT_SPEC, calls: [floor, unrelated], project: ctx.project })).toHaveLength(1);
    const walls = nativePaintCall(ctx, WALL_PAINT_ARGS);
    expect(proposalCompletenessWarnings({ buildSpec: { ...PRESERVED_PAINT_SPEC, assets: PRESERVED_PAINT_SPEC.assets.slice(1).map(asset => ({ ...asset, kind: "house" })) }, calls: [walls], project: ctx.project })).toHaveLength(1);
  });

  it("cannot use preserved cells as new quantity or genuine change", () => {
    const ctx = preservedPaintContext();
    const floor = nativePaintCall(ctx, FLOOR_PAINT_ARGS);
    const walls = nativePaintCall(ctx, WALL_PAINT_ARGS);
    expect(proposalCompletenessWarnings({ requestText: "타일 160개 추가해줘", calls: [floor, walls], project: ctx.project })).toHaveLength(1);
    expect(proposalCompletenessWarnings({ requestText: "벽을 바꿔줘", calls: [walls], project: ctx.project })).toHaveLength(1);
  });
});

describe("proposal completeness lint", () => {
  it.each([
    HISTORICAL_PLACEMENT_CORRECTION,
    "기존 나무 10개는 보존하고 출구 이벤트를 수정해줘",
    "현재 맵에 나무 10개가 있어. 출구 이벤트를 수정해줘",
    "현재 맵에 나무 10개가 배치되어 있어. 출구 이벤트를 수정해줘",
    "이미 나무 10개를 만들었어. 출구 이벤트를 수정해줘",
    "인벤토리에 열쇠 1개가 있어. 출구에서 열쇠 1개 소비하도록 만들어줘",
    "열쇠 1개를 사용하도록 출구 이벤트를 만들어줘",
    "인벤토리에 열쇠 3개 추가해줘",
    '이전 답변은 "나무 10개 배치 완료"야. 출구 이벤트를 수정해줘',
    "이전 답변:\n> 나무 10개 배치 완료\n출구 이벤트를 수정해줘",
    "이전 결과:\n```text\n나무 10개 배치 완료\n```\n출구 이벤트를 수정해줘",
  ])("does not count facts, preservation, consumption or prior output: %s", (requestText) => {
    expect(proposalCompletenessWarnings({
      requestText,
      intent: declaredIntent({ mode: "modify" }),
      calls: [
        call("update_event", { mapId: "m1", eventId: "exit" }, { eventsModified: 1 }),
        call("set_map_properties", { mapId: "m1", name: "마을" }, { mapPropertiesChanged: 1 }),
      ],
    })).toEqual([]);
  });

  it.each([
    "기존 나무 10개는 보존하고 꽃 3개 추가해줘",
    "기존 나무 10개는 그대로 두고 꽃 3개 추가해줘",
    "현재 나무 10개가 있고 꽃 3개 추가해줘",
    "열쇠 1개 소비하고 꽃 3개 추가해줘",
    '이전 답변은 "나무 10개 배치 완료"야. 꽃 3개 추가해줘',
  ])("counts only additions within a mixed modification: %s", (requestText) => {
    const warningsFor = (placed: number) => proposalCompletenessWarnings({
      requestText,
      intent: declaredIntent({ mode: "modify" }),
      calls: [call("place_props", { mapId: "m1", material: "꽃", count: 3 }, { tilesChanged: placed }, { placed })],
    });
    // Compare to the same machine decision, not the human-readable warning copy.
    expect(warningsFor(1)).toEqual(proposalCompletenessWarnings({
      requestText: "꽃 3개 추가해줘",
      calls: [call("place_props", { mapId: "m1", material: "꽃", count: 3 }, { tilesChanged: 1 }, { placed: 1 })],
    }));
    expect(warningsFor(1)).toHaveLength(1);
    expect(warningsFor(3)).toEqual([]);
  });

  it("does not exempt an unfulfilled modification from the no-change gate", () => {
    expect(proposalCompletenessWarnings({
      requestText: HISTORICAL_PLACEMENT_CORRECTION,
      intent: declaredIntent({ mode: "modify" }),
      calls: [],
    })).toHaveLength(1);
  });

  it.each(["나무 10개 배치해줘", "현재 맵에 나무 10개 추가해줘", "집 3채, NPC 7명 배치해줘"])("retains genuine placement shortfalls: %s", (requestText) => {
    expect(proposalCompletenessWarnings({
      requestText,
      intent: declaredIntent({ mode: "modify" }),
      calls: [call("place_props", { mapId: "m1", material: "나무", count: 10 }, { tilesChanged: 3 }, { placed: 3 })],
    })).toHaveLength(1);
  });

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

  it("실내 신축 선언에 야외 집 정본만 쓰면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "연금술사의 집 이라는 실내 를 하나 만드렁줘",
      intent: declaredIntent({ mode: "create", space: "interior" }),
      calls: [
        call("author_house", { kind: "single", mapId: "m1", kitId: "bright-plaster", wings: [{ x: 4, y: 5, w: 12, h: 10 }], interior: "exterior-only", door: true, yard: [] }, { tilesChanged: 80 }),
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

  it("실내 신축 선언에 create_map만 하면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "실내 맵 하나 만들어줘",
      intent: declaredIntent({ mode: "create", space: "interior" }),
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
        call("author_house", { kind: "single", mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", door: true, yard: [] }, { tilesChanged: 36 }),
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

describe("완성도 린트 — 의도 선언이 있으면 선언 필드로 판정한다", () => {
  const emptyCall = (name: string): ProposalCompletenessCall => ({ name, args: {}, result: { ok: true, diff: changeSummary() } });
  const okHouse = (interior: "exterior-only" | "linked-interior" | "omit" = "exterior-only"): ProposalCompletenessCall => ({
    name: "author_house",
    args: interior === "omit" ? {} : { interior },
    result: { ok: true, diff: changeSummary({ tilesChanged: 40 }) },
  });

  it("질문 선언은 변경 0건이어도 미이행이 아니다", () => {
    const warnings = proposalCompletenessWarnings({ requestText: "이 맵 이벤트 몇 개야?", intent: declaredIntent({ mode: "question" }), calls: [emptyCall("find_events")] });
    expect(warnings).toEqual([]);
  });

  it("생성 선언인데 변경이 없으면 미이행이다 — 문장에 동사가 없어도", () => {
    const warnings = proposalCompletenessWarnings({ requestText: "여관", intent: declaredIntent({ mode: "create" }), calls: [] , assistantText: "완료" });
    expect(warnings.some((warning) => warning.includes("실제 변경이 없습니다"))).toBe(true);
  });

  it("실내 신축 선언에 야외 집만 지으면 경고하고, 실내 수정 선언·선언 없음에는 경고하지 않는다", () => {
    const interiorCreate = proposalCompletenessWarnings({ requestText: "여관 지어줘", intent: declaredIntent({ mode: "create", space: "interior", facility: "여관" }), calls: [okHouse()] });
    expect(interiorCreate.some((warning) => warning.includes("실내 요청인데 야외 집 외장"))).toBe(true);
    const interiorModify = proposalCompletenessWarnings({ requestText: "이 여관 좀 고쳐줘", intent: declaredIntent({ mode: "modify", space: "interior" }), calls: [okHouse()] });
    expect(interiorModify.some((warning) => warning.includes("실내 요청인데"))).toBe(false);
    // 선언이 없으면 「여관」 낱말만으로 실내를 추측하지 않는다.
    const none = proposalCompletenessWarnings({ requestText: "여관 지어줘", calls: [okHouse()] });
    expect(none.some((warning) => warning.includes("실내 요청인데"))).toBe(false);
  });

  it("원탭 선택지가 붙은 되묻기 응답은 변경 0건이 정상이다", () => {
    const warnings = proposalCompletenessWarnings({ requestText: "집 지어줘", intent: declaredIntent({ mode: "create", space: "unclear" }), calls: [], assistantText: "어디에 지을까요?\n[선택지] 실내 | 야외" });
    expect(warnings).toEqual([]);
  });

  it("실내 신축에 linked-interior 집을 지으면 경고하지 않는다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "집 지어줘 들어가게",
      intent: declaredIntent({ mode: "create", space: "interior" }),
      calls: [call("author_house", { kind: "single", mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "linked-interior", door: true, yard: [] }, { tilesChanged: 40 })],
    });
    expect(warnings.some((warning) => warning.includes("실내 요청인데"))).toBe(false);
  });

  it("야외 집 시공에 외장만 지으면 경고한다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "집 지어줘",
      intent: declaredIntent({ mode: "create", space: "outdoor" }),
      calls: [okHouse()],
    });
    expect(warnings.some((warning) => warning.includes("외장만"))).toBe(true);
  });

  it("야외 집 시공에서 interior 생략은 linked-interior로 보고 경고하지 않는다", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "집 지어줘",
      intent: declaredIntent({ mode: "create", space: "outdoor" }),
      calls: [okHouse("omit")],
    });
    expect(warnings.some((warning) => warning.includes("외장만"))).toBe(false);
  });

  it("space=both lots with all exterior-only houses fires a completeness warning", () => {
    const warnings = proposalCompletenessWarnings({
      requestText: "Build walk-in houses",
      intent: declaredIntent({ mode: "create", space: "both" }),
      calls: [
        call(
          "author_house",
          {
            kind: "lots",
            mapId: "m1",
            interior: "linked-interior",
            houses: [
              { kitId: "blue-stone", wings: [{ x: 2, y: 1, w: 6, h: 8 }], interior: "exterior-only", door: true, yard: [] },
              { kitId: "bright-plaster", wings: [{ x: 12, y: 1, w: 7, h: 9 }], interior: "exterior-only", door: true, yard: [] },
            ],
          },
          { tilesChanged: 80 },
        ),
      ],
    });
    expect(warnings.some((line) => line.includes("야외+실내") && line.includes("외장만"))).toBe(true);
  });
});
