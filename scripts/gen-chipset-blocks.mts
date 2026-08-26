// 칩셋을 "끊기지 않은 연속 아틀라스"로 굽는다 — 6x 업스케일, 타일 경계선 없음, 바깥 여백에만 좌표 눈금.
//
// 왜 strips 로 부족한가 (실측): gen-chipset-strips.mts 는 칩셋 1행(30타일)을 15열 x 2단으로 접어
// 보여준다. 그래서 세로로 이어지는 물건이 끊기고, 가로로 늘어선 물건은 벽처럼 보인다.
// 실측 사례 — retro_house 12~17 은 2단 침대다(12-14 = 상단 베개 줄, 15-17 = 하단 크림 매트리스).
// strips 로만 본 비전 자식은 이 여섯 칸을 "timber-framed house wall" 이라 읽었다. 3x2 로 붙여
// 보면 침대가 드러난다. 즉 판독에는 인덱스 확실성(strips)과 물건 연속성(이 스크립트)이 둘 다 필요하다.
//
// 그래서 타일 경계선을 그리지 않는다. 격자선은 여러 칸에 걸친 물건을 다시 쪼개 놓기 때문이다.
// 좌표는 아트 영역 바깥 여백에만 찍는다: 위쪽에 열 번호(0-29), 왼쪽에 행 번호.
// 인덱스 = 행 * 30 + 열.
//
// 출력:
//   <outDir>/<sheet>/block-<a>-<b>.png   4행씩 연속 아틀라스 (샤드 입력)
//   <outDir>/<sheet>/sheet-full.png      16행 전체 연속 아틀라스 (최대 맥락)
//
// 사용:
//   vite-node scripts/gen-chipset-blocks.mts --out .omo/evidence/tile-reaudit/blocks
//   vite-node scripts/gen-chipset-blocks.mts --sheet retro_house --out /tmp/blocks

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SHEETS: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};

const COLS = 30;
const TILE = 16;
const SCALE = 6;
const CELL = TILE * SCALE;
const KEY_COLOR = { r: 255, g: 103, b: 139 } as const;
const KEY_TOLERANCE = 12;

const RULER_TOP = 26;
const RULER_LEFT = 34;
const PAD = 6;

/** 5x7 숫자 비트맵 — 좌표 눈금 전용. gen-chipset-strips.mts 와 같은 글리프. */
const DIGITS: readonly string[][] = [
  ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"],
  ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"],
  ["#####", "....#", "....#", "#####", "#....", "#....", "#####"],
  ["#####", "....#", "....#", "#####", "....#", "....#", "#####"],
  ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  ["#####", "#....", "#....", "#####", "....#", "....#", "#####"],
  ["#####", "#....", "#....", "#####", "#...#", "#...#", "#####"],
  ["#####", "....#", "....#", "...#.", "..#..", ".#...", ".#..."],
  ["#####", "#...#", "#...#", "#####", "#...#", "#...#", "#####"],
  ["#####", "#...#", "#...#", "#####", "....#", "....#", "#####"],
];

interface Canvas {
  readonly png: PNG;
  readonly w: number;
  readonly h: number;
}

function canvas(w: number, h: number, bg: readonly [number, number, number, number]): Canvas {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = bg[0];
    png.data[i + 1] = bg[1];
    png.data[i + 2] = bg[2];
    png.data[i + 3] = bg[3];
  }
  return { png, w, h };
}

function px(c: Canvas, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  const sa = a / 255;
  c.png.data[i] = Math.round(r * sa + c.png.data[i]! * (1 - sa));
  c.png.data[i + 1] = Math.round(g * sa + c.png.data[i + 1]! * (1 - sa));
  c.png.data[i + 2] = Math.round(b * sa + c.png.data[i + 2]! * (1 - sa));
  c.png.data[i + 3] = 255;
}

function drawDigits(c: Canvas, text: string, x0: number, y0: number, scale: number): void {
  let cx = x0;
  for (const ch of text) {
    const glyph = DIGITS[Number(ch)];
    if (!glyph) {
      cx += 3 * scale;
      continue;
    }
    glyph.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== "#") return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) px(c, cx + rx * scale + dx, y0 + ry * scale + dy, 24, 28, 44, 255);
        }
      });
    });
    cx += (5 + 1) * scale;
  }
}

