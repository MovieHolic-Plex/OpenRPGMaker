import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeChipsetSheet } from "@/editor/panels/tilePaletteSheet";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

// 2026-07-16 RM2003 팔레트 개편: 인라인 팔레트는 6열 축약 팔레트(tilePaletteRm2k)가 되었고,
// 30열 원시 시트(범위 드래그 스탬프/분류)는 "크게" 팝아웃 전용이다.
// 여기서는 시트 컴포넌트(makeChipsetSheet)를 직접 렌더해 범위 선택 계약을 검증한다.

const modalMock = vi.hoisted(() => ({
  openClusterAiModal: vi.fn(),
}));

vi.mock("@/editor/panels/clusterAiModal", () => ({
  openClusterAiModal: modalMock.openClusterAiModal,
}));

let restoreDom: (() => void) | null = null;
let createdStamp: PaletteStamp | null = null;
let selectedTiles: number[] = [];

beforeEach(() => {
  restoreDom = installFakeDom();
  Object.defineProperty(globalThis.document, "createElementNS", {
    configurable: true,
    value: (_namespace: string, tagName: string) => new FakeElement(tagName),
  });
  createdStamp = null;
  selectedTiles = [];
  modalMock.openClusterAiModal.mockReset();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("sheet range selection", () => {
  // 2026-07-08 계약 변경(UX 리뷰): 무수식 드래그 = 멀티타일 스탬프(칠하기 기본값),
  // Shift+드래그 = AI 범위 분류. 과거엔 모든 드래그가 분류에 흡수되어 스탬프가 죽은 기능이었다.
  it("opens range-classify with the sheet rect and filtered tile ids after shift-marquee drag", () => {
    const root = renderSheet(makeTileset({ count: 24, tilesPerRow: 5 }));

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
    const root = renderSheet(makeTileset({ count: 24, tilesPerRow: 5 }));

    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointermove", { clientX: 18, clientY: 18 });
    dispatchPointer(requireTestId(root, "chipset-tile-13"), "pointerup", { clientX: 18, clientY: 18 });

    expect(findByTestId(root, "sheet-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    expect(createdStamp).not.toBeNull();
    expect(createdStamp?.cells.map((cell) => cell.tile).sort((a, b) => a - b)).toEqual([2, 3, 7, 8, 12, 13]);
  });

  it("keeps a small pointer movement as a normal tile click without showing range action", () => {
    const root = renderSheet(makeTileset({ count: 24, tilesPerRow: 5 }));

    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerdown", { clientX: 4, clientY: 4 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointermove", { clientX: 6, clientY: 6 });
    dispatchPointer(requireTestId(root, "chipset-tile-2"), "pointerup", { clientX: 6, clientY: 6 });

    expect(findByTestId(root, "sheet-range-classify")).toBeNull();
    expect(modalMock.openClusterAiModal).not.toHaveBeenCalled();
    expect(selectedTiles).toEqual([2]);
  });

  it("allows a one-cell range when the shift-pointer crosses the marquee threshold", () => {
    const root = renderSheet(makeTileset({ count: 24, tilesPerRow: 5 }));

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
    const root = renderSheet(makeTileset({
      count: 12,
      tileGroups: [makeGroup("wall", "wall", [1, 2])],
      tileMeta: { 5: "표지판" },
      tilesPerRow: 4,
    }));

    expect(requireTestId(root, "chipset-tile-1").className).toContain("classified");
    expect(requireTestId(root, "chipset-tile-5").className).toContain("classified");
    expect(requireTestId(root, "chipset-tile-6").className).not.toContain("classified");
  });
});

function renderSheet(tileset: TilesetDef): FakeElement {
  return renderWithFakeDom(() => {
    const root = document.createElement("div");
    document.body.append(root);
    root.append(makeChipsetSheet({
      activePaletteStamp: null,
      layer: "lower",
      onCreatePaletteStamp: (stamp) => {
        createdStamp = stamp;
      },
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
