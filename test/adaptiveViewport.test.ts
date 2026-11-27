import { describe, expect, it } from "vitest";
import { calculateAdaptiveViewport } from "@/player/playSurfaceScale";
import { calculateTouchLayout } from "@/player/playSurface";
import {
  normalizePlaySurfaceScale,
  normalizePortraitLayout,
  resolvePlaySurfaceScaleMode,
  resolvePortraitLayout,
} from "@/project/playSurfaceScaleMode";

const zeroSafe = { top: 0, right: 0, bottom: 0, left: 0 };

describe("adaptive viewport & portrait layout modes", () => {
  it("normalizes and resolves playSurfaceScale and portraitLayout defaults", () => {
    expect(normalizePlaySurfaceScale("adaptive")).toBe("adaptive");
    expect(normalizePlaySurfaceScale("integer")).toBe("integer");
    expect(normalizePlaySurfaceScale("fit")).toBe("fit");
    expect(normalizePlaySurfaceScale("unknown")).toBeUndefined();

    expect(normalizePortraitLayout("ds")).toBe("ds");
    expect(normalizePortraitLayout("fullbleed")).toBe("fullbleed");
    expect(normalizePortraitLayout("invalid")).toBeUndefined();

    expect(resolvePlaySurfaceScaleMode({
      meta: { title: "Demo" } as never,
      system: { playResolution: { width: 480, height: 270 } },
    })).toBe("adaptive");

    expect(resolvePlaySurfaceScaleMode({
      meta: { title: "VN" } as never,
      system: { playResolution: { width: 1024, height: 768 }, dialogueStyle: "dual-fullbody-veil" },
    })).toBe("integer");

    expect(resolvePlaySurfaceScaleMode({
      meta: { title: "Legacy" } as never,
      system: {},
    })).toBe("fit");

    expect(resolvePortraitLayout({ system: {} })).toBe("ds");
    expect(resolvePortraitLayout({ system: { portraitLayout: "fullbleed" } })).toBe("fullbleed");
  });

  it("fills desktop & laptop viewports with crisp integer scaling and zero letterboxing", () => {
    // 1920x1080 FHD -> exact 4x 480x270
    const fhd = calculateAdaptiveViewport(1920, 1080, 480, 270);
    expect(fhd.scale).toBe(4);
    expect(fhd.logicalWidth).toBe(480);
    expect(fhd.logicalHeight).toBe(270);

    // 1440x900 Laptop -> crisp 3x 480x300 (zero letterbox!)
    const laptop = calculateAdaptiveViewport(1440, 900, 480, 270);
    expect(laptop.scale).toBe(3);
    expect(laptop.logicalWidth).toBe(480);
    expect(laptop.logicalHeight).toBe(300);

    // 2560x1440 QHD -> crisp 5x 512x288 (zero letterbox!)
    const qhd = calculateAdaptiveViewport(2560, 1440, 480, 270);
    expect(qhd.scale).toBe(5);
    expect(qhd.logicalWidth).toBe(512);
    expect(qhd.logicalHeight).toBe(288);
  });

  it("renders mobile portrait in DS mode at 2x integer zoom in the upper ~55% with a 1x lower deck", () => {
    const layout = calculateTouchLayout(390, 844, 480, 270, zeroSafe, {
      scaleMode: "adaptive",
      portraitLayout: "ds",
    });
    expect(layout.mode).toBe("portrait");
    expect(layout.scale).toBe(2);
    expect(layout.logicalWidth).toBe(195);
    expect(layout.logicalHeight).toBeGreaterThanOrEqual(210);
    expect(layout.logicalHeight).toBeLessThanOrEqual(240);
    expect(layout.overlayControls).toBeUndefined();
    expect(layout.dock).not.toBeNull();
    expect(layout.dock!.scale).toBe(1);
    expect(layout.panel).not.toBeNull();
    expect(layout.panel!.scale).toBe(1);
  });

  it("renders mobile portrait in fullbleed mode at 2x integer zoom filling 100% with translucent overlay controls", () => {
    const layout = calculateTouchLayout(390, 844, 480, 270, zeroSafe, {
      scaleMode: "adaptive",
      portraitLayout: "fullbleed",
    });
    expect(layout.mode).toBe("portrait");
    expect(layout.scale).toBe(2);
    expect(layout.logicalWidth).toBe(195);
    expect(layout.logicalHeight).toBe(422);
    expect(layout.logicalHeight * layout.scale).toBeGreaterThanOrEqual(844);
    expect(layout.overlayControls).toBe(true);
    expect(layout.dock).not.toBeNull();
    expect(layout.dock!.scale).toBe(1);
  });
});
