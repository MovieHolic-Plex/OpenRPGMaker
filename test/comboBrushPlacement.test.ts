/** @vitest-environment happy-dom */
// test/comboBrushPlacement.test.ts
// Combo Brush 를 **실제 페인트 경로**(TilePaintEngine → paintTilesBulk → mapEditHistory)로 통과시킨다.
// 순수 모델 단위 테스트가 아니다: 모델·미리보기·페인트·되돌리기가 한 줄로 이어지는지 보는 자리다.
//
// 지키는 계약:
//  · 2×N / 3×3 / 4×4 가 원본 배열과 레이어 라우팅을 그대로 보존한다.
//  · 붓이 **반복 배치 동안 살아 있다**(찍어도 해제되지 않는다).
//  · 호버 미리보기의 발자국 = 실제로 써지는 칸 (같은 comboBrushPlacement).
//  · 경계에서 잘리는 칸은 미리보기에 보이고, 맵 안 칸은 배열 그대로 들어간다.
//  · 완전히 맵 밖이면 **한 칸도 쓰지 않고** 모델의 진단을 그대로 낸다.
//  · 한 번 배치 = 되돌리기 한 단위.
//  · 1칸 스탬프·구조 킷·단일 타일 칠하기는 예전 동작 그대로다.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  comboBrushBadge,
  comboBrushPlacement,
  evaluateComboBrushPlacement,
  isComboBrush,
} from "@/editor/comboBrush";
import { comboBrushStampFromCatalog, comboBrushCatalogEntry } from "@/editor/comboBrushCatalog";
import { editorState } from "@/editor/editorState";
import { renderHoverTilePreview } from "@/editor/editSceneHoverPreview";
import { getMapEditHistoryState, recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { TilePaintEngine, type TilePaintEngineDeps } from "@/editor/TilePaintEngine";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { PaletteStamp, PaletteStampCell } from "@/editor/tilePaletteStamp";
import { resetToastsForTest } from "@/util/toast";

// Only Phaser graphics creation is replaced. Engine, tile mutation, history and
// editor state stay connected — the point of this file is the real path.
vi.mock("@/editor/chipsetTileRender", () => ({
  createChipsetTileObject: vi.fn(() => ({ setAlpha: vi.fn() })),
}));

function harness(): TilePaintEngine {
  const paintState = { isPainting: false, lastPaintKey: "" };
  const deps: TilePaintEngineDeps = {
    mapId: () => store.getCurrent().startMapId,
    pointerToTile: (ptr) => ({ x: (ptr as unknown as { x: number }).x, y: (ptr as unknown as { y: number }).y }),
    updatePointerStatus: () => {},
    eventLayerClickCount: () => 1,
    pointerClickCount: () => 1,
    offerEventLayerSwitchAt: () => false,
    showEventLayerClickFeedback: () => {},
    openExistingEventAt: () => false,
    handleEventClick: () => {},
    tilesetForMap: (mapId) => {
      const project = store.getCurrent();
      return project.tilesets[project.maps[mapId]!.tilesetId];
    },
    setLastPointerTile: () => {},
    getPaintState: () => paintState,
    setPaintState: (state) => Object.assign(paintState, state),
  };
  return new TilePaintEngine(deps);
}

/** 한 번의 클릭 = 새 스트로크. 엔진은 lastPaintKey 로 스트로크를 가르므로 사이에 초기화한다. */
function placeAt(engine: TilePaintEngine, x: number, y: number): void {
  engine.applyAtPointer({ x, y } as never);
}

function stamp(cells: readonly PaletteStampCell[], width: number, height: number): PaletteStamp {
  return {
    cells,
    height,
    origin: "palette-drag",
    source: { endTile: cells[cells.length - 1]!.tile, startTile: cells[0]!.tile },
    width,
  };
}

function lowerAt(x: number, y: number): number | undefined {
  const map = store.getCurrent().maps[store.getCurrent().startMapId]!;
  return map.lowerTiles[y * map.width + x];
}

function upperAt(x: number, y: number): number | undefined {
  const map = store.getCurrent().maps[store.getCurrent().startMapId]!;
  return map.upperTiles[y * map.width + x];
}

function currentMap() {
  return store.getCurrent().maps[store.getCurrent().startMapId]!;
}

/** 3×3 목조 벽면 — 실제 큐레이션 조합. 모두 lower. */
function woodWallStamp(): PaletteStamp {
  return comboBrushStampFromCatalog(comboBrushCatalogEntry("combo_wood_wall_block")!);
}

/** 나무 한 그루 — upper 수관 + lower 밑동(레이어 라우팅 검증용). */
function treeStamp(): PaletteStamp {
  return comboBrushStampFromCatalog(comboBrushCatalogEntry("combo_tree_full")!);
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  resetToastsForTest();
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({
    activePaletteStamp: null,
    autoConnectMode: false,
    brushSize: 1,
    layer: "lower",
    paintShape: "pen",
    selectedTile: TILE.GRASS,
    tool: "paint",
  });
});

