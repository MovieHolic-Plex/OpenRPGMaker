// editor/openingImageGeneration.ts
// 오프닝(시네마틱) 스틸의 AI 생성 핸드오프. 이미지 바이트는 세션 전사에 남기지 않고,
// 등록은 호출자가 upsert_resource 로 수행해 쓰기 회계(diff·제안)를 그대로 탄다.
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { prepareGameOverImageRequest, prepareOpeningImageRequest, prepareOpeningLayerRequest, type OpeningImageBrief } from "@/editor/tools/cinematicTools";
import { ToolError } from "@/editor/tools/types";
import { genId } from "@/util/id";
import type { Project } from "@/project/types";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { parseImageReferences } from "@/ai/imageReferences";
import { readAppearanceReference, type AppearanceReferenceReader } from "./characterAppearanceReferences";

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/u;

export type CinematicStillRequest = {
  readonly signal?: AbortSignal;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  readonly project?: Project;
  readonly readReference?: AppearanceReferenceReader;
  readonly resolveReference?: (resourceId: string, signal?: AbortSignal) => Promise<string>;
  readonly hasTransparentPixels?: (dataUrl: string) => Promise<boolean>;
};

export type CinematicStillResult =
  | { readonly ok: true; readonly resourceId: string; readonly name: string; readonly prompt: string; readonly dataUrl: string }
  | { readonly ok: false; readonly summary: string; readonly code: string };

export type OpeningStillRequest = CinematicStillRequest;
export type OpeningStillResult = CinematicStillResult;

