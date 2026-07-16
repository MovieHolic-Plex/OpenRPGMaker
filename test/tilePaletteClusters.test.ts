import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import {
  createTileClusterSections,
  tileGroupGridColumns,
  tilePatternKindLabel,
} from "@/editor/panels/tilePaletteClusters";
import { createBlankProject, TILE } from "@/project/defaults";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
let previousWindow: (Window & typeof globalThis) | undefined;
let storage: MemoryStorage;

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({
    activePaletteStamp: null,
    activeStampId: null,
    activeStructureStampId: null,
    currentMapId: null,
    layer: "lower",
    selectedTile: TILE.GRASS,
    tool: "paint",
  });
  restoreDom = installFakeDom();
  Object.defineProperty(globalThis.document, "createElementNS", {
    configurable: true,
    value: (_namespace: string, tagName: string) => new FakeElement(tagName),
  });
  storage = new MemoryStorage();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      requestAnimationFrame: (callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      },
      scrollTo: () => undefined,
      scrollX: 0,
      scrollY: 0,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  restoreWindow(previousWindow);
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("tile palette cluster partition", () => {
  it("keeps grouped, labeled, and uncategorized tiles disjoint while covering the whole tileset", () => {
    const tileset = makeTileset({
      count: 10,
      tileGroups: [
        makeGroup("wall", "wall", [1, 2, 3]),
        makeGroup("water", "water", [5, 6]),
      ],
      tileMeta: {
        0: "잔디",
        2: "그룹 안 라벨",
        7: "표지판",
      },
    });

    const sections = createTileClusterSections(tileset);
    const grouped = sections.groups.flatMap((group) => group.tileIds);
    const all = [...grouped, ...sections.labeledTileIds, ...sections.uncategorizedTileIds];

    expect(new Set(all).size).toBe(tileset.count);
    expect([...all].sort((a, b) => a - b)).toEqual(Array.from({ length: tileset.count }, (_, index) => index));
    expect(sections.labeledTileIds).toEqual([0, 7]);
    expect(sections.uncategorizedTileIds).toEqual([4, 8, 9]);
  });

  it("sorts groups by metadata role order", () => {
    const tileset = makeTileset({
      count: 8,
      tileGroups: [
        makeGroup("prop", "prop", [7]),
        makeGroup("wall", "wall", [3]),
        makeGroup("terrain", "terrain", [0]),
        makeGroup("water", "water", [1]),
      ],
    });

    expect(createTileClusterSections(tileset).groups.map((group) => group.id)).toEqual(["terrain", "water", "wall", "prop"]);
  });

  it("maps pattern grammar kinds to Korean badges and preserves source-rect columns", () => {
    expect(tilePatternKindLabel("autotile_3x3")).toBe("3×3");
    expect(tilePatternKindLabel("nine_slice_expandable")).toBe("9분할");
    expect(tilePatternKindLabel("horizontal_expandable")).toBe("가로 확장");
    expect(tilePatternKindLabel("vertical_expandable")).toBe("세로 확장");
    expect(tilePatternKindLabel("animated_terrain")).toBe("애니");
    expect(tilePatternKindLabel("single")).toBe("단일");
    expect(tilePatternKindLabel("source_rect")).toBe("영역");
    expect(tilePatternKindLabel("overlay_detail")).toBe("장식");
    expect(tilePatternKindLabel("event_required_object")).toBe("이벤트");
    expect(tileGroupGridColumns({ ...makeGroup("wall", "wall", [1, 2, 3, 4, 5, 6, 7, 8, 9]), sourceRect: { x: 0, y: 0, width: 3, height: 3 } })).toBe(3);
    expect(tileGroupGridColumns(makeGroup("flow", "terrain", [1, 2, 3]))).toBe(8);
  });

  it("hides unsupported nine-slice palette badges while keeping executable tree grammar badges", () => {
    const wall = makeGroup("wall9", "wall", [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    wall.patternGrammar = {
      axis: "both",
      kind: "nine_slice_expandable",
      minHeight: 3,
      minWidth: 3,
      parts: [
        { role: "topLeft", tileIds: [1] },
        { role: "top", tileIds: [2] },
        { role: "topRight", tileIds: [3] },
        { role: "left", tileIds: [4] },
        { role: "center", tileIds: [5] },
        { role: "right", tileIds: [6] },
        { role: "bottomLeft", tileIds: [7] },
        { role: "bottom", tileIds: [8] },
        { role: "bottomRight", tileIds: [9] },
      ],
      preserveCaps: true,
      repeat: "center",
    };
    const tree = makeGroup("tree", "prop", [10, 11]);
    tree.patternGrammar = {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [10] },
        { role: "bottom", tileIds: [11] },
      ],
      preserveCaps: true,
      repeat: "body",
    };

    const sections = createTileClusterSections(makeTileset({ count: 16, tileGroups: [wall, tree] }));

    expect(sections.groups.find((group) => group.id === "wall9")?.patternKind).toBeUndefined();
    expect(sections.groups.find((group) => group.id === "tree")?.patternKind).toBe("vertical_expandable");
  });
});

