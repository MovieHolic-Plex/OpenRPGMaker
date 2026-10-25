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
import { imageFailureNextStep } from "./imageGenerationFallback";

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
  const side = brief?.captionSide ?? "bottom";
  const clearArea = purpose === "gameOver"
    ? "Keep the center and lower area calm enough for the game-over title, message and retry/title buttons."
    : `Keep a quiet, low-detail area along the ${side} edge for a caption. Make it natural (sky, floor, shadow, fog) — not a flat empty band or a box.`;
  const composition = brief?.shot === "close-up" ? "a tight close-up: one face, hand or object fills a third or more of the frame; the surroundings are only hinted"
    : brief?.shot === "medium" ? "a medium shot that reads the characters' body language and their immediate surroundings"
    : "a wide establishing shot with a clear foreground, middle ground and background, and a small human-scale cue";
  return [
    `One frame from the ${screen} of a 2D JRPG, ${brief?.aspectRatio ?? "16:9"}. Treat it as a film still with a single idea, not as wallpaper.`,
    "STORY MOMENT: " + JSON.stringify(prompt.replace(/\s+/gu, " ").trim()) + ". Show what changed and its visible consequence; do not just depict a pretty place.",
    `FOCAL POINT: ${brief?.focus ?? "the single most important subject of the brief"}. The eye must land here first; everything else supports it and is rendered with less contrast and detail.`,
    `CAMERA: ${composition}. ${brief?.angle ? `Vantage: ${brief.angle}.` : "Choose a deliberate vantage rather than the default eye-level view."} Avoid dead-centre symmetry: put the focal point off-centre, use leading lines and overlapping depth planes. An establishing shot, medium shot and close-up must look visibly different.`,
    `CAST: ${brief?.cast && /^(none|nobody|empty|없음)$/iu.test(brief.cast.trim()) ? "STRICTLY NO PEOPLE, NO CHARACTERS, NO HUMANS, NO KNIGHTS, NO VILLAGERS, NO SILHOUETTES ANYWHERE IN THE IMAGE. Paint ONLY the empty environment/architecture/landscape so sprite actors can be composited on top later." : (brief?.cast ?? "only the people or creatures named in the story moment may appear")}. Do not add extra figures, silhouettes, cloaked bystanders, crowds or animals; an empty place stays empty.`,
    `LIGHT AND COLOUR: ${brief?.light ?? "one motivated key light source that is visible or clearly implied in the scene"}. Build a clear dark / mid / light value hierarchy; ${brief?.palette ? `use this palette: ${brief.palette}.` : "limit colour to three or four related hues plus one accent on the focal point."}`,
    `STYLE: ${brief?.artStyle ?? "hand-painted 2D game art"}. Keep the same drawing language shot to shot. Use confident, specific marks and lived-in details (wear, asymmetry, scale cues, signs of use) that carry the story instead of generic set dressing. Avoid photographic rendering and 3D-rendered surfaces.`,
    clearArea,
    ...(brief?.referenceResourceIds.length ? ["Use the supplied reference images to preserve the same object design, character, location, palette and drawing style while composing the requested new shot. Show the specific story change, not a repeated view of the reference. Do not copy any labels or reference-sheet layout."] : []),
    "AVOID the generic AI-wallpaper look: glowing orbs or floating dust motes everywhere, default teal-and-orange grading, every object lit equally, a crowded shelf of props, a symmetrical postcard layout, stock hero poses, plastic or over-smoothed gradients, decorative lens flare.",
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
  const unusedGeneratedBackdrops = (): string[] => {
    if (purpose !== 'opening' || !options.project) return [];
    const used = new Set((options.project.system.opening?.scenes ?? []).flatMap(scene =>
      scene.kind === 'animatic'
        ? scene.composition.layers.filter(layer => layer.kind === 'image').map(layer => layer.resourceId!)
        : (scene.kind === 'image' || scene.kind === 'video') ? [scene.resourceId] : []));
    return Object.keys(options.project.assets.uploaded)
      .filter(id => /^opening_still_[0-9a-f-]+$/iu.test(id) && !used.has(id))
      .slice(0, 8);
  };
  // 실패를 성공으로 보고하지 않되 턴은 멈추지 않는다 — 안 쓴 전용 그림 → 그림 설명이 가장 가까운 라이브러리 그림 → 그림 없이 계속(imageGenerationFallback.ts).
  const failureSummary = (message: string, error: unknown): string =>
    `${message} 생성 실패를 성공으로 보고하지 마라. ${imageFailureNextStep(purpose === "gameOver" ? "gameOver" : "opening", typeof args.prompt === "string" ? args.prompt : "", error, unusedGeneratedBackdrops())}`;
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
      purpose: "opening-still",
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
    const isLayer = Boolean(brief?.layerRole && brief.layerRole !== 'background') || (purpose === 'opening' && args.role === 'foreground');
    const keyed = brief?.layerRole && brief.layerRole !== 'background' ? await removeOpeningChroma(image.dataUrl, options.signal) : image.dataUrl;
    const dataUrl = purpose === 'opening' && args.pixelArt !== false ? await pixelizeOpeningImage(keyed, isLayer) : keyed;
    return { ok: true, resourceId: genId(purpose === "gameOver" ? "gameover_still" : brief?.layerRole ? "opening_layer" : "opening_still"), name, prompt, dataUrl };
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      return { ok: false, summary: failureSummary(`${purpose === "gameOver" ? "게임오버" : "오프닝"} 그림 생성에 실패했습니다: ${error.message}`, error), code: "image-generation-failed" };
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      summary: failureSummary(`${purpose === "gameOver" ? "게임오버" : "오프닝"} 그림 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`, error),
      code: "image-generation-failed",
    };
  }
}

