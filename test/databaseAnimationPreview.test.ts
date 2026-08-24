import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { animationReferenceTarget } from "@/editor/panels/databaseAnimationRecordView";
import { createBlankProject } from "@/project/defaults";
import type { BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly Image: typeof globalThis.Image | undefined;
  readonly window: typeof globalThis.window | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = { Image: globalThis.Image, window: globalThis.window };
  vi.useFakeTimers();
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      addEventListener(): void {}
      set src(_value: string) {}
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearInterval: globalThis.clearInterval,
      setInterval: globalThis.setInterval,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
});

describe("database animation preview", () => {
  it("renders a playback button that toggles to stop while frames are playing", () => {
    const project = createBlankProject();
    const animation = project.database.battleAnimations[0] as BattleAnimationRecord;
    const sheet: BattleAnimationSheet = animation.sheet ?? { frameWidth: 96, frameHeight: 96, columns: 5 };
    const frames: readonly BattleAnimationFrame[] = [
      { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
      { cells: [{ pattern: 1, x: 8, y: 4, zoom: 100, opacity: 255, visible: true }] },
    ];

    const panel = renderAnimationStagePanel({
      animation,
      currentSelectedFrameCells: () => frames[0]?.cells.map((cell) => ({ ...cell })) ?? [],
      duplicateLastFrame: vi.fn(),
      frames,
      project,
      selectedFrame: frames[0],
      selectedFrameIndex: 0,
      sheet,
      updateSelectedFrameCells: vi.fn(),
    });
    if (!(panel instanceof FakeElement)) throw new Error("Expected fake animation panel");

    const play = findByTestId(panel, "db-animation-play");
    expect(play?.textContent).toBe("▶ 재생");

    play?.click();
    expect(play?.textContent).toBe("■ 정지");
    expect(play?.attrs["aria-pressed"]).toBe("true");

    vi.advanceTimersByTime(140);
    expect(play?.textContent).toBe("▶ 재생");
    expect(play?.attrs["aria-pressed"]).toBe("false");
  });

  it("derives the target field from skill and item animation references instead of a hard-coded enemy name", () => {
    const project = createBlankProject();
    const animation = project.database.battleAnimations.find((entry) => entry.id === "anim_hit");
    if (!animation) throw new Error("Missing default hit animation");

    expect(animationReferenceTarget(animation, project.database)).toBe("공격");
    expect(animationReferenceTarget(animation, project.database)).not.toBe("말벌");
    expect(animationReferenceTarget({ id: "anim_unused", name: "미사용" }, project.database)).toBe("(참조 없음)");
  });
});

function restoreBrowserGlobal<Key extends keyof FakeBrowserGlobals>(name: Key, value: FakeBrowserGlobals[Key]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
