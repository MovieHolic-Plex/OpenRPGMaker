/** Browser-side fixture animatics + measurement helpers for the opening-animatic probe.
 * Every fixture is a valid composition; the probe renders it through the real shared renderer.
 */
import type { OpeningAnimatic } from '../../../src/project/openingAnimatic';
import { drawAnimaticFrame } from '../../../src/player/openingAnimaticRenderer';

export const LEGACY_TIMES = [0, 120, 640, 1500, 2600, 3999];
export const LEGACY_DURATION = 4000;
export const GRID = { width: 192, height: 108 };
export const STAGE = { width: 384, height: 216 };
export const CANVAS = { width: 768, height: 432 };
export const PRIMITIVE_DURATION = 3000;

function canvasOf(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d')!);
  return canvas;
}

function imageOf(canvas: HTMLCanvasElement): HTMLImageElement {
  const image = new Image();
  image.src = canvas.toDataURL('image/png');
  return image;
}

/** Water patch: 4px horizontal bands so a vertical 1px scroll is visible. */
function waterImage(): HTMLImageElement {
  return imageOf(canvasOf(32, 32, ctx => {
    for (let y = 0; y < 32; y += 1) { ctx.fillStyle = (y >> 2) % 2 ? '#24507a' : '#1a3a5c'; ctx.fillRect(0, y, 32, 1); }
    ctx.fillStyle = '#7fd0ff'; ctx.fillRect(2, 2, 6, 1); ctx.fillRect(20, 18, 8, 1);
  }));
}

/** Palette patch: the 8×8 window at the origin is exactly #ff0000. */
function paletteImage(): HTMLImageElement {
  return imageOf(canvasOf(16, 16, ctx => { ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 8, 8); }));
}

/** Walk strip: three 24×32 cells with distinct flat colors (#b03030 / #30b030 / #3030b0). */
function walkImage(): HTMLImageElement {
  return imageOf(canvasOf(72, 32, ctx => {
    ['#b03030', '#30b030', '#3030b0'].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(i * 24, 0, 24, 32); });
  }));
}

function stillImage(): HTMLImageElement {
  return imageOf(canvasOf(16, 16, ctx => { ctx.fillStyle = '#405060'; ctx.fillRect(0, 0, 16, 16); }));
}

/** Strip for the region 'strip' mode: 3 frames of 16×16 at the top-left of the sheet. */
function stripImage(): HTMLImageElement {
  return imageOf(canvasOf(48, 16, ctx => {
    ['#aa2222', '#22aa22', '#2222aa'].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(i * 16, 0, 16, 16); });
  }));
}

export function makeImages(): Map<string, HTMLImageElement> {
  return new Map<string, HTMLImageElement>([
    ['water', waterImage()], ['palette', paletteImage()], ['walk', walkImage()], ['still', stillImage()], ['strip', stripImage()],
  ]);
}

export const CHARSET_WALK_COLORS = ['#c05050', '#50c050', '#5050c0'];
/** A real charset sheet: 12 columns × 8 rows of 24×32 cells, first character's right-walk row at the top. */
export function charsetImage(): HTMLImageElement {
  return imageOf(canvasOf(24 * 12, 32 * 8, ctx => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 24 * 12, 32 * 8);
    CHARSET_WALK_COLORS.forEach((color, pattern) => {
      ctx.fillStyle = color;
      ctx.fillRect(pattern * 24, 32, 24, 32);
    });
  }));
}

const base = { width: STAGE.width, height: STAGE.height, background: '#05070c' } as const;

