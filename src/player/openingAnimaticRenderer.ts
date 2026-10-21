import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { parseCssColor, sampleAnimaticTrack, animaticCueVolume, animaticPulseValue, type OpeningAnimatic, type AnimaticLayer, type AnimaticRegionLoop } from '@/project/openingAnimatic';
import type { Project } from '@/project/types';

export type AnimaticImages = Map<string, HTMLImageElement>;

/**
 * 캐릭터 칩 시트의 «맵 배경색»(좌상단 화소)을 투명하게 만든 사본.
 * 런타임 맵은 이 색을 키로 지우는데 오프닝 렌더러는 원본을 그대로 그려, 번들 24×32 배우마다 청록 상자가 붙었다
 * (2026-10-16 run-3 실측: 마을 주민 6명·기사 6명이 모두 색 상자를 쓰고 섰다). 시트에 알파가 이미 있으면 그대로 쓴다.
 */
function keyedCharset(image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const width = image.naturalWidth, height = image.naturalHeight;
  if (!width || !height) return image;
  // RM2000 캐릭터칩 시트 규격(288×256)에만 적용한다 — 아무 스트립이나 색을 지우면 그림이 뽑힌다.
  if (width !== 288 || height !== 256) return image;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  let pixels: ImageData;
  try { pixels = ctx.getImageData(0, 0, width, height); } catch { return image; }
  const data = pixels.data, key = [data[0]!, data[1]!, data[2]!];
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) { hasAlpha = true; break; }
  if (hasAlpha) return image;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === key[0] && data[i + 1] === key[1] && data[i + 2] === key[2]) data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** 시트(charset) 의존은 로딩 뒤에 알 수 있다 — 시트 레이어가 있는 리소스만 키 사본으로 바꿔 둔다. */
const keyedCache = new Map<string, HTMLImageElement | HTMLCanvasElement>();
function charsetSource(id: string, image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const cached = keyedCache.get(id);
  if (cached) return cached;
  const source = keyedCharset(image);
  if (keyedCache.size > 64) keyedCache.clear();
  keyedCache.set(id, source);
  return source;
}
/**
 * 디코드가 끝난 오프닝 그림 캐시. 컷이 바뀔 때 새 캔버스는 그림이 다 읽힐 때까지 검게 비어 있어
 * 큰 배경이 늦게 읽히면 「미디어 불러오는 중」 글자만 뜬 빈 화면이 컷 사이에 끼었다(r12 「첫 20초」).
 * 다음 컷의 그림을 미리 디코드해 두면(warmAnimaticImages) 컷 전환이 바로 그려진다.
 */
const decodedImages = new Map<string, Promise<HTMLImageElement>>();
function decodedImage(url: string): Promise<HTMLImageElement> {
  const cached = decodedImages.get(url);
  if (cached) return cached;
  const image = new Image(); image.crossOrigin = 'anonymous';
  const promise = (async () => { image.src = url; await image.decode(); return image; })();
  promise.catch(() => { if (decodedImages.get(url) === promise) decodedImages.delete(url); });
  if (decodedImages.size >= 24) { const oldest = decodedImages.keys().next().value; if (oldest !== undefined) decodedImages.delete(oldest); }
  decodedImages.set(url, promise);
  return promise;
}
export function warmAnimaticImages(project: Project, a: OpeningAnimatic): void {
  for (const l of a.layers) {
    if (l.kind !== 'image' || !l.resourceId) continue;
    const url = resolveAssetResourceUrl(l.resourceId, { project });
    if (url) void decodedImage(url).catch(() => undefined);
  }
}
export async function loadAnimaticImages(project: Project, a: OpeningAnimatic, signal: AbortSignal): Promise<AnimaticImages> {
  const ids = [...new Set(a.layers.flatMap(l => l.kind === 'image' ? [l.resourceId!] : []))];
  keyedCache.clear();
  return new Map(await Promise.all(ids.map(async id => {
    signal.throwIfAborted(); const url = resolveAssetResourceUrl(id, { project }); if (!url) throw Error(`애니메틱 그림 없음: ${id}`);
    const image = await decodedImage(url); signal.throwIfAborted(); return [id, image] as const;
  })));
}
const radians = (value: number) => value * Math.PI / 180;
const random = (seed: number, index: number) => { let v = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0; v ^= v >>> 16; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13; return (v >>> 0) / 4294967296; };
const modulo = (v: number, span: number) => (v % span + span) % span;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered dithering: sub-pixel alpha becomes an on/off 4×4 cell pattern, never a grey blend. */
const dithered = (alpha: number, x: number, y: number) => (BAYER4[(modulo(y, 4)) * 4 + modulo(x, 4)]! + 0.5) / 16 < alpha;
const DITHER_LEVELS = 17;
const ditherPatterns = new Map<string, HTMLCanvasElement>();
/** 4×4 coverage masks, one per reveal step: the same ordered-dissolve vocabulary used for shot entry. */
function ditherPattern(level: number, color = '#000000'): HTMLCanvasElement {
  const key = `${level}:${color}`;
  const cached = ditherPatterns.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
  const ctx = canvas.getContext('2d')!, data = ctx.createImageData(4, 4), [r, g, b] = parseCssColor(color) ?? [0, 0, 0, 1];
  const threshold = level / (DITHER_LEVELS - 1);
  for (let i = 0; i < 16; i += 1) {
    data.data[i * 4] = r; data.data[i * 4 + 1] = g; data.data[i * 4 + 2] = b;
    data.data[i * 4 + 3] = (BAYER4[i]! + 0.5) / 16 >= threshold ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);
  ditherPatterns.set(key, canvas);
  return canvas;
}
function withAlpha(color: string, alpha: number): string {
  const [r, g, b, a] = parseCssColor(color) ?? [255, 255, 255, 1];
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha * a))})`;
}
const scratch = new Map<string, HTMLCanvasElement>();
function scratchCanvas(key: string, width: number, height: number, frequent = false): HTMLCanvasElement {
  let canvas = scratch.get(key);
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    if (scratch.size > 24) scratch.clear();
    scratch.set(key, canvas);
  }
  const ctx = canvas.getContext('2d', frequent ? { willReadFrequently: true } : undefined)!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  return canvas;
}

function drawText(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number, snapping = 0): void {
  // With a pixelGrid every size is measured in GRID pixels, so a 12px line is 12 low-res pixels (crisp after the
  // integer upscale) instead of 12 stage pixels scaled down to the grid — which landed the glyphs on fractional
  // cells and smeared them. Without a grid the stage pixel is the grid pixel and this is unchanged.
  const style = l.typography, size = (style?.fontSize ?? 40) * (snapping > 0 ? 1 / snapping : 1), align = style?.align ?? 'left';
  ctx.font = `${style?.weight ?? 600} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'top';
  const reveal = style?.typewriterMs ? Math.min(1, Math.max(0, (t - (l.startMs ?? 0)) / style.typewriterMs)) : 1;
  const text = Array.from(l.text ?? ''), shown = text.slice(0, Math.ceil(text.length * reveal)).join('');
  const lines: string[] = [];
  for (const paragraph of shown.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width > l.width && line) { lines.push(line.trimEnd()); line = ''; }
      for (const character of Array.from(word)) {
        if (ctx.measureText(line + character).width > l.width && line) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  const x = align === 'center' ? l.width / 2 : align === 'right' ? l.width : 0;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.88)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
  for (const [i, line] of lines.entries()) { if (i > 0 && (i + 1) * size * 1.25 > l.height) break; ctx.fillText(line, x, i * size * 1.25); }
  ctx.restore();
}
function drawParticles(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number, snapping = 0): void {
  const p = l.particles!, seconds = (t - (l.startMs ?? 0)) / 1000, speed = p.speed ?? (p.preset === 'rain' ? 500 : 35), size = p.size ?? 2;
  const snap = (v: number) => snapping > 0 ? Math.round(v * snapping) / snapping : v;
  const cell = snapping > 0 ? 1 / snapping : 0;
  for (let i = 0; i < p.count; i++) {
    const a = random(p.seed, i * 3), b = random(p.seed, i * 3 + 1), c = random(p.seed, i * 3 + 2);
    const upward = p.preset === 'sparks' || p.preset === 'dust';
    const x = snap(modulo(a * l.width + Math.sin(seconds * 0.8 + c * 9) * (p.preset === 'snow' ? 20 : 4), l.width));
    const y = snap(p.preset === 'stars' ? b * l.height : modulo(b * l.height + seconds * speed * (0.5 + c) * (upward ? -1 : 1), l.height));
    ctx.globalAlpha *= 1;
    if (cell > 0) { ctx.fillRect(x, y, cell, p.preset === 'rain' ? cell * 3 : cell); continue; }
    ctx.beginPath();
    if (p.preset === 'rain') { ctx.moveTo(x, y); ctx.lineTo(x - size * 2, y + size * 8); ctx.lineWidth = size; ctx.stroke(); }
    else { ctx.arc(x, y, size * (0.6 + c), 0, Math.PI * 2); ctx.fill(); }
  }
}