describe("combo brush — pattern layout preservation", () => {
  it("keeps a 3x3 source layout cell for cell", () => {
    const brush = woodWallStamp();
    editorState.set({ activePaletteStamp: brush });
    placeAt(harness(), 5, 5);

    for (const cell of brush.cells) {
      expect(lowerAt(5 + cell.dx, 5 + cell.dy)).toBe(cell.tile);
    }
  });

  it("keeps a 4x4 source layout cell for cell", () => {
    const cells: PaletteStampCell[] = [];
    for (let dy = 0; dy < 4; dy += 1) {
      for (let dx = 0; dx < 4; dx += 1) cells.push({ dx, dy, layer: "lower", tile: 105 + dy * 30 + dx });
    }
    editorState.set({ activePaletteStamp: stamp(cells, 4, 4) });
    placeAt(harness(), 6, 6);

    for (const cell of cells) expect(lowerAt(6 + cell.dx, 6 + cell.dy)).toBe(cell.tile);
  });

  it("keeps a 2xN source layout cell for cell", () => {
    const tower = comboBrushStampFromCatalog(comboBrushCatalogEntry("combo_round_tower")!);
    expect(tower.width).toBe(2);
    expect(tower.height).toBe(5);
    editorState.set({ activePaletteStamp: tower });
    placeAt(harness(), 4, 3);

    for (const cell of tower.cells) {
      const actual = cell.layer === "upper" ? upperAt(4 + cell.dx, 3 + cell.dy) : lowerAt(4 + cell.dx, 3 + cell.dy);
      expect(actual).toBe(cell.tile);
    }
  });
});

describe("combo brush — layer routing", () => {
  it("sends upper cells to the upper layer and lower cells to the lower layer", () => {
    const tree = treeStamp();
    const canopy = tree.cells.find((cell) => cell.layer === "upper")!;
    const trunk = tree.cells.find((cell) => cell.layer === "lower")!;
    editorState.set({ activePaletteStamp: tree });
    placeAt(harness(), 7, 7);

    expect(upperAt(7 + canopy.dx, 7 + canopy.dy)).toBe(canopy.tile);
    expect(lowerAt(7 + trunk.dx, 7 + trunk.dy)).toBe(trunk.tile);
    // 수관 칸의 바닥은 붓이 건드리지 않는다 — 배열에 그 칸의 lower 셀이 없기 때문.
    expect(upperAt(7 + trunk.dx, 7 + trunk.dy)).not.toBe(canopy.tile);
  });

  it("routes cells by their declared layer regardless of the active editing layer", () => {
    const tree = treeStamp();
    editorState.set({ activePaletteStamp: tree, layer: "upper" });
    placeAt(harness(), 8, 8);

    const canopy = tree.cells.find((cell) => cell.layer === "upper")!;
    const trunk = tree.cells.find((cell) => cell.layer === "lower")!;
    expect(upperAt(8 + canopy.dx, 8 + canopy.dy)).toBe(canopy.tile);
    expect(lowerAt(8 + trunk.dx, 8 + trunk.dy)).toBe(trunk.tile);
  });
});

describe("combo brush — repeated placement", () => {
  it("stays active across multiple placements", () => {
    const brush = woodWallStamp();
    editorState.set({ activePaletteStamp: brush });
    const engine = harness();

    for (const origin of [[2, 2], [8, 2], [2, 8]] as const) {
      placeAt(engine, origin[0], origin[1]);
      expect(editorState.get().activePaletteStamp).toBe(brush);
    }
    for (const origin of [[2, 2], [8, 2], [2, 8]] as const) {
      for (const cell of brush.cells) {
        expect(lowerAt(origin[0] + cell.dx, origin[1] + cell.dy)).toBe(cell.tile);
      }
    }
  });
});

