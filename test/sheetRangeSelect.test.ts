import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { createBlankProject } from "@/project/defaults";
import type { Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const modalMock = vi.hoisted(() => ({
  openClusterAiModal: vi.fn(),
}));

vi.mock("@/editor/panels/clusterAiModal", () => ({
  openClusterAiModal: modalMock.openClusterAiModal,
}));

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
  store.replace(projectWithTileset(makeTileset({ count: 24, tilesPerRow: 5 })));
  editorState.set({
    activePaletteStamp: null,
    activeStampId: null,
    activeStructureStampId: null,
    currentMapId: null,
    layer: "lower",
    selectedTile: 0,
    tool: "paint",
  });
  restoreDom = installFakeDom();
  Object.defineProperty(globalThis.document, "createElementNS", {
    configurable: true,
    value: (_namespace: string, tagName: string) => new FakeElement(tagName),
  });
  storage = new MemoryStorage();
  storage.setItem("rpg-zzu:palette-view", "sheet");
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
  modalMock.openClusterAiModal.mockReset();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  restoreWindow(previousWindow);
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("sheet range selection", () => {
  // 2026-07-08 계약 변경(UX 리뷰): 무수식 드래그 = 멀티타일 스탬프(칠하기 기본값),
  // Shift+드래그 = AI 범위 분류. 과거엔 모든 드래그가 분류에 흡수되어 스탬프가 죽은 기능이었다.
  it("opens range-classify with the sheet rect and filtered tile ids after shift-marquee drag", () => {
    const root = renderPalette();

    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointermove", { clientX: 18, clientY: 18 });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointerup", { clientX: 18, clientY: 18 });
    requireTestId(root, "sheet-range-classify").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "range-classify",
      rect: { h: 3, w: 2, x: 2, y: 0 },
      tileIds: [2, 3, 7, 8, 12, 13],
      tilesetId: "range_tileset",
    });
  });

  it("creates a multi-tile palette stamp from a plain (no-shift) marquee drag", () => {
    const root = renderPalette();

    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointermove", { clientX: 18, clientY: 18 });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointerup", { clientX: 18, clientY: 18 });

    expect(findByTestId(root, "sheet-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    const stamp = editorState.get().activePaletteStamp;
    expect(stamp).not.toBeNull();
    expect(stamp?.cells.map((cell) => cell.tile).sort((a, b) => a - b)).toEqual([2, 3, 7, 8, 12, 13]);
  });

  it("keeps a small pointer movement as a normal tile click without showing range action", () => {
    const root = renderPalette();

    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointermove", { clientX: 6, clientY: 6 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerup", { clientX: 6, clientY: 6 });

    expect(findByTestId(root, "sheet-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
  });

  it("allows a one-cell range when the shift-pointer crosses the marquee threshold", () => {
    const root = renderPalette();

    dispatchPointer(requireTestId(root, "chipset-tile-4"), "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-4"), "pointermove", { clientX: 8, clientY: 0 });
    dispatchPointer(requireTestId(root, "chipset-tile-4"), "pointerup", { clientX: 8, clientY: 0 });
    requireTestId(root, "sheet-range-classify").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "range-classify",
      rect: { h: 1, w: 1, x: 4, y: 0 },
      tileIds: [4],
      tilesetId: "range_tileset",
    });
  });

  it("marks grouped and labeled tiles as classified coverage on the sheet", () => {
    store.replace(projectWithTileset(makeTileset({
      count: 12,
      tileGroups: [makeGroup("wall", "wall", [1, 2])],
      tileMeta: { 5: "표지판" },
      tilesPerRow: 4,
    })));
    const root = renderPalette();

    expect(requireTestId(root, "chipset-tile-1").className).toContain("classified");
    expect(requireTestId(root, "chipset-tile-5").className).toContain("classified");
    expect(requireTestId(root, "chipset-tile-6").className).not.toContain("classified");
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

function dispatchPointer(
  target: FakeElement,
  type: string,
  point: { readonly clientX: number; readonly clientY: number; readonly shiftKey?: boolean }
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "button", { configurable: true, value: 0 });
  Object.defineProperty(event, "clientX", { configurable: true, value: point.clientX });
  Object.defineProperty(event, "clientY", { configurable: true, value: point.clientY });
  Object.defineProperty(event, "pointerId", { configurable: true, value: 1 });
  Object.defineProperty(event, "shiftKey", { configurable: true, value: point.shiftKey ?? false });
  target.dispatchEvent(event);
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const element = findByTestId(root, testId);
  if (!element) throw new Error(`Missing ${testId}`);
  return element;
}

function projectWithTileset(tileset: TilesetDef): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.tilesetId = tileset.id;
  project.tilesets[tileset.id] = tileset;
  return project;
}

function makeTileset(args: {
  readonly count: number;
  readonly tileGroups?: readonly TileGroupMetadata[];
  readonly tileMeta?: Readonly<Record<number, string>>;
  readonly tilesPerRow: number;
}): TilesetDef {
  return {
    count: args.count,
    id: "range_tileset",
    image: { id: "tex_tiles_default", type: "bundled" },
    name: "Range tileset",
    passability: Array.from({ length: args.count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: args.count }, () => "lower"),
    terrain: Array.from({ length: args.count }, () => 0),
    tileGroups: args.tileGroups ? [...args.tileGroups] : [],
    tileMeta: Array.from({ length: args.count }, (_, index) => ({
      description: "",
      label: args.tileMeta?.[index] ?? "",
    })),
    tileSize: 16,
    tilesPerRow: args.tilesPerRow,
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
