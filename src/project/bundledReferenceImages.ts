import manifest from "../assets/bundledReferenceImageManifest.json";
import { isBundledReferenceImage, isSharedReferenceImage, parseSharedReferenceImage, referenceImageDigest } from "./bundledReferenceImagePath";
import type { Project } from "./types";

export { isBundledReferenceImage, referenceImageDigest };

const bundledPaths = manifest as Readonly<Record<string, string>>;

/** Replace inline copies of shipped images with their static path. Authored images are untouched. */
export function externalizeBundledReferenceImages(project: Project): boolean {
  let changed = false;
  for (const tileset of Object.values(project.tilesets)) {
    const categories = tileset.referenceDocuments;
    if (!categories?.length) continue;
    let tilesetChanged = false;
    // Reference arrays are shared between editor clones and never mutated in place.
    const next = categories.map(category => {
      let categoryChanged = false;
      const images = category.images.map(image => {
        if (!image.dataUrl.startsWith("data:")) return image;
        const path = bundledPaths[referenceImageDigest(image.dataUrl)];
        if (!path) return image;
        categoryChanged = true;
        return { ...image, dataUrl: path };
      });
      if (!categoryChanged) return category;
      tilesetChanged = true;
      return { ...category, images };
    });
    if (!tilesetChanged) continue;
    tileset.referenceDocuments = next;
    changed = true;
  }
  return changed;
}

const resolved = new Map<string, Promise<string>>();

/** Bytes for model input: providers need inline data, not a path on this host. */
export function resolveReferenceImageDataUrl(src: string): Promise<string> {
  if (!isBundledReferenceImage(src) && !isSharedReferenceImage(src)) return Promise.resolve(src);
  let pending = resolved.get(src);
  if (!pending) {
    pending = loadBundledImage(src);
    pending.catch(() => resolved.delete(src));
    resolved.set(src, pending);
  }
  return pending;
}

async function loadBundledImage(src: string): Promise<string> {
  const shared = parseSharedReferenceImage(src);
  const mime = shared?.mime ?? (src.endsWith(".png") ? "image/png" : src.endsWith(".webp") ? "image/webp" : "image/jpeg");
  // Headless tools and tests (including jsdom) run in Node against the checkout's public/ directory.
  const proc = (globalThis as { process?: { versions?: { node?: string }; getBuiltinModule?: (id: string) => unknown } }).process;
  const fs = proc?.versions?.node ? proc.getBuiltinModule?.("fs") as { readFileSync(path: URL): Uint8Array } | undefined : undefined;
  if (fs && !shared) return `data:${mime};base64,${bytesToBase64(fs.readFileSync(new URL(`../../public${src}`, import.meta.url)))}`;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`참고 이미지를 불러오지 못했습니다: ${src} (HTTP ${response.status})`);
  return `data:${mime};base64,${bytesToBase64(new Uint8Array(await response.arrayBuffer()))}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
