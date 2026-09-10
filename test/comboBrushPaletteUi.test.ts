/** @vitest-environment happy-dom */
// test/comboBrushPaletteUi.test.ts
// 사용자가 «만드는» 쪽과 «고르는» 쪽. 모델이 아무리 옳아도 기본 팔레트에서 조합을 만들 수
// 없으면 이 이슈는 해결되지 않는다 — OPRN-OUT-022 의 재현 절차가 정확히 그 자리였다.
//
// 지키는 계약:
//  · 기본(6열 리플로우) 팔레트에서 사각 드래그 = 활성 Combo Brush.
//  · 그 붓의 셀 타일은 **화면에 보이던 그 칸들**이다(리플로우 순서를 격자로 읽는다).
//  · 같은 칸에서 시작해 같은 칸에서 놓으면 예전처럼 단일 선택이다.
//  · 커스텀 아틀라스 드래그는 원본 좌표 규약 그대로다(회귀 금지).
//  · 지형 도구 표면은 큐레이션 조합을 **이름과 그림**으로 낸다 — 타일 번호 입력 없음.
//  · 사이드바가 합성 붓과 반복 붓(브러시 크기)을 다르게 표기한다.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { comboBrushBadge } from "@/editor/comboBrush";
import { CURATED_COMBO_BRUSHES } from "@/editor/comboBrushCatalog";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { comboBrushShelfEntries, makeComboBrushShelf } from "@/editor/panels/comboBrushShelf";
import { gridPaletteDisplayOrder, makeCustomPalette, makeGridPalette } from "@/editor/panels/tilePaletteGrid";
import { makeTileBrushControls } from "@/editor/panels/tilePaletteStampStatus";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import type { TilesetDef } from "@/project/types";

vi.mock("@/editor/harnessSuggestion/kitRender", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/editor/harnessSuggestion/kitRender")>(),
  renderTileCellsToCanvas: () => document.createElement("canvas"),
}));

function defaultTileset(): TilesetDef {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId]!;
  return project.tilesets[map.tilesetId]!;
}

function customTileset(): TilesetDef {
  const base = defaultTileset();
  return { ...base, count: 64, kind: "custom", tilesPerRow: 8 };
}

/** 실제 포인터 제스처 — pointerdown 은 grid 의 캡처 리스너가 받는다. */
function dragBetween(root: HTMLElement, fromTestId: string, toTestId: string): void {
  const from = root.querySelector<HTMLElement>(`[data-testid="${fromTestId}"]`);
  const to = root.querySelector<HTMLElement>(`[data-testid="${toTestId}"]`);
  expect(from, `missing ${fromTestId}`).toBeTruthy();
  expect(to, `missing ${toTestId}`).toBeTruthy();
  const down = new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 });
  from!.dispatchEvent(down);
  const move = new PointerEvent("pointermove", { bubbles: true, pointerId: 1 });
  Object.defineProperty(move, "target", { value: to, configurable: true });
  document.dispatchEvent(move);
  const up = new PointerEvent("pointerup", { bubbles: true, pointerId: 1 });
  Object.defineProperty(up, "target", { value: to, configurable: true });
  document.dispatchEvent(up);
}

beforeEach(() => {
  document.body.innerHTML = "";
  resetEditorUiModeForTests("beginner");
  store.replace(createBlankProject());
  editorState.set({
    activePaletteStamp: null,
    brushSize: 1,
    layer: "lower",
    paintShape: "pen",
    selectedTile: TILE.GRASS,
    tool: "paint",
  });
});

