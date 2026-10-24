// 보이는 필드 적의 맵 그림 — 걷기 칩이 없는 적은 **전투 도트 그림에서 런타임에 필드 칩을 뽑는다**.
//
// 예전에는 전투 그림(64px 한 장)을 2칸 상자에 줄여 그대로 세웠다: 정지 그림·방향 없음·그림자 없음이라
// 맵 위에서 스티커처럼 미끄러졌고, 반대로 걸으면 뒷걸음질했다(2026-10-24 사용자 「정말 별로」, 비교 viz
// field-foes-1.html 에서 사용자가 A 를 골랐다). 지금 규칙:
//   - 원본 = 전투에서 보이는 그 그림(같은 텍스처). 새로 그린 그림이 아니라 정수배 축소 파생이다.
//   - 크기 = 정확히 1/2(64px 칸 → 32px, 약 2칸). 128px 칸이면 1/4, 32px 이하는 그대로 — 칸 크기 / 32 를 반올림한 정수배로 나눈다. 블록 최빈색 풀링.
//   - 어두운 1px 외곽선 + 바깥 1px 밝은 테(어두운 숲 바닥에서 떼어 낸다) + 바닥 그림자.
//   - 칩 규약(행 위·오른쪽·아래·왼쪽, 열 3)을 그대로 따르므로 기존 걷기·제자리걸음·방향 처리가 손대지 않고 돈다.
//     오른쪽 = 원본 방향, 왼쪽 = 좌우 반전. 위·아래는 측면 그림뿐이라 위 = 오른쪽, 아래 = 왼쪽 그림을 쓴다.
//   - 열 0 = 1px 눌림, 열 1 = 기본, 열 2 = 1px 들림(걸음·제자리걸음 때 통통 튀는 움직임).
// 이벤트가 걷기 칩(charset)을 직접 지정했으면 이 경로를 타지 않는다 — 손으로 찍은 필드 칩이 언제나 이긴다.
// 캔버스가 오염되어(file:// 그림) 화소를 못 읽으면 예전 정지 그림으로 떨어진다.
import type Phaser from "phaser";
import { CHARSET_DIRECTIONS, charsetFrameIndex } from "@/assets/easyrpgRtp";

export const DERIVED_FIELD_FOE_PREFIX = "__oprn_field_foe:";
const TARGET = 32;
/** 프레임 안 여백: 외곽선 1 + 밝은 테 1 (양쪽), 아래는 그림자 몫 3, 위는 들림 몫 1. */
const PAD = 2;
const FOOT = 3;
const LIFT = 1;

export function isDerivedFieldFoeTextureKey(key: string): boolean {
  return key.startsWith(DERIVED_FIELD_FOE_PREFIX);
}

export function derivedFieldFoeTextureKey(sourceKey: string): string {
  return `${DERIVED_FIELD_FOE_PREFIX}${sourceKey}`;
}

/** 아래를 보고 선 기본 프레임(칩 규약: 0번 캐릭터, 아래, 열 1). */
export const DERIVED_FIELD_FOE_BASE_FRAME = charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 });

type Rgba = readonly [number, number, number, number];
type Pixels = { readonly w: number; readonly h: number; readonly data: Uint8ClampedArray };

const failed = new Set<string>();

/** 전투 그림 텍스처에서 필드 칩 텍스처를 만들어(한 번) 그 키를 돌려준다. 원본이 아직 없거나 화소를 못 읽으면 undefined. */
export function ensureDerivedFieldFoeTexture(scene: { readonly textures?: unknown }, sourceKey: string): string | undefined {
  // 테스트용 가짜 장면·부분 텍스처 관리자에서는 조용히 정지 그림으로 둔다.
  const textures = scene.textures as Partial<Phaser.Textures.TextureManager> | undefined;
  if (!textures?.exists || !textures.get || !textures.addCanvas || typeof document === "undefined") return undefined;
  const key = derivedFieldFoeTextureKey(sourceKey);
  if (textures.exists(key)) return key;
  if (failed.has(sourceKey) || !textures.exists(sourceKey)) return undefined;
  try {
    const source = textures.get(sourceKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const sheet = deriveFieldFoeSheet(readPixels(source));
    if (!sheet) { failed.add(sourceKey); return undefined; }
    const canvas = document.createElement("canvas");
    canvas.width = sheet.w;
    canvas.height = sheet.h;
    canvas.getContext("2d")!.putImageData(new ImageData(sheet.data, sheet.w, sheet.h), 0, 0);
    const texture = textures.addCanvas(key, canvas);
    if (!texture) { failed.add(sourceKey); return undefined; }
    texture.setFilter(1 as Phaser.Textures.FilterMode); // NEAREST
    for (let row = 0; row < CHARSET_DIRECTIONS.length; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        texture.add(charsetFrameIndex({ characterIndex: 0, direction: CHARSET_DIRECTIONS[row]!, pattern: col }), 0,
          col * sheet.frameW, row * sheet.frameH, sheet.frameW, sheet.frameH);
      }
    }
    return key;
  } catch {
    failed.add(sourceKey);
    return undefined;
  }
}

