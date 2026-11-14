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

// 2026-11-14 QA minor 16: 카메라가 흔들리면 화면 고정 층도 같이 밀려, 화면 크기에 딱 맞춘 어둠 막 가장자리에 낮 밝기의 띠가 드러났다.
describe("darkness mask while the camera shakes", () => {
  const lighting = { ambient: 0.5, color: "#0c1424", sources: [{ id: "lamp", at: { x: 4, y: 3 }, radius: 2, intensity: 1 }] };
  const whole = { ...base, mapBounds: undefined, resolveAnchor: (anchor: unknown) => anchor as { x: number; y: number } };

  it("is exactly the screen when nothing shakes", () => {
    const params = lightingGradientParams(lighting, whole);
    expect([params.width, params.height, params.bleed]).toEqual([320, 240, undefined]);
  });

  it("grows by the shake reach on every side and keeps lights on the same world spot", () => {
    const still = lightingGradientParams(lighting, whole);
    const shaking = lightingGradientParams(lighting, { ...whole, bleed: 24 });
    expect([shaking.width, shaking.height, shaking.bleed]).toEqual([368, 288, 24]);
    expect(shaking.gradients[0]!.centerX - still.gradients[0]!.centerX).toBe(24);
    expect(shaking.gradients[0]!.centerY - still.gradients[0]!.centerY).toBe(24);
    const { canvas, fills } = recordingCanvas();
    drawLightingMask(canvas, shaking);
    expect(fills[0]).toEqual({ x: 0, y: 0, w: 368, h: 288 });
    expect(lightingMaskSignature(shaking)).not.toBe(lightingMaskSignature(still));
  });

  it("moves the map rectangle with the margin so a small room keeps its edges", () => {
    const params = lightingGradientParams(lighting, { ...base, resolveAnchor: () => null, bleed: 10 });
    expect(params.clip).toEqual({ x: 90, y: 10, width: 160, height: 240 });
  });
});