describe("default reflowed palette creates a combo brush", () => {
  it("turns a rectangular drag into an active multi-cell combo brush", () => {
    const tileset = defaultTileset();
    const created: PaletteStamp[] = [];
    const order = gridPaletteDisplayOrder({ layer: "lower", onSelectTile: () => {}, selectedTile: TILE.GRASS, tileset });
    const palette = makeGridPalette({
      layer: "lower",
      onCreatePaletteStamp: (stamp) => created.push(stamp),
      onSelectTile: () => {},
      selectedTile: TILE.GRASS,
      tileset,
    });
    document.body.append(palette);

    // 표시 격자 6열: 0번 칸에서 시작해 7번 칸(다음 행 두 번째)까지 = 2×2.
    dragBetween(palette, `chipset-tile-${order[0]}`, `chipset-tile-${order[7]}`);

    expect(created.length).toBe(1);
    const stamp = created[0]!;
    expect(stamp.width).toBe(2);
    expect(stamp.height).toBe(2);
    expect(stamp.origin).toBe("palette-drag");
    // 셀 타일 = 화면에 보이던 바로 그 칸들(리플로우 순서 0,1 / 6,7).
    expect(stamp.cells.map((cell) => cell.tile)).toEqual([order[0], order[1], order[6], order[7]]);
  });

  it("keeps a same-cell press as an ordinary single-tile selection", () => {
    const tileset = defaultTileset();
    const created: PaletteStamp[] = [];
    const selected: number[] = [];
    const order = gridPaletteDisplayOrder({ layer: "lower", onSelectTile: () => {}, selectedTile: TILE.GRASS, tileset });
    const palette = makeGridPalette({
      layer: "lower",
      onCreatePaletteStamp: (stamp) => created.push(stamp),
      onSelectTile: (tile) => selected.push(tile),
      selectedTile: TILE.GRASS,
      tileset,
    });
    document.body.append(palette);

    dragBetween(palette, `chipset-tile-${order[3]}`, `chipset-tile-${order[3]}`);

    expect(created).toEqual([]);
    expect(selected).toContain(order[3]);
  });

  it("still installs single selection only when no stamp handler is supplied", () => {
    const tileset = defaultTileset();
    const selected: number[] = [];
    const order = gridPaletteDisplayOrder({ layer: "lower", onSelectTile: () => {}, selectedTile: TILE.GRASS, tileset });
    const palette = makeGridPalette({ layer: "lower", onSelectTile: (tile) => selected.push(tile), selectedTile: TILE.GRASS, tileset });
    document.body.append(palette);

    dragBetween(palette, `chipset-tile-${order[0]}`, `chipset-tile-${order[7]}`);

    // 제스처가 없으면 pointerdown 이 그대로 선택으로 간다 — 예전 동작.
    expect(selected).toContain(order[0]);
  });
});

describe("custom atlas stamps stay on source coordinates", () => {
  it("reads the drag rectangle from the source sheet, not the display order", () => {
    const tileset = customTileset();
    const created: PaletteStamp[] = [];
    const palette = makeCustomPalette({
      layer: "lower",
      onCreatePaletteStamp: (stamp) => created.push(stamp),
      onSelectTile: () => {},
      selectedTile: 0,
      tileset,
    });
    document.body.append(palette);

    // tilesPerRow=8 이므로 10 → 19 는 원본 시트에서 2×2.
    dragBetween(palette, "chipset-tile-10", "chipset-tile-19");

    expect(created.length).toBe(1);
    expect(created[0]!.width).toBe(2);
    expect(created[0]!.height).toBe(2);
    expect(created[0]!.cells.map((cell) => cell.tile)).toEqual([10, 11, 18, 19]);
  });
});

describe("terrain-tool surface lists curated combinations", () => {
  it("renders every curated combination by name, with no raw tile-number entry", () => {
    const tileset = defaultTileset();
    const shelf = makeComboBrushShelf({ rerender: () => {}, tileset });
    expect(shelf).toBeTruthy();
    document.body.append(shelf!);

    const entries = comboBrushShelfEntries(tileset);
    expect(entries.length).toBe(CURATED_COMBO_BRUSHES.length);
    for (const entry of entries) {
      const button = shelf!.querySelector<HTMLElement>(`[data-testid="combo-brush-${entry.id}"]`);
      expect(button, `missing shelf entry ${entry.id}`).toBeTruthy();
      expect(button!.textContent ?? "").toContain(entry.name);
    }
    // 조합을 만드는 데 번호 입력칸이 필요하지 않다.
    expect(shelf!.querySelectorAll("input").length).toBe(0);
  });

  it("activates a curated combination as a reusable combo brush and toggles it off", () => {
    const tileset = defaultTileset();
    const entry = comboBrushShelfEntries(tileset)[0]!;
    const shelf = makeComboBrushShelf({ rerender: () => {}, tileset });
    document.body.append(shelf!);

    shelf!.querySelector<HTMLElement>(`[data-testid="combo-brush-${entry.id}"]`)!.click();
    const active = editorState.get().activePaletteStamp;
    expect(active?.origin).toBe("curated");
    expect(active?.label).toBe(entry.name);
    expect(active?.cells.length).toBe(entry.cells.length);
    expect(editorState.get().tool).toBe("paint");

    // 두 번째 렌더에서 다시 누르면 해제 — 활성 상태가 눈에 보여야 하므로 active 표시도 확인.
    const second = makeComboBrushShelf({ rerender: () => {}, tileset })!;
    document.body.append(second);
    const button = second.querySelector<HTMLElement>(`[data-testid="combo-brush-${entry.id}"]`)!;
    expect(button.getAttribute("aria-pressed")).toBe("true");
    button.click();
    expect(editorState.get().activePaletteStamp).toBe(null);
  });

  it("offers no combinations on a non-default chipset", () => {
    expect(comboBrushShelfEntries(customTileset())).toEqual([]);
    expect(makeComboBrushShelf({ rerender: () => {}, tileset: customTileset() })).toBe(null);
  });
});

