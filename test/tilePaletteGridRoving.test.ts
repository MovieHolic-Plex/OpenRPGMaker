import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { GRID_PALETTE_COLUMNS } from "@/editor/panels/tilePaletteGrid";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

/**
 * 타일 그림판 그리드는 사이드바에서 탭 스톱을 213개까지 부풀린 원인이었다(plan §1-2 A-2).
 * 여기서 고정하는 계약: 그리드는 탭 스톱 1개 + 화살표 2차원 이동 + Enter/클릭 선택 유지.
 */
describe("tile palette grid roving tabindex", () => {
  let restore: () => void;
  let container: HTMLElement;

  const gridCells = (): FakeElement[] => {
    const grid = findByTestId(container as unknown as FakeElement, "oprn-palette-grid");
    expect(grid).not.toBeNull();
    return grid!.querySelectorAll("button");
  };

  const pressKey = (cell: FakeElement, key: string): void => {
    const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
    Object.defineProperty(event, "key", { configurable: true, value: key });
    cell.dispatchEvent(event);
  };

  beforeEach(() => {
    restore = installFakeDom();
    store.replace(createBlankProject());
    resetEditorUiModeForTests("standard");
    container = document.createElement("div");
    document.body.append(container);
    editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
    renderTilePalette(container);
  });

  afterEach(() => {
    restore();
  });

  it("exposes exactly one tab stop across the whole grid", () => {
    const cells = gridCells();
    expect(cells.length).toBeGreaterThan(GRID_PALETTE_COLUMNS * 2);
    const tabStops = cells.filter((cell) => cell.getAttribute("tabindex") === "0");
    expect(tabStops.length).toBe(1);
    const skipped = cells.filter((cell) => cell.getAttribute("tabindex") === "-1");
    expect(skipped.length).toBe(cells.length - 1);
  });

  it("ArrowRight moves focus one column along the row", () => {
    const cells = gridCells();
    cells[0]!.focus();
    pressKey(cells[0]!, "ArrowRight");
    expect(document.activeElement).toBe(cells[1]);
    expect(cells[1]!.getAttribute("tabindex")).toBe("0");
    expect(cells[0]!.getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowDown moves focus one full row down, ArrowUp comes back", () => {
    const cells = gridCells();
    cells[0]!.focus();
    pressKey(cells[0]!, "ArrowDown");
    expect(document.activeElement).toBe(cells[GRID_PALETTE_COLUMNS]);
    pressKey(cells[GRID_PALETTE_COLUMNS]!, "ArrowUp");
    expect(document.activeElement).toBe(cells[0]);
  });

  it("Home/End jump to the first and last cell of the grid", () => {
    const cells = gridCells();
    cells[GRID_PALETTE_COLUMNS + 2]!.focus();
    pressKey(cells[GRID_PALETTE_COLUMNS + 2]!, "End");
    expect(document.activeElement).toBe(cells.at(-1));
    pressKey(cells.at(-1)!, "Home");
    expect(document.activeElement).toBe(cells[0]);
  });

  it("Enter on the focused cell selects that tile", () => {
    const cells = gridCells();
    const target = cells[GRID_PALETTE_COLUMNS + 1]!;
    const tileIndex = Number.parseInt(target.dataset.tileIndex ?? "-1", 10);
    expect(tileIndex).toBeGreaterThanOrEqual(0);
    target.focus();
    pressKey(target, "Enter");
    expect(editorState.get().selectedTile).toBe(tileIndex);
  });

  it("keeps the pointer selection path and per-cell testids intact", () => {
    const cells = gridCells();
    const target = cells[3]!;
    const tileIndex = Number.parseInt(target.dataset.tileIndex ?? "-1", 10);
    expect(target.dataset.testid).toBe(`chipset-tile-${tileIndex}`);
    const event = new Event("pointerdown", { bubbles: true, cancelable: true }) as Event & { button: number };
    Object.defineProperty(event, "button", { configurable: true, value: 0 });
    target.dispatchEvent(event);
    expect(editorState.get().selectedTile).toBe(tileIndex);
  });
});
