// 칩셋 시트를 "판독용 근거 이미지"로 굽는다 — 8x nearest-neighbor 업스케일 + 타일 인덱스 번호 표기.
//
// 왜: 16x16 타일을 원본 배율로 보고 라벨을 쓰면 판독이 추측으로 흐른다. tileSemanticsDungeon.ts 는
// 8x 업스케일 전수 감사로 저작됐고(파일 머리주석), 같은 근거 배율을 재현할 수 있어야 저작이 검증 가능하다.
// 인덱스를 이미지에 직접 박는 이유는 판독자가 타일과 번호를 잘못 짝지우는 실패를 없애기 위해서다.
//
// 출력: <outDir>/<sheet>/row-00.png ... row-15.png (칩셋 1행 = 30타일 = 표시 2행 x 15열)
//       각 타일 아래 흰 띠에 인덱스 숫자.
//
// 사용:
//   vite-node scripts/gen-chipset-strips.mts --out .omo/evidence/chipset-strips
//   vite-node scripts/gen-chipset-strips.mts --sheet ship --out /tmp/strips

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
  // 대조군 — 이미 저작된 시트. 이식 판단에 쓴다.
  combined_town: "public/assets/easyrpg-chipset-combined-town-transparent.png",
  dungeon: "public/assets/easyrpg-chipset-dungeon-transparent.png",
  interior: "public/assets/easyrpg-chipset-interior-transparent.png",
};

const COLS = 30;
const TILE = 16;
const SCALE = 8;
const PER_DISPLAY_ROW = 15;
const CELL = TILE * SCALE; // 128
const LABEL_H = 18;
const GAP = 4;
const MARGIN = 8;

/** 5x7 숫자 비트맵 폰트 — 인덱스 표기 전용(0-9). 각 문자열은 위→아래 7행, '#' 가 점. */
const DIGITS: readonly string[][] = [
  ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"], // 0
  ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"], // 1
  ["#####", "....#", "....#", "#####", "#....", "#....", "#####"], // 2
  ["#####", "....#", "....#", "#####", "....#", "....#", "#####"], // 3
  ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"], // 4
  ["#####", "#....", "#....", "#####", "....#", "....#", "#####"], // 5
  ["#####", "#....", "#....", "#####", "#...#", "#...#", "#####"], // 6
  ["#####", "....#", "....#", "...#.", "..#..", ".#...", ".#..."], // 7
  ["#####", "#...#", "#...#", "#####", "#...#", "#...#", "#####"], // 8
  ["#####", "#...#", "#...#", "#####", "....#", "....#", "#####"], // 9
];

interface Canvas { png: PNG; w: number; h: number }

function canvas(w: number, h: number, rgba: readonly [number, number, number, number]): Canvas {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    png.data[i * 4] = rgba[0];
    png.data[i * 4 + 1] = rgba[1];
    png.data[i * 4 + 2] = rgba[2];
    png.data[i * 4 + 3] = rgba[3];
  }
  return { png, w, h };
}

function px(c: Canvas, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  // 알파 합성 — 투명 소품 타일이 체커 배경 위에 얹히도록.
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
    if (!glyph) { cx += 3 * scale; continue; }
    glyph.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== "#") return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) px(c, cx + rx * scale + dx, y0 + ry * scale + dy, 20, 24, 40, 255);
        }
      });
    });
    cx += (5 + 1) * scale;
  }
}

/** 체커 배경 — 투명 픽셀과 흰/검 픽셀을 구분해 보이게 한다. */
function checker(c: Canvas, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const v = on ? 214 : 184;
      const i = ((y0 + y) * c.w + (x0 + x)) * 4;
      c.png.data[i] = v; c.png.data[i + 1] = v; c.png.data[i + 2] = v + 6; c.png.data[i + 3] = 255;
    }
  }
}

function buildRowImage(src: PNG, sheetRow: number): Canvas {
  const displayRows = Math.ceil(COLS / PER_DISPLAY_ROW);
  const w = MARGIN * 2 + PER_DISPLAY_ROW * CELL + (PER_DISPLAY_ROW - 1) * GAP;
  const h = MARGIN * 2 + displayRows * (CELL + LABEL_H + GAP);
  const c = canvas(w, h, [248, 249, 252, 255]);

  for (let col = 0; col < COLS; col += 1) {
    const index = sheetRow * COLS + col;
    const dr = Math.floor(col / PER_DISPLAY_ROW);
    const dc = col % PER_DISPLAY_ROW;
    const x0 = MARGIN + dc * (CELL + GAP);
    const y0 = MARGIN + dr * (CELL + LABEL_H + GAP);

    checker(c, x0, y0, CELL, CELL);
    let opaque = false;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const si = ((sheetRow * TILE + y) * src.width + (col * TILE + x)) * 4;
        const a = src.data[si + 3]!;
        if (a > 8) opaque = true;
        for (let dy = 0; dy < SCALE; dy += 1) {
          for (let dx = 0; dx < SCALE; dx += 1) {
            px(c, x0 + x * SCALE + dx, y0 + y * SCALE + dy, src.data[si]!, src.data[si + 1]!, src.data[si + 2]!, a);
          }
        }
      }
    }
    // 타일 외곽선
    for (let x = 0; x < CELL; x += 1) { px(c, x0 + x, y0, 60, 66, 92, 255); px(c, x0 + x, y0 + CELL - 1, 60, 66, 92, 255); }
    for (let y = 0; y < CELL; y += 1) { px(c, x0, y0 + y, 60, 66, 92, 255); px(c, x0 + CELL - 1, y0 + y, 60, 66, 92, 255); }
    // 인덱스 라벨 (빈 공기 칸은 인덱스 아래 두 줄 밑줄로 표시)
    drawDigits(c, String(index), x0 + 4, y0 + CELL + 4, 2);
    if (!opaque) {
      for (let x = 0; x < CELL; x += 1) px(c, x0 + x, y0 + CELL + LABEL_H - 2, 200, 40, 40, 255);
    }
  }
  return c;
}

function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outRoot = outIdx >= 0 ? args[outIdx + 1]! : ".omo/evidence/chipset-strips";
  const sheetIdx = args.indexOf("--sheet");
  const only = sheetIdx >= 0 ? args[sheetIdx + 1] : null;
  const targets = only ? { [only]: SHEETS[only]! } : SHEETS;
  if (only && !SHEETS[only]) {
    console.error(`알 수 없는 시트: ${only}. 가능: ${Object.keys(SHEETS).join(", ")}`);
    process.exit(2);
  }

  let written = 0;
  for (const [sheet, pngPath] of Object.entries(targets)) {
    const src = PNG.sync.read(fs.readFileSync(pngPath));
    const dir = path.join(outRoot, sheet);
    fs.mkdirSync(dir, { recursive: true });
    for (let row = 0; row < 16; row += 1) {
      const c = buildRowImage(src, row);
      const file = path.join(dir, `row-${String(row).padStart(2, "0")}.png`);
      fs.writeFileSync(file, PNG.sync.write(c.png));
      written += 1;
    }
    console.log(`${sheet}: 16 rows -> ${dir}`);
  }
  console.log(`wrote ${written} strip images`);
}

main();
