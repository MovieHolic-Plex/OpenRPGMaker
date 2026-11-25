import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { occurrenceOrigin } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { designUsage, matchesUsageFilter, usageSummary } from "@/editor/panels/spatialUsage";
import { instancesFixture } from "./support/spatialInstancesFixture";
import { renderCommitHistoryButton, renderIdentityTopbarControl, openLoginModalIfNeeded, openMockLoginModal, openCommitHistoryPanel, openIdentityMenu } from "@/editor/teamWorkflowUi";
import { listEditorCommands } from "@/editor/commandRegistry";
import { renderTopbar } from "@/editor/panels/menu";
import { createBlankProject, COMBINED_TOWN_TILESET_ID } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import { autotilePaintTile, classifyTerrainChip, paletteCatalogFor, paletteHasSmartCatalog, prefabChips, prefabThumbTiles, searchPaletteCatalog } from "@/editor/panels/tilePaletteCatalog";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "@/project/defaults/joseonBaram";
import type { AutotileGroup, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { autotileRepresentativeTile, buildCustomPaletteModel, buildGridPaletteModel, CUSTOM_PALETTE_MIN_CELL_SIZE, makeCustomPalette, makeGridPalette, GRID_PALETTE_COLUMNS, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import { createPaletteStampFromDisplayDrag, createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";
import { applyAutotileSheetPick, renderAutotileEditorPanel, renderAutotileLayoutToolbar, resetAutotileComposerState } from "@/editor/panels/tilesetAutotileEditor";
import { autotileGroupsForTileset, DEFAULT_AUTOTILE_GROUPS, DEFAULT_COBBLE_AUTOTILE_GROUP, templateBlockFromAnchor, TERRAIN_TEMPLATE_ANCHORS } from "@/project/defaults/autotileGroups";
import { DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT, TILE } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { buildAnimatedWaterStrip, buildTemplateGroup, previewTemplateTiles } from "@/editor/panels/tilesetAutotileTemplates";
import { addAutotileGroupFromTemplate } from "@/editor/tilesetActions";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { COBBLE_TILE, CHIPSET_TILE_GROUPS, isSolidChipsetTile, isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { animationFrameForTile, animationStripForTile, CHIPSET_ANIMATION_FRAME_TILES } from "@/project/defaults/chipsetAnimation";
import { filledRoleCount, groupPatchFromRoles, inferAutotileLayoutKind, layoutLabel, rolesFromGroup, tilesInLayoutBlock } from "@/editor/panels/tilesetAutotileLayout";
import { beginGridSelectionDrag, cancelGridSelectionDrag, commitGridSelectionDrag, createGridSelectionState, gridSelectionGeometry, selectGridTile, updateGridSelectionDrag } from "@/editor/panels/tilesetGridSelection";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { activateKnowledgeWorkspace, beginKnowledgeDrag, chooseKnowledgeTemplate, clearKnowledgeSelection, knowledgeDraft, knowledgeSelection, loadKnowledgeGroup, loadKnowledgeProposal, saveKnowledgeDraft, selectKnowledgeTile, updateKnowledgeDraft } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
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
import { isolateTimers } from "./mergedTeardown";

describe("spatialOccurrenceOrigin", () => {
  isolateTimers();
  describe("occurrence origin stamp", () => {
    it("threads an ai origin from the instantiation request into every created occurrence and survives IO", () => {
      // Given
      const { project, document, request } = instancesFixture();
      // When
      const result = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
      const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
      // Then
      const occurrences = Object.values(reloaded?.occurrences ?? {});
      expect(occurrences.length).toBeGreaterThan(0);
      expect(occurrences.every((entry) => entry.origin === "ai")).toBe(true);
      expect(occurrences.every((entry) => occurrenceOrigin(entry) === "ai")).toBe(true);
    });

    it("keeps historical occurrences unstamped and classifies them by the generator tag", () => {
      // Given
      const { project, document, request } = instancesFixture();
      // When: no origin in the request, exactly like pre-field data.
      const result = instantiateSpatialDesign(document, project, request);
      const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
      // Then: the field stays absent; classification falls back to the tag.
      expect(Object.values(reloaded?.occurrences ?? {}).every((entry) => entry.origin === undefined)).toBe(true);
      expect(occurrenceOrigin({ generatorVersion: "spatial-ai-v1" })).toBe("ai");
      expect(occurrenceOrigin({ generatorVersion: "spatial-legacy-house-v1" })).toBe("ai");
      expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1" })).toBe("user");
      expect(occurrenceOrigin({ generatorVersion: "place-room-editor-v1" })).toBe("user");
      expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1", origin: "ai" })).toBe("ai");
    });

    it("aggregates per-design usage with ai and direct counts for the gallery", () => {
      // Given: one ai build and the design ids it references.
      const { project, document, request } = instancesFixture();
      const built = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
      const authored = { ...project, spatialAuthoring: built };
      const anyOccurrence = Object.values(built.occurrences)[0];
      // When
      const usage = designUsage(authored, anyOccurrence.source.id);
      // Then
      expect(usage.rows.length).toBeGreaterThan(0);
      expect(usage.ai).toBe(usage.rows.length);
      expect(usage.direct).toBe(0);
      expect(usageSummary(usage)).toContain("AI");
      expect(matchesUsageFilter(usage, "ai")).toBe(true);
      expect(matchesUsageFilter(usage, "idle")).toBe(false);
      expect(matchesUsageFilter(usage, "placed")).toBe(true);
      // And: an unused design id lands in the idle bucket.
      const idle = designUsage(authored, "design-that-was-never-placed");
      expect(usageSummary(idle)).toBe("아직 안 쓰임");
      expect(matchesUsageFilter(idle, "idle")).toBe(true);
      expect(matchesUsageFilter(idle, "ai")).toBe(false);
    });
  });
});

describe("teamWorkflowUi", () => {
  isolateTimers();
  const COMMIT_ROWS = [
    {
      agentName: null,
      authorId: "session-1",
      authorKind: "human",
      authorLabel: "tester@example.com",
      commitId: "commit-1",
      createdAt: "2026-07-06T12:00:00.000Z",
      message: "변경 저장",
      reviewStatus: "direct",
      summary: "타일 3",
    },
  ] as const;
  const OWNER_LABEL_KEY = "oprn:editor-owner-label";
  const LAST_LOGIN_METHOD_KEY = "oprn:editor-last-login-method";
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
  let session: MemoryProjectSession | null = null;
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  function fakeElement(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("Expected fake element");
  }
  function installStorage(): void {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
  function installWindow(): void {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: Object.assign(new EventTarget(), {
        localStorage: storage,
        setTimeout: (handler: TimerHandler) => {
          if (typeof handler === "function") handler();
          return 0;
        },
      }),
    });
    Object.defineProperty(document, "addEventListener", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, "removeEventListener", {
      configurable: true,
      value: vi.fn(),
    });
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    installStorage();
    installWindow();
    // 커밋 목록은 포트가 정본이다. 예전에는 sync 모듈을 목킹했는데, 그 목은 기본 어댑터가
    // LegacyDb 일 때만 살아 있었다 — 기본값이 바뀌면 조용히 빈 목록을 검증하게 된다.
    session = installMemoryProjectSession();
    vi.spyOn(session.repository.commits, "list").mockResolvedValue([...COMMIT_ROWS]);
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    session?.dispose();
    session = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });
  describe("team workflow UI", () => {
    it("명시적으로 열면 이메일 신원을 저장한다 (네트워크 인증 없음)", () => {
      openMockLoginModal();
      const modal = findByTestId(fakeBody(), "login-modal");
      const email = findByTestId(fakeBody(), "login-email") as FakeElement | null;
      const submit = findByTestId(fakeBody(), "login-submit");
      if (!modal || !email || !submit) throw new Error("login modal controls missing");

      email.value = "tester@example.com";
      submit.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const form = submit.parentElement;
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("tester@example.com");
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("email");
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
    });

    it("부팅 게이트는 로그인 벽을 세우지 않고 게스트 신원만 확보한다", () => {
      // 2026-09-22: 이 모달은 "로그인" 이지만 실제로는 커밋 이름표만 정한다. 팀 권한과 코드 경로가
      // 겹치지 않으므로 팀을 안 쓰는 사용자에게는 의미 없는 관문이었고, 한 번 넘기면 영영 안 떠서
      // 정작 팀을 시작하려는 사람에게 안내가 없었다. 부팅에서는 묻지 않는다.
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
      // 사용자가 아무것도 안 했는데 「목업 로그인 신원을 설정했습니다」가 뜨면 개발용 문구가 첫 화면에 샌다.
      expect(findByTestId(fakeBody(), "toast")).toBeNull();
    });

    it("suppresses the boot login modal in automation/dev boot contexts", () => {
      (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?freshProject=1" };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

      (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?blankProject=1" };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
    });

    it("auto-guests for deep-linked ?project= without showing login modal", () => {
      (globalThis.window as unknown as { location?: { search: string } }).location = {
        search: "?project=rpg-zzu-narrative-horror-demos",
      };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
    });

    it("switches OAuth to name-only mock flow and stores the selected provider", () => {
      // 부팅 게이트는 더 이상 모달을 열지 않으므로, OAuth 흐름은 명시적 호출로 확인한다.
      openMockLoginModal();
      findByTestId(fakeBody(), "login-oauth-google")?.click();
      const name = findByTestId(fakeBody(), "login-name") as FakeElement | null;
      if (!name) throw new Error("login-name missing");
      name.value = "Google 리뷰어";
      name.parentElement?.parentElement?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("Google 리뷰어");
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("google");
    });

    it("renders topbar identity and allows label edits from the identity menu", () => {
      setOwnerLabel("기존 사용자");
      const topbar = document.createElement("div");
      // 톱바는 더 이상 신원 단추를 그리지 않는다(⌘K 「편집 이름」) — 단추만 다시 그려 갱신을 본다.
      const rerender = (): void => { topbar.replaceChildren(renderIdentityTopbarControl(rerender)); };
      rerender();
      expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("기존 사용자");

      findByTestId(fakeElement(topbar), "topbar-identity")?.click();
      const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
      if (!input) throw new Error("identity input missing");
      input.value = "새 사용자";
      findByTestId(fakeBody(), "identity-save")?.click();

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("새 사용자");
      expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("새 사용자");
    });

    it("loads commit history rows through the read-only LegacyDb commit API", async () => {
      const button = renderCommitHistoryButton();
      document.body.append(button);

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();
      expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("tester@example.com");
      expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("direct");
    });

    it("⌘K 저장 기록·편집 이름 명령이 톱바 단추 없이 같은 패널·메뉴를 연다", async () => {
      // Break: 2026-11 개편으로 톱바 단추를 뺀 뒤 저장 기록·편집 이름에 닿는 길이 사라진다.
      const ids = listEditorCommands().map((command) => command.id);
      expect(ids).toContain("commit-history-toggle");
      expect(ids).toContain("topbar-identity");
      const topbar = document.createElement("div");
      renderTopbar(topbar);
      expect(findByTestId(fakeElement(topbar), "commit-history-toggle")).toBeNull();
      expect(findByTestId(fakeElement(topbar), "topbar-identity")).toBeNull();

      openCommitHistoryPanel();
      await Promise.resolve();
      await Promise.resolve();
      expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();

      setOwnerLabel("기존 사용자");
      openIdentityMenu(() => undefined);
      expect(findByTestId(fakeBody(), "commit-history-panel"), "한 번에 하나만 뜬다").toBeNull();
      const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
      expect(input?.value).toBe("기존 사용자");
    });

    it("renders history and identity as icon-only controls", () => {
      setOwnerLabel("게스트");
      const history = renderCommitHistoryButton();
      const identity = renderIdentityTopbarControl(() => undefined);
      document.body.append(history, identity);

      expect(history.className).toContain("is-icon-only");
      expect(history.getAttribute("aria-label")).toBe("저장 기록");
      expect(history.textContent?.includes("기록")).toBe(false);
      expect(identity.className).toContain("is-icon-only");
      expect(findByTestId(fakeElement(identity), "topbar-identity-label")?.textContent).toBe("게스트");
    });
  });
});

describe("tilePalette", () => {
  isolateTimers();
  describe("tilePaletteCatalog", () => {
    isolateTimers();
    function pass(count: number) {
      return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
    }
    function kit(partial: Pick<SectionStructureKitDef, "id" | "name" | "width" | "height" | "rows"> & {
      role?: "building" | "prop";
      themes?: string[];
      tags?: string[];
    }): SectionStructureKitDef {
      return {
        id: partial.id,
        name: partial.name,
        kind: "section",
        width: partial.width,
        height: partial.height,
        rows: partial.rows,
        learnedFrom: "user-paint",
        ai: {
          description: partial.name ?? partial.id,
          placementRules: "",
          role: partial.role,
          themes: partial.themes,
          tags: partial.tags,
        },
      };
    }
    function roadGroup(): AutotileGroup {
      return {
        id: "dirt-road",
        name: "조선 흙길",
        memberTileIds: [1, 8],
        variantMap: { "0": 1, "255": 8 },
        layer: "lower",
      };
    }
    function fixture(): TilesetDef {
      const count = 16;
      return {
        id: "catalog-fixture",
        name: "합성",
        kind: "custom",
        image: { type: "bundled", id: "catalog-sheet" },
        tileSize: 16,
        count,
        tilesPerRow: 8,
        passability: pass(count),
        priority: Array.from({ length: count }, () => "lower"),
        terrain: Array(count).fill(0),
        tileMeta: [
          undefined,
          { label: "흙길 외곽" },
          undefined,
          { label: "연못" },
          { label: "기와 조각", tags: ["기와"] },
        ],
        autotileGroups: [roadGroup()],
        tileGroups: [
          {
            id: "pond",
            name: "연못",
            role: "water",
            defaultLayer: "lower",
            tileIds: [3],
            description: "",
            placementRules: "",
          },
          {
            id: "road-dup",
            name: "조선 흙길 (오토타일)",
            role: "terrain",
            defaultLayer: "lower",
            tileIds: [1, 8],
            description: "",
            placementRules: "",
          },
          {
            id: "house-group",
            name: "기와 묶음",
            role: "building",
            defaultLayer: "lower",
            tileIds: [4],
            description: "",
            placementRules: "",
          },
        ],
        structureKits: [
          kit({
            id: "giwa-house",
            name: "조선 기와집",
            width: 2,
            height: 2,
            rows: [{ tiles: [4, 5] }, { tiles: [4, 5] }],
            role: "building",
            themes: ["village", "마을"],
            tags: ["기와"],
          }),
        ],
      };
    }
    describe("tile palette catalog", () => {
      it("paints an autotile from the filled neighbor and files a dirt road under 길", () => {
        const group = roadGroup();
        expect(autotilePaintTile(group)).toBe(8);
        expect(classifyTerrainChip("조선 흙길", "dirt-road", "", [])).toBe("road");
        const road = paletteCatalogFor(fixture()).terrain.find((card) => card.autotileGroupId === "dirt-road");
        expect(road).toMatchObject({ kind: "autotile", chip: "road", paintTile: 8, name: "조선 흙길" });
      });

      it("drops a tile group that is already an autotile and keeps water and buildings searchable", () => {
        const catalog = paletteCatalogFor(fixture());
        expect(catalog.terrain.map((card) => card.name)).not.toContain("조선 흙길 (오토타일)");
        expect(catalog.terrain.map((card) => card.chip)).toContain("water");
        expect(catalog.otherGroups.map((card) => card.name)).toEqual(["기와 묶음"]);
      });

      it("ranks prefabs ahead of individual tiles and prefers Hangul theme chips", () => {
        const tileset = fixture();
        const found = searchPaletteCatalog(tileset, "기와");
        expect(found.prefabs.map((hit) => hit.kind === "prefab" ? hit.card.name : "")).toContain("조선 기와집");
        expect(found.tiles.map((hit) => hit.kind === "tile" ? hit.label : "")).toContain("기와 조각");
        expect(found.prefabTotal).toBeGreaterThan(0);
        expect(found.tileTotal).toBeGreaterThan(0);
        const chips = prefabChips(paletteCatalogFor(tileset).prefabs);
        expect(chips.map((chip) => chip.label)).toContain("마을");
        expect(chips.map((chip) => chip.label)).not.toContain("village");
      });

      it("samples a prefab mosaic in the kit's own column count", () => {
        const house = fixture().structureKits![0]!;
        expect(prefabThumbTiles(house, 16)).toEqual({ columns: 2, tiles: [4, 5, 4, 5] });
      });

      it("has no smart catalog when the tileset has no groups or kits", () => {
        const bare = fixture();
        bare.autotileGroups = [];
        bare.tileGroups = [];
        bare.structureKits = [];
        expect(paletteHasSmartCatalog(bare)).toBe(false);
      });

      it("builds joseon terrain from the real autotile body and skips the duplicate road group", () => {
        const tileset = createJoseonBaramTileset();
        const started = performance.now();
        const catalog = paletteCatalogFor(tileset);
        expect(performance.now() - started).toBeLessThan(1000);
        const road = tileset.autotileGroups?.find((group) => group.name === "조선 흙길");
        expect(road?.variantMap["255"]).toEqual(expect.any(Number));
        const card = catalog.terrain.find((item) => item.autotileGroupId === road?.id);
        expect(card).toMatchObject({ name: "조선 흙길", kind: "autotile", paintTile: road?.variantMap["255"] });
        expect(catalog.terrain.some((item) => item.name === "조선 흙길 (오토타일)")).toBe(false);
        const found = searchPaletteCatalog(tileset, "기와집");
        expect(found.prefabs.some((hit) => hit.kind === "prefab" && hit.card.name.includes("기와집"))).toBe(true);
      });

      it("builds beodeul prefabs and a named road card", () => {
        const catalog = paletteCatalogFor(createBeodeulCityTileset());
        expect(catalog.prefabs.length).toBeGreaterThan(100);
        expect(catalog.terrain.some((card) => card.name.includes("버들항 길"))).toBe(true);
      });
    });
  });
  describe("tilePaletteGrid", () => {
    isolateTimers();
    // RM2003식 팔레트 모델 — 6열 리플로우 대상 목록(오토타일 대표 축약 + 변형 숨김) 순수 계산 검증.
    // 오토타일 그룹 목록은 autotileGroupsForTileset() 동적 조회이므로, 내장 그룹이 추가되어도
    // 깨지지 않도록 "포함/제외" 단위로만 단언한다(전체 목록 동등 비교 금지).

    const COMBINED_TOWN_COUNT = 480;
    function makeDefaultTileset(overrides?: Partial<TilesetDef>): TilesetDef {
      return {
        count: COMBINED_TOWN_COUNT,
        id: "combined_town_test",
        kind: "rpg2k",
        image: { id: "tex_easyrpg_chipset_combined_town", type: "bundled" },
        name: "Combined town",
        passability: Array.from({ length: COMBINED_TOWN_COUNT }, () => ({ down: true, left: true, right: true, up: true })),
        priority: Array.from({ length: COMBINED_TOWN_COUNT }, () => "lower" as const),
        terrain: Array.from({ length: COMBINED_TOWN_COUNT }, () => 0),
        tileSize: 16,
        tilesPerRow: 30,
        ...overrides,
      };
    }
    function makeCustomTileset(groups: AutotileGroup[]): TilesetDef {
      return makeDefaultTileset({
        kind: "custom",
        autotileGroups: groups,
        count: 32,
        id: "custom_test",
        image: { id: "tex_custom_sheet", type: "bundled" },
        tilesPerRow: 8,
      });
    }
    function unionTileIds(tileset: TilesetDef): ReadonlySet<number> {
      return new Set([
        ...buildGridPaletteModel(tileset, "lower").tileIds,
        ...buildGridPaletteModel(tileset, "upper").tileIds,
      ]);
    }
    describe("buildGridPaletteModel (RM2003식 6열 팔레트 모델)", () => {
      it("fixes the palette reflow at 6 columns", () => {
        expect(GRID_PALETTE_COLUMNS).toBe(6);
      });

      it("collapses water/waterfall and builtin autotile groups to single representative cells up front", () => {
        const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
        const reps = model.autotiles.map((entry) => entry.representativeTile);

        // RM2K식: 물(0)·폭포(93)가 맨 앞, 이어서 오토타일 그룹 대표(외딴/anchor).
        expect(reps[0]).toBe(0);
        expect(reps[1]).toBe(93);
        expect(reps).toContain(360); // 흙길
        expect(reps).toContain(363); // 모래
        expect(reps).toContain(129); // 포석
        expect(reps).toContain(126); // 경작지
        // 대표는 중복 없이 1칸씩.
        expect(new Set(reps).size).toBe(reps.length);
      });

      it("hides variantMap output tiles and water animation frames from the plain listing", () => {
        const tileset = makeDefaultTileset();
        const listed = unionTileIds(tileset);

        // 흙길 몸통/변 변형, 모래 몸통, 포석 몸통, 호수·폭포 프레임은 일반 나열에서 숨김.
        for (const hiddenTile of [421, 391, 424, 190, 120, 94, 0, 93, 360, 363]) {
          expect(listed.has(hiddenTile)).toBe(false);
        }
        // 오토타일이 아닌 일반 타일(돌바닥 342)은 그대로 나열.
        expect(listed.has(342)).toBe(true);
      });

      it("keeps the plain listing sorted, unique, and disjoint from representatives", () => {
        const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
        const sorted = [...model.tileIds].sort((a, b) => a - b);

        expect(model.tileIds).toEqual(sorted);
        expect(new Set(model.tileIds).size).toBe(model.tileIds.length);
        for (const entry of model.autotiles) {
          expect(model.tileIds).not.toContain(entry.representativeTile);
        }
      });

      it("uses tileset autotile groups (no water entries) for non-default chipsets", () => {
        const group: AutotileGroup = {
          id: "custom_floor",
          memberTileIds: [5, 6, 7],
          name: "커스텀 바닥",
          variantMap: { "0": 5, "1": 6, "2": 7 },
        };
        const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");

        expect(model.autotiles).toEqual([{ id: "custom_floor", name: "커스텀 바닥", representativeTile: 5 }]);
        expect(model.tileIds).not.toContain(6);
        expect(model.tileIds).not.toContain(7);
        // 물 축약은 combined_town 전용 — 커스텀 칩셋에서는 0이 일반 타일.
        expect(model.tileIds).toContain(0);
      });

      it("falls back to the first member when a group has no mask-0 variant", () => {
        const group: AutotileGroup = {
          id: "no_isolated",
          memberTileIds: [9, 10],
          name: "외딴 없음",
          variantMap: { "15": 10 },
        };
        expect(autotileRepresentativeTile(group)).toBe(9);
        const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
        expect(model.autotiles[0]?.representativeTile).toBe(9);
      });

      it("skips groups whose representative is outside the tileset", () => {
        const group: AutotileGroup = {
          id: "out_of_range",
          memberTileIds: [999],
          name: "범위 밖",
          variantMap: { "0": 999 },
        };
        const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
        expect(model.autotiles).toEqual([]);
      });
    });
    describe("gridPaletteDisplayTile (숨겨진 변형 → 대표 칸 매핑)", () => {
      it("maps hidden autotile variants and water frames to their representative", () => {
        const tileset = makeDefaultTileset();
        expect(gridPaletteDisplayTile(tileset, 421)).toBe(360); // 흙길 몸통 → 대표
        expect(gridPaletteDisplayTile(tileset, 1)).toBe(0); // 호수 프레임 → 물 대표
        expect(gridPaletteDisplayTile(tileset, 123)).toBe(93); // 폭포 프레임 → 폭포 대표
        expect(gridPaletteDisplayTile(tileset, 465)).toBe(465); // 일반 타일은 그대로
      });
    });
    describe("custom atlas palette", () => {
      it("infers kind-less uploaded and non-480 atlases as custom", () => {
        const uploaded = makeDefaultTileset({ kind: undefined, image: { id: "legacy_upload", type: "uploaded" } });
        const non480 = makeDefaultTileset({ kind: undefined, count: 32 });
        expect(buildCustomPaletteModel(uploaded)).toHaveLength(480);
        expect(buildCustomPaletteModel(non480)).toHaveLength(32);
      });

      it("lists exact source cells without RM2K autotile collapse", () => {
        const tileset = makeCustomTileset([{
          id: "custom_floor",
          memberTileIds: [5, 6, 7],
          name: "커스텀 바닥",
          variantMap: { "0": 5, "1": 6, "2": 7 },
        }]);

        expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
      });

      it("keeps the complete source sheet visible regardless of the active layer", () => {
        const tileset = makeCustomTileset([]);
        tileset.priority[3] = "upper";
        tileset.priority[11] = "upper";

        expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
      });

      it("keeps source rows contiguous in the custom palette", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeCustomTileset([]);
          tileset.count = 480;
          tileset.tilesPerRow = 30;
          const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset }));
          expect(root.dataset.paletteKind).toBe("custom");
          expect(root.dataset.sourceColumns).toBe("30");
          expect(root.dataset.sourceRows).toBe("16");
          expect(root.dataset.displayColumns).toBe("30");
          expect(root.getAttribute("style")).toContain("--custom-cols:30");
          expect(root.getAttribute("style")).toContain(`--custom-min-cell:${CUSTOM_PALETTE_MIN_CELL_SIZE}px`);
          expect(root.querySelectorAll("button")).toHaveLength(480);
        } finally {
          restore();
        }
      });
    });
    // 좌패널 1면 통합(2026-08-21): 검색·분류 필터가 **이 팔레트 하나**에 걸린다.
    // 예전에는 「찾기」 탭이 별개 그리드로 타일셋을 두 번째로 그렸고, 오토타일 대표 1칸
    // 규칙을 안 따라 같은 칩셋이 탭에 따라 다르게 보였다.
    describe("팔레트 필터 (visibleTiles)", () => {
      it("필터가 없으면(null) 전량 노출한다", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeDefaultTileset();
          const unfiltered = renderWithFakeDom(() =>
            makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset })
          );
          const explicitNull = renderWithFakeDom(() =>
            makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset, visibleTiles: null })
          );
          expect(explicitNull.querySelectorAll("button").length).toBe(unfiltered.querySelectorAll("button").length);
          expect(unfiltered.querySelectorAll("button").length).toBeGreaterThan(20);
        } finally {
          restore();
        }
      });

      it("6열 리플로우 팔레트는 걸러진 칸을 숨긴다 — 위치가 정보가 아니므로", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeDefaultTileset();
          const root = renderWithFakeDom(() =>
            makeGridPalette({
              layer: "lower",
              onSelectTile: () => undefined,
              selectedTile: 342,
              tileset,
              visibleTiles: new Set([342]),
            })
          );
          // 선택 타일 하나만 남는다(선택은 항상 예외로 그려진다).
          expect(root.querySelectorAll("button")).toHaveLength(1);
          expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
        } finally {
          restore();
        }
      });

      it("선택 타일은 필터에 안 걸려도 항상 그린다 — 안 그러면 '선택 중'인 칸이 사라진다", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeDefaultTileset();
          const root = renderWithFakeDom(() =>
            makeGridPalette({
              layer: "lower",
              onSelectTile: () => undefined,
              selectedTile: 342,
              tileset,
              // 342 는 필터 밖이다.
              visibleTiles: new Set([465]),
            })
          );
          expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
          expect(root.querySelector('[data-testid="chipset-tile-465"]')).not.toBeNull();
          expect(root.querySelectorAll("button")).toHaveLength(2);
        } finally {
          restore();
        }
      });

      it("결과가 0이면 빈 안내를 남긴다", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeDefaultTileset();
          const root = renderWithFakeDom(() =>
            makeGridPalette({
              layer: "lower",
              onSelectTile: () => undefined,
              selectedTile: -1,
              tileset,
              visibleTiles: new Set<number>(),
            })
          );
          expect(root.querySelectorAll("button")).toHaveLength(0);
          expect(root.querySelector('[data-testid="palette-filter-empty"]')).not.toBeNull();
        } finally {
          restore();
        }
      });

      it("커스텀 아틀라스는 숨기지 않고 흐리게 한다 — 칸의 위치가 원본 시트 좌표다", () => {
        const restore = installFakeDom();
        try {
          const tileset = makeCustomTileset([]);
          const root = renderWithFakeDom(() =>
            makeCustomPalette({
              layer: "lower",
              onSelectTile: () => undefined,
              selectedTile: 0,
              tileset,
              visibleTiles: new Set([5]),
            })
          );
          // 32칸 전부 남아 아틀라스 모양이 유지된다.
          expect(root.querySelectorAll("button")).toHaveLength(32);
          const kept = root.querySelector('[data-testid="chipset-tile-5"]');
          const dimmed = root.querySelector('[data-testid="chipset-tile-9"]');
          expect(kept?.className).not.toContain("is-filtered-out");
          expect(dimmed?.className).toContain("is-filtered-out");
        } finally {
          restore();
        }
      });
    });
    describe("칸 선택 입력은 판 하나가 받는다", () => {
      function dispatch(target: HTMLElement, type: string, init: Record<string, unknown> = {}): void {
        const event = new Event(type, { bubbles: true, cancelable: true });
        for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { configurable: true, value });
        target.dispatchEvent(event);
      }

      it("포인터·보조기기 클릭·Enter 가 누른 칸의 타일을 한 번씩 고른다", () => {
        const restore = installFakeDom();
        try {
          const picked: number[] = [];
          const tileset = makeCustomTileset([]);
          tileset.count = 64;
          tileset.tilesPerRow = 8;
          const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: (tile) => picked.push(tile), selectedTile: 0, tileset }));
          const cell = root.querySelector<HTMLElement>('[data-testid="chipset-tile-9"]')!;

          dispatch(cell, "pointerdown", { button: 0 });
          dispatch(cell, "click", { detail: 1 });
          dispatch(cell, "pointerdown", { button: 2 });
          expect(picked).toEqual([9]);

          dispatch(cell, "click", { detail: 0 });
          dispatch(root.querySelector<HTMLElement>('[data-testid="chipset-tile-10"]')!, "keydown", { key: "Enter" });
          expect(picked).toEqual([9, 9, 10]);
        } finally {
          restore();
        }
      });
    });
  });
  describe("tilePaletteStamp", () => {
    isolateTimers();
    describe("tile palette drag stamps", () => {
      it("creates a source-preserving 3x3 stamp from dragged chipset tiles", () => {
        const tileset = testTileset();

        const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

        expect(stamp.width).toBe(3);
        expect(stamp.height).toBe(3);
        expect(stamp.cells.map((cell) => cell.tile)).toEqual([10, 11, 12, 18, 19, 20, 26, 27, 28]);
        expect(stamp.cells.find((cell) => cell.tile === 19)).toEqual({ dx: 1, dy: 1, layer: "upper", tile: 19 });
      });

      it("marks every source tile inside the dragged rectangle", () => {
        const tileset = testTileset();
        const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

        expect(paletteStampIncludesTile(stamp, 19, tileset.tilesPerRow)).toBe(true);
        expect(paletteStampIncludesTile(stamp, 29, tileset.tilesPerRow)).toBe(false);
      });

      it("creates a stamp from the visible reordered palette grid", () => {
        const tileset = testTileset();
        const displayTiles = [240, 303, 421, 424, 342, 343, 306, 366, 374, 375, 270, 120, 93, 123, 153, 246];

        const stamp = createPaletteStampFromDisplayDrag({
          displayTiles,
          displayTilesPerRow: 10,
          endTile: 270,
          startTile: 303,
          tileset: { ...tileset, count: 512 },
        });

        expect(stamp.width).toBe(2);
        expect(stamp.height).toBe(2);
        expect(stamp.cells.map((cell) => cell.tile)).toEqual([240, 303, 270, 120]);
        expect(paletteStampIncludesTile(stamp, 303, tileset.tilesPerRow)).toBe(true);
        expect(paletteStampIncludesTile(stamp, 342, tileset.tilesPerRow)).toBe(false);
      });
    });
    function testTileset(): TilesetDef {
      return {
        count: 64,
        id: "test",
        image: { id: "test-image", type: "uploaded" },
        name: "Test",
        passability: Array.from({ length: 64 }, () => ({ down: true, left: true, right: true, up: true })),
        priority: Array.from({ length: 64 }, (_, index) => index === 19 ? "upper" : "lower"),
        terrain: Array.from({ length: 64 }, () => 0),
        tileSize: 16,
        tilesPerRow: 8,
      };
    }
  });
});

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
