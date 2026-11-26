import { afterEach, expect, it, describe, beforeEach, vi } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, resolveSpatialBuildSource, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { listSpatialGalleryCards } from "../src/editor/panels/spatialCatalog";
import { own, spatialId, occurrenceOrigin } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { deserialize, serialize } from "@/project/io";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { designUsage, matchesUsageFilter, usageSummary } from "@/editor/panels/spatialUsage";
import { instancesFixture } from "./support/spatialInstancesFixture";
import { renderCommitHistoryButton, renderIdentityTopbarControl, openLoginModalIfNeeded, openMockLoginModal, openCommitHistoryPanel, openIdentityMenu } from "@/editor/teamWorkflowUi";
import { listEditorCommands } from "@/editor/commandRegistry";
import { renderTopbar } from "@/editor/panels/menu";
import { createBlankProject } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { setTilesetMetadataEditMode } from "@/editor/panels/tilesetMetadataEditor";
import { setChipsetGridEditing } from "@/editor/panels/tilesetChipsetPreview";
import { setTileBackingOverride, userTileBackingOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { autotilePaintTile, classifyTerrainChip, paletteCatalogFor, paletteHasSmartCatalog, prefabChips, prefabThumbTiles, searchPaletteCatalog } from "@/editor/panels/tilePaletteCatalog";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "@/project/defaults/joseonBaram";
import type { AutotileGroup, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { autotileRepresentativeTile, buildCustomPaletteModel, buildGridPaletteModel, CUSTOM_PALETTE_MIN_CELL_SIZE, makeCustomPalette, makeGridPalette, GRID_PALETTE_COLUMNS, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import { createPaletteStampFromDisplayDrag, createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";
import { isolateTimers } from "./mergedTeardown";

describe("spatialManualBuildBoundary", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  it("builds canonical place maps when the gallery carries explicit library identity", () => {
    // Given
    const fixture = placeCompilerFixture();
    const document = fixtureDocument(fixture);
    const source = own(document.occurrences, placeRoot).source;
    const project = { ...fixture, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
    installManualProject(project);
    patchSpatialSession({ tab: "places", mode: "design" });
    const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === source.id);
    const canonical = authoringValue(resolveSpatialBuildSource(card));
    if (canonical.kind !== "place") throw new TypeError("Expected place source");
    // When
    const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: canonical.kind, id: canonical.id },
      rootId: spatialId("new-place-not-fixture-root"), seed: 19, destination: { kind: "new-maps" } }));
    // Then
    expect(card).toMatchObject({ canonicalSource: { kind: "place", id: source.id } });
    const built = fixtureDocument(preview.project);
    expect(built.rootOccurrenceIds).toEqual(["new-place-not-fixture-root"]);
    expect(Object.keys(preview.project.maps).length).toBeGreaterThan(Object.keys(project.maps).length);
    expect(Object.values(built.occurrences).every(occurrence => occurrence.seed === 19 && occurrence.parentSlot !== undefined)).toBe(true);
    expect(store.getCurrent()).toEqual(project);
  });
  it.each(["objects", "spaces"] as const)("carries true canonical identity for %s without deriving it from kit IDs", tab => {
    // Given
    manualBuildFixture();
    patchSpatialSession({ tab, mode: "design" });
    const id = tab === "objects" ? "hearth-design" : spaceDesign;
    const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === id);
    // When
    const source = authoringValue(resolveSpatialBuildSource(card));
    // Then
    expect(source).toEqual({ kind: tab === "objects" ? "object" : "space", id });
  });
  it("requires explicit conversion when a compatibility card has a coincident canonical localId", () => {
    // Given
    manualBuildFixture();
    const card = { id: "legacy-room", localId: spaceDesign, name: "Compiler room", source: "own", kind: "spaces",
      usage: 0, compatibility: "room-rule" } as const;
    // When
    const result = resolveSpatialBuildSource(card);
    // Then
    expect(result).toMatchObject({ kind: "error", error: { code: "unsupported", message: "canonical-copy-required" } });
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it.each(["selection", "entry", "map-mismatch", "fractional-seed"] as const)("rejects missing or invalid %s before a proposal is issued", fault => {
    // Given
    const { project, target } = manualBuildFixture();
    // When
    const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("invalid-target"),
      seed: fault === "fractional-seed" ? 19.5 : 19, destination: { kind: "map", currentMapId: target.mapId,
        selection: fault === "selection" ? null : { ...target.rect, mapId: fault === "map-mismatch" ? "other-map" : target.mapId },
        entry: fault === "entry" ? null : target.entry } });
    // Then
    expect(result.kind).toBe("error");
    expect(hasAuthoringPreview()).toBe(false);
    expect(store.getCurrent()).toEqual(project);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("discloses the original frozen proposal when source and seed controls change", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("disclosed-root"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    const preview = authoringValue(previewSpatialSourceBuild(input));
    patchSpatialSession({ designId: "another-visible-source" });
    // When
    const result = previewSpatialSourceBuild({ ...input, seed: 31 });
    // Then
    expect(result).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
    expect(spatialBuildProposal()).toEqual({ input, preview });
    expect(Object.isFrozen(spatialBuildProposal()?.input)).toBe(true);
  });
  it("drops transient build inputs when project identity changes", () => {
    // Given
    const { project } = manualBuildFixture();
    authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("project-one"), seed: 19,
      destination: { kind: "new-maps" } }));
    // When
    store.replaceProject(project);
    // Then
    expect(spatialBuildProposal()).toBeNull();
    expect(hasAuthoringPreview()).toBe(false);
  });
});

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

