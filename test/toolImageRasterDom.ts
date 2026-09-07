import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

type PngCtor = {
  new (opts: { width: number; height: number }): PngRaster;
  readonly sync: {
    read(buf: Buffer): PngRaster;
    write(png: PngRaster): Buffer;
  };
};

function isPngCtor(value: unknown): value is PngCtor {
  if (typeof value !== "function") return false;
  const sync = Reflect.get(value, "sync");
  if (typeof sync !== "object" || sync === null) return false;
  return typeof Reflect.get(sync, "read") === "function" && typeof Reflect.get(sync, "write") === "function";
}

function loadPngCtor(moduleValue: unknown): PngCtor {
  if (typeof moduleValue !== "object" || moduleValue === null || !("PNG" in moduleValue)) {
    throw new Error("pngjs module missing PNG export");
  }
  const png = Reflect.get(moduleValue, "PNG");
  if (!isPngCtor(png)) throw new Error("pngjs PNG export is not a constructor");
  return png;
}

const PNG = loadPngCtor(require("pngjs"));

export type PngRaster = {
  width: number;
  height: number;
  data: Buffer;
};

type RgbaSource = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
};

class RasterImage {
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  data = new Uint8ClampedArray(0);
  private currentSrc = "";
  onload: (() => void) | null = null;
  onerror: ((error?: unknown) => void) | null = null;

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    queueMicrotask(() => {
      try {
        const raster = readRaster(value);
        this.width = raster.width;
        this.height = raster.height;
        this.naturalWidth = raster.width;
        this.naturalHeight = raster.height;
        this.data = new Uint8ClampedArray(raster.data);
        this.complete = true;
        this.onload?.();
      } catch (error) {
        this.onerror?.(error);
      }
    });
  }
}

class RasterCanvas {
  width = 0;
  height = 0;
  private pixels = new Uint8ClampedArray(0);

  getContext(type: string, _opts?: unknown): RasterContext | null {
    if (type !== "2d") return null;
    this.ensureBuffer();
    return new RasterContext(this);
  }

  toDataURL(_mime = "image/png"): string {
    this.ensureBuffer();
    const png = new PNG({ width: this.width, height: this.height });
    png.data = Buffer.from(this.pixels);
    return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
  }

  ensureBuffer(): void {
    const size = Math.max(1, this.width) * Math.max(1, this.height) * 4;
    if (this.pixels.length !== size) this.pixels = new Uint8ClampedArray(size);
  }

  get buffer(): Uint8ClampedArray {
    this.ensureBuffer();
    return this.pixels;
  }
}

class RasterContext {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  lineWidth = 1;
  imageSmoothingEnabled = false;

  constructor(private readonly canvas: RasterCanvas) {}

  fillRect(x: number, y: number, w: number, h: number): void {
    const color = parseCssColor(this.fillStyle);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.canvas.width, Math.ceil(x + w));
    const y1 = Math.min(this.canvas.height, Math.ceil(y + h));
    const buf = this.canvas.buffer;
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        const i = (py * this.canvas.width + px) * 4;
        buf[i] = color.r;
        buf[i + 1] = color.g;
        buf[i + 2] = color.b;
        buf[i + 3] = color.a;
      }
    }
  }

  /** Graft atlas bake clears the destination tile before blitting the source chip. */
  clearRect(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.canvas.width, Math.ceil(x + w));
    const y1 = Math.min(this.canvas.height, Math.ceil(y + h));
    const buf = this.canvas.buffer;
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        const i = (py * this.canvas.width + px) * 4;
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
      }
    }
  }

  strokeText(): void {}
  fillText(): void {}

  drawImage(
    image: RasterImage | RasterCanvas,
    sx: number,
    sy: number,
    sw?: number,
    sh?: number,
    dx?: number,
    dy?: number,
    dw?: number,
    dh?: number,
  ): void {
    const src = toRgbaSource(image);
    let sourceX = sx;
    let sourceY = sy;
    let sourceW = sw;
    let sourceH = sh;
    let destX = dx;
    let destY = dy;
    let destW = dw;
    let destH = dh;
    if (sourceW === undefined || sourceH === undefined || destX === undefined || destY === undefined || destW === undefined || destH === undefined) {
      sourceX = 0;
      sourceY = 0;
      sourceW = src.width;
      sourceH = src.height;
      destX = sx;
      destY = sy;
      destW = src.width;
      destH = src.height;
    }
    blit(src, sourceX, sourceY, sourceW, sourceH, this.canvas, destX, destY, destW, destH);
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const buf = this.canvas.buffer;
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const srcX = sx + x;
        const srcY = sy + y;
        if (srcX < 0 || srcY < 0 || srcX >= this.canvas.width || srcY >= this.canvas.height) continue;
        const si = (srcY * this.canvas.width + srcX) * 4;
        const di = (y * sw + x) * 4;
        const r = buf[si];
        const g = buf[si + 1];
        const b = buf[si + 2];
        const a = buf[si + 3];
        if (r === undefined || g === undefined || b === undefined || a === undefined) continue;
        data[di] = r;
        data[di + 1] = g;
        data[di + 2] = b;
        data[di + 3] = a;
      }
    }
    return { data, width: sw, height: sh };
  }

  putImageData(imageData: { data: Uint8ClampedArray; width: number; height: number }, dx: number, dy: number): void {
    const buf = this.canvas.buffer;
    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        const destX = dx + x;
        const destY = dy + y;
        if (destX < 0 || destY < 0 || destX >= this.canvas.width || destY >= this.canvas.height) continue;
        const si = (y * imageData.width + x) * 4;
        const di = (destY * this.canvas.width + destX) * 4;
        const r = imageData.data[si];
        const g = imageData.data[si + 1];
        const b = imageData.data[si + 2];
        const a = imageData.data[si + 3];
        if (r === undefined || g === undefined || b === undefined || a === undefined) continue;
        buf[di] = r;
        buf[di + 1] = g;
        buf[di + 2] = b;
        buf[di + 3] = a;
      }
    }
  }
}

