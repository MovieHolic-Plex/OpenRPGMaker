// editor/titleLogoGeneration.ts
// 타이틀 로고 그림 생성. 모델은 투명 배경을 약속하지 않으므로 흰 바탕에 그리게 하고,
// 가장자리에서 이어진 밝은 무채색만 투명으로 지운 뒤(글자 속 흰색은 남는다) 여백을 잘라 낸다.
// 등록·연결은 키아트와 같이 기존 쓰기 툴(upsert_resource → set_title_screen) 묶음으로 한다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { genId } from "@/util/id";

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;
/** 가장 어두운 채널이 이 값 이상이고 채널 폭이 BG_SPREAD 이하면 바탕으로 본다. */
const BG_MIN_CHANNEL = 215;
const BG_SPREAD = 28;
const CROP_PADDING = 6;

export type TitleLogoGenerationOptions = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  /** 흰 바탕 제거. 기본은 캔버스 flood fill. 테스트에서 바꿔 끼운다. */
  readonly cutout?: (dataUrl: string) => Promise<string>;
};

export type TitleLogoGenerationResult =
  | { readonly ok: true; readonly resourceId: string; readonly name: string; readonly dataUrl: string }
  | { readonly ok: false; readonly summary: string; readonly code: string };

export function buildTitleLogoPrompt(title: string, mood?: string): string {
  return [
    `A fantasy RPG game title logo that reads exactly "${title}".`,
    "Wide horizontal wordmark, ornate lettering with metallic bevel, emblem flourishes allowed but the text must stay legible.",
    mood ? `Mood and motifs: ${mood}.` : "",
    "Isolated on a pure flat white background, no scenery, no frame, no drop shadow onto the background, no extra text.",
  ].filter(Boolean).join(" ");
}

export async function generateTitleLogo(
  args: { readonly title: string; readonly mood?: string },
  options: TitleLogoGenerationOptions = {},
): Promise<TitleLogoGenerationResult> {
  const title = args.title.trim();
  if (!title) return { ok: false, summary: "게임 타이틀이 비어 있어 로고를 그릴 수 없습니다.", code: "invalid-args" };
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({
      prompt: buildTitleLogoPrompt(title, args.mood?.trim() || undefined),
      signal: options.signal,
    });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) {
      return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다. 다시 시도하세요.", code: "image-invalid" };
    }
    const dataUrl = await (options.cutout ?? cutoutWhiteBackground)(image.dataUrl);
    options.signal?.throwIfAborted();
    return { ok: true, resourceId: genId("title_logo"), name: `${title} 로고`, dataUrl };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const reason = error instanceof ImageGenerationError || error instanceof Error ? error.message : String(error);
    return { ok: false, summary: `타이틀 로고 생성에 실패했습니다: ${reason}`, code: "image-generation-failed" };
  }
}

export function titleLogoToolCalls(
  logo: Extract<TitleLogoGenerationResult, { ok: true }>,
): { name: string; args: Record<string, unknown> }[] {
  return [
    { name: "upsert_resource", args: { resource: { id: logo.resourceId, name: logo.name, kind: "title", dataUrl: logo.dataUrl } } },
    { name: "set_title_screen", args: { titleGraphic: { mode: "graphic", resourceId: logo.resourceId } } },
  ];
}

/** RGBA 버퍼에서 가장자리와 이어진 바탕을 투명으로 만들고, 남은 불투명 영역의 경계를 돌려준다. */
export function floodClearBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } | null {
  const isBackground = (index: number) => {
    const r = data[index]!;
    const g = data[index + 1]!;
    const b = data[index + 2]!;
    const min = Math.min(r, g, b);
    return data[index + 3]! < 16 || (min >= BG_MIN_CHANNEL && Math.max(r, g, b) - min <= BG_SPREAD);
  };
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const pixel = y * width + x;
    if (seen[pixel]) return;
    seen[pixel] = 1;
    if (isBackground(pixel * 4)) stack.push(pixel);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < 16) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

async function cutoutWhiteBackground(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("캔버스를 열 수 없습니다.");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = floodClearBackground(pixels.data, canvas.width, canvas.height);
  if (!bounds) throw new Error("바탕을 지우고 나니 남은 그림이 없습니다. 다시 시도하세요.");
  context.putImageData(pixels, 0, 0);
  const left = Math.max(0, bounds.left - CROP_PADDING);
  const top = Math.max(0, bounds.top - CROP_PADDING);
  const width = Math.min(canvas.width, bounds.right + 1 + CROP_PADDING) - left;
  const height = Math.min(canvas.height, bounds.bottom + 1 + CROP_PADDING) - top;
  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = height;
  cropped.getContext("2d")!.drawImage(canvas, left, top, width, height, 0, 0, width, height);
  return cropped.toDataURL("image/png");
}