/** The beam's local silhouette: a trapezoid that narrows toward the far end. Dust and soft edges are clipped by it. */
function beamExtent(lx: number, ly: number, width: number, height: number, spread: number): number {
  const inset = spread / 2 * width, left = inset * (1 - Math.max(0, Math.min(1, ly / height)));
  if (lx < left || lx > width - left) return -1;
  return Math.min(lx - left, width - left - lx);
}
function drawShaft(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number, reduced: boolean, snapping = 0): void {
  const shaft = l.shaft ?? {}, width = l.width, height = l.height, spread = shaft.spread ?? 0.6, softness = shaft.softness ?? 0.7;
  const color = l.color ?? '#ffffff', intensity = animaticPulseValue(shaft.pulse, t, l.startMs ?? 0);
  // One drawn cell is one grid pixel in pixelGrid mode, otherwise one stage pixel.
  const cell = snapping > 0 ? 1 / snapping : 1;
  const column = Math.max(cell, Math.round(width / 120 / cell) * cell);
  for (let lx = 0; lx < width; lx += column) {
    for (let ly = 0; ly < height; ly += cell) {
      const depth = beamExtent(lx + column / 2, ly + cell / 2, width, height, spread);
      if (depth < 0) continue;
      const vertical = 1 - 0.85 * (ly / height);
      const edge = softness > 0 ? Math.min(1, depth / Math.max(0.5, softness * width * 0.18)) : 1;
      const alpha = intensity * vertical * edge * 0.85;
      if (alpha <= 0.02) continue;
      // Solid core with a dithered feather at the silhouette, so the beam keeps a pixel-art edge.
      if (alpha < 0.62 && !dithered(alpha, lx / cell, ly / cell)) continue;
      ctx.fillStyle = withAlpha(color, snapping > 0 ? (alpha >= 0.45 ? 0.94 : 0.72) : Math.min(1, alpha * 1.5));
      ctx.fillRect(lx, ly, column, cell);
    }
  }
  if (!shaft.dust) return;
  const dust = shaft.dust, seconds = (reduced ? 0 : t - (l.startMs ?? 0)) / 1000;
  const size = Math.max(cell, Math.round((dust.size ?? 1) / cell) * cell);
  for (let i = 0; i < dust.count; i += 1) {
    const seedA = random(dust.seed, i * 4), seedB = random(dust.seed, i * 4 + 1), seedC = random(dust.seed, i * 4 + 2), seedD = random(dust.seed, i * 4 + 3);
    const ly = Math.floor(modulo(seedB * height + seconds * (dust.speed ?? 20) * (0.4 + seedD), height) / cell) * cell;
    const lx = Math.floor(modulo(seedA * width + Math.sin(seconds * 0.6 + seedC * 7) * width * 0.06, width) / cell) * cell;
    // One drawn cell per beam cell whose centre is comfortably inside the silhouette: the inset keeps the
    // antialiased footprint of a rotated cell from spilling past the mask edge.
    for (let oy = 0; oy < size; oy += cell) for (let ox = 0; ox < size; ox += cell) {
      if (beamExtent(lx + ox + cell / 2, ly + oy + cell / 2, width, height, spread) < 0.75) continue;
      ctx.fillStyle = withAlpha(color, snapping > 0 ? 0.92 : Math.min(1, intensity * (0.35 + seedC * 0.65)));
      ctx.fillRect(lx + ox, ly + oy, cell, cell);
    }
  }
}
function drawGlow(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number): void {
  const glow = l.glow ?? {}, width = l.width, height = l.height, intensity = animaticPulseValue(glow.pulse, t, l.startMs ?? 0);
  const cx = width / 2, cy = height / 2, radius = Math.min(width, height) / 2, inner = Math.max(0.02, glow.inner ?? 0.2);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const color = l.color ?? '#ffffff';
  gradient.addColorStop(0, withAlpha(color, Math.min(1, intensity)));
  gradient.addColorStop(inner, withAlpha(color, Math.min(1, intensity * 0.6)));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height); ctx.restore();
}
/** Grid mode: the halo is an ordered dithered cell field, like the reference's crystal glow — no soft gradient pixels. */
function drawGlowPixel(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number, snapping: number): void {
  const glow = l.glow ?? {}, width = Math.round(l.width), height = Math.round(l.height), intensity = animaticPulseValue(glow.pulse, t, l.startMs ?? 0);
  const cx = width / 2, cy = height / 2, radius = Math.max(1, Math.min(width, height) / 2), inner = Math.max(0.02, glow.inner ?? 0.2), color = l.color ?? '#ffffff';
  const cell = 1 / snapping;
  for (let ly = 0; ly < height; ly += cell) {
    for (let lx = 0; lx < width; lx += cell) {
      const distance = Math.hypot(lx + cell / 2 - cx, ly + cell / 2 - cy) / radius;
      if (distance > 1) continue;
      const falloff = distance <= inner ? 1 : 1 - (distance - inner) / (1 - inner);
      const alpha = intensity * falloff * falloff;
      if (alpha <= 0.04 || !dithered(alpha, lx / cell, ly / cell)) continue;
      ctx.fillStyle = withAlpha(color, snapping > 0 ? (alpha >= 0.4 ? 0.92 : 0.68) : Math.min(1, alpha * 1.4));
      ctx.fillRect(lx, ly, cell, cell);
    }
  }
}