/** Edge-connected chroma only. Never label an opaque failed cutout as a transparent actor. */
/**
 * 생성기는 매끈한 에어브러시 그림을 주므로 컷마다 화풍·격자가 달라진다(실측: 타이틀은 굵은 도트, 컷은 디지털 페인팅).
 * 모든 오프닝 그림을 정확히 같은 네이티브 격자(배경 384×216 · 전경 192px 이내)와 40색 이하의 제한 팔레트로 내려
 * 한 작품의 도트로 맞춘다. 플레이어는 작은 그림에 pixelated 렌더링을 건다.
 */
export async function pixelizeOpeningImage(dataUrl: string, isLayer: boolean): Promise<string> {
  try {
    const { coverCrop, decodeImage, encodePng, pixelate } = await import('@/editor/cutsceneArt/imageProcess');
    // 워커(노드)의 decodeImage 는 PNG 만 읽는다 — 생성기가 JPEG 로 답하면 여기서 걸려 «원본 그대로» 가 나갔고,
    // 오프닝 그림이 컷마다 다른 화풍·크기로 화면에 올라갔다(2026-10-16 run-2 실측: 861KB JPEG 한 장 그대로).
    const source = await decodeImage(await transcodeToPng(dataUrl));
    if (!isLayer) {
      const covered = coverCrop(source, 384 / 216);
      return await encodePng(pixelate(covered, 384, 216, 40));
    }
    const width = Math.min(192, source.width);
    const height = Math.max(1, Math.round(width * source.height / source.width));
    return await encodePng(pixelate(source, width, height, 24));
  } catch (error) {
    // 실패한 픽셀화를 원본 통과로 덮으면 384×216·40색 화풍 자물쇠가 조용히 꺼진다 — 호출부가 실패로 보게 한다.
    throw new ImageGenerationError(`오프닝 그림을 384×216 격자·제한 팔레트로 내리지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** 캔버스가 없는 환경(워커)에서 JPEG 를 PNG data URL 로 바꾼다. PNG 는 그대로 통과. */
async function transcodeToPng(dataUrl: string): Promise<string> {
  // mime 접두부를 믿지 않고 실제 바이트를 본다 — 워커 겸 실행기 중에는 JPEG 바이트를 image/png 로
  // 라벨해 보내는 곳이 있었다(2026-10-16 run-2 실측: 758KB JPEG 이 png 접두부로 와서 pngjs 가 실패,
  // decodeImage 가 던지고 pixelizeOpeningImage 가 «원본 그대로» 를 돌려주어 화풍 자물쇠가 통째로 꺼졌다).
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!/^data:image\/png;/iu.test(dataUrl) || !base64.startsWith('iVBORw0KGgo')) {
    if (typeof document === 'undefined') {
      const JimpModule = await import('jimp') as unknown as { Jimp?: { fromBuffer(buffer: unknown): Promise<{ getBuffer(mime: string): Promise<unknown> }> }; default?: { fromBuffer(buffer: unknown): Promise<{ getBuffer(mime: string): Promise<unknown> }> } };
      const Jimp = JimpModule.Jimp ?? JimpModule.default!;
      // 앱 타입 설정에는 Buffer 선언이 없다 — imageProcess.ts 와 같은 느슨한 접근을 쓴다.
      const nodeBuffer = (globalThis as unknown as { Buffer: { from(data: unknown, encoding?: string): Uint8Array & { toString(encoding: string): string } } }).Buffer;
      const image = await Jimp.fromBuffer(nodeBuffer.from(base64, 'base64'));
      const png = await image.getBuffer('image/png') as Uint8Array;
      return `data:image/png;base64,${nodeBuffer.from(png).toString('base64')}`;
    }
    return `data:image/png;base64,${base64}`;
  }
  return dataUrl;
}

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
