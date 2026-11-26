import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAutotileSheetPick, renderAutotileEditorPanel, renderAutotileLayoutToolbar, resetAutotileComposerState } from "@/editor/panels/tilesetAutotileEditor";
import { createBlankProject, COMBINED_TOWN_TILESET_ID, createBlankMap } from "@/project/defaults";
import { autotileGroupsForTileset, DEFAULT_AUTOTILE_GROUPS, DEFAULT_COBBLE_AUTOTILE_GROUP, templateBlockFromAnchor, TERRAIN_TEMPLATE_ANCHORS } from "@/project/defaults/autotileGroups";
import { DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT, TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { buildAnimatedWaterStrip, buildTemplateGroup, previewTemplateTiles } from "@/editor/panels/tilesetAutotileTemplates";
import { addAutotileGroupFromTemplate } from "@/editor/tilesetActions";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { COBBLE_TILE, CHIPSET_TILE_GROUPS, isSolidChipsetTile, isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { deserialize, serialize } from "@/project/io";
import { animationFrameForTile, animationStripForTile, CHIPSET_ANIMATION_FRAME_TILES } from "@/project/defaults/chipsetAnimation";
import { filledRoleCount, groupPatchFromRoles, inferAutotileLayoutKind, layoutLabel, rolesFromGroup, tilesInLayoutBlock } from "@/editor/panels/tilesetAutotileLayout";
import { isolateTimers } from "./mergedTeardown";
import { beginGridSelectionDrag, cancelGridSelectionDrag, commitGridSelectionDrag, createGridSelectionState, gridSelectionGeometry, selectGridTile, updateGridSelectionDrag } from "@/editor/panels/tilesetGridSelection";
import { resetMapEditHistory, undoMapEdit, getMapEditHistoryEntries, getMapEditHistoryDebugEntries, getMapEditHistoryMarker, getMapEditHistoryState, peekPreviousProject, recordProjectSnapshot, revertToHistoryIndex, revertToHistoryMarker, redoMapEdit } from "@/editor/mapEditHistory";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { activateKnowledgeWorkspace, beginKnowledgeDrag, chooseKnowledgeTemplate, clearKnowledgeSelection, knowledgeDraft, knowledgeSelection, loadKnowledgeGroup, loadKnowledgeProposal, saveKnowledgeDraft, selectKnowledgeTile, updateKnowledgeDraft } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import type { TilesetDef, GameMap, PalettePreset, Project, TileAiMetadata, Command } from "@/project/types";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { proposalSummaryLines } from "@/editor/panels/aiChatPanel";
import { proposalHumanSummaryLine } from "@/editor/panels/aiProposalSummary";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { confidenceScore, confirmUserTileMetadata, tileMetaConfidence, tileMetaLocked, tileMetaOrigin } from "@/project/tilesetPalette";
import { passageGlyph, setChipsetGridEditing } from "@/editor/panels/tilesetChipsetPreview";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { getTilesetPassagePaint, getTilesetSectionTab, setTilesetMetadataEditMode, setTilesetPassagePaint, setTilesetSectionTab } from "@/editor/panels/tilesetMetadataEditor";
import { createEditorModalDirtyCloseController } from "@/editor/panels/editorModalDirtyState";
import { closeTilesetMeaningDialog, closeTilesetTileContextMenu, openTilesetTileContextMenu } from "@/editor/panels/tilesetTileContextMenu";
import { setTileLayerOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { passageMarkForTile, setPassageMark } from "@/project/tilesetPassage";
import { selectEyedropperTool, selectTileTool, setTileBrushSize } from "@/editor/panels/tileToolbar";
import { editorState } from "@/editor/editorState";
import { visibleItemCount } from "@/editor/panels/toolbarOverflow";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { newCommand } from "@/editor/eventActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import { renderTopbar, RETIRED_TOPBAR_CONTROLS } from "@/editor/panels/menu";
import { listEditorCommands } from "@/editor/commandRegistry";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { applyWelcomeGenrePresetToOpenProject } from "@/editor/welcomeGenrePresetApply";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { readCodexEntryFromUrl } from "@/editor/panels/worldEntries";
import { resolveRelationTarget } from "@/editor/panels/worldRelationTarget";
import type { WorldEntity } from "@/project/world/types";

describe("editorPanelsSuite26", () => {
  isolateTimers();
  describe("tilesetAutotileEditor", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
      resetAutotileComposerState();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      resetAutotileComposerState();
    });
    function renderComposer(rerender: () => void): FakeElement {
      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
      const root = document.createElement("div") as unknown as FakeElement;
      (root as unknown as HTMLElement).append(
        renderAutotileLayoutToolbar(tileset, rerender),
        renderAutotileEditorPanel(tileset, rerender),
      );
      return root;
    }
    describe("tileset autotile editor", () => {
      it("기본 Combined Town 내장 오토타일 그룹을 읽기 전용 칩과 격자로 표시한다", () => {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
        const root = renderWithFakeDom(() => renderAutotileEditorPanel(tileset, vi.fn()));

        expect(findByTestId(root, "tileset-autotile-group-builtin_dirt_road")).toBeTruthy();
        expect(findByTestId(root, "tileset-autotile-group-builtin_sand")).toBeTruthy();
        expect(findByTestId(root, "tileset-autotile-builtin-builtin_dirt_road")?.textContent).toContain("내장");
        expect(findByTestId(root, "tileset-autotile-builtin-builtin_sand")?.textContent).toContain("내장");
        expect(findByTestId(root, "tileset-autotile-layout-badge-builtin_dirt_road")?.textContent).toBe("11칸");
        expect(findByTestId(root, "tileset-autotile-slot-builtin_dirt_road-body")).toBeTruthy();
      });

      it("9칸·11칸·커스텀 형식 카드가 보인다", () => {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
        const toolbar = renderWithFakeDom(() => renderAutotileLayoutToolbar(tileset, vi.fn()));
        expect(findByTestId(toolbar, "tileset-autotile-layout-cells-9")).toBeTruthy();
        expect(findByTestId(toolbar, "tileset-autotile-layout-cells-11")).toBeTruthy();
        expect(findByTestId(toolbar, "tileset-autotile-layout-custom")).toBeTruthy();
      });

      it("9칸을 고르고 시트 앵커를 누르면 3×3 그룹이 생긴다", () => {
        let root: FakeElement = renderComposer(() => {
          root = renderComposer(() => {
            root = renderComposer(() => {});
          });
        });
        (findByTestId(root, "tileset-autotile-layout-cells-9") as unknown as HTMLElement).click();
        applyAutotileSheetPick(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!, 33);

        const groups = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!.autotileGroups ?? [];
        const created = groups.find((group) => group.memberTileIds[0] === 33);
        expect(created).toBeTruthy();
        expect(created?.memberTileIds).toHaveLength(9);
        expect(created?.neighborhood).toBe(4);
        expect(created?.memberTileIds).toEqual([
          33, 34, 35,
          33 + DEFAULT_TILES_PER_ROW, 34 + DEFAULT_TILES_PER_ROW, 35 + DEFAULT_TILES_PER_ROW,
          33 + DEFAULT_TILES_PER_ROW * 2, 34 + DEFAULT_TILES_PER_ROW * 2, 35 + DEFAULT_TILES_PER_ROW * 2,
        ]);
      });

      it("커스텀 그룹은 칸을 고른 뒤 시트 타일을 그 역할에 넣는다", () => {
        let root: FakeElement = renderComposer(() => {
          root = renderComposer(() => {
            root = renderComposer(() => {});
          });
        });
        (findByTestId(root, "tileset-autotile-layout-custom") as unknown as HTMLElement).click();
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
        const custom = (tileset.autotileGroups ?? []).find((group) => group.name.includes("커스텀"));
        expect(custom).toBeTruthy();
        applyAutotileSheetPick(tileset, 64);
        const updated = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!.autotileGroups?.find((group) => group.id === custom!.id);
        expect(updated?.memberTileIds).toContain(64);
      });

      it("시트에서 내장 그룹 멤버를 누르면 그 그룹을 선택한다", () => {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
        const dirt = autotileGroupsForTileset(tileset).find((group) => group.id === "builtin_dirt_road");
        expect(dirt?.memberTileIds[0]).toBeDefined();
        applyAutotileSheetPick(tileset, dirt!.memberTileIds[0]!);
        const root = renderWithFakeDom(() => renderAutotileEditorPanel(tileset, vi.fn()));
        expect(findByTestId(root, "tileset-autotile-composer-builtin_dirt_road")).toBeTruthy();
        expect(findByTestId(root, "tileset-autotile-passage-blocked")).toBeTruthy();
      });

      it("격자가 그룹 목록보다 위에 있고 6칸·물이 처음부터 보인다", () => {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]!;
        const panel = renderWithFakeDom(() => renderAutotileEditorPanel(tileset, vi.fn()));
        const toolbar = renderWithFakeDom(() => renderAutotileLayoutToolbar(tileset, vi.fn()));
        const composer = findByTestId(panel, "tileset-autotile-composer-builtin_dirt_road");
        const list = findByTestId(panel, "tileset-autotile-list");
        expect(composer).toBeTruthy();
        expect(list).toBeTruthy();
        const children = (panel as unknown as FakeElement).childNodes as FakeElement[];
        expect(children[0]?.dataset.testid).toBe("tileset-autotile-composer-builtin_dirt_road");
        expect(children[1]?.className).toContain("tileset-autotile-groups");
        expect(findByTestId(toolbar, "tileset-autotile-layout-cells-6")).toBeTruthy();
        expect(findByTestId(toolbar, "tileset-autotile-layout-animated-water")).toBeTruthy();
      });
    });
  });
  describe("tilesetAutotileTemplates", () => {
    isolateTimers();
    describe("autotileTemplates", () => {
      isolateTimers();
      // 오토타일 템플릿 위저드 회귀 테스트 — 순수 계산(buildTemplateGroup)과
      // 커밋 액션(addAutotileGroupFromTemplate)의 내장 폴백 승계/애니 스트립 추가를 고정한다.

      const R = DEFAULT_TILES_PER_ROW;   // 30
      const COUNT = DEFAULT_TILE_COUNT;   // 480
      const { N, E, S, W } = AUTOTILE_DIR;
      function mustBuild(kind: "oprn-3x4" | "grid-3x3" | "grid-3x2", anchor: number) {
        const built = buildTemplateGroup(kind, anchor, R, COUNT);
        if ("error" in built) throw new Error(`템플릿 생성 실패: ${built.error}`);
        return built;
      }
      describe("buildTemplateGroup", () => {
        it("(a) oprn-3x4 앵커 129 → 내장 포석(COBBLE_TILE) 정본과 완전 일치", () => {
          const built = mustBuild("oprn-3x4", 129);
          expect(built.neighborhood).toBe(8);
          // 내장 포석 그룹과 memberTileIds·variantMap 완전 일치(순서 포함).
          expect(built.memberTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
          expect(built.connectTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.connectTileIds);
          expect(built.variantMap).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.variantMap);
          // COBBLE_TILE 상수 기준의 역할 배치도 직접 고정한다(내장 그룹 변경에 대한 이중 잠금).
          expect(built.memberTileIds).toEqual([
            COBBLE_TILE.BODY,
            COBBLE_TILE.EDGE_NORTH,
            COBBLE_TILE.EDGE_SOUTH,
            COBBLE_TILE.EDGE_WEST,
            COBBLE_TILE.EDGE_EAST,
            COBBLE_TILE.CORNER_NORTH_WEST,
            COBBLE_TILE.CORNER_NORTH_EAST,
            COBBLE_TILE.CORNER_SOUTH_WEST,
            COBBLE_TILE.CORNER_SOUTH_EAST,
            COBBLE_TILE.ISOLATED,
            COBBLE_TILE.INNER_CORNER,
          ]);
          expect(Object.keys(built.variantMap)).toHaveLength(256);
          expect(built.variantMap[String(0)]).toBe(COBBLE_TILE.ISOLATED);
          expect(built.variantMap[String(255)]).toBe(COBBLE_TILE.BODY);
          expect(built.variantMap[String(N | E | S | W)]).toBe(COBBLE_TILE.INNER_CORNER);
        });

        it("(b) grid-3x3: 앵커부터 row-major 9타일이 모서리/변/몸통으로 매핑된다", () => {
          const T = 33;
          const built = mustBuild("grid-3x3", T);
          expect(built.neighborhood).toBe(4);
          expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2, T + 2 * R, T + 2 * R + 1, T + 2 * R + 2]);
          expect(built.connectTileIds).toEqual(built.memberTileIds);
          expect(Object.keys(built.variantMap)).toHaveLength(16);
          expect(built.variantMap[String(N | E | S | W)]).toBe(T + R + 1); // 몸통
          expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // 북 변
          expect(built.variantMap[String(N | E | W)]).toBe(T + 2 * R + 1); // 남 변
          expect(built.variantMap[String(N | E | S)]).toBe(T + R); // 서 변
          expect(built.variantMap[String(N | S | W)]).toBe(T + R + 2); // 동 변
          expect(built.variantMap[String(E | S)]).toBe(T); // 북서 모서리
          expect(built.variantMap[String(S | W)]).toBe(T + 2); // 북동 모서리
          expect(built.variantMap[String(N | E)]).toBe(T + 2 * R); // 남서 모서리
          expect(built.variantMap[String(N | W)]).toBe(T + 2 * R + 2); // 남동 모서리
          expect(built.variantMap[String(0)]).toBe(T); // 이웃 전무 → 북서 모서리(엔진 판정 순서)
        });

        it("(c) grid-3x2: 없는 역할이 최근접(edgeW←cornerNW, edgeE←cornerNE, body←edgeN)으로 접힌다", () => {
          const T = 40;
          const built = mustBuild("grid-3x2", T);
          expect(built.neighborhood).toBe(4);
          expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2]);
          expect(Object.keys(built.variantMap)).toHaveLength(16);
          expect(built.variantMap[String(N | E | S | W)]).toBe(T + 1); // body ← edgeN
          expect(built.variantMap[String(N | E | S)]).toBe(T); // edgeW ← cornerNW
          expect(built.variantMap[String(N | S | W)]).toBe(T + 2); // edgeE ← cornerNE
          expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // edgeN (원본)
          expect(built.variantMap[String(N | E | W)]).toBe(T + R + 1); // edgeS (하단 행)
          expect(built.variantMap[String(E | S)]).toBe(T); // cornerNW
          expect(built.variantMap[String(N | W)]).toBe(T + R + 2); // cornerSE
        });

        it("(d) 시트 범위/행 넘침/음수 앵커는 한국어 오류를 반환한다", () => {
          // 마지막 타일(450+3R+2=542)이 count(480)를 초과.
          const overflow = buildTemplateGroup("oprn-3x4", 450, R, COUNT);
          expect("error" in overflow && overflow.error).toMatch(/시트 범위/);
          // 앵커 열 28 → 열+2 가 행(30)을 넘침.
          const rowOverflow = buildTemplateGroup("grid-3x3", 28, R, COUNT);
          expect("error" in rowOverflow && rowOverflow.error).toMatch(/넘칩니다/);
          const negative = buildTemplateGroup("grid-3x2", -1, R, COUNT);
          expect("error" in negative && negative.error).toMatch(/0 이상의 정수/);
          // 미리보기도 같은 검증을 공유한다.
          const preview = previewTemplateTiles("animated-water", 478, R, COUNT);
          expect("error" in preview).toBe(true);
        });
      });
      describe("addAutotileGroupFromTemplate", () => {
        beforeEach(() => {
          // 합본 마을 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다 — 그 칩셋이 남은 옛 저장본을 재현한다.
          store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        });

        it("(e) 첫 커스텀 그룹 추가 시 내장 그룹(흙길/모래/포석/경작지)이 승계되어 살아남는다", () => {
          const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "grid-3x3", 33);
          expect(outcome.ok).toBe(true);
          const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
          const ids = (tileset.autotileGroups ?? []).map((group) => group.id);
          expect(ids).toContain("builtin_dirt_road");
          expect(ids).toContain("builtin_sand");
          expect(ids).toContain("builtin_cobble");
          expect(ids).toContain("builtin_farmland");
          expect(outcome.ok && outcome.groupId !== undefined && ids.includes(outcome.groupId)).toBe(true);
          // 유효 그룹 뷰에서도 내장 흙길이 죽지 않는다(폴백 승계 규약 — rmTypeExpander.ts 선례).
          const effective = autotileGroupsForTileset(tileset);
          expect(effective.some((group) => group.id === "builtin_dirt_road")).toBe(true);
          // 커스텀 1개 + 승계된 내장 전체 (내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조).
          expect(effective).toHaveLength(1 + DEFAULT_AUTOTILE_GROUPS.length);
        });

        it("(e-2) 검증 실패 시 프로젝트를 변경하지 않는다", () => {
          const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "oprn-3x4", 450);
          expect(outcome.ok).toBe(false);
          expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID].autotileGroups).toBeUndefined();
        });

        it("(f) animated-water 는 그룹 대신 animationStrips 를 추가하고 직렬화 왕복이 보존된다", () => {
          const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "animated-water", 120);
          expect(outcome.ok).toBe(true);
          expect(outcome.ok && outcome.groupId).toBeUndefined();
          const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
          expect(tileset.animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);
          expect(tileset.autotileGroups).toBeUndefined();

          const restored = deserialize(serialize(store.getCurrent()));
          expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);

          // 순수 함수 계약: 행 넘침 검증 공유.
          const invalid = buildAnimatedWaterStrip(29, R, COUNT);
          expect("error" in invalid).toBe(true);
        });
      });
    });
    describe("builtinAutotileGroups", () => {
      isolateTimers();
      // 2026-07-17 지형 템플릿 앵커 격자 정본화(4행 밴드 × 열 0/3/6/9) 회귀 테스트.
      // openwiki/autotiles.md 의 앵커 카탈로그 표는 TERRAIN_TEMPLATE_ANCHORS 상수와 이 테스트가 보증한다.

      describe("지형 템플릿 앵커 카탈로그", () => {
        it("kind=group 앵커는 전부 내장 그룹으로 등록되어 있고, variantMap 고립(0) 출력이 앵커와 일치한다", () => {
          for (const entry of TERRAIN_TEMPLATE_ANCHORS) {
            if (entry.kind !== "group") continue;
            const group = DEFAULT_AUTOTILE_GROUPS.find((candidate) => candidate.id === entry.groupId);
            expect(group, `${entry.label}(앵커 ${entry.anchor}) 그룹 미등록`).toBeDefined();
            expect(group?.variantMap["0"], `${entry.label} 고립 출력`).toBe(entry.anchor);
          }
        });

        it("잔디 앵커 240은 기본 바닥(TILE.GRASS)이라 성형 그룹으로 승격하지 않는다", () => {
          expect(TILE.GRASS).toBe(240);
          const grassEntry = TERRAIN_TEMPLATE_ANCHORS.find((entry) => entry.anchor === 240);
          expect(grassEntry?.kind).toBe("base");
          for (const group of DEFAULT_AUTOTILE_GROUPS) {
            expect(group.memberTileIds, `${group.id} 가 기본 잔디 240 을 멤버로 가짐`).not.toContain(240);
          }
        });

        it("내장 그룹들의 memberTileIds 는 서로 겹치지 않는다", () => {
          const seen = new Map<number, string>();
          for (const group of DEFAULT_AUTOTILE_GROUPS) {
            for (const tileId of new Set(group.memberTileIds)) {
              const owner = seen.get(tileId);
              expect(owner, `타일 ${tileId} 이 ${owner} 와 ${group.id} 양쪽 멤버`).toBeUndefined();
              seen.set(tileId, group.id);
            }
          }
        });

        it("신규 7종 블록은 위저드 oprn-3x4 템플릿과 완전히 같은 그룹을 만든다 (공식 상호 대조)", () => {
          const anchors = [6, 9, 243, 246, 249, 366, 369];
          for (const anchor of anchors) {
            const entry = TERRAIN_TEMPLATE_ANCHORS.find((candidate) => candidate.anchor === anchor);
            const builtin = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === entry?.groupId);
            const template = buildTemplateGroup("oprn-3x4", anchor, DEFAULT_TILES_PER_ROW, 480);
            expect(builtin).toBeDefined();
            if (!builtin || "error" in template) throw new Error(`앵커 ${anchor} 템플릿 생성 실패`);
            expect(new Set(builtin.memberTileIds)).toEqual(new Set(template.memberTileIds));
            expect(builtin.variantMap).toEqual(template.variantMap);
          }
        });

        it("templateBlockFromAnchor 공식은 포석 정본(129 블록)과 일치한다", () => {
          const block = templateBlockFromAnchor(129);
          expect(block).toEqual({
            isolated: 129, inner: 131,
            cornerNW: 159, edgeN: 160, cornerNE: 161,
            edgeW: 189, body: 190, edgeE: 191,
            cornerSW: 219, edgeS: 220, cornerSE: 221,
          });
        });

        it("키큰 풀 NW/SW 모서리(273/333)는 잔디가 아니라 키큰 풀 소속이다", () => {
          expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(273);
          expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(333);
          const tallGrassGroup = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === "builtin_tall_grass");
          expect(tallGrassGroup?.memberTileIds).toContain(273);
          expect(tallGrassGroup?.memberTileIds).toContain(333);
        });
      });
      describe("얇은 런(폭/높이 1칸) 쿼터 합성 — 신규 그룹도 절반 합성을 받는다", () => {
        const GRASS = 240;
        const makeMap = (rows: number[][]): { width: number; height: number; lowerTiles: number[] } => ({
          width: rows[0]?.length ?? 0,
          height: rows.length,
          lowerTiles: rows.flat(),
        });
        const quarterMap = (sources: readonly { quarter: string; tile: number }[]): Record<string, number> =>
          Object.fromEntries(sources.map((source) => [source.quarter, source.tile]));

        it("포석 3×1 가로 런: 가운데 = N변 윗절반 + S변 아랫절반", async () => {
          const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
          // 저장 타일: [코너NW 159, 변N 160, 코너NE 161] — variantMap 이 실제로 저장하는 값.
          const map = makeMap([
            [GRASS, GRASS, GRASS, GRASS, GRASS],
            [GRASS, 159, 160, 161, GRASS],
            [GRASS, GRASS, GRASS, GRASS, GRASS],
          ]);
          const middle = terrainQuarterSources(map, 2, 1);
          expect(middle).not.toBeNull();
          expect(quarterMap(middle!)).toEqual({ nw: 160, ne: 160, sw: 220, se: 220 });
        });

        it("포석 3×1 왼쪽 끝 캡: 코너 열 절반(159/219) + 변 열 절반(160/220)", async () => {
          const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
          const map = makeMap([
            [GRASS, GRASS, GRASS, GRASS, GRASS],
            [GRASS, 159, 160, 161, GRASS],
            [GRASS, GRASS, GRASS, GRASS, GRASS],
          ]);
          const leftCap = terrainQuarterSources(map, 1, 1);
          expect(quarterMap(leftCap!)).toEqual({ nw: 159, ne: 160, sw: 219, se: 220 });
          const rightCap = terrainQuarterSources(map, 3, 1);
          expect(quarterMap(rightCap!)).toEqual({ nw: 160, ne: 161, sw: 220, se: 221 });
        });

        it("포석 1×3 세로 런: 가운데 = W변 왼절반 + E변 오른절반", async () => {
          const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
          const map = makeMap([
            [GRASS, 159, GRASS],
            [GRASS, 189, GRASS],
            [GRASS, 219, GRASS],
          ]);
          const middle = terrainQuarterSources(map, 1, 1);
          expect(quarterMap(middle!)).toEqual({ nw: 189, ne: 191, sw: 189, se: 191 });
        });

        it("2칸 폭 이상 몸통은 합성 불필요(null) — 기존 통짜 렌더 유지", async () => {
          const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
          const body = 190;
          const map = makeMap([
            [body, body, body],
            [body, body, body],
            [body, body, body],
          ]);
          expect(terrainQuarterSources(map, 1, 1)).toBeNull();
        });

        it("눈·어둠 등 신규 그룹 대상 타일도 쿼터 합성 대상으로 등록되어 있다", async () => {
          const { isTerrainQuarterTile } = await import("@/project/defaults/terrainQuarterAutotile");
          // 눈 변N 37, 어둠 변N 397, 키큰 풀 몸통 304, 석축 단 몸통 307/310, 경작지 변S 217.
          for (const tile of [37, 397, 304, 307, 310, 217]) {
            expect(isTerrainQuarterTile(tile), `타일 ${tile}`).toBe(true);
          }
          // 외딴 아트(129·6·243 등)는 통짜 렌더 유지 — target 제외.
          for (const tile of [129, 6, 243]) {
            expect(isTerrainQuarterTile(tile), `외딴 ${tile}`).toBe(false);
          }
        });
      });
      describe("석축 수로(관개수로) 애니메이션 배선", () => {
        it("3·33·63 기준 3프레임 스트립이 등록되어 있다", () => {
          for (const base of [3, 33, 63]) {
            const strip = animationStripForTile(base);
            expect(strip?.frames).toEqual([base, base + 1, base + 2]);
            expect(animationFrameForTile(base, 0)).toBe(base);
            expect(animationFrameForTile(base, 400)).toBe(base + 1);
            expect(animationFrameForTile(base, 700)).toBe(base + 2);
          }
        });

        it("수로 프레임 9칸은 물로 분류되어 통행 불가다", () => {
          for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65]) {
            expect(CHIPSET_ANIMATION_FRAME_TILES, `타일 ${tile} 애니 프레임 누락`).toContain(tile);
            expect(isWaterChipsetTile(tile), `타일 ${tile} 물 분류 누락`).toBe(true);
            expect(isSolidChipsetTile(tile), `타일 ${tile} 통행 차단 누락`).toBe(true);
          }
        });

        it("수로는 호수와 같은 쿼터 물 시스템의 석축 스킨이다 (2026-07-17 정본)", async () => {
          const { isLakeAutotileTile, lakeAutotileQuarterSources, CANAL_AUTOTILE_TILE } = await import("@/project/defaults/lakeAutotile");
          // 수로 프레임 전부(오목 93 포함) 쿼터 렌더 대상.
          for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65, 93, 94, 95]) {
            expect(isLakeAutotileTile(tile), `수로 프레임 ${tile}`).toBe(true);
          }
          // 5×5 수로 풀(전부 마커 3 저장): 중앙=몸통 120, 모서리 셀 nw 쿼터=볼록 3,
          // 상변 중앙 셀의 상단 쿼터=가로 변 63, 좌변 중앙 셀의 좌측 쿼터=세로 변 33.
          const size = 7;
          const lower = new Array<number>(size * size).fill(240);
          for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) lower[y * size + x] = 3;
          const map = { width: size, height: size, lowerTiles: lower };
          const center = lakeAutotileQuarterSources(map, 3, 3);
          expect(center.every((part) => part.tile === CANAL_AUTOTILE_TILE.BODY)).toBe(true);
          const cornerNW = lakeAutotileQuarterSources(map, 1, 1).find((part) => part.quarter === "nw");
          expect(cornerNW?.tile).toBe(CANAL_AUTOTILE_TILE.OUTER_CORNER);
          const topMid = lakeAutotileQuarterSources(map, 3, 1).find((part) => part.quarter === "nw");
          expect(topMid?.tile).toBe(CANAL_AUTOTILE_TILE.EDGE_NORTH);
          const leftMid = lakeAutotileQuarterSources(map, 1, 3).find((part) => part.quarter === "nw");
          expect(leftMid?.tile).toBe(CANAL_AUTOTILE_TILE.EDGE_WEST);
          // L자 오목: (1..5,1..5)에 (6..?, ...) 없음 — 대각만 땅인 지점을 만들기 위해 모서리 셀 검사:
          // 풀 안쪽 셀 (2,2)의 nw 쿼터는 직교 물·대각 물 → 몸통. 오목은 (1,1) 대각 이웃이 땅인 (2,2)가 아니라
          // 프레임 꺾임에서 나온다 — L자: (5,5) 밖 (6,6)이 땅이므로 (5,5) se 쿼터는 볼록이 아닌 코너 검사로 대체.
          const seCorner = lakeAutotileQuarterSources(map, 5, 5).find((part) => part.quarter === "se");
          expect(seCorner?.tile).toBe(CANAL_AUTOTILE_TILE.OUTER_CORNER);
          // 오목(93): 5×5에 (6,3)~(6,5) 확장 → (5,2)의 se 쿼터: 직교 물(동=6..아님)… 간단히 L자 풀로:
          const lower2 = new Array<number>(size * size).fill(240);
          for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 3; x += 1) lower2[y * size + x] = 3;
          for (let y = 3; y <= 5; y += 1) for (let x = 4; x <= 6; x += 1) lower2[y * size + x] = 3;
          const mapL = { width: size, height: size, lowerTiles: lower2 };
          // 오목 지점: (3,2)의 se 쿼터 — 동(4,2)=땅? (4,2)는 풀 밖(y=2,x=4 → lower2[2*7+4]=240) ✓,
          // 남(3,3)=물, 동(4,2)=땅 → se 쿼터는 세로 변. 진짜 오목은 (4,3)의 nw: 북(4,2)=땅? 직교(서(3,3)=물, 북(4,2)=땅)…
          // 오목 = 직교 둘 다 물 + 대각만 땅: (3,3)의 ne 쿼터 — 북(3,2)=물, 동(4,3)=물, 대각(4,2)=땅 → INNER ✓
          const innerNE = lakeAutotileQuarterSources(mapL, 3, 3).find((part) => part.quarter === "ne");
          expect(innerNE?.tile).toBe(CANAL_AUTOTILE_TILE.INNER_CORNER);
        });
      });
    });
    describe("tilesetAutotileLayout", () => {
      isolateTimers();
      describe("autotile layout helpers", () => {
        it("내장 포석은 11칸으로 읽힌다", () => {
          expect(inferAutotileLayoutKind(DEFAULT_COBBLE_AUTOTILE_GROUP)).toBe("cells-11");
          expect(layoutLabel("cells-11")).toBe("11칸");
          const roles = rolesFromGroup(DEFAULT_COBBLE_AUTOTILE_GROUP);
          expect(roles.body).toBeDefined();
          expect(roles.isolated).toBeDefined();
          expect(filledRoleCount("cells-11", roles).filled).toBe(11);
        });

        it("3×3 템플릿은 9칸 패치로 다시 만들 수 있다", () => {
          const built = buildTemplateGroup("grid-3x3", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT);
          if ("error" in built) throw new Error(built.error);
          const group = { id: "t", ...built };
          expect(inferAutotileLayoutKind(group)).toBe("cells-9");
          const roles = rolesFromGroup(group);
          const patch = groupPatchFromRoles("cells-9", roles);
          expect(patch?.memberTileIds).toEqual(built.memberTileIds);
          expect(Object.keys(patch?.variantMap ?? {})).toHaveLength(16);
        });

        it("9칸 호버 블록은 앵커에서 3×3 인덱스를 만든다", () => {
          expect(tilesInLayoutBlock("cells-9", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT)).toEqual([
            33, 34, 35,
            33 + DEFAULT_TILES_PER_ROW, 34 + DEFAULT_TILES_PER_ROW, 35 + DEFAULT_TILES_PER_ROW,
            33 + DEFAULT_TILES_PER_ROW * 2, 34 + DEFAULT_TILES_PER_ROW * 2, 35 + DEFAULT_TILES_PER_ROW * 2,
          ]);
        });
      });
    });
  });
  describe("tilesetGridSelection", () => {
    isolateTimers();
    describe("tileset grid selection", () => {
      const spec = { tileCount: 100, tilesPerRow: 10 };

      it("selects a row-major rectangle for forward and reverse drags", () => {
        const initial = createGridSelectionState();
        const forward = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(initial, 11, {}), { spec, tile: 23 }));
        const reverse = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(initial, 23, {}), { spec, tile: 11 }));

        expect(forward.selected).toEqual([11, 12, 13, 21, 22, 23]);
        expect(reverse.selected).toEqual(forward.selected);
        expect(gridSelectionGeometry(forward.selected, spec)).toEqual({
          height: 2,
          rectangular: true,
          tileIds: [11, 12, 13, 21, 22, 23],
          width: 3,
          x: 1,
          y: 1,
        });
      });

      it("supports toggle, additive rectangle, and stable shift anchor", () => {
        const single = selectGridTile(createGridSelectionState(), { modifiers: {}, spec, tile: 11 });
        const toggled = selectGridTile(single, { modifiers: { additive: true }, spec, tile: 12 });
        const added = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(toggled, 20, { additive: true }), { spec, tile: 21 }));
        const ranged = selectGridTile(added, { modifiers: { range: true }, spec, tile: 23 });

        expect(toggled.selected).toEqual([11, 12]);
        expect(added.selected).toEqual([11, 12, 20, 21]);
        expect(ranged.selected).toEqual([11, 12, 13, 21, 22, 23]);
      });

      it("cancels a transient drag without changing the committed selection", () => {
        const selected = selectGridTile(createGridSelectionState(), { modifiers: {}, spec, tile: 7 });
        const dragging = updateGridSelectionDrag(beginGridSelectionDrag(selected, 20, {}), { spec, tile: 32 });

        expect(cancelGridSelectionDrag(dragging)).toEqual(selected);
      });
    });
  });
  describe("tilesetKnowledgeWorkspace", () => {
    isolateTimers();
    class TestMouseEvent extends Event {
      readonly ctrlKey: boolean;
      readonly metaKey: boolean;
      readonly shiftKey: boolean;

      constructor(type: string, init: { readonly ctrlKey?: boolean; readonly shiftKey?: boolean } = {}) {
        super(type);
        this.ctrlKey = init.ctrlKey ?? false;
        this.metaKey = false;
        this.shiftKey = init.shiftKey ?? false;
      }
    }
    class TestPointerEvent extends TestMouseEvent {}
    let cleanupDom: (() => void) | null = null;
    let previousMouseEvent: typeof MouseEvent | undefined;
    let previousPointerEvent: typeof PointerEvent | undefined;
    let tilesetId = "";
    function currentTileset(): TilesetDef {
      const tileset = store.getCurrent().tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset");
      return tileset;
    }
    function selectRectangle(tileset: TilesetDef, start: number, end: number): void {
      selectKnowledgeTile(tileset, start, new MouseEvent("click"));
      selectKnowledgeTile(tileset, end, new MouseEvent("click", { shiftKey: true }));
    }
    describe("tileset knowledge workspace", () => {
      beforeEach(() => {
        cleanupDom = installFakeDom();
        previousMouseEvent = globalThis.MouseEvent;
        previousPointerEvent = globalThis.PointerEvent;
        Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: TestMouseEvent });
        Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: TestPointerEvent });
        store.replace(createBlankProject());
        resetMapEditHistory();
        tilesetId = Object.keys(store.getCurrent().tilesets)[0] ?? "";
        activateKnowledgeWorkspace(currentTileset());
        clearKnowledgeSelection();
        updateKnowledgeDraft({ activeGroupId: null, cellLayers: null, description: "", name: "", placementRules: "" });
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = null;
        if (previousMouseEvent === undefined) Reflect.deleteProperty(globalThis, "MouseEvent");
        else Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: previousMouseEvent });
        if (previousPointerEvent === undefined) Reflect.deleteProperty(globalThis, "PointerEvent");
        else Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: previousPointerEvent });
      });

      it("renders named templates and an accessible selection summary", () => {
        const panel = renderTileGroupPanel(currentTileset(), () => undefined) as unknown as FakeElement;

        expect(findByTestId(panel, "tileset-knowledge-inspector")).not.toBeNull();
        expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
        expect(findByTestId(panel, "tileset-knowledge-template-water-atlas-9x9")).not.toBeNull();
        expect(findByTestId(panel, "tileset-knowledge-template-repeatable-cliff-2x3")).not.toBeNull();
        expect(findByTestId(panel, "tileset-knowledge-selection-summary")?.textContent).toContain("타일");
      });

      it("saves and updates a 2x3 repeatable cliff under one stable group id", () => {
        const tileset = currentTileset();
        selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 1);
        chooseKnowledgeTemplate("repeatable-cliff-2x3");
        updateKnowledgeDraft({ name: "북쪽 절벽" });

        expect(saveKnowledgeDraft(tileset)).toBe(true);
        const saved = currentTileset().tileGroups?.find((group) => group.name === "북쪽 절벽");
        expect(saved?.patternGrammar?.kind).toBe("repeatable_block");
        expect(saved?.patternGrammar?.blockWidth).toBe(2);
        expect(saved?.patternGrammar?.blockHeight).toBe(3);
        expect(saved?.tileIds).toEqual([0, 1, tileset.tilesPerRow, tileset.tilesPerRow + 1, tileset.tilesPerRow * 2, (tileset.tilesPerRow * 2) + 1]);

        if (!saved) throw new Error("missing saved group");
        resetMapEditHistory();
        loadKnowledgeGroup(saved, currentTileset());
        updateKnowledgeDraft({ name: "북쪽 절벽 수정" });
        expect(saveKnowledgeDraft(currentTileset())).toBe(true);
        expect(currentTileset().tileGroups?.filter((group) => group.id === saved.id)).toHaveLength(1);
        expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽 수정");
        expect(undoMapEdit()).toBe(true);
        expect(currentTileset().tileGroups?.find((group) => group.id === saved.id)?.name).toBe("북쪽 절벽");
      });

      it("persists directional passage and registers a real 3x3 autotile", () => {
        const tileset = currentTileset();
        selectRectangle(tileset, 0, (tileset.tilesPerRow * 2) + 2);
        chooseKnowledgeTemplate("one-way-path");
        updateKnowledgeDraft({
          name: "아래로만 가는 길",
          passage: { down: true, left: false, right: false, up: false },
        });

        expect(saveKnowledgeDraft(tileset)).toBe(true);
        const saved = currentTileset().tileGroups?.find((group) => group.name === "아래로만 가는 길");
        expect(saved).toBeDefined();
        expect(currentTileset().passability[0]).toEqual({ down: true, left: false, right: false, up: false });
        const autotile = currentTileset().autotileGroups?.find((group) => group.id === saved?.id);
        expect(autotile?.neighborhood).toBe(8);
        expect(Object.keys(autotile?.variantMap ?? {})).toHaveLength(256);
      });

      it("keeps per-cell layers paired with their tile when loading knowledge", () => {
        const tileset = currentTileset();
        loadKnowledgeGroup({
          cellLayers: ["upper", "lower"],
          defaultLayer: "mixed",
          description: "Two cells",
          id: "layer-pair",
          layerHome: "perCell",
          name: "Layer pair",
          origin: "user",
          placementRules: "Keep pairing",
          role: "prop",
          source: "user",
          tileIds: [5, 4],
        }, tileset);

        expect(knowledgeSelection().selected).toEqual([4, 5]);
        expect(knowledgeDraft().cellLayers).toEqual(["lower", "upper"]);
      });

      it("clears per-cell layers when a same-sized selection moves to another tile", () => {
        const tileset = currentTileset();
        loadKnowledgeProposal({
          cellLayers: ["upper"],
          description: "Canopy",
          name: "Single cell",
          passage: { down: false, left: false, right: false, up: false },
          placementRules: "Upper only",
          template: "tree",
          tileIds: [4],
        });

        beginKnowledgeDrag(tileset, 5, new PointerEvent("pointerdown"));

        expect(knowledgeSelection().selected).toEqual([5]);
        expect(knowledgeDraft().cellLayers).toBeNull();
      });
    });
  });
});