describe("tile palette cluster UI", () => {
  beforeEach(() => {
    // 기본 모드는 아이콘 레일이라 시트/그룹 세그먼트가 없음 — 전문가 팔레트 경로 검증
    resetEditorUiModeForTests("expert");
  });

  it("renders the single RM2003-style palette without group/sheet view segments", () => {
    const root = renderPalette();

    // 그룹/시트 보기 분기 제거 — 단일 팔레트만 존재한다.
    expect(findByTestId(root, "tile-palette")).not.toBeNull();
    expect(findByTestId(root, "tile-palette-clusters")).toBeNull();
    expect(findByTestId(root, "palette-view-sheet")).toBeNull();
    expect(findByTestId(root, "palette-view-cluster")).toBeNull();
    expect(findByTestId(root, "rm2k-palette-grid")).not.toBeNull();
    expect(findByTestId(root, "palette-sheet-expand")).not.toBeNull();

    // 오토타일 대표 1칸 축약: 물(0)·흙길(360) 대표는 있고, 변형(흙길 몸통 421)은 숨김.
    expect(findByTestId(root, "chipset-tile-0")?.className).toContain("rm2k-autotile");
    expect(findByTestId(root, "chipset-tile-360")?.className).toContain("rm2k-autotile");
    expect(findByTestId(root, "chipset-tile-421")).toBeNull();
  });

  it("selects the representative tile when an autotile cell is pressed", () => {
    const root = renderPalette();

    const cell = requireTestId(root, "chipset-tile-360");
    const event = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "button", { configurable: true, value: 0 });
    cell.dispatchEvent(event);

    expect(editorState.get().selectedTile).toBe(360);
  });

  it("work tabs switch paint / find / props panes", () => {
    const root = renderPalette();

    expect(findByTestId(root, "palette-work-tabs")).not.toBeNull();
    expect(findByTestId(root, "palette-work-pane-paint")).not.toBeNull();
    expect(findByTestId(root, "quick-tile-picker")).toBeNull();

    // 찾기 탭 (레거시 testid quick-tile-toggle)
    requireTestId(root, "quick-tile-toggle").click();
    expect(storage.getItem("rpg-zzu:palette-work-tab")).toBe("find");
    expect(findByTestId(root, "quick-tile-picker")).not.toBeNull();
    expect(findByTestId(root, "selected-tile-status")).not.toBeNull();

    requireTestId(root, "palette-work-tab-props").click();
    expect(storage.getItem("rpg-zzu:palette-work-tab")).toBe("props");
    expect(findByTestId(root, "palette-work-pane-props")).not.toBeNull();
    expect(findByTestId(root, "quick-tile-picker")).toBeNull();

    // 레거시 advanced 훅: 찾기 탭이 아니면 찾기로, 찾기면 칠하기로
    requireTestId(root, "tile-advanced-toggle").click();
    expect(findByTestId(root, "quick-tile-picker")).not.toBeNull();
    requireTestId(root, "tile-advanced-toggle").click();
    expect(findByTestId(root, "palette-work-pane-paint")).not.toBeNull();
  });
});

function renderPalette(): FakeElement {
  return renderWithFakeDom(() => {
    const root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);
    renderTilePalette(root);
    return root;
  });
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const element = findByTestId(root, testId);
  if (!element) throw new Error(`Missing ${testId}`);
  return element;
}

function makeTileset(args: {
  readonly count: number;
  readonly tileGroups?: readonly TileGroupMetadata[];
  readonly tileMeta?: Readonly<Record<number, string>>;
}): TilesetDef {
  return {
    count: args.count,
    id: "test_tileset",
    image: { id: "tex_tiles_default", type: "bundled" },
    passability: Array.from({ length: args.count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: args.count }, () => "lower"),
    terrain: Array.from({ length: args.count }, () => 0),
    tileGroups: args.tileGroups ? [...args.tileGroups] : [],
    tileMeta: Array.from({ length: args.count }, (_, index) => ({
      description: "",
      label: args.tileMeta?.[index] ?? "",
    })),
    tileSize: 16,
    tilesPerRow: 8,
    name: "Test tileset",
  };
}

function makeGroup(id: string, role: TileGroupMetadata["role"], tileIds: readonly number[]): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "",
    id,
    name: id,
    placementRules: "",
    role,
    tileIds: [...tileIds],
  };
}

function restoreWindow(windowValue: (Window & typeof globalThis) | undefined): void {
  if (windowValue === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowValue,
  });
}
