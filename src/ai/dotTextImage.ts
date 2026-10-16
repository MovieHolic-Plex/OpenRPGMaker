import type { GeneratedImageAsset } from "./imageGenerationClient";

/**
 * 도트 그림을 «텍스트 모델이 격자로 찍어» 만드는 공용 생성기(2026-10-16).
 *
 * 이미지 생성 모델은 도트 눈금·팔레트·3/4 시점을 지키지 못한다(src/ai/imageRoute.ts 의 dot-text 갈래).
 * 이 모듈은 그 갈래의 «그림 한 장» 입구다 — 모델에게 {"legend":{"a":"#rrggbb"},"rows":["..aab.."]} 하나만 쓰게 하고,
 * 읽어서 투명 PNG 로 굽는다. 컷신 도트 소품·아이템 도트 아이콘이 쓴다(조수 채팅 도구도 같은 입구다).
 *
 * 이 모듈은 llmClient·캔버스·Node 를 가져오지 않는다(브라우저와 Bun 워커가 같이 쓴다) — 모델 호출은 `DotTextChat` 으로 주입한다.
 * 공방(src/harnesses/_core/workshop)처럼 후보·검수·사람 선택을 거치는 경로가 아니라 «한 번에 한 장» 이다:
 * 새 타일셋·기물 같은 정본 칩셋 그림은 공방 경로(3/4 관문)를 쓰고, 여기는 컷신 소품·아이콘 같은 낱장 그림용이다.
 */

export const DOT_TEXT_PROVIDER_LABEL = "dot-text";
/** 한 장의 격자 긴 변 상한 — 이보다 큰 목표 크기는 정수 배 확대로 맞춘다(모델이 한 변 64줄 넘게 정확히 세지 못한다). */
export const DOT_GRID_MAX_SIDE = 64;
/** 팔레트 색 상한(윤곽·3~4단 명암·강조를 담기에 충분하고, 모델이 색을 지어내 늘리지 못하게 한다). */
export const DOT_MAX_COLORS = 24;
const MAX_FIX_ROUNDS = 2;

export interface DotTextMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface DotTextReply {
  readonly text: string;
  readonly model: string;
  readonly provider: string;
}

/** 텍스트 모델 한 번 호출. 오류는 그대로 던진다. */
export type DotTextChat = (messages: readonly DotTextMessage[], signal?: AbortSignal) => Promise<DotTextReply>;

export interface DotTextImageRequest {
  /** 무엇을 그릴지(영어 권장). 시점·화풍 계약은 호출부가 이 안에 넣는다. */
  readonly prompt: string;
  /** 최종 그림의 긴 변(px). 기본 32. */
  readonly longSidePx?: number;
  readonly signal?: AbortSignal;
}

export type DotTextImage = GeneratedImageAsset & { readonly dot: true; readonly width: number; readonly height: number };

export interface DotCanvasPlan {
  /** 모델이 찍는 정사각 칸의 한 변 */
  readonly box: number;
  /** 최종 그림은 격자를 이 정수 배로 확대한다 */
  readonly factor: number;
}

/** 목표 긴 변 → 모델이 찍을 칸·정수 배율. 64 이하면 1배, 넘으면 칸이 64 이하가 되는 가장 작은 정수 배. */
export function planDotCanvas(longSidePx: number): DotCanvasPlan {
  const target = Math.max(8, Math.round(longSidePx));
  const factor = Math.max(1, Math.ceil(target / DOT_GRID_MAX_SIDE));
  return { box: Math.max(8, Math.round(target / factor)), factor };
}

