/**
 * 전투 트레이너 생성 도우미 — monster-collect-species 의 이미지 서버 호출·격자 도트화·정리를 그대로 가져다 쓴다(복사 없음).
 * harness.py 가 하위 프로세스로 부른다.
 *
 *   gen.ts reference --out ref.png --samples a.png,b.png,c.png [--scale 6]
 *   gen.ts generate  --prompt-file p.txt --reference ref.png --out raw.png --slug s [--tries 4]
 *   gen.ts pixelize  --raw raw.png --out-dir dir [--max-colors 16]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generateImage } from "../../monster-collect-species/node/imageSource";
import { encodePng, readPng, writePng } from "../../monster-collect-species/node/png";
import { pixelize } from "../../monster-collect-species/pixel/pipeline";
import { downscaleBy, downscaleTo } from "../../monster-collect-species/pixel/downscale";
import { removeMagentaCasts } from "../../monster-collect-species/pixel/tidy";
import { spriteStats } from "../../monster-collect-species/checks/checks";
import { composeOn, createImage, cropToInk, pixelAt, scaleNearest, setPixel, type RgbaImage } from "../../monster-collect-species/pixel/image";

const CANVAS = 64;
const FOOT_ROW = 62; // 발 바닥 줄(아래 1칸 여백)
const MAX_H = 58;
const MAX_W = 60;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} 가 필요하다`);
  }
  return process.argv[i + 1]!;
}

function reference(): void {
  const scale = Number(arg("scale", "6"));
  const files = arg("samples").split(",");
  const size = 1254;
  const out = composeOn([255, 0, 255, 255], size, size, createImage(0, 0), 0, 0);
  const tiles = files.map((f) => scaleNearest(cropToInk(readPng(f)), scale));
  const gap = 40;
  const total = tiles.reduce((sum, t) => sum + t.width, 0) + gap * (tiles.length - 1);
  const maxH = Math.max(...tiles.map((t) => t.height));
  let x = Math.max(10, Math.floor((size - total) / 2));
  for (const t of tiles) {
    const top = Math.floor((size - maxH) / 2) + (maxH - t.height); // 발 줄 정렬
    for (let yy = 0; yy < t.height; yy += 1) for (let xx = 0; xx < t.width; xx += 1) {
      const p = pixelAt(t, xx, yy);
      if (p[3]) setPixel(out, x + xx, top + yy, p);
    }
    x += t.width + gap;
  }
  writePng(arg("out"), out);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(): Promise<void> {
  const prompt = readFileSync(arg("prompt-file"), "utf8");
  const ref = readFileSync(arg("reference"));
  const tries = Number(arg("tries", "4"));
  let last = "";
  for (let i = 0; i < tries; i += 1) {
    try {
      const bytes = await generateImage({ prompt, reference: ref, slug: arg("slug") }, 1);
      writeFileSync(arg("out"), bytes);
      return;
    } catch (error) {
      last = String(error instanceof Error ? error.message : error);
      await sleep(15000 * (i + 1)); // 503·용량 부족이면 백오프
    }
  }
  throw new Error(last);
}

function fit(grid: RgbaImage): { sprite: RgbaImage; factor: number; ink: { width: number; height: number } } {
  const ink = cropToInk(grid);
  const scale = Math.min(1, MAX_H / ink.height, MAX_W / ink.width);
  let scaled = ink;
  if (scale < 1) {
    const factor = 1 / scale;
    const snapped = Math.round(factor);
    scaled = cropToInk(snapped >= 2 && Math.abs(factor - snapped) < 0.15 ? downscaleBy(ink, snapped) : downscaleTo(ink, Math.round(ink.width * scale)));
  }
  const body = cropToInk(removeMagentaCasts(scaled).image);
  const sprite = createImage(CANVAS, CANVAS);
  const left = Math.floor((CANVAS - body.width) / 2);
  const top = FOOT_ROW + 1 - body.height;
  for (let y = 0; y < body.height; y += 1) for (let x = 0; x < body.width; x += 1) {
    const p = pixelAt(body, x, y);
    if (p[3] && left + x >= 0 && left + x < CANVAS && top + y >= 0) setPixel(sprite, left + x, top + y, p);
  }
  return { sprite, factor: ink.height / body.height, ink: { width: body.width, height: body.height } };
}

type Eval = { block: number; colors: number; tidy: number; sprite: RgbaImage; grid: RgbaImage; ink: { width: number; height: number }; factor: number; stats: ReturnType<typeof spriteStats>; errors: string[]; warns: string[] };

function evaluate(raw: RgbaImage, block: number | undefined, maxColors: number): Eval {
  const { grid, block: used, colors } = pixelize(raw, maxColors, block ? { block } : {});
  const { sprite, factor, ink } = fit(grid);
  const stats = spriteStats(sprite);
  const errors: string[] = [];
  const warns: string[] = [];
  if (ink.height < 36) errors.push(`그림 높이 ${ink.height}줄은 너무 작다(최소 36)`);
  if (grid.height > MAX_H + 1) errors.push(`격자 높이 ${grid.height}줄은 너무 크다(정수 격자로 ${MAX_H} 이하여야 한다)`);
  if (stats.colors > maxColors) errors.push(`사용 색 ${stats.colors}개(최대 ${maxColors})`);
  if (stats.magentaPixels > 0) errors.push(`마젠타 기운 점 ${stats.magentaPixels}개`);
  let touch = 0;
  let opaque = 0;
  for (let y = 0; y < CANVAS; y += 1) for (let x = 0; x < CANVAS; x += 1) {
    if (!pixelAt(sprite, x, y)[3]) continue;
    opaque += 1;
    if (x === 0 || y === 0 || x === CANVAS - 1 || y === CANVAS - 1) touch += 1;
  }
  if (touch > 0) errors.push(`캔버스 가장자리에 닿은 화소 ${touch}개`);
  if (opaque / (CANVAS * CANVAS) < 0.12) errors.push(`불투명 화소 비율 ${(opaque / (CANVAS * CANVAS) * 100).toFixed(0)}% 너무 적다`);
  if (stats.outlineRatio < 0.85) warns.push(`윤곽이 약하다 (가장자리 어두운 칸 ${(stats.outlineRatio * 100).toFixed(0)}%)`);
  if (stats.orphanRatio > 0.12) warns.push(`외톨이 점 ${(stats.orphanRatio * 100).toFixed(1)}%`);
  return { block: used, colors: stats.colors, tidy: colors, sprite, grid, ink, factor, stats, errors, warns };
}

/** 원본 잉크 높이로 격자 크기를 추정한다(자동 탐색은 얼굴이 뭉개지는 큰 블록을 고르기 쉽다). 가까운 블록 몇 개를 다 도트화해 외톨이 점이 가장 적은 것을 쓴다. */
function inkHeight(raw: RgbaImage): number {
  let top = raw.height;
  let bottom = -1;
  for (let y = 0; y < raw.height; y += 1) for (let x = 0; x < raw.width; x += 1) {
    const [r, g, b, a] = pixelAt(raw, x, y);
    if (a < 128 || (r > 170 && b > 170 && g < 120)) continue;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return Math.max(0, bottom - top + 1);
}

function pix(): void {
  const maxColors = Number(arg("max-colors", "16"));
  const dir = arg("out-dir");
  const raw = readPng(arg("raw"));
  const fixed = arg("block", "");
  const est = Math.round(inkHeight(raw) / 56);
  const blocks = fixed ? [Number(fixed)] : [...new Set([est - 2, est - 1, est, est + 1].map((b) => Math.min(24, Math.max(4, b))))];
  const evals: Eval[] = [];
  for (const b of blocks) {
    try { evals.push(evaluate(raw, b, maxColors)); } catch { /* 이 블록은 격자가 안 맞음 */ }
  }
  if (evals.length === 0) throw new Error("도트화 실패 — 격자를 찾지 못했다");
  const good = evals.filter((e) => e.errors.length === 0);
  const pool = good.length ? good : evals;
  pool.sort((a, b) => a.stats.orphanRatio - b.stats.orphanRatio);
  const best = pool[0]!;
  writePng(`${dir}/grid.png`, best.grid);
  writePng(`${dir}/sprite.png`, best.sprite);
  console.log(JSON.stringify({ block: best.block, estBlock: est, tried: evals.map((e) => [e.block, +e.stats.orphanRatio.toFixed(3), e.errors.length]), colors: best.colors, tidyColors: best.tidy, ink: best.ink, factor: Math.round(best.factor * 100) / 100, outlineRatio: best.stats.outlineRatio, orphanRatio: best.stats.orphanRatio, errors: best.errors, warnings: best.warns }));
}

const cmd = process.argv.find((a) => a === "reference" || a === "generate" || a === "pixelize");
try {
  if (cmd === "reference") reference();
  else if (cmd === "generate") await generate();
  else if (cmd === "pixelize") pix();
  else throw new Error("gen.ts reference|generate|pixelize");
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
void encodePng;
