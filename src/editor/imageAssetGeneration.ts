import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { imageFailureNextStep } from "./imageGenerationFallback";
import { generateDotArt, type GenerateDotArtRequest } from "@/ai/dotTextArt";
import type { DotTextImage } from "@/ai/dotTextImage";
import { imageAssetDotPrompt, imageAssetPrompt, prepareImageAssetRequest, type ImageAssetKind } from "@/editor/tools/imageAssetTools";
import { ToolError } from "@/editor/tools/types";
import { genId } from "@/util/id";

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;

export type ImageAssetGenerationRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  /** pixel:true(도트 아이콘) 일 때 쓰는 도트 저작 모델 호출. 생략하면 설정의 도트 저작 모델(src/ai/dotTextArt.ts). */
  readonly generateDot?: (request: GenerateDotArtRequest) => Promise<DotTextImage>;
};
/** pixel:true 아이콘의 한 변(px). */
const PIXEL_ICON_PX = 32;

export type ImageAssetGenerationResult =
  | { readonly ok: true; readonly kind: ImageAssetKind; readonly resourceId: string; readonly name: string; readonly prompt: string; readonly tags: string[]; readonly dataUrl: string }
  | { readonly ok: false; readonly summary: string; readonly code: string };

export async function generateImageAsset(
  args: Record<string, unknown>,
  options: ImageAssetGenerationRequest = {},
): Promise<ImageAssetGenerationResult> {
  let request: ReturnType<typeof prepareImageAssetRequest>;
  try {
    request = prepareImageAssetRequest(args);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  try {
    options.signal?.throwIfAborted();
    // 조수 채팅이 «도트로» 달라고 한 그림(pixel:true)은 이미지 모델이 아니라 도트 저작 모델(텍스트)이 격자로 찍는다.
    const image = request.pixel
      ? await (options.generateDot ?? generateDotArt)({ prompt: imageAssetDotPrompt(request.prompt), longSidePx: PIXEL_ICON_PX, purpose: "chat-pixel-art", ...(options.signal ? { signal: options.signal } : {}) })
      : await (options.generateImage ?? generateAiImage)({
        prompt: imageAssetPrompt(request.kind, request.prompt),
        signal: options.signal,
        purpose: request.kind === "title" ? "title-picture" : request.kind === "backdrop" ? "backdrop" : "picture",
      });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다.", code: "image-invalid" };
    return {
      ok: true,
      kind: request.kind,
      resourceId: genId(`generated_${request.kind}`),
      name: request.name,
      prompt: request.prompt,
      tags: request.tags,
      dataUrl: image.dataUrl,
    };
  } catch (error) {
    if (error instanceof ImageGenerationError) return { ok: false, summary: `그림 생성에 실패했습니다: ${error.message} ${imageFailureNextStep(request.kind === "title" ? "title" : request.kind === "backdrop" ? "backdrop" : "picture", request.prompt, error)}`, code: "image-generation-failed" };
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, summary: `그림 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`, code: "image-generation-failed" };
  }
}