/** The pre-existing feature set only: no new field anywhere. */
export function legacyFixture(): OpeningAnimatic {
  const a: OpeningAnimatic = {
    ...base,
    layers: [
      { id: 'bg', kind: 'image', resourceId: 'still', x: 10.5, y: 20.25, width: 16, height: 16, sampling: 'nearest', scaleX: 4.5, scaleY: 4.5, keys: { x: [{ atMs: 0, value: 10.5 }, { atMs: LEGACY_DURATION, value: 300, ease: 'ease-in-out' }] } },
      { id: 'tint', kind: 'shape', shape: 'rect', x: 0, y: 0, width: 384, height: 216, color: '#203040', blend: 'multiply', opacity: 0.6 },
      { id: 'snow', kind: 'particles', particles: { preset: 'snow', count: 24, seed: 41, speed: 22, size: 2 }, x: 0, y: 0, width: 384, height: 216 },
    ],
    camera: { keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: LEGACY_DURATION, value: 1.4 }], x: [{ atMs: 0, value: 100 }, { atMs: LEGACY_DURATION, value: 220 }] } },
    transition: { kind: 'fade', durationMs: 500 },
  };
  return a;
}

export function regionFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'water', kind: 'image', resourceId: 'water', x: 20, y: 20, width: 32, height: 32, sampling: 'nearest', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1, everyTicks: 2, tickMs: 16 } }],
  };
}

export function paletteRegionFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'shimmer', kind: 'image', resourceId: 'palette', x: 40, y: 40, width: 16, height: 16, sampling: 'nearest', region: { x: 0, y: 0, width: 8, height: 8, mode: 'palette-cycle', colors: ['#ff0000', '#00ff00', '#0000ff'], everyTicks: 3, tickMs: 16 } }],
  };
}

export function stripRegionFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'flow', kind: 'image', resourceId: 'strip', x: 60, y: 30, width: 48, height: 16, sampling: 'nearest', region: { x: 0, y: 0, width: 16, height: 16, mode: 'strip', frames: { frameWidth: 16, frameHeight: 16, count: 3, fps: 8 } } }],
  };
}

export const SHAFT = { x: 90, y: 10, width: 60, height: 90, rotation: 22, spread: 0.7 };

export function shaftFixture(withDust: boolean): OpeningAnimatic {
  const dust = { count: 30, seed: 7, speed: 26, size: 1 };
  return {
    ...base,
    layers: [{
      id: 'beam', kind: 'shaft', role: 'effect', x: SHAFT.x, y: SHAFT.y, width: SHAFT.width, height: SHAFT.height, rotation: SHAFT.rotation, color: '#ffe9b0', blend: 'lighter',
      shaft: { spread: SHAFT.spread, softness: 0.7, ...(withDust ? { dust } : {}), pulse: { hz: 1, amount: 0.3, pattern: 'flicker', seed: 9 } },
    }],
  };
}

export function glowFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'lantern', kind: 'glow', role: 'effect', x: 60, y: 40, width: 40, height: 40, color: '#ffcc66', blend: 'lighter', glow: { inner: 0.15, pulse: { hz: 0.8, amount: 0.45, seed: 3 } } }],
  };
}

export function emoteFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'bubble', kind: 'emote', x: 80, y: 40, width: 24, height: 32, emote: { preset: 'exclaim', popMs: 200, outMs: 200 }, startMs: 300, endMs: 2000 }],
  };
}

export const CAPTION_CUE2_COLOR = '#ff6655';

export function captionFixture(): OpeningAnimatic {
  return {
    ...base, letterbox: 0.12,
    layers: [{
      id: 'line', kind: 'caption', x: 0, y: 0, width: 384, height: 24, color: '#ffffff',
      typography: { fontSize: 12, align: 'center', typewriterMs: 600 },
      caption: { cues: [{ atMs: 0, text: 'The water moved without sound.', typewriterMs: 600 }, { atMs: 1200, text: 'Light answered the stone.', color: CAPTION_CUE2_COLOR, typewriterMs: 400 }], safeArea: 0.06, fadeOutMs: 400 },
    }],
  };
}

/** 3 frames of 24×32; the actor walks 180 stage px with stride 9 (20 steps). */
export function walkFixture(durationMs = PRIMITIVE_DURATION): OpeningAnimatic {
  return {
    ...base,
    layers: [{
      id: 'hero', kind: 'image', role: 'actor', resourceId: 'walk', x: 20, y: 140, width: 24, height: 32, sampling: 'nearest',
      sheet: { frameWidth: 24, frameHeight: 32, columns: 3, count: 3, fps: 0 },
      walk: { stride: 9, frames: [0, 1, 2, 1], holdFrame: 1 },
      keys: { x: [{ atMs: 0, value: 20 }, { atMs: durationMs, value: 200 }] },
    }],
  };
}

