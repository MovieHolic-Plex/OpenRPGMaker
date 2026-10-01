import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { chooseBlock, extractGrid } from "@/harnesses/monster-collect-species/pixel/grid";
import { removeMagentaCasts, tidyCells } from "@/harnesses/monster-collect-species/pixel/tidy";
import { downscaleBy } from "@/harnesses/monster-collect-species/pixel/downscale";
import { chooseScale, fitSprite, SPRITE_CANVAS } from "@/harnesses/monster-collect-species/pixel/fit";
import { cleanReference, pixelize } from "@/harnesses/monster-collect-species/pixel/pipeline";
import { createImage, cropToInk, opaqueBounds, pixelAt, setPixel, type Rgba, type RgbaImage } from "@/harnesses/monster-collect-species/pixel/image";
import { checkFrames, checkPair, checkSprite, spriteStats } from "@/harnesses/monster-collect-species/checks/checks";
import { IDLE_PLAN, idleFrames } from "@/harnesses/monster-collect-species/anim/idle";
import { fromStrip, ROW_REFERENCE, rowFrames, rowReference, splitRow, toStrip } from "@/harnesses/monster-collect-species/anim/row";
import { validateSeed } from "@/harnesses/monster-collect-species/seed";
import { HARNESSES, getHarness, harnessesForGenre } from "@/harnesses/_core/registry";
import { renderHarnessIndex } from "@/harnesses/_core/indexMarkdown";
import { decodePng, encodePng, readPng } from "@/harnesses/monster-collect-species/node/png";

const ROOT = resolve(__dirname, "../..");
const OUTLINE: Rgba = [60, 24, 20, 255];
const BODY: Rgba = [230, 120, 40, 255];
const BELLY: Rgba = [245, 220, 170, 255];
const SHADE: Rgba = [170, 70, 30, 255];
const EYE: Rgba = [20, 20, 30, 255];

/** 손으로 정한 작은 몬스터: 몸통 타원 + 배 + 그림자 + 눈 + 한 칸 윤곽 */
function sampleSprite(width = 36, height = 28): RgbaImage {
  const image = createImage(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const inside = (x: number, y: number) => ((x + 0.5 - cx) / (width / 2 - 2)) ** 2 + ((y + 0.5 - cy) / (height / 2 - 2)) ** 2 <= 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) continue;
      let color = BODY;
      if (y > cy + 2 && Math.abs(x - cx) < width / 5) color = BELLY;
      else if (x > cx + width / 5) color = SHADE;
      setPixel(image, x, y, color);
    }
  }
  setPixel(image, Math.floor(cx - 5), Math.floor(cy - 3), EYE);
  setPixel(image, Math.floor(cx - 4), Math.floor(cy - 3), EYE);
  // 한 칸 윤곽
  const withOutline = createImage(width, height);
  withOutline.data.set(image.data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixelAt(image, x, y)[3]) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const nx = x + ox!;
        const ny = y + oy!;
        return nx >= 0 && ny >= 0 && nx < width && ny < height && pixelAt(image, nx, ny)[3] > 0;
      });
      if (touches) setPixel(withOutline, x, y, OUTLINE);
    }
  }
  return withOutline;
}

/**
 * 생성기 흉내: 칸을 block 크기 블록으로 키우되 몇 줄은 ±1 밀리고(격자 흔들림), 블록 경계는 이웃 색과 섞이며(번짐),
 * 픽셀마다 ±3 잡음이 있다. 배경은 마젠타 또는 검정.
 */
type Jitter = (index: number) => number;
const DEFAULT_JITTER_X: Jitter = (i) => (i % 5 === 2 ? 1 : i % 7 === 3 ? -1 : 0);
const DEFAULT_JITTER_Y: Jitter = (j) => (j % 6 === 1 ? 1 : j % 4 === 3 ? -1 : 0);

