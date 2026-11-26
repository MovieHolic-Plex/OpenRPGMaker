import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clampPanelSize, loadPanelSize, PANEL_SIZE_LIMITS, renderAiChatPanel, savePanelSize } from "@/editor/panels/aiChatPanel";
import { filterToolCategories, openToolBrowserModal, TOOL_CATEGORIES, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { activeTools } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools, getTool } from "@/editor/tools/toolRegistry";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

// 패널 크기 커스텀 + 툴 브라우저 계약(2026-07-05).
describe("aiPanelResizeAndToolBrowser", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  let storage: Map<string, string>;
  function installFakeLocalStorage(): void {
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, String(value)),
        removeItem: (key: string) => void storage.delete(key),
        clear: () => storage.clear(),
      },
    });
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom({ window: true });
    installFakeLocalStorage();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  // 삭제(2026-08-31): describe("사이드 도크 폭 (1/3)") 2케이스 — `computeSideChatWidth` /
  // `resolveSideChatWidth` / `SIDE_CHAT_WIDTH` 가 사이드 도크와 함께 삭제됐다. 캔버스는 항상
  // 전폭이고 `--ai-chat-side-width` 는 영구 0px 다.
  describe("패널 크기 커스텀", () => {
    // 삭제: "저장된 크기가 있으면 유리 카드에 인라인 크기로 적용되고, 리사이즈 핸들이 렌더된다" —
    // 패널 인라인 크기는 삭제된 계약이다. 저장 폭 적용·핸들 렌더는 test/aiPanelGlassResize.test.ts
    // 가 새 표면(컴포저 캡슐의 `--ai-float-bar-width`)으로 덮는다.
    it("클램프 범위를 강제하고 저장/복원이 왕복한다", () => {
      expect(clampPanelSize({ width: 100, height: 100 })).toEqual({ width: PANEL_SIZE_LIMITS.minWidth, height: PANEL_SIZE_LIMITS.minHeight });
      expect(clampPanelSize({ width: 5000, height: 5000 })).toEqual({ width: PANEL_SIZE_LIMITS.maxWidth, height: PANEL_SIZE_LIMITS.maxHeight });
      savePanelSize({ width: 480, height: 600 });
      expect(loadPanelSize()).toEqual({ width: 480, height: 600 });
      // 손상된 저장값은 무시.
      storage.set("oprn:ai-panel-size", "{broken");
      expect(loadPanelSize()).toBeNull();
    });
  });
  describe("툴 브라우저", () => {
    it("카테고리 합계가 활성 툴과 일치한다 — deprecated 레거시는 브라우저 숨김", () => {
      expect(totalToolCount()).toBe(activeTools().length);
      const categoryNames = new Set(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name)));
      for (const tool of activeTools()) {
        expect(categoryNames.has(tool.name), `브라우저에 누락된 활성 툴: ${tool.name}`).toBe(true);
      }
    });

    it("검색 필터가 이름/설명 부분 일치로 동작한다", () => {
      const byName = filterToolCategories("place_npc");
      expect(byName.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_npc");
      const byDescription = filterToolCategories("소품");
      expect(byDescription.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_props");
      expect(filterToolCategories("존재하지않는검색어xyz")).toEqual([]);
    });

    it("첫 화면은 자주 쓰는 툴 + 검색 진입이며 전체 목록은 확장으로 연다", () => {
      const modal = openToolBrowserModal() as unknown as FakeElement;
      expect(findByTestId(modal, "tool-browser-body")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-search")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-frequent")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-show-all")).toBeTruthy();
      // 전체 덤프가 첫 페인트에 깔리지 않는다
      expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeNull();
      findByTestId(modal, "tool-browser-show-all")?.click();
      expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-row-get_event")).toBeTruthy();
      expect(findByTestId(modal, "tool-browser-row-rename_variable")).toBeTruthy();
    });

    it("패널 헤더에 🧰 버튼이 렌더된다", () => {
      const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
      expect(findByTestId(panel, "ai-tools-browser")).toBeTruthy();
    });
  });
});