/** 체커 배경 — 투명 픽셀을 흰/검 아트와 구분해 보이게 한다. */
function checker(c: Canvas, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const v = on ? 214 : 184;
      const i = ((y0 + y) * c.w + (x0 + x)) * 4;
      c.png.data[i] = v;
      c.png.data[i + 1] = v;
      c.png.data[i + 2] = v + 6;
      c.png.data[i + 3] = 255;
    }
  }
}

/** 타일 하나를 아틀라스에 올린다. 경계선은 그리지 않는다 — 여러 칸 물건의 연속성이 판독의 핵심이다. */
function blitTile(c: Canvas, src: PNG, index: number, x0: number, y0: number): void {
  const srcRow = Math.floor(index / COLS);
  const srcCol = index % COLS;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const si = ((srcRow * TILE + y) * src.width + (srcCol * TILE + x)) * 4;
      const a = src.data[si + 3]!;
      if (a <= 8) continue;
      const r = src.data[si]!;
      const g = src.data[si + 1]!;
      const b = src.data[si + 2]!;
      const keyed = Math.abs(r - KEY_COLOR.r) + Math.abs(g - KEY_COLOR.g) + Math.abs(b - KEY_COLOR.b) < KEY_TOLERANCE;
      if (keyed) continue;
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          px(c, x0 + x * SCALE + dx, y0 + y * SCALE + dy, r, g, b, a);
        }
      }
    }
  }
}

function buildAtlas(src: PNG, rowA: number, rowB: number): Canvas {
  const rows = rowB - rowA + 1;
  const artW = COLS * CELL;
  const artH = rows * CELL;
  const w = RULER_LEFT + artW + PAD;
  const h = RULER_TOP + artH + PAD;
  const c = canvas(w, h, [248, 249, 252, 255]);

  checker(c, RULER_LEFT, RULER_TOP, artW, artH);

  for (let row = rowA; row <= rowB; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      blitTile(c, src, row * COLS + col, RULER_LEFT + col * CELL, RULER_TOP + (row - rowA) * CELL);
    }
  }

  // 열 번호 — 아트 영역 위쪽 여백. 각 타일 칼럼 중앙에 정렬.
  for (let col = 0; col < COLS; col += 1) {
    const label = String(col);
    const wGlyph = label.length * 6 * 2 - 2;
    drawDigits(c, label, RULER_LEFT + col * CELL + Math.round((CELL - wGlyph) / 2), 6, 2);
  }
  // 행 번호 — 아트 영역 왼쪽 여백. 각 타일 행 중앙에 정렬.
  for (let row = rowA; row <= rowB; row += 1) {
    const label = String(row);
    const wGlyph = label.length * 6 * 3 - 3;
    drawDigits(c, label, Math.round((RULER_LEFT - PAD - wGlyph) / 2), RULER_TOP + (row - rowA) * CELL + Math.round(CELL / 2) - 10, 3);
  }
  return c;
}

function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1]! : ".omo/evidence/tile-reaudit/blocks";
  const sheetIdx = args.indexOf("--sheet");
  const only = sheetIdx >= 0 ? args[sheetIdx + 1] : undefined;

  const targets = only ? { [only]: SHEETS[only]! } : SHEETS;
  if (only && !SHEETS[only]) {
    console.error(`알 수 없는 시트: ${only} (가능: ${Object.keys(SHEETS).join(", ")})`);
    process.exit(2);
  }

  let wrote = 0;
  for (const [sheet, pngPath] of Object.entries(targets)) {
    const src = PNG.sync.read(fs.readFileSync(pngPath));
    const dir = path.join(outDir, sheet);
    fs.mkdirSync(dir, { recursive: true });

    for (let block = 0; block < 4; block += 1) {
      const rowA = block * 4;
      const rowB = rowA + 3;
      const c = buildAtlas(src, rowA, rowB);
      const name = `block-${String(rowA).padStart(2, "0")}-${String(rowB).padStart(2, "0")}.png`;
      fs.writeFileSync(path.join(dir, name), PNG.sync.write(c.png));
      wrote += 1;
    }

    const full = buildAtlas(src, 0, 15);
    fs.writeFileSync(path.join(dir, "sheet-full.png"), PNG.sync.write(full.png));
    wrote += 1;
    console.log(`${sheet}: 4 blocks + full sheet -> ${dir}`);
  }
  console.log(`wrote ${wrote} atlas images`);
}

main();
