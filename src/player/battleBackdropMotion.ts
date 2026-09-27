/**
 * 움직이는 전투 배경(트룹 backdropAnimation)을 배경 노드에 건다.
 *
 * - 스크롤·색 순환: CSS 변수 + keyframes(styles/runtime/battle/24-backdrop-motion.css).
 * - 물결 왜곡: 줄(scanline)마다 가로로 밀리는 마더2식 왜곡은 CSS 로 그릴 수 없어 캔버스 한 장을 배경 안에 깐다.
 *   캔버스가 있으면 스크롤도 캔버스가 그린다(CSS 스크롤은 data-backdrop-wave="canvas" 로 꺼진다).
 * - prefers-reduced-motion: 아무 것도 걸지 않는다. 배경은 정지 그림 그대로다(data-backdrop-motion-reduced).
 *
 * 전투 규칙과 무관한 순수 표현이다. 필드 스냅샷 배경(system.battleBackdrop === "field")에는 걸지 않는다.
 */
import { battleBackdropMotion, type BattleBackdropMotion } from "@/battle/battleBackdrop";
import { normalizeBattleBackdropAnimation } from "@/project/battleBackdropAnimation";
import type { BattleBackdropAnimation } from "@/project/types";

const MOTION_VAR_NAMES = [
  "--battle-backdrop-scroll-duration",
  "--battle-backdrop-scroll-x",
  "--battle-backdrop-scroll-y",
  "--battle-backdrop-wave-amplitude",
  "--battle-backdrop-wave-duration",
  "--battle-backdrop-palette-duration",
] as const;

/** CSS 스크롤이 까는 타일 크기와 같아야 캔버스·CSS 가 같은 그림을 그린다(24-backdrop-motion.css). */
const TILE_W = 640;
const TILE_H = 480;
/** 물결 한 주기의 세로 길이(px). 마더2 배경처럼 화면에 몇 굽이가 보이게 한다. */
const WAVE_PERIOD_PX = 96;
const BAND_PX = 2;

type WaveState = {
  readonly canvas: HTMLCanvasElement;
  readonly animation: BattleBackdropAnimation;
  rafId: number;
  startedAt: number | undefined;
  url: string;
  image: HTMLImageElement | undefined;
  tile: HTMLCanvasElement | undefined;
  wasConnected: boolean;
};

const waves = new WeakMap<HTMLElement, WaveState>();

export function prefersReducedBackdropMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 배경 노드에 움직임을 건다(이미 걸려 있으면 갈아 끼운다). 효과가 없으면 흔적을 지운다.
 * @returns 실제로 건 움직임(테스트·QA 용). 줄임 모드거나 효과가 없으면 undefined.
 */
export function applyBattleBackdropMotion(
  backdrop: HTMLElement,
  animation: BattleBackdropAnimation | undefined,
  options: { readonly reducedMotion?: boolean } = {},
): BattleBackdropMotion | undefined {
  clearBattleBackdropMotion(backdrop);
  const normalized = normalizeBattleBackdropAnimation(animation);
  const motion = battleBackdropMotion(normalized);
  if (!motion || !normalized) return undefined;
  if (options.reducedMotion ?? prefersReducedBackdropMotion()) {
    backdrop.dataset.backdropMotionReduced = "true";
    return undefined;
  }
  backdrop.dataset.backdropMotion = motion.kinds.join(" ");
  for (const [name, value] of Object.entries(motion.vars)) backdrop.style.setProperty(name, value);
  if (motion.kinds.includes("wave")) mountWaveCanvas(backdrop, normalized);
  return motion;
}