/** 저작 의도를 전체화면 연출용 지시로 감싼다 — 아이콘·글자·UI 가 섞이면 오프닝에서 못 쓴다. */
export function buildCinematicStillPrompt(prompt: string, purpose: "opening" | "gameOver", brief?: OpeningImageBrief): string {
  if (brief?.layerRole) return [
    `Make one ${brief.aspectRatio} ${brief.artStyle} independent ${brief.layerRole} layer for a 2D game animatic.`,
    `Brief: ${prompt}`,
    ...(brief.referenceResourceIds.length ? ['Match supplied references: exact character silhouette, colors and costume. Reference sheets are not the output layout.'] : []),
    brief.layerRole === 'background' ? 'Paint the environment without any characters, typography or interface. Compose depth planes with room for independently animated actors.'
      : 'Draw the complete isolated subject in one readable pose, centered with 12 percent clear margin. No environment, floor, horizon, cast shadow or other subjects. The entire empty background MUST be exactly solid vivid magenta #FF00FF, no gradient or texture, for removal. Do not use magenta within the subject. Preserve limbs; do not crop the subject.',
    'No labels, logos, text, watermark, frames or sprite-sheet grid. One layer, not a complete opening shot.'
  ].join('\n\n');
  const screen = purpose === "gameOver" ? "game-over screen" : "opening sequence";
  const clearArea = purpose === "gameOver"
    ? "Keep the center and lower area calm enough for the game-over title, message and retry/title buttons."
    : "Keep the lower 18 percent calm enough that a narration box at the bottom stays readable.";
  const composition = brief?.shot === "close-up" ? "a close-up, emphasizing the important face, object or incident"
    : brief?.shot === "medium" ? "a medium shot that clearly shows the characters and their immediate surroundings"
    : "a wide establishing shot with clear foreground, middle ground and background";
  return [
    `Create exactly one full-screen, ${brief?.aspectRatio ?? "16:9"} cinematic background still for the ${screen} of a 2D JRPG.`,
    "Scene brief: " + JSON.stringify(prompt.replace(/\s+/gu, " ").trim()) + ".",
    `Fill the entire canvas with the scene. Compose it as ${composition}. Honor the requested shot distance, viewpoint and composition: an establishing shot, medium shot and close-up must look visibly different. ${clearArea}`,
    `Render it as ${brief?.artStyle ?? "hand-painted 2D game art"} with coherent lighting and restrained detail. Avoid photographic rendering and 3D-rendered surfaces.`,
    ...(brief?.referenceResourceIds.length ? ["Use the supplied reference images to preserve the same object design, character, location, palette and drawing style while composing the requested new shot. Show the specific story change, not a repeated view of the reference. Do not copy any labels or reference-sheet layout."] : []),
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
  let brief: OpeningImageBrief | undefined;
  try {
    if (purpose === "gameOver") ({ prompt, name } = prepareGameOverImageRequest(args));
    // background/actor/prop 은 독립 레이어(단색 배경 제거), backdrop/foreground 는 generate_opening_image 의 전체 배경·실제 알파 전경.
    else { brief = args.role === 'background' || args.role === 'actor' || args.role === 'prop' ? prepareOpeningLayerRequest(args, options.project) : prepareOpeningImageRequest(args, options.project); ({ prompt, name } = brief); }
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  try {
    options.signal?.throwIfAborted();
    const references = await Promise.all((brief?.referenceResourceIds ?? []).map(async id => {
      let dataUrl: string;
      if (options.resolveReference) dataUrl = await options.resolveReference(id, options.signal);
      else {
        const url = options.project && resolveAssetResourceUrl(id, { project: options.project });
        if (!url) throw new ImageGenerationError(`참고 그림을 읽을 프로젝트/리소스가 없습니다: ${id}`);
        dataUrl = await (options.readReference ?? readAppearanceReference)(url, undefined, options.signal ?? new AbortController().signal);
      }
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
      if (!match) throw new ImageGenerationError(`참고 그림 데이터가 올바르지 않습니다: ${id}`);
      return { mimeType: match[1], data: match[2] };
    }));
    const referenceImages = parseImageReferences(references);
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({
      prompt: purpose === 'opening' && args.role === 'foreground' ? [
        'Create one isolated illustrated foreground subject for a layered 2D JRPG opening. Actual transparent alpha background, not a checkerboard or painted background. The entire subject must fit without cropped edges. No text, UI, ground plane or cast shadow. Preserve the supplied reference design, palette and painted style. One subject, one viewpoint, no sprite sheet. Respect the requested composition.',
        prompt,
      ].join('\n\n') : buildCinematicStillPrompt(prompt, purpose, brief),
      signal: options.signal,
      ...(referenceImages.length ? { referenceImages } : {}),
    });
    options.signal?.throwIfAborted();
    if (!IMAGE_DATA_URL.test(image.dataUrl)) {
      return { ok: false, summary: "생성된 그림 데이터가 올바르지 않습니다. 다시 시도하세요.", code: "image-invalid" };
    }
    if (purpose === 'opening' && args.role === 'foreground') {
      const inspect = options.hasTransparentPixels ?? (async (dataUrl: string) => {
        const element = new Image(); element.src = dataUrl; await element.decode();
        const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
        const context = canvas.getContext('2d'); if (!context) return false;
        context.drawImage(element, 0, 0, 160, 160);
        const pixels = context.getImageData(0, 0, 160, 160).data;
        let clear = 0, solid = 0;
        for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 16) clear++; if (pixels[i] > 240) solid++; }
        return clear > 256 && solid > 256;
      });
      if (!await inspect(image.dataUrl)) return { ok: false, summary: '전경 그림에 실제 투명 배경 또는 대상이 없습니다. 체커보드/단색 배경은 투명하지 않습니다. 실제 alpha PNG로 다시 생성하세요.', code: 'foreground-not-transparent' };
    }
    const dataUrl = brief?.layerRole && brief.layerRole !== 'background' ? await removeOpeningChroma(image.dataUrl, options.signal) : image.dataUrl;
    return { ok: true, resourceId: genId(purpose === "gameOver" ? "gameover_still" : brief?.layerRole ? "opening_layer" : "opening_still"), name, prompt, dataUrl };
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

/** Edge-connected chroma only. Never label an opaque failed cutout as a transparent actor. */
export async function removeOpeningChroma(dataUrl: string, signal?: AbortSignal): Promise<string> {
  const image = new Image(); image.src = dataUrl; await image.decode(); signal?.throwIfAborted();
  const width = image.naturalWidth, height = image.naturalHeight, count = width * height;
  if (!count || count > 8000000) throw new ImageGenerationError('분리할 그림 크기 초과.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, width, height), data = pixels.data;
  const queue = new Int32Array(count), seen = new Uint8Array(count); let head = 0, tail = 0;
  const add = (index: number) => { if (seen[index]) return; const k = index * 4; if (data[k + 3] !== 0 && !(data[k] > 120 && data[k + 2] > 120 && data[k + 1] < Math.min(data[k], data[k + 2]) * 0.65)) return; seen[index] = 1; queue[tail++] = index; };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
  while (head < tail) { const i = queue[head++]; data[i * 4 + 3] = 0; const x = i % width; if (x) add(i - 1); if (x < width - 1) add(i + 1); if (i >= width) add(i - width); if (i < count - width) add(i + width); }
  if (tail / count < 0.05 || tail / count > 0.99) throw new ImageGenerationError('독립 레이어의 단색 배경을 분리하지 못했습니다. 배경 없는 대상과 단색 magenta로 다시 생성하세요.');
  signal?.throwIfAborted(); ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png');
}

export function generateOpeningStill(args: Record<string, unknown>, options: OpeningStillRequest = {}): Promise<OpeningStillResult> {
  return generateCinematicStill(args, "opening", options);
}

/** Actual visual evidence, bounded to the Pi render broker's 512px PNG contract. */
export async function renderOpeningImage(project: Project, data: unknown, signal?: AbortSignal): Promise<string> {
  const id = (data as { resourceId?: unknown } | null)?.resourceId;
  const url = typeof id === 'string' && resolveAssetResourceUrl(id, { project });
  if (!url) throw new ImageGenerationError('오프닝 검토 그림을 찾을 수 없습니다.');
  const reference = await readAppearanceReference(url, undefined, signal ?? new AbortController().signal);
  const image = new Image();
  image.src = reference;
  await image.decode();
  signal?.throwIfAborted();
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ImageGenerationError('오프닝 검토 캔버스를 만들지 못했습니다.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function generateGameOverStill(args: Record<string, unknown>, options: CinematicStillRequest = {}): Promise<CinematicStillResult> {
  return generateCinematicStill(args, "gameOver", options);
}