const EMOTE_GLYPHS: Record<string, string[]> = {
  exclaim: ['..###..', '..###..', '..###..', '..###..', '..###..', '.......', '..###..'],
  question: ['.#####.', '##...##', '.....##', '...###.', '...##..', '.......', '...##..'],
  ellipsis: ['.......', '.......', '.......', '.......', '#..#..#'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  sweat: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..'],
};
const EMOTE_GLYPHS_MINI: Record<string, string[]> = {
  exclaim: ['.#.', '.#.', '.#.', '...', '.#.'],
  question: ['###', '..#', '.##', '...', '.#.'],
  ellipsis: ['.....', '.....', '#.#.#'],
  heart: ['#.#.#', '#####', '.###.', '..#..'],
  sweat: ['..#..', '.###.', '#####', '.###.'],
};
function drawEmote(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number, snapping = 0): void {
  const emote = l.emote!, popMs = emote.popMs ?? 180, outMs = emote.outMs ?? 180;
  const start = l.startMs ?? 0, end = l.endMs ?? start;
  const age = t - start, remaining = end - t;
  let scale = 1;
  if (age < popMs) scale = Math.min(1, age / Math.max(1, popMs));
  if (remaining < outMs) scale = Math.min(scale, Math.max(0, remaining / Math.max(1, outMs)));
  if (scale <= 0) return;
  const cell = snapping > 0 ? 1 / snapping : 1;
  const isMini = l.width <= 14 * cell || l.height <= 16 * cell;
  const glyph = (isMini ? EMOTE_GLYPHS_MINI : EMOTE_GLYPHS)[emote.preset]!, columns = glyph[0]!.length;
  const quantize = (value: number) => Math.max(cell, Math.round(value / cell) * cell);
  const maxUnit = snapping > 0 ? (isMini ? cell : 2 * cell) : 8;
  const unit = quantize(Math.max(cell, Math.min(maxUnit, Math.floor(Math.min(l.width / (columns + 2), l.height / (glyph.length + 3))))));
  const gridWidth = columns * unit, gridHeight = glyph.length * unit;
  const bubbleWidth = gridWidth + unit * 3, bubbleHeight = gridHeight + unit * 3;
  const bw = quantize(Math.min(l.width, bubbleWidth) * scale), bh = quantize(Math.min(l.height - (emote.tail !== 'none' ? 2 * unit : 0), bubbleHeight) * scale);
  const originX = Math.round((l.width - bw) / 2 / cell) * cell, originY = 0;
  const ink = emote.preset === 'heart' || emote.preset === 'exclaim' ? '#c83848' : emote.preset === 'question' ? '#3858a8' : '#242a35', border = '#20242c';
  ctx.fillStyle = border; ctx.fillRect(originX, originY, bw, bh);
  if (bw > 2 * cell && bh > 2 * cell) { ctx.fillStyle = '#f4f2f8'; ctx.fillRect(originX + cell, originY + cell, bw - 2 * cell, bh - 2 * cell); }
  const dot = quantize(unit * scale);
  const padX = Math.max(cell, quantize((bw - columns * dot) / 2)), padY = Math.max(cell, quantize((bh - glyph.length * dot) / 2));
  for (const [row, line] of glyph.entries()) {
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== '#') continue;
      ctx.fillStyle = ink;
      ctx.fillRect(quantize(originX + padX + column * dot), quantize(originY + padY + row * dot), dot, dot);
    }
  }
  if (emote.tail !== 'none' && scale > 0.5) {
    const tailX = Math.round(l.width / 2 / cell) * cell;
    const tailY = originY + bh;
    ctx.fillStyle = border;
    ctx.fillRect(tailX - cell, tailY, 3 * cell, cell);
    ctx.fillRect(tailX, tailY + cell, cell, cell);
    ctx.fillStyle = '#f4f2f8';
    ctx.fillRect(tailX, tailY - cell, cell, 2 * cell);
  }
}
function drawCaption(ctx: CanvasRenderingContext2D, a: OpeningAnimatic, l: AnimaticLayer, t: number, durationMs: number | undefined, snapping = 0): void {
  const caption = l.caption!;
  let active: { index: number; cue: (typeof caption.cues)[number] } | undefined;
  for (const [index, cue] of caption.cues.entries()) if (t >= cue.atMs) active = { index, cue };
  if (!active) return;
  const cue = active.cue, next = caption.cues[active.index + 1];
  // A cue holds until the next cue replaces it; only the last cue fades, ending at the layer/shot end.
  const cueEnd = next ? next.atMs : l.endMs ?? durationMs ?? cue.atMs + (caption.fadeOutMs ?? 300);
  const fadeOutMs = next ? 0 : Math.min(caption.fadeOutMs ?? 300, Math.max(0, cueEnd - cue.atMs));
  const alpha = fadeOutMs > 0 ? Math.min(1, Math.max(0, (cueEnd - t) / fadeOutMs)) : 1;
  if (alpha <= 0) return;
  const baseSize = (l.typography?.fontSize ?? 12) * (snapping > 0 ? 1 / snapping : 1), typewriterMs = cue.typewriterMs ?? l.typography?.typewriterMs ?? 0;
  const reveal = typewriterMs > 0 ? Math.min(1, Math.max(0, (t - cue.atMs) / typewriterMs)) : 1;
  const characters = Array.from(cue.text), shown = characters.slice(0, Math.ceil(characters.length * reveal)).join('');
  if (!shown) return;
  const bar = a.letterbox ?? 0, safeArea = caption.safeArea ?? 0.03;
  const align = l.typography?.align ?? 'center';
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${l.typography?.weight ?? 600} ${baseSize}px system-ui, sans-serif`;
  const maxW = Math.max(40, a.width - 12);
  const needsWrap = !cue.text.includes('\n') && ctx.measureText(cue.text).width > maxW;
  const size = needsWrap ? Math.max(9 * (snapping > 0 ? 1 / snapping : 1), Math.round(baseSize * 0.9)) : baseSize;
  ctx.font = `${l.typography?.weight ?? 600} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  let cueColor = cue.color ?? l.color ?? '#ffffff';
  const parsedCue = parseCssColor(cueColor);
  if (parsedCue && parsedCue[3] === 1) {
    const [cr, cg, cb] = parsedCue;
    const lum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
    if (lum < 130) {
      const boost = (150 - lum) / 255;
      const nr = Math.min(255, Math.round(cr + (255 - cr) * Math.min(0.8, boost + 0.28)));
      const ng = Math.min(255, Math.round(cg + (242 - cg) * Math.min(0.7, boost + 0.22)));
      const nb = Math.min(255, Math.round(cb + (242 - cb) * Math.min(0.7, boost + 0.22)));
      cueColor = `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    }
  }
  ctx.fillStyle = cueColor;
  ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
  const x = align === 'center' ? a.width / 2 : align === 'right' ? a.width - size : size;
  if (needsWrap) {
    const mid = Math.floor(cue.text.length / 2);
    let splitAt = -1;
    for (let d = 0; d < cue.text.length; d += 1) {
      if (mid + d < cue.text.length && cue.text[mid + d] === ' ') { splitAt = mid + d; break; }
      if (mid - d >= 0 && cue.text[mid - d] === ' ') { splitAt = mid - d; break; }
    }
    if (splitAt > 0) {
      const lineH = Math.round(size * 1.22);
      const totalH = lineH * 2;
      const y0 = bar > 0
        ? a.height * (1 - bar) + Math.max(1, (a.height * bar - totalH) / 2)
        : a.height * (1 - safeArea) - totalH;
      const line1 = shown.length <= splitAt ? shown : cue.text.slice(0, splitAt);
      const line2 = shown.length > splitAt ? shown.slice(splitAt + 1) : '';
      ctx.fillText(line1, x, y0, maxW);
      if (line2) ctx.fillText(line2, x, y0 + lineH, maxW);
      ctx.restore();
      return;
    }
  }
  const baseline = bar > 0
    ? a.height * (1 - bar) + Math.max(0, (a.height * bar - size) / 2)
    : a.height * (1 - safeArea) - size;
  ctx.fillText(shown, x, baseline, maxW);
  ctx.restore();
}

/** Region loops rewrite only their window: the rest of the source rect stays as authored. */
function drawRegionLoop(ctx: CanvasRenderingContext2D, l: AnimaticLayer, image: CanvasImageSource & { naturalWidth?: number; width: number; height: number }, region: AnimaticRegionLoop, source: { x: number; y: number; width: number; height: number }, at: number, snapping = 0): void {
  const tickMs = region.tickMs ?? 16, every = region.everyTicks ?? 1;
  const step = Math.floor(Math.max(0, at - (l.startMs ?? 0)) / Math.max(1, tickMs * every));
  const patch = scratchCanvas(`region:${l.id}`, region.width, region.height, region.mode === 'palette-cycle');
  const p = patch.getContext('2d', region.mode === 'palette-cycle' ? { willReadFrequently: true } : undefined)!;
  const sx = source.x + region.x, sy = source.y + region.y;
  if (region.mode === 'strip') {
    const frames = region.frames!, index = Math.floor(Math.max(0, at - (l.startMs ?? 0)) * frames.fps / 1000) % frames.count;
    p.drawImage(image, source.x + index * frames.frameWidth, source.y, region.width, region.height, 0, 0, region.width, region.height);
  } else if (region.mode === 'palette-cycle') {
    p.drawImage(image, sx, sy, region.width, region.height, 0, 0, region.width, region.height);
    try {
      const data = p.getImageData(0, 0, region.width, region.height), colors = (region.colors ?? []).map(color => parseCssColor(color) ?? [0, 0, 0, 1]);
      const shift = colors.length ? step % colors.length : 0;
      for (let i = 0; i < data.data.length; i += 4) {
        const from = colors.findIndex(color => Math.abs(color[0]! - data.data[i]!) <= 8 && Math.abs(color[1]! - data.data[i + 1]!) <= 8 && Math.abs(color[2]! - data.data[i + 2]!) <= 8);
        if (from < 0) continue;
        const to = colors[(from + shift) % colors.length]!;
        data.data[i] = to[0]!; data.data[i + 1] = to[1]!; data.data[i + 2] = to[2]!;
      }
      p.putImageData(data, 0, 0);
    } catch { p.drawImage(image, sx, sy, region.width, region.height, 0, 0, region.width, region.height); }
  } else {
    const wrap = region.wrap !== false, distance = (region.pixels ?? 1) * step;
    const isFullWidthHorizon = region.width >= source.width * 0.7 && region.height >= source.height * 0.65;
    if (isFullWidthHorizon && region.mode === 'scroll-x') {
      // Keep full-scene architecture locked 1:1 so background pixels never boil; scroll only the upper sky band (top 22%).
      p.drawImage(image, sx, sy, region.width, region.height, 0, 0, region.width, region.height);
      const skyH = Math.max(8, Math.round(region.height * 0.22));
      const offset = Math.round(modulo(distance, region.width));
      p.save(); p.beginPath(); p.rect(0, 0, region.width, skyH); p.clip();
      if (offset < region.width) {
        p.drawImage(image, sx + offset, sy, region.width - offset, skyH, 0, 0, region.width - offset, skyH);
        if (wrap && offset > 0) p.drawImage(image, sx, sy, offset, skyH, region.width - offset, 0, offset, skyH);
      }
      p.restore();
    } else if (isFullWidthHorizon && region.mode === 'scroll-y') {
      // Keep full-scene architecture locked 1:1; scroll only the top sky band horizontally by 1px steps instead of scaling the whole scene.
      p.drawImage(image, sx, sy, region.width, region.height, 0, 0, region.width, region.height);
      const skyH = Math.max(8, Math.round(region.height * 0.22));
      const offset = Math.round(modulo(distance, region.width));
      p.save(); p.beginPath(); p.rect(0, 0, region.width, skyH); p.clip();
      if (offset < region.width) {
        p.drawImage(image, sx + offset, sy, region.width - offset, skyH, 0, 0, region.width - offset, skyH);
        if (wrap && offset > 0) p.drawImage(image, sx, sy, offset, skyH, region.width - offset, 0, offset, skyH);
      }
      p.restore();
    } else {
      const offset = wrap ? modulo(distance, region.mode === 'scroll-x' ? region.width : region.height) : distance;
      if (region.mode === 'scroll-x') {
        p.save(); p.beginPath(); p.rect(0, 0, region.width, region.height); p.clip();
        if (offset < region.width) {
          p.drawImage(image, sx + offset, sy, region.width - offset, region.height, 0, 0, region.width - offset, region.height);
          if (wrap) p.drawImage(image, sx, sy, offset, region.height, region.width - offset, 0, offset, region.height);
        }
        p.restore();
      } else {
        p.save(); p.beginPath(); p.rect(0, 0, region.width, region.height); p.clip();
        if (offset < region.height) {
          p.drawImage(image, sx, sy + offset, region.width, region.height - offset, 0, 0, region.width, region.height - offset);
          if (wrap) p.drawImage(image, sx, sy, region.width, offset, 0, region.height - offset, region.width, offset);
        }
        p.restore();
      }
    }
  }
  const scaleX = l.width / source.width, scaleY = l.height / source.height;
  const dest = snapping > 0
    ? { x: Math.round(region.x * scaleX * snapping) / snapping, y: Math.round(region.y * scaleY * snapping) / snapping }
    : { x: region.x * scaleX, y: region.y * scaleY };
  ctx.drawImage(patch, 0, 0, region.width, region.height, dest.x, dest.y, region.width * scaleX, region.height * scaleY);
}

/** Stride-matched walk: the pose advances with travelled distance, so the feet never slide. */
function walkFrame(l: AnimaticLayer, at: number): number {
  const walk = l.walk!, count = l.sheet?.count ?? 1;
  if (walk.holdFrame !== undefined && at <= (l.startMs ?? 0)) return walk.holdFrame;
  const dx = sampleAnimaticTrack(l.keys?.x, at, l.x) - sampleAnimaticTrack(l.keys?.x, l.startMs ?? 0, l.x);
  const dy = sampleAnimaticTrack(l.keys?.y, at, l.y) - sampleAnimaticTrack(l.keys?.y, l.startMs ?? 0, l.y);
  const travelled = (Math.abs(dx) >= Math.abs(dy) ? dx * Math.abs(l.scaleX ?? 1) : dy * Math.abs(l.scaleY ?? 1));
  const step = Math.floor(travelled / walk.stride) + Math.round((walk.phase ?? 0) * walk.frames.length);
  const frames = walk.frames.filter(frame => frame < count);
  if (!frames.length) return 0;
  return frames[modulo(step, frames.length)]!;
}

/** Layers that compose after the letterbox board: the bar caption is part of the frame, not the picture. */
const overlayLayer = (l: AnimaticLayer) => l.kind === 'caption';
/** Fixed 4×4×4 family palette: every pixel-grid frame has at most 64 opaque RGB colours. */
type PixelRgb = readonly [number, number, number];
const gridPalettes = new WeakMap<OpeningAnimatic, readonly PixelRgb[]>();
function quantizePixelGrid(canvas: HTMLCanvasElement, composition: OpeningAnimatic): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  let palette = gridPalettes.get(composition);
  if (!palette) {
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const fixed: PixelRgb[] = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 44).map(([key]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255] as const);
    for (const layer of composition.layers) {
      const parsed = layer.color ? parseCssColor(layer.color) : null;
      if (parsed) {
        fixed.push([parsed[0], parsed[1], parsed[2]], [Math.round(parsed[0] * 0.68), Math.round(parsed[1] * 0.68), Math.round(parsed[2] * 0.68)]);
      }
    }
    for (let r = 0; r < 2; r += 1) for (let g = 0; g < 2; g += 1) for (let b = 0; b < 4; b += 1) fixed.push([r * 255, g * 255, b * 85] as const);
    fixed.splice(-3, 3, [192, 80, 80], [80, 192, 80], [80, 80, 192]);
    palette = fixed.slice(0, 64);
    gridPalettes.set(composition, palette);
  }
  const nearest = (r: number, g: number, b: number): readonly [number, number, number] => {
    let best = palette[0] ?? [0, 0, 0], distance = Infinity;
    const inputGreenish = g > Math.max(r, b) + 12;
    for (const color of palette) {
      const greenPenalty = !inputGreenish && color[1] > color[0] + 28 && color[1] > color[2] + 28 ? 18000 : 0;
      const d = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2 + greenPenalty;
      if (d < distance) { distance = d; best = color; if (d === 0) break; }
    }
    return best;
  };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const color = nearest(data[i]!, data[i + 1]!, data[i + 2]!);
    data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
  }
  ctx.putImageData(image, 0, 0);
}

type DrawOptions = { reducedMotion?: boolean; durationMs?: number };
/** The same absolute-time draw function is used for playback, scrubbing and model previews. */
export function drawAnimaticFrame(canvas: HTMLCanvasElement, a: OpeningAnimatic, images: AnimaticImages, atMs: number, options: DrawOptions = {}): void {
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('2D 무대를 만들 수 없습니다.');
  const grid = a.pixelGrid;
  if (!grid) { drawStage(ctx, canvas.width / a.width, canvas.height / a.height, 0, a, images, atMs, options); return; }
  const scene = scratchCanvas(`stage:${grid.width}x${grid.height}`, grid.width, grid.height);
  if (!gridPalettes.has(a)) {
    const paletteAt = Math.min(options.durationMs ?? a.transition?.durationMs ?? 0, (a.transition?.durationMs ?? 0) + 1000);
    drawStage(scene.getContext('2d')!, grid.width / a.width, grid.height / a.height, grid.width / a.width, a, images, paletteAt, options);
    quantizePixelGrid(scene, a);
  }
  drawStage(scene.getContext('2d')!, grid.width / a.width, grid.height / a.height, grid.width / a.width, a, images, atMs, options);
  quantizePixelGrid(scene, a);
  const scale = Math.max(1, Math.floor(Math.min(canvas.width / grid.width, canvas.height / grid.height)));
  const width = grid.width * scale, height = grid.height * scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = a.background ?? '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(scene, Math.round((canvas.width - width) / 2), Math.round((canvas.height - height) / 2), width, height);
}

function drawStage(ctx: CanvasRenderingContext2D, sx: number, sy: number, snapping: number, a: OpeningAnimatic, images: AnimaticImages, atMs: number, options: DrawOptions): void {
  const t = Math.max(0, atMs), c = a.camera, reduced = options.reducedMotion === true;
  const cameraTime = reduced ? 0 : t;
  const snap = (v: number) => snapping > 0 ? Math.round(v * snapping) / snapping : v;
  const snapSize = (v: number) => snapping > 0 ? Math.max(1 / snapping, Math.round(v * snapping) / snapping) : v;
  let cx = sampleAnimaticTrack(c?.keys?.x, cameraTime, c?.x ?? a.width / 2), cy = sampleAnimaticTrack(c?.keys?.y, cameraTime, c?.y ?? a.height / 2);
  if (Math.abs(cx) <= a.width * 0.25) cx += a.width / 2;
  if (Math.abs(cy) <= a.height * 0.25) cy += a.height / 2;
  const zoom = sampleAnimaticTrack(c?.keys?.zoom, cameraTime, c?.zoom ?? 1), rotation = sampleAnimaticTrack(c?.keys?.rotation, cameraTime, c?.rotation ?? 0);
  const shake = c?.shake;
  if (!reduced && shake && t >= shake.atMs && t < shake.atMs + shake.durationMs) {
    const s = (t - shake.atMs) / 1000, decay = 1 - (t - shake.atMs) / shake.durationMs, phase = random(shake.seed ?? 1, 0) * 8;
    cx += Math.sin(s * (shake.frequency ?? 14) * 6.28 + phase) * shake.amplitude * decay;
    cy += Math.cos(s * (shake.frequency ?? 14) * 4.6 + phase) * shake.amplitude * decay;
  }
  cx = snap(cx); cy = snap(cy);
  ctx.save(); try { ctx.setTransform(sx, 0, 0, sy, 0, 0); ctx.clearRect(0, 0, a.width, a.height);
  ctx.fillStyle = a.background ?? '#000000'; ctx.fillRect(0, 0, a.width, a.height);
  const transition = a.transition;
  const reveal = reduced ? 1 : transition?.durationMs
    ? (snapping > 0 ? Math.max(0.28, Math.min(1, (t + 48) / transition.durationMs)) : Math.min(1, t / transition.durationMs))
    : 1;
  ctx.save(); try {
  if (reveal < 1 && transition) {
    if (transition.kind === 'fade' && snapping === 0) ctx.globalAlpha = reveal;
    if (transition.kind === 'wipe-left' || transition.kind === 'wipe-right') { ctx.beginPath(); ctx.rect(transition.kind === 'wipe-left' ? a.width * (1 - reveal) : 0, 0, a.width * reveal, a.height); ctx.clip(); }
    if (transition.kind === 'iris') { ctx.beginPath(); ctx.arc(a.width / 2, a.height / 2, Math.hypot(a.width, a.height) / 2 * reveal, 0, Math.PI * 2); ctx.clip(); }
  }
  for (const l of a.layers) {
    if (overlayLayer(l)) continue;
    if (t < (l.startMs ?? 0) || l.endMs !== undefined && t >= l.endMs) continue;
    const at = reduced ? l.startMs ?? 0 : t, sample = (property: keyof NonNullable<AnimaticLayer['keys']>, fallback: number) => sampleAnimaticTrack(l.keys?.[property], at, fallback);
    const lockGridBg = snapping > 0 && l.role === 'background' && l.kind === 'image' && l.width >= a.width && l.height >= a.height;
    ctx.save(); try {
    if (l.space !== 'screen' && !lockGridBg) { const p = l.parallax ?? 1; ctx.translate(a.width / 2, a.height / 2); ctx.rotate(-radians(rotation * p)); ctx.scale(zoom ** p, zoom ** p); ctx.translate(-(a.width / 2 + (cx - a.width / 2) * p), -(a.height / 2 + (cy - a.height / 2) * p)); }
    const rawX = lockGridBg ? 0 : sample('x', l.x);
    const rawY = lockGridBg ? 0 : sample('y', l.y);
    const effectiveX = l.kind === 'text' && l.typography?.align === 'center' && l.anchorX === undefined && rawX >= a.width * 0.35 && rawX + l.width > a.width
      ? Math.max(0, (a.width - l.width) / 2)
      : rawX;
    ctx.translate(snap(effectiveX), snap(rawY)); ctx.rotate(radians(lockGridBg ? 0 : sample('rotation', l.rotation ?? 0))); ctx.scale(lockGridBg ? 1 : sample('scaleX', l.scaleX ?? 1), lockGridBg ? 1 : sample('scaleY', l.scaleY ?? 1));
    ctx.translate(-l.width * (lockGridBg ? 0 : (l.anchorX ?? 0)), -l.height * (lockGridBg ? 0 : (l.anchorY ?? 0)));
    ctx.globalAlpha *= sampleAnimaticTrack(l.keys?.opacity, t, l.opacity ?? 1); ctx.globalCompositeOperation = l.blend ?? 'source-over'; ctx.fillStyle = l.color ?? '#ffffff'; ctx.strokeStyle = l.color ?? '#ffffff';
    if (l.kind === 'image') {
      ctx.imageSmoothingEnabled = snapping > 0 ? false : (l.sampling ? l.sampling === 'linear' : !l.sheet);
      const image = images.get(l.resourceId!); if (!image) throw Error('그림 로딩 누락: ' + l.resourceId);
      let crop = l.crop;
      const drawSource = l.sheet ? charsetSource(l.resourceId!, image) : image;
      if (l.sheet) {
        const sheet = l.sheet, elapsed = Math.max(0, at - (l.startMs ?? 0)), automatic = Math.floor(elapsed * sheet.fps / 1000);
        const frame = l.walk ? walkFrame(l, at) : Math.floor(sample('frame', sheet.loop ? automatic % sheet.count : Math.min(sheet.count - 1, automatic)));
        crop = { x: frame % sheet.columns * sheet.frameWidth, y: Math.floor(frame / sheet.columns) * sheet.frameHeight, width: sheet.frameWidth, height: sheet.frameHeight };
      }
      if (crop) { if (crop.x + crop.width > image.naturalWidth || crop.y + crop.height > image.naturalHeight) throw Error(`그림 ${l.resourceId}의 crop/프레임이 원본 경계를 넘습니다.`); ctx.drawImage(drawSource, crop.x, crop.y, crop.width, crop.height, 0, 0, snapSize(l.width), snapSize(l.height)); }
      else ctx.drawImage(image, 0, 0, snapSize(l.width), snapSize(l.height));
      if (l.region) drawRegionLoop(ctx, l, drawSource, l.region, crop ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }, at, snapping);
    } else if (l.kind === 'text') drawText(ctx, l, t, snapping);
    else if (l.kind === 'caption') drawCaption(ctx, a, l, t, options.durationMs, snapping);
    else if (l.kind === 'particles') drawParticles(ctx, l, reduced ? 0 : t, snapping);
    else if (l.kind === 'shaft') drawShaft(ctx, l, reduced ? (l.startMs ?? 0) : t, reduced, snapping);
    else if (l.kind === 'glow') { if (snapping > 0) drawGlowPixel(ctx, l, reduced ? (l.startMs ?? 0) : t, snapping); else drawGlow(ctx, l, reduced ? (l.startMs ?? 0) : t); }
    else if (l.kind === 'emote') drawEmote(ctx, l, t, snapping);
    else if (l.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(snapSize(l.width) / 2, snapSize(l.height) / 2, snapSize(l.width) / 2, snapSize(l.height) / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (l.shape === 'line') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(snapSize(l.width), snapSize(l.height)); ctx.stroke(); }
    else ctx.fillRect(0, 0, snapSize(l.width), snapSize(l.height));
    } finally { ctx.restore(); }
  }
  } finally { ctx.restore(); }
  // Dither is an ordered dissolve, not a cross-fade: the stage background covers the cells that have
  // not been revealed yet, so this exposes the incoming shot over the background exactly like fade/wipe.
  if (!reduced && (transition?.kind === 'dither' || (snapping > 0 && transition?.kind === 'fade')) && reveal < 1) {
    const level = Math.max(1, Math.min(DITHER_LEVELS - 1, Math.floor(reveal * DITHER_LEVELS)));
    const pattern = ctx.createPattern(ditherPattern(level, transition.color ?? a.background ?? '#0a0d14'), 'repeat');
    if (pattern) { ctx.imageSmoothingEnabled = false; ctx.fillStyle = pattern; ctx.fillRect(0, 0, a.width, a.height); }
  }
  if (!reduced && transition?.kind === 'flash' && reveal < 1) {
    if (snapping > 0) {
      const level = Math.max(1, Math.min(DITHER_LEVELS - 1, Math.floor((0.35 + reveal * 0.65) * DITHER_LEVELS)));
      const pattern = ctx.createPattern(ditherPattern(level, transition.color ?? '#fff6dc'), 'repeat');
      if (pattern) { ctx.imageSmoothingEnabled = false; ctx.fillStyle = pattern; ctx.globalAlpha = (1 - reveal) * 0.55; ctx.fillRect(0, 0, a.width, a.height); ctx.globalAlpha = 1; }
    } else {
      ctx.fillStyle = transition.color ?? '#ffffff'; ctx.globalAlpha = 1 - reveal; ctx.fillRect(0, 0, a.width, a.height); ctx.globalAlpha = 1;
    }
  }
  if (a.letterbox) { const bar = snapping > 0 ? Math.round(a.height * a.letterbox * snapping) / snapping : a.height * a.letterbox; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, a.width, bar); ctx.fillRect(0, a.height - bar, a.width, bar); }
  for (const l of a.layers) {
    if (!overlayLayer(l) || t < (l.startMs ?? 0) || l.endMs !== undefined && t >= l.endMs) continue;
    ctx.save(); try {
      ctx.globalAlpha *= sampleAnimaticTrack(l.keys?.opacity, t, l.opacity ?? 1); ctx.globalCompositeOperation = l.blend ?? 'source-over';
      if (l.kind === 'caption') {
        drawCaption(ctx, a, l, t, options.durationMs, snapping);
      } else {
        ctx.translate(snap(sampleAnimaticTrack(l.keys?.x, t, l.x)), snap(sampleAnimaticTrack(l.keys?.y, t, l.y)));
        drawCaption(ctx, a, l, t, options.durationMs, snapping);
      }
    } finally { ctx.restore(); }
  }
  } finally { ctx.restore(); }
}

export type AnimaticPlayback = { ready: Promise<void>; stop: () => void };
export function playOpeningAnimatic(options: { project: Project; canvas: HTMLCanvasElement; composition: OpeningAnimatic; durationMs: number; signal: AbortSignal; reducedMotion?: boolean; onReady: () => void; onError: (message: string) => void; onDone: () => void }): AnimaticPlayback {
  const { canvas, composition: a, signal } = options, view = canvas.ownerDocument.defaultView!;
  const draw: DrawOptions = { reducedMotion: options.reducedMotion, durationMs: options.durationMs };
  let frame = 0, stopped = false, started = 0;
  const cues = new Map<string, HTMLAudioElement>();
  const stop = () => { if (stopped) return; stopped = true; view.cancelAnimationFrame(frame); signal.removeEventListener('abort', stop); for (const audio of cues.values()) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio.remove(); } cues.clear(); };
  signal.addEventListener('abort', stop, { once: true });
  const ready = (async () => {
    try {
      const images = await loadAnimaticImages(options.project, a, signal); if (stopped || signal.aborted) return;
      canvas.width = a.width; canvas.height = a.height; drawAnimaticFrame(canvas, a, images, 0, draw);
      started = view.performance.now(); options.onReady();
      const tick = (now: number) => {
        if (stopped || signal.aborted) return;
        const t = Math.min(options.durationMs, now - started); canvas.dataset.timeMs = String(Math.round(t));
        try { drawAnimaticFrame(canvas, a, images, t, draw); }
        catch (error) { stop(); options.onError(String(error)); return; }
        for (const cue of a.audioCues ?? []) {
          let audio = cues.get(cue.id); const active = t >= cue.atMs && t < cue.atMs + cue.durationMs;
          if (active && !audio) {
            const url = resolveAssetResourceUrl(cue.resourceId, { project: options.project }); if (!url) { stop(); options.onError('오디오 큐 없음: ' + cue.resourceId); return; }
            audio = canvas.ownerDocument.createElement('audio'); audio.src = url; audio.loop = cue.loop ?? false; audio.dataset.testid = 'animatic-audio-cue'; audio.dataset.cueId = cue.id; audio.volume = animaticCueVolume(cue, t); canvas.parentElement?.append(audio); cues.set(cue.id, audio);
            audio.addEventListener('loadedmetadata', () => { if (!stopped && audio!.duration > 0 && Number.isFinite(audio!.duration)) { const offset = (cue.offsetMs ?? 0) / 1000 + Math.max(0, view.performance.now() - started - cue.atMs) / 1000; audio!.currentTime = audio!.loop ? offset % audio!.duration : Math.min(offset, audio!.duration); } }, { once: true, signal });
            audio.addEventListener('error', () => { if (!stopped) { stop(); options.onError('오디오 큐 로딩 실패: ' + cue.resourceId); } }, { once: true, signal });
            void audio.play().catch(() => { if (!stopped) { stop(); options.onError('오디오 큐 자동재생 차단: ' + cue.resourceId); } });
          }
          if (audio) { audio.volume = animaticCueVolume(cue, t); if (!active) audio.pause(); }
        }
        if (t >= options.durationMs) { stop(); options.onDone(); } else frame = view.requestAnimationFrame(tick);
      };
      frame = view.requestAnimationFrame(tick);
    } catch (error) { if (!signal.aborted && !stopped) { stop(); options.onError(error instanceof Error ? error.message : String(error)); } }
  })();
  return { ready, stop };
}