function toRgbaSource(image: RasterImage | RasterCanvas): RgbaSource {
  if (image instanceof RasterCanvas) {
    return { width: image.width, height: image.height, data: image.buffer };
  }
  return { width: image.width, height: image.height, data: image.data };
}

function blit(
  src: RgbaSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dest: RasterCanvas,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const out = dest.buffer;
  const scaleX = sw / dw;
  const scaleY = sh / dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const destX = Math.floor(dx + x);
      const destY = Math.floor(dy + y);
      if (destX < 0 || destY < 0 || destX >= dest.width || destY >= dest.height) continue;
      const srcX = Math.floor(sx + x * scaleX);
      const srcY = Math.floor(sy + y * scaleY);
      if (srcX < 0 || srcY < 0 || srcX >= src.width || srcY >= src.height) continue;
      const si = (srcY * src.width + srcX) * 4;
      const sr = src.data[si];
      const sg = src.data[si + 1];
      const sb = src.data[si + 2];
      const sa = src.data[si + 3];
      if (sr === undefined || sg === undefined || sb === undefined || sa === undefined || sa === 0) continue;
      const di = (destY * dest.width + destX) * 4;
      const dr = out[di];
      const dg = out[di + 1];
      const db = out[di + 2];
      const da = out[di + 3];
      if (dr === undefined || dg === undefined || db === undefined || da === undefined) continue;
      if (sa >= 255) {
        out[di] = sr;
        out[di + 1] = sg;
        out[di + 2] = sb;
        out[di + 3] = 255;
        continue;
      }
      const alpha = sa / 255;
      out[di] = Math.round(sr * alpha + dr * (1 - alpha));
      out[di + 1] = Math.round(sg * alpha + dg * (1 - alpha));
      out[di + 2] = Math.round(sb * alpha + db * (1 - alpha));
      out[di + 3] = Math.min(255, Math.round(sa + da * (1 - alpha)));
    }
  }
}

function parseCssColor(value: string): { r: number; g: number; b: number; a: number } {
  if (value.startsWith("#") && value.length === 7) {
    return {
      r: Number.parseInt(value.slice(1, 3), 16),
      g: Number.parseInt(value.slice(3, 5), 16),
      b: Number.parseInt(value.slice(5, 7), 16),
      a: 255,
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

function readRaster(src: string): PngRaster {
  if (src.startsWith("data:image/png;base64,")) {
    return PNG.sync.read(Buffer.from(src.slice("data:image/png;base64,".length), "base64"));
  }
  const cleaned = src.startsWith("/") ? src.slice(1) : src;
  return PNG.sync.read(fs.readFileSync(path.resolve("public", cleaned)));
}

/** Install a pngjs-backed document/Image for toolImageRenderer pixel tests and proof scripts. */
export function installToolImageRasterDom(): () => void {
  const previousDocument = globalThis.document;
  const previousImage = globalThis.Image;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") throw new Error(`unexpected element: ${tagName}`);
        return new RasterCanvas();
      },
    },
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: RasterImage,
  });
  return () => {
    Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: previousDocument });
    Object.defineProperty(globalThis, "Image", { configurable: true, writable: true, value: previousImage });
  };
}

export function decodeDataUrlPng(dataUrl: string): PngRaster {
  if (!dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("expected png data url");
  }
  return PNG.sync.read(Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64"));
}

export function saveDataUrlPng(dataUrl: string, filePath: string): void {
  if (!dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("expected png data url");
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64"));
}

export function pixelDiffRatio(a: PngRaster, b: PngRaster): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`raster size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
      diff += 1;
    }
  }
  return diff / total;
}