function readPixels(source: CanvasImageSource & { width: number; height: number }): Pixels {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  return { w: canvas.width, h: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
}

/** 순수 함수(테스트용): RGBA 화소 → 3열×4행 칩 시트. 불투명 화소가 없으면 null. */
export function deriveFieldFoeSheet(src: Pixels): (Pixels & { frameW: number; frameH: number }) | null {
  const box = opaqueBox(src);
  if (!box) return null;
  // 배율은 그림 칸 크기로 정한다(64px 칸 → 정확히 1/2). 몸 상자로 정하면 작은 종(거미 47px)이 축소되지 않아 종마다 크기가 뒤섞인다.
  const factor = Math.max(1, Math.round(Math.max(src.w, src.h) / TARGET));
  const body = outline(pool(src, box, factor));
  const frameW = body.w + 0;
  const frameH = body.h + FOOT + LIFT;
  const w = frameW * 3;
  const h = frameH * 4;
  const out = new Uint8ClampedArray(w * h * 4);
  const mirrored = flip(body);
  const squashed = [body, mirrored].map(squash);
  for (let row = 0; row < CHARSET_DIRECTIONS.length; row += 1) {
    const dir = CHARSET_DIRECTIONS[row];
    const faceLeft = dir === "left" || dir === "down";
    for (let col = 0; col < 3; col += 1) {
      const sprite = col === 0 ? squashed[faceLeft ? 1 : 0]! : faceLeft ? mirrored : body;
      const ox = col * frameW;
      const oy = row * frameH;
      shadow(out, w, ox, oy + frameH - 2, frameW, Math.max(8, Math.round((body.w - PAD * 2) * 0.8)));
      const lift = col === 2 ? LIFT : 0;
      blit(out, w, sprite, ox + Math.floor((frameW - sprite.w) / 2), oy + frameH - FOOT - sprite.h + (FOOT - 1) - lift);
    }
  }
  return { w, h, data: out, frameW, frameH };
}

function opaqueBox(src: Pixels): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = src.w, y0 = src.h, x1 = -1, y1 = -1;
  for (let y = 0; y < src.h; y += 1) for (let x = 0; x < src.w; x += 1) {
    if (src.data[(y * src.w + x) * 4 + 3]! > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** 정수배 블록 최빈색. 동률이면 밝은 쪽 — 1/2 축소에서 그림 자신의 어두운 선이 몸을 삼키지 않게. */
function pool(src: Pixels, box: { x0: number; y0: number; x1: number; y1: number }, f: number): Pixels {
  const w = Math.ceil((box.x1 - box.x0) / f);
  const h = Math.ceil((box.y1 - box.y0) / f);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let ty = 0; ty < h; ty += 1) for (let tx = 0; tx < w; tx += 1) {
    const counts = new Map<number, number>();
    let total = 0;
    for (let dy = 0; dy < f; dy += 1) for (let dx = 0; dx < f; dx += 1) {
      const x = box.x0 + tx * f + dx, y = box.y0 + ty * f + dy;
      if (x >= box.x1 || y >= box.y1) continue;
      total += 1;
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3]! <= 128) continue;
      const rgb = (src.data[i]! << 16) | (src.data[i + 1]! << 8) | src.data[i + 2]!;
      counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
    }
    let opaque = 0;
    let best = -1, bestN = 0;
    for (const [rgb, n] of counts) {
      opaque += n;
      if (n > bestN || (n === bestN && luma(rgb) > luma(best))) { best = rgb; bestN = n; }
    }
    if (!total || opaque / total < 0.38) continue;
    const o = (ty * w + tx) * 4;
    data[o] = best >> 16; data[o + 1] = (best >> 8) & 255; data[o + 2] = best & 255; data[o + 3] = 255;
  }
  return { w, h, data };
}

