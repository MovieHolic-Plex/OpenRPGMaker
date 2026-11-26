import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { proposalCompletenessWarningLines, proposalCompletenessWarnings, proposalHasChangedMap, proposalChangedRegions, proposalCallChangedSomething, type ProposalCompletenessCall } from "@/ai/proposalCompleteness";
import type { BuildSpec } from "@/ai/buildSpec";
import { declaredIntent } from "./intentFixture";
import type { ChangeSummary } from "@/editor/tools/types";
import { runTool } from "@/editor/tools";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, nativePaintCall, preservedPaintContext } from "./fixtures/preservedPaint";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyAiReviewProposals } from "@/editor/tilesetAiNativeReviewApply";
import { completeAiReview, createAiReviewIdle, startAiReview, type TilesetAiReviewProposal } from "@/editor/tilesetAiNativeReviewModel";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef, ActorRecord, Command } from "@/project/types";
import { GENRE_PACK_IDS, createGenreBlankProjectSystemPresetPlan, createProjectFromGenreBlankProjectSystemPreset, genrePackById, materializeGenreBlankProjectSystemPreset } from "@/editor/genrePacks";
import { WELCOME_GENRE_PRESETS, welcomeGenrePresetById, welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import { isGenrePackId } from "@/project/genrePackId";
import { isolateTimers } from "./mergedTeardown";
import { shouldShowPaintHoverPreview } from "@/editor/editSceneHoverPreview";
import { buildFollowerPresets, followerPresetToCommands } from "@/editor/followerPresets";
import { applyCellFixes, cellGridSize, dungeonPlanFromCells, forestDesignFromCells, parseCellMap, villageArgsFromCells } from "@/ai/imagePlanCells";
import { PLAN_FOLLOW_BAR, parsePlanFollowCheck, planFollowFixRequest } from "@/ai/imagePlanCheck";
import { builtMapOf } from "@/editor/imagePlanFollowCheck";
import { describeNote, imagePlanBuildNote, parseImagePlanDescription, type ImagePlanRead } from "@/ai/imagePlan";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig } from "@/ai/llmClient";
import { meetsBar, parsePlanJudge, pickBest, readYield } from "@/ai/imagePlanPick";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById, interiorObjectsForTheme, type InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_ROOM_THEMES, INTERIOR_SEMANTIC_TILE_CATALOG, VR, type InteriorSemanticTileRole, INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, evaluateInteriorRoom, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";