export function clearBattleBackdropMotion(backdrop: HTMLElement): void {
  delete backdrop.dataset.backdropMotion;
  delete backdrop.dataset.backdropMotionReduced;
  delete backdrop.dataset.backdropWave;
  for (const name of MOTION_VAR_NAMES) backdrop.style.removeProperty(name);
  const wave = waves.get(backdrop);
  if (wave) {
    if (wave.rafId !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(wave.rafId);
    wave.canvas.remove();
    waves.delete(backdrop);
  }
}

function mountWaveCanvas(backdrop: HTMLElement, animation: BattleBackdropAnimation): void {
  if (typeof requestAnimationFrame !== "function") return;
  const canvas = document.createElement("canvas");
  // 2D 컨텍스트가 없는 환경(헤드리스 폴백)에서는 캔버스를 깔지 않는다 — CSS 스크롤·색 순환만 남는다.
  if (!canvas.getContext("2d")) return;
  canvas.className = "battle-backdrop-wave-canvas";
  canvas.dataset.testid = "battle-backdrop-wave-canvas";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.append(canvas);
  backdrop.dataset.backdropWave = "canvas";
  const state: WaveState = {
    canvas,
    animation,
    rafId: 0,
    startedAt: undefined,
    url: "",
    image: undefined,
    tile: undefined,
    wasConnected: false,
  };
  waves.set(backdrop, state);
  const frame = (nowMs: number): void => {
    state.rafId = 0;
    if (waves.get(backdrop) !== state) return;
    // 씬이 떼어지면(전투 종료) 스스로 멈춘다. 붙기 전 프레임은 기다린다.
    if (!backdrop.isConnected) {
      if (state.wasConnected) { clearBattleBackdropMotion(backdrop); return; }
    } else {
      state.wasConnected = true;
      if (backdrop.dataset.backdropSource === "field") { clearBattleBackdropMotion(backdrop); return; }
      drawWaveFrame(backdrop, state, nowMs);
    }
    state.rafId = requestAnimationFrame(frame);
  };
  state.rafId = requestAnimationFrame(frame);
}

/** 배경 노드의 background-image 에서 마지막 url(...) 을 꺼낸다(앞의 스크림 그라데이션은 건너뛴다). */
export function backdropImageUrl(backgroundImage: string): string {
  const matches = [...backgroundImage.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
  return matches.length > 0 ? matches[matches.length - 1]![2]! : "";
}

function drawWaveFrame(backdrop: HTMLElement, state: WaveState, nowMs: number): void {
  const url = backdropImageUrl(backdrop.style.backgroundImage);
  if (url !== state.url) {
    state.url = url;
    state.tile = undefined;
    state.image = undefined;
    if (url) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (state.url !== url) return;
        state.image = image;
        state.tile = undefined;
      };
      image.src = url;
    }
  }
  const width = Math.max(1, Math.round(backdrop.clientWidth || TILE_W));
  const height = Math.max(1, Math.round(backdrop.clientHeight || TILE_H));
  const { canvas } = state;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context || !state.image) return;
  if (!state.tile) {
    const tile = document.createElement("canvas");
    tile.width = TILE_W;
    tile.height = TILE_H;
    tile.getContext("2d")?.drawImage(state.image, 0, 0, TILE_W, TILE_H);
    state.tile = tile;
  }
  const pattern = context.createPattern(state.tile, "repeat");
  if (!pattern) return;
  state.startedAt ??= nowMs;
  const seconds = (nowMs - state.startedAt) / 1000;
  const { scrollX = 0, scrollY = 0, waveAmplitude = 0 } = state.animation;
  const frequency = state.animation.waveFrequency ?? 1;
  const sx = wrap(scrollX * seconds, TILE_W);
  const sy = wrap(scrollY * seconds, TILE_H);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = pattern;
  for (let y = 0; y < height; y += BAND_PX) {
    const dx = waveAmplitude * Math.sin(2 * Math.PI * (y / WAVE_PERIOD_PX + seconds * frequency));
    // 패턴 원점을 (dx+sx, sy) 로 옮기고, 화면의 [0,width]×[y,y+band] 띠를 채운다.
    context.setTransform(1, 0, 0, 1, dx + sx, sy);
    context.fillRect(-dx - sx, y - sy, width, BAND_PX);
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function wrap(value: number, size: number): number {
  const mod = value % size;
  return mod < 0 ? mod + size : mod;
}
