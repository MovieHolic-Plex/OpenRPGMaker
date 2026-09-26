/**
 * 타이틀 키아트의 깊이 지도(흑백: 흰색=가까움, 검정=멂)를 이미지 모델로 만든다.
 *
 * - 키아트를 참조 그림으로 넘기고 같은 구도의 깊이 지도를 그리게 한다(`generateAiImage` 기존 경로).
 * - 모델은 색을 조금 섞어 돌려주기도 하므로 받은 그림을 명도 한 채널로 바꾸고 0..255 로 늘린 뒤 PNG 로 저장한다.
 * - 런타임 `parallax` 효과가 이 그림을 두 번째 텍스처로 읽어 층마다 다르게 움직인다.
 */
import { generateAiImage } from "@/ai/imageGenerationClient";

export function buildTitleDepthPrompt(): string {
  return [
    "Create a grayscale DEPTH MAP of the reference image.",
    "Exactly the same framing, composition, aspect ratio and object silhouettes as the reference — every edge must line up pixel for pixel.",
    "Pure white = nearest to the camera, pure black = farthest (sky, distant mountains).",
    "Smooth gradients inside surfaces (ground recedes gradually), crisp edges between separate objects (tree trunk vs background).",
    "No colors, no textures, no lighting, no text, no border. Only the depth values.",
  ].join(" ");
}

export interface TitleDepthResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

function splitDataUrl(dataUrl: string): { mimeType: "image/png" | "image/jpeg" | "image/webp"; data: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("키아트 그림 형식을 읽지 못했습니다.");
  return { mimeType: match[1] as "image/png" | "image/jpeg" | "image/webp", data: match[2]! };
}

/** 받은 그림을 명도 한 채널로 바꾸고 1%·99% 분위로 대비를 늘린다. 순수 함수 — 테스트·스크립트가 같이 쓴다. */
export function normalizeDepthPixels(data: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  const n = data.length / 4;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = Math.round(0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!);
    data[o] = v;
    hist[v]!++;
  }
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && acc + hist[lo]! <= n * 0.01; lo++) acc += hist[lo]!;
  for (let acc = 0; hi > 0 && acc + hist[hi]! <= n * 0.01; hi--) acc += hist[hi]!;
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = Math.max(0, Math.min(255, Math.round(((data[o]! - lo) / span) * 255)));
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
}

/** 키아트 크기에 맞춰 깊이 지도를 다시 그리고 정규화한다(모델이 크기를 바꿔 돌려줘도 좌표가 맞는다). */
export async function finalizeDepthMap(depthDataUrl: string, width: number, height: number): Promise<TitleDepthResult> {
  const image = await loadImage(depthDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  normalizeDepthPixels(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export async function generateTitleDepthMap(artDataUrl: string, options: { signal?: AbortSignal } = {}): Promise<TitleDepthResult> {
  const art = await loadImage(artDataUrl);
  const generated = await generateAiImage(
    { prompt: buildTitleDepthPrompt(), referenceImages: [splitDataUrl(artDataUrl)], ...(options.signal ? { signal: options.signal } : {}) },
  );
  // 깊이 지도는 흐릿해도 되므로 긴 변 512 로 줄여 저장한다.
  const scale = Math.min(1, 512 / Math.max(art.naturalWidth, art.naturalHeight));
  return finalizeDepthMap(generated.dataUrl, Math.round(art.naturalWidth * scale), Math.round(art.naturalHeight * scale));
}
