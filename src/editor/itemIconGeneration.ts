// generate_item_icon 의 편집기 쪽 — 사용자의 그림 계정(이미지 모델)으로 한 장 그리고, 마젠타 배경을 지워 32×32 도트 아이콘으로 내린다.
// 실행기(scripts/lib/piAgentRuntime.ts)가 render_request(generate_opening_image, data.itemIcon)로 부른다 — 생성 시한 300초 경로다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import type { CinematicStillResult } from "@/editor/openingImageGeneration";
import { itemIconImagePrompt, type ItemIconTarget } from "@/editor/tools/itemIconTools";
import { genId } from "@/util/id";

export const ITEM_ICON_SIZE = 32;
const ICON_LONG_SIDE = 28;
const ICON_COLORS = 16;

export type ItemIconRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
};

/** 생성 그림(단색 배경) → 투명 32×32 아이콘. 배경을 못 지웠거나 대상이 너무 작으면 던진다(조용히 상자 그림을 넣지 않는다). */
export async function normalizeItemIcon(dataUrl: string): Promise<string> {
  const { chromaKeyFromBorder, cropToOpaqueBounds, darkenEdge, decodeImage, encodePng, pixelate } = await import("@/editor/cutsceneArt/imageProcess");
  const keyed = chromaKeyFromBorder(await decodeImage(dataUrl));
  const total = keyed.width * keyed.height;
  let opaque = 0;
  for (let p = 0; p < total; p += 1) if (keyed.data[p * 4 + 3]! > 24) opaque += 1;
  const ratio = opaque / total;
  if (ratio < 0.04 || ratio > 0.92) throw new ImageGenerationError(`아이콘 배경을 지우지 못했습니다(남은 그림 ${Math.round(ratio * 100)}%).`);
  const cropped = cropToOpaqueBounds(keyed, 0);
  if (!cropped) throw new ImageGenerationError("배경을 지운 뒤 남은 그림이 없습니다.");
  const k = ICON_LONG_SIDE / Math.max(cropped.width, cropped.height);
  const width = Math.max(4, Math.round(cropped.width * k)), height = Math.max(4, Math.round(cropped.height * k));
  const dotted = darkenEdge(pixelate(cropped, width, height, ICON_COLORS));
  const out = new Uint8ClampedArray(ITEM_ICON_SIZE * ITEM_ICON_SIZE * 4);
  const ox = Math.floor((ITEM_ICON_SIZE - width) / 2), oy = Math.floor((ITEM_ICON_SIZE - height) / 2);
  for (let y = 0; y < height; y += 1) out.set(dotted.data.subarray(y * width * 4, (y + 1) * width * 4), ((oy + y) * ITEM_ICON_SIZE + ox) * 4);
  return encodePng({ width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE, data: out });
}

export async function generateItemIcon(target: ItemIconTarget, options: ItemIconRequest = {}): Promise<CinematicStillResult> {
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({ prompt: itemIconImagePrompt(target), purpose: "picture", ...(options.signal ? { signal: options.signal } : {}) });
    options.signal?.throwIfAborted();
    const dataUrl = await normalizeItemIcon(image.dataUrl);
    const prefix = target.collection === "equipment" ? "generated-equipment-icon" : "generated-item-icon";
    return { ok: true, resourceId: genId(prefix), name: `${target.name} 아이콘`, prompt: itemIconImagePrompt(target), dataUrl };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, code: "image-generation-failed", summary: `「${target.name}」 아이콘을 그리지 못했습니다: ${error instanceof Error ? error.message : String(error)}` };
  }
}
