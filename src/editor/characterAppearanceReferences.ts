import { ImageGenerationError } from "@/ai/imageGenerationClient";
import { parseImageReferences, type ImageReference } from "@/ai/imageReferences";
import { charsetFrameSource, type CharsetFrameSource } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { CharacterAppearanceRecord, Project } from "@/project/types";

export type AppearanceReferenceReader = (
  url: string,
  crop: CharsetFrameSource | undefined,
  signal: AbortSignal,
) => Promise<string>;

/** Reads into a fresh canvas; the authored source image and charset slot are never changed. */
export const readAppearanceReference: AppearanceReferenceReader = async (url, crop, signal) => {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  bounded.throwIfAborted();
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      bounded.removeEventListener("abort", aborted);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new ImageGenerationError("참조 그림을 읽지 못했습니다.")); };
    const aborted = () => { cleanup(); reject(bounded.reason); };
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
    bounded.addEventListener("abort", aborted, { once: true });
    image.src = url;
  });
  bounded.throwIfAborted();
  const source = crop ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  const scale = Math.min(1, 1024 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new ImageGenerationError("참조 그림 캔버스를 만들지 못했습니다.");
  context.imageSmoothingEnabled = !crop;
  context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

export async function collectAppearanceReferences(
  project: Project,
  record: CharacterAppearanceRecord,
  signal: AbortSignal,
  readImage: AppearanceReferenceReader = readAppearanceReference,
): Promise<readonly ImageReference[]> {
  const sources: { url: string; crop?: CharsetFrameSource }[] = [];
  if (record.charset) {
    const url = resolveAssetResourceUrl(record.charset.resourceId, { project });
    if (url) sources.push({
      url,
      crop: charsetFrameSource({ characterIndex: record.charset.characterIndex, direction: "down", pattern: 1 }),
    });
  }
  if (record.face) {
    const url = resolveAssetResourceUrl(record.face.resourceId, { project });
    if (url) sources.push({ url });
  }
  const images = await Promise.all(sources.map(async ({ url, crop }) => {
    const dataUrl = await readImage(url, crop, signal);
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
    if (!match) throw new ImageGenerationError("참조 그림 데이터가 올바르지 않습니다.");
    return { mimeType: match[1], data: match[2] };
  }));
  return parseImageReferences(images);
}
