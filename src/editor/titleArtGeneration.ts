// editor/titleArtGeneration.ts
// 타이틀 키아트 생성. 이미지 바이트는 세션 전사에 남기지 않고, 등록(upsert_resource)과
// 연결(set_title_screen)은 호출자가 기존 쓰기 툴로 해 diff·제안 회계를 그대로 탄다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { buildTitleArtPrompt, prepareTitleArtRequest, type TitleArtRequest } from "@/editor/tools/titleArtTools";
import { fitTitleArtEffects, type TitleArtFitResult } from "@/editor/titleArtFitting";
import { ToolError } from "@/editor/tools/types";
import type { TitleOpeningPreset } from "@/project/titleEffects";
import type { TitleEffect } from "@/project/types";
import { genId } from "@/util/id";

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;

export type TitleArtGenerationOptions = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  /** 생성된 그림에 효과 좌표를 맞춘다. 기본은 비전 모델 맞춤, `false` 면 프리셋 좌표 그대로. */
  readonly fitEffects?: false | ((preset: TitleOpeningPreset, dataUrl: string, signal?: AbortSignal) => Promise<TitleArtFitResult>);
};

export type TitleArtGenerationResult =
  | {
    readonly ok: true;
    readonly request: TitleArtRequest;
    readonly resourceId: string;
    readonly dataUrl: string;
    /** 그림에 맞춘 효과. 맞춤이 하나도 안 됐으면 없다(프리셋 좌표를 쓴다). */
    readonly effects?: TitleEffect[];
  }
  | { readonly ok: false; readonly summary: string; readonly code: string };

export async function generateTitleArt(
  args: Record<string, unknown>,
  options: TitleArtGenerationOptions = {},
): Promise<TitleArtGenerationResult> {
  let request: TitleArtRequest;
  try {
    request = prepareTitleArtRequest(args);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({ prompt: buildTitleArtPrompt(request), signal: options.signal });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) {
      return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다. 다시 시도하세요.", code: "image-invalid" };
    }
    const fit = options.fitEffects === false
      ? undefined
      : await (options.fitEffects ?? ((preset, dataUrl, signal) => fitTitleArtEffects(preset, dataUrl, { signal })))(
        request.preset,
        image.dataUrl,
        options.signal,
      ).catch((error: unknown) => {
        if (options.signal?.aborted) throw error;
        return undefined;
      });
    options.signal?.throwIfAborted();
    return {
      ok: true,
      request,
      resourceId: genId("title_art"),
      dataUrl: image.dataUrl,
      ...(fit && fit.fitted.length > 0 ? { effects: fit.effects } : {}),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const reason = error instanceof ImageGenerationError || error instanceof Error ? error.message : String(error);
    return { ok: false, summary: `타이틀 키아트 생성에 실패했습니다: ${reason}`, code: "image-generation-failed" };
  }
}

/** set_title_screen 에 넘길 인자 — 키아트를 배경으로 걸고 프리셋 효과를 적용한다. 맞춘 효과가 있으면 그것이 이긴다. */
export function titleArtScreenArgs(request: TitleArtRequest, resourceId: string, effects?: readonly TitleEffect[]): Record<string, unknown> {
  return {
    backgroundResourceId: resourceId,
    openingPreset: request.preset.id,
    ...(effects && effects.length > 0 ? { effects } : {}),
    backgroundFit: "cover",
    backgroundRendering: "smooth",
    ...(request.title ? { title: request.title } : {}),
    ...(request.logoSubtitle ? { logoSubtitle: request.logoSubtitle } : {}),
  };
}

/** 편집기 버튼이 적용할 쓰기 툴 묶음 — 등록 후 연결. applyToolSequenceToStore 로 undo 한 번. */
export function titleArtToolCalls(
  art: Extract<TitleArtGenerationResult, { ok: true }>,
): { name: string; args: Record<string, unknown> }[] {
  return [
    {
      name: "upsert_resource",
      args: { resource: { id: art.resourceId, name: art.request.name, kind: "title", dataUrl: art.dataUrl } },
    },
    { name: "set_title_screen", args: titleArtScreenArgs(art.request, art.resourceId, art.effects) },
  ];
}
