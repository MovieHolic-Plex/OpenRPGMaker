/**
 * 전투 스프라이트 규격: 112×112 투명 캔버스, 가로 가운데·바닥 정렬.
 * 포켓몬 전투 스킨은 이 캔버스를 내 몬스터 3배·상대 2배 정수 배율로 그린다 (qa/battle-layout.css).
 *
 * 크기 규칙 — 「몸집」은 잉크 상자 넓이의 제곱근으로 잰다. 길고 납작한 종(도롱뇽)과 키 큰 종(여우)을
 * 긴 변으로만 맞추면 납작한 쪽이 작아 보인다 (2026-10-01 물 스타터가 그랬다).
 */
import { createImage, cropToInk, pixelAt, setPixel, type RgbaImage } from "./image";
import { downscaleBy, downscaleTo } from "./downscale";
import { removeMagentaCasts } from "./tidy";

export const SPRITE_CANVAS = 112;
export const MAX_INK_SIDE = 108;

export type SpriteSide = "front" | "back";

/** 몸집 목표. 뒷모습은 카메라에 가까운 몸이라 조금 크게 둔다. */
export const BODY_SIZE: Record<SpriteSide, number> = { front: 80, back: 88 };

/** 진화 단계가 오를수록 몸집을 키운다 (같은 캔버스 안에서). 3단계 목표는 긴 변 상한(108)에 먼저 걸리기 쉽다. */
export const STAGE_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.12, 3: 1.25 };

/** 정수 배율에 이만큼 가까우면 정수 배율로 줄인다 (비정수 축소보다 선이 덜 흔들린다). */
const INTEGER_SNAP = 0.15;

export type FitResult = {
  sprite: RgbaImage;
  /** 원본 격자 대비 축소 배율 (1 = 그대로) */
  factor: number;
  ink: { width: number; height: number };
  magentaRemoved: number;
};

export type ScalePlan = { kind: "keep" } | { kind: "integer"; factor: number } | { kind: "fraction"; width: number };

export function chooseScale(width: number, height: number, side: SpriteSide, stage: 1 | 2 | 3 = 1): ScalePlan {
  const body = BODY_SIZE[side] * STAGE_SCALE[stage];
  const scale = Math.min(1, MAX_INK_SIDE / Math.max(width, height), body / Math.sqrt(width * height));
  if (scale >= 1) return { kind: "keep" };
  const factor = 1 / scale;
  const snapped = Math.round(factor);
  if (snapped >= 2 && Math.abs(factor - snapped) < INTEGER_SNAP) return { kind: "integer", factor: snapped };
  return { kind: "fraction", width: Math.round(width * scale) };
}

function applyScale(ink: RgbaImage, plan: ScalePlan): RgbaImage {
  if (plan.kind === "keep") return ink;
  return cropToInk(plan.kind === "integer" ? downscaleBy(ink, plan.factor) : downscaleTo(ink, plan.width));
}

export function fitSprite(gridCells: RgbaImage, side: SpriteSide, stage: 1 | 2 | 3 = 1): FitResult {
  const ink = cropToInk(gridCells);
  const scaled = applyScale(ink, chooseScale(ink.width, ink.height, side, stage));
  const { image: clean, removed } = removeMagentaCasts(scaled);
  const body = cropToInk(clean);
  if (body.width > SPRITE_CANVAS || body.height > SPRITE_CANVAS) {
    throw new Error(`스프라이트가 캔버스보다 크다: ${body.width}x${body.height}`);
  }
  const sprite = createImage(SPRITE_CANVAS, SPRITE_CANVAS);
  const left = Math.floor((SPRITE_CANVAS - body.width) / 2);
  const top = SPRITE_CANVAS - body.height;
  for (let y = 0; y < body.height; y += 1) {
    for (let x = 0; x < body.width; x += 1) {
      const p = pixelAt(body, x, y);
      if (p[3]) setPixel(sprite, left + x, top + y, p);
    }
  }
  return { sprite, factor: ink.width / body.width, ink: { width: body.width, height: body.height }, magentaRemoved: removed };
}