function fakeGenerated(cells: RgbaImage, block: number, background: Rgba, pad = 40, jitterX = DEFAULT_JITTER_X, jitterY = DEFAULT_JITTER_Y): RgbaImage {
  const widths = Array.from({ length: cells.width }, (_, i) => block + jitterX(i));
  const heights = Array.from({ length: cells.height }, (_, j) => block + jitterY(j));
  const xs = [pad];
  for (const w of widths) xs.push(xs[xs.length - 1]! + w);
  const ys = [pad];
  for (const h of heights) ys.push(ys[ys.length - 1]! + h);
  const image = createImage(xs[xs.length - 1]! + pad, ys[ys.length - 1]! + pad);
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 7) - 3;
  };
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const i = xs.findIndex((v, k) => k < cells.width && x >= v && x < xs[k + 1]!);
      const j = ys.findIndex((v, k) => k < cells.height && y >= v && y < ys[k + 1]!);
      let color: Rgba = background;
      if (i >= 0 && j >= 0) {
        const cell = pixelAt(cells, i, j);
        if (cell[3]) color = cell;
        // 블록 첫 줄·첫 칸은 왼쪽/위 이웃과 반씩 섞인다
        const left = i > 0 && x === xs[i] ? pixelAt(cells, i - 1, j) : null;
        const top = j > 0 && y === ys[j] ? pixelAt(cells, i, j - 1) : null;
        const blend = left ?? top;
        if (blend) {
          const other = blend[3] ? blend : background;
          color = [(color[0] + other[0]) >> 1, (color[1] + other[1]) >> 1, (color[2] + other[2]) >> 1, 255];
        }
      }
      const n = color === background ? 0 : noise();
      setPixel(image, x, y, [color[0] + n, color[1] + n, color[2] + n, 255]);
    }
  }
  return image;
}

function matchRatio(a: RgbaImage, b: RgbaImage): number {
  const aa = cropToInk(a);
  const bb = cropToInk(b);
  if (aa.width !== bb.width || aa.height !== bb.height) return 0;
  let same = 0;
  let total = 0;
  for (let y = 0; y < aa.height; y += 1) {
    for (let x = 0; x < aa.width; x += 1) {
      const p = pixelAt(aa, x, y);
      const q = pixelAt(bb, x, y);
      if (!p[3] && !q[3]) continue;
      total += 1;
      if (p[3] && q[3] && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) <= 12) same += 1;
    }
  }
  return same / total;
}

