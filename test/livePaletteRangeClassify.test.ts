import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRID_PALETTE_COLUMNS, makeGridPalette } from "@/editor/panels/tilePaletteGrid";
import type { TilesetDef } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const modalMock = vi.hoisted(() => ({
  openClusterAiModal: vi.fn(),
}));

vi.mock("@/editor/panels/clusterAiModal", () => ({
  openClusterAiModal: modalMock.openClusterAiModal,
}));

let restoreDom: (() => void) | null = null;
let selectedTiles: number[] = [];

beforeEach(() => {
  restoreDom = installFakeDom();
  selectedTiles = [];
  modalMock.openClusterAiModal.mockReset();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("live grid palette range-classify", () => {
  it("opens existing cluster range-classify once with tiles frozen at click after shift-drag on makeGridPalette", () => {
    const root = renderGrid(makeTileset());
    dispatchPointer(requireTestId(root, "chipset-tile-0"), "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointermove", { clientX: 24, clientY: 16, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointerup", { clientX: 24, clientY: 16, shiftKey: true });
    requireTestId(root, "palette-range-classify").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledTimes(1);
    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "range-classify",
      rect: { x: 0, y: 0, w: 3, h: 2 },
      tileIds: [0, 1, 2, 6, 7, 8],
      tilesetId: "live_grid_tileset",
    });
  });

  it("freezes an atlas-space rect that contains the visually selected tiles", () => {
    const root = renderGrid(makeTileset(30));
    dispatchPointer(requireTestId(root, "chipset-tile-0"), "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointermove", { clientX: 24, clientY: 16, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointerup", { clientX: 24, clientY: 16, shiftKey: true });
    requireTestId(root, "palette-range-classify").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "range-classify",
      rect: { x: 0, y: 0, w: 9, h: 1 },
      tileIds: [0, 1, 2, 6, 7, 8],
      tilesetId: "live_grid_tileset",
    });
  });

  it("does not open range-classify or steal paint selection on a normal tile click", () => {
    const root = renderGrid(makeTileset());
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerup", { clientX: 4, clientY: 4 });

    expect(findByTestId(root, "palette-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    expect(selectedTiles).toEqual([2]);
  });

  it("does not classify after a cancelled shift-drag followed by a normal paint click", () => {
    const root = renderGrid(makeTileset());
    dispatchPointer(requireTestId(root, "chipset-tile-0"), "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointermove", { clientX: 24, clientY: 16, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-0"), "pointercancel", { clientX: 24, clientY: 16, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerup", { clientX: 4, clientY: 4 });

    expect(findByTestId(root, "palette-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    expect(selectedTiles).toEqual([2]);
  });

  it("does not classify after an outside-ended shift-drag followed by a normal paint click", () => {
    const root = renderGrid(makeTileset());
    dispatchPointer(requireTestId(root, "chipset-tile-0"), "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    dispatchPointer(requireTestId(root, "chipset-tile-8"), "pointermove", { clientX: 24, clientY: 16, shiftKey: true });
    dispatchPointer(root, "pointerup", { clientX: 80, clientY: 80 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerup", { clientX: 4, clientY: 4 });

    expect(findByTestId(root, "palette-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    expect(selectedTiles).toEqual([2]);
  });
});

function renderGrid(tileset: TilesetDef): FakeElement {
  return renderWithFakeDom(() => {
    const root = document.createElement("div");
    document.body.append(root);
    root.append(makeGridPalette({
      layer: "lower",
      onSelectTile: (index) => {
        selectedTiles.push(index);
      },
      selectedTile: 0,
      tileset,
    }));
    return root;
  });
}

function dispatchPointer(
  target: FakeElement,
  type: string,
  point: { readonly clientX: number; readonly clientY: number; readonly shiftKey?: boolean },
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

function makeTileset(tilesPerRow: number = GRID_PALETTE_COLUMNS): TilesetDef {
  return {
    count: 24,
    id: "live_grid_tileset",
    image: { id: "tex_tiles_live_grid", type: "bundled" },
    name: "Live grid",
    passability: Array.from({ length: 24 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 24 }, () => "lower"),
    terrain: Array.from({ length: 24 }, () => 0),
    tileMeta: Array.from({ length: 24 }, () => ({ description: "", label: "" })),
    tileSize: 16,
    tilesPerRow,
  };
}
