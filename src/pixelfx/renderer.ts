// pixelfx 효과 하나를 게임 화소 해상도로 그리는 엔진 중립 코어(전투 DOM · 필드 Phaser · 편집기 미리보기 공용).
//
// 효과는 프레임 하나에 두 버퍼를 그린다: color(보통 섞기, ABGR 곧은 알파)와 light(더하는 빛). 여기서는 둘을 따로
// ImageData 로 옮긴다 — color 는 그대로 복사하고, light 는 불투명 검정 바탕의 RGB 로 둬서 「더하기」로 겹치면
// 바탕이 밝든 어둡든 원본 composite 와 같은 빛이 된다(검정은 더해도 0). 효과 원본·라이선스: src/vendor/pixelfx (MIT).
import { clearFrame, composite, createFrame, createFx } from "@/vendor/pixelfx/core/index.js";
import type { PixelFxFrame, PixelFxInstance, PixelFxModule } from "@/vendor/pixelfx/core/index.js";
import type { PixelFxSpec } from "@/project/types";

/** 효과 캔버스 크기와 그 안에서 효과 원점(발·착탄점)이 놓이는 화소. */
export interface PixelFxLayout {
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export type PixelFxLayer = "back" | "front" | "all";

/** 캔버스 상한(한 변, 게임 화소). 효과 목록의 가장 큰 효과가 400×320 이고, 회전하면 대각선만큼 커진다. */
const MAX_SIDE = 640;

export function pixelFxLayout(mod: PixelFxModule, spec: Pick<PixelFxSpec, "flip" | "angle">): PixelFxLayout {
  const [w, h] = mod.meta.size ?? [96, 96];
  const [ox, oy] = mod.meta.origin ?? [w / 2, h / 2];
  if (spec.angle) {
    // 회전하면 원점에서 가장 먼 모서리까지가 반지름인 정사각형이어야 안 잘린다.
    const r = Math.ceil(Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy)));
    const side = Math.min(MAX_SIDE, r * 2);
    return { width: side, height: side, anchorX: side / 2, anchorY: side / 2 };
  }
  return { width: Math.min(MAX_SIDE, w), height: Math.min(MAX_SIDE, h), anchorX: spec.flip ? w - ox : ox, anchorY: oy };
}

/**
 * 가장자리 깃털(0~255): 효과 상자 테두리에서 안쪽으로 F 화소까지 0→255. 횃불·치유 빛, 반딧불 같은 장면 효과의 은은한 색은
 * 상자 끝까지 번져 있어 그대로 겹치면 네모난 테두리가 보인다(2026-10-31 필드 캡처) — 상자 끝에서 0 으로 녹인다.
 */
