import { describe, expect, it } from "vitest";
import { calculatePlaySurfaceScale } from "@/player/playSurfaceScale";
import { normalizePlaySurfaceScale, resolvePlaySurfaceScaleMode } from "@/project/playSurfaceScaleMode";

type SurfaceProject = Parameters<typeof resolvePlaySurfaceScaleMode>[0];
const project = (system: SurfaceProject["system"], meta: SurfaceProject["meta"] = {} as SurfaceProject["meta"]): SurfaceProject => ({ meta, system });

describe("resolvePlaySurfaceScaleMode", () => {
  it("uses integer scaling for projects that store a play resolution (the 480x270 default)", () => {
    expect(resolvePlaySurfaceScaleMode(project({ playResolution: { width: 480, height: 270 } }))).toBe("integer");
  });

  it("keeps legacy 320x240 projects (no stored resolution) on fit", () => {
    expect(resolvePlaySurfaceScaleMode(project({}))).toBe("fit");
  });

  it("honours an authored choice", () => {
    expect(resolvePlaySurfaceScaleMode(project({ playResolution: { width: 480, height: 270 }, playSurfaceScale: "fit" }))).toBe("fit");
    expect(resolvePlaySurfaceScaleMode(project({ playSurfaceScale: "integer" }))).toBe("integer");
  });

  it("keeps monster-collect (emerald) projects on integer even if fit is authored", () => {
    const meta = { oprnMonsterStyle: { version: 1, reference: "emerald" } } as unknown as SurfaceProject["meta"];
    expect(resolvePlaySurfaceScaleMode(project({ playSurfaceScale: "fit" }, meta))).toBe("integer");
  });

  it("drops unknown values", () => {
    expect(normalizePlaySurfaceScale("fill")).toBeUndefined();
    expect(normalizePlaySurfaceScale("fit")).toBe("fit");
  });
});

describe("480x270 integer scaling at common window sizes", () => {
  it("is 4x at FHD, 5x at QHD, 8x at 4K and 2x at 1280x720", () => {
    expect(calculatePlaySurfaceScale(1920, 1080, 480, 270, "integer")).toBe(4);
    expect(calculatePlaySurfaceScale(2560, 1440, 480, 270, "integer")).toBe(5);
    expect(calculatePlaySurfaceScale(3840, 2160, 480, 270, "integer")).toBe(8);
    expect(calculatePlaySurfaceScale(1280, 720, 480, 270, "integer")).toBe(2);
  });

  it("only goes fractional when the window is smaller than 1x", () => {
    expect(calculatePlaySurfaceScale(400, 300, 480, 270, "integer")).toBeCloseTo(400 / 480);
  });
});