// OPRN-OUT-026 편집기 표면 — 사용자가 가져온 메타를 받아들이기 전에 홈 레이어와
// 받침 정책을 직접 보고 바꿀 수 있어야 한다. 검토 목록은 자동으로 적용되지 않는다.
describe("tileLayerPolicyEditorSurface", () => {
  isolateTimers();
  const CONIFER_TRUNK = 290;
  // 아래 시험은 칸 DOM 격자(「칸 편집」)를 다룬다 — 기본 보기는 정적 시트다(qa1124-space PR6).
  beforeEach(() => setChipsetGridEditing(true));
  afterEach(() => setChipsetGridEditing(false));
  describe("타일 레이어·배경 정책 편집기 표면", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
      restoreDom = installFakeDom();
      setTilesetMetadataEditMode("passage", () => {});
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    function renderEditor(): FakeElement {
      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
    }

    function selectTile(tile: number): FakeElement {
      let editor = renderEditor();
      (findByTestId(editor, `tileset-db-cell-${tile}`) as unknown as HTMLElement).click();
      editor = renderEditor();
      return editor;
    }

    it("밑동을 고르면 정책 부류·근거와 다중 조각 제약이 보인다", () => {
      const editor = selectTile(CONIFER_TRUNK);
      const reason = findByTestId(editor, "tileset-layer-policy-reason") as unknown as { textContent?: string };
      expect(String(reason.textContent ?? "")).toContain("받침 있는 하위");
      expect(findByTestId(editor, "tileset-layer-multipart")).toBeTruthy();
    });

    it("받침 컨트롤에서 없음을 고르면 사용자 확정으로 기록되고 렌더 받침이 사라진다", () => {
      let editor = selectTile(CONIFER_TRUNK);
      expect(findByTestId(editor, "tileset-rule-backing")).toBeTruthy();
      (findByTestId(editor, "tileset-backing-none") as unknown as HTMLElement).click();

      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(userTileBackingOverride(tileset, CONIFER_TRUNK)).toBe("none");
      expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();

      editor = selectTile(CONIFER_TRUNK);
      expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy();
    });

    it("받침을 잔디로 되돌리면 렌더 받침이 다시 붙는다", () => {
      selectTile(CONIFER_TRUNK);
      (findByTestId(renderEditor(), "tileset-backing-none") as unknown as HTMLElement).click();
      (findByTestId(renderEditor(), "tileset-backing-tile") as unknown as HTMLElement).click();

      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
    });

    it("검토 목록은 받침 없는 투명 하위 타일이 생길 때만 나타난다", () => {
      expect(findByTestId(selectTile(CONIFER_TRUNK), "tileset-rule-review")).toBeNull();

      store.update((project) => {
        const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
        if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      });

      const editor = selectTile(CONIFER_TRUNK);
      expect(findByTestId(editor, "tileset-rule-review")).toBeTruthy();
      expect(findByTestId(editor, `tileset-review-item-${CONIFER_TRUNK}`)).toBeTruthy();
    });

    it("검토 항목의 상위 오버레이 선택은 그 타일만 상위로 확정한다", () => {
      store.update((project) => {
        const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
        if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      });
      const editor = selectTile(CONIFER_TRUNK);
      (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-overlay`) as unknown as HTMLElement).click();

      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBe("upper");
      expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("upper");
      expect(tileLayerHome(tileset, 291)).toBe("lower");
    });

    it("검토 항목의 자동 선택은 하네스 기본값으로 되돌린다", () => {
      store.update((project) => {
        const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
        if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      });
      const editor = selectTile(CONIFER_TRUNK);
      (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-auto`) as unknown as HTMLElement).click();

      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBeNull();
      expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("lower");
      expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
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