describe("editorSuite2", () => {
  isolateTimers();
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
  describe("tilesetAiNativeReviewApply", () => {
    isolateTimers();
    let tilesetId = "";
    function currentTileset(): TilesetDef {
      const tileset = store.getCurrent().tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset fixture");
      return tileset;
    }
    function proposal(
      id: string,
      confidence: number,
      tileIds: readonly number[],
    ): TilesetAiReviewProposal {
      return {
        cellLayers: null,
        confidence,
        description: `${id} description`,
        evidence: "AI geometry",
        feedback: "",
        id,
        name: id,
        passage: { down: false, left: false, right: false, up: false },
        placementRules: `${id} rule`,
        question: `${id} question`,
        quickReplies: ["Yes", "No"],
        status: "pending",
        template: "repeatable-cliff-2x3",
        tileIds,
      };
    }
    describe("AI-native review apply", () => {
      beforeEach(() => {
        const project = createBlankProject();
        tilesetId = Object.keys(project.tilesets)[0] ?? "";
        const tileset = project.tilesets[tilesetId];
        if (!tileset) throw new Error("missing tileset fixture");
        tileset.tileGroups = [];
        tileset.tileMeta = undefined;
        store.replace(project);
        resetMapEditHistory();
      });

      it("accepts only high-confidence proposals in one undoable batch", () => {
        // Given
        const columns = currentTileset().tilesPerRow;
        const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
        const highA = proposal("high-a", 0.94, [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1]);
        const highB = proposal("high-b", 0.88, [3, 4, columns + 3, columns + 4, (columns * 2) + 3, (columns * 2) + 4]);
        const uncertain = proposal("uncertain", 0.7, [6, 7, columns + 6, columns + 7, (columns * 2) + 6, (columns * 2) + 7]);
        const state = completeAiReview(
          startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
          { fingerprint, proposals: [uncertain, highB, highA], summary: "three", warnings: [] },
        );

        // When
        const applied = applyAiReviewProposals({ mode: "high", state, tilesetId });

        // Then
        expect(applied.kind).toBe("applied");
        if (applied.kind !== "applied") throw new Error("apply failed");
        expect(applied.appliedIds).toEqual(["high-a", "high-b"]);
        expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["high-a", "high-b"]);
        expect(undoMapEdit()).toBe(true);
        expect(currentTileset().tileGroups).toEqual([]);
      });

      it("rejects stale proposals and skips tiles protected by human knowledge", () => {
        // Given
        const columns = currentTileset().tilesPerRow;
        const protectedTiles = [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1];
        currentTileset().tileGroups = [{
          defaultLayer: "lower",
          description: "Human cliff",
          id: "human-cliff",
          name: "Human cliff",
          origin: "user",
          placementRules: "Keep",
          role: "wall",
          source: "user",
          tileIds: protectedTiles,
        }];
        const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
        const state = completeAiReview(
          startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
          { fingerprint, proposals: [proposal("overwrite", 0.99, protectedTiles)], summary: "one", warnings: [] },
        );

        // When
        const protectedResult = applyAiReviewProposals({ mode: "high", state, tilesetId });
        currentTileset().tileSize += 1;
        const staleResult = applyAiReviewProposals({ mode: "high", state, tilesetId });

        // Then
        expect(protectedResult).toEqual(expect.objectContaining({ appliedIds: [], kind: "applied", skippedIds: ["overwrite"] }));
        expect(staleResult.kind).toBe("stale");
        expect(currentTileset().tileGroups?.find((group) => group.id === "human-cliff")?.name).toBe("Human cliff");
      });

      it("applies only the strongest proposal when AI candidates overlap", () => {
        // Given
        const columns = currentTileset().tilesPerRow;
        const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
        const strongest = proposal("strongest", 0.97, [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1]);
        const overlapping = proposal("overlapping", 0.9, [1, 2, columns + 1, columns + 2, (columns * 2) + 1, (columns * 2) + 2]);
        const state = completeAiReview(
          startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
          { fingerprint, proposals: [overlapping, strongest], summary: "overlap", warnings: [] },
        );

        // When
        const result = applyAiReviewProposals({ mode: "high", state, tilesetId });

        // Then
        expect(result).toEqual({ appliedIds: ["strongest"], kind: "applied", skippedIds: ["overlapping"] });
        expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["strongest"]);
      });

      it("applies a staged conversational proposal only after explicit selected apply", () => {
        // Given
        const columns = currentTileset().tilesPerRow;
        const fingerprint = tilesetKnowledgeFingerprint(currentTileset());
        const staged = { ...proposal("staged", 0.72, [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1]), status: "accepted" as const };
        const state = completeAiReview(
          startAiReview(createAiReviewIdle(tilesetId, fingerprint), "request-1"),
          { fingerprint, proposals: [staged], summary: "staged", warnings: [] },
        );

        // When
        const beforeApply = currentTileset().tileGroups;
        const result = applyAiReviewProposals({ mode: "selected", proposalIds: ["staged"], state, tilesetId });

        // Then
        expect(beforeApply).toEqual([]);
        expect(result).toEqual({ appliedIds: ["staged"], kind: "applied", skippedIds: [] });
        expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["staged"]);
      });
    });
  });
  describe("genrePackRegistry", () => {
    isolateTimers();
    describe("genre pack registry contract", () => {
      it("all official packs expose complete machine-readable guidance", () => {
        expect(GENRE_PACK_IDS).toEqual([
          "adventure-jrpg",
          "monster-collect",
          "horror-chase",
          "story-cutscene",
          "farm-life",
          "action-rpg",
        ]);

        for (const packId of GENRE_PACK_IDS) {
          const pack = genrePackById(packId);
          expect(pack.id).toBe(packId);
          expect(pack.starter.defaultRecipeId).toBeTruthy();
          expect(pack.navigation.sections.length).toBeGreaterThan(0);
          expect(Object.keys(pack.vocabulary).length).toBeGreaterThan(0);
          expect(pack.recipes.length).toBeGreaterThan(0);
          expect(pack.recipes.every((recipe) => recipe.appliesSystemFields.length > 0)).toBe(true);
          expect(pack.lint.length).toBeGreaterThan(0);
          expect(pack.journeys.length).toBeGreaterThan(0);
          expect(pack.runtimeRequirements.length).toBeGreaterThan(0);
          expect(pack.recipes.some((recipe) => recipe.id === pack.starter.defaultRecipeId)).toBe(true);
        }
      });

      it("BREAK: every welcome card resolves to a real pack recipe without AI", () => {
        expect(WELCOME_GENRE_PRESETS).toHaveLength(8);
        for (const preset of WELCOME_GENRE_PRESETS) {
          const pack = genrePackById(preset.packId);
          expect(pack.recipes.some((recipe) => recipe.id === preset.systemPresetRecipeId)).toBe(true);
          expect(welcomeGenreSystemPresetPlanById(preset.id)).toMatchObject({
            kind: "blank-project-system-preset",
            packId: preset.packId,
            recipeId: preset.systemPresetRecipeId,
            projectSchema: "Project",
            preservesOpenProjectUntilRemoteVerified: true,
            aiRequired: false,
          });
        }
      });

      it("BREAK: planning and materializing a starter is detached from an open project", () => {
        const openProject = createBlankProject();
        openProject.meta.title = "keep me";
        const before = structuredClone(openProject);

        const plan = createGenreBlankProjectSystemPresetPlan("farm-life", "farm-system");
        const starter = createProjectFromGenreBlankProjectSystemPreset(plan);

        expect(openProject).toEqual(before);
        expect(starter).not.toBe(openProject);
        expect(starter.system.genre).toBe("farm-life");
        expect(starter.system.timeSystem?.enabled).toBe(true);
        expect(starter.database.crops).toHaveLength(createBlankProject().database.crops?.length ?? 0);
        expect(starter.maps).toEqual(createBlankProject().maps);
      });

      it("BREAK: welcome choices are honestly blank-project system presets, not authored starters", () => {
        const results = WELCOME_GENRE_PRESETS.map((preset) =>
          materializeGenreBlankProjectSystemPreset(welcomeGenreSystemPresetPlanById(preset.id)),
        );
        const blank = createBlankProject();

        for (const packId of GENRE_PACK_IDS) {
          for (const recipe of genrePackById(packId).recipes) {
            expect(recipe.starterKind).toBe("blank-project-system-preset");
            expect(recipe).not.toHaveProperty("adapterId");
          }
        }
        for (const { project, receipt } of results) {
          expect(receipt.authoredContentSeeded).toBe(false);
          expect(receipt.appliedSystemGenre).toBe(project.system.genre);
          // 몬스터 수집만 손대지 않은 빈 시작 맵을 몬스터 칩셋 풀밭으로 옮긴다(칩셋 계열을 첫 맵에서 정한다).
          if (project.system.genre === "monster-collect") {
            const start = project.maps.map_blank_start!;
            expect(start.tilesetId).toBe("monster_overworld");
            expect(start.lowerTiles.every((tile) => tile === 0)).toBe(true);
            expect({ ...start, tilesetId: blank.maps.map_blank_start!.tilesetId, tileSize: blank.maps.map_blank_start!.tileSize, lowerTiles: blank.maps.map_blank_start!.lowerTiles })
              .toEqual(blank.maps.map_blank_start);
          } else expect(project.maps).toEqual(blank.maps);
          expect(project.database.crops).toEqual(blank.database.crops);
        }
      });

      it("BREAK: Phase 4 imports the five canonical ids; welcome recipe ids are not genre aliases", () => {
        expect(isGenrePackId("horror-chase")).toBe(true);
        expect(isGenrePackId("horror-gallery")).toBe(false);
        expect(isGenrePackId("school-horror")).toBe(false);
        expect(welcomeGenrePresetById("horror-gallery")?.packId).toBe("horror-chase");
        expect(welcomeGenrePresetById("school-horror")?.packId).toBe("horror-chase");
      });
    });
  });
});

