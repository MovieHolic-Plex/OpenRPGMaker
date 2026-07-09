import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderTilePaletteClusters } from "@/editor/panels/tilePaletteClusters";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { installFakeDom } from "./fakeDom";

const modalMock = vi.hoisted(() => ({
  openClusterAiModal: vi.fn(),
}));

vi.mock("@/editor/panels/clusterAiModal", () => ({
  openClusterAiModal: modalMock.openClusterAiModal,
}));

beforeEach(() => {
  installFakeDom();
  modalMock.openClusterAiModal.mockReset();
});

describe("palette cluster AI buttons", () => {
  it("opens the cluster AI modal for a grouped cluster without dispatching the old assist event", () => {
    const dispatched: string[] = [];
    installWindowDispatchCapture(dispatched);
    const root = renderClusters(makeTileset());

    requireTestId(root, "cluster-ai-edit-fence-main").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "cluster-edit",
      groupId: "fence-main",
      tilesetId: "tiles_test",
    });
    expect(dispatched).not.toContain("rpgzzu:ai-assist");
  });

  it("opens analysis mode with the first 24 unclassified tiles and total count", () => {
    const dispatched: string[] = [];
    installWindowDispatchCapture(dispatched);
    const root = renderClusters(makeTileset({ count: 34 }));

    requireTestId(root, "cluster-ai-analyze").click();

    expect(modalMock.openClusterAiModal).toHaveBeenCalledWith({
      kind: "unclassified-analysis",
      sampleTiles: Array.from({ length: 24 }, (_, index) => (index === 0 ? 0 : index + 3)),
      tilesetId: "tiles_test",
      total: 31,
    });
    expect(dispatched).not.toContain("rpgzzu:ai-assist");
  });
});

function renderClusters(tileset: TilesetDef): HTMLElement {
  return renderTilePaletteClusters({
    layer: "lower",
    onSelectTile: () => undefined,
    selectedTile: 0,
    tileset,
  });
}

function makeTileset(args: { readonly count?: number } = {}): TilesetDef {
  const count = args.count ?? 12;
  return {
    count,
    id: "tiles_test",
    image: { id: "tex_tiles_default", type: "bundled" },
    name: "테스트 타일셋",
    passability: Array.from({ length: count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: count }, () => "lower"),
    terrain: Array.from({ length: count }, () => 0),
    tileGroups: [makeGroup()],
    tileMeta: Array.from({ length: count }, () => ({ description: "", label: "" })),
    tileSize: 16,
    tilesPerRow: 8,
  };
}

function makeGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "",
    id: "fence-main",
    name: "울타리",
    placementRules: "",
    role: "fence",
    tileIds: [1, 2, 3],
  };
}

function requireTestId(root: ParentNode, testId: string): HTMLElement {
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return element;
}

function installWindowDispatchCapture(dispatched: string[]): void {
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
}
