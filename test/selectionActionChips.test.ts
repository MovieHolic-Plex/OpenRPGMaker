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
  const selectionRect = { x: 100, y: 80, width: 160, height: 96 };

  it("포인터가 있으면 놓은 점 아래에 띄운다 (context-menu 느낌)", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
      pointer: { x: 400, y: 300 },
    });
    expect(point.x).toBe(400 - 220 / 2);
    expect(point.y).toBe(300 + 16);
  });

  it("포인터 아래가 캔버스를 넘치면 위로 flip 한다", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
      pointer: { x: 400, y: 590 },
    });
    expect(point.y).toBe(590 - 36 - 16);
  });

  it("포인터가 없으면 선택 rect 우측에 세로 중앙", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize,
      canvasSize,
    });
    expect(point.x).toBe(100 + 160 + 8);
    expect(point.y).toBe(80 + 96 / 2 - 36 / 2);
  });

  it("팝업이 캔버스보다 커도 패딩 밖으로 나가지 않는다", () => {
    const point = anchoredSelectionChipsPosition({
      selectionRect,
      popupSize: { width: 900, height: 700 },
      canvasSize,
      pointer: { x: 400, y: 300 },
    });
    expect(point.x).toBe(8);
    expect(point.y).toBe(8);
  });

  it("건축 팔레트는 여전히 선택 우측 배치", () => {
    const build = anchoredBuildPalettePosition({
      selectionRect,
      popupSize: { width: 228, height: 140 },
      canvasSize,
    });
    expect(build.x).toBe(100 + 160 + 8);
  });
});
