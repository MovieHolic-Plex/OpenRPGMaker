import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { clearToolImageEventSpriteCache } from "../src/ai/toolImageEventSprites";
import { renderToolImages } from "../src/ai/toolImageRenderer";
import { charsetGraphic } from "../src/editor/tools/eventCompile";
import { runTool } from "../src/editor/tools/toolRunner";
import { createBlankProject } from "../src/project/defaults";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    new (opts: { width: number; height: number }): { width: number; height: number; data: Buffer };
    sync: {
      read(buf: Buffer): { width: number; height: number; data: Buffer };
      write(png: { width: number; height: number; data: Buffer }): Buffer;
    };
  };
};

const outDir = path.resolve(".omo/evidence/ai-full-context-event-visual");
const publicRoot = path.resolve("public");
fs.mkdirSync(outDir, { recursive: true });

class RasterImage {
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  data = new Uint8ClampedArray(0);
  private currentSrc = "";
  onload: (() => void) | null = null;
  onerror: ((err?: unknown) => void) | null = null;
  get src(): string { return this.currentSrc; }
  set src(value: string) {
    this.currentSrc = value;
    queueMicrotask(() => {
      try {
        const raster = value.startsWith("data:image/png;base64,")
          ? PNG.sync.read(Buffer.from(value.slice("data:image/png;base64,".length), "base64"))
          : PNG.sync.read(fs.readFileSync(path.resolve(publicRoot, value.startsWith("/") ? value.slice(1) : value)));
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
  getContext(type: string): RasterContext | null {
    if (type !== "2d") return null;
    this.ensureBuffer();
    return new RasterContext(this);
  }
  toDataURL(): string {
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
  imageSmoothingEnabled = false;
  strokeStyle = "#000";
  font = "";
  textAlign = "start";
  textBaseline = "alphabetic";
  lineWidth = 1;
  constructor(private readonly canvas: RasterCanvas) {}
  fillRect(x: number, y: number, w: number, h: number): void {
    const color = parseCss(this.fillStyle);
    const buf = this.canvas.buffer;
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.canvas.height, Math.ceil(y + h)); py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(this.canvas.width, Math.ceil(x + w)); px += 1) {
        const i = (py * this.canvas.width + px) * 4;
        buf[i] = color.r; buf[i + 1] = color.g; buf[i + 2] = color.b; buf[i + 3] = 255;
      }
    }
  }
  strokeText(): void {}
  fillText(): void {}
  drawImage(image: RasterImage | RasterCanvas, sx: number, sy: number, sw?: number, sh?: number, dx?: number, dy?: number, dw?: number, dh?: number): void {
    const src = "buffer" in image
      ? { width: image.width, height: image.height, data: image.buffer }
      : { width: image.width, height: image.height, data: image.data };
    if (sw === undefined || sh === undefined || dx === undefined || dy === undefined || dw === undefined || dh === undefined) {
      sw = src.width; sh = src.height; dx = sx; dy = sy; dw = src.width; dh = src.height; sx = 0; sy = 0;
    }
    const out = this.canvas.buffer;
    const scaleX = sw / dw;
    const scaleY = sh / dh;
    for (let y = 0; y < dh; y += 1) {
      for (let x = 0; x < dw; x += 1) {
        const destX = Math.floor(dx + x);
        const destY = Math.floor(dy + y);
        if (destX < 0 || destY < 0 || destX >= this.canvas.width || destY >= this.canvas.height) continue;
        const srcX = Math.floor(sx + x * scaleX);
        const srcY = Math.floor(sy + y * scaleY);
        if (srcX < 0 || srcY < 0 || srcX >= src.width || srcY >= src.height) continue;
        const si = (srcY * src.width + srcX) * 4;
        const a = src.data[si + 3] ?? 0;
        if (a === 0) continue;
        const di = (destY * this.canvas.width + destX) * 4;
        if (a >= 255) {
          out[di] = src.data[si]!; out[di + 1] = src.data[si + 1]!; out[di + 2] = src.data[si + 2]!; out[di + 3] = 255;
          continue;
        }
        const alpha = a / 255;
        out[di] = Math.round(src.data[si]! * alpha + out[di]! * (1 - alpha));
        out[di + 1] = Math.round(src.data[si + 1]! * alpha + out[di + 1]! * (1 - alpha));
        out[di + 2] = Math.round(src.data[si + 2]! * alpha + out[di + 2]! * (1 - alpha));
        out[di + 3] = Math.min(255, Math.round(a + out[di + 3]! * (1 - alpha)));
      }
    }
  }
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const buf = this.canvas.buffer;
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const srcX = sx + x, srcY = sy + y;
        if (srcX < 0 || srcY < 0 || srcX >= this.canvas.width || srcY >= this.canvas.height) continue;
        const si = (srcY * this.canvas.width + srcX) * 4;
        const di = (y * sw + x) * 4;
        data[di] = buf[si]!; data[di + 1] = buf[si + 1]!; data[di + 2] = buf[si + 2]!; data[di + 3] = buf[si + 3]!;
      }
    }
    return { data, width: sw, height: sh };
  }
  putImageData(imageData: { data: Uint8ClampedArray; width: number; height: number }, dx: number, dy: number): void {
    const buf = this.canvas.buffer;
    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        const destX = dx + x, destY = dy + y;
        if (destX < 0 || destY < 0 || destX >= this.canvas.width || destY >= this.canvas.height) continue;
        const si = (y * imageData.width + x) * 4;
        const di = (destY * this.canvas.width + destX) * 4;
        buf[di] = imageData.data[si]!; buf[di + 1] = imageData.data[si + 1]!; buf[di + 2] = imageData.data[si + 2]!; buf[di + 3] = imageData.data[si + 3]!;
      }
    }
  }
}