/** Positional primitives only — the reduced-motion freeze contract covers motion, not visibility timing. */
export function motionFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [
      { id: 'night', kind: 'shape', shape: 'rect', x: 0, y: 0, width: 384, height: 216, color: '#16203a' },
      { id: 'water', kind: 'image', resourceId: 'water', x: 20, y: 20, width: 32, height: 32, sampling: 'nearest', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1, everyTicks: 2, tickMs: 16 } },
      { id: 'beam', kind: 'shaft', role: 'effect', x: SHAFT.x, y: SHAFT.y, width: SHAFT.width, height: SHAFT.height, rotation: SHAFT.rotation, color: '#ffe9b0', blend: 'lighter', shaft: { spread: SHAFT.spread, softness: 0.7, dust: { count: 30, seed: 7, speed: 26, size: 1 }, pulse: { hz: 1, amount: 0.3, pattern: 'flicker', seed: 9 } } },
      { id: 'hero', kind: 'image', role: 'actor', resourceId: 'walk', x: 20, y: 150, width: 24, height: 32, sampling: 'nearest', sheet: { frameWidth: 24, frameHeight: 32, columns: 3, count: 3, fps: 0 }, walk: { stride: 9, frames: [0, 1, 2, 1], holdFrame: 1 }, keys: { x: [{ atMs: 0, value: 20 }, { atMs: 3000, value: 200 }] } },
    ],
  };
}

export function ditherFixture(): OpeningAnimatic {
  return {
    ...base,
    layers: [{ id: 'bg', kind: 'image', resourceId: 'still', x: 0, y: 0, width: 16, height: 16, sampling: 'nearest', scaleX: 24, scaleY: 13.5 }],
    transition: { kind: 'dither', durationMs: 800 },
  };
}

export function plainFixture(): OpeningAnimatic {
  return { ...base, layers: [{ id: 'bg', kind: 'image', resourceId: 'still', x: 0, y: 0, width: 16, height: 16, sampling: 'nearest', scaleX: 24, scaleY: 13.5 }] };
}

/** One shot that uses every new primitive at once, for the contact sheet and the mp4. */
export function fullFixture(): OpeningAnimatic {
  return {
    width: STAGE.width, height: STAGE.height, background: '#0a0d14', letterbox: 0.1, pixelGrid: GRID,
    layers: [
      { id: 'night', kind: 'shape', shape: 'rect', x: 0, y: 0, width: 384, height: 216, color: '#16203a' },
      { id: 'water', kind: 'image', resourceId: 'water', x: 20, y: 20, width: 32, height: 32, sampling: 'nearest', region: { x: 8, y: 8, width: 16, height: 16, mode: 'scroll-y', pixels: 1, everyTicks: 2, tickMs: 16 } },
      { id: 'shimmer', kind: 'image', resourceId: 'palette', x: 40, y: 40, width: 16, height: 16, sampling: 'nearest', region: { x: 0, y: 0, width: 8, height: 8, mode: 'palette-cycle', colors: ['#ff0000', '#00ff00', '#0000ff'], everyTicks: 3, tickMs: 16 } },
      { id: 'beam', kind: 'shaft', role: 'effect', x: SHAFT.x, y: SHAFT.y, width: SHAFT.width, height: SHAFT.height, rotation: SHAFT.rotation, color: '#ffe9b0', blend: 'lighter', shaft: { spread: SHAFT.spread, softness: 0.7, dust: { count: 30, seed: 7, speed: 26, size: 1 }, pulse: { hz: 1, amount: 0.3, pattern: 'flicker', seed: 9 } } },
      { id: 'lantern', kind: 'glow', role: 'effect', x: 250, y: 40, width: 40, height: 40, color: '#ffcc66', blend: 'lighter', glow: { inner: 0.15, pulse: { hz: 0.8, amount: 0.45, seed: 3 } } },
      { id: 'hero', kind: 'image', role: 'actor', resourceId: 'walk', x: 20, y: 150, width: 24, height: 32, sampling: 'nearest', sheet: { frameWidth: 24, frameHeight: 32, columns: 3, count: 3, fps: 0 }, walk: { stride: 9, frames: [0, 1, 2, 1], holdFrame: 1 }, keys: { x: [{ atMs: 0, value: 20 }, { atMs: 3000, value: 200 }] } },
      { id: 'bubble', kind: 'emote', x: 60, y: 100, width: 24, height: 32, emote: { preset: 'exclaim', popMs: 200, outMs: 200 }, startMs: 300, endMs: 2600 },
      { id: 'line', kind: 'caption', x: 0, y: 0, width: 384, height: 24, color: '#ffffff', typography: { fontSize: 12, align: 'center' }, caption: { cues: [{ atMs: 0, text: 'The water moved without sound.', typewriterMs: 600 }, { atMs: 1200, text: 'Light answered the stone.', color: CAPTION_CUE2_COLOR, typewriterMs: 400 }], safeArea: 0.04, fadeOutMs: 400 } },
    ],
    camera: { keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: 3000, value: 1.15, ease: 'ease-in-out' }] } },
    transition: { kind: 'dither', durationMs: 600 },
  };
}

