/**
 * 큰 동작(공격·피격 등) — sprite-gen 의 component-row 방식 (aldegad/sprite-gen, Apache-2.0, 2026-10-01 비교 시험).
 *
 * 한 동작의 N 프레임을 **가로 한 줄 한 장**으로 생성한다. 프레임을 따로 생성하면 매번 다른 생물이 되지만,
 * 한 장에 같이 그리면 같은 생물·같은 팔레트로 나온다. 생성 뒤에는:
 *   1. 줄 전체를 한 번에 도트화한다 (격자·팔레트를 네 프레임이 공유한다 — 프레임마다 따로 하면 칸이 출렁인다)
 *   2. 연결 성분을 N 묶음으로 나눈다 (sprite-gen extract_component_frames 와 같은 규칙: 큰 성분 N 개가 씨앗)
 *   3. 0번 프레임으로 정한 배율을 N 장에 똑같이 적용하고, 발 위치를 0번에 맞춰 112 캔버스에 놓는다
 *
 * god-tibo 는 참고 이미지를 한 장만 받는다. sprite-gen 은 기준 그림 + 칸 안내 두 장을 넣으므로
 * 첫 칸에 기준 스프라이트를 넣은 칸 안내 한 장으로 합친다.
 */
import { composeOn, createImage, cropToInk, opaqueBounds, pixelAt, setPixel, type Rgba, type RgbaImage } from "../pixel/image";
import { chooseScale, SPRITE_CANVAS, type ScalePlan, type SpriteSide } from "../pixel/fit";
import { downscaleBy, downscaleTo } from "../pixel/downscale";
import { removeMagentaCasts } from "../pixel/tidy";
import { edgeProfiles } from "../pixel/grid";

/**
 * 참고 그림 크기. god-tibo 출력은 약 1.57MP 이고 종횡비가 참고 그림을 따른다(1254², 1536×1024, 2172×724 …).
 * 1536×1024 에 네 칸이면 칸이 384px 라 기준 스프라이트를 3배로밖에 못 넣고, 생성 블록이 3px 로 나와
 * 격자 추출이 무너졌다(흰 줄·윤곽 소실, 2026-10-01). 3:1 로 칸을 543px 까지 키우면 4배 이상이 들어간다.
 */
export const ROW_REFERENCE = { width: 2172, height: 724, margin: 32 } as const;

/**
 * 동작 줄의 블록 크기 짐작: 생성 원본에서 첫 포즈의 가로 폭(px) ÷ 기준 스프라이트 잉크 폭(칸).
 * 한 줄에 네 마리를 그리면 블록이 3~5px 로 작아져, 짐작 없이 고르면 2배 크기(7px)를 골라 몸집이 반이 된다
 * (2026-10-01 시험: 12장 중 5장). 첫 포즈는 「기준과 같은 그림」이라 칸 수가 기준과 같아야 한다.
 */
export function rowBlockHint(raw: RgbaImage, baseInkWidth: number): number | undefined {
  const { bg } = edgeProfiles(raw);
  const filled: boolean[] = [];
  for (let x = 0; x < raw.width; x += 1) {
    let n = 0;
    for (let y = 0; y < raw.height; y += 1) if (!bg[y * raw.width + x]) n += 1;
    filled.push(n >= 3);
  }
  const start = filled.indexOf(true);
  if (start < 0 || baseInkWidth <= 0) return undefined;
  // 빈 열이 블록 몇 개만큼 이어지면 첫 포즈가 끝난 것
  let end = start;
  let gap = 0;
  for (let x = start; x < raw.width; x += 1) {
    if (filled[x]) {
      end = x;
      gap = 0;
    } else if ((gap += 1) > 12) break;
  }
  return (end - start + 1) / baseInkWidth;
}

const MAGENTA: Rgba = [255, 0, 255, 255];
const GUIDE_LINE: Rgba = [51, 51, 51, 255];