const luma = (rgb: number): number => rgb < 0 ? -1 : ((rgb >> 16) * 3 + ((rgb >> 8) & 255) * 6 + (rgb & 255));

/** 어두운 1px 외곽선(그림의 가장 어두운 색) + 그 바깥 1px 밝은 테(반투명). 크기 +PAD*2. */
function outline(img: Pixels): Pixels {
  let dark: Rgba = [20, 20, 24, 255];
  let darkest = Infinity;
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    const l = img.data[i]! * 3 + img.data[i + 1]! * 6 + img.data[i + 2]!;
    if (l < darkest) { darkest = l; dark = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, 255]; }
  }
  const line: Rgba = [Math.round(dark[0] * 0.8), Math.round(dark[1] * 0.8), Math.round(dark[2] * 0.8), 235];
  const rim: Rgba = [236, 240, 226, 120];
  let cur = pad(img, 1);
  cur = ring(cur, line);
  cur = ring(pad(cur, 1), rim);
  return cur;
}

function pad(img: Pixels, n: number): Pixels {
  const w = img.w + n * 2, h = img.h + n * 2;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < img.h; y += 1) data.set(img.data.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((y + n) * w + n) * 4);
  return { w, h, data };
}

function ring(img: Pixels, colour: Rgba): Pixels {
  const data = new Uint8ClampedArray(img.data);
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3]! > 0;
  for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) {
    if (solid(x, y)) continue;
    if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) data.set(colour, (y * img.w + x) * 4);
  }
  return { w: img.w, h: img.h, data };
}

function flip(img: Pixels): Pixels {
  const data = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) {
    data.set(img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4);
  }
  return { w: img.w, h: img.h, data };
}

/** 1px 눌림: 몸 가운데 줄 하나를 빼고 아래(발)는 그대로 둔다. */
function squash(img: Pixels): Pixels {
  const drop = Math.floor(img.h / 2);
  const h = img.h - 1;
  const data = new Uint8ClampedArray(img.w * h * 4);
  for (let y = 0, sy = 0; sy < img.h; sy += 1) {
    if (sy === drop) continue;
    data.set(img.data.subarray(sy * img.w * 4, (sy + 1) * img.w * 4), y * img.w * 4);
    y += 1;
  }
  return { w: img.w, h, data };
}

function blit(out: Uint8ClampedArray, outW: number, img: Pixels, ox: number, oy: number): void {
  for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) {
    const s = (y * img.w + x) * 4;
    const a = img.data[s + 3]!;
    if (!a) continue;
    const d = ((oy + y) * outW + ox + x) * 4;
    if (oy + y < 0 || d < 0 || d >= out.length) continue;
    if (a === 255 || !out[d + 3]) { out.set(img.data.subarray(s, s + 4), d); continue; }
    const k = a / 255;
    for (let c = 0; c < 3; c += 1) out[d + c] = Math.round(img.data[s + c]! * k + out[d + c]! * (1 - k));
    out[d + 3] = Math.max(out[d + 3]!, a);
  }
}

/** 두 단 알파의 바닥 타원(도트 결에 맞춘 그림자). */
function shadow(out: Uint8ClampedArray, outW: number, frameX: number, cy: number, frameW: number, width: number): void {
  const cx = frameX + frameW / 2;
  const rx = width / 2, ry = 2.2;
  for (let y = cy - 3; y <= cy + 3; y += 1) for (let x = frameX; x < frameX + frameW; x += 1) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d > 1) continue;
    const i = (y * outW + x) * 4;
    if (i < 0 || i >= out.length) continue;
    out[i] = 12; out[i + 1] = 18; out[i + 2] = 10; out[i + 3] = d < 0.55 ? 96 : 48;
  }
}
