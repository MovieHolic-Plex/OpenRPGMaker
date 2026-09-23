import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";

const THUMB_WIDTH = 32;
const THUMB_HEIGHT = 40;

const sheets = new Map<string, HTMLImageElement>();
const waiters = new Map<string, Array<(image: HTMLImageElement | null) => void>>();

function loadSheet(url: string, done: (image: HTMLImageElement | null) => void): void {
  const cached = sheets.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    done(cached);
    return;
  }
  const pending = waiters.get(url);
  if (pending) {
    pending.push(done);
    return;
  }
  waiters.set(url, [done]);
  const image = new Image();
  sheets.set(url, image);
  const finish = (loaded: HTMLImageElement | null): void => {
    const queued = waiters.get(url) ?? [];
    waiters.delete(url);
    if (!loaded) sheets.delete(url);
    for (const notify of queued) notify(loaded);
  };
  image.addEventListener("load", () => finish(image.naturalWidth > 0 ? image : null), { once: true });
  image.addEventListener("error", () => finish(null), { once: true });
  image.src = url;
}

function paintCrop(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.dataset.thumb = "error";
    return;
  }
  context.imageSmoothingEnabled = false;
  const cropWidth = Math.min(image.naturalWidth, 48);
  const cropHeight = Math.min(image.naturalHeight, 64);
  context.drawImage(image, 0, 0, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  canvas.dataset.thumb = "ready";
}

function paintTileset(canvas: HTMLCanvasElement, tileset: TilesetDef): void {
  loadSheet(tilesetImageUrl(tileset), (image) => {
    if (!image) {
      canvas.dataset.thumb = "error";
      return;
    }
    paintCrop(canvas, image);
  });
}

const sources = new WeakMap<Element, TilesetDef>();
let observer: IntersectionObserver | null = null;

function watch(canvas: HTMLCanvasElement, tileset: TilesetDef): void {
  if (typeof IntersectionObserver !== "function") {
    paintTileset(canvas, tileset);
    return;
  }
  sources.set(canvas, tileset);
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target;
      if (!(node instanceof HTMLCanvasElement)) continue;
      observer?.unobserve(node);
      const source = sources.get(node);
      if (!source) continue;
      paintTileset(node, source);
    }
  }, { rootMargin: "240px" });
  observer.observe(canvas);
}

function cropCanvas(tileset: TilesetDef): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;
  canvas.className = "tileset-list-thumb";
  canvas.dataset.thumb = "pending";
  canvas.dataset.tilesetId = tileset.id;
  watch(canvas, tileset);
  return canvas;
}

/**
 * 목록 줄에 붙는 32×40 그림.
 * 칩셋은 미리 잘라 둔 파일을 쓰고, 그 외에는 화면에 들어온 뒤 귀퉁이만 그린다.
 */
export function tilesetListThumb(tileset: TilesetDef): HTMLElement {
  const url = tilesetImageUrl(tileset);
  if (!url.startsWith("/assets/") || !url.includes("chipset")) return cropCanvas(tileset);
  const img = document.createElement("img");
  img.className = "tileset-list-thumb";
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  img.loading = "lazy";
  img.width = THUMB_WIDTH;
  img.height = THUMB_HEIGHT;
  img.dataset.tilesetId = tileset.id;
  img.src = `/assets/catalog-thumbs/sheets${url.slice("/assets".length)}`;
  img.addEventListener("error", () => {
    if (img.dataset.usedFull === "1") return;
    img.dataset.usedFull = "1";
    img.replaceWith(cropCanvas(tileset));
  }, { once: true });
  return img;
}