/** 2172×724 마젠타 캔버스 가운데 띠에 N 칸 상자, 첫 칸에 기준 스프라이트(정수배, 칸 바닥 정렬). */
export function rowReference(sprite: RgbaImage, frames: number): RgbaImage {
  const { width, height, margin } = ROW_REFERENCE;
  const cell = Math.min(height, Math.floor(width / frames));
  const bandTop = Math.floor((height - cell) / 2);
  const out = composeOn(MAGENTA, width, height, { width: 0, height: 0, data: new Uint8ClampedArray(0) }, 0, 0);
  for (let k = 0; k < frames; k += 1) {
    const x0 = k * cell;
    for (let t = 0; t < 3; t += 1) {
      for (let x = x0; x < x0 + cell; x += 1) {
        setPixel(out, x, bandTop + t, GUIDE_LINE);
        setPixel(out, x, bandTop + cell - 1 - t, GUIDE_LINE);
      }
      for (let y = bandTop; y < bandTop + cell; y += 1) {
        setPixel(out, x0 + t, y, GUIDE_LINE);
        setPixel(out, Math.min(width - 1, x0 + cell - 1 - t), y, GUIDE_LINE);
      }
    }
  }
  const ink = cropToInk(sprite);
  const safe = cell - margin * 2;
  const factor = Math.max(1, Math.floor(safe / Math.max(ink.width, ink.height)));
  for (let y = 0; y < ink.height * factor; y += 1) {
    for (let x = 0; x < ink.width * factor; x += 1) {
      const p = pixelAt(ink, Math.floor(x / factor), Math.floor(y / factor));
      if (p[3]) setPixel(out, margin + Math.floor((safe - ink.width * factor) / 2) + x, bandTop + cell - margin - ink.height * factor + y, p);
    }
  }
  return out;
}

type Component = { pixels: number[]; area: number; centerX: number };

function components(image: RgbaImage): Component[] {
  const { width, height } = image;
  const seen = new Uint8Array(width * height);
  const out: Component[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !image.data[start * 4 + 3]) continue;
    const stack = [start];
    const pixels: number[] = [];
    let minX = width;
    let maxX = 0;
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      pixels.push(i);
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (!seen[j] && image.data[j * 4 + 3]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    out.push({ pixels, area: pixels.length, centerX: (minX + maxX + 1) / 2 });
  }
  return out;
}

/** 도트화한 줄을 N 프레임으로 나눈다. 큰 성분 N 개가 씨앗, 나머지 조각은 가로 중심이 가까운 씨앗에 붙는다. */
export function splitRow(grid: RgbaImage, frames: number): RgbaImage[] {
  const all = components(grid);
  if (all.length === 0) throw new Error("줄에 그림이 없다");
  const largest = Math.max(...all.map((c) => c.area));
  const seeds = all.filter((c) => c.area >= largest * 0.2).sort((a, b) => b.area - a.area).slice(0, frames).sort((a, b) => a.centerX - b.centerX);
  if (seeds.length < frames) throw new Error(`프레임 ${frames}개를 기대했는데 큰 덩어리가 ${seeds.length}개다 (포즈가 겹쳤거나 빠졌다)`);
  const groups = seeds.map((seed) => [seed]);
  for (const c of all) {
    if (seeds.includes(c) || c.area < 3) continue;
    let nearest = 0;
    seeds.forEach((seed, index) => {
      if (Math.abs(seed.centerX - c.centerX) < Math.abs(seeds[nearest]!.centerX - c.centerX)) nearest = index;
    });
    groups[nearest]!.push(c);
  }
  return groups.map((group) => {
    const out = createImage(grid.width, grid.height);
    for (const c of group) for (const i of c.pixels) setPixel(out, i % grid.width, Math.floor(i / grid.width), pixelAt(grid, i % grid.width, Math.floor(i / grid.width)));
    return cropToInk(out);
  });
}

/**
 * 발 위치: 맨 아래 3줄의 불투명 칸. edge 0 = 가로 평균, +1 = 가장 오른쪽, −1 = 가장 왼쪽.
 * 덤비는 자세는 앞발을 앞으로 뻗으므로 평균에 맞추면 몸 전체가 뒤로 밀려 덤빈 거리가 지워진다
 * (2026-10-01 리프링 앞모습: 머리는 왼쪽으로 덤비는데 몸이 오른쪽으로 10칸 밀렸다). 그래서 공격·피격은
 * **뒷발(공격 방향의 반대쪽 끝)** 을 0번 뒷발 자리에 둔다.
 */
function feetX(image: RgbaImage, edge: -1 | 0 | 1 = 0): number {
  const box = opaqueBounds(image)!;
  let sum = 0;
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let y = box.y + box.height - 3; y < box.y + box.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3]) {
        sum += x;
        n += 1;
        if (x < min) min = x;
        if (x > max) max = x;
      }
    }
  }
  if (!n) return box.x + box.width / 2;
  return edge === 0 ? sum / n : edge > 0 ? max : min;
}

export type RowFrames = {
  frames: RgbaImage[];
  /** 0번 프레임 기준 축소 배율 (1 = 그대로) */
  scale: number;
  /** 112 캔버스 밖으로 나가 잘린 칸 수 */
  clipped: number;
};