describe("editorPanelsSuite27", () => {
  isolateTimers();
  describe("tilesetPaletteT1a", () => {
    isolateTimers();
    const EMPTY = TILE.EMPTY;
    function roundTrip(project: Project): Project {
      return deserialize(serialize(project));
    }
    function projectWithGrid(width: number, height: number, lower: readonly number[]): Project {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.width = width;
      map.height = height;
      map.lowerTiles = [...lower];
      map.upperTiles = new Array(width * height).fill(EMPTY);
      project.startPos = { x: 0, y: 0 };
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      ensureMeta(tileset);
      setPassable(tileset, lower[0] ?? 0, true);
      return project;
    }
    function ensureMeta(tileset: TilesetDef): TileAiMetadata[] {
      tileset.tileMeta = Array.from({ length: tileset.count }, (_, tile) => tileset.tileMeta?.[tile] ?? { label: "", description: "" });
      return tileset.tileMeta;
    }
    function startTileset(project: Project): TilesetDef {
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      return tileset;
    }
    function setPassable(tileset: TilesetDef, tile: number, passable: boolean): void {
      tileset.passability[tile] = { up: passable, down: passable, left: passable, right: passable };
      tileset.priority[tile] = "lower";
    }
    function preset(patch: Partial<PalettePreset> = {}): PalettePreset {
      return {
        id: "pp_village",
        name: "Forest Village",
        origin: "ai",
        slots: [
          { role: "ground", tileIds: [1, 2] },
          { role: "path", tileIds: [3] },
          { role: "wall", tileIds: [4] },
        ],
        ...patch,
      };
    }
    function contextWithMap(width = 18, height = 18, onRetiredCombinedTown = false): { readonly ctx: ToolContext; readonly mapId: string; readonly tileset: TilesetDef } {
      const ctx: ToolContext = { project: onRetiredCombinedTown ? withRetiredEasyRpgTilesets(createBlankProject()) : createBlankProject() };
      const created = runTool(ctx, "create_map", {
        id: "map_palette_t1a", name: "Palette T1a", width, height,
        ...(onRetiredCombinedTown ? { tilesetId: COMBINED_TOWN_TILESET_ID } : {}),
      });
      expect(created.ok, created.summary).toBe(true);
      const map = ctx.project.maps.map_palette_t1a;
      if (!map) throw new Error("missing test map");
      const tileset = ctx.project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      ensureMeta(tileset);
      return { ctx, mapId: map.id, tileset };
    }
    function mapOf(ctx: ToolContext, mapId: string): GameMap {
      const map = ctx.project.maps[mapId];
      if (!map) throw new Error(`missing map ${mapId}`);
      return map;
    }
    function expectOk(result: ToolResult): void {
      expect(result.ok, result.summary).toBe(true);
    }
    function dataRecord<T>(result: ToolResult): T {
      if (!result.data || typeof result.data !== "object") throw new Error(`missing data: ${result.summary}`);
      return result.data as T;
    }
    function addToolPreset(tileset: TilesetDef, slots: PalettePreset["slots"]): void {
      tileset.palettePresets = [{ id: "pp_tools", name: "Tool Preset", origin: "ai", slots }];
    }
    describe("tileset palette T1a data model and guards", () => {
      it("normalizes confidence and compatibility provenance without changing legacy semantics", () => {
        expect(confidenceScore(0.42)).toBe(0.42);
        expect(confidenceScore("high")).toBe(1);
        expect(confidenceScore("medium")).toBe(0.65);
        expect(confidenceScore("low")).toBe(0.25);
        expect(tileMetaOrigin({ label: "", description: "", origin: "ai", source: "user" })).toBe("ai");
        expect(tileMetaOrigin({ label: "", description: "", source: "user" })).toBe("user");
        expect(tileMetaLocked({ label: "", description: "", locked: true })).toBe(true);
        expect(tileMetaLocked({ label: "", description: "", userLocked: true })).toBe(true);
      });

      it("distinguishes absent metadata from present unconfirmed metadata", () => {
        expect(tileMetaConfidence(undefined)).toBeNull();
        expect(tileMetaConfidence({ label: "", description: "" })).toBe(0.5);
        expect(tileMetaConfidence({ label: "", description: "", source: "user" })).toBe(1);
        expect(tileMetaConfidence({ label: "", description: "", confidence: 0.2, origin: "user" })).toBe(0.2);
      });

      it("marks user-confirmed metadata with canonical and compatibility fields", () => {
        const confirmed = confirmUserTileMetadata(
          { label: "Old", description: "description", role: "decor", source: "ai" },
          { label: "Confirmed" }
        );

        expect(confirmed).toEqual({
          label: "Confirmed",
          description: "description",
          role: "decor",
          confidence: 1,
          origin: "user",
          locked: true,
          source: "user",
          userLocked: true,
        });
      });

      it("legacy projects without palettePresets remain absent after roundtrip", () => {
        const project = createBlankProject();
        const before = startTileset(project).palettePresets;

        const restored = roundTrip(project);

        expect(before).toBeUndefined();
        expect(startTileset(restored).palettePresets).toBeUndefined();
      });

      it("palettePresets and numeric TileAiMetadata fields survive roundtrip", () => {
        const project = projectWithGrid(2, 1, [1, 2]);
        const tileset = startTileset(project);
        tileset.palettePresets = [preset({ slots: [{ role: "water", tileIds: [2], weight: 2 }] })];
        ensureMeta(tileset)[2] = { label: "Water", description: "lake", role: "water", confidence: 0.42, origin: "ai", locked: true };

        const restored = roundTrip(project);
        const restoredTileset = startTileset(restored);

        expect(restoredTileset.palettePresets).toEqual(tileset.palettePresets);
        expect(restoredTileset.tileMeta?.[2]).toMatchObject({ confidence: 0.42, origin: "ai", locked: true });
      });

      it("palette preset ids are normalized to pp_ during deserialize", () => {
        const project = projectWithGrid(1, 1, [1]);
        startTileset(project).palettePresets = [preset({ id: "forest", slots: [{ role: "ground", tileIds: [1] }] })];

        const restored = roundTrip(project);

        expect(startTileset(restored).palettePresets?.[0]?.id).toBe("pp_forest");
      });

      it("shape guard rejects invalid palette slot roles", () => {
        const project = projectWithGrid(1, 1, [1]);
        startTileset(project).palettePresets = [preset({ slots: [{ role: "bogus" as never, tileIds: [1] }] })];

        expect(() => roundTrip(project)).toThrow(/role invalid/);
      });

      it("shape guard rejects numeric confidence outside 0~1", () => {
        const project = projectWithGrid(1, 1, [1]);
        ensureMeta(startTileset(project))[1] = { label: "Bad", description: "", confidence: 1.5 };

        expect(() => roundTrip(project)).toThrow(/confidence/);
      });
    });
    describe("tileset palette lint T1a", () => {
      it("reports tile diversity and preset slot coverage", () => {
        const project = projectWithGrid(3, 1, [1, 2, 3]);
        startTileset(project).palettePresets = [preset({ slots: [{ role: "ground", tileIds: [1] }, { role: "path", tileIds: [9] }] })];

        const issues = lintTilesetPalettes(project);

        expect(issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-diversity", severity: "info" }));
        expect(issues.find((issue) => issue.code === "tileset-palette-diversity")?.message).toContain("1/2");
      });

      it("does not report diversity when no presets exist", () => {
        const project = projectWithGrid(2, 1, [1, 2]);
        delete startTileset(project).palettePresets;

        expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-diversity")).toBe(false);
      });

      it("warns on incompatible water and furniture boundaries", () => {
        const project = projectWithGrid(2, 1, [5, 6]);
        const meta = ensureMeta(startTileset(project));
        meta[5] = { label: "Water", description: "", role: "water" };
        meta[6] = { label: "Chair", description: "", role: "furniture" };

        const issues = lintTilesetPalettes(project);

        expect(issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-boundary", severity: "warning" }));
      });

      it("keeps compatible ground and path boundaries quiet", () => {
        const project = projectWithGrid(2, 1, [5, 6]);
        const meta = ensureMeta(startTileset(project));
        meta[5] = { label: "Grass", description: "", role: "ground" };
        meta[6] = { label: "Road", description: "", role: "path" };

        expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-boundary")).toBe(false);
      });

      it("keeps boundary lint quiet when metadata is missing", () => {
        const project = projectWithGrid(2, 1, [5, 6]);
        delete startTileset(project).tileMeta;

        expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-boundary")).toBe(false);
      });

      it("warns when a path role tile is blocked", () => {
        const project = projectWithGrid(1, 1, [7]);
        const tileset = startTileset(project);
        ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
        setPassable(tileset, 7, false);

        expect(lintTilesetPalettes(project)).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage", severity: "warning" }));
      });

      it("does not warn when a path role tile is passable", () => {
        const project = projectWithGrid(1, 1, [7]);
        const tileset = startTileset(project);
        ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
        setPassable(tileset, 7, true);

        expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-passage")).toBe(false);
      });

      it("warns when a wall role tile is passable", () => {
        const project = projectWithGrid(1, 1, [8]);
        const tileset = startTileset(project);
        ensureMeta(tileset)[8] = { label: "Wall", description: "", role: "wall" };
        setPassable(tileset, 8, true);

        expect(lintTilesetPalettes(project)).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage", severity: "warning" }));
      });

      it("does not warn when a wall role tile is blocked", () => {
        const project = projectWithGrid(1, 1, [8]);
        const tileset = startTileset(project);
        ensureMeta(tileset)[8] = { label: "Wall", description: "", role: "wall" };
        setPassable(tileset, 8, false);

        expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-passage")).toBe(false);
      });

      it("run_lint includes tileset palette lint issues", () => {
        const ctx: ToolContext = { project: projectWithGrid(1, 1, [7]) };
        const tileset = startTileset(ctx.project);
        ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
        setPassable(tileset, 7, false);

        const result = runTool(ctx, "run_lint", {});
        const data = result.data as { issues: Array<{ code: string }> };

        expectOk(result);
        expect(data.issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage" }));
      });
    });
    describe("tileset palette AX tools T1a", () => {
      it("contextBuilder includes preset slot counts and query_tiles retains low confidence metadata", () => {
        const project = projectWithGrid(1, 1, [1]);
        const tileset = startTileset(project);
        tileset.palettePresets = [preset({ name: "Cave", slots: [{ role: "ground", tileIds: [1, 2] }, { role: "wall", tileIds: [3] }] })];
        ensureMeta(tileset)[3] = { label: "Maybe wall", description: "", confidence: 0.4 };

        // A 20,000-char budget no longer reaches the digest: the in-budget sections before it are longer now (digest appears from ~30,000).
        const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

        expect(prompt).toContain("## 타일 어휘 다이제스트");
        expect(prompt).toContain("Cave");
        expect(prompt).toContain("ground:2");
        const queried = runTool({ project }, "query_tiles", { presetId: "pp_village", role: "wall" });
        expectOk(queried);
        expect(queried.data).toMatchObject({ tiles: [expect.objectContaining({ tile: 3, confidenceScore: 0.4 })] });
      });

      it("contextBuilder omits tile vocabulary digest when presets and approved groups are both absent", () => {
        const project = createBlankProject();
        // 번들 하네스 그룹은 source:bundled-default로 시드 승인되므로(2026-07-11), 다이제스트가
        // 진짜로 "보여줄 것이 없을 때" 생략되는지 검증하려면 그룹도 함께 비워야 한다.
        startTileset(project).tileGroups = [];

        // Same budget as the positive cases, so an omission means "nothing to show", not "cut by the budget".
        const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

        expect(prompt).not.toContain("## 타일 어휘 다이제스트");
      });

      it("contextBuilder includes tile vocabulary digest with approved group ids by role even without presets", () => {
        const project = createBlankProject();

        const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

        expect(prompt).toContain("## 타일 어휘 다이제스트");
        // The default start tileset is beodeul_city now; its approved groups are listed by role (path/ground/water, no wall group).
        expect(prompt).toMatch(/^- ground: /m);
      });

      it("query_tiles filters by preset and role and returns tile details", () => {
        const ctx: ToolContext = { project: projectWithGrid(1, 1, [1]) };
        const tileset = startTileset(ctx.project);
        tileset.palettePresets = [preset({ slots: [{ role: "path", tileIds: [11] }] })];
        ensureMeta(tileset)[11] = { label: "Packed dirt", description: "road", role: "path", confidence: 0.8, origin: "ai" };
        setPassable(tileset, 11, true);

        const result = runTool(ctx, "query_tiles", { presetId: "village", role: "path" });
        const data = result.data as { tiles: Array<{ tile: number; label: string; passable: boolean; confidenceScore: number }> };

        expectOk(result);
        expect(data.tiles).toEqual([expect.objectContaining({ tile: 11, label: "Packed dirt", passable: true, confidenceScore: 0.8 })]);
      });

      it("query_tiles filters by metadata category", () => {
        const ctx: ToolContext = { project: projectWithGrid(1, 1, [1]) };
        const meta = ensureMeta(startTileset(ctx.project));
        meta[12] = { label: "Bed", description: "sleep" };
        (meta[12] as unknown as Record<string, unknown>).category = "indoor";

        const result = runTool(ctx, "query_tiles", { category: "indoor" });
        const data = result.data as { tiles: Array<{ tile: number; categories: string[] }> };

        expectOk(result);
        expect(data.tiles).toEqual([expect.objectContaining({ tile: 12, categories: expect.arrayContaining(["indoor"]) })]);
      });

      it("upsert_palette_preset creates pp_ ids and counts additions", () => {
        const ctx: ToolContext = { project: createBlankProject() };

        const result = runTool(ctx, "upsert_palette_preset", {
          preset: { name: "Forest", slots: [{ role: "ground", tileIds: [1, 2] }] },
        });

        expectOk(result);
        const saved = startTileset(ctx.project).palettePresets?.[0];
        expect(saved?.id.startsWith("pp_")).toBe(true);
        expect(saved?.origin).toBe("ai");
        expect(result.diff?.palettePresetsAdded).toBe(1);
      });

      it("upsert_palette_preset modifies existing presets and counts modifications", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        startTileset(ctx.project).palettePresets = [preset({ id: "pp_keep", name: "Old", slots: [{ role: "ground", tileIds: [1] }] })];

        const result = runTool(ctx, "upsert_palette_preset", {
          preset: { id: "keep", name: "New" },
        });

        expectOk(result);
        expect(startTileset(ctx.project).palettePresets?.[0]?.name).toBe("New");
        expect(result.diff?.palettePresetsModified).toBe(1);
      });

      it("upsert_palette_preset rejects locked presets without mutation", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        startTileset(ctx.project).palettePresets = [preset({ id: "pp_locked", locked: true, name: "Locked" })];
        const before = serialize(ctx.project);

        const result = runTool(ctx, "upsert_palette_preset", {
          preset: { id: "locked", name: "Changed" },
        });

        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("palette-preset-locked");
        expect(serialize(ctx.project)).toBe(before);
      });

      it("proposal summaries include palette preset counts", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const result = runTool(ctx, "upsert_palette_preset", {
          preset: { name: "Forest", slots: [{ role: "ground", tileIds: [1] }] },
        });

        const calls = [{ name: "upsert_palette_preset", args: {}, summary: result.summary, result, destructive: false }];
        const lines = proposalSummaryLines(calls);

        expect(result.diff?.palettePresetsAdded).toBe(1);
        expect(lines[0]).toBe(proposalHumanSummaryLine(calls));
      });
    });
    describe("tileset palette placement parameters T1a", () => {
      it("paint_road uses preset tiles deterministically", () => {
        const first = contextWithMap(12, 12);
        const second = contextWithMap(12, 12);
        addToolPreset(first.tileset, [{ role: "path", tileIds: [31, 32], weight: 1 }]);
        addToolPreset(second.tileset, [{ role: "path", tileIds: [31, 32], weight: 1 }]);

        const args = { points: [{ x: 1, y: 4 }, { x: 9, y: 4 }], presetId: "pp_tools", paletteRole: "path", naturalness: 0, seed: 99 };
        expectOk(runTool(first.ctx, "paint_road", { mapId: first.mapId, ...args }));
        expectOk(runTool(second.ctx, "paint_road", { mapId: second.mapId, ...args }));

        expect(mapOf(first.ctx, first.mapId).lowerTiles).toEqual(mapOf(second.ctx, second.mapId).lowerTiles);
        expect(mapOf(first.ctx, first.mapId).lowerTiles).toContain(31);
      });

      it("paint_road rejects missing preset slots", () => {
        const { ctx, mapId, tileset } = contextWithMap();
        addToolPreset(tileset, [{ role: "ground", tileIds: [1] }]);

        const result = runTool(ctx, "paint_road", {
          mapId,
          points: [{ x: 1, y: 1 }],
          presetId: "pp_tools",
          paletteRole: "path",
        });

        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("palette-slot-empty");
      });

      it("scatter_object uses preset tiles deterministically", () => {
        const first = contextWithMap(14, 14);
        const second = contextWithMap(14, 14);
        first.tileset.priority[41] = "upper";
        second.tileset.priority[41] = "upper";
        addToolPreset(first.tileset, [{ role: "decor", tileIds: [41] }]);
        addToolPreset(second.tileset, [{ role: "decor", tileIds: [41] }]);
        const args = { area: { x: 2, y: 2, w: 8, h: 8 }, count: 5, presetId: "pp_tools", paletteRole: "decor", seed: 7, avoidProtected: false };

        expectOk(runTool(first.ctx, "scatter_object", { mapId: first.mapId, ...args }));
        expectOk(runTool(second.ctx, "scatter_object", { mapId: second.mapId, ...args }));

        expect(mapOf(first.ctx, first.mapId).upperTiles).toEqual(mapOf(second.ctx, second.mapId).upperTiles);
        expect(mapOf(first.ctx, first.mapId).upperTiles.filter((tile) => tile === 41)).toHaveLength(5);
      });

      it("build_house applies preset role tiles and replays with the same seed", () => {
        // build_house stamps the combined-town house kit; on beodeul_city the preset wall tile lands elsewhere. Run on the retired sheet.
        const first = contextWithMap(24, 24, true);
        const second = contextWithMap(24, 24, true);
        addToolPreset(first.tileset, [{ role: "wall", tileIds: [51] }]);
        addToolPreset(second.tileset, [{ role: "wall", tileIds: [51] }]);
        const args = { origin: { x: 2, y: 2 }, width: 8, height: 8, material: "plaster", presetId: "pp_tools", paletteRole: "wall", seed: 11 };

        const a = runTool(first.ctx, "build_house", { mapId: first.mapId, ...args });
        const b = runTool(second.ctx, "build_house", { mapId: second.mapId, ...args });

        expectOk(a);
        expectOk(b);
        expect(dataRecord<{ paletteTiles: number }>(a).paletteTiles).toBeGreaterThan(0);
        expect(mapOf(first.ctx, first.mapId).lowerTiles).toEqual(mapOf(second.ctx, second.mapId).lowerTiles);
        expect(mapOf(first.ctx, first.mapId).lowerTiles).toContain(51);
      });

      // Removed it "stamp_structure applies preset role tiles": stamp_structure was removed from the tool registry on purpose.
    });
  });
  // 타일셋 섹션 3탭 재편 + 타일별 레이어 수동 지정 계약(2026-07-05).
  // - DB 타일셋에서 레이어(자동/하위/상위)를 사용자 확정으로 지정할 수 있고, 로드 시 하네스가 덮지 않는다.
  // - 통행/지형 편집도 user 메타로 기록되어 하네스 재적용에 살아남는다.
  // - 지형 템플릿(교과서)은 구성 탭으로 이사했다.
  describe("tilesetSectionTabs", () => {
    isolateTimers();
    const SLOPED_ROOF = 385;   // 투명 칩 — 자동 판정은 상위.
    const STRAIGHT_ROOF = 404;   // 불투명 — 자동 판정은 하위.

    // 아래 시험은 칸 DOM 격자(「칸 편집」)를 다룬다 — 기본 보기는 정적 시트다(qa1124-space PR6).
    beforeEach(() => setChipsetGridEditing(true));
    afterEach(() => setChipsetGridEditing(false));
    describe("타일 레이어 수동 지정(setTileLayerOverride)", () => {
      it("하위로 확정하면 userLocked 메타로 기록되고 하네스 재적용에도 유지된다", () => {
        const tileset = defaultTileset();
        expect(tileset.priority[SLOPED_ROOF]).toBe("upper"); // 자동 판정.

        setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
        expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
        expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
        expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
        expect(tileVisibleOnLayer(tileset, SLOPED_ROOF, "lower")).toBe(true);

        // 프로젝트 로드 시 돌아가는 하네스가 사용자 확정을 덮지 않는다.
        applyCombinedTownHarness(tileset);
        expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
        expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
      });

      it("상위 확정은 하위 홈 타일(404)에도 적용된다", () => {
        const tileset = defaultTileset();
        setTileLayerOverride(tileset, STRAIGHT_ROOF, "upper");
        expect(tileLayerHome(tileset, STRAIGHT_ROOF)).toBe("upper");
        applyCombinedTownHarness(tileset);
        expect(tileset.priority[STRAIGHT_ROOF]).toBe("upper");
      });

      it("자동으로 되돌리면 하네스 판정(투명 칩=상위)으로 복귀한다", () => {
        const tileset = defaultTileset();
        if (!tileset.tileMeta) throw new Error("missing tile metadata");
        tileset.tileMeta[SLOPED_ROOF] = { label: "", description: "", source: "unknown" };
        setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
        setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
        expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull();
        expect(tileset.tileMeta?.[SLOPED_ROOF]?.source).not.toBe("user");
        expect(tileset.tileMeta?.[SLOPED_ROOF]?.locked).toBeUndefined();
        expect(tileset.tileMeta?.[SLOPED_ROOF]?.origin).toBeUndefined();
        expect(tileset.tileMeta?.[SLOPED_ROOF]?.userLocked).toBeUndefined();
        expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
        expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("upper");
      });

      it("자동 복귀 시 사용자 지식(라벨)은 지우지 않는다", () => {
        const tileset = defaultTileset();
        tileset.tileMeta![SLOPED_ROOF] = { label: "우리집 지붕", description: "", source: "user", userLocked: true };
        setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
        setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
        expect(tileset.tileMeta![SLOPED_ROOF].label).toBe("우리집 지붕");
        expect(tileset.tileMeta![SLOPED_ROOF].userLocked).toBe(true);
      });
    });
    describe("통행 편집의 레이어 보호", () => {
      it("번들 메타를 통행 편집으로 승격해도 defaultLayer가 사용자 확정으로 둔갑하지 않는다", async () => {
        const { markUserTileRuntimeMetadata } = await import("@/editor/runtimeTileMetadata");
        const tileset = defaultTileset();
        // roof-overlays 그룹 계약이 넣어둔 번들 defaultLayer:"upper"가 있는 상태에서 통행만 기록.
        expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBe("upper");
        markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "solid" });
        expect(tileset.tileMeta![SLOPED_ROOF].source).toBe("user");
        expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBeUndefined();
        expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull(); // 레이어는 여전히 자동.
        // 이미 사용자 확정 레이어가 있으면 통행 편집이 그것을 지우지 않는다.
        setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
        markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "passable" });
        expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
      });

      it("투명 칩에 O/X를 찍어도 priority는 상위를 유지한다", () => {
        const tileset = defaultTileset();
        setPassageMark(tileset, SLOPED_ROOF, "o");
        expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
        setPassageMark(tileset, SLOPED_ROOF, "x");
        expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
        // 불투명 타일은 기존대로 하위로 내려간다.
        setPassageMark(tileset, STRAIGHT_ROOF, "o");
        expect(tileset.priority[STRAIGHT_ROOF]).toBe("lower");
      });
    });
    describe("타일셋 섹션 UI", () => {
      let restoreDom: (() => void) | null = null;

      beforeEach(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        restoreDom = installFakeDom();
        setTilesetMetadataEditMode("passage", () => {}); // rules 탭으로 초기화.
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      function renderEditor(): FakeElement {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
      }

      it("참고문서와 설정을 포함한 5탭에서 규칙 탭에 레이어/통행 컨트롤이 있다", () => {
        const editor = renderEditor();
        expect(findByTestId(editor, "tileset-section-tab-references")).toBeTruthy();
        expect(findByTestId(editor, "tileset-section-tab-settings")).toBeTruthy();
        expect(findByTestId(editor, "tileset-section-tab-rules")).toBeTruthy();
        expect(findByTestId(editor, "tileset-section-tab-knowledge")).toBeTruthy();
        expect(findByTestId(editor, "tileset-section-tab-compose")).toBeTruthy();
        expect(findByTestId(editor, "tileset-rule-layer")).toBeTruthy();
        expect(findByTestId(editor, "tileset-rule-passage")).toBeTruthy();
        expect(findByTestId(editor, "tileset-passage-compass-details")?.getAttribute("open")).not.toBeNull();
        expect(findByTestId(editor, "tileset-tile-meaning-edit")).toBeNull();
        expect(findByTestId(editor, "tileset-field-ai-label")).toBeNull();
        expect(findByTestId(editor, "tileset-field-ai-description")).toBeNull();
        // 규칙 탭에는 AI 메타/그룹 모드 버튼이 노출되지 않는다 — 기능 분리.
        expect(findByTestId(editor, "tileset-edit-mode-ai")).toBeNull();
        expect(findByTestId(editor, "tileset-edit-mode-group")).toBeNull();
      });

      it("칩 우클릭 메뉴에서 의미 편집 대화상자를 연다", () => {
        openTilesetTileContextMenu({
          tilesetId: COMBINED_TOWN_TILESET_ID,
          tile: 350,
          clientX: 40,
          clientY: 40,
          rerender: () => {},
        });
        const menu = document.querySelector('[data-testid="tileset-tile-context-menu"]');
        expect(menu).toBeTruthy();
        const editBtn = document.querySelector('[data-testid="tileset-ctx-edit-meaning"]') as HTMLButtonElement | null;
        expect(editBtn).toBeTruthy();
        editBtn?.click();
        expect(document.querySelector('[data-testid="tileset-meaning-dialog"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="tileset-meaning-dialog-label"]')).toBeTruthy();
        const label = document.querySelector('[data-testid="tileset-meaning-dialog-label"]') as HTMLInputElement;
        label.value = "우편함";
        label.dispatchEvent(new Event("input"));
        (document.querySelector('[data-testid="tileset-meaning-dialog-apply"]') as HTMLButtonElement)?.click();
        expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]?.tileMeta?.[350]?.label).toBe("우편함");
        expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]?.tileMeta?.[350]?.source).toBe("user");
        closeTilesetMeaningDialog();
        closeTilesetTileContextMenu();
      });

      it("Escape 는 타일 메뉴만 닫고 데이터베이스 모달은 닫지 않는다", () => {
        let closed = false;
        const controller = createEditorModalDirtyCloseController({
          isDirty: () => false,
          promptUnsavedChanges: () => "keep-editing" as const,
          save: () => {},
          discard: () => {},
          close: () => {
            closed = true;
          },
        });

        openTilesetTileContextMenu({
          tilesetId: COMBINED_TOWN_TILESET_ID,
          tile: 350,
          clientX: 20,
          clientY: 20,
          rerender: () => {},
        });
        expect(document.querySelector('[data-testid="tileset-tile-context-menu"]')).toBeTruthy();

        // 메뉴가 열려 있으면 DB 모달 close 금지 (nested 가드)
        controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
        expect(closed).toBe(false);

        closeTilesetTileContextMenu();
        // 메뉴 닫힌 뒤에는 Escape 가 DB 를 닫을 수 있음
        controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
        expect(closed).toBe(true);
      });

      it("기본 보기는 칸 DOM 없이 시트 그림·통행 덮개·선택 표시이고, 「칸 편집」 을 켜야 칸이 생긴다", () => {
        setChipsetGridEditing(false);
        const editor = renderEditor();
        expect(findByTestId(editor, "tileset-db-cell-0")).toBeNull();
        expect(findByTestId(editor, "tileset-passage-overlay")).toBeTruthy();
        expect(findByTestId(editor, "tileset-static-selection")).toBeTruthy();
        expect(findByTestId(editor, "tileset-grid-edit")).toBeTruthy();

        (findByTestId(editor, "tileset-grid-edit") as unknown as HTMLElement).click();
        expect(findByTestId(renderEditor(), "tileset-db-cell-0")).toBeTruthy();
      });

      it("칩셋 프리뷰에 레이어 필터·범례·셀 layer 속성이 있다", () => {
        const editor = renderEditor();
        expect(findByTestId(editor, "tileset-layer-filter")).toBeTruthy();
        expect(findByTestId(editor, "tileset-layer-filter-all")).toBeTruthy();
        expect(findByTestId(editor, "tileset-layer-filter-lower")).toBeTruthy();
        expect(findByTestId(editor, "tileset-layer-filter-upper")).toBeTruthy();
        expect(findByTestId(editor, "tileset-layer-legend")).toBeTruthy();
        expect(findByTestId(editor, "tileset-sheet-info")).toBeTruthy();
        expect(findByTestId(editor, "tileset-selected-layer-badge")).toBeTruthy();

        // 투명 칩 385 = 상위 홈. 셀 data-layer / class에 반영.
        const upperCell = findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as {
          getAttribute?: (name: string) => string | null;
          className?: string;
        };
        expect(upperCell.getAttribute?.("data-layer") ?? (upperCell as { dataset?: { layer?: string } }).dataset?.layer).toBe("upper");
        const className = String(upperCell.className ?? "");
        expect(className).toContain("layer-upper");

        const lowerCell = findByTestId(editor, `tileset-db-cell-${STRAIGHT_ROOF}`) as unknown as {
          className?: string;
        };
        expect(String(lowerCell.className ?? "")).toContain("layer-lower");
      });

      it("레이어 버튼으로 하위 확정하면 store에 반영되고 투명 칩 경고가 뜬다", () => {
        let editor = renderEditor();
        // 칩셋 셀 클릭으로 385 선택(규칙 탭 클릭은 통행 토글도 겸한다).
        (findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as HTMLElement).click();
        editor = renderEditor();
        (findByTestId(editor, "tileset-layer-lower") as unknown as HTMLElement).click();

        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
        expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");

        editor = renderEditor();
        expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy(); // 투명 칩 하위 경고.
      });

      it("지식 탭에서 설명 필드는 접힌 details 안에 있다", () => {
        setTilesetSectionTab("knowledge", () => {});
        const editor = renderEditor();
        expect(findByTestId(editor, "tileset-tile-meaning-details")).toBeTruthy();
        expect(findByTestId(editor, "tileset-field-ai-description")).toBeTruthy();
        expect(findByTestId(editor, "tileset-selected-usage")).toBeNull();
        setTilesetMetadataEditMode("passage", () => {});
      });

      // 통과 칸도 글리프를 가진다. 예전에는 통과가 "글자 없음"이라 어두운 칩 위에서
      // 「통과」와 「글리프가 안 보임」을 구별할 수 없었다.
      it("통행 붓은 클릭한 칸에 고른 규칙을 칠하고 통과 칸에도 표시가 남는다", () => {
        setTilesetPassagePaint("x");
        let editor = renderEditor();
        expect(getTilesetPassagePaint()).toBe("x");
        const open = findByTestId(editor, "tileset-passage-open") as unknown as HTMLElement;
        const blocked = findByTestId(editor, "tileset-passage-blocked") as unknown as HTMLElement;
        const star = findByTestId(editor, "tileset-passage-star") as unknown as HTMLElement;
        expect(open).toBeTruthy();
        expect(blocked).toBeTruthy();
        expect(star).toBeTruthy();

        const tilesetId = COMBINED_TOWN_TILESET_ID;
        expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
        setTilesetPassagePaint("o");
        editor = renderEditor();
        (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
        expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("o");
        editor = renderEditor();
        const cell = findByTestId(editor, "tileset-db-cell-0") as unknown as { textContent?: string };
        expect(String(cell.textContent ?? "")).toBe(passageGlyph("o"));

        setTilesetPassagePaint("x");
        editor = renderEditor();
        (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
        expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
        setTilesetPassagePaint("o");
      });

      it("구성 탭에는 오토타일 섹션만 렌더된다", () => {
        setTilesetSectionTab("compose", () => {});
        const editor = renderEditor();
        expect(getTilesetSectionTab()).toBe("compose");
        expect(findByTestId(editor, "tileset-autotile-editor")).toBeTruthy();
        expect(findByTestId(editor, "tileset-autotile-toolbar")).toBeTruthy();
        expect(findByTestId(editor, "tileset-autotile-layout-cells-9")).toBeTruthy();
        expect(findByTestId(editor, "tileset-autotile-layout-cells-11")).toBeTruthy();
        expect(findByTestId(editor, "tileset-autotile-layout-custom")).toBeTruthy();
        expect(findByTestId(editor, "tileset-autotile-hint")).toBeTruthy();
        expect(findByTestId(editor, "tileset-selected-tile-panel")).toBeNull();
        expect(findByTestId(editor, "terrain-template-section")).toBeNull();
        expect(findByTestId(editor, "tileset-side-pane-toggle")).toBeNull();
        setTilesetMetadataEditMode("passage", () => {}); // 다른 테스트를 위해 복귀.
      });
    });
  });
  describe("tileToolbar", () => {
    isolateTimers();
    describe("RPG Maker tile toolbar actions", () => {
      beforeEach(() => {
        const project = createBlankProject();
        store.replace(project);
        editorState.set({
          activePaletteStamp: null,
          currentMapId: project.startMapId,
          layer: "lower",
          paintShape: "pen",
          selection: null,
          tool: "paint",
        });
      });

      it("switches between pen, rectangle, round, fill, and erase painting modes", () => {
        selectTileTool("rect");
        expect(editorState.get().tool).toBe("paint");
        expect(editorState.get().paintShape).toBe("rect");

        selectTileTool("round");
        expect(editorState.get().tool).toBe("paint");
        expect(editorState.get().paintShape).toBe("round");

        selectTileTool("pen");
        expect(editorState.get().tool).toBe("paint");
        expect(editorState.get().paintShape).toBe("pen");

        selectTileTool("fill");
        expect(editorState.get().tool).toBe("fill");
        expect(editorState.get().paintShape).toBe("pen");

        selectTileTool("erase");
        expect(editorState.get().tool).toBe("erase");
        expect(editorState.get().paintShape).toBe("pen");
      });

      it("moves tile tools off the event layer", () => {
        editorState.set({
          layer: "event",
          tool: "event",
        });

        selectTileTool("rect");

        const state = editorState.get();
        expect(state.layer).toBe("lower");
        expect(state.tool).toBe("paint");
        expect(state.paintShape).toBe("rect");
      });

      it("keeps an existing region only while the select tool is active", () => {
        const project = store.getCurrent();
        const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
        editorState.set({ selection });

        selectTileTool("select");
        expect(editorState.get().tool).toBe("select");
        expect(editorState.get().selection).toEqual(selection);

        selectTileTool("pen");
        expect(editorState.get().selection).toBeNull();
      });

      it("moves brush size into toolbar state", () => {
        setTileBrushSize(3);

        expect(editorState.get().brushSize).toBe(3);
      });

      it("selects eyedropper from the folded inspector options", () => {
        editorState.set({
          layer: "event",
          tool: "event",
        });

        selectEyedropperTool();

        const state = editorState.get();
        expect(state.layer).toBe("lower");
        expect(state.paintShape).toBe("pen");
        expect(state.selection).toBeNull();
        expect(state.tool).toBe("eyedropper");
      });
    });
  });
  describe("toolbarOverflow", () => {
    isolateTimers();
    describe("visibleItemCount", () => {
      it("전부 들어가면 전체 개수를 돌려준다", () => {
        expect(visibleItemCount(400, [50, 50, 50], 30, 4)).toBe(3);
      });

      it("넘치면 ⋯ 버튼 폭을 남기고 최대 개수", () => {
        // 50*4 + gap*3 = 212 > 150 → ⋯(30)+gap 확보 후 들어가는 만큼
        expect(visibleItemCount(150, [50, 50, 50, 50], 30, 4)).toBe(2);
      });

      it("아무것도 안 들어가면 0", () => {
        expect(visibleItemCount(20, [50, 50], 30, 4)).toBe(0);
      });
    });
  });
});

