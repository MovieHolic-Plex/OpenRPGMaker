import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { proposalCompletenessWarningLines, proposalCompletenessWarnings, proposalHasChangedMap, proposalChangedRegions, proposalCallChangedSomething, type ProposalCompletenessCall } from "@/ai/proposalCompleteness";
import type { BuildSpec } from "@/ai/buildSpec";
import { declaredIntent } from "./intentFixture";
import type { ChangeSummary } from "@/editor/tools/types";
import { runTool } from "@/editor/tools";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, nativePaintCall, preservedPaintContext } from "./fixtures/preservedPaint";
import { buildInlineApprovalToolbar, getInlineProposalActions, setInlineProposalActions, subscribeInlineProposalActions } from "@/editor/proposalInlineApproval";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { filterProps, groupProps, recommendProps, propsForTileset } from "@/editor/propRecommendations";
import type { GameMap, TilesetDef } from "@/project/types";
import { RECOLLECTION_BGM_ID, RECOLLECTION_PICTURE_ID, recollectionBeats } from "@/editor/recollectionBeats";
import { isSignificantRegionDrag, regionRectFromDrag } from "@/editor/regionRightDrag";
import { eventsInRegion, regionSnapshotScale } from "@/editor/regionSnapshot";
import { isolateTimers } from "./mergedTeardown";

describe("proposalCompleteness", () => {
  isolateTimers();
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
      expect(historical.result.data).toMatchObject({ effectiveLayer: "3" });
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

    // Removed it "실내 신축 선언에 야외 집 정본만 쓰면": author_house was removed from the tool registry on purpose.

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

    // Removed it "집 3채 NPC 5명 요청에서 집 1채뿐이면": author_house was removed from the tool registry on purpose.

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

    // Removed it "canonical construction calls fulfill nested target": author_house and author_village were removed from the tool registry on purpose.
  });
  describe("완성도 린트 — 의도 선언이 있으면 선언 필드로 판정한다", () => {
    const emptyCall = (name: string): ProposalCompletenessCall => ({ name, args: {}, result: { ok: true, diff: changeSummary() } });

    it("질문 선언은 변경 0건이어도 미이행이 아니다", () => {
      const warnings = proposalCompletenessWarnings({ requestText: "이 맵 이벤트 몇 개야?", intent: declaredIntent({ mode: "question" }), calls: [emptyCall("find_events")] });
      expect(warnings).toEqual([]);
    });

    it("생성 선언인데 변경이 없으면 미이행이다 — 문장에 동사가 없어도", () => {
      const warnings = proposalCompletenessWarnings({ requestText: "여관", intent: declaredIntent({ mode: "create" }), calls: [] , assistantText: "완료" });
      expect(warnings.some((warning) => warning.includes("실제 변경이 없습니다"))).toBe(true);
    });

    // Removed it "실내 신축 선언에 야외 집만 지으면 경고하고": author_house was removed from the tool registry on purpose.

    it("원탭 선택지가 붙은 되묻기 응답은 변경 0건이 정상이다", () => {
      const warnings = proposalCompletenessWarnings({ requestText: "집 지어줘", intent: declaredIntent({ mode: "create", space: "unclear" }), calls: [], assistantText: "어디에 지을까요?\n[선택지] 실내 | 야외" });
      expect(warnings).toEqual([]);
    });

    // Removed it "실내 신축에 linked-interior 집을": author_house was removed from the tool registry on purpose.

    // Removed it "야외 집 시공에 외장만 지으면": author_house was removed from the tool registry on purpose.

    // Removed it "야외 집 시공에서 interior 생략은": author_house was removed from the tool registry on purpose.

    // Removed it "space=both lots with all exterior-only": author_house was removed from the tool registry on purpose.
  });
});

