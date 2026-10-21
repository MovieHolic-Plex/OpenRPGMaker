// 맵 배경(파노라마) 그림 생성 — generate_map_background 의 브라우저 쪽.
// 이미지 모델(사용자가 연결한 이미지 계정, 용도 "backdrop")로 한 장을 만들고, 게임 도트로 내린다:
//   · horizon 먼 층  : 640×240(견본 지평선과 같은 크기)·32색, 좌우가 이어지게(가로 반복)
//   · horizon 가까운 층: 마젠타 바탕을 지운 실루엣 띠, 640×240·24색, 좌우 이음, 띠 바닥을 맵 바닥선(보이는 하늘 높이)에 세움
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
    `One separate parallax layer for a 2D JRPG side-view horizon background: ONLY a band of mid-distance silhouettes for this scene: ${scene} (for example far hills, dunes, ruined towers, castle walls or a treeline). Draw no sky, no sun, no moon and no clouds in this layer — those are in another layer.`,
    "The band runs across the full width with an irregular, jagged top outline (peaks, towers, tree tops), filling down to the bottom of the picture. Its left and right ends must join seamlessly because it repeats horizontally.",
    "EVERYTHING that is not the silhouette band — all the sky above it and everything below it — MUST be exactly solid flat magenta #FF00FF with no gradient, texture or glow, so it can be removed. Never use magenta inside the silhouettes.",
    "Retro 16-bit console palette, dark readable silhouettes with a little rim light, limited colours.",
    NO_TEXT,
  ].join("\n\n");
  return [
    `One wide panoramic far-background layer for a 2D top-down pixel-art JRPG map, seen from the side like a distant horizon: ${scene}.`,
    "Put the key sky feature (moon, sun, storm wall, aurora) AND the horizon line with its distant silhouettes in the TOP 40% of the picture — the game usually shows only the top part above the map's floor. The rest below continues as calm far terrain, sea or haze with no important detail.",
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

/** 지평선 배경에서 게임 첫 화면에 비치는 위쪽 높이(px) 기본값 — 맵 위 7줄(16px 칸). */
export const MAP_PANORAMA_DEFAULT_VISIBLE_TOP = 112;

/**
 * 가까운 실루엣 층을 «보이는 하늘 띠의 바닥(= 맵 바닥선)» 에 세운다. 생성 그림의 띠는 어디에 있든(대개 그림 가운데)
 * 바닥선 아래로 숨어 버렸다(2026-10-22 검수: 성·사구 층이 타일에 가려 한 번도 안 보임). 띠의 윗부분(들쭉날쭉한 윤곽)을 살려
 * 바닥이 visibleTop 에 오게 옮기고, 그 아래는 띠의 맨 아래 줄로 채워 곧은 가장자리가 보이지 않게 한다.
 * 윗선이 평평하면(하늘까지 통째로 그린 직사각형) 실루엣이 아니므로 거절한다.
 */
export function seatSilhouetteBand(image: RgbaImage, visibleTop: number): RgbaImage {
  const { width, height, data } = image;
  const tops: number[] = [];
  let bottom = -1;
  for (let x = 0; x < width; x += 1) {
    let top = -1;
    for (let y = 0; y < height; y += 1) if (data[(y * width + x) * 4 + 3]! > 127) { if (top < 0) top = y; if (y > bottom) bottom = y; }
    if (top >= 0) tops.push(top);
  }
  if (tops.length < width * 0.6 || bottom < 0) throw new Error("가까운 층에서 실루엣 띠를 찾지 못했습니다(대부분 투명).");
  const highest = Math.min(...tops);
  const flat = tops.filter((top) => top <= highest + 1).length / tops.length;
  if (flat > 0.5) throw new Error("가까운 층이 들쭉날쭉한 실루엣이 아니라 윗선이 평평한 띠(하늘까지 통째로 그린 그림)입니다.");
  const lowestTop = Math.max(...tops);
  const seat = Math.max(8, Math.min(height, Math.round(visibleTop)));
  // 띠 높이: 윤곽 전체(가장 높은 봉우리 ~ 가장 낮은 윗선) + 조금. 보이는 하늘의 60% 를 넘기지 않는다.
  const band = Math.max(4, Math.min(Math.round(seat * 0.6), lowestTop - highest + Math.round((bottom - lowestTop) * 0.25) + 4, bottom - highest + 1));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y < seat - band ? -1 : Math.min(highest + (y - (seat - band)), highest + band - 1);
    if (sourceY < 0) continue;
    out.set(data.subarray(sourceY * width * 4, (sourceY + 1) * width * 4), y * width * 4);
  }
  // 띠 아래(바닥선 아래) 줄에서 투명한 칸은 그 열의 마지막 불투명 색으로 채운다 — 그 아래 먼 층이 곧은 선으로 비치지 않게.
  for (let x = 0; x < width; x += 1) {
    let fill = -1;
    for (let y = seat - band; y < height; y += 1) {
      if (y < 0) continue;
      const k = (y * width + x) * 4;
      if (out[k + 3]! > 127) { fill = k; continue; }
      if (y >= seat - 1 && fill >= 0) out.set(out.subarray(fill, fill + 4), k);
    }
  }
  // 띠 사이 틈으로 끝까지 투명한 열은 바닥선 아래에서 가까운 옆 열 색으로 메운다(가로 반복이라 양끝은 이어진다).
  for (let y = Math.max(0, seat - 1); y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (out[(row + x) * 4 + 3]! > 127) continue;
      for (let d = 1; d < width; d += 1) {
        const left = (row + ((x - d + width) % width)) * 4, right = (row + ((x + d) % width)) * 4;
        const from = out[left + 3]! > 127 ? left : out[right + 3]! > 127 ? right : -1;
        if (from >= 0) { out.set(out.subarray(from, from + 4), (row + x) * 4); break; }
      }
    }
  }
  return { width, height, data: out };
}