describe("editSceneHoverPreview", () => {
  isolateTimers();
  describe("shouldShowPaintHoverPreview", () => {
    it("hides hover while painting so raw palette tiles do not flash over shaped results", () => {
      expect(shouldShowPaintHoverPreview({ isPainting: true, dragActive: false })).toBe(false);
    });

    it("hides hover while a shape/structure drag is active", () => {
      expect(shouldShowPaintHoverPreview({ isPainting: false, dragActive: true })).toBe(false);
    });

    it("shows hover when idle", () => {
      expect(shouldShowPaintHoverPreview({ isPainting: false, dragActive: false })).toBe(true);
    });
  });
});

describe("followerPresets", () => {
  isolateTimers();
  /**
   * 2026-08-10 회귀 가드 — "동행" 프리셋 칩 실수 클릭 사고.
   *
   * 사고: 몬스터 프리셋 칩이 실제 파티 편입 대신 저자용 안내 showMessage 를
   * 이벤트 커맨드로 삽입했고, 저작물(네온의 유언 목격자 이벤트)에 쓰레기 커맨드가 박혔다.
   * 수정: 몬스터 칩 자체를 제거(편입 경로는 도감 → 파티 편입이 유일)하고,
   * 남은 프리셋은 항상 실제 실행 커맨드(addFollower)만 생성한다.
   */
  describe("follower presets (post monster-chip removal)", () => {
    it("buildFollowerPresets never emits monster-kind chips", () => {
      const presets = buildFollowerPresets();
      // FollowerPresetKind 에 "monster" 자체가 없어졌으므로(타입 레벨 제거) 런타임 가드는
      // kind 가 항상 actor|mascot 인지 + 몬스터 id 프리픽스가 없는지로 확인한다.
      for (const p of presets) {
        expect(["actor", "mascot"]).toContain(p.kind);
      }
      expect(presets.some((p) => p.id.startsWith("preset:monster:"))).toBe(false);
    });

    it("keeps the fixed mascot presets and companion actor", () => {
      const presets = buildFollowerPresets();
      const ids = presets.map((p) => p.id);
      expect(ids).toContain("preset:pet-dog");
      expect(ids).toContain("preset:pet-cat");
      expect(ids).toContain("preset:pet-chick");
      expect(ids).toContain("preset:companion-hero");
    });

    it("lists every database actor with portrait metadata", () => {
      const project = createBlankProject();
      const template = project.database.actors[0];
      if (!template) throw new Error("missing default actor fixture");
      const actors = [
        actorFixture(template, "actor-companion-a", "세라", "easyrpg-faceset-actor1", "easyrpg-charset-actor1"),
        actorFixture(template, "actor-companion-b", "루카", "easyrpg-faceset-actor2", "easyrpg-charset-actor2"),
        actorFixture(template, "actor-companion-c", "미나", "easyrpg-faceset-actor3", "easyrpg-charset-actor3"),
        actorFixture(template, "actor-companion-d", "가온", "easyrpg-faceset-actor4", "easyrpg-charset-actor4"),
      ];
      project.database.actors = actors;
      store.replace(project);

      const presets = buildFollowerPresets().filter((preset) => preset.kind === "actor");

      expect(presets.map((preset) => preset.refId)).toEqual(actors.map((actor) => actor.id));
      expect(presets.map((preset) => preset.faceResourceId)).toEqual(actors.map((actor) => actor.faceResourceId));
      expect(presets.map((preset) => preset.characterResourceId)).toEqual(actors.map((actor) => actor.characterResourceId));
    });

    it("mascot preset converts to one addFollower with bundled graphic", () => {
      const presets = buildFollowerPresets();
      const dog = presets.find((p) => p.id === "preset:pet-dog")!;
      const cmds = followerPresetToCommands(dog);
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({ kind: "addFollower", name: dog.displayName });
      const graphic = (cmds[0] as { graphic?: { sprite?: { type?: string; id?: string } } }).graphic;
      expect(graphic?.sprite?.type).toBe("bundled");
      expect(graphic?.sprite?.id).toBeTruthy();
    });

    it("actor preset converts to one addFollower with actorId", () => {
      const presets = buildFollowerPresets();
      const hero = presets.find((p) => p.id === "preset:companion-hero")!;
      const cmds = followerPresetToCommands(hero);
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({ kind: "addFollower", actorId: hero.refId });
    });

    it("never inserts showMessage author guidance for any built preset", () => {
      // 핵심 불변식: 프리셋 칩은 실제 실행 커맨드만 생성한다.
      // 저자용 안내(도감 경로 안내 등)가 게임 콘텐츠로 흘러들어가면 안 된다.
      const presets = buildFollowerPresets();
      expect(presets.length).toBeGreaterThan(0);
      for (const preset of presets) {
        const cmds = followerPresetToCommands(preset);
        expect(cmds.length).toBeGreaterThan(0);
        for (const cmd of cmds) {
          expect((cmd as Command).kind).not.toBe("showMessage");
        }
      }
    });
  });
  function actorFixture(
    template: ActorRecord,
    id: ActorRecord["id"],
    name: string,
    faceResourceId: string,
    characterResourceId: string,
  ): ActorRecord {
    return {
      ...structuredClone(template),
      id,
      name,
      faceResourceId,
      characterResourceId,
      characterIndex: 0,
    };
  }
});