describe("setGroupLayout", () => {
  isolateTimers();
  type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
  type SetGroupLayoutData = {
    readonly axis: "horizontal" | "vertical";
    readonly groupId: string;
    readonly tilesetId: string;
  };
  function contextWithGroup(): ToolContext {
    // set_group_layout 은 tilesetId 를 생략하면 시작 맵의 칩셋을 쓴다 — 시작 맵을 합본 마을 위에 둔다.
    const project = startOnRetiredCombinedTown(createBlankProject());
    project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [layoutGroup()];
    return { project };
  }
  function layoutGroup(): TileGroupMetadata {
    return {
      defaultLayer: "upper",
      description: "2칸 나무",
      id: "tree-pair",
      name: "나무 2칸",
      placementRules: "위/아래 한 덩어리",
      role: "prop",
      tileIds: [100],
    };
  }
  function groupOf(ctx: ToolContext): TileGroupMetadata {
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === "tree-pair");
    if (!group) throw new Error("test group missing");
    return group;
  }
  function grammarOf(ctx: ToolContext): PatternGrammar {
    const grammar = groupOf(ctx).patternGrammar;
    if (!grammar) throw new Error("patternGrammar missing");
    return grammar;
  }
  function dataOf(value: unknown): SetGroupLayoutData {
    if (!isSetGroupLayoutData(value)) throw new Error("set_group_layout data shape mismatch");
    return value;
  }
  function isSetGroupLayoutData(value: unknown): value is SetGroupLayoutData {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return Reflect.get(value, "tilesetId") === COMBINED_TOWN_TILESET_ID
      && typeof Reflect.get(value, "groupId") === "string"
      && (Reflect.get(value, "axis") === "vertical" || Reflect.get(value, "axis") === "horizontal");
  }
  describe("set_group_layout", () => {
    it("세로 위/아래 구성을 저장하고 샘플에서 위 칸 260, 아래 칸 290으로 배치한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: the group layout is persisted as top/bottom.
      const result = runTool(ctx, "set_group_layout", { axis: "vertical", bottom: [290], groupId: "tree-pair", top: [260] });

      // Then: the grammar, tile union, registry data, and sample placement match the saved layout.
      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toBe("구성 저장: 나무 2칸 — 위 [260] / 아래 [290] (세로)");
      expect(dataOf(result.data)).toEqual({ axis: "vertical", groupId: "tree-pair", tilesetId: COMBINED_TOWN_TILESET_ID });
      expect(grammarOf(ctx)).toEqual({
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "top", tileIds: [260] },
          { role: "bottom", tileIds: [290] },
        ],
        preserveCaps: true,
        repeat: "body",
      });
      expect(groupOf(ctx).tileIds).toEqual([100, 260, 290]);

      const sample = buildGroupSample(ctx.project.tilesets[COMBINED_TOWN_TILESET_ID], groupOf(ctx));
      expect(sample.w).toBe(5);
      expect(sample.h).toBe(2);
      expect(sample.upper[0]).toBe(260);
      expect(sample.lower[sample.w]).toBe(290);
      expect(sample.upper[sample.w]).toBe(TILE.EMPTY);
      expect(sample.lower[0]).toBe(TILE.GRASS);
    });

    it("가로 좌/우 구성을 leftCap/rightCap 문법으로 저장한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: the group layout is persisted as left/right.
      const result = runTool(ctx, "set_group_layout", {
        axis: "horizontal",
        groupId: "tree-pair",
        left: [210],
        right: [211],
        tilesetId: COMBINED_TOWN_TILESET_ID,
      });

      // Then: the horizontal expandable grammar uses the supported cap roles.
      expect(result.ok, result.summary).toBe(true);
      expect(grammarOf(ctx)).toEqual({
        axis: "horizontal",
        kind: "horizontal_expandable",
        minHeight: 1,
        minWidth: 2,
        parts: [
          { role: "leftCap", tileIds: [210] },
          { role: "rightCap", tileIds: [211] },
        ],
        preserveCaps: true,
        repeat: "body",
      });
      expect(groupOf(ctx).tileIds).toEqual([100, 210, 211]);
    });

    it("없는 그룹/타일셋, 축별 필수 파트 누락, 잘못된 타일 id를 거부한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: invalid layout requests are made.
      const missingGroup = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "missing", top: [260] });
      const missingTileset = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair", tilesetId: "missing", top: [260] });
      const missingVerticalParts = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair" });
      const invalidTile = runTool(ctx, "set_group_layout", { axis: "horizontal", groupId: "tree-pair", right: [9999] });

      // Then: all invalid calls fail without replacing the existing group layout.
      expect(missingGroup.ok).toBe(false);
      expect(missingGroup.issues?.[0]?.code).toBe("group-not-found");
      expect(missingTileset.ok).toBe(false);
      expect(missingTileset.issues?.[0]?.code).toBe("tileset-not-found");
      expect(missingVerticalParts.ok).toBe(false);
      expect(missingVerticalParts.issues?.[0]?.code).toBe("invalid-args");
      expect(invalidTile.ok).toBe(false);
      expect(invalidTile.issues?.[0]?.code).toBe("tile-out-of-range");
      expect(groupOf(ctx).patternGrammar).toBeUndefined();
    });

    it("레지스트리에 등록되고 브라우저는 활성 툴만 노출한다", () => {
      const toolNames = allTools().map((tool) => tool.name);
      // set_group_layout 은 deprecated 레거시 — getTool 호환만 유지, 브라우저 숨김.
      expect(toolNames).toContain("set_group_layout");
      expect(getTool("set_group_layout")?.deprecated).toBe(true);
      const categoryNames = TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name));
      expect(categoryNames).not.toContain("set_group_layout");
    });
  });
});