export function dotSystemPrompt(plan: DotCanvasPlan): string {
  return [
    "You are a pixel artist. You draw ONE small sprite by writing its pixels directly as rows of palette letters.",
    `Canvas: exactly ${plan.box} columns x ${plan.box} rows. Every row string must be exactly ${plan.box} characters long and there must be exactly ${plan.box} rows.`,
    `Palette: choose at most ${DOT_MAX_COLORS} colors yourself and list them in "legend" as {"<one character>":"#rrggbb"}. "." is a transparent pixel and must NOT appear in the legend. Use only letters, digits or symbols other than "." as legend characters.`,
    "Draw the silhouette first with a dark outline, then fill big colour masses, then add 3-4 tone shading per material with light from the upper left. Hard pixels only: no anti-aliasing, no gradients, no dithering noise, no text, no logos, no cast shadow.",
    "The subject must be fully visible, centered, and its longest side should reach the canvas edge. Everything outside the subject is transparent (\".\").",
    'Answer with one JSON object only: {"legend":{"a":"#1b1b2f"},"rows":["....","...."],"note":"one short sentence"}. No code fences, no commentary.',
  ].join("\n");
}

export type ParsedDotGrid =
  | { readonly ok: true; readonly width: number; readonly height: number; readonly rgba: Uint8ClampedArray }
  | { readonly ok: false; readonly error: string };

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON 객체가 없다");
  return JSON.parse(body.slice(start, end + 1));
}

const HEX = /^#([0-9a-f]{6})$/iu;

/** 모델 답 → RGBA 격자. 칸 수·글자·색을 엄격히 확인한다(틀리면 오류 글을 돌려 고치기를 요청한다). */
export function parseDotGrid(text: string, plan: DotCanvasPlan): ParsedDotGrid {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (error) {
    return { ok: false, error: `답을 JSON 으로 읽지 못했다: ${error instanceof Error ? error.message : String(error)}` };
  }
  const { legend, rows } = (raw ?? {}) as { legend?: unknown; rows?: unknown };
  if (!legend || typeof legend !== "object" || Array.isArray(legend)) return { ok: false, error: "legend 가 객체가 아니다" };
  if (!Array.isArray(rows) || rows.some((row) => typeof row !== "string")) return { ok: false, error: "rows 가 글자열 배열이 아니다" };
  const colors = new Map<string, readonly [number, number, number]>();
  for (const [char, value] of Object.entries(legend as Record<string, unknown>)) {
    if ([...char].length !== 1) return { ok: false, error: `legend 의 글자 「${char}」는 한 글자가 아니다` };
    if (char === ".") return { ok: false, error: "「.」은 투명 칸이라 legend 에 쓸 수 없다" };
    const hex = typeof value === "string" ? HEX.exec(value.trim()) : null;
    if (!hex) return { ok: false, error: `legend 「${char}」의 색 ${String(value)} 은 #rrggbb 가 아니다` };
    const n = Number.parseInt(hex[1]!, 16);
    colors.set(char, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  if (colors.size > DOT_MAX_COLORS) return { ok: false, error: `색이 ${colors.size}개다 — ${DOT_MAX_COLORS}개 이하로 줄여라` };
  const lines = (rows as string[]).filter((row) => row.length > 0);
  if (lines.length !== plan.box) return { ok: false, error: `rows 가 ${lines.length}줄이다 — 정확히 ${plan.box}줄이어야 한다` };
  const data = new Uint8ClampedArray(plan.box * plan.box * 4);
  for (let y = 0; y < lines.length; y += 1) {
    const chars = [...lines[y]!];
    if (chars.length !== plan.box) return { ok: false, error: `rows[${y}] 길이 ${chars.length} — ${plan.box}글자여야 한다` };
    for (let x = 0; x < plan.box; x += 1) {
      const char = chars[x]!;
      if (char === ".") continue;
      const color = colors.get(char);
      if (!color) return { ok: false, error: `rows[${y}][${x}] 글자 「${char}」가 legend 에 없다` };
      data.set([color[0], color[1], color[2], 255], (y * plan.box + x) * 4);
    }
  }
  return { ok: true, width: plan.box, height: plan.box, rgba: data };
}

/** 칠한 화소의 경계로 자른다(여백 제거). 비었으면 null. */
export function cropOpaque(width: number, height: number, rgba: Uint8ClampedArray): { width: number; height: number; rgba: Uint8ClampedArray } | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) out.set(rgba.subarray(((y0 + y) * width + x0) * 4, ((y0 + y) * width + x0 + w) * 4), y * w * 4);
  return { width: w, height: h, rgba: out };
}

