// player/titleEffects/renderer.ts
// 타이틀 영역 효과 렌더러 — 배경 그림 한 장 + 효과 목록 → WebGL2 canvas.
//
// 계약(titleParticles 와 같다):
//  - 그림은 시각 t 의 순수 함수다. 같은 (효과, 그림, t) → 같은 프레임.
//  - WebGL2 가 없거나(fakeDom·구형 GPU) 셰이더 컴파일이 실패하면 canvas 는 투명하게 남고
//    CSS 배경(applyTitleScreenBackground)이 그대로 보인다. 예외를 던지지 않는다.
//    어느 쪽인지는 dataset.titleEffectsRenderer("webgl" | "unavailable")로 남긴다.
//  - prefers-reduced-motion: reduce 면 t=0 한 장만 그리고 애니메이션하지 않는다.
//  - rAF 는 canvas 가 DOM 에서 분리되면 다음 프레임에 스스로 해제된다.

import type { TitleBackgroundFit, TitleEffect } from "@/project/types";
import { TITLE_EFFECT_DEFAULT_COLORS, activeTitleEffects } from "@/project/titleEffects";
import {
  TITLE_EFFECT_FRAGMENT_SHADER,
  TITLE_EFFECT_SHADER_KIND,
  TITLE_EFFECT_SHADER_MAX_EFFECTS,
  TITLE_EFFECT_SHADER_MAX_MOTES,
  TITLE_EFFECT_SHADER_MAX_POINTS,
  TITLE_EFFECT_VERTEX_SHADER,
} from "@/player/titleEffects/shader";

/** 캔버스 긴 변 상한(px) — 4K 창에서도 조각 셰이더 비용을 묶는다. */
export const TITLE_EFFECTS_MAX_CANVAS_EDGE = 1920;

const DEFAULT_SPREAD: Partial<Record<TitleEffect["kind"], number>> = { godRays: 0.19, motes: 0.28, glow: 0.08 };