describe("monster-collect-species 도트화", () => {
  const sprite = sampleSprite();
  // 격자 추출 결과는 잉크 상자로 잘린다 — 비교 기준도 잉크 상자
  const ink = cropToInk(sprite);

  it("마젠타 배경 생성 그림에서 격자를 찾아 원래 도트를 되살린다", () => {
    const { cells, block } = extractGrid(fakeGenerated(sprite, 12, [255, 0, 255, 255]));
    expect(block).toBeGreaterThanOrEqual(11);
    expect(block).toBeLessThanOrEqual(13);
    expect([cells.width, cells.height]).toEqual([ink.width, ink.height]);
    expect(matchRatio(cells, sprite)).toBeGreaterThan(0.97);
  });

  it("13px 이 많은 14px 격자에서도 원래 칸 수를 찾는다", () => {
    // 2026-10-01 리프링 뒷모습: 13px 블록이 14px 보다 많으면 「몫 반올림 투표」는 13/2·14/2 가 모두 7 로 가서 7 이 이겼다.
    const thirteenHeavy: Jitter = (i) => (i % 5 < 3 ? -1 : 0);
    const { cells, block } = extractGrid(fakeGenerated(sprite, 14, [255, 0, 255, 255], 40, thirteenHeavy, thirteenHeavy));
    expect(block).toBeGreaterThanOrEqual(13);
    expect(cells.width).toBe(ink.width);
  });

  it("실제 실패 그림(리프링 뒷모습, 블록 14px)의 경계 간격에서 14 를 고른다", () => {
    const { gaps } = JSON.parse(readFileSync(join(ROOT, "test/fixtures/harnesses/leafling-back-block-gaps.json"), "utf8")) as { gaps: number[] };
    // 예전 방식: 몫을 반올림해 투표. 같은 자료에서 반 크기를 골라 칸을 둘로 쪼갰다 — 자료가 그 실패를 담고 있는지 함께 확인한다.
    const roundedVote = (values: number[]) => {
      const votes = new Map<number, number>();
      for (const gap of values) for (const k of [1, 2, 3]) {
        const q = Math.round(gap / k);
        if (q >= 5 && q <= 40) votes.set(q, (votes.get(q) ?? 0) + 1 / k);
      }
      return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    };
    expect(roundedVote(gaps)).toBeLessThan(10);
    expect(chooseBlock(gaps)).toBe(14);
  });

  it("검정 배경도 가장자리와 이어진 부분만 지운다 (어두운 윤곽은 남긴다)", () => {
    const { cells } = extractGrid(fakeGenerated(sprite, 10, [0, 0, 0, 255]));
    expect(cells.width).toBe(ink.width);
    expect(matchRatio(cells, sprite)).toBeGreaterThan(0.97);
  });

  it("색을 kmax 이하로 합치고 마젠타 번짐 점을 지운다", () => {
    const noisy = createImage(30, 30);
    for (let y = 0; y < 30; y += 1) for (let x = 0; x < 30; x += 1) setPixel(noisy, x, y, [200 + ((x * 3 + y) % 30), 100 + (y % 20), 50, 255]);
    setPixel(noisy, 15, 15, [250, 10, 240, 255]);
    const { image, colors } = tidyCells(noisy, 20);
    expect(colors).toBeLessThanOrEqual(20);
    expect(spriteStats(image).magentaPixels).toBe(0);
    const cast = createImage(5, 5);
    for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) setPixel(cast, x, y, BODY);
    setPixel(cast, 2, 2, [150, 10, 110, 255]);
    const cleaned = removeMagentaCasts(cast);
    expect(cleaned.removed).toBe(1);
    expect(pixelAt(cleaned.image, 2, 2)).toEqual(BODY);
  });

  it("정수배 축소에서 한 칸 윤곽을 살린다", () => {
    const big = createImage(sprite.width * 2, sprite.height * 2);
    for (let y = 0; y < big.height; y += 1) {
      for (let x = 0; x < big.width; x += 1) {
        const p = pixelAt(sprite, x >> 1, y >> 1);
        // 큰 그림의 윤곽은 한 칸 두께: 2x2 중 바깥쪽 한 칸만 윤곽색
        if (p[3] && p[0] === OUTLINE[0] && (x + y) % 2 === 1) setPixel(big, x, y, BODY);
        else setPixel(big, x, y, p);
      }
    }
    const small = downscaleBy(big, 2);
    expect(spriteStats(small).outlineRatio).toBeGreaterThan(0.85);
  });

  it("몸집 규칙: 납작한 종은 비정수, 정수배에 가까우면 정수, 작으면 그대로", () => {
    expect(chooseScale(165, 94, "front")).toEqual({ kind: "fraction", width: 106 });
    expect(chooseScale(152, 147, "front")).toEqual({ kind: "integer", factor: 2 });
    expect(chooseScale(86, 68, "back")).toEqual({ kind: "keep" });
  });

  it("진화 단계가 오를수록 같은 원본을 더 크게 남긴다", () => {
    const width = (plan: ReturnType<typeof chooseScale>) => (plan.kind === "fraction" ? plan.width : plan.kind === "integer" ? Math.ceil(100 / plan.factor) : 100);
    const sizes = ([1, 2, 3] as const).map((stage) => width(chooseScale(100, 100, "front", stage)));
    expect(sizes).toEqual([80, 90, 100]);
    // 긴 변 상한(108)이 먼저 걸리면 단계 차이가 사라진다 — 큰 원본은 2·3단계가 같은 크기가 될 수 있다
    expect(width(chooseScale(160, 100, "front", 3))).toBe(108);
  });

  it("112 캔버스에 가운데·바닥 정렬로 맞추고 검사를 통과한다", () => {
    const { sprite: out } = fitSprite(sprite, "front");
    expect(out.width).toBe(SPRITE_CANVAS);
    expect(out.height).toBe(SPRITE_CANVAS);
    const box = opaqueBounds(out)!;
    expect(box.y + box.height).toBe(SPRITE_CANVAS);
    expect(Math.abs(box.x + box.width / 2 - SPRITE_CANVAS / 2)).toBeLessThanOrEqual(1);
    expect(checkSprite(out, 20).issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("검사가 잘못된 캔버스·마젠타·다른 색 뒷모습을 잡는다", () => {
    const bad = checkSprite(sprite, 20).issues.map((i) => i.message).join(" ");
    expect(bad).toContain("캔버스");
    const { sprite: front } = fitSprite(sprite, "front");
    const blue = createImage(sprite.width, sprite.height);
    for (let y = 0; y < sprite.height; y += 1) for (let x = 0; x < sprite.width; x += 1) {
      const p = pixelAt(sprite, x, y);
      if (p[3]) setPixel(blue, x, y, [p[2], p[1], p[0], 255]);
    }
    expect(checkPair(front, fitSprite(blue, "back").sprite).length).toBe(1);
    expect(checkPair(front, fitSprite(sprite, "back").sprite)).toEqual([]);
  });

  it("다음 생성 참고 이미지는 1254 마젠타 캔버스에 정수배 도트", () => {
    const ref = cleanReference(sprite);
    expect([ref.width, ref.height]).toEqual([1254, 1254]);
    expect(pixelAt(ref, 0, 0)).toEqual([255, 0, 255, 255]);
    // 마젠타가 아닌 칸의 상자 폭은 잉크 폭의 정수배
    let minX = ref.width;
    let maxX = -1;
    for (let y = 0; y < ref.height; y += 1) for (let x = 0; x < ref.width; x += 1) {
      const p = pixelAt(ref, x, y);
      if (!(p[0] === 255 && p[1] === 0 && p[2] === 255)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    }
    expect((maxX - minX + 1) % ink.width).toBe(0);
    expect((maxX - minX + 1) / ink.width).toBeGreaterThan(1);
  });

  it("pixelize = 격자 + 정리, PNG 왕복이 무손실", () => {
    const generated = fakeGenerated(sprite, 11, [255, 0, 255, 255]);
    const round = decodePng(encodePng(generated));
    expect(Buffer.from(round.data)).toEqual(Buffer.from(generated.data));
    const { grid, colors } = pixelize(round);
    expect(colors).toBeLessThanOrEqual(20);
    expect(matchRatio(grid, sprite)).toBeGreaterThan(0.97);
  });
});

/** 큰 동작 한 줄 흉내: 같은 몬스터 frames 장을 칸마다 다른 높이·앞쏠림으로 늘어놓는다 (칸 사이 빈 칸 6) */
function sampleRow(frames: number): RgbaImage {
  const sprite = sampleSprite();
  const gap = 6;
  const row = createImage(frames * (sprite.width + gap) + gap, sprite.height + 4);
  for (let k = 0; k < frames; k += 1) {
    const lift = k % 2;
    const lean = k === 2 ? -2 : 0;
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        const p = pixelAt(sprite, x, y);
        if (p[3]) setPixel(row, gap + k * (sprite.width + gap) + x + lean, 2 + y - lift, p);
      }
    }
  }
  return row;
}

describe("monster-collect-species 애니메이션", () => {
  const sprite = fitSprite(sampleSprite(72, 56), "front").sprite;

  it("대기: 0번은 원본 그대로, 발 줄은 고정, 프레임 사이 변화는 작다", () => {
    for (const side of ["front", "back"] as const) {
      const frames = idleFrames(sprite, side, { flicker: "flame" });
      expect(frames).toHaveLength(IDLE_PLAN.length);
      expect(checkFrames(frames, sprite, 20, "idle")).toEqual([]);
      for (let k = 0; k < frames.length; k += 1) {
        const a = frames[k]!;
        const b = frames[(k + 1) % frames.length]!;
        let changed = 0;
        let ink = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          if (!a.data[i + 3] && !b.data[i + 3]) continue;
          ink += 1;
          if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) changed += 1;
        }
        expect(changed / ink, `${side} ${k}→${k + 1}`).toBeLessThan(0.35);
      }
    }
  });

  it("대기 검사는 0번이 다르거나 발이 움직이면 오류", () => {
    const frames = idleFrames(sprite, "front");
    const moved = frames.map((f) => ({ ...f, data: new Uint8ClampedArray(f.data) }));
    const box = opaqueBounds(sprite)!;
    setPixel(moved[2]!, box.x + 3, box.y + box.height - 1, [0, 0, 0, 0]);
    setPixel(moved[0]!, box.x + 5, box.y + 2, [1, 2, 3, 255]);
    const messages = checkFrames(moved, sprite, 20, "idle").map((i) => i.message);
    expect(messages.some((m) => m.includes("0번 프레임"))).toBe(true);
    expect(messages.some((m) => m.includes("프레임 2: 발"))).toBe(true);
  });

  it("큰 동작 참고 그림: 2172×724 마젠타, 첫 칸에만 기준 스프라이트", () => {
    const reference = rowReference(sprite, 4);
    expect([reference.width, reference.height]).toEqual([ROW_REFERENCE.width, ROW_REFERENCE.height]);
    expect(pixelAt(reference, 5, 5)).toEqual([255, 0, 255, 255]);
    const inkIn = (x0: number, x1: number) => {
      let n = 0;
      for (let y = 100; y < 700; y += 1) for (let x = x0; x < x1; x += 1) {
        const p = pixelAt(reference, x, y);
        if (!(p[0] === 255 && p[1] === 0 && p[2] === 255) && !(p[0] === 51 && p[1] === 51)) n += 1;
      }
      return n;
    };
    expect(inkIn(40, 500)).toBeGreaterThan(1000);
    expect(inkIn(560, 2100)).toBe(0);
  });

  it("한 줄 → 프레임 나누기: 생성 그림 흉내에서 4장, 같은 배율, 바닥 정렬", () => {
    const { grid } = pixelize(fakeGenerated(sampleRow(4), 12, [255, 0, 255, 255]), 20);
    const parts = splitRow(grid, 4);
    expect(parts).toHaveLength(4);
    const { frames, clipped } = rowFrames(parts, "front");
    // 기준 폭을 주면 0번 잉크 폭이 그 폭이 된다 (크면 줄이고, 작으면 그대로)
    expect(opaqueBounds(rowFrames(parts, "front", 1, parts[0]!.width - 6).frames[0]!)!.width).toBe(parts[0]!.width - 6);
    expect(opaqueBounds(rowFrames(parts, "front", 1, parts[0]!.width + 20).frames[0]!)!.width).toBe(parts[0]!.width);
    expect(clipped).toBe(0);
    const sizes = frames.map((f) => opaqueBounds(f)!);
    for (const box of sizes) {
      expect(box.y + box.height).toBe(SPRITE_CANVAS);
      expect(box.width).toBe(sizes[0]!.width);
    }
    // 앞쏠림(2번 프레임 -2칸)은 발 맞춤 뒤에도 정렬되어 같은 자리에 선다 — 발 위치 기준 정렬
    expect(Math.abs(sizes[2]!.x - sizes[0]!.x)).toBeLessThanOrEqual(1);
    expect(fromStrip(toStrip(frames), 4).map((f) => f.data.every((v, i) => v === frames[0]!.data[i]))[0]).toBe(true);
    expect(() => splitRow(grid, 6)).toThrow("큰 덩어리가 4개");
  });
});