describe("editorPanelsSuite28", () => {
  isolateTimers();
  describe("undoHistory", () => {
    isolateTimers();
    beforeEach(() => {
      vi.unstubAllGlobals();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });
    function itemName(id: string): string | undefined {
      return store.getCurrent().database.items.find((entry) => entry.id === id)?.name;
    }
    function itemCount(): number {
      return store.getCurrent().database.items.length;
    }
    describe("database record undo/redo", () => {
      it("restores and reapplies a record field edit through undo/redo", () => {
        const id = addDatabaseRecord("items");
        updateDatabaseRecord("items", id, { name: "검" });
        expect(itemName(id)).toBe("검");

        expect(undoMapEdit()).toBe(true);
        expect(itemName(id)).toBe("새 아이템");

        expect(redoMapEdit()).toBe(true);
        expect(itemName(id)).toBe("검");
      });

      it("undoes a record addition and deletion", () => {
        const baseline = itemCount();
        const id = addDatabaseRecord("items");
        expect(itemCount()).toBe(baseline + 1);

        // 삭제 → undo 로 복원.
        expect(deleteDatabaseRecord("items", id)).toEqual({ ok: true });
        expect(itemCount()).toBe(baseline);
        expect(undoMapEdit()).toBe(true);
        expect(itemCount()).toBe(baseline + 1);

        // 추가 자체도 undo 로 제거.
        expect(undoMapEdit()).toBe(true);
        expect(itemCount()).toBe(baseline);
      });

      it("coalesces consecutive edits to the same field into a single snapshot", () => {
        const id = addDatabaseRecord("items");
        // 같은 필드를 keystroke 처럼 여러 번 편집 → 스냅샷 1개만.
        updateDatabaseRecord("items", id, { name: "검" });
        updateDatabaseRecord("items", id, { name: "검 " });
        updateDatabaseRecord("items", id, { name: "검신" });
        expect(itemName(id)).toBe("검신");

        // 한 번의 undo 로 편집 시작 이전(기본 이름)으로 되돌아간다.
        expect(undoMapEdit()).toBe(true);
        expect(itemName(id)).toBe("새 아이템");

        // 그 다음 undo 는 레코드 추가 이전 상태.
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().database.items.find((entry) => entry.id === id)).toBeUndefined();
      });

      it("keeps separate snapshots for edits to different fields", () => {
        const id = addDatabaseRecord("items");
        updateDatabaseRecord("items", id, { name: "검" });
        updateDatabaseRecord("items", id, { price: 100 });
        expect(itemName(id)).toBe("검");
        expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(100);

        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(0);
        expect(itemName(id)).toBe("검");

        expect(undoMapEdit()).toBe(true);
        expect(itemName(id)).toBe("새 아이템");
      });
    });
    describe("snapshot dedup", () => {
      it("does not push duplicate consecutive snapshots for identical state", () => {
        recordProjectSnapshot();
        recordProjectSnapshot();
        recordProjectSnapshot();
        expect(getMapEditHistoryState().canUndo).toBe(true);
        expect(undoMapEdit()).toBe(true);
        // 동일 상태 3회 기록이 1개로 dedup 되어 두 번째 undo 는 없다.
        expect(undoMapEdit()).toBe(false);
      });

      it("stores optional labels and keeps no-argument calls backward compatible", () => {
        const mapId = store.getCurrent().startMapId;
        recordProjectSnapshot("AI: 집 건설", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 101;
        });
        recordProjectSnapshot();

        const entries = getMapEditHistoryEntries();
        expect(entries[0]).toMatchObject({ label: "편집", mapId: null, current: true });
        expect(entries[1]).toMatchObject({ label: "AI: 집 건설", mapId, current: false });
        expect(entries[0]?.at).toBeGreaterThan(entries[1]?.at ?? -1);
      });

      it("peeks previous snapshots as clones and reverts to a history index", () => {
        const mapId = store.getCurrent().startMapId;
        recordProjectSnapshot("첫 변경", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 111;
        });
        const afterFirst = structuredClone(store.getCurrent());
        recordProjectSnapshot("둘째 변경", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 222;
        });

        const entries = getMapEditHistoryEntries();
        expect(entries.map((entry) => entry.label)).toEqual(["둘째 변경", "첫 변경"]);
        expect(entries[0]?.current).toBe(true);

        const peeked = peekPreviousProject();
        expect(peeked).toEqual(afterFirst);
        if (!peeked) throw new Error("expected peeked project");
        peeked.maps[mapId].lowerTiles[0] = 999;
        expect(peekPreviousProject()).toEqual(afterFirst);

        expect(revertToHistoryIndex(entries[0]?.index ?? -1)).toBe(true);
        expect(store.getCurrent()).toEqual(afterFirst);

        expect(redoMapEdit()).toBe(true);
        expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(222);
      });

      // 조수 패널의 턴 되감기("여기서 다시")가 쓰는 진입점. 턴 시작 시점의 마커만 들고 있다가
      // 그 시점 이후 스냅샷을 한 번에 되돌린다 — 인덱스는 MAX_HISTORY shift 로 흔들려서 못 쓴다.
      it("reverts every snapshot taken at or after a marker", () => {
        const mapId = store.getCurrent().startMapId;
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 5;
        });
        const beforeTurn = structuredClone(store.getCurrent());
        const marker = getMapEditHistoryMarker();

        // 한 턴 안에서 두 번 편집했다고 가정한다.
        recordProjectSnapshot("AI 1차", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 111;
        });
        recordProjectSnapshot("AI 2차", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 222;
        });

        expect(revertToHistoryMarker(marker)).toBe(true);
        expect(store.getCurrent()).toEqual(beforeTurn);
      });

      it("reports false when nothing was recorded after the marker", () => {
        const mapId = store.getCurrent().startMapId;
        recordProjectSnapshot("턴 전 편집", mapId);
        store.update((project) => {
          project.maps[mapId].lowerTiles[0] = 7;
        });
        const marker = getMapEditHistoryMarker();
        const untouched = structuredClone(store.getCurrent());

        // 이 턴은 프로젝트를 건드리지 않았다 — 되돌릴 것이 없다는 사실을 호출자가 알아야 한다
        // (조수 패널은 이 값으로 "편집도 되돌렸다" 와 "대화만 되감았다" 를 갈라 말한다).
        expect(revertToHistoryMarker(marker)).toBe(false);
        expect(store.getCurrent()).toEqual(untouched);
        expect(revertToHistoryMarker(Number.NaN)).toBe(false);
      });

      it("stores map-kind snapshots as per-map history and keeps redo symmetric", () => {
        const project = store.getCurrent();
        const mapId = project.startMapId;
        const otherMap = createBlankMap("다른 맵", 12, 12);
        store.update((draft) => {
          draft.maps[otherMap.id] = otherMap;
          draft.mapTree.children.push({ mapId: otherMap.id, children: [] });
        });

        recordProjectSnapshot("현재 맵 칠하기", mapId, { kind: "map" });
        store.update((draft) => {
          draft.maps[mapId].lowerTiles[0] = 111;
          draft.maps[otherMap.id].lowerTiles[0] = 777;
        });

        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().maps[mapId].lowerTiles[0]).not.toBe(111);
        expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);

        expect(redoMapEdit()).toBe(true);
        expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(111);
        expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);
      });

      it("keeps single-map paint history well below full-project snapshot volume", () => {
        const base = createBlankProject();
        for (let index = 1; index < 10; index += 1) {
          const map = createBlankMap(`메모리 맵 ${index}`, 24, 24);
          base.maps[map.id] = map;
          base.mapTree.children.push({ mapId: map.id, children: [] });
        }
        store.replace(base);
        resetMapEditHistory();

        const mapId = store.getCurrent().startMapId;
        for (let index = 0; index < 50; index += 1) {
          recordProjectSnapshot(`페인트 ${index}`, mapId, { kind: "map" });
          store.update((project) => {
            project.maps[mapId].lowerTiles[index] = index + 100;
          });
        }

        const entries = getMapEditHistoryDebugEntries();
        const mapSnapshotBytes = entries.reduce((sum, entry) => sum + entry.serializedLength, 0);
        const projectBytes = JSON.stringify(store.getCurrent()).length;

        expect(entries).toHaveLength(50);
        expect(entries.every((entry) => entry.kind === "map" && entry.mapId === mapId)).toBe(true);
        // 전체 프로젝트 50벌은 projectBytes * 50에 가깝다. 10맵 프로젝트에서 단일 맵 50벌은
        // 대략 1/10 수준이므로, 직렬화 오버헤드를 감안해도 projectBytes * 5 미만이어야 한다.
        expect(mapSnapshotBytes).toBeLessThan(projectBytes * 5);
      });
    });
    describe("database-hosted command list undo (common events)", () => {
      function seedCommonEvent(): string {
        const id = "ce_test";
        store.update((project) => {
          project.commonEvents.push({ id, name: "테스트 공용", trigger: "none", commands: [] });
        });
        return id;
      }

      function commonEventCommands(id: string): Command[] {
        return store.getCurrent().commonEvents.find((entry) => entry.id === id)?.commands ?? [];
      }

      it("undoes a command added to a common event", () => {
        const id = seedCommonEvent();
        const actions = createDatabaseCommandListActions({
          get commands() {
            return commonEventCommands(id);
          },
          replaceCommands: (next) => {
            store.update((project) => {
              const target = project.commonEvents.find((entry) => entry.id === id);
              if (target) target.commands = structuredClone(next);
            });
          },
        });

        actions.addCommand([], newCommand("wait"));
        expect(commonEventCommands(id)).toHaveLength(1);

        expect(undoMapEdit()).toBe(true);
        expect(commonEventCommands(id)).toHaveLength(0);

        expect(redoMapEdit()).toBe(true);
        expect(commonEventCommands(id)).toHaveLength(1);
      });
    });
    describe("handleHistoryHotkey", () => {
      function keyEvent(
        key: string,
        opts: { ctrl?: boolean; shift?: boolean; target?: unknown } = {}
      ): KeyboardEvent {
        return {
          key,
          ctrlKey: opts.ctrl ?? true,
          metaKey: false,
          altKey: false,
          shiftKey: Boolean(opts.shift),
          target: opts.target,
          preventDefault: () => {},
        } as unknown as KeyboardEvent;
      }

      it("undoes on Ctrl+Z and redoes on Ctrl+Y / Ctrl+Shift+Z", () => {
        const id = addDatabaseRecord("items");
        updateDatabaseRecord("items", id, { name: "검" });

        expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
        expect(itemName(id)).toBe("새 아이템");

        expect(handleHistoryHotkey(keyEvent("y"))).toBe(true);
        expect(itemName(id)).toBe("검");

        expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(false);
        // 편집 시작 전 상태(추가만 남음)로 undo 후 redo(shift+z) 로 되돌린다.
        expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
        expect(itemName(id)).toBe("새 아이템");
        expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(true);
        expect(itemName(id)).toBe("검");
      });

      it("ignores the shortcut while a text input is focused", () => {
        class FakeInput {
          tagName = "INPUT";
          isContentEditable = false;
        }
        vi.stubGlobal("HTMLElement", FakeInput);
        const id = addDatabaseRecord("items");
        updateDatabaseRecord("items", id, { name: "검" });

        expect(handleHistoryHotkey(keyEvent("z", { target: new FakeInput() }))).toBe(false);
        expect(itemName(id)).toBe("검");
      });

      it("does not handle plain keys without a modifier", () => {
        expect(handleHistoryHotkey(keyEvent("z", { ctrl: false }))).toBe(false);
      });
    });
  });
  describe("windowControls", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number {
        return this.values.size;
      }

      clear(): void {
        this.values.clear();
      }

      getItem(key: string): string | null {
        return this.values.get(key) ?? null;
      }

      key(index: number): string | null {
        return Array.from(this.values.keys())[index] ?? null;
      }

      removeItem(key: string): void {
        this.values.delete(key);
      }

      setItem(key: string, value: string): void {
        this.values.set(key, value);
      }
    }
    let restoreDom: (() => void) | null = null;
    let storage: MemoryStorage;
    function fakeElement(node: HTMLElement): FakeElement {
      if (node instanceof FakeElement) return node;
      throw new Error("Expected fake element");
    }
    function fakeBody(): FakeElement {
      if (document.body instanceof FakeElement) return document.body;
      throw new Error("Expected fake body");
    }
    function installStorage(): void {
      storage = new MemoryStorage();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: storage,
      });
    }
    function installFullscreenDocument(): void {
      const html = document.createElement("html");
      Object.defineProperty(document, "documentElement", {
        configurable: true,
        value: html,
      });
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        writable: true,
        value: null,
      });
      Object.defineProperty(document, "addEventListener", {
        configurable: true,
        value: vi.fn(),
      });
    }
    /**
     * 데스크톱 앱 렌더러 흉내 — 기본 vitest 환경(node)에는 window 가 없다. 프리로드가 붙이는
     * window.oprn 브릿지를 window 위에 세우고, 끝나면 지우는 함수를 돌려준다. 코드가
     * `typeof window !== "undefined"` 로 가드를 걸므로 window 자체를 정의해야 하고,
     * 없는 속성(addEventListener 등)은 no-op 함수로 돌려준다.
     */
    function installDesktopBridge(bridge: object | null): () => void {
      const base: Record<string, unknown> = bridge ? { oprn: bridge } : {};
      const win = new Proxy(base, {
        get(target, prop) {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
          if (prop === "document") return document;
          if (prop in globalThis) return (globalThis as Record<string | symbol, unknown>)[prop];
          return () => {};
        },
        has() { return true; },
      });
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: win });
      return () => {
        Reflect.deleteProperty(globalThis, "window");
      };
    }
    beforeEach(() => {
      store.replace(createBlankProject());
      restoreDom = installFakeDom();
      installStorage();
      installFullscreenDocument();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
    });
    /**
     * 2026-11 개편: 전체화면 단추는 톱바를 떠나 ⌘K 「화면: 전체화면 전환」 명령이 집이다.
     * 명령은 menu.ts 를 실행 때 불러오므로 click() 은 한 틱 뒤에 끝난다 — 아래 단언은 그 뒤를 기다린다.
     */
    function fullscreenCommand(): { click(): void } {
      const command = listEditorCommands().find((entry) => entry.id === "window-fullscreen");
      if (!command) throw new Error("window-fullscreen command missing");
      return { click: () => command.run() };
    }
    async function settleCommand(): Promise<void> {
      await import("@/editor/panels/menu");
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    }
    describe("상단 창 컨트롤", () => {
      it("툴바 접기 버튼은 없다 — 접을 두 번째 툴바 행이 사라졌다(2026-09-03)", () => {
        // Break: 편집 모드 클래식 툴바 행이 되살아나 「─」 접기 버튼과 함께 돌아온다.
        const topbar = document.createElement("div");
        renderTopbar(topbar);

        expect(findByTestId(fakeElement(topbar), "window-toolbar-collapse")).toBeNull();
        expect(findByTestId(fakeElement(topbar), "oprn-toolbar")).toBeNull();
        expect(document.body.classList.contains("toolbar-collapsed")).toBe(false);
        // 2026-11 개편: 전체화면 단추도 톱바에 없다 — ⌘K 명령이 집이다.
        expect(findByTestId(fakeElement(topbar), "window-fullscreen")).toBeNull();
      });

      it("⌘K 전체화면 명령이 requestFullscreen을 호출한다", async () => {
        const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
        Object.defineProperty(document.documentElement, "requestFullscreen", {
          configurable: true,
          value: requestFullscreen,
        });
        const fullscreen = fullscreenCommand();

        fullscreen.click();
        await settleCommand();

        expect(requestFullscreen).toHaveBeenCalledTimes(1);
      });

      it("전체화면 API가 없으면 토스트를 표시하고 예외 없이 반환한다", async () => {
        const fullscreen = fullscreenCommand();

        expect(() => fullscreen.click()).not.toThrow();
        await settleCommand();
        expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("전체화면");
      });

      it("데스크톱 창 브릿지가 있으면 전체화면을 창 컨트롤로 토글한다", async () => {
        // Break: 브릿지가 있는데도 브라우저 Fullscreen API 를 부르면, 네이티브 전체화면으로 뜬
        // 앱 창은 「축소」가 되지 않는다(2026-10-05 사용자 보고).
        const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
        Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
        const windowControl = vi.fn(async () => true);
        const disposeBridge = installDesktopBridge({ windowControl });
        try {
          const fullscreen = fullscreenCommand();

          fullscreen.click();
          await settleCommand();
          await new Promise((resolve) => setTimeout(resolve, 0));

          expect(windowControl).toHaveBeenCalledWith("toggle-fullscreen");
          expect(requestFullscreen).not.toHaveBeenCalled();
        } finally {
          disposeBridge();
        }
      });

      it("보관된 전체화면 단추는 데스크톱 네이티브 전체화면 상태를 구독해 aria-pressed 를 맞춘다", async () => {
        // Break: 창 컨트롤로 들어간 전체화면은 document.fullscreenElement 를 바꾸지 않아
        // 아이콘이 항상 「아님」으로 남는다.
        const listeners: Array<(fullscreen: boolean) => void> = [];
        const disposeBridge = installDesktopBridge({
          windowControl: vi.fn(async () => true),
          windowFullscreen: async () => true,
          onWindowFullscreen: (callback: (fullscreen: boolean) => void) => {
            listeners.push(callback);
            return () => { listeners.length = 0; };
          },
        });
        try {
          // 2026-11 개편으로 톱바에서 뺐지만 되살릴 수 있게 보관한 단추(RETIRED_TOPBAR_CONTROLS)가 이 계약을 지킨다.
          const fullscreen = fakeElement(RETIRED_TOPBAR_CONTROLS.fullscreen());

          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(fullscreen.getAttribute("aria-pressed")).toBe("true");

          for (const listener of listeners) listener(false);
          expect(fullscreen.getAttribute("aria-pressed")).toBe("false");
        } finally {
          disposeBridge();
        }
      });
    });
  });
  describe("worldCanonConsumers", () => {
    isolateTimers();
    describe("worldCanon → assistant context", () => {
      it("injects the canon as a fixed block with absences as hard constraints", () => {
        const project = createBlankProject();
        project.worldCanon = {
          name: "서녘 공화국",
          premise: "마법은 피의 대가다.",
          tones: ["grim", "political"],
          absences: ["총", "엘프"],
          laws: { death: { present: false, note: "부활 없음" } },
          body: "왕위는 비어 있다.",
        };
        const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
        expect(prompt).toContain("## 이 세계(세계관 고정)");
        expect(prompt).toContain("서녘 공화국");
        expect(prompt).toContain("총, 엘프");
        // 예산 밖 고정분 — 초소형 예산에서도 살아남는다.
        const tiny = buildSystemPrompt(project, { budgetChars: 600 });
        expect(tiny).toContain("## 이 세계(세계관 고정)");
      });

      it("emits nothing when the canon is empty and never revives the entity digest", () => {
        const project = createBlankProject();
        expect(worldCanonPromptSection(project.worldCanon)).toBeNull();
        const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
        expect(prompt).not.toContain("## 이 세계(세계관 고정)");
        expect(prompt).not.toContain("## 세계관 다이제스트");
      });

      // 2026-09-20 사용자 요청: 세계관이 틀리면 안 되므로 본문 상한을 600 → 20,000자로 올렸다.
      // 이 절은 예산 슬라이싱 밖의 고정분이라, 상한이 없으면 본문 하나가 실제 대화 기록을 밀어낸다.
      // 그래서 "무제한"이 아니라 "실사용에서 잘릴 일이 거의 없는 선"으로 잡는다.
      it("긴 본문은 20,000자까지 싣고, 그 위는 잘라 고지한다", () => {
        // 상한 안쪽은 전문이 그대로 실린다(잘림 표시가 없어야 한다).
        const inside = worldCanonPromptSection({ body: "가".repeat(19_000) });
        expect(inside).not.toBeNull();
        expect(inside).toContain("가".repeat(19_000));
        expect(inside).not.toContain("이 세계 본문");

        // 상한을 넘으면 잘리고, 얼마나 남았는지 고지한다.
        const beyond = worldCanonPromptSection({ body: "가".repeat(25_000) });
        expect(beyond).not.toBeNull();
        expect(beyond).toContain("…(이 세계 본문 5000자 더 있음");
        // 잘림 고지까지 포함해도 상한 + 고지문 수준이어야 한다(폭주 방지).
        expect((beyond ?? "").length).toBeLessThan(20_400);
      });
      it("treats a status-only shell as empty so it never emits a phantom block", () => {
        expect(worldCanonPromptSection({ status: "canon" })).toBeNull();
        const project = createBlankProject();
        project.worldCanon = { status: "canon" };
        expect(buildSystemPrompt(project, { budgetChars: 20000 })).not.toContain("## 이 세계(세계관 고정)");
      });

      it("marks the status line so draft/canon/secret read differently", () => {
        expect(worldCanonPromptSection({ name: "서녘", status: "canon" })).toContain("확정");
        expect(worldCanonPromptSection({ name: "서녘", status: "secret" })).toContain("비밀");
        expect(worldCanonPromptSection({ name: "서녘" })).not.toContain("상태:");
      });
    });
    describe("findWorldCanonAbsenceHits", () => {
      it("returns nothing when the canon is undefined", () => {
        expect(findWorldCanonAbsenceHits("총을 들어라", undefined)).toEqual([]);
      });

      it("returns nothing when the text is empty", () => {
        expect(findWorldCanonAbsenceHits("", { absences: ["총"] })).toEqual([]);
      });

      it("returns nothing when absence entries are empty", () => {
        expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국" })).toEqual([]);
        expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [] })).toEqual([]);
        expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [""] })).toEqual([]);
      });
    });
    describe("worldCanon → database overview", () => {
      let cleanup: (() => void) | undefined;
      beforeEach(() => {
        cleanup = installFakeDom();
        store.replace(createBlankProject());
      });
      afterEach(() => cleanup?.());

      function render(): FakeElement {
        const host = document.createElement("div") as unknown as FakeElement;
        renderOverviewTab(host as unknown as HTMLElement, () => undefined);
        return host;
      }

      it("shows the authored world name and premise", () => {
        store.update((draft) => {
          draft.worldCanon = { name: "안개 해안", premise: "바다가 기억을 삼킨다." };
        });
        const card = findByTestId(render(), "db-overview-canon");
        expect(card?.textContent).toContain("안개 해안");
        expect(card?.textContent).toContain("바다가 기억을 삼킨다.");
      });

      it("invites authoring when the canon is empty", () => {
        const card = findByTestId(render(), "db-overview-canon");
        expect(card?.textContent).toContain("이 세계를 적어 보세요");
      });
    });
    describe("worldCanon → welcome genre seed", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });

      it("seeds tones and a premise when the canon is blank", () => {
        applyWelcomeGenrePresetToOpenProject("monster-collect");
        const canon = store.getCurrent().worldCanon;
        expect(canon?.tones?.length ?? 0).toBeGreaterThan(0);
        expect(canon?.premise).toBeTruthy();
      });

      it("never overwrites an authored canon", () => {
        store.update((draft) => {
          draft.worldCanon = { name: "내 세계", tones: ["gothic"] };
        });
        applyWelcomeGenrePresetToOpenProject("monster-collect");
        expect(store.getCurrent().worldCanon).toEqual({ name: "내 세계", tones: ["gothic"] });
      });
    });
  });
  describe("worldCodexJump", () => {
    isolateTimers();
    function renderOverview(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      renderOverviewTab(host as unknown as HTMLElement, () => undefined);
      return host;
    }
    describe("overview codex card (click-to-jump RED-first)", () => {
      let cleanup: (() => void) | undefined;

      beforeEach(() => {
        cleanup = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => cleanup?.());

      it("shows a codex card that explains loose cards live outside the canon", () => {
        const card = findByTestId(renderOverview(), "db-overview-codex");
        expect(card?.textContent ?? "").toContain("설정집");
      });

      it("routes the codex card at the codex tab, not the canon tab", () => {
        const card = findByTestId(renderOverview(), "db-overview-codex");
        expect(card?.attrs.title ?? "").toContain("설정집");
      });
    });
    describe("codex url entry (RED-first)", () => {
      it("parses a tab+entity deep link from the query string", () => {
        expect(readCodexEntryFromUrl("?codexTab=character&codexEntity=w_char_1")).toEqual({ tab: "character", entityId: "w_char_1" });
      });

      it("returns null for a query without codex params", () => {
        expect(readCodexEntryFromUrl("?map=map_village")).toBeNull();
      });

      it("returns null when the tab or the entity is missing", () => {
        expect(readCodexEntryFromUrl("?codexTab=character")).toBeNull();
        expect(readCodexEntryFromUrl("?codexEntity=w_char_1")).toBeNull();
      });

      it("returns null for an unknown tab", () => {
        expect(readCodexEntryFromUrl("?codexTab=nope&codexEntity=w_char_1")).toBeNull();
      });
    });
    describe("codex deep link adopt", () => {
      let cleanup: (() => void) | undefined;

      beforeEach(() => {
        cleanup = installFakeDom();
        const project = createBlankProject();
        project.world = {
          entities: [
            { id: "w_char_1", type: "character", name: "아린", summary: "주인공", origin: "user" },
          ],
          relations: [],
        };
        store.replace(project as Project);
      });

      afterEach(() => cleanup?.());

      it("selects the linked card on first render", () => {
        const guard = setSearch("?codexTab=character&codexEntity=w_char_1");
        try {
          const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
          expect(findByTestId(panel, "world-tab-character")?.classList.contains("active")).toBe(true);
          expect(findByTestId(panel, "world-card-w_char_1")?.classList.contains("active")).toBe(true);
        } finally {
          guard.restore();
        }
      });

      it("ignores a deep link for an unknown entity", () => {
        const guard = setSearch("?codexTab=character&codexEntity=w_nope");
        try {
          const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
          expect(findByTestId(panel, "world-card-w_nope")).toBeNull();
        } finally {
          guard.restore();
        }
      });
    });
    function setSearch(search: string): { restore: () => void } {
      const prev = (globalThis as Record<string, unknown>).window;
      const win = (typeof prev === "object" && prev !== null ? prev : {}) as Record<string, unknown>;
      win.location = { ...((win.location ?? {}) as Record<string, unknown>), search };
      (globalThis as Record<string, unknown>).window = win;
      return { restore: () => { (globalThis as Record<string, unknown>).window = prev; } };
    }
  });
  describe("worldRelationTarget", () => {
    isolateTimers();
    const card = (id: string, name: string): WorldEntity => ({ id, type: "place", name, summary: "", origin: "user" });
    const targets = [card("w_a", "은빛 항구"), card("w_b", "은빛 상단"), card("w_c", "폐탑"), card("w_d", "폐탑 지하")];
    const labels = new Map(targets.map((entity) => [entity.id, entity.name] as const));
    describe("연결 속성 입력 → 문서 id", () => {
      it("id 와 정확한 이름은 바로 찾는다", () => {
        expect(resolveRelationTarget("w_a", targets, labels)).toEqual({ kind: "found", id: "w_a" });
        expect(resolveRelationTarget(" 은빛 항구 ", targets, labels)).toEqual({ kind: "found", id: "w_a" });
      });
      it("정확한 이름이 부분 일치보다 먼저다", () => {
        expect(resolveRelationTarget("폐탑", targets, labels)).toEqual({ kind: "found", id: "w_c" });
      });
      it("유일한 부분 일치만 찾고, 여럿이면 모호하다고 돌려준다", () => {
        expect(resolveRelationTarget("지하", targets, labels)).toEqual({ kind: "found", id: "w_d" });
        expect(resolveRelationTarget("은빛", targets, labels)).toEqual({ kind: "ambiguous" });
      });
      it("없는 이름과 빈 입력은 저장하지 않는다", () => {
        expect(resolveRelationTarget("없는 문서", targets, labels)).toEqual({ kind: "none" });
        expect(resolveRelationTarget("  ", targets, labels)).toEqual({ kind: "none" });
      });
      it("같은 이름이 둘이면 「이름 · id」 표시 이름으로 고른다", () => {
        const dup = [card("w_x", "마을"), card("w_y", "마을")];
        const dupLabels = new Map([["w_x", "마을 · w_x"], ["w_y", "마을 · w_y"]]);
        expect(resolveRelationTarget("마을", dup, dupLabels)).toEqual({ kind: "ambiguous" });
        expect(resolveRelationTarget("마을 · w_y", dup, dupLabels)).toEqual({ kind: "found", id: "w_y" });
      });
    });
  });
});