/** 셰이더 uniform 으로 넘길 평탄 배열. 순수 함수 — 테스트는 이것만 본다. */
export interface TitleEffectUniforms {
  count: number;
  kind: Int32Array;
  a: Float32Array;
  b: Float32Array;
  color: Float32Array;
  ptsN: Int32Array;
  pts: Float32Array;
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/iu.exec(hex);
  if (!match) return [1, 1, 1];
  const value = Number.parseInt(match[1]!, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function encodeTitleEffectUniforms(effects: readonly TitleEffect[] | undefined): TitleEffectUniforms {
  const max = TITLE_EFFECT_SHADER_MAX_EFFECTS;
  const out: TitleEffectUniforms = {
    count: 0,
    kind: new Int32Array(max).fill(TITLE_EFFECT_SHADER_KIND.none),
    a: new Float32Array(max * 4),
    b: new Float32Array(max * 4),
    color: new Float32Array(max * 3),
    ptsN: new Int32Array(max),
    pts: new Float32Array(max * TITLE_EFFECT_SHADER_MAX_POINTS * 2),
  };
  let slot = 0;
  for (const effect of activeTitleEffects(effects ? [...effects] : undefined)) {
    if (slot >= max) break;
    const kindId = shaderKind(effect);
    if (kindId === TITLE_EFFECT_SHADER_KIND.none) continue;
    out.kind[slot] = kindId;
    const [ax, ay, bx, by] = effectAnchors(effect);
    out.a.set([ax, ay, bx, by], slot * 4);
    const spread = effect.kind === "glint" ? effect.periodSec ?? 5 : effect.spread ?? DEFAULT_SPREAD[effect.kind] ?? 0.2;
    const count = Math.min(TITLE_EFFECT_SHADER_MAX_MOTES, Math.max(0, Math.round(effect.count ?? 60)));
    out.b.set([effect.intensity ?? 1, effect.speed ?? 1, spread, count], slot * 4);
    out.color.set(hexToRgb(effect.color ?? TITLE_EFFECT_DEFAULT_COLORS[effect.kind]), slot * 3);
    const region = effect.region ?? [];
    out.ptsN[slot] = Math.min(region.length, TITLE_EFFECT_SHADER_MAX_POINTS);
    region.slice(0, TITLE_EFFECT_SHADER_MAX_POINTS).forEach(([x, y], index) => {
      out.pts.set([x, y], (slot * TITLE_EFFECT_SHADER_MAX_POINTS + index) * 2);
    });
    slot += 1;
  }
  out.count = slot;
  return out;
}

function shaderKind(effect: TitleEffect): number {
  switch (effect.kind) {
    case "godRays":
      return effect.source && effect.toward ? TITLE_EFFECT_SHADER_KIND.godRays : TITLE_EFFECT_SHADER_KIND.none;
    case "motes":
      if (effect.source && effect.toward) return TITLE_EFFECT_SHADER_KIND.motes;
      return effect.region ? TITLE_EFFECT_SHADER_KIND.motesRegion : TITLE_EFFECT_SHADER_KIND.none;
    case "glint":
      return effect.line ? TITLE_EFFECT_SHADER_KIND.glint : TITLE_EFFECT_SHADER_KIND.none;
    case "water":
    case "mist":
    case "dapple":
      return effect.region ? TITLE_EFFECT_SHADER_KIND[effect.kind] : TITLE_EFFECT_SHADER_KIND.none;
    case "glow":
      return effect.source ? TITLE_EFFECT_SHADER_KIND.glow : TITLE_EFFECT_SHADER_KIND.none;
    case "camera":
      return TITLE_EFFECT_SHADER_KIND.camera;
    default:
      return TITLE_EFFECT_SHADER_KIND.none;
  }
}

/** uA 에 들어갈 두 점. 영역형 반딧불은 영역의 외접 상자를 넘긴다. */
function effectAnchors(effect: TitleEffect): [number, number, number, number] {
  if (effect.kind === "glint" && effect.line) return [...effect.line[0], ...effect.line[1]];
  if (effect.source && effect.toward) return [...effect.source, ...effect.toward];
  if (effect.source) return [...effect.source, ...effect.source];
  if (effect.region && effect.region.length) {
    const xs = effect.region.map((point) => point[0]);
    const ys = effect.region.map((point) => point[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return [0.5, 0.5, 0.5, 0.5];
}

const FIT_ID: Record<TitleBackgroundFit, number> = { cover: 0, contain: 1, stretch: 2 };

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

export interface TitleEffectsCanvasOptions {
  readonly effects: readonly TitleEffect[];
  readonly imageUrl: string;
  /** 생략 = "stretch" — 배경(applyTitleScreenBackground)의 기본과 같아야 효과를 켜도 그림이 안 움직인다. */
  readonly fit?: TitleBackgroundFit;
  /** 고정 시각(초). 주면 애니메이션하지 않고 그 순간만 그린다(QA·미리보기 썸네일). */
  readonly freezeAtSec?: number;
}

type RendererHandle = { frame: number; stop: () => void };
const running = new WeakMap<HTMLCanvasElement, RendererHandle>();
/** 살아 있는 캔버스의 효과 값만 바꾸는 함수 — 편집기 드래그·슬라이더가 WebGL 문맥을 새로 만들지 않게. */
const uniformSetters = new WeakMap<HTMLCanvasElement, (uniforms: TitleEffectUniforms) => void>();

/**
 * 이미 그리고 있는 효과 캔버스의 효과 값만 바꾼다(그림·맞춤은 그대로).
 * 캔버스가 이 렌더러 것이 아니거나 WebGL 을 못 쓰면 false — 호출자가 새로 만든다.
 */
export function updateTitleEffectsCanvas(canvas: HTMLCanvasElement, effects: readonly TitleEffect[]): boolean {
  const setter = uniformSetters.get(canvas);
  if (!setter) return false;
  const uniforms = encodeTitleEffectUniforms(effects);
  canvas.dataset.titleEffectsCount = String(uniforms.count);
  setter(uniforms);
  return true;
}

/** 효과 캔버스를 만든다. 그림을 불러오면 스스로 그리기 시작한다. */
export function createTitleEffectsCanvas(options: TitleEffectsCanvasOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "rm-title-effects";
  canvas.dataset.testid = "title-effects";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.titleEffectsRenderer = "pending";
  const uniforms = encodeTitleEffectUniforms(options.effects);
  canvas.dataset.titleEffectsCount = String(uniforms.count);
  startTitleEffects(canvas, uniforms, options);
  return canvas;
}

export function stopTitleEffects(canvas: HTMLCanvasElement): void {
  running.get(canvas)?.stop();
  running.delete(canvas);
}

function startTitleEffects(canvas: HTMLCanvasElement, initialUniforms: TitleEffectUniforms, options: TitleEffectsCanvasOptions): void {
  let uniforms = initialUniforms;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: true, antialias: false }) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) {
    canvas.dataset.titleEffectsRenderer = "unavailable";
    return;
  }
  const program = buildProgram(gl);
  if (!program) {
    canvas.dataset.titleEffectsRenderer = "unavailable";
    return;
  }
  const context = gl;
  // 그림을 불러오기 전에 들어온 값은 보관했다가 onload 가 쓴다.
  uniformSetters.set(canvas, (next) => {
    uniforms = next;
  });
  const image = new Image();
  image.decoding = "async";
  image.onerror = () => {
    canvas.dataset.titleEffectsRenderer = "unavailable";
  };
  image.onload = () => {
    const texture = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    try {
      context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image);
    } catch {
      canvas.dataset.titleEffectsRenderer = "unavailable";
      return;
    }
    canvas.dataset.titleEffectsRenderer = "webgl";
    const location = (name: string) => context.getUniformLocation(program, name);
    const loc = {
      time: location("uTime"),
      canvas: location("uCanvas"),
      imageSize: location("uImageSize"),
      fit: location("uFit"),
      count: location("uCount"),
      kind: location("uKind"),
      a: location("uA"),
      b: location("uB"),
      color: location("uColor"),
      ptsN: location("uPtsN"),
      pts: location("uPts"),
      image: location("uImage"),
    };
    context.useProgram(program);
    context.uniform1i(loc.image, 0);
    context.uniform2f(loc.imageSize, image.naturalWidth || 1, image.naturalHeight || 1);
    context.uniform1i(loc.fit, FIT_ID[options.fit ?? "stretch"]);
    const applyUniforms = (): void => {
      context.uniform1i(loc.count, uniforms.count);
      context.uniform1iv(loc.kind, uniforms.kind);
      context.uniform4fv(loc.a, uniforms.a);
      context.uniform4fv(loc.b, uniforms.b);
      context.uniform3fv(loc.color, uniforms.color);
      context.uniform1iv(loc.ptsN, uniforms.ptsN);
      context.uniform2fv(loc.pts, uniforms.pts);
    };
    applyUniforms();

    const draw = (seconds: number) => {
      resizeCanvas(canvas, context);
      context.uniform2f(loc.canvas, canvas.width, canvas.height);
      context.uniform1f(loc.time, seconds);
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    };
    const frozen = typeof options.freezeAtSec === "number" ? options.freezeAtSec : prefersReducedMotion() ? 0 : undefined;
    let lastSeconds = frozen ?? 0;
    uniformSetters.set(canvas, (next) => {
      uniforms = next;
      applyUniforms();
      if (frozen !== undefined || typeof requestAnimationFrame !== "function") draw(lastSeconds);
    });
    if (frozen !== undefined || typeof requestAnimationFrame !== "function") {
      draw(lastSeconds);
      canvas.dataset.titleEffectsAnimated = "false";
      return;
    }
    canvas.dataset.titleEffectsAnimated = "true";
    const started = nowMs();
    const handle: RendererHandle = {
      frame: 0,
      stop: () => cancelAnimationFrame(handle.frame),
    };
    const tick = () => {
      if (!canvas.isConnected) {
        running.delete(canvas);
        uniformSetters.delete(canvas);
        context.getExtension("WEBGL_lose_context")?.loseContext();
        return;
      }
      lastSeconds = (nowMs() - started) / 1000;
      draw(lastSeconds);
      handle.frame = requestAnimationFrame(tick);
    };
    running.set(canvas, handle);
    handle.frame = requestAnimationFrame(tick);
  };
  image.src = options.imageUrl;
}

function resizeCanvas(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void {
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  let width = Math.max(1, Math.round((canvas.clientWidth || 320) * dpr));
  let height = Math.max(1, Math.round((canvas.clientHeight || 240) * dpr));
  const edge = Math.max(width, height);
  if (edge > TITLE_EFFECTS_MAX_CANVAS_EDGE) {
    const scale = TITLE_EFFECTS_MAX_CANVAS_EDGE / edge;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[title-effects] shader compile failed", gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, TITLE_EFFECT_VERTEX_SHADER);
  const fs = compile(gl.FRAGMENT_SHADER, TITLE_EFFECT_FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[title-effects] program link failed", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const attr = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
  return program;
}

/** 재사용 판정용 서명 — 같으면 기존 캔버스(진행 중 애니메이션)를 그대로 쓴다. */
export function titleEffectsSignature(options: TitleEffectsCanvasOptions): string {
  return JSON.stringify({ e: options.effects, u: options.imageUrl, f: options.fit ?? "stretch", z: options.freezeAtSec });
}