const featherCache = new Map<string, Uint8Array>();
function featherMask(width: number, height: number): Uint8Array {
  const key = `${width}x${height}`;
  const cached = featherCache.get(key);
  if (cached) return cached;
  const f = Math.max(4, Math.min(24, Math.floor(Math.min(width, height) / 5)));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const dy = Math.min(y, height - 1 - y);
    for (let x = 0; x < width; x++) {
      const d = Math.min(dy, x, width - 1 - x);
      const t = d >= f ? 1 : d / f;
      mask[y * width + x] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  featherCache.set(key, mask);
  return mask;
}

/** frame 의 color 알파와 light 밝기에 가장자리 깃털을 곱한다(제자리). */
function featherFrame(frame: PixelFxFrame, mask: Uint8Array): void {
  const C = frame.color;
  const L = frame.light;
  for (let i = 0; i < C.length; i++) {
    const m = mask[i]!;
    if (m === 255) continue;
    const c = C[i]!;
    if (c >>> 24) C[i] = ((((c >>> 24) * m) / 255) << 24 | (c & 0xffffff)) >>> 0;
    const l = L[i]!;
    if (l & 0xffffff) {
      const r = ((l & 255) * m / 255) | 0, g = (((l >> 8) & 255) * m / 255) | 0, b = (((l >> 16) & 255) * m / 255) | 0;
      L[i] = ((l & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
}

/** 한 번 그린 결과: 그 층에 color·light 화소가 있었나(없으면 그 그림을 띄우지 않아도 된다). */
export interface PixelFxPaint {
  readonly color: boolean;
  readonly light: boolean;
}

/**
 * 효과 인스턴스 하나. advance(초)로 시간을 보내고 paint(층, color, light)로 지금 장면을 ImageData 에 그린다.
 * 시뮬레이션 효과는 원본 createFx 가 120Hz 로 쪼개 걷는다 — 화면 프레임률과 무관하게 같은 모양이다.
 */
export class PixelFxRenderer {
  readonly layout: PixelFxLayout;
  readonly loop: boolean;
  readonly durationSec: number;
  readonly fps: number;
  readonly speed: number;
  private fx: PixelFxInstance;
  private readonly frame: PixelFxFrame;

  constructor(
    private readonly mod: PixelFxModule,
    private readonly spec: PixelFxSpec,
  ) {
    this.layout = pixelFxLayout(mod, spec);
    this.loop = Boolean(mod.meta.loop);
    this.durationSec = mod.meta.duration ?? 1;
    this.fps = Math.max(1, Math.min(60, mod.meta.fps ?? 30));
    this.speed = spec.speed && spec.speed > 0 ? spec.speed : 1;
    this.frame = createFrame(this.layout.width, this.layout.height);
    this.fx = this.createInstance();
  }

  private createInstance(): PixelFxInstance {
    const spec = this.spec;
    return createFx(this.mod, {
      x: this.layout.anchorX,
      y: this.layout.anchorY,
      flip: Boolean(spec.flip),
      angle: spec.angle ? (spec.angle * Math.PI) / 180 : 0,
      ...(spec.seed !== undefined ? { seed: spec.seed } : {}),
      ...(spec.palette && spec.palette.length >= 2 ? { palette: spec.palette } : {}),
      ...(spec.light !== undefined ? { light: spec.light } : {}),
    });
  }

  /** 효과 시간(초, 속도 반영 뒤). */
  get time(): number {
    return this.fx.t;
  }

  /** 프레임 수(반복 효과의 한 주기 · 한 번 효과의 전체). */
  get frameCount(): number {
    return Math.max(1, Math.round(this.durationSec * this.fps));
  }

  /** 화면 시간 dtSec 만큼 진행한다(속도 곱). */
  advance(dtSec: number): void {
    if (dtSec > 0) this.fx.update(Math.min(0.25, dtSec) * this.speed);
  }

  /** 효과 시간 t(초)로 간다. 반복 효과는 순수 함수(draw(t))라 건너뛰기가 정확하다. 뒤로 가면 처음부터 다시 만든다. */
  seek(tSec: number): void {
    if (tSec < this.fx.t) this.fx = this.createInstance();
    const dt = tSec - this.fx.t;
    // 순수 효과는 update 가 시간만 더한다. 시뮬레이션은 걸음마다 쪼개 간다(원본 createFx).
    if (dt > 0) this.fx.update(dt);
  }

  /** 반복 효과는 서서히, 한 번 효과는 바로 끝낸다(원본 stop). */
  stop(): void {
    this.fx.stop();
  }

  done(): boolean {
    return this.fx.done();
  }

  /**
   * 지금 장면의 한 층을 그린다. color 는 같은 크기 ImageData(곧은 알파 RGBA), light 는 불투명 검정 바탕 RGB(더하기용, 없으면 생략).
   * 층: "back" 캐릭터 뒤, "front" 앞, "all" 둘 다(전투·미리보기).
   */
  paint(layer: PixelFxLayer, color: ImageData, light: ImageData | null): PixelFxPaint {
    const f = this.frame;
    clearFrame(f);
    this.fx.draw(f, layer === "all" ? undefined : layer);
    featherFrame(f, featherMask(f.w, f.h));
    const C = f.color;
    const out32 = new Uint32Array(color.data.buffer, color.data.byteOffset, C.length);
    out32.set(C);
    let anyColor = false;
    for (let i = 0; i < C.length; i++) if (C[i]! >>> 24) { anyColor = true; break; }
    let anyLight = false;
    if (light) {
      const L = f.light;
      const l32 = new Uint32Array(light.data.buffer, light.data.byteOffset, L.length);
      for (let i = 0; i < L.length; i++) {
        const v = L[i]! & 0xffffff;
        // 불투명 검정 + 빛 RGB. 더하기로 겹치면 검정은 0 이라 원본 composite 의 「빛을 더한다」와 같다.
        l32[i] = 0xff000000 | v;
        if (v) anyLight = true;
      }
    }
    return { color: anyColor, light: anyLight };
  }

  /**
   * color 와 light 를 한 장으로 합쳐 그린다(원본 composite, 투명 바탕). 빛은 밝기만큼의 알파를 가진 색이 된다 —
   * 어두운 바탕에서는 더하기처럼 읽힌다. 섞기 모드를 따로 걸 수 없는 곳(전투 DOM: 이펙트 노드가 스태킹 컨텍스트)과 미리보기용.
   */
  paintComposite(layer: PixelFxLayer, out: ImageData): boolean {
    const f = this.frame;
    clearFrame(f);
    this.fx.draw(f, layer === "all" ? undefined : layer);
    featherFrame(f, featherMask(f.w, f.h));
    composite(f, out.data, null);
    const C = f.color, L = f.light;
    for (let i = 0; i < C.length; i++) if ((C[i]! >>> 24) || (L[i]! & 0xffffff)) return true;
    return false;
  }

  /** 이 효과가 캐릭터 뒤 층을 따로 그리는가(효과 모듈이 drawBack 을 낸다). 모르면 true. */
  get hasBackLayer(): boolean {
    return typeof this.mod.drawBack === "function" || typeof this.mod.create === "function";
  }
}
