import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderSelectionActionChips,
  SELECTION_CHIP_PRESETS,
  selectionChipModalOptions,
} from "@/editor/selectionActionChips";
import {
  anchoredBuildPalettePosition,
  anchoredSelectionChipsPosition,
} from "@/editor/selectionOverlayAnchor";
import type { RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import type { TileSelection } from "@/editor/editorState";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const SELECTION: TileSelection = { mapId: "map-1", x: 3, y: 4, width: 5, height: 6 };

describe("selectionChipModalOptions", () => {
  it("AI 칩(instruction=null)은 autoRun 없이 모달만 연다", () => {
    const ai = SELECTION_CHIP_PRESETS.find((p) => p.id === "ai");
    expect(ai).toBeTruthy();
    const options = selectionChipModalOptions(ai!, SELECTION);
    expect(options.mapId).toBe("map-1");
    expect(options.region).toEqual({ x: 3, y: 4, width: 5, height: 6 });
    expect(options.initialInstruction).toBeUndefined();
    expect(options.autoRun).toBeUndefined();
  });
});

describe("renderSelectionActionChips", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("AI 칩 1개를 렌더하고 클릭 시 주입된 openModal을 호출한다", () => {
    const calls: RegionTaskModalOptions[] = [];
    const stub = ((options: RegionTaskModalOptions) => {
      calls.push(options);
      return document.createElement("div");
    }) as never;
    const bar = renderSelectionActionChips(SELECTION, stub);
    document.body.append(bar);
    expect(findByTestId(document.body as unknown as FakeElement, "selection-action-chips")).toBeTruthy();
    for (const preset of SELECTION_CHIP_PRESETS) {
      expect(findByTestId(document.body as unknown as FakeElement, `selection-chip-${preset.id}`)).toBeTruthy();
    }
    (findByTestId(document.body as unknown as FakeElement, "selection-chip-ai") as unknown as HTMLElement).click();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.mapId).toBe("map-1");
  });
});

describe("anchoredSelectionChipsPosition", () => {
  const popupSize = { width: 220, height: 36 };
  const canvasSize = { width: 800, height: 600 };

  it("선택 영역 아래·가로 중앙에 둔다", () => {
    const selectionRect = { x: 100, y: 80, width: 160, height: 96 };
    const point = anchoredSelectionChipsPosition({ selectionRect, popupSize, canvasSize });
    expect(point.y).toBe(80 + 96 + 8);
    expect(point.x).toBe(Math.round(100 + 160 / 2 - 220 / 2));
  });

  it("아래 공간이 없으면 위로 올린다", () => {
    const selectionRect = { x: 100, y: 540, width: 120, height: 40 };
    const point = anchoredSelectionChipsPosition({ selectionRect, popupSize, canvasSize });
    expect(point.y).toBe(540 - 36 - 8);
  });

  it("건축 팔레트는 여전히 선택 우측 배치", () => {
    const selectionRect = { x: 100, y: 80, width: 160, height: 96 };
    const build = anchoredBuildPalettePosition({
      selectionRect,
      popupSize: { width: 228, height: 140 },
      canvasSize,
    });
    expect(build.x).toBe(100 + 160 + 8);
  });
});
