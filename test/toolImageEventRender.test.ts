import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearToolImageEventSpriteCache } from "@/ai/toolImageEventSprites";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { charsetGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    new (opts: { width: number; height: number }): Raster;
    sync: { read(buf: Buffer): Raster; write(png: Raster): Buffer };
  };
};

type Raster = { width: number; height: number; data: Buffer };

type CanvasImageSource = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
};

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  clearToolImageEventSpriteCache();
});

describe("show_map_region event depiction", () => {
  it("changes pixels when a charset event moves inside the region", async () => {
    restoreDom = installRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, "ev_move", 2, 2, charsetGraphic("tex_easyrpg_charset_people1", 0));

    const before = await renderRegion(project, map.id);
    map.events[0]!.x = 7;
    map.events[0]!.y = 4;
    const after = await renderRegion(project, map.id);

    expect(before.dataUrl.length).toBeGreaterThan(100);
    expect(after.dataUrl.length).toBeGreaterThan(100);
    expect(after.dataUrl).not.toBe(before.dataUrl);
    expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
  });

  it("changes pixels when the event graphic slot changes", async () => {
    restoreDom = installRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, "ev_gfx", 4, 3, charsetGraphic("tex_easyrpg_charset_people1", 0));

    const before = await renderRegion(project, map.id);
    map.events[0]!.pages![0]!.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
    const after = await renderRegion(project, map.id);

    expect(after.dataUrl).not.toBe(before.dataUrl);
    expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
  });

  it("fails closed instead of tile-only proof when a claimed graphic is unsupported", async () => {
    restoreDom = installRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, "ev_bad", 3, 3, {
      sprite: { type: "bundled", id: "tex_not_a_real_charset_sheet" },
      pattern: 0,
    });

    const images = await renderToolImages(project, "show_map_region", regionPayload(map.id));
    expect(images).toEqual([]);
  });

  it("keeps tile-only group samples working without a map", async () => {
    restoreDom = installRasterDom();
    const project = createBlankProject();
    const images = await renderToolImages(project, "render_group_sample", {
      samples: [{ h: 1, label: "현재", lower: [0], upper: [-1], w: 1 }],
      tilesetId: project.maps[project.startMapId]!.tilesetId,
    });
    expect(images.length).toBe(1);
    expect(images[0]?.dataUrl.startsWith("data:image/png")).toBe(true);
  });
});

async function renderRegion(project: Project, mapId: string): Promise<{ dataUrl: string; raster: Raster }> {
  const result = runTool({ project }, "show_map_region", { mapId, x: 0, y: 0, w: 10, h: 8 });
  expect(result.ok, result.summary).toBe(true);
  const images = await renderToolImages(project, "show_map_region", result.data);
  expect(images.length).toBe(1);
  const dataUrl = images[0]!.dataUrl;
  return { dataUrl, raster: decodeDataUrlPng(dataUrl) };
}

function regionPayload(mapId: string): unknown {
  const lower = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => 0));
  const upper = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => -1));
  return { mapId, x: 0, y: 0, w: 10, h: 8, lower, upper };
}

function seededProject(): Project {
  const project = createBlankProject();
  const map = requireMap(project);
  map.width = 12;
  map.height = 10;
  map.lowerTiles = Array.from({ length: map.width * map.height }, () => 0);
  map.upperTiles = Array.from({ length: map.width * map.height }, () => -1);
  map.events = [];
  return project;
}

function requireMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function placeNpc(map: GameMap, id: string, x: number, y: number, graphic: NonNullable<GameEvent["pages"]>[number]["graphic"]): void {
  map.events.push({
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${id}_page`,
      name: id,
      conditions: [],
      graphic,
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  });
}

function pixelDiffRatio(a: Raster, b: Raster): number {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
      diff += 1;
    }
  }
  return diff / total;
}

function decodeDataUrlPng(dataUrl: string): Raster {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return PNG.sync.read(Buffer.from(base64, "base64"));
}

function installRasterDom(): () => void {
  const previousDocument = globalThis.document;
  const previousImage = globalThis.Image;
  const publicRoot = path.resolve("public");

  class RasterImage {
    width = 0;
    height = 0;
    naturalWidth = 0;
    naturalHeight = 0;
    complete = false;
    data = new Uint8ClampedArray(0);
    private currentSrc = "";
    onload: ((ev?: unknown) => void) | null = null;
    onerror: ((ev?: unknown) => void) | null = null;

    get src(): string {
      return this.currentSrc;
    }

    set src(value: string) {
      this.currentSrc = value;
      queueMicrotask(() => {
        try {
          const raster = loadRaster(value, publicRoot);
          this.width = raster.width;
          this.height = raster.height;
          this.naturalWidth = raster.width;
          this.naturalHeight = raster.height;
          this.data = new Uint8ClampedArray(raster.data);
          this.complete = true;
          this.onload?.(undefined);
        } catch {
          this.onerror?.(undefined);
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

    toDataURL(mime = "image/png"): string {
      this.ensureBuffer();
      const png = new PNG({ width: this.width, height: this.height });
      png.data = Buffer.from(this.pixels);
      return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
    }

    ensureBuffer(): void {
      const size = Math.max(1, this.width) * Math.max(1, this.height) * 4;
      if (this.pixels.length !== size) {
        this.pixels = new Uint8ClampedArray(size);
      }
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

    strokeText(): void {}
    fillText(): void {}

    drawImage(
      image: CanvasImageSource | RasterImage | RasterCanvas,
      sx: number,
      sy: number,
      sw?: number,
      sh?: number,
      dx?: number,
      dy?: number,
      dw?: number,
      dh?: number,
    ): void {
      const src = rasterSource(image);
      if (sw === undefined || sh === undefined || dx === undefined || dy === undefined || dw === undefined || dh === undefined) {
        // drawImage(image, dx, dy)
        blit(src, 0, 0, src.width, src.height, this.canvas, sx, sy, src.width, src.height);
        return;
      }
      blit(src, sx, sy, sw, sh, this.canvas, dx, dy, dw, dh);
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
          data[di] = buf[si]!;
          data[di + 1] = buf[si + 1]!;
          data[di + 2] = buf[si + 2]!;
          data[di + 3] = buf[si + 3]!;
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
          buf[di] = imageData.data[si]!;
          buf[di + 1] = imageData.data[si + 1]!;
          buf[di + 2] = imageData.data[si + 2]!;
          buf[di + 3] = imageData.data[si + 3]!;
        }
      }
    }
  }

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

function loadRaster(src: string, publicRoot: string): Raster {
  if (src.startsWith("data:image/png;base64,")) {
    return PNG.sync.read(Buffer.from(src.slice("data:image/png;base64,".length), "base64"));
  }
  const cleaned = src.startsWith("/") ? src.slice(1) : src;
  const filePath = path.resolve(publicRoot, cleaned);
  return PNG.sync.read(fs.readFileSync(filePath));
}

function rasterSource(image: CanvasImageSource | RasterImage | RasterCanvas): CanvasImageSource {
  if (image instanceof Object && "buffer" in image && typeof (image as RasterCanvas).buffer !== "undefined" && "width" in image) {
    const canvas = image as RasterCanvas;
    return { width: canvas.width, height: canvas.height, data: canvas.buffer };
  }
  const img = image as RasterImage | CanvasImageSource;
  return {
    width: img.width,
    height: img.height,
    data: "data" in img ? img.data : new Uint8ClampedArray(),
  };
}

function blit(
  src: CanvasImageSource,
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
      const a = src.data[si + 3] ?? 0;
      if (a === 0) continue;
      const di = (destY * dest.width + destX) * 4;
      if (a >= 255) {
        out[di] = src.data[si]!;
        out[di + 1] = src.data[si + 1]!;
        out[di + 2] = src.data[si + 2]!;
        out[di + 3] = 255;
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
