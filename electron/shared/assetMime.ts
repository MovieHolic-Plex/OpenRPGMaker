/** Types the asset schemes may advertise. Anything else is downloaded as opaque bytes. */
const SAFE_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "font/woff2",
]);

/** Client-supplied MIME is not a document type. HTML and script types become opaque bytes. */
export function safeAssetContentType(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return SAFE_ASSET_TYPES.has(base) ? base : "application/octet-stream";
}

/** Asset documents must not execute, even when the type is an image or SVG. */
export const ASSET_RESPONSE_CSP = "sandbox";
