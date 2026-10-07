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

/**
 * 공용 DB 참고 이미지(`/__oprn/shared-content/image/…`)를 주소 없이 바로 읽는 쪽. 조수 워커(Bun)는 상대 주소를 fetch 하지 못해
 * 「fetch() URL is invalid」로 공용 손 도트 기물 참고문서를 매번 못 읽었다(2026-10-07 space-craft 무림·여관). 워커가 공용 SQLite 를 연 뒤 등록한다.
 */
type SharedReferenceImageReader = (src: string) => { readonly mime: string; readonly bytes: Uint8Array } | null;
let sharedReferenceImageReader: SharedReferenceImageReader | null = null;
export function setSharedReferenceImageReader(reader: SharedReferenceImageReader | null): void {
  sharedReferenceImageReader = reader;
}

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
  // 패키지 앱의 조수 워커는 bun 으로 컴파일한 실행 파일이라 import.meta.url 이 가상 루트(Windows 「B:\~BUN\root」)를 가리킨다 —
  // 거기서 ../../public 은 B:\public 이 되어 ENOENT 였다(2026-10-07 사용자 실측: read_tileset_reference 실패, 실내 단계 턴 낭비).
  // Electron 이 내보내는 렌더러 폴더(OPRN_RENDERER_DIR, 빌드된 dist = public 사본)를 먼저 본다.
  const proc = (globalThis as { process?: { versions?: { node?: string }; env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => unknown } }).process;
  const fs = proc?.versions?.node ? proc.getBuiltinModule?.("fs") as { readFileSync(path: URL | string): Uint8Array; existsSync(path: string): boolean } | undefined : undefined;
  if (fs && !shared) {
    // 렌더러 폴더는 app.asar 안이다. 워커는 asar 를 못 읽으므로 풀어 둔 사본(app.asar.unpacked, electron-builder asarUnpack)을 먼저 본다.
    const rendererDir = proc?.env?.OPRN_RENDERER_DIR?.replace(/[\\/]+$/u, "");
    const packaged = rendererDir ? [rendererDir.replace(/app\.asar(?=[\\/]|$)/u, "app.asar.unpacked"), rendererDir].map(dir => `${dir}${src}`) : [];
    const file = packaged.find(candidate => fs.existsSync(candidate)) ?? new URL(`../../public${src}`, import.meta.url);
    return `data:${mime};base64,${bytesToBase64(fs.readFileSync(file))}`;
  }
  const local = shared ? sharedReferenceImageReader?.(src) : null;
  if (local) return `data:${local.mime};base64,${bytesToBase64(local.bytes)}`;
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
