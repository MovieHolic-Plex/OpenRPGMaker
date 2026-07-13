// 던전 칩셋 vision 감사용 업스케일 크롭 생성기.
// 480x256(30타일/행, ID=행x30+열)을 8x nearest-neighbor로 확대하고
// 10열x8행 블록 6장으로 분할, 타일 경계 그리드를 그려 저장한다.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SHEET = "public/assets/easyrpg-chipset-dungeon-transparent.png";
const OUT_DIR = process.argv[2] ?? "output/dungeon-audit";
const SCALE = 8;
const TILE = 16;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 8;

const src = PNG.sync.read(fs.readFileSync(SHEET));
fs.mkdirSync(OUT_DIR, { recursive: true });

function pixel(x, y) {
  const i = (y * src.width + x) * 4;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}

for (let by = 0; by < 2; by++) {
  for (let bx = 0; bx < 3; bx++) {
    const w = BLOCK_COLS * TILE * SCALE;
    const h = BLOCK_ROWS * TILE * SCALE;
    const out = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = bx * BLOCK_COLS * TILE + Math.floor(x / SCALE);
        const sy = by * BLOCK_ROWS * TILE + Math.floor(y / SCALE);
        let [r, g, b, a] = pixel(sx, sy);
        if (a === 0) { r = 255; g = 0; b = 255; a = 255; } // 투명 → 마젠타 표기
        const onGrid = x % (TILE * SCALE) === 0 || y % (TILE * SCALE) === 0;
        if (onGrid) { r = 255; g = 255; b = 0; a = 255; }
        const i = (y * w + x) * 4;
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = a;
      }
    }
    const firstId = by * BLOCK_ROWS * 30 + bx * BLOCK_COLS;
    const name = `block-r${by * BLOCK_ROWS}-c${bx * BLOCK_COLS}-id${firstId}.png`;
    fs.writeFileSync(path.join(OUT_DIR, name), PNG.sync.write(out));
    console.log(name, `rows ${by * BLOCK_ROWS}-${by * BLOCK_ROWS + 7}, cols ${bx * BLOCK_COLS}-${bx * BLOCK_COLS + 9}, ids ${firstId}..${firstId + 7 * 30 + 9}`);
  }
}
