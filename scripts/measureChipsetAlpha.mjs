// 칩셋 알파 임계값의 **실측 근거**를 다시 뽑는 스크립트.
// src/project/tileAlphaScan.ts 의 OPAQUE_ALPHA / EMPTY_ALPHA / SOFT_EDGE_MAX_RATIO /
// MOSTLY_EMPTY_MAX_COVERAGE 를 고칠 때는 이걸 먼저 돌려 숫자를 갈아치워라.
//
//   node scripts/measureChipsetAlpha.mjs                 # 기본 표본 6장
//   node scripts/measureChipsetAlpha.mjs <png> [<png>…]  # 임의 시트
//
// 출력 세 덩이가 임계값 세 개에 그대로 대응한다:
//   1) "ambiguous band" 카운트 → 픽셀 띠(250/8)가 빈 구간에 놓였는지
//   2) "smallest non-opaque counts" → softEdge 상한(16px)
//   3) "lowest nonzero coverage" → mostlyEmpty 상한(0.15)
//
// PNG 디코드는 scripts/generateChipsetTransparency.mjs 와 같은 최소 구현이다
// (8비트 비인터레이스, RGBA/RGB/그레이/팔레트+tRNS).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CELL_SIZE = 16;
const DEFAULT_SHEETS = [
  "public/assets/easyrpg-chipset-combined-town-transparent.png",
  "public/assets/easyrpg-chipset-interior-transparent.png",
  "public/assets/easyrpg-chipset-dungeon-transparent.png",
  "public/assets/easyrpg-chipset-retro-house-transparent.png",
  "public/assets/easyrpg-chipset-ship-transparent.png",
  // 부드러운 알파를 실제로 쓰는 커스텀 아틀라스 — 사용자 업로드 칩셋의 대리 표본.
  "public/assets/modern-exteriors/modern-city-atlas.png",
];

// 순수 판정과 같은 값이어야 한다 (src/project/tileAlphaScan.ts).
const OPAQUE_ALPHA = 250;
const EMPTY_ALPHA = 8;

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodeAlpha(bytes) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  const idat = [];
  let trns = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8 || interlace !== 0 || !channels) {
    throw new Error(`지원하지 않는 PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? cur[x - channels] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`알 수 없는 스캔라인 필터: ${filter}`);
      cur[x] = value & 0xff;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    if (colorType === 6) alpha[i] = out[i * 4 + 3];
    else if (colorType === 4) alpha[i] = out[i * 2 + 1];
    else if (colorType === 3) {
      const index = out[i];
      alpha[i] = trns && index < trns.length ? trns[index] : 255;
    } else alpha[i] = 255;
  }
  return { width, height, alpha };
}

const sheets = process.argv.slice(2);
const targets = (sheets.length > 0 ? sheets : DEFAULT_SHEETS).map((path) =>
  path.startsWith("/") ? path : join(ROOT, path)
);

let ambiguousLow = 0;
let ambiguousHigh = 0;
let totalTiles = 0;
const nonOpaqueCounts = [];
const coverages = [];

for (const path of targets) {
  const { width, height, alpha } = decodeAlpha(readFileSync(path));
  for (const value of alpha) {
    if (value >= 1 && value <= EMPTY_ALPHA) ambiguousLow += 1;
    if (value >= OPAQUE_ALPHA - 1 && value <= 254) ambiguousHigh += 1;
  }
  const tilesPerRow = Math.floor(width / CELL_SIZE);
  const rows = Math.floor(height / CELL_SIZE);
  for (let tile = 0; tile < tilesPerRow * rows; tile += 1) {
    const originX = (tile % tilesPerRow) * CELL_SIZE;
    const originY = Math.floor(tile / tilesPerRow) * CELL_SIZE;
    let opaque = 0;
    let empty = 0;
    let soft = 0;
    for (let dy = 0; dy < CELL_SIZE; dy += 1) {
      for (let dx = 0; dx < CELL_SIZE; dx += 1) {
        const value = alpha[(originY + dy) * width + originX + dx];
        if (value >= OPAQUE_ALPHA) opaque += 1;
        else if (value <= EMPTY_ALPHA) empty += 1;
        else soft += 1;
      }
    }
    const total = CELL_SIZE * CELL_SIZE;
    const coverage = (total - empty) / total;
    totalTiles += 1;
    const nonOpaque = total - opaque;
    if (nonOpaque > 0) nonOpaqueCounts.push({ path, tile, nonOpaque, coverage });
    if (coverage > 0) coverages.push({ path, tile, coverage, opaque, soft });
  }
}

const name = (path) => path.split("/").pop();
nonOpaqueCounts.sort((a, b) => a.nonOpaque - b.nonOpaque);
coverages.sort((a, b) => a.coverage - b.coverage);

console.log(`표본: 시트 ${targets.length}장 · ${CELL_SIZE}×${CELL_SIZE} 칸 ${totalTiles}개\n`);
console.log(`1) 픽셀 띠 경계의 빈 구간 (OPAQUE_ALPHA=${OPAQUE_ALPHA}, EMPTY_ALPHA=${EMPTY_ALPHA})`);
console.log(`   알파 1..${EMPTY_ALPHA} 픽셀 = ${ambiguousLow}개, 알파 ${OPAQUE_ALPHA - 1}..254 픽셀 = ${ambiguousHigh}개`);
console.log("   둘 다 0 이면 두 경계가 관측값 없는 구간에 놓였다는 뜻이다.\n");

console.log("2) softEdge 상한 근거 — 비불투명 픽셀이 가장 적은 칸들");
for (const row of nonOpaqueCounts.slice(0, 24)) {
  console.log(`   ${String(row.nonOpaque).padStart(3)}px  커버리지 ${row.coverage.toFixed(3)}  ${name(row.path)}#${row.tile}`);
}
console.log("");

console.log("3) mostlyEmpty 상한 근거 — 0 이 아닌 최저 커버리지들");
for (const row of coverages.slice(0, 12)) {
  console.log(`   ${row.coverage.toFixed(4)}  불투명 ${row.opaque}px 반투명 ${row.soft}px  ${name(row.path)}#${row.tile}`);
}