export function scaleNearest(width: number, height: number, rgba: Uint8ClampedArray, factor: number): { width: number; height: number; rgba: Uint8ClampedArray } {
  if (factor <= 1) return { width, height, rgba };
  const w = width * factor, h = height * factor;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < w; x += 1) out.set(rgba.subarray((sy * width + Math.floor(x / factor)) * 4, (sy * width + Math.floor(x / factor)) * 4 + 4), (y * w + x) * 4);
  }
  return { width: w, height: h, rgba: out };
}

// ── PNG 인코더(무압축 deflate) — 캔버스·Node 없이 브라우저와 Bun 이 같이 쓴다 ────────────────────────────
let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0;
  for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export function encodePngRgba(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  const stride = 1 + width * 4;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
  // zlib: 헤더 78 01 + 저장 블록(최대 65535바이트씩) + adler32
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  zlib[0] = 0x78; zlib[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i += 1) {
    const part = raw.subarray(i * 65535, Math.min(raw.length, (i + 1) * 65535));
    zlib[at++] = i === blocks - 1 ? 1 : 0;
    zlib[at++] = part.length & 255; zlib[at++] = part.length >>> 8;
    zlib[at++] = ~part.length & 255; zlib[at++] = (~part.length >>> 8) & 255;
    zlib.set(part, at); at += part.length;
  }
  new DataView(zlib.buffer).setUint32(at, adler32(raw));
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height);
  header[8] = 8; header[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib), chunk("IEND", new Uint8Array())];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { png.set(part, offset); offset += part.length; }
  return png;
}

export function pngDataUrl(width: number, height: number, rgba: Uint8ClampedArray): string {
  const bytes = encodePngRgba(width, height, rgba);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

export class DotTextImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DotTextImageError";
  }
}

/**
 * 텍스트 모델에게 격자를 찍게 해 투명 PNG 한 장을 만든다. 깨진 답은 오류 글을 돌려 최대 2번 고치게 한다.
 * 끝까지 깨지면 DotTextImageError — 호출부가 사용자에게 그대로 알린다(다른 모델·이미지 모델로 몰래 대체하지 않는다).
 */
export async function generateDotTextImage(request: DotTextImageRequest, chat: DotTextChat): Promise<DotTextImage> {
  const brief = request.prompt.trim();
  if (!brief) throw new DotTextImageError("그림 설명(prompt)이 비어 있습니다.");
  const plan = planDotCanvas(request.longSidePx ?? 32);
  const messages: DotTextMessage[] = [
    { role: "system", content: dotSystemPrompt(plan) },
    { role: "user", content: `Draw this sprite: ${brief}` },
  ];
  let lastError = "";
  let reply: DotTextReply | undefined;
  for (let round = 0; round <= MAX_FIX_ROUNDS; round += 1) {
    request.signal?.throwIfAborted();
    reply = await chat(messages, request.signal);
    const parsed = parseDotGrid(reply.text, plan);
    if (parsed.ok) {
      const cropped = cropOpaque(parsed.width, parsed.height, parsed.rgba);
      if (!cropped) { lastError = "칠한 화소가 하나도 없다 — 그림을 그려라"; }
      else {
        const scaled = scaleNearest(cropped.width, cropped.height, cropped.rgba, plan.factor);
        return {
          dataUrl: pngDataUrl(scaled.width, scaled.height, scaled.rgba),
          mimeType: "image/png",
          model: reply.model,
          provider: reply.provider,
          dot: true,
          width: scaled.width,
          height: scaled.height,
        };
      }
    } else lastError = parsed.error;
    messages.push(
      { role: "assistant", content: reply.text },
      { role: "user", content: `답을 쓸 수 없다: ${lastError}\n같은 JSON 형식으로 전체 격자를 다시 내라. 캔버스는 ${plan.box}x${plan.box} 이다.` },
    );
  }
  throw new DotTextImageError(`도트 저작 모델이 쓸 수 있는 격자를 내지 못했습니다: ${lastError}`);
}