describe("proposalInlineApproval", () => {
  isolateTimers();
  describe("inline proposal actions registry", () => {
    afterEach(() => setInlineProposalActions(null));

    it("set/get/subscribe가 동작한다", () => {
      let notified = 0;
      const unsub = subscribeInlineProposalActions(() => { notified += 1; });
      const actions = { accept: () => {}, reject: () => {}, focusCard: () => {} };
      setInlineProposalActions(actions);
      expect(getInlineProposalActions()).toBe(actions);
      setInlineProposalActions(null);
      expect(getInlineProposalActions()).toBeNull();
      expect(notified).toBe(2);
      unsub();
    });

    it("CAS 해제 — A 등록 후 B가 덮어쓰면 A의 해제 시도는 무시된다(경합 방지)", () => {
      const actionsA = { accept: () => {}, reject: () => {} };
      const actionsB = { accept: () => {}, reject: () => {} };
      setInlineProposalActions(actionsA);
      // B가 A 모르게 슬롯을 덮어씀(last-writer-wins) — 예: 영역 pending이 채팅 제안 위에 등록.
      setInlineProposalActions(actionsB);
      // A가 자기 등록만 확인하고 해제(CAS): 현재 슬롯이 자신(actionsA)일 때만 지운다.
      if (getInlineProposalActions() === actionsA) setInlineProposalActions(null);
      // B의 등록은 A의 뒤늦은 해제에 영향받지 않고 그대로 남아야 한다.
      expect(getInlineProposalActions()).toBe(actionsB);
    });
  });
  describe("buildInlineApprovalToolbar", () => {
    let restore: () => void;
    let windowListeners: Map<string, EventListener[]>;
    // CameraPanController와 동일한 window 레벨 폴백 패턴을 검증하기 위한 최소 window mock
    // (test/mapHistoryPanel.test.ts의 기존 관례를 따름 — fakeDom.ts는 document/Node만 다룬다).
    const dispatchOnWindow = (event: Event): void => {
      for (const listener of [...(windowListeners.get(event.type) ?? [])]) listener(event);
    };
    beforeEach(() => {
      restore = installFakeDom();
      windowListeners = new Map();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: {
          addEventListener: (type: string, listener: EventListener) => {
            windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
          },
          removeEventListener: (type: string, listener: EventListener) => {
            windowListeners.set(type, (windowListeners.get(type) ?? []).filter((item) => item !== listener));
          },
        },
      });
    });
    afterEach(() => {
      restore();
      setInlineProposalActions(null);
      Reflect.deleteProperty(globalThis, "window");
    });

    it("적용/거부/상세 버튼이 핸들러를 호출한다", () => {
      const hits: string[] = [];
      const bar = buildInlineApprovalToolbar({
        accept: () => hits.push("accept"),
        reject: () => hits.push("reject"),
        focusCard: () => hits.push("focus"),
      });
      document.body.append(bar);
      for (const id of ["ghost-inline-accept", "ghost-inline-reject", "ghost-inline-detail"]) {
        (findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement).click();
      }
      expect(hits).toEqual(["accept", "reject", "focus"]);
    });

    it("holdOrigin이 있으면 원본 보기 버튼을 렌더하고 pointerdown/up으로 start/end를 부른다", () => {
      const calls: string[] = [];
      const toolbar = renderWithFakeDom(() =>
        buildInlineApprovalToolbar({
          accept: () => calls.push("accept"),
          reject: () => calls.push("reject"),
          holdOrigin: {
            label: "원본 보기",
            start: () => calls.push("start"),
            end: () => calls.push("end"),
          },
        }),
      );
      const hold = findByTestId(toolbar, "ghost-inline-hold-origin");
      expect(hold).not.toBeNull();
      hold!.dispatchEvent(new Event("pointerdown"));
      hold!.dispatchEvent(new Event("pointerup"));
      expect(calls).toEqual(["start", "end"]);
    });

    it("리렌더로 버튼 DOM이 파괴돼도 window 폴백 pointerup으로 end가 정확히 1회 불린다", () => {
      const calls: string[] = [];
      const toolbar = renderWithFakeDom(() =>
        buildInlineApprovalToolbar({
          accept: () => {},
          reject: () => {},
          holdOrigin: {
            label: "원본 보기",
            start: () => calls.push("start"),
            end: () => calls.push("end"),
          },
        }),
      );
      const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
      hold.dispatchEvent(new Event("pointerdown"));
      expect(calls).toEqual(["start"]);
      // 리렌더 시뮬레이션: 고스트 숨김 emit → 마커/툴바 재생성으로 버튼 노드가 파괴됨.
      // 로컬 pointerup 핸들러는 더 이상 도달 불가 — window 폴백만이 end를 보장한다.
      hold.remove();
      dispatchOnWindow(new Event("pointerup"));
      expect(calls).toEqual(["start", "end"]);
      // 리스너가 해제됐으므로 재차 dispatch해도 중복 호출 없음.
      dispatchOnWindow(new Event("pointerup"));
      expect(calls).toEqual(["start", "end"]);
    });

    it("pointerdown을 두 번 눌러도 start는 한 번만 불리고 window 리스너도 중복 등록되지 않는다", () => {
      const calls: string[] = [];
      const toolbar = renderWithFakeDom(() =>
        buildInlineApprovalToolbar({
          accept: () => {},
          reject: () => {},
          holdOrigin: {
            label: "원본 보기",
            start: () => calls.push("start"),
            end: () => calls.push("end"),
          },
        }),
      );
      const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
      hold.dispatchEvent(new Event("pointerdown"));
      hold.dispatchEvent(new Event("pointerdown"));
      expect(calls).toEqual(["start"]);
      hold.remove();
      // 리스너가 중복 등록됐다면 단일 pointerup에도 end가 2회 이상 불렸을 것.
      dispatchOnWindow(new Event("pointerup"));
      expect(calls).toEqual(["start", "end"]);
    });

    it("Space 키다운 후 버튼이 파괴돼도 window 폴백 keyup으로 end가 호출된다", () => {
      const calls: string[] = [];
      const toolbar = renderWithFakeDom(() =>
        buildInlineApprovalToolbar({
          accept: () => {},
          reject: () => {},
          holdOrigin: {
            label: "원본 보기",
            start: () => calls.push("start"),
            end: () => calls.push("end"),
          },
        }),
      );
      const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
      const keydown = new Event("keydown", { cancelable: true });
      Object.defineProperty(keydown, "key", { configurable: true, value: " " });
      hold.dispatchEvent(keydown);
      expect(calls).toEqual(["start"]);
      hold.remove();
      const keyup = new Event("keyup");
      Object.defineProperty(keyup, "key", { configurable: true, value: " " });
      dispatchOnWindow(keyup);
      expect(calls).toEqual(["start", "end"]);
    });

    it("focusCard가 없으면 상세 버튼을 렌더하지 않는다", () => {
      const toolbar = renderWithFakeDom(() => buildInlineApprovalToolbar({ accept: () => {}, reject: () => {} }));
      expect(findByTestId(toolbar, "ghost-inline-detail")).toBeNull();
    });
  });
});

