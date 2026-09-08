export interface ImageReference {
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly data: string;
}

export class ImageReferenceError extends Error {
  readonly name = "ImageReferenceError";
}

/** Shared HTTP boundary: at most two raster references, 8 MiB of base64 total. */
export function parseImageReferences(value: unknown): readonly ImageReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2) {
    throw new ImageReferenceError("참조 그림은 최대 2장입니다.");
  }
  let total = 0;
  return value.map((part: unknown) => {
    if (!part || typeof part !== "object" || !("mimeType" in part) || !("data" in part)) {
      throw new ImageReferenceError("참조 그림 형식이 올바르지 않습니다.");
    }
    const { mimeType, data } = part;
    if (mimeType !== "image/png" && mimeType !== "image/jpeg" && mimeType !== "image/webp") {
      throw new ImageReferenceError("참조 그림은 PNG, JPEG, WebP만 지원합니다.");
    }
    if (typeof data !== "string" || !data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new ImageReferenceError("참조 그림의 base64 데이터가 올바르지 않습니다.");
    }
    total += data.length;
    if (total > 8 * 1024 * 1024) throw new ImageReferenceError("참조 그림 데이터가 너무 큽니다.");
    return { mimeType, data };
  });
}
