// editor/openingImageGeneration.ts
// 오프닝(시네마틱) 스틸의 AI 생성 핸드오프. 이미지 바이트는 세션 전사에 남기지 않고,
// 등록은 호출자가 upsert_resource 로 수행해 쓰기 회계(diff·제안)를 그대로 탄다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { prepareGameOverImageRequest, prepareOpeningImageRequest } from "@/editor/tools/cinematicTools";
import { ToolError } from "@/editor/tools/types";
import { genId } from "@/util/id";
import { parseImageReferences } from '@/ai/imageReferences';

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;

export type CinematicStillRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  readonly resolveReference?: (resourceId: string, signal?: AbortSignal) => Promise<string>;
};

export type CinematicStillResult =
  | { readonly ok: true; readonly resourceId: string; readonly name: string; readonly prompt: string; readonly dataUrl: string }
  | { readonly ok: false; readonly summary: string; readonly code: string };

export type OpeningStillRequest = CinematicStillRequest;
export type OpeningStillResult = CinematicStillResult;

/** 저작 의도를 전체화면 연출용 지시로 감싼다 — 아이콘·글자·UI 가 섞이면 오프닝에서 못 쓴다. */
export function buildCinematicStillPrompt(prompt: string, purpose: "opening" | "gameOver"): string {
  const screen = purpose === "gameOver" ? "game-over screen" : "opening sequence";
  const clearArea = purpose === "gameOver"
    ? "Keep the center and lower area calm enough for the game-over title, message and retry/title buttons."
    : "Keep the center clear enough that a narration box at the bottom stays readable.";
  return [
    `Create exactly one full-screen, 16:9 cinematic background still for the ${screen} of a 2D JRPG.`,
    "Scene brief: " + JSON.stringify(prompt.replace(/\s+/gu, " ").trim()) + ".",
    `Fill the entire canvas with the scene. Honor the requested shot distance, viewpoint and composition: an establishing shot, medium shot and close-up must look visibly different. ${clearArea}`,
    "If a reference image is supplied, preserve the same object design, character, location, palette and drawing style while composing the requested new shot. Show the specific story change, not a repeated view of the reference.",
    "Render it as hand-painted 2D game art with coherent lighting and restrained detail. Avoid photographic rendering and 3D-rendered surfaces.",
    "Do not add any text, letters, captions, logos, watermarks, signatures, interface elements, borders, letterboxing bars or icon-style framing. Do not return a sprite sheet, an item icon or a character portrait on a flat background.",
  ].join("\n\n");
}

export function buildOpeningStillPrompt(prompt: string): string {
  return buildCinematicStillPrompt(prompt, "opening");
}

/**
 * 실제 모델 호출. 성공하면 등록에 쓸 id·이름·dataUrl 을 돌려주고, 실패는 모델이 고칠 수 있는
 * 한국어 사유로 바꾼다(예외를 그대로 던지면 턴이 죽는다).
 */
export async function generateCinematicStill(
  args: Record<string, unknown>,
  purpose: "opening" | "gameOver",
  options: CinematicStillRequest = {},
): Promise<CinematicStillResult> {
  let prompt: string;
  let name: string;
  try {
    ({ prompt, name } = purpose === "gameOver" ? prepareGameOverImageRequest(args) : prepareOpeningImageRequest(args));
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  try {
    options.signal?.throwIfAborted();
    let referenceImages;
    if (purpose === 'opening' && args.referenceResourceId !== undefined) {
      if (!options.resolveReference || typeof args.referenceResourceId !== 'string' || !args.referenceResourceId.trim()) throw new Error('참조 그림을 실제 자산 저장소에서 읽을 수 없습니다.');
      const reference = await options.resolveReference(args.referenceResourceId, options.signal);
      if (!IMAGE_DATA_URL.test(reference)) throw new Error('참조 그림 데이터가 올바르지 않습니다.');
      referenceImages = parseImageReferences([{ mimeType: reference.slice(5, reference.indexOf(';')), data: reference.slice(reference.indexOf(',') + 1) }]);
    }
    const image = await (options.generateImage ?? generateAiImage)({
      prompt: buildCinematicStillPrompt(prompt, purpose),
      signal: options.signal,
      ...(referenceImages ? { referenceImages } : {}),
    });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) {
      return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다. 다시 시도하세요.", code: "image-invalid" };
    }
    return { ok: true, resourceId: genId(purpose === "gameOver" ? "gameover_still" : "opening_still"), name, prompt, dataUrl: image.dataUrl };
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      return { ok: false, summary: `${purpose === "gameOver" ? "게임오버" : "오프닝"} 그림 생성에 실패했습니다: ${error.message}`, code: "image-generation-failed" };
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      summary: `${purpose === "gameOver" ? "게임오버" : "오프닝"} 그림 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
      code: "image-generation-failed",
    };
  }
}

export function generateOpeningStill(args: Record<string, unknown>, options: OpeningStillRequest = {}): Promise<OpeningStillResult> {
  return generateCinematicStill(args, "opening", options);
}

export function generateGameOverStill(args: Record<string, unknown>, options: CinematicStillRequest = {}): Promise<CinematicStillResult> {
  return generateCinematicStill(args, "gameOver", options);
}
