/**
 * 대기(idle) 애니메이션 — 고른 스프라이트를 그대로 두고 정수 픽셀만 움직인다 (2026-10-01 A안).
 *
 * 프레임을 새로 생성하면 같은 생물이라도 칸이 거의 다 바뀐다(따로 생성 98%, 2×2 한 장 89%,
 * sprite-gen 한 줄 58% — 연속 프레임 사이 바뀐 칸 비율). 대기는 1px 숨쉬기라 그 흔들림이 전부 잡음이 된다.
 * 여기서는 윗몸을 1px 내렸다 올리고, 꼬리 띠를 1px 흔들고, 불꽃 종은 불꽃 상자 절반을 번갈아 1px 들어 올린다 (14%).
 *
 * 꼬리 쪽은 하네스의 시점 규약에서 나온다: 앞모습은 왼쪽을 보니 꼬리가 오른쪽, 뒷모습은 오른쪽 위를 보니 꼬리가 왼쪽.
 */
import { cloneImage, createImage, isOpaque, opaqueBounds, pixelAt, setPixel, type RgbaImage } from "../pixel/image";
import { oklabCached } from "../pixel/oklab";
import type { SpriteSide } from "../pixel/fit";

export type IdleMotion = {
  /** 불꽃처럼 일렁이는 부위. 따뜻하고 밝은 색 덩어리를 찾아 흔든다 */
  flicker?: "flame";
};

/** 프레임마다 (숨: 윗몸 아래로 px, 꼬리: 위아래 px, 불꽃: 들어 올릴 절반 -1 왼쪽 / 1 오른쪽) */
export const IDLE_PLAN: readonly (readonly [breathe: number, tail: number, flame: number])[] = [
  [0, 0, 0],
  [1, -1, 1],
  [1, 0, 0],
  [0, 1, -1],
];

/** 윗몸/다리 경계 — 잉크 높이의 42% 위까지가 다리 (발은 움직이지 않는다) */
const LEG_SHARE = 0.42;
/** 꼬리 띠 폭 — 잉크 폭의 28% */
const TAIL_SHARE = 0.28;
/** 꼬리 띠의 아래 15% 는 고정 (꼬리 뿌리·뒷발) */
const TAIL_ROOT_SHARE = 0.15;

const clear = [0, 0, 0, 0] as const;

/**
 * 열 [x0,x1) 에서 [yTop, yCut] 줄을 dy 만큼 옮긴다 (dy>0 아래). 띠 밖은 그대로.
 * 옮긴 뒤 비게 된 경계 줄(yCut)은 원래 줄로 메운다 — 몸이 찢어지지 않게 1px 늘인다.
 */
export function shiftBand(image: RgbaImage, x0: number, x1: number, yTop: number, yCut: number, dy: number): RgbaImage {
  const out = cloneImage(image);
  const top = Math.max(0, yTop);
  const cut = Math.min(image.height - 1, yCut);
  for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x += 1) {
    for (let y = top; y <= cut; y += 1) setPixel(out, x, y, clear);
    for (let y = top; y <= cut; y += 1) {
      const ny = y + dy;
      if (ny >= top && ny <= cut && isOpaque(image, x, y)) setPixel(out, x, ny, pixelAt(image, x, y));
    }
    if (isOpaque(image, x, cut) && !isOpaque(out, x, cut)) setPixel(out, x, cut, pixelAt(image, x, cut));
  }
  return out;
}

/** 가장 큰 「따뜻하고 밝은」 색 덩어리 상자 (불꽃). 없으면 null */
export function flameBox(image: RgbaImage): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width, height } = image;
  const warm = new Uint8Array(width * height);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      const p = pixelAt(image, x, y);
      const lab = oklabCached(p[0], p[1], p[2]);
      if (lab[0] > 0.8 && lab[2] > 0.1) {
        warm[y * width + x] = 1;
        count += 1;
      }
    }
  }
  if (count < 6) return null;
  let best: number[] = [];
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start += 1) {
    if (!warm[start] || seen[start]) continue;
    const stack = [start];
    const comp: number[] = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      comp.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (warm[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const xs = best.map((i) => i % width);
  const ys = best.map((i) => Math.floor(i / width));
  return { x0: Math.min(...xs) - 3, y0: Math.min(...ys) - 3, x1: Math.max(...xs) + 3, y1: Math.max(...ys) + 3 };
}

/** 대기 4프레임. 0번은 원본 그대로, 발(잉크 맨 아래 줄)은 어느 프레임에서도 움직이지 않는다. */
export function idleFrames(sprite: RgbaImage, side: SpriteSide, motion: IdleMotion = {}): RgbaImage[] {
  const box = opaqueBounds(sprite);
  if (!box) return IDLE_PLAN.map(() => createImage(sprite.width, sprite.height));
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height - 1;
  const cut = bottom - Math.round(box.height * LEG_SHARE);
  const tailWidth = Math.round(box.width * TAIL_SHARE);
  const [tx0, tx1] = side === "front" ? [right - tailWidth, right] : [left, left + tailWidth];
  const tailCut = bottom - Math.round(box.height * TAIL_ROOT_SHARE);
  const flame = motion.flicker === "flame" ? flameBox(sprite) : null;
  return IDLE_PLAN.map(([breathe, tail, flicker]) => {
    let frame = cloneImage(sprite);
    if (breathe) frame = shiftBand(frame, left, right, top, cut, breathe);
    // 위로 올릴 때 띠 맨 윗줄이 잘리지 않게 띠를 한 줄 위에서 시작한다
    if (tail) frame = shiftBand(frame, tx0, tx1, top - 1, tailCut, tail);
    if (flame && flicker) {
      const mid = Math.floor((flame.x0 + flame.x1) / 2);
      const [hx0, hx1] = flicker > 0 ? [flame.x0, mid] : [mid, flame.x1 + 1];
      frame = shiftBand(frame, hx0, hx1, flame.y0, Math.min(flame.y1, bottom - 1), -1);
    }
    return frame;
  });
}
