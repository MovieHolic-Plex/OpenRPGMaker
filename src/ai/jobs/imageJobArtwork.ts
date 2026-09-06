import { assert } from "@/project/io/guards";
import { flattenGeneratedArtwork } from "@/editor/aiArtworkCanvas";

export interface ImageJobArtwork {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}
/** Decode actual raster pixels, not just a data:image prefix. No remote URLs or SVG. */
export async function decodeImageJobArtwork(dataUrl: string, mimeType: string): Promise<ImageJobArtwork> {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  assert(match !== null && match[1] === mimeType, "Invalid image data URL or MIME mismatch");
  const encoded = match[2]!;
  const binary = atob(encoded);
  assert(binary.length > 0 && btoa(binary).replace(/=+$/, "") === encoded.replace(/=+$/, ""), "Invalid image base64");
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Generated image bytes cannot be decoded"));
    element.src = dataUrl;
  });
  const width = image.naturalWidth, height = image.naturalHeight;
  assert(width > 0 && height > 0, "Generated image has no pixels");
  return { bytes, dataUrl, mediaType: mimeType, width, height };
}
export function imageJobDataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mediaType};base64,${btoa(binary)}`;
}
export async function postprocessImageJobArtwork(dataUrl: string, mimeType: string, flatten: boolean): Promise<ImageJobArtwork> {
  const source = await decodeImageJobArtwork(dataUrl, mimeType);
  if (!flatten) return source;
  // The foreground helper returns its input when canvas is unavailable. A job must
  // instead retain the paid response and fail the local stage for explicit retry.
  assert(document.createElement("canvas").getContext("2d") !== null, "Image flattening canvas unavailable");
  return decodeImageJobArtwork(await flattenGeneratedArtwork(source.dataUrl), "image/png");
}