describe("monster-collect-species 시드·레지스트리", () => {
  it("커밋된 seed.json 이 유효하고 잘못된 시드는 거부한다", () => {
    const seed = validateSeed(JSON.parse(readFileSync(join(ROOT, "harness-data/monster-collect-species/seed.json"), "utf8")));
    expect(seed.species.map((s) => s.id)).toEqual(["sparkit", "aqualing", "leafling"]);
    const base = { version: 1, style: seed.style, animation: seed.animation };
    expect(() => validateSeed({ ...base, species: [seed.species[0], seed.species[0]] })).toThrow("중복");
    expect(() => validateSeed({ ...base, species: [{ ...seed.species[0], id: "evo", stage: 2, evolvesFrom: "nope" }] })).toThrow("evolvesFrom");
    expect(() => validateSeed({ ...base, animation: undefined, species: seed.species })).toThrow("animation");
    expect(() => validateSeed({ ...base, animation: { ...seed.animation, idle: { ...seed.animation.idle, frames: 6 } }, species: seed.species })).toThrow("IDLE_PLAN");
    expect(() => validateSeed({ ...base, animation: { ...seed.animation, actions: { idle: seed.animation.actions.attack } }, species: seed.species })).toThrow("idle 은 동작");
    expect(() => validateSeed({ ...base, animation: { ...seed.animation, actions: { spin: { ...seed.animation.actions.attack, frames: 9 } } }, species: seed.species })).toThrow("2~6");
  });

  it("장르 범위: 몬스터 수집 프로젝트에서만 보인다", () => {
    expect(getHarness("monster-collect-species")?.scope.genre).toBe("monster-collect");
    expect(harnessesForGenre("monster-collect").map((h) => h.id)).toContain("monster-collect-species");
    expect(harnessesForGenre("adventure-jrpg").map((h) => h.id)).not.toContain("monster-collect-species");
  });

  it("src/harnesses/INDEX.md 가 매니페스트와 같다 (npm run harness -- list)", () => {
    expect(readFileSync(join(ROOT, "src/harnesses/INDEX.md"), "utf8")).toBe(renderHarnessIndex(HARNESSES));
  });

  it("커밋된 번들 스프라이트가 검사를 통과한다", () => {
    const seed = validateSeed(JSON.parse(readFileSync(join(ROOT, "harness-data/monster-collect-species/seed.json"), "utf8")));
    for (const species of seed.species) {
      const front = readPng(join(ROOT, "public/assets/harnesses/monster-collect-species", species.id, "front.png"));
      const back = readPng(join(ROOT, "public/assets/harnesses/monster-collect-species", species.id, "back.png"));
      expect(checkSprite(front, seed.style.maxColors).issues.filter((i) => i.level === "error"), `${species.id} front`).toEqual([]);
      expect(checkSprite(back, seed.style.maxColors).issues.filter((i) => i.level === "error"), `${species.id} back`).toEqual([]);
      expect(checkPair(front, back), `${species.id} 앞·뒤`).toEqual([]);
    }
  });
});

