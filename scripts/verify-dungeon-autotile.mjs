// 던전 오토타일 블록 기하 검증 — 각 블록으로 테두리 있는 사각 영역을 합성해
// variant map이 맞는지 육안 확인용 콘택트 시트 PNG를 만든다.
// 표준 블록(8방·11분류)은 채운 사각형에선 9분류만 나타나므로 edgeCorner로 충분.
import fs from "node:fs";
import { PNG } from "pngjs";

const SHEET = "public/assets/easyrpg-chipset-dungeon-transparent.png";
const src = PNG.sync.read(fs.readFileSync(SHEET));
const COLS = 30, TILE = 16;

// 표준 3×4 블록 → 9분류 타일. gridTop: standard=1, nineSlice=0.
function standardSlice(col, row, gridTop = 1) {
  const t = (dx, dy) => (row + dy) * COLS + (col + dx);
  return {
    cornerNW: t(0, gridTop), edgeN: t(1, gridTop), cornerNE: t(2, gridTop),
    edgeW: t(0, gridTop + 1), body: t(1, gridTop + 1), edgeE: t(2, gridTop + 1),
    cornerSW: t(0, gridTop + 2), edgeS: t(1, gridTop + 2), cornerSE: t(2, gridTop + 2),
  };
}

function tileFor(slice, north, east, south, west) {
  if (!north && !west) return slice.cornerNW;
  if (!north && !east) return slice.cornerNE;
  if (!south && !west) return slice.cornerSW;
  if (!south && !east) return slice.cornerSE;
  if (!north) return slice.edgeN;
  if (!south) return slice.edgeS;
  if (!west) return slice.edgeW;
  if (!east) return slice.edgeE;
  return slice.body;
}

// 1d8e9ee dungeonTerrainAutotiles 블록 좌표 (host/overlay + red-carpet nineSlice)
const BLOCKS = [
  { name: "stone c6r4", slice: standardSlice(6, 4) },
  { name: "chasm c9r4", slice: standardSlice(9, 4) },
  { name: "redrock c0r8", slice: standardSlice(0, 8) },
  { name: "lava c3r8", slice: standardSlice(3, 8) },
  { name: "pit-pale c6r8", slice: standardSlice(6, 8) },
  { name: "pit-gold c9r8", slice: standardSlice(9, 8) },
  { name: "snow c6r0", slice: standardSlice(6, 0) },
  { name: "ice c9r0", slice: standardSlice(9, 0) },
  { name: "dirt c0r12", slice: standardSlice(0, 12) },
  { name: "moss c3r12", slice: standardSlice(3, 12) },
  { name: "abyss-blue c6r12", slice: standardSlice(6, 12) },
  { name: "abyss-gray c9r12", slice: standardSlice(9, 12) },
  { name: "red-carpet nineSlice c18r4", slice: standardSlice(18, 4, 0) },
];

// 각 블록: 6×4 채운 영역, 4배 스케일. 라벨 여백 포함.
const RW = 6, RH = 4, SCALE = 4, LABEL = 14, PAD = 8;
const cellPx = TILE * SCALE;
const blockW = RW * cellPx, blockH = RH * cellPx + LABEL;
const GRID_COLS = 4;
const gridRows = Math.ceil(BLOCKS.length / GRID_COLS);
const outW = GRID_COLS * (blockW + PAD) + PAD;
const outH = gridRows * (blockH + PAD) + PAD;
const out = new PNG({ width: outW, height: outH, fill: true });
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 24; out.data[i + 1] = 20; out.data[i + 2] = 16; out.data[i + 3] = 255; }

function blit(tileId, dx, dy) {
  const sx = (tileId % COLS) * TILE, sy = Math.floor(tileId / COLS) * TILE;
  for (let py = 0; py < cellPx; py++) {
    for (let px = 0; px < cellPx; px++) {
      const ssx = sx + Math.floor(px / SCALE), ssy = sy + Math.floor(py / SCALE);
      const si = (ssy * src.width + ssx) * 4;
      let a = src.data[si + 3];
      const ox = dx + px, oy = dy + py;
      if (ox < 0 || oy < 0 || ox >= outW || oy >= outH) continue;
      const oi = (oy * outW + ox) * 4;
      if (a === 0) continue; // 투명은 배경 유지
      out.data[oi] = src.data[si]; out.data[oi + 1] = src.data[si + 1];
      out.data[oi + 2] = src.data[si + 2]; out.data[oi + 3] = 255;
    }
  }
}

BLOCKS.forEach((b, idx) => {
  const gx = idx % GRID_COLS, gy = Math.floor(idx / GRID_COLS);
  const ox = PAD + gx * (blockW + PAD);
  const oy = PAD + gy * (blockH + PAD) + LABEL;
  for (let ry = 0; ry < RH; ry++) {
    for (let rx = 0; rx < RW; rx++) {
      const north = ry > 0, south = ry < RH - 1, west = rx > 0, east = rx < RW - 1;
      const tile = tileFor(b.slice, north, east, south, west);
      blit(tile, ox + rx * cellPx, oy + ry * cellPx);
    }
  }
});

const outPath = process.argv[2] ?? "output/dungeon-autotile-verify.png";
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log("wrote", outPath, outW + "x" + outH);
BLOCKS.forEach((b) => console.log(b.name, "body=" + b.slice.body));
