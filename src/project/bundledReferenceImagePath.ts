/**
 * Shipped reference images are same-origin static files, not inline bytes (see
 * scripts/content/externalize-reference-images.mjs). Authored uploads stay `data:` URLs
 * so they still travel with the project. Kept free of JSON imports: the host plugins
 * in vite.config.ts load this through validateTilesetReferences.
 */
const BUNDLED_REFERENCE_IMAGE_PATH = /^\/assets\/(?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|webp)$/u;

export function isBundledReferenceImage(src: string): boolean {
  return BUNDLED_REFERENCE_IMAGE_PATH.test(src) && !src.split("/").includes("..");
}

/**
 * Host-owned shared tileset reference images, addressed by content digest (see
 * scripts/lib/sharedContentSqlite.ts). The editor catalog response carries these instead of
 * inline bytes; the host serves the bytes from its shared SQLite.
 */
export const SHARED_REFERENCE_IMAGE_PREFIX = "/__oprn/shared-content/image/";
const SHARED_REFERENCE_IMAGE_PATH = /^\/__oprn\/shared-content\/image\/(s\d+-\d+-\d+)\.(png|jpg|webp)$/u;

export function isSharedReferenceImage(src: string): boolean {
  return SHARED_REFERENCE_IMAGE_PATH.test(src);
}

/** `{ digest, mime }` of a shared reference image address, or null. */
export function parseSharedReferenceImage(src: string): { readonly digest: string; readonly mime: string } | null {
  const match = SHARED_REFERENCE_IMAGE_PATH.exec(src);
  if (!match) return null;
  return { digest: match[1]!, mime: match[2] === "jpg" ? "image/jpeg" : `image/${match[2]}` };
}

/** The address of an inline reference image, or null when it is not a PNG/JPEG/WebP data URL. */
export function sharedReferenceImageAddress(dataUrl: string): string | null {
  const match = /^data:image\/(png|jpeg|webp);base64,/u.exec(dataUrl);
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  return `${SHARED_REFERENCE_IMAGE_PREFIX}${referenceImageDigest(dataUrl).replaceAll(":", "-")}.${ext}`;
}

/** Must match `digest` in scripts/content/externalize-reference-images.mjs. */
export function referenceImageDigest(value: string): string {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822519);
  }
  return `s${value.length}:${h1 >>> 0}:${h2 >>> 0}`;
}