export function renderFrame(animatic: OpeningAnimatic, images: Map<string, HTMLImageElement>, atMs: number, options: { reducedMotion?: boolean; canvas?: HTMLCanvasElement; size?: { width: number; height: number }; durationMs?: number } = {}): HTMLCanvasElement {
  const canvas = options.canvas ?? document.createElement('canvas');
  const size = options.size ?? (options.canvas ? { width: canvas.width, height: canvas.height } : CANVAS);
  canvas.width = size.width; canvas.height = size.height;
  drawAnimaticFrame(canvas, animatic, images, atMs, { reducedMotion: options.reducedMotion === true, ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}) });
  return canvas;
}

export type Rect = { x: number; y: number; width: number; height: number };

/** stage-space rect → canvas-space rect for the fixture mapping (2× on both axes). */
export function stageRectToCanvas(rect: Rect): Rect {
  const sx = CANVAS.width / STAGE.width, sy = CANVAS.height / STAGE.height;
  return { x: rect.x * sx, y: rect.y * sy, width: rect.width * sx, height: rect.height * sy };
}

export function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

export type Diff = { changed: number; outside: number; outsideSample?: { x: number; y: number }; bounds?: Rect };

export function diffPixels(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number, region?: Rect): Diff {
  let changed = 0, outside = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sample: { x: number; y: number } | undefined;
  const height = a.length / 4 / width;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
      changed += 1;
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      const inside = region && x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height;
      if (!inside) { outside += 1; sample ??= { x, y }; }
    }
  }
  return { changed, outside, ...(sample ? { outsideSample: sample } : {}), ...(changed ? { bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } } : {}) };
}

export type BlockCheck = { nonUniform: number; sample?: { x: number; y: number; values: number[][] } };

export function uniformBlocks(canvas: HTMLCanvasElement, block: number): BlockCheck {
  const width = canvas.width, height = canvas.height, data = pixels(canvas);
  let nonUniform = 0, sample: BlockCheck['sample'];
  for (let by = 0; by + block <= height; by += block) {
    for (let bx = 0; bx + block <= width; bx += block) {
      const first = (by * width + bx) * 4;
      for (let y = by; y < by + block; y += 1) {
        for (let x = bx; x < bx + block; x += 1) {
          const i = (y * width + x) * 4;
          if (data[i] !== data[first] || data[i + 1] !== data[first + 1] || data[i + 2] !== data[first + 2]) {
            nonUniform += 1;
            if (!sample) sample = { x: bx, y: by, values: [[data[first], data[first + 1], data[first + 2]], [data[i], data[i + 1], data[i + 2]]] };
            y = by + block; break;
          }
        }
      }
    }
  }
  return { nonUniform, ...(sample ? { sample } : {}) };
}

