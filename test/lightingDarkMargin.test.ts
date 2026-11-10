import { describe, expect, it } from "vitest";
import { drawLightingMask, lightingGradientParams, lightingMaskSignature } from "@/player/lighting";

type Rect = { x: number; y: number; w: number; h: number };

function recordingCanvas(): { canvas: HTMLCanvasElement; fills: Rect[] } {
  const fills: Rect[] = [];
  const context = {
    globalCompositeOperation: "source-over", globalAlpha: 1, fillStyle: "",
    save() {}, restore() {}, clearRect() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, scale() {},
    fillRect(x: number, y: number, w: number, h: number) { fills.push({ x, y, w, h }); },
    createRadialGradient() { return { addColorStop() {} }; },
    arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {},
  };
  const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
  return { canvas, fills };
}

const base = {
  viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
  resolveAnchor: () => null,
  // 맵이 화면 가운데 160px 만 차지한다(양옆 80px 은 맵 밖 여백).
  mapBounds: { x: 80, y: 0, width: 160, height: 240 },
};

describe("darkness mask over a drawn map margin (fs-vqa-fix-all, sky tower seam)", () => {
  const lighting = { ambient: 0.5, color: "#0c1424", sources: [] };

  it("keeps the darkness inside the map when the margin is plain", () => {
    const params = lightingGradientParams(lighting, base);
    const { canvas, fills } = recordingCanvas();
    drawLightingMask(canvas, params);
    expect(fills[0]).toEqual({ x: 80, y: 0, w: 160, h: 240 });
  });

  it("darkens the whole screen when the map background is drawn in empty cells", () => {
    const params = lightingGradientParams(lighting, { ...base, darkMargin: true });
    const { canvas, fills } = recordingCanvas();
    drawLightingMask(canvas, params);
    expect(fills[0]).toEqual({ x: 0, y: 0, w: 320, h: 240 });
    expect(lightingMaskSignature(params)).not.toBe(lightingMaskSignature(lightingGradientParams(lighting, base)));
  });
});
