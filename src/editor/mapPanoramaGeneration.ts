// 맵 배경(파노라마) 그림 생성 — generate_map_background 의 브라우저 쪽.
// 이미지 모델(사용자가 연결한 이미지 계정, 용도 "backdrop")로 한 장을 만들고, 게임 도트로 내린다:
//   · horizon 먼 층  : 640×240(견본 지평선과 같은 크기)·40색, 좌우가 이어지게(가로 반복)
//   · horizon 가까운 층: 마젠타 바탕을 지운 실루엣 띠, 640×240·24색, 좌우 이음
//   · surface        : 위에서 본 면 320×256·40색, 상하좌우 이음
// Pi 렌더 브로커(scripts/lib/piRenderBroker.ts)의 «still» 응답 모양(CinematicStillResult)을 그대로 쓴다.

import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { genId } from "@/util/id";
import type { RgbaImage } from "@/editor/cutsceneArt/imageProcess";
import type { CinematicStillResult } from "./openingImageGeneration";

export type MapPanoramaLayer = "far" | "near";
export type MapPanoramaView = "horizon" | "surface";

export const MAP_PANORAMA_TARGET: Readonly<Record<MapPanoramaView, { width: number; height: number }>> = {
  horizon: { width: 640, height: 240 },
  surface: { width: 320, height: 256 },
};
/** 이음매를 섞는 띠 — 원본 폭의 이 비율만큼 오른쪽 끝을 왼쪽 시작과 겹쳐 섞는다. */
const SEAM_SHARE = 0.12;

const NO_TEXT = "No text, letters, logos, watermarks, signatures, UI, borders or frames. No people, no animals, no characters.";

export function buildMapPanoramaPrompt(prompt: string, layer: MapPanoramaLayer, view: MapPanoramaView): string {
  const scene = JSON.stringify(prompt.replace(/\s+/gu, " ").trim());
  if (view === "surface") return [
    `One seamless top-down texture for the space around a 2D JRPG map, seen from directly above: ${scene}.`,
    "Fill the whole canvas evenly with no single focal object, no horizon and no perspective. It will repeat in both directions, so the left edge must continue the right edge and the top edge must continue the bottom edge.",
    "Retro 16-bit console palette, clear simple shapes, limited colours, no blur.",
    NO_TEXT,
  ].join("\n\n");
  if (layer === "near") return [
    `One separate parallax layer for a 2D JRPG side-view horizon background: ONLY a band of mid-distance silhouettes for this scene: ${scene} (for example far hills, dunes, ruined towers, castle walls or a treeline).`,
    "The band runs across the full width; its top edge sits about one third from the top of the picture and it fills down to about the middle. Its left and right ends must join seamlessly because it repeats horizontally.",
    "EVERYTHING that is not the silhouette band — all the sky above it and everything below it — MUST be exactly solid flat magenta #FF00FF with no gradient, texture or glow, so it can be removed. Never use magenta inside the silhouettes.",
    "Retro 16-bit console palette, dark readable silhouettes with a little rim light, limited colours.",
    NO_TEXT,
  ].join("\n\n");
  return [
    `One wide panoramic far-background layer for a 2D top-down pixel-art JRPG map, seen from the side like a distant horizon: ${scene}.`,
    "Put the key sky feature (moon, sun, storm wall, aurora, distant silhouettes) and the horizon line in the UPPER HALF of the picture — the game shows mostly the top part. The lower half continues as calm far terrain, sea or haze.",
    "Wide landscape format. It repeats horizontally, so the left and right edges must continue each other: nothing cut at either edge, no vignette, no frame. No foreground objects.",
    "Retro 16-bit console palette (SNES era), clear simple shapes, limited colours, no photographic detail.",
    NO_TEXT,
  ].join("\n\n");
}

