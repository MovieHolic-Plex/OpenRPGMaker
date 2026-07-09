import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTilePaletteClusters } from "@/editor/panels/tilePaletteClusters";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const modalMock = vi.hoisted(() => ({
  openClusterAiModal: vi.fn(),
}));

vi.mock("@/editor/panels/clusterAiModal", () => ({
  openClusterAiModal: modalMock.openClusterAiModal,
}));

let restoreDom: (() => void) | null = null;
let previousWindow: (Window & typeof globalThis) | undefined;
let dispatched: string[];

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  dispatched = [];
  modalMock.openClusterAiModal.mockReset();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      dispatchEvent: (event: Event): boolean => {
        dispatched.push(event.type);
        return true;
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  restoreWindow(previousWindow);
});

describe("palette AI entry buttons", () => {
  it("opens cluster-edit modal with the tileset and group ids", () => {
    const root = renderClusters(makeTileset({
      count: 8,
      tileGroups: [makeGroup("wall_cluster", "wall", [0, 1, 2])],
    }));

    requireTestId(root, "cluster-ai-edit-wall_cluster").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({ kind: "cluster-edit", tilesetId: "test_tileset", groupId: "wall_cluster" });
    expect(dispatched).not.toContain("rpgzzu:ai-assist");
  });

  it("opens unclassified-analysis modal with the first 24 unclassified tiles and the total", () => {
    const root = renderClusters(makeTileset({
      count: 30,
      tileGroups: [makeGroup("terrain_cluster", "terrain", [0])],
    }));

    requireTestId(root, "cluster-ai-analyze").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "unclassified-analysis",
      sampleTiles: Array.from({ length: 24 }, (_, index) => index + 1),
      tilesetId: "test_tileset",
      total: 29,
    });
    expect(dispatched).not.toContain("rpgzzu:ai-assist");
  });

  it("shows the all-classified badge instead of an analysis button when no tiles are unclassified", () => {
    const root = renderClusters(makeTileset({
      count: 3,
      tileGroups: [makeGroup("all_tiles", "terrain", [0, 1, 2])],
    }));

    expect(findByTestId(root, "cluster-ai-analyze")).toBeNull();
    expect(root.textContent).toContain("✓ 모두 분류됨");
  });
});

function renderClusters(tileset: TilesetDef): FakeElement {
  return renderWithFakeDom(() => renderTilePaletteClusters({
    layer: "lower",
    onSelectTile: vi.fn(),
    selectedTile: 0,
    tileset,
  }));
}

function requireTestId(root: FakeElement, testId: string): FakeElement {
  const element = findByTestId(root, testId);
  if (!element) throw new Error(`Missing ${testId}`);
  return element;
}

function makeTileset(args: {
  readonly count: number;
  readonly tileGroups: readonly TileGroupMetadata[];
}): TilesetDef {
  return {
    count: args.count,
    id: "test_tileset",
    image: { id: "tex_tiles_default", type: "bundled" },
    name: "Test tileset",
    passability: Array.from({ length: args.count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: args.count }, () => "lower"),
    terrain: Array.from({ length: args.count }, () => 0),
    tileGroups: [...args.tileGroups],
    tileMeta: Array.from({ length: args.count }, () => ({ description: "", label: "" })),
    tileSize: 16,
    tilesPerRow: 8,
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
