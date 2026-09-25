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
