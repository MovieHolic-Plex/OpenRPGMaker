/**
 * 전투 스프라이트 규격 (2026-10-16 격자 계약): 64×64 투명 캔버스, 가로 가운데·바닥 정렬, 몸 내용 48~56 이내.
 * 그림 한 도트 = 논리 화소 하나 = 화면 2px (화면 480×320 = GBA 240×160 의 정확히 2배). 전투 표시는 128×128 = 정확히 2배.
 * 옛 112 캔버스는 정수배가 1배(도트 절반 크기)뿐이라 격자에 안 맞았다(112→128 은 1.14배, D12).
 * 생성 그림 속 도트(수십~백 칸)는 거칠게 줄여 64 캔버스의 1칸 = 1도트로 만든다 — 거칠어지는 건 GBA 격자와 같아 의도한 것이다.
 *
 * 크기 규칙 — 「몸집」은 잉크 상자 넓이의 제곱근으로 잰다. 길고 납작한 종(도롱뇽)과 키 큰 종(여우)을
 * 긴 변으로만 맞추면 납작한 쪽이 작아 보인다 (2026-10-01 물 스타터가 그랬다).
 */
import { createImage, cropToInk, pixelAt, setPixel, type RgbaImage } from "./image";
import { downscaleBy, downscaleTo } from "./downscale";
import { removeMagentaCasts } from "./tidy";

export const SPRITE_CANVAS = 64;
/** 몸 내용 긴 변 상한 (캔버스 64 - 가장자리 4칸씩) */
export const MAX_INK_SIDE = 56;

export type SpriteSide = "front" | "back";

/** 몸집 목표. 뒷모습은 카메라에 가까운 몸이라 조금 크게 둔다. */
export const BODY_SIZE: Record<SpriteSide, number> = { front: 46, back: 50 };

/** 진화 단계가 오를수록 몸집을 키운다 (같은 캔버스 안에서). 3단계 목표는 긴 변 상한(108)에 먼저 걸리기 쉽다. */
export const STAGE_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.08, 3: 1.15 };

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
  // 정수 배율은 올림으로 칸을 만들어 상한을 한 칸 넘길 수 있다 — 넘기면 비정수로 간다
  if (snapped >= 2 && Math.abs(factor - snapped) < INTEGER_SNAP && Math.ceil(Math.max(width, height) / snapped) <= MAX_INK_SIDE) return { kind: "integer", factor: snapped };
  // 줄인 뒤 반올림한 높이가 상한을 넘는 일이 있다(세로로 긴 종: 54x85 → 36x57) — 폭을 한 칸씩 줄여 맞춘다
  let target = Math.max(1, Math.round(width * scale));
  while (target > 1 && Math.round(height * target / width) > MAX_INK_SIDE) target -= 1;
  return { kind: "fraction", width: target };
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