describe("propRecommendations", () => {
  isolateTimers();
  function fixture() {
    const tileset: TilesetDef = { id: "props", name: "Props", image: { type: "uploaded", id: "props-image" }, kind: "custom", tileSize: 32, tilesPerRow: 4, count: 8,
      passability: Array(8).fill("o"), priority: Array(8).fill("upper"), terrain: Array(8).fill(0),
      structureKits: [
        { id: "chair-red", kind: "section", name: "붉은 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [1] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
        { id: "chair-blue", kind: "section", name: "푸른 의자", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [2] }], ai: { description: "의자", placementRules: "", tags: ["의자"] } },
        { id: "statue", kind: "section", name: "광장 석상", width: 1, height: 2, rows: [{ tiles: [-1], upperTiles: [3] }, { tiles: [-1], upperTiles: [4] }] },
        { id: "broken", kind: "section", name: "손상된 기물", width: 1, height: 1, rows: [{ tiles: [8] }] },
        { id: "wrong-size", kind: "section", name: "16px 기물", tileSize: 16, width: 1, height: 1, rows: [{ tiles: [2] }] },
      ] };
    const map = { id: "map", name: "광장", tilesetId: tileset.id, tileSize: 32, width: 10, height: 10, locations: [] } as unknown as GameMap;
    return { map, tileset };
  }
  describe("map prop recommendations", () => {
    it("uses valid native cells from the map's own chipset and ranks place matches first", () => {
      const { map, tileset } = fixture();
      const entries = recommendProps(map, tileset);
      expect(entries.map(entry => entry.choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
      expect(entries[0]!.choice.stamp).toMatchObject({ width: 1, height: 2, source: { tilesetId: "props", tileSize: 32 }, cells: [{ dx: 0, dy: 0, layer: "upper", tile: 3 }, { dx: 0, dy: 1, layer: "upper", tile: 4 }] });
      expect(propsForTileset(tileset)).toBe(propsForTileset(tileset));
    });
    it("keeps color variants from filling the first recommendations", () => {
      const { map, tileset } = fixture();
      map.name = "새 맵";
      expect(recommendProps(map, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "statue", "chair-blue"]);
    });
    it("refuses foreign chipsets, mismatched tile sizes, and objects too large for the map", () => {
      const { map, tileset } = fixture();
      expect(recommendProps({ ...map, tilesetId: "other" }, tileset)).toEqual([]);
      expect(recommendProps({ ...map, tileSize: 16 }, tileset)).toEqual([]);
      expect(recommendProps({ ...map, height: 1 }, tileset).map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
    });
    it("groups objects by type and searches the whole catalog before paging", () => {
      const { map, tileset } = fixture();
      tileset.structureKits!.push(...Array.from({ length: 8 }, (_, index) => ({
        id: `workbench-${index}`, kind: "section" as const, name: `작업대 ${index}`, width: 1, height: 1, rows: [{ tiles: [5] }],
        ai: { description: "대장간 제작", placementRules: "", tags: ["대장간"] },
      })));
      const entries = recommendProps(map, tileset);
      expect(filterProps(entries, "seating", "").map(entry => entry.choice.id)).toEqual(["chair-red", "chair-blue"]);
      expect(filterProps(entries, "tables", "대장간 작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
      expect(entries.slice(0, 6).some(entry => entry.choice.id === "workbench-7")).toBe(false);
      expect(filterProps(entries, undefined, "작업대 7").map(entry => entry.choice.id)).toEqual(["workbench-7"]);
      expect(filterProps(entries, "beds", "의자")).toEqual([]);
    });
    it("keeps pedestals out of beds and uses the object name before ambiguous ids", () => {
      const { tileset } = fixture();
      tileset.structureKits!.push(
        { id: "key-pedestal", kind: "section", name: "열쇠 받침대", width: 1, height: 1, rows: [{ tiles: [5] }], ai: { description: "", placementRules: "", tags: ["JRPG 장치"] } },
        { id: "flower-bed", kind: "section", name: "꽃 화분", width: 1, height: 1, rows: [{ tiles: [6] }] },
      );
      const choices = propsForTileset(tileset);
      expect(choices.find(choice => choice.id === "key-pedestal")?.category).toBe("devices");
      expect(choices.find(choice => choice.id === "flower-bed")?.category).toBe("plants");
    });

    it("groups bundled props by manifest order and searches catalog fields across groups", () => {
      const { map, tileset } = fixture();
      for (const id of ["anchor_decor", "bed_double", "birch_tree"]) {
        tileset.structureKits!.push({
          id: `bd-object:${id}`, kind: "section", name: "이전 저장 이름", width: 1, height: 1,
          rows: [{ tiles: [-1], upperTiles: [7] }],
          ai: { description: "", placementRules: "", tags: ["이전 저장 태그"] },
        });
      }
      const entries = recommendProps(map, tileset);
      const { groups, ungrouped } = groupProps(entries);
      expect(groups.map(({ group, entries }) => [group.id, entries.map(({ choice }) => choice.name)])).toEqual([
        ["nature", ["자작나무"]], ["indoor", ["더블 침대"]], ["harbor", ["닻 장식"]],
      ]);
      expect(ungrouped.map(({ choice }) => choice.id)).toEqual(["statue", "chair-red", "chair-blue"]);
      expect(filterProps(entries, undefined, "자작").map(({ choice }) => choice.id)).toEqual(["bd-object:birch_tree"]);
      expect(filterProps(entries, undefined, "OR_DEC").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
      expect(filterProps(entries, undefined, "ARBO").map(({ choice }) => choice.id)).toEqual(["bd-object:anchor_decor"]);
      expect(filterProps(entries, undefined, "닻 항구")).toEqual([]);
      expect(groupProps(filterProps(entries, undefined, "버들항 기본 기물")).groups.map(({ group }) => group.id))
        .toEqual(["nature", "indoor", "harbor"]);
      expect(groupProps(filterProps(entries, undefined, "이전 저장 태그"))).toEqual({ groups: [], ungrouped: [] });
    });
  });
});

describe("recollectionBeats", () => {
  isolateTimers();
  describe("recollectionBeats", () => {
    it("페이드·틴트·회상 BGM·그림·대사·복원을 한 호흡으로 쌓는다", () => {
      const beats = recollectionBeats({
        speaker: "나",
        lines: ["그날을 기억한다.", "창밖의 달빛."],
        pictureResourceId: "pic_moon",
      });
      const kinds = beats.map((beat) => beat.kind);
      expect(kinds).toContain("fade");
      expect(kinds).toContain("tint");
      expect(kinds).toContain("music");
      expect(kinds).toContain("picture");
      expect(kinds).toContain("say");

      expect(beats.some((beat) => beat.kind === "fade" && beat.direction === "out")).toBe(true);
      expect(beats.some((beat) => beat.kind === "fade" && beat.direction === "in")).toBe(true);
      expect(beats.some((beat) => beat.kind === "music" && beat.action === "bgm" && beat.resourceId === RECOLLECTION_BGM_ID)).toBe(true);
      expect(beats.some((beat) => beat.kind === "music" && (beat.action === "stop" || beat.action === "fade"))).toBe(true);
      expect(
        beats.some(
          (beat) =>
            beat.kind === "picture" &&
            beat.action === "show" &&
            beat.resourceId === "pic_moon" &&
            beat.pictureId === RECOLLECTION_PICTURE_ID,
        ),
      ).toBe(true);
      expect(beats.some((beat) => beat.kind === "picture" && beat.action === "erase")).toBe(true);
      const lastTint = [...beats].reverse().find((beat) => beat.kind === "tint");
      expect(lastTint?.kind === "tint" ? lastTint.color === "neutral" || lastTint.color === "#ffffff" : false).toBe(true);
    });
  });
});

describe("regionRightDrag", () => {
  isolateTimers();
  describe("regionRightDrag", () => {
    const map = { width: 20, height: 15 };

    it("treats single-cell click as insignificant (eyedropper path)", () => {
      const rect = regionRectFromDrag({ x: 3, y: 4 }, { x: 3, y: 4 }, map);
      expect(rect).toEqual({ x: 3, y: 4, width: 1, height: 1 });
      expect(isSignificantRegionDrag(rect)).toBe(false);
    });

    it("treats multi-cell drag as significant (AI region path)", () => {
      const rect = regionRectFromDrag({ x: 2, y: 2 }, { x: 5, y: 4 }, map);
      expect(rect).toEqual({ x: 2, y: 2, width: 4, height: 3 });
      expect(isSignificantRegionDrag(rect)).toBe(true);
    });

    it("normalizes inverted drag corners", () => {
      const rect = regionRectFromDrag({ x: 8, y: 9 }, { x: 5, y: 6 }, map);
      expect(rect).toEqual({ x: 5, y: 6, width: 4, height: 4 });
      expect(isSignificantRegionDrag(rect)).toBe(true);
    });
  });
});

describe("regionSnapshot", () => {
  isolateTimers();
  describe("regionSnapshotScale", () => {
    it("영역 픽셀 폭을 목표 폭에 맞춰 축소하되 최대 2배·최소 1/16로 클램프", () => {
      expect(regionSnapshotScale(70, 140)).toBe(2); // 작은 영역은 2배 상한
      expect(regionSnapshotScale(280, 140)).toBe(0.5);
      expect(regionSnapshotScale(140 * 32, 140)).toBe(0.0625); // 거대 영역 하한(1/16 = 타일 16px 기준 1px/타일)
      expect(regionSnapshotScale(0, 140)).toBe(1); // 비정상 입력 방어
    });
  });
  describe("eventsInRegion", () => {
    const map = {
      width: 10, height: 10,
      events: [
        { id: "a", x: 2, y: 2 },
        { id: "b", x: 5, y: 5 },
        { id: "c", x: 9, y: 9 },
      ],
    } as unknown as GameMap;
    it("영역 안 이벤트만 반환", () => {
      const inside = eventsInRegion(map, { x: 2, y: 2, width: 4, height: 4 });
      expect(inside.map((event) => event.id)).toEqual(["a", "b"]);
    });
  });
});
