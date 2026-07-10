import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderSelectionActionChips,
  SELECTION_CHIP_PRESETS,
  selectionChipModalOptions,
} from "@/editor/selectionActionChips";
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

  it("프리셋 칩은 지시문과 autoRun을 채운다", () => {
    const preset = SELECTION_CHIP_PRESETS.find((p) => p.id === "polish");
    const options = selectionChipModalOptions(preset!, SELECTION);
    expect(options.initialInstruction).toContain("영역");
    expect(options.autoRun).toBe(true);
  });
});

describe("renderSelectionActionChips", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("칩 3개를 렌더하고 클릭 시 주입된 openModal을 호출한다", () => {
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