/** 생성 그림 → 게임 도트 배경. 순수 처리(코덱만 imageProcess 를 쓴다). */
export async function processMapPanorama(dataUrl: string, layer: MapPanoramaLayer, view: MapPanoramaView, visibleTop = MAP_PANORAMA_DEFAULT_VISIBLE_TOP): Promise<string> {
  const { coverCrop, decodeImage, encodePng, pixelate } = await import("@/editor/cutsceneArt/imageProcess");
  const target = MAP_PANORAMA_TARGET[view];
  const source = await decodeImage(dataUrl);
  // 이음 띠만큼 더 넓게(세로 반복이면 더 높게) 잘라 두고 섞은 뒤 목표 비율에 맞춘다.
  const aspect = (target.width * (1 + SEAM_SHARE)) / (target.height * (view === "surface" ? 1 + SEAM_SHARE : 1));
  let image = coverCrop(source, aspect);
  image = makeSeamlessX(image, image.width * SEAM_SHARE / (1 + SEAM_SHARE));
  if (view === "surface") image = makeSeamlessY(image, image.height * SEAM_SHARE / (1 + SEAM_SHARE));
  image = pixelate(image, target.width, target.height, layer === "near" ? 24 : 32);
  if (layer === "near" && view === "horizon") image = seatSilhouetteBand(image, visibleTop);
  return encodePng(image);
}

/**
 * 플레이어 첫 화면에 실제로 보이는 부분 — 지평선 배경이면 가운데 320px 폭(cover 가운데 맞춤)의 위쪽 visibleTop 줄에
 * 가까운 층을 겹친 그림. 조수에게는 이것을 보여 준다(보이지 않는 그림 아래쪽을 보고하지 않게).
 */
export async function composeVisiblePanorama(farUrl: string, nearUrl: string | undefined, view: MapPanoramaView, visibleTop: number, viewport = { width: 320, height: 240 }): Promise<string> {
  const { decodeImage, encodePng } = await import("@/editor/cutsceneArt/imageProcess");
  const far = await decodeImage(farUrl);
  const near = nearUrl ? await decodeImage(nearUrl) : undefined;
  const width = Math.min(viewport.width, far.width);
  const height = view === "horizon" ? Math.max(1, Math.min(far.height, Math.round(visibleTop))) : Math.min(viewport.height, far.height);
  const left = Math.max(0, Math.round((far.width - width) / 2));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const o = (y * width + x) * 4, f = (y * far.width + x + left) * 4;
    for (let c = 0; c < 3; c += 1) out[o + c] = far.data[f + c]!;
    out[o + 3] = 255;
    if (near && y < near.height) {
      const n = (y * near.width + ((x + left) % near.width)) * 4, a = near.data[n + 3]! / 255;
      for (let c = 0; c < 3; c += 1) out[o + c] = near.data[n + c]! * a + out[o + c]! * (1 - a);
    }
  }
  return encodePng({ width, height, data: out });
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
    const visibleTop = typeof args.panoramaVisibleTop === "number" && Number.isFinite(args.panoramaVisibleTop) ? args.panoramaVisibleTop : MAP_PANORAMA_DEFAULT_VISIBLE_TOP;
    const dataUrl = await processMapPanorama(source, layer, view, visibleTop);
    return { ok: true, resourceId: genId(layer === "near" ? "map_bg_near" : "map_bg"), name, prompt, dataUrl };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: error instanceof ImageGenerationError ? "image-generation-failed" : "image-processing-failed", summary: `맵 배경 그림 생성에 실패했습니다: ${message}` };
  }
}