describe("sidebar separates composite combo brush from repeated brush size", () => {
  it("labels a composite brush with the combo badge", () => {
    const tileset = defaultTileset();
    const entry = comboBrushShelfEntries(tileset)[0]!;
    const shelf = makeComboBrushShelf({ rerender: () => {}, tileset })!;
    document.body.append(shelf);
    shelf.querySelector<HTMLElement>(`[data-testid="combo-brush-${entry.id}"]`)!.click();

    const row = makeTileBrushControls(editorState.get(), () => {});
    const state = row.querySelector<HTMLElement>('[data-testid="tile-brush-state"]')!;
    expect(state.dataset.brushKind).toBe("combo");
    expect(state.dataset.stampCells).toBe(String(entry.cells.length));
    expect(state.textContent ?? "").toContain(comboBrushBadge(editorState.get().activePaletteStamp!));
    // 브러시 크기 선택기는 합성 붓과 함께 뜨지 않는다 — 둘은 다른 개념이다.
    expect(row.querySelector('[data-testid="brush-size-select"]')).toBe(null);
  });

  it("keeps repeated-tile brush size as its own concept when no combo brush is active", () => {
    // 전문가 크롬 = 크기 선택기가 있는 표면. 초보 레일은 같은 개념을 칩으로 낸다.
    resetEditorUiModeForTests("expert");
    editorState.set({ activePaletteStamp: null, brushSize: 3, layer: "lower", tool: "paint", paintShape: "pen" });
    const row = makeTileBrushControls(editorState.get(), () => {});
    const state = row.querySelector<HTMLElement>('[data-testid="tile-brush-state"]')!;

    expect(state.dataset.brushKind).toBe("repeat");
    expect(state.dataset.stampCells).toBe("0");
    expect(row.querySelector<HTMLSelectElement>('[data-testid="brush-size-select"]')?.value).toBe("3");
  });

  it("hides the repeated-size select while a composite combo brush is active (expert chrome)", () => {
    resetEditorUiModeForTests("expert");
    const tileset = defaultTileset();
    const entry = comboBrushShelfEntries(tileset)[0]!;
    const shelf = makeComboBrushShelf({ rerender: () => {}, tileset })!;
    document.body.append(shelf);
    shelf.querySelector<HTMLElement>(`[data-testid="combo-brush-${entry.id}"]`)!.click();

    const row = makeTileBrushControls(editorState.get(), () => {});
    expect(row.querySelector('[data-testid="brush-size-select"]')).toBe(null);
    expect(row.querySelector<HTMLElement>('[data-testid="tile-brush-state"]')!.dataset.brushKind).toBe("combo");
  });

  it("does not call a single-cell stamp a combo brush", () => {
    editorState.set({
      activePaletteStamp: {
        cells: [{ dx: 0, dy: 0, layer: "lower", tile: 342 }],
        height: 1,
        source: { endTile: 342, startTile: 342 },
        width: 1,
      },
      tool: "paint",
    });
    const state = makeTileBrushControls(editorState.get(), () => {})
      .querySelector<HTMLElement>('[data-testid="tile-brush-state"]')!;

    expect(state.dataset.brushKind).toBe("stamp");
    expect(state.textContent ?? "").not.toContain("조합 붓");
  });
});
