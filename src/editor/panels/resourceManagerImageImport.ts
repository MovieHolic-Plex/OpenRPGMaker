// 이미지 가져오기 판정과 PNG 정규화.
//
// 저장 계약은 그대로 dataUrl 이다. WebP/GIF 는 캔버스로 PNG 가 된 뒤에만 올린다.
// 판정은 DOM 없이 테스트하고, 캔버스 변환만 브라우저에 맡긴다.

export const IMAGE_IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_IMPORT_FORMAT_HINT = "PNG·JPEG·WebP·GIF (WebP·GIF는 PNG 첫 프레임으로 변환)";
export const IMAGE_IMPORT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";
export const IMAGE_IMPORT_CANVAS_ERROR = "이미지를 PNG로 변환하지 못했습니다. PNG로 저장한 뒤 다시 가져와 주세요.";

export type ImageImportFormat = "png" | "jpeg" | "webp" | "gif";

export type ImageImportDecision =
  | { ok: true; format: ImageImportFormat; normalizeToPng: boolean }
  | { ok: false; reason: "format" | "size"; actual: string; message: string };

const FORMAT_BY_EXT: Readonly<Record<string, ImageImportFormat>> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  gif: "gif",
};

const FORMAT_BY_MIME: Readonly<Record<string, ImageImportFormat>> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 비표준 jpeg 별칭. 저장 화이트리스트(data:image/jpeg)에 못 들어가므로 PNG 정규화한다. */
const JPEG_MIME_ALIAS = "image/jpg";

function extensionOf(fileName: string): string | null {
  const match = /\.([^.]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : null;
}

function needsPngNormalize(format: ImageImportFormat): boolean {
  return format === "webp" || format === "gif";
}

export function formatImageImportFormatError(actual: string): string {
  const shown = actual.trim() === "" ? "알 수 없음" : actual;
  return `지원하지 않는 형식입니다 (현재 ${shown}). ${IMAGE_IMPORT_FORMAT_HINT} 만 가져올 수 있습니다.`;
}

export function formatImageImportSizeError(sizeBytes: number): string {
  const actualMb = (sizeBytes / 1024 / 1024).toFixed(1);
  return `파일이 너무 큽니다 (현재 ${actualMb}MB). 4MB 이하 ${IMAGE_IMPORT_FORMAT_HINT} 만 가져올 수 있습니다.`;
}

export function formatImageImportDimensionError(validatorMessage: string, width: number, height: number): string {
  const actual = `${width}x${height}`;
  if (validatorMessage.includes(actual)) return validatorMessage;
  return `${validatorMessage} 현재 ${actual}입니다.`;
}

export function decideImageImport(input: {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}): ImageImportDecision {
  if (input.sizeBytes > IMAGE_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      reason: "size",
      actual: `${input.sizeBytes}`,
      message: formatImageImportSizeError(input.sizeBytes),
    };
  }
  const mime = input.mimeType.trim().toLowerCase();
  if (mime === JPEG_MIME_ALIAS) {
    return { ok: true, format: "jpeg", normalizeToPng: true };
  }
  const fromMime = FORMAT_BY_MIME[mime];
  if (fromMime) {
    return { ok: true, format: fromMime, normalizeToPng: needsPngNormalize(fromMime) };
  }
  if (mime.startsWith("image/")) {
    return { ok: false, reason: "format", actual: mime, message: formatImageImportFormatError(mime) };
  }
  // 빈 MIME·일반 MIME(octet-stream)은 확장자로 판정한다. FileReader dataUrl 헤더도
  // 같은 값이므로 dataUrl 게이트에서 다시 막지 않는다 (브라우저가 바이트를 판별).
  const ext = extensionOf(input.fileName);
  const fromExt = ext ? FORMAT_BY_EXT[ext] : undefined;
  if (fromExt) {
    return { ok: true, format: fromExt, normalizeToPng: needsPngNormalize(fromExt) };
  }
  const actual = mime || (ext ? `.${ext}` : "");
  return { ok: false, reason: "format", actual, message: formatImageImportFormatError(actual) };
}

export const GENERIC_DATA_URL_MIMES: readonly string[] = ["", "application/octet-stream"];

export function decideImageDataUrl(
  dataUrl: string,
  fallback?: { readonly format: ImageImportFormat; readonly normalizeToPng: boolean }
): ImageImportDecision {
  const mime = mediaTypeFromDataUrl(dataUrl);
  if (mime === JPEG_MIME_ALIAS) {
    return { ok: true, format: "jpeg", normalizeToPng: true };
  }
  const format = FORMAT_BY_MIME[mime];
  if (format) {
    return { ok: true, format, normalizeToPng: needsPngNormalize(format) };
  }
  // 파일 수준 판정이 ok 였는데 dataUrl 헤더가 비어 있거나 일반 MIME 이면
  // 파일 판정을 따른다 — 둘은 같은 필드(File.type)에서 나온다.
  if (fallback && GENERIC_DATA_URL_MIMES.includes(mime)) {
    return { ok: true, format: fallback.format, normalizeToPng: fallback.normalizeToPng };
  }
  return { ok: false, reason: "format", actual: mime, message: formatImageImportFormatError(mime) };
}

function mediaTypeFromDataUrl(dataUrl: string): string {
  if (!dataUrl.startsWith("data:")) return "";
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(5, comma) : dataUrl.slice(5);
  return header.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    image.src = dataUrl;
  });
}

export async function prepareImportedImageDataUrl(
  dataUrl: string,
  normalizeToPng: boolean
): Promise<{ readonly dataUrl: string; readonly width: number; readonly height: number }> {
  const image = await loadHtmlImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    throw new Error("이미지를 읽을 수 없습니다.");
  }
  if (!normalizeToPng) return { dataUrl, width, height };
  return { dataUrl: rasterizeImageToPng(image), width, height };
}

function rasterizeImageToPng(image: HTMLImageElement): string {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    throw new Error(IMAGE_IMPORT_CANVAS_ERROR);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error(IMAGE_IMPORT_CANVAS_ERROR);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  const png = canvas.toDataURL("image/png");
  if (!png.startsWith("data:image/png;")) throw new Error(IMAGE_IMPORT_CANVAS_ERROR);
  return png;
}
