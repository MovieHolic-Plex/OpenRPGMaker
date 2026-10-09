import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import { footprintBounds, UNIT_FOOTPRINT } from "@/project/footprint";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class TestHost extends FakeElement {
  constructor() {
    super("div");
  }
}

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

function hostElement(host: TestHost): HTMLElement {
  return host as unknown as HTMLElement;
}

function view(index: number, sprite: boolean): RuntimeEventView {
  const id = `event_${index}`;
  return {
    event: {
      id,
      x: index,
      y: index,
      trigger: { kind: "action" },
      commands: [],
      ...(sprite ? { sprite: { type: "bundled", id: "npc" } as const } : {}),
    },
    page: undefined,
    pageId: undefined,
    x: index,
    y: index,
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    // 마커는 크기가 아니라 **계산된 사각**을 쓴다. 1x1 모든 사겁은 발밑 앵커에서 한 칸이다.
    footprint: UNIT_FOOTPRINT,
    passRows: UNIT_FOOTPRINT.height,
    bodyRect: footprintBounds(index, index, UNIT_FOOTPRINT),
    passRect: footprintBounds(index, index, UNIT_FOOTPRINT),
    scale: 1,
    transparent: false,
    animationType: "normal",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    sprite: sprite ? { type: "bundled", id: "npc" } : undefined,
    direction: undefined,
    runtimeDirection: undefined,
  };
}

describe("RuntimeDomOverlay debug markers", () => {
  it("normal mode creates and updates no markers or stage bounds", () => {
    const host = new TestHost();
    let sizeReads = 0;
    let markerWrites = 0;
    const overlay = new RuntimeDomOverlay(() => hostElement(host), {
      playResolution: { width: 320, height: 240 },
      stageSizeProvider: (resolution) => {
        sizeReads += 1;
        return resolution;
      },
      onMarkerWrite: () => {
        markerWrites += 1;
      },
    });

    for (let index = 0; index < 8; index += 1) overlay.upsertEventMarker(view(index, true));
    for (let update = 0; update < 120; update += 1) overlay.syncCameraOffset(update + 1, update + 1);
    overlay.signalResize();

    expect(host.querySelectorAll(".runtime-debug-marker")).toHaveLength(0);
    expect(sizeReads).toBe(0);
    expect(markerWrites).toBe(0);
  });

  it("QA mode caches one stage read per explicit resize and batches marker writes without reads", () => {
    const host = new TestHost();
    let sizeReads = 0;
    let markerWrites = 0;
    let firstWriteReadCount = -1;
    const overlay = new RuntimeDomOverlay(() => hostElement(host), {
      qaInstrumentation: true,
      playResolution: { width: 320, height: 240 },
      stageSizeProvider: (resolution) => {
        sizeReads += 1;
        return resolution;
      },
      onMarkerWrite: () => {
        markerWrites += 1;
        if (firstWriteReadCount < 0) firstWriteReadCount = sizeReads;
        expect(sizeReads).toBe(firstWriteReadCount);
      },
    });

    for (let index = 0; index < 8; index += 1) overlay.upsertEventMarker(view(index, true));
    expect(host.querySelectorAll(".runtime-debug-marker")).toHaveLength(16);
    expect(sizeReads).toBe(1);

    for (let update = 0; update < 120; update += 1) overlay.syncCameraOffset(update + 1, update + 1);
    expect(sizeReads).toBe(1);
    expect(markerWrites).toBe(16 + 120 * 16);

    firstWriteReadCount = -1;
    overlay.signalResize();
    expect(sizeReads).toBe(2);
    expect(markerWrites).toBe(16 + 121 * 16);

    const marker = findByTestId(host, "event-event_7");
    expect(marker?.style.left).toBe("-8px");
    expect(marker?.style.top).toBe("-8px");
    expect(marker?.style.visibility).toBe("");
    expect(marker?.style.pointerEvents).toBe("");
  });
});