describe("imagePlan", () => {
  isolateTimers();
  describe("imagePlanCells", () => {
    isolateTimers();
    const ring = [
      "________________________",
      "____......____......____",
      "____......====......____",
      "____..A...____......____",
      "_____=__________=_______",
      "_____=___......_=_______",
      "_____=___..BB.._=_______",
      "_____=___......_=_______",
      "_____=__________=_______",
      "____......____......____",
      "____......====......____",
      "____......____......____",
    ];
    describe("imagePlanCells", () => {
      it("sizes the grid at 48 cells on the long side and keeps the aspect", () => {
        expect(cellGridSize(1536, 1024)).toEqual({ cols: 48, rows: 32 });
        expect(cellGridSize(1024, 1536)).toEqual({ cols: 32, rows: 48 });
      });

      it("pads short rows, rejects an almost empty map, and keeps landmarks inside the grid", () => {
        const map = parseCellMap({ cells: ["...", ...ring.slice(1)], landmarks: [{ id: "a", kind: "Altar", x: 99, y: 2, w: 9, h: 1 }] }, "dungeon", 24, 12);
        expect(map?.cells[0]).toBe("...".padEnd(24, "_"));
        expect(map?.landmarks[0]).toMatchObject({ id: "A", kind: "altar", x: 23, w: 1 });
        expect(parseCellMap({ cells: Array(12).fill("_".repeat(24)) }, "dungeon", 24, 12)).toBeNull();
      });

      it("turns a ring of rooms into rooms scaled uniformly with the ring links, island room unlinked", () => {
        const map = parseCellMap({ cells: ring, landmarks: [{ id: "A", kind: "altar", x: 6, y: 3, w: 1, h: 1 }] }, "dungeon", 24, 12)!;
        const plan = dungeonPlanFromCells(map);
        expect(plan.rooms).toHaveLength(5);
        expect(plan.rooms.map((r) => [r.kind, r.x, r.y, r.w, r.h])).toEqual([
          ["entrance", 28, 22, 12, 6], ["boss", 8, 2, 12, 6], ["hall", 28, 2, 12, 6], ["hall", 18, 12, 12, 6], ["hall", 8, 22, 12, 6],
        ]);
        expect(dungeonPlanFromCells(map, 1).rooms[0]).toMatchObject({ x: 14, w: 6, h: 5 });
        expect(plan.links).toHaveLength(4);
      });

      it("splices a fix region and adds a missed landmark once", () => {
        const map = parseCellMap({ cells: ring }, "dungeon", 24, 12)!;
        const { map: fixed, fixed: n } = applyCellFixes(map, { fixes: [{ x: 0, y: 0, rows: ["~~", "~~"] }, { x: 30, y: 0, rows: ["~"] }], landmarks: [{ id: "C", kind: "well", x: 1, y: 1 }] });
        expect(n).toBe(1);
        expect(fixed.cells[1]!.slice(0, 2)).toBe("~~");
        expect(fixed.landmarks.map((l) => l.id)).toEqual(["C"]);
      });

      it("sizes a village map from the plan aspect and carries tiers and water as terrainMap", () => {
        const rows = Array.from({ length: 24 }, (_, y) => (y < 8 ? "2" : y < 16 ? "1" : "0").repeat(30) + "~~" + "0".repeat(16));
        rows[20] = "0".repeat(10) + "hhh" + "0".repeat(35);
        const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "giant_tree", x: 20, y: 3, w: 4, h: 4 }] }, "village", 48, 24)!;
        const args = villageArgsFromCells(map);
        expect([args.width, args.height]).toEqual([56, 32]);
        expect((args.terrainMap as string[])[0]).toBe("2".repeat(30) + "~~" + "0".repeat(16));
        expect((args.terrainMap as string[])[20]).toBe("0".repeat(48));
        expect((args.layout as { landmark: unknown }).landmark).toEqual({ x: 25, y: 6 });
      });

      it("pads short outdoor rows with the row's own ground, not sea", () => {
        const rows = Array.from({ length: 32 }, (_, y) => (y < 20 ? "0".repeat(46) : ""));
        const map = parseCellMap({ cells: rows.slice(0, 20) }, "village", 48, 32)!;
        expect(map.cells[0]).toBe("0".repeat(48));
        expect(map.cells[31]).toBe("0".repeat(48));
        expect((villageArgsFromCells(map).terrainMap as string[]).join("")).not.toContain("_");
      });

      it("does not smear landmark letters when padding short outdoor rows", () => {
        const map = parseCellMap({ cells: Array.from({ length: 20 }, () => "00AAA" + "0".repeat(10)) }, "village", 48, 32)!;
        expect(map.cells[0]!.slice(5)).toBe("0".repeat(43));
        expect(map.cells[25]).not.toContain("A");
        const raised = parseCellMap({ cells: ["2222==2222h", ...Array.from({ length: 19 }, () => "2".repeat(13))] }, "village", 48, 32)!;
        expect(raised.cells[0]!.slice(11)).toBe("2".repeat(37));
        expect(raised.cells[31]).toBe("2".repeat(48));
      });

      it("keeps explicit landmark ids even when an id-less one comes first", () => {
        const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }, { kind: "well", x: 2, y: 2 }, { id: "B", kind: "statue", x: 3, y: 3 }] }, "dungeon", 24, 12)!;
        expect(map.landmarks.map((l) => `${l.id}:${l.kind}`).sort()).toEqual(["A:altar", "B:statue", "C:well"]);
      });

      it("reads a fork joined to the main path and its side", () => {
        for (const [side, toward] of [[14, "right"], [6, "left"]] as const) {
          const rows: string[] = [];
          for (let y = 0; y < 20; y += 1) {
            const r = "t".repeat(24).split(""); r[10] = "="; r[11] = "=";
            if (y >= 4 && y <= 8) { r[side] = "="; r[side + 1] = "="; }
            if (y === 9) for (let x = Math.min(side, 10); x <= Math.max(side + 1, 11); x += 1) r[x] = "=";
            rows.push(r.join(""));
          }
          expect(forestDesignFromCells(parseCellMap({ cells: rows }, "forest", 24, 20)!).branches).toEqual([{ at: 0.58, toward, end: "clearing" }]);
        }
      });

      it("takes the entrance room from an entrance landmark before the bottom edge", () => {
        const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
        const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "statue", label: "입구 석상", x: 15, y: 3 }] }, "dungeon", 24, 16)!;
        const plan = dungeonPlanFromCells(map);
        expect(plan.rooms[0]!.kind).toBe("entrance");
        expect(plan.rooms[0]!.x).toBeGreaterThan(20);
      });

      it("does not take a boss room's gate as the entrance", () => {
        const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
        const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "gate", label: "보스방 입구 문", x: 15, y: 3 }] }, "dungeon", 24, 16)!;
        const plan = dungeonPlanFromCells(map);
        expect(plan.rooms[0]!.y).toBeGreaterThan(20);
      });

      it("does not make the throne room the entrance because its door is labelled an entrance", () => {
        const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
        const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "gate", label: "왕좌의 방 입구", x: 15, y: 3 }, { id: "B", kind: "throne", label: "옥좌", x: 18, y: 2 }] }, "dungeon", 24, 16)!;
        const plan = dungeonPlanFromCells(map);
        expect(plan.rooms[0]!.y).toBeGreaterThan(20);
        expect(plan.rooms.some((r) => r.kind === "boss")).toBe(true);
      });

      it("gives a fix-pass landmark without an id the next free letter", () => {
        const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }] }, "dungeon", 24, 12)!;
        const fixed = applyCellFixes(map, { fixes: [], landmarks: [{ kind: "statue", x: 2, y: 2 }] }).map;
        expect(fixed.landmarks.map((l) => l.id)).toEqual(["A", "B"]);
      });
    });
  });
  describe("imagePlanCheck", () => {
    isolateTimers();
    const els = (marks: string[]) => marks.map((mark, i) => ({ element: `e${i}`, mark, where: `w${i}`, fix: `f${i}` }));
    describe("imagePlanCheck", () => {
      it("scores present + half partial over the element count and drops malformed rows", () => {
        const check = parsePlanFollowCheck({ elements: [...els(["present", "partial", "missing", "present"]), { element: "", mark: "present" }, { element: "x", mark: "maybe" }], layout: "partly" })!;
        expect(check.elements).toHaveLength(4);
        expect(check.score).toBeCloseTo(2.5 / 4);
        expect(parsePlanFollowCheck({ elements: els(["present", "present"]) })).toBeNull();
      });

      it("asks to fix only non-present elements below the bar and nothing at or above it", () => {
        const low = parsePlanFollowCheck({ elements: els(["present", "missing", "partial"]), layout: "partly" })!;
        const fix = planFollowFixRequest(low)!;
        expect(fix).toContain("e1(없음, w1): f1");
        expect(fix).toContain("e2(부분, w2): f2");
        expect(fix).not.toContain("e0(");
        const high = parsePlanFollowCheck({ elements: els(["present", "present", "present", "present", "partial"]), layout: "yes" })!;
        expect(high.score).toBeGreaterThanOrEqual(PLAN_FOLLOW_BAR);
        expect(planFollowFixRequest(high)).toBeNull();
      });

      it("finds the map the turn built", () => {
        const before = createBlankProject();
        const after = structuredClone(before);
        expect(builtMapOf(before, after)).toBeNull();
        const id = after.startMapId!;
        after.maps[id]!.lowerTiles[0] = 7;
        expect(builtMapOf(before, after)?.id).toBe(id);
      });
    });
  });
  // 2026-11-05 imageplan-follow r3: the plan image is there to feed the assistant ideas (owner: 「이미지는 LLM 의 빈곤한 상상력을 극복하는 용도로」).
  // The vision description (must-keeps, landmarks with look and place, mood) rides in the build note next to the light cell map.
  describe("imagePlanDescribe", () => {
    isolateTimers();
    const raw = {
      mustKeep: ["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련", "", 42],
      landmarks: [{ name: "속 빈 고목", look: "검은 입구, 굵은 뿌리", where: "북쪽 가운데" }, { look: "이름 없음" }],
      mood: "안개 낀 어두운 숲, 발광 버섯",
      materials: "이끼 낀 흙길",
    };
    describe("plan description", () => {
      it("keeps named must-keeps and landmarks and drops empty ones", () => {
        const d = parseImagePlanDescription(raw)!;
        expect(d.mustKeep).toEqual(["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련"]);
        expect(d.landmarks.map((l) => l.name)).toEqual(["속 빈 고목"]);
        expect(parseImagePlanDescription({ mood: "only mood" })).toBeNull();
      });

      it("puts the ideas into the build note ahead of the cell map, within the note budget", () => {
        const d = parseImagePlanDescription(raw)!;
        expect(describeNote(d).length).toBeLessThanOrEqual(1600);
        const cells = parseCellMap({ cells: Array.from({ length: 32 }, () => "t".repeat(23) + "==" + "t".repeat(23)) }, "forest", 48, 32)!;
        const note = imagePlanBuildNote({ subject: "forest" } as never, { subject: "forest", cols: 48, rows: 32, data: {}, cells, description: d });
        expect(note.indexOf("속 빈 고목")).toBeGreaterThan(0);
        expect(note.indexOf("속 빈 고목")).toBeLessThan(note.indexOf("author_forest_route"));
        expect(note).toContain("generate_missing_object");
      });

      it("carries the ideas on the point-read and no-layout paths too", () => {
        const d = parseImagePlanDescription(raw)!;
        const village = imagePlanBuildNote({ subject: "village" } as never, { subject: "village", cols: 24, rows: 18, data: { width: 24, height: 18, buildings: [] }, description: d });
        expect(village).toContain("속 빈 고목");
        expect(village).toContain("author_beodeul_town");
        const bare = imagePlanBuildNote({ subject: "dungeon" } as never, { subject: "dungeon", cols: 0, rows: 0, data: {}, description: d });
        expect(bare).toContain("속 빈 고목");
        expect(bare).not.toContain("author_dungeon");
      });

      it("drops landmarks from the end, not the rule or mood line, when the note is too long", () => {
        const long = parseImagePlanDescription({
          mustKeep: Array.from({ length: 8 }, (_, i) => `꼭 살릴 것 ${i} `.padEnd(60, "가")),
          landmarks: Array.from({ length: 10 }, (_, i) => ({ name: `랜드마크${i}`.padEnd(30, "나"), look: "다".repeat(50), where: "라".repeat(30) })),
          mood: "마".repeat(80), materials: "바".repeat(80),
        })!;
        const note = describeNote(long);
        expect(note.length).toBeLessThanOrEqual(1600);
        expect(note).toContain("generate_missing_object");
        expect(note).toContain("분위기·재질");
        expect(note).toContain("랜드마크0");
        expect(note).not.toContain("랜드마크9");
      });
    });
    describe("describe switch", () => {
      const store = new Map<string, string>();
      (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
      afterEach(() => store.clear());

      it("keeps imagePlanDescribe:false through loadAiConfig", () => {
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", imagePlanDescribe: false }));
        expect(loadAiConfig().imagePlanDescribe).toBe(false);
        store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex" }));
        expect(loadAiConfig().imagePlanDescribe).toBeUndefined();
      });
    });
  });
  describe("imagePlanPick", () => {
    isolateTimers();
    const village = (houses: number, extra: Record<string, unknown> = {}): ImagePlanRead => ({
      subject: "village", cols: 24, rows: 18,
      data: { gather: { x: 5, y: 5 }, landmark: { x: 3, y: 2 }, houses: Array.from({ length: houses }, (_, i) => ({ x: i, y: 4 })), ...extra },
    });
    describe("imagePlanPick", () => {
      it("counts builder inputs a read yields and 0 for no read", () => {
        expect(readYield(null)).toBe(0);
        expect(readYield(village(4))).toBe(6);
        expect(readYield({ subject: "dungeon", cols: 24, rows: 16, data: { rooms: [{}, {}, {}], links: [[0, 1], [1, 2]] } })).toBe(5);
      });

      it("parses a judge answer and rejects a missing candidate", () => {
        const ok = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }, { i: 2, elements: 1, setting: "false", clean: true }], reason: "1번이 요소가 다 있다" }, 2);
        expect(ok?.candidates[1]).toEqual({ elements: 1, setting: false, clean: true });
        expect(parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }] }, 2)).toBeNull();
        expect(parsePlanJudge(null, 2)).toBeNull();
      });

      it("prefers the candidate with the right setting and more builder inputs, and flags when the bar is missed", () => {
        const cands = [{ dataUrl: "", read: village(1) }, { dataUrl: "", read: village(5) }];
        const judge = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: false, clean: true }, { i: 2, elements: 3, setting: true, clean: true }], reason: "" }, 2)!;
        const best = pickBest("village", cands, judge);
        expect(best.index).toBe(1);
        expect(best.met).toBe(true);
        const weak = parsePlanJudge({ candidates: [{ i: 1, elements: 1, setting: true, clean: true }, { i: 2, elements: 2, setting: true, clean: true }], reason: "" }, 2)!;
        expect(pickBest("village", cands, weak).met).toBe(false);
        expect(meetsBar("village", village(1), { elements: 5, setting: true, clean: true })).toBe(false);
      });

      it("falls back to the first candidate that reads best when the judge is missing", () => {
        const cands = [{ dataUrl: "", read: null }, { dataUrl: "", read: village(4) }];
        expect(pickBest("village", cands, null).index).toBe(1);
      });
    });
  });
});