function parseCss(value: string): { r: number; g: number; b: number } {
  if (value.startsWith("#") && value.length === 7) {
    return {
      r: Number.parseInt(value.slice(1, 3), 16),
      g: Number.parseInt(value.slice(3, 5), 16),
      b: Number.parseInt(value.slice(5, 7), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

function savePng(dataUrl: string, name: string): string {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  return file;
}

function diffRatio(aPath: string, bPath: string): number {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) diff += 1;
  }
  return diff / total;
}

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { createElement: (tag: string) => { if (tag !== "canvas") throw new Error(tag); return new RasterCanvas(); } },
});
Object.defineProperty(globalThis, "Image", { configurable: true, value: RasterImage });

clearToolImageEventSpriteCache();
const project = createBlankProject();
const map = project.maps[project.startMapId]!;
map.width = 12;
map.height = 10;
map.lowerTiles = Array.from({ length: 120 }, () => 0);
map.upperTiles = Array.from({ length: 120 }, () => -1);
map.events = [{
  id: "ev_move",
  x: 2,
  y: 2,
  trigger: { kind: "action" },
  commands: [],
  pages: [{
    id: "p",
    name: "npc",
    conditions: [],
    graphic: charsetGraphic("tex_easyrpg_charset_people1", 0),
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  }],
}];

const beforeImgs = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 10, h: 8 }).data);
const before = savePng(beforeImgs[0]!.dataUrl, "move-before-2-2.png");
map.events[0]!.x = 7;
map.events[0]!.y = 4;
const afterImgs = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 10, h: 8 }).data);
const after = savePng(afterImgs[0]!.dataUrl, "move-after-7-4.png");
const moveDiff = diffRatio(before, after);

map.events[0]!.x = 4;
map.events[0]!.y = 3;
map.events[0]!.pages![0]!.graphic = charsetGraphic("tex_easyrpg_charset_people1", 0);
const g0 = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 10, h: 8 }).data);
const graphic0 = savePng(g0[0]!.dataUrl, "graphic-index-0.png");
map.events[0]!.pages![0]!.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
const g6 = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 10, h: 8 }).data);
const graphic6 = savePng(g6[0]!.dataUrl, "graphic-index-6.png");
const graphicDiff = diffRatio(graphic0, graphic6);

map.events[0]!.pages![0]!.graphic = { sprite: { type: "bundled", id: "tex_not_a_real_charset_sheet" }, pattern: 0 };
const unsupported = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 10, h: 8 }).data);

const summary = {
  moveBefore: before,
  moveAfter: after,
  moveDiffRatio: moveDiff,
  graphicBefore: graphic0,
  graphicAfter: graphic6,
  graphicDiffRatio: graphicDiff,
  unsupportedImageCount: unsupported.length,
  byteIdenticalMoveBugFixed: moveDiff > 0.001,
  graphicChangeVisible: graphicDiff > 0.001,
};
fs.writeFileSync(path.join(outDir, "proof-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