/**
 * N 프레임을 같은 배율로 줄이고 112 캔버스에 놓는다. 0번은 가운데·바닥 정렬, 나머지는 발을 0번 발 위치에 맞춰 바닥 정렬.
 * baseInkWidth 를 주면 0번 잉크 폭을 기준 스프라이트 폭에 맞춘다 — 대기에서 동작으로 넘어갈 때 크기가 튀지 않게.
 * (작으면 키우지 않는다. 도트를 늘리면 블록이 두 배가 된다)
 */
export function rowFrames(parts: RgbaImage[], side: SpriteSide, stage: 1 | 2 | 3 = 1, baseInkWidth?: number, anchorEdge: -1 | 0 | 1 = 0): RowFrames {
  const first = parts[0]!;
  const plan: ScalePlan = baseInkWidth
    ? first.width > baseInkWidth ? { kind: "fraction", width: baseInkWidth } : { kind: "keep" }
    : chooseScale(first.width, first.height, side, stage);
  let scale = plan.kind === "keep" ? 1 : plan.kind === "integer" ? 1 / plan.factor : plan.width / first.width;
  // 가장 큰 포즈(돌진·뒤로 젖힘)가 캔버스를 넘으면 전체를 조금 더 줄인다 — 잘려서 머리가 사라지는 것보다
  // 대기→동작 크기가 몇 % 튀는 편이 낫다
  const widest = Math.max(...parts.map((part) => Math.max(part.width, part.height))) * scale;
  const fits = widest <= SPRITE_CANVAS;
  if (!fits) scale *= SPRITE_CANVAS / widest;
  const bodies = parts.map((part) => {
    const scaled = fits && plan.kind === "keep" ? part
      : fits && plan.kind === "integer" ? downscaleBy(part, plan.factor)
      : downscaleTo(part, Math.max(1, Math.floor(part.width * scale)));
    return cropToInk(removeMagentaCasts(cropToInk(scaled)).image);
  });
  const anchor = Math.floor((SPRITE_CANVAS - bodies[0]!.width) / 2) + feetX(bodies[0]!, anchorEdge);
  let clipped = 0;
  const frames = bodies.map((body) => {
    const sprite = createImage(SPRITE_CANVAS, SPRITE_CANVAS);
    // 발을 0번 발 자리에 두되, 캔버스 안에 들어가게 민다. 돌진 거리는 엔진이 몸 전체를 옮겨 낸다(lunge) —
    // 프레임 안에서 앞으로 나간 만큼 잘리면 머리가 사라진다 (2026-10-01 아쿠아링 앞모습 344칸)
    const left = body.width <= SPRITE_CANVAS
      ? Math.min(SPRITE_CANVAS - body.width, Math.max(0, Math.round(anchor - feetX(body, anchorEdge))))
      : Math.round(anchor - feetX(body, anchorEdge));
    const top = SPRITE_CANVAS - body.height;
    for (let y = 0; y < body.height; y += 1) {
      for (let x = 0; x < body.width; x += 1) {
        const p = pixelAt(body, x, y);
        if (!p[3]) continue;
        const tx = left + x;
        const ty = top + y;
        if (tx < 0 || ty < 0 || tx >= SPRITE_CANVAS || ty >= SPRITE_CANVAS) clipped += 1;
        else setPixel(sprite, tx, ty, p);
      }
    }
    return sprite;
  });
  return { frames, scale, clipped };
}

/** 프레임을 가로로 잇는다 — 전투 화면 image-strip 규약(src/assets/battlerIdleAnimations.ts)과 같은 모양 */
export function toStrip(frames: RgbaImage[]): RgbaImage {
  const cell = frames[0]!.width;
  const out = createImage(cell * frames.length, frames[0]!.height);
  frames.forEach((frame, k) => {
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const p = pixelAt(frame, x, y);
        if (p[3]) setPixel(out, k * cell + x, y, p);
      }
    }
  });
  return out;
}

export function fromStrip(strip: RgbaImage, frames: number): RgbaImage[] {
  const cell = strip.width / frames;
  if (!Number.isInteger(cell)) throw new Error(`스트립 폭 ${strip.width} 가 ${frames} 프레임으로 나뉘지 않는다`);
  return Array.from({ length: frames }, (_, k) => {
    const out = createImage(cell, strip.height);
    for (let y = 0; y < strip.height; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const p = pixelAt(strip, k * cell + x, y);
        if (p[3]) setPixel(out, x, y, p);
      }
    }
    return out;
  });
}