/** 오른쪽 끝 띠를 왼쪽 시작과 섞어 잘라 낸다 — 결과의 오른쪽 끝 열 다음에 왼쪽 첫 열이 자연스럽게 온다. */
export function makeSeamlessX(image: RgbaImage, band: number): RgbaImage {
  const b = Math.max(1, Math.min(Math.floor(image.width / 3), Math.round(band)));
  const width = image.width - b, out = new Uint8ClampedArray(width * image.height * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4, i = (y * image.width + x) * 4;
      if (x >= b) { out.set(image.data.subarray(i, i + 4), o); continue; }
      const t = (x + 0.5) / b, j = (y * image.width + x + width) * 4;
      for (let c = 0; c < 4; c += 1) out[o + c] = image.data[j + c]! * (1 - t) + image.data[i + c]! * t;
    }
  }
  return { width, height: image.height, data: out };
}

/** 세로 이음 — makeSeamlessX 를 행 방향으로. */
export function makeSeamlessY(image: RgbaImage, band: number): RgbaImage {
  const b = Math.max(1, Math.min(Math.floor(image.height / 3), Math.round(band)));
  const height = image.height - b, row = image.width * 4, out = new Uint8ClampedArray(row * height);
  for (let y = 0; y < height; y += 1) {
    if (y >= b) { out.set(image.data.subarray(y * row, (y + 1) * row), y * row); continue; }
    const t = (y + 0.5) / b;
    for (let k = 0; k < row; k += 1) out[y * row + k] = image.data[(y + height) * row + k]! * (1 - t) + image.data[y * row + k]! * t;
  }
  return { width: image.width, height, data: out };
}

/** 생성 그림 → 게임 도트 배경. 순수 처리(코덱만 imageProcess 를 쓴다). */
export async function processMapPanorama(dataUrl: string, layer: MapPanoramaLayer, view: MapPanoramaView): Promise<string> {
  const { coverCrop, decodeImage, encodePng, pixelate } = await import("@/editor/cutsceneArt/imageProcess");
  const target = MAP_PANORAMA_TARGET[view];
  const source = await decodeImage(dataUrl);
  // 이음 띠만큼 더 넓게(세로 반복이면 더 높게) 잘라 두고 섞은 뒤 목표 비율에 맞춘다.
  const aspect = (target.width * (1 + SEAM_SHARE)) / (target.height * (view === "surface" ? 1 + SEAM_SHARE : 1));
  let image = coverCrop(source, aspect);
  image = makeSeamlessX(image, image.width * SEAM_SHARE / (1 + SEAM_SHARE));
  if (view === "surface") image = makeSeamlessY(image, image.height * SEAM_SHARE / (1 + SEAM_SHARE));
  return encodePng(pixelate(image, target.width, target.height, layer === "near" ? 24 : 40));
}

export type MapPanoramaRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
};

export async function generateMapPanoramaLayer(args: Record<string, unknown>, options: MapPanoramaRequest = {}): Promise<CinematicStillResult> {
  const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
  const layer: MapPanoramaLayer = args.panoramaLayer === "near" ? "near" : "far";
  const view: MapPanoramaView = args.panoramaView === "surface" ? "surface" : "horizon";
  const name = typeof args.name === "string" && args.name.trim() ? args.name.trim().slice(0, 120) : `맵 배경: ${prompt.slice(0, 24)}`;
  if (prompt.length < 6) return { ok: false, code: "invalid-args", summary: "맵 배경 설명(prompt)이 너무 짧습니다." };
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({ prompt: buildMapPanoramaPrompt(prompt, layer, view), purpose: "backdrop", ...(options.signal ? { signal: options.signal } : {}) });
    options.signal?.throwIfAborted();
    let source = image.dataUrl;
    if (layer === "near") {
      const { removeOpeningChroma } = await import("./openingImageGeneration");
      source = await removeOpeningChroma(source, options.signal);
    }
    const dataUrl = await processMapPanorama(source, layer, view);
    return { ok: true, resourceId: genId(layer === "near" ? "map_bg_near" : "map_bg"), name, prompt, dataUrl };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: error instanceof ImageGenerationError ? "image-generation-failed" : "image-processing-failed", summary: `맵 배경 그림 생성에 실패했습니다: ${message}` };
  }
}