export function inkStats(canvas: HTMLCanvasElement, rect: Rect, background: [number, number, number]): { ink: number; colors: Record<string, number> } {
  const data = pixels(canvas), colors: Record<string, number> = {};
  let ink = 0;
  for (let y = Math.max(0, rect.y); y < Math.min(canvas.height, rect.y + rect.height); y += 1) {
    for (let x = Math.max(0, rect.x); x < Math.min(canvas.width, rect.x + rect.width); x += 1) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      if (Math.abs(r - background[0]) <= 12 && Math.abs(g - background[1]) <= 12 && Math.abs(b - background[2]) <= 12) continue;
      ink += 1;
      const key = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
      colors[key] = (colors[key] ?? 0) + 1;
    }
  }
  return { ink, colors };
}

export function dominantColors(canvas: HTMLCanvasElement, rect: Rect): Record<string, number> {
  const data = pixels(canvas), colors: Record<string, number> = {};
  for (let y = Math.max(0, rect.y); y < Math.min(canvas.height, rect.y + rect.height); y += 1) {
    for (let x = Math.max(0, rect.x); x < Math.min(canvas.width, rect.x + rect.width); x += 1) {
      const i = (y * canvas.width + x) * 4;
      const key = `#${[data[i]!, data[i + 1]!, data[i + 2]!].map(v => v.toString(16).padStart(2, '0')).join('')}`;
      colors[key] = (colors[key] ?? 0) + 1;
    }
  }
  return colors;
}

export function toDataUrl(canvas: HTMLCanvasElement): string { return canvas.toDataURL('image/png'); }

/** Inverse of the layer transform, then the trapezoid test — the beam's real shape, computed independently.
 * Drawn cells live on the layer's own (rotated) grid and antialias at the silhouette, so the tolerated
 * band is one device pixel (0.5 stage px at this fixture's 2× mapping).
 */
export function beamOutsideBy(stageX: number, stageY: number): number {
  const rad = SHAFT.rotation * Math.PI / 180, dx = stageX - SHAFT.x, dy = stageY - SHAFT.y;
  const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad), ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);
  if (ly < -0.3 || ly > SHAFT.height + 0.3) return Number.POSITIVE_INFINITY;
  const left = SHAFT.spread / 2 * SHAFT.width * (1 - Math.max(0, Math.min(1, ly / SHAFT.height)));
  return Math.max(0, left - lx, lx - (SHAFT.width - left));
}

export function beamViolations(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number): { changed: number; outside: number; maxOutside: number; sample?: { x: number; y: number } } {
  const height = a.length / 4 / width, stagePerX = STAGE.width / width, stagePerY = STAGE.height / height;
  const tolerance = 0.5;
  let changed = 0, outside = 0, maxOutside = 0, sample: { x: number; y: number } | undefined;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
      changed += 1;
      const distance = beamOutsideBy((x + 0.5) * stagePerX, (y + 0.5) * stagePerY);
      if (distance > maxOutside) maxOutside = distance;
      if (distance > tolerance) { outside += 1; sample ??= { x, y }; }
    }
  }
  return { changed, outside, maxOutside: Number.isFinite(maxOutside) ? Number(maxOutside.toFixed(3)) : maxOutside, ...(sample ? { sample } : {}) };
}

export function contactSheet(frames: { canvas: HTMLCanvasElement; label: string }[], columns = 4): HTMLCanvasElement {
  const cellW = 256, cellH = 144 + 16, rows = Math.ceil(frames.length / columns);
  const sheet = document.createElement('canvas');
  sheet.width = cellW * columns; sheet.height = cellH * rows;
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = '12px monospace';
  frames.forEach((frame, i) => {
    const x = (i % columns) * cellW, y = Math.floor(i / columns) * cellH;
    ctx.drawImage(frame.canvas, x + 4, y + 4, cellW - 8, cellH - 24);
    ctx.fillStyle = '#e6edf3'; ctx.fillText(frame.label, x + 4, y + cellH - 6);
  });
  return sheet;
}

/** Nearest-neighbour zoom of one rect, so small primitives (bubbles, one beam cell) can be judged at real size. */
export function zoom(canvas: HTMLCanvasElement, rect: Rect, factor: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = rect.width * factor; out.height = rect.height * factor;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
  return out;
}