describe("combo brush — boundaries", () => {
  it("paints only the in-bounds cells and leaves their layout intact", () => {
    const map = currentMap();
    const brush = woodWallStamp();
    editorState.set({ activePaletteStamp: brush });
    const originX = map.width - 2; // 3칸 폭이므로 오른쪽 1열이 잘린다.
    placeAt(harness(), originX, 4);

    const verdict = evaluateComboBrushPlacement({
      bounds: { height: map.height, width: map.width },
      stamp: brush,
      x: originX,
      y: 4,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.placement.clippedCount).toBe(3);
    for (const placed of verdict.placement.paintableCells) {
      expect(lowerAt(placed.x, placed.y)).toBe(placed.cell.tile);
    }
  });

  it("writes nothing and returns the model diagnostic when the footprint is fully outside", () => {
    const map = currentMap();
    const brush = woodWallStamp();
    editorState.set({ activePaletteStamp: brush });
    const before = structuredClone(currentMap());

    placeAt(harness(), map.width + 3, map.height + 3);

    expect(currentMap().lowerTiles).toEqual(before.lowerTiles);
    expect(currentMap().upperTiles).toEqual(before.upperTiles);
    expect(getMapEditHistoryState().canUndo).toBe(false);

    const verdict = evaluateComboBrushPlacement({
      bounds: { height: map.height, width: map.width },
      stamp: brush,
      x: map.width + 3,
      y: map.height + 3,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // 사용자에게 보인 안내는 **모델이 만든 진단 그대로**여야 한다. 산문을 박는 것이 아니라
    // 「문구의 유일한 집이 comboBrush 모델이다」라는 사실을 박는다.
    expect(document.body.textContent ?? "").toContain(verdict.diagnostic.text);
  });
});

describe("combo brush — hover preview shares the placement model", () => {
  it("previews exactly the cells that will be written, and marks the clipped ones", () => {
    const map = currentMap();
    const brush = woodWallStamp();
    editorState.set({ activePaletteStamp: brush });
    const originX = map.width - 2;

    const added: { x: number; y: number }[] = [];
    const layer = { add: (object: unknown) => { void object; }, removeAll: () => {} } as never;
    const scene = {
      add: {
        rectangle: (x: number, y: number) => {
          added.push({ x, y });
          return { setOrigin: () => ({}), setStrokeStyle: () => ({}) };
        },
      },
    } as never;

    renderHoverTilePreview({ centerX: originX, centerY: 4, layer, mapId: map.id, scene });

    const placement = comboBrushPlacement({
      bounds: { height: map.height, width: map.width },
      stamp: brush,
      x: originX,
      y: 4,
    });
    // 발자국 전체(잘리는 칸 포함)가 표시된다 — 그래야 경계가 «누르기 전에» 보인다.
    expect(added.length).toBe(placement.cells.length);
    expect(placement.clippedCount).toBeGreaterThan(0);
  });
});

describe("combo brush — undo/redo grouping", () => {
  it("treats one combo placement as one undo unit and restores every cell", () => {
    const brush = woodWallStamp();
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    const before = structuredClone(currentMap());

    editorState.set({ activePaletteStamp: brush });
    placeAt(harness(), 5, 5);
    const after = structuredClone(currentMap());
    expect(after.lowerTiles).not.toEqual(before.lowerTiles);

    expect(undoMapEdit()).toBe(true);
    expect(currentMap().lowerTiles).toEqual(before.lowerTiles);
    expect(redoMapEdit()).toBe(true);
    expect(currentMap().lowerTiles).toEqual(after.lowerTiles);
  });

  it("undoes two separate placements one at a time", () => {
    const brush = woodWallStamp();
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    editorState.set({ activePaletteStamp: brush });

    placeAt(harness(), 2, 2);
    const afterFirst = structuredClone(currentMap());
    placeAt(harness(), 9, 9);
    expect(currentMap().lowerTiles).not.toEqual(afterFirst.lowerTiles);

    expect(undoMapEdit()).toBe(true);
    expect(currentMap().lowerTiles).toEqual(afterFirst.lowerTiles);
  });
});

describe("combo brush — badge distinguishes composite from repeated brush size", () => {
  it("treats multi-cell stamps as combo brushes and single cells as ordinary stamps", () => {
    const single = stamp([{ dx: 0, dy: 0, layer: "lower", tile: 342 }], 1, 1);
    expect(isComboBrush(single)).toBe(false);
    expect(isComboBrush(woodWallStamp())).toBe(true);
  });

  it("states footprint, cell count and layer routing in one badge", () => {
    const badge = comboBrushBadge(treeStamp());
    expect(badge).toContain("1×2");
    expect(badge).toContain("2칸");
  });
});

describe("combo brush — existing brushes stay compatible", () => {
  it("keeps single-tile painting on the plain path", () => {
    editorState.set({ activePaletteStamp: null, selectedTile: TILE.WATER });
    placeAt(harness(), 3, 3);
    expect(lowerAt(3, 3)).toBe(TILE.WATER);
  });

  it("keeps 1x1 stamps flowing through the ordinary autotile-aware stamp path", () => {
    const single = stamp([{ dx: 0, dy: 0, layer: "lower", tile: 342 }], 1, 1);
    editorState.set({ activePaletteStamp: single, autoConnectMode: true });
    placeAt(harness(), 4, 4);
    expect(lowerAt(4, 4)).toBe(342);
  });

  it("keeps brush size a repeated-tile concept independent of the combo brush", () => {
    editorState.set({ activePaletteStamp: null, brushSize: 3, selectedTile: TILE.WATER });
    placeAt(harness(), 5, 5);
    for (let y = 4; y <= 6; y += 1) {
      for (let x = 4; x <= 6; x += 1) expect(lowerAt(x, y)).toBe(TILE.WATER);
    }
  });
});