describe("monster-collect-species CLI (모래상자, 네트워크 없음)", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "mcs-harness-"));
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("import → pick → build → check 가 모래상자 안에서만 쓴다", async () => {
    mkdirSync(join(sandbox, "data"), { recursive: true });
    const seed = JSON.parse(readFileSync(join(ROOT, "harness-data/monster-collect-species/seed.json"), "utf8"));
    writeFileSync(join(sandbox, "data/seed.json"), JSON.stringify({ ...seed, species: [seed.species[0]] }));
    const raw = join(sandbox, "raw.png");
    writeFileSync(raw, encodePng(fakeGenerated(sampleSprite(), 12, [255, 0, 255, 255])));
    const ledgerBefore = readFileSync(join(ROOT, "harness-data/monster-collect-species/ledger.json"), "utf8");

    vi.stubEnv("MONSTER_HARNESS_SANDBOX", sandbox);
    vi.resetModules();
    const cli = await import("@/harnesses/monster-collect-species/node/cli");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      for (const which of ["front", "back"] as const) {
        expect(await cli.run(["import", "--species", "sparkit", "--side", which, "--raw", raw])).toBe(0);
        const runDir = join(sandbox, "runs/sparkit", which);
        const runId = readdirSync(runDir)[0]!;
        expect(JSON.parse(readFileSync(join(runDir, runId, "run.json"), "utf8")).candidates).toHaveLength(1);
        expect(await cli.run(["pick", "--species", "sparkit", "--side", which, "--run", runId, "--candidate", "1"])).toBe(0);
      }
      // 큰 동작: 한 줄 원본을 가져와 고르고 굽는다
      const rowRaw = join(sandbox, "row.png");
      writeFileSync(rowRaw, encodePng(fakeGenerated(sampleRow(4), 12, [255, 0, 255, 255])));
      expect(await cli.run(["import", "--species", "sparkit", "--side", "front", "--action", "attack", "--raw", rowRaw])).toBe(0);
      const actionDir = join(sandbox, "runs/sparkit/front-attack");
      const actionRun = readdirSync(actionDir)[0]!;
      expect(JSON.parse(readFileSync(join(actionDir, actionRun, "run.json"), "utf8")).candidates).toHaveLength(1);
      expect(await cli.run(["pick", "--species", "sparkit", "--side", "front", "--action", "attack", "--run", actionRun, "--candidate", "1"])).toBe(0);
      expect(await cli.run(["build"])).toBe(0);
      expect(await cli.run(["check"])).toBe(0);
      expect(await cli.run(["preview"])).toBe(0);
      expect(await cli.run(["pick", "--species", "nope", "--side", "front", "--run", "x", "--candidate", "1"]).catch((e: Error) => e.message)).toContain("시드에 종 nope");
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
    }
    const ledger = JSON.parse(readFileSync(join(sandbox, "data/ledger.json"), "utf8"));
    expect(ledger.picks.sparkit.front.grid).toBe("grids/sparkit-front.png");
    const built = readPng(join(sandbox, "bundle/sparkit/front.png"));
    expect([built.width, built.height]).toEqual([SPRITE_CANVAS, SPRITE_CANVAS]);
    expect(ledger.actions.sparkit.front.attack).toMatchObject({ grid: "grids/sparkit-front-attack.png", frames: 4 });
    const anim = JSON.parse(readFileSync(join(sandbox, "bundle/sparkit/anim.json"), "utf8"));
    expect(Object.keys(anim.sides.front)).toEqual(["idle", "attack"]);
    expect(Object.keys(anim.sides.back)).toEqual(["idle"]);
    expect(anim.sides.front.attack).toMatchObject({ path: "anim/front-attack.png", frames: 4, loop: false, source: "row-generation" });
    expect(readPng(join(sandbox, "bundle/sparkit/anim/front-idle.png")).width).toBe(SPRITE_CANVAS * 4);
    // 커밋된 기록은 그대로
    expect(readFileSync(join(ROOT, "harness-data/monster-collect-species/ledger.json"), "utf8")).toBe(ledgerBefore);
  });
});