describe("interiorObjectCatalog", () => {
  isolateTimers();
  // interiorObjectCatalog.test.ts
  // 실내 오브젝트 카탈로그(선언형 어휘)의 형태 계약 — 셀 좌표·역할 타일·테마 커버리지·id 규약.
  // 렌더러(kitRender)의 셀 규약 {dx,dy,layer,tile}과 구조가 같아야 '구조물' DB 탭이 그대로 그린다.
  describe("interiorObjectCatalog", () => {
    isolateTimers();
    /**
     * 역할 타일 세트 밖이지만 그 오브젝트가 정당하게 선언하는 타일:
     * - bookshelf 3×3의 가운데 열(19/49/79)은 가로로 반복되는 '몸통'.
     * - table_chairs의 의자(297/298)는 사각 탁자 짝 규칙의 동반 타일.
     */
    const DECLARED_COMPANION_TILES: Readonly<Record<string, readonly number[]>> = {
      bookshelf: [19, 49, 79],
      table_chairs: [VR.CHAIR_LEFT, VR.CHAIR_RIGHT],
      study_desk: [VR.STOOL],
      care_bed: [VR.STOOL],
      table_wood: [156,157,158,186,187,188,198,199,200],
      table_white: [159,160,161,189,190,191,228,229,230],
      tea_table: [156,157,158,186,187,188,198,199,200,235,204,297,298],
      reading_table: [156,157,158,186,187,188,198,199,200,145,204,297,298],
      dining_table: [156,157,158,186,187,188,198,199,200,207,238,208,297,298],
      consultation_table: [159,160,161,189,190,191,228,229,230,145,204,297,298],
      altar_table: [159,160,161,189,190,191,228,229,230,204],
      work_table: [156,157,158,186,187,188,198,199,200,261,414],
      teacher_desk: [156,157,158,198,199,200,145],
      // 작은 집 탁자(home_table) — 목재 탁자 위·아래 줄 + 양옆 의자(297·298)·촛대(204)·책(145). 카탈로그에 뒤에 더해진 정의다.
      home_table: [156,157,158,198,199,200,145,204,297,298],
    };
    const cellKey = (cell: { dx: number; dy: number; layer: string }): string =>
      `${cell.dx},${cell.dy},${cell.layer}`;
    describe("INTERIOR_OBJECT_CATALOG 형태 계약", () => {
      it("카탈로그가 비어 있지 않다", () => {
        expect(INTERIOR_OBJECT_CATALOG.length).toBeGreaterThan(0);
      });

      it("모든 정의의 셀이 width×height 격자 안에 중복 없이 들어간다", () => {
        for (const def of INTERIOR_OBJECT_CATALOG) {
          expect(def.cells.length, `${def.id} cells`).toBeGreaterThan(0);
          expect(def.width, `${def.id} width`).toBeGreaterThan(0);
          expect(def.height, `${def.id} height`).toBeGreaterThan(0);
          expect(def.cells.length, `${def.id} 셀 수 ≤ width*height`).toBeLessThanOrEqual(def.width * def.height * 2);
          const seen = new Set<string>();
          for (const cell of def.cells) {
            expect(cell.dx, `${def.id} dx`).toBeGreaterThanOrEqual(0);
            expect(cell.dx, `${def.id} dx`).toBeLessThan(def.width);
            expect(cell.dy, `${def.id} dy`).toBeGreaterThanOrEqual(0);
            expect(cell.dy, `${def.id} dy`).toBeLessThan(def.height);
            expect(cell.tile, `${def.id} tile`).toBeGreaterThanOrEqual(0);
            expect(["lower", "upper"]).toContain(cell.layer);
            const key = cellKey(cell);
            expect(seen.has(key), `${def.id} 중복 셀 ${key}`).toBe(false);
            seen.add(key);
          }
        }
      });

      it("id는 유일하고 소문자+밑줄 규약을 지킨다", () => {
        const ids = INTERIOR_OBJECT_CATALOG.map((def) => def.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
          expect(id.length, `${id} 비어 있지 않은 id`).toBeGreaterThan(0);
          expect(id, `${id} 소문자+밑줄`).toMatch(/^[a-z][a-z0-9_]*$/);
        }
      });

      it("모든 정의에 한국어 라벨과 유효한 스냅·레이어가 있다", () => {
        for (const def of INTERIOR_OBJECT_CATALOG) {
          expect(def.label.trim().length, `${def.id} label`).toBeGreaterThan(0);
          expect(["wall-north", "wall-any", "floor", "free"]).toContain(def.snap);
          expect(["lower", "upper"]).toContain(def.layer);
          for (const theme of def.themes) expect(INTERIOR_ROOM_THEMES).toContain(theme);
        }
      });

      it("role이 있는 정의의 타일은 역할 타일 세트 ∪ 선언된 동반 타일의 부분집합이다", () => {
        for (const def of INTERIOR_OBJECT_CATALOG) {
          if (def.role === null) continue;
          const allowed = new Set<number>([
            ...INTERIOR_SEMANTIC_TILE_CATALOG[def.role].tileIds,
            ...(DECLARED_COMPANION_TILES[def.id] ?? []),
          ]);
          for (const cell of def.cells) {
            expect(allowed.has(cell.tile), `${def.id} 타일 ${cell.tile}이 role=${def.role} 어휘 밖`).toBe(true);
          }
        }
      });

      it("역할별 타일 세트의 모든 타일이 그 역할 오브젝트 어딘가에 등장한다", () => {
        const roles = Object.keys(INTERIOR_SEMANTIC_TILE_CATALOG) as InteriorSemanticTileRole[];
        for (const role of roles) {
          const covered = new Set<number>();
          for (const def of INTERIOR_OBJECT_CATALOG) {
            if (def.role !== role) continue;
            for (const cell of def.cells) covered.add(cell.tile);
          }
          for (const tile of INTERIOR_SEMANTIC_TILE_CATALOG[role].tileIds) {
            expect(covered.has(tile), `role=${role} 타일 ${tile} 미커버`).toBe(true);
          }
        }
      });

      it("requiredRoles가 있는 테마마다 필수 역할 오브젝트가 최소 1개 있다", () => {
        for (const theme of INTERIOR_ROOM_THEMES) {
          const required = INTERIOR_ROOM_THEME_CATALOG[theme].requiredRoles;
          if (required.length === 0) continue;
          const forTheme = interiorObjectsForTheme(theme);
          for (const role of required) {
            const match = forTheme.filter((def: InteriorObjectDef) => def.role === role);
            expect(match.length, `theme=${theme} role=${role} 오브젝트 없음`).toBeGreaterThan(0);
          }
        }
      });

      it("interiorObjectsForTheme는 해당 테마를 선언한 정의만 돌려준다", () => {
        for (const theme of INTERIOR_ROOM_THEMES) {
          for (const def of interiorObjectsForTheme(theme)) {
            expect(def.themes, `${def.id} themes`).toContain(theme);
          }
        }
      });

      it("interiorObjectById는 id로 정의를 찾고 없는 id에는 undefined를 준다", () => {
        for (const def of INTERIOR_OBJECT_CATALOG) {
          expect(interiorObjectById(def.id)).toBe(def);
        }
        expect(interiorObjectById("no_such_object")).toBeUndefined();
      });

      it("파이프라인이 소비하는 다중 타일 세트가 카탈로그에 선언되어 있다", () => {
        const expected: Readonly<Record<string, readonly number[]>> = {
          bed_h: [VR.BED_L, VR.BED_R],
          bed_v: [VR.BED_V_HEAD, VR.BED_V_FOOT],
          stove: [VR.STOVE_TOP, VR.STOVE_BOT],
          table_long: [VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3],
          counter: [VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R],
          piano: [VR.PIANO_L, VR.PIANO_M, VR.PIANO_R],
          bookshelf: [VR.BOOK_TL, 19, VR.BOOK_TR, VR.BOOK_ML, 49, VR.BOOK_MR, VR.BOOK_BL, 79, VR.BOOK_BR],
        };
        for (const [id, tiles] of Object.entries(expected)) {
          const def = interiorObjectById(id);
          expect(def, `${id} 정의 없음`).toBeDefined();
          expect(def!.cells.map((cell) => cell.tile)).toEqual(tiles);
        }
      });
    });
  });
  describe("interiorRoomWalkabilitySeal", () => {
    isolateTimers();
    // 책장(2x3) lower 타일 id — placeBookshelfRow가 setL로 찍는 세트.
    const BOOKSHELF_TILES = new Set(interiorObjectById("bookshelf")!.cells.filter((cell) => cell.layer === "lower").map((cell) => cell.tile));
    // 봉쇄 재현 플랜(측정 RED 스크립트 scripts/tmp-probe-seal.mts와 동일).
    // study 방의 유일 입구 열(innerDoor x=6)에 책장이 놓여 방이 봉쇄된다.
    const SEAL_PLAN: InteriorRoomPlan = {
      mapId: "map_probe_seal_v1", name: "probe", width: 16, height: 22,
      wings: [], door: { x: 8, y: 8 }, theme: "study", seed: 7,
      rooms: [
        { id: "corridor", x: 3, y: 4, w: 10, h: 4, theme: "corridor" },
        { id: "study", x: 3, y: 11, w: 8, h: 6, theme: "study" },
      ],
      innerDoors: [{ x: 6, y: 8 }],
    };
    /**
     * 도달 불가 개방 셀은 평가기(evaluateInteriorRoom)가 파이프라인과 같은 정의로 이미 센다.
     * 테스트가 자체 정의를 다시 쓰면 TILE.EMPTY(-1) 같은 상수를 틀려 '항상 0'인 공허한 단정이 된다
     * (실측: upper !== 0 비교로 개방 셀 0개가 나와 RED에서도 통과했다). 관측자는 평가기로 고정한다.
     */
    function walkabilityIssues(
      map: Parameters<typeof evaluateInteriorRoom>[0],
      plan: InteriorRoomPlan,
    ): { issues: string[]; score: number; unreachableOpenCells: number } {
      const ev = evaluateInteriorRoom(map, plan);
      return {
        issues: ev.issues.filter((s) => /도달 불가/.test(s)),
        score: ev.score,
        unreachableOpenCells: ev.metrics.unreachableOpenCells,
      };
    }
    describe("interior room walkability sealing (entry sentinel / lower multi-tile set repair)", () => {
      it("D1: bookshelf must never sit on an innerDoor entry column, and every open cell stays reachable", () => {
        // 결함 1: paintRoomSpace는 입구 열을 upper ENTRY_SENTINEL로 점유하지만,
        // placeBookshelfRow는 LOWER에 찍으며 upper 센티널을 보지 못해 책장이 입구 열을 덮는다.
        const plan = SEAL_PLAN;
        const built = runInteriorRoomPipeline(plan);
        const map = built.map;
        const w = map.width;
        const at = (x: number, y: number) => map.lowerTiles[y * w + x]!;

        // (a) innerDoor 열 x=6 중 통로 행(11..13) 어디에도 책장 타일이 없어야 한다.
        const bookOnEntry: string[] = [];
        for (let y = plan.innerDoors![0]!.y + 3; y <= plan.innerDoors![0]!.y + 5; y += 1) {
          if (BOOKSHELF_TILES.has(at(plan.innerDoors![0]!.x, y))) bookOnEntry.push(`(${plan.innerDoors![0]!.x},${y})=${at(plan.innerDoors![0]!.x, y)}`);
        }
        expect(bookOnEntry, `책장이 입구 열을 덮음: ${bookOnEntry.join(", ")}`).toEqual([]);

        // (b) 평가기가 세는 '도달 불가 개방 셀'이 0이어야 한다(RED에서는 29개였다).
        const walk = walkabilityIssues(map, plan);
        expect(walk.issues, `평가기 도달 불가 이슈: ${walk.issues.join(" | ")}`).toEqual([]);
        expect(walk.unreachableOpenCells, "평가기 metrics.unreachableOpenCells").toBe(0);
        expect(walk.score, "평가 점수").toBeGreaterThanOrEqual(85);

        // (c) 봉쇄 없이 시공 성공해야 한다.
        expect(built.ok).toBe(true);

        // (d) 수리 불가 경고가 없어야 한다 — 멀티타일 세트가 길을 막으면 안 된다.
        const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
        expect(sealWarnings, `봉쇄 경고: ${sealWarnings.join(" | ")}`).toEqual([]);
      });

      it("D2: no demo plan (and no measured-seal plan) may end unrepaired behind a lower multi-tile set", () => {
        // 결함 2: enforceWalkability는 REMOVABLE_SINGLE_PROPS(getU=upper 단일 소품)만 걷어낸다.
        // LOWER에 찍힌 2x3 세트(책장/스토브/카운터)가 유일한 길을 막으면 되돌릴 수 없어
        // "제거 가능한 소품 없음" 경고와 함께 ok=false로 끝난다.
        const plans: readonly InteriorRoomPlan[] = [...INTERIOR_ROOM_DEMO_PLANS, SEAL_PLAN];
        for (const plan of plans) {
          const built = runInteriorRoomPipeline(plan);
          const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
          expect(sealWarnings, `plan ${plan.mapId}: 봉쇄 경고 ${sealWarnings.join(" | ")}`).toEqual([]);
          expect(built.ok, `plan ${plan.mapId}: ok=false, warnings=${built.warnings.join(" | ")}`).toBe(true);
        }
      });
    });
    it("furnishing another map cannot carry its rollback journal into the next build", () => {
      const first = runInteriorRoomPipeline(SEAL_PLAN);
      runInteriorRoomPipeline(INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "kitchen") ?? INTERIOR_ROOM_DEMO_PLANS[0]!);
      const again = runInteriorRoomPipeline(SEAL_PLAN);
      expect(again.map.lowerTiles).toEqual(first.map.lowerTiles);
      expect(again.map.upperTiles).toEqual(first.map.upperTiles);
      expect(again.warnings).toEqual(first.warnings);
    });
    it("the L-shaped study keeps its eastern pocket open behind the shelf", () => {
      // Before repair this actual pipeline plan had 9 unreachable open cells behind the 2×3 shelf.
      // 지금 파이프라인은 그 자리에 책장을 다시 세우되 주머니(x 11~13, y 9~11)를 막지 않는다 — 옛 「책장 여섯 칸을 바닥으로 되돌린다」 대신
      // 주머니가 바닥으로 열려 있고 닿지 못하는 칸이 없는지를 본다(봉쇄 회귀의 실제 계약).
      const plan = INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "study")!;
      const built = runInteriorRoomPipeline(plan);
      for (let y = 9; y <= 11; y += 1) {
        for (let x = 11; x <= 13; x += 1) {
          expect(built.map.lowerTiles[y * plan.width + x], `pocket cell ${x},${y}`).toBe(VR.FLOOR);
        }
      }
      expect(evaluateInteriorRoom(built.map, plan).metrics.unreachableOpenCells).toBe(0);
      expect(built.warnings.filter((warning) => warning.startsWith("walkability:"))).toEqual([]);
    });
  });
});
