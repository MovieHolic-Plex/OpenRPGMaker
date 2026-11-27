import { describe, expect, it } from "vitest";
import { calculateAdaptiveViewport } from "@/player/playSurfaceScale";
import { calculateTouchLayout } from "@/player/playSurface";
import {
  normalizePlaySurfaceScale,
  normalizePortraitLayout,
  resolvePlaySurfaceScaleMode,
  resolvePortraitLayout,
} from "@/project/playSurfaceScaleMode";
import { resolveStartViewProfile } from "@/start/projectStart";

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

  it("assigns genre-tiered wide start resolutions and indoor smallMapFill defaults", () => {
    expect(resolveStartViewProfile("farm-life", "wide")).toEqual({
      resolution: { width: 640, height: 360 },
      smallMapFill: true,
    });
    expect(resolveStartViewProfile("action-rpg", "wide")).toEqual({
      resolution: { width: 640, height: 360 },
      smallMapFill: true,
    });
    expect(resolveStartViewProfile("adventure-jrpg", "wide")).toEqual({
      resolution: { width: 480, height: 270 },
    });
    expect(resolveStartViewProfile("story-cutscene", "wide")).toEqual({
      resolution: { width: 480, height: 270 },
    });
    expect(resolveStartViewProfile("horror-chase", "wide")).toEqual({
      resolution: { width: 384, height: 216 },
    });
    // 몬스터 수집은 에메랄드 전용 480×320 규격을 덮어쓰지 않는다.
    expect(resolveStartViewProfile("monster-collect", "wide")).toBeUndefined();
    expect(resolveStartViewProfile(null, "wide")).toEqual({
      resolution: { width: 480, height: 270 },
    });
    expect(resolveStartViewProfile("farm-life", "classic")).toBeUndefined();

    // 각 장르 기준 해상도에서 FHD(1920×1080)가 정확한 정수배(3x/4x/5x)로 떨어진다.
    expect(calculateAdaptiveViewport(1920, 1080, 640, 360)).toMatchObject({ scale: 3, logicalWidth: 640, logicalHeight: 360 });
    expect(calculateAdaptiveViewport(1920, 1080, 480, 270)).toMatchObject({ scale: 4, logicalWidth: 480, logicalHeight: 270 });
    expect(calculateAdaptiveViewport(1920, 1080, 384, 216)).toMatchObject({ scale: 5, logicalWidth: 384, logicalHeight: 216 });
  });
});
