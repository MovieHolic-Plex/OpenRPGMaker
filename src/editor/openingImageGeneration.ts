// editor/openingImageGeneration.ts
// 오프닝(시네마틱) 스틸의 AI 생성 핸드오프. 이미지 바이트는 세션 전사에 남기지 않고,
// 등록은 호출자가 upsert_resource 로 수행해 쓰기 회계(diff·제안)를 그대로 탄다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { prepareOpeningImageRequest } from "@/editor/tools/cinematicTools";
import { ToolError } from "@/editor/tools/types";
import { genId } from "@/util/id";

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;

export type OpeningStillRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
};

export type OpeningStillResult =
  | { readonly ok: true; readonly resourceId: string; readonly name: string; readonly prompt: string; readonly dataUrl: string }
  | { readonly ok: false; readonly summary: string; readonly code: string };

/** 저작 의도를 전체화면 연출용 지시로 감싼다 — 아이콘·글자·UI 가 섞이면 오프닝에서 못 쓴다. */
export function buildOpeningStillPrompt(prompt: string): string {
  return [
    "Create exactly one full-screen, 16:9 cinematic background still for the opening sequence of a 2D JRPG.",
    "Scene brief: " + JSON.stringify(prompt.replace(/\s+/gu, " ").trim()) + ".",
    "Fill the entire canvas with the scene. Compose it as a wide establishing shot with clear foreground, middle ground and background, and keep the center clear enough that a narration box at the bottom stays readable.",
    "Render it as hand-painted 2D game art with coherent lighting and restrained detail. Avoid photographic rendering and 3D-rendered surfaces.",
    "Do not add any text, letters, captions, logos, watermarks, signatures, interface elements, borders, letterboxing bars or icon-style framing. Do not return a sprite sheet, an item icon or a character portrait on a flat background.",
  ].join("\n\n");
}

/**
 * 실제 모델 호출. 성공하면 등록에 쓸 id·이름·dataUrl 을 돌려주고, 실패는 모델이 고칠 수 있는
 * 한국어 사유로 바꾼다(예외를 그대로 던지면 턴이 죽는다).
 */
export async function generateOpeningStill(
  args: Record<string, unknown>,
  options: OpeningStillRequest = {},
): Promise<OpeningStillResult> {
  let prompt: string;
  let name: string;
  try {
    ({ prompt, name } = prepareOpeningImageRequest(args));
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({
      prompt: buildOpeningStillPrompt(prompt),
      signal: options.signal,
    });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) {
      return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다. 다시 시도하세요.", code: "image-invalid" };
    }
    return { ok: true, resourceId: genId("opening_still"), name, prompt, dataUrl: image.dataUrl };
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      return { ok: false, summary: `오프닝 그림 생성에 실패했습니다: ${error.message}`, code: "image-generation-failed" };
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      summary: `오프닝 그림 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
      code: "image-generation-failed",
    };
  }
}
