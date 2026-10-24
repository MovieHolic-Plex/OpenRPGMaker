// 공방 「한 번에 만들기」 지형 탭 무대 그림(public/assets/workshop/terrain-quick-stage.png, 124×52) — 버들항 모랫길·포석 오토타일을
// 빠른 지형 재칠(src/project/workshopQuickTerrain.ts)로 용암·눈·돌길로 칠해 풀밭 위에 놓는다. 재칠 규칙을 바꾸면 다시 돌린다.
//   bun scripts/content/workshop/build-quick-terrain-stage.ts
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import * as Q from "../../../src/project/workshopQuickTerrain";
const ts = JSON.parse(readFileSync("src/assets/beodeulCityTileset.json", "utf8"));
const png = PNG.sync.read(readFileSync("public/assets/beodeul-city/beodeul-city-chipset.png"));
const sheet = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
const perRow = png.width / 16, count = perRow * Math.floor(png.height / 16);
const W = 124, H = 52;
const out = new PNG({ width: W, height: H });
const blit = (src: { width: number; data: Uint8ClampedArray | Buffer }, tile: number, cols: number, dx: number, dy: number) => {
  const sx = (tile % cols) * 16, sy = Math.floor(tile / cols) * 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const i = ((sy + y) * src.width + sx + x) * 4; if (src.data[i + 3] < 128) continue;
    const o = (Y * W + X) * 4; out.data[o] = src.data[i]; out.data[o + 1] = src.data[i + 1]; out.data[o + 2] = src.data[i + 2]; out.data[o + 3] = 255;
  }
};
for (let y = -8; y < H; y += 16) for (let x = -6; x < W; x += 16) blit(sheet, 737, perRow, x, y);
const NB: [number, number, number][] = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0], [16, 1, -1], [32, 1, 1], [64, -1, 1], [128, -1, -1]];
["용암 바닥", "눈 덮인 땅", "돌길"].forEach((text, n) => {
  const m = Q.quickMaterialOf(text);
  const g = Q.pickQuickTerrainSource(ts, m, count)!;
  const { tiles } = Q.quickTerrainTiles(ts, g);
  const recol = Q.recolorQuickTerrain(sheet, 16, tiles, [Q.quickTerrainInteriorTile(g)], m.ramp, m.base);
  const shape = ["11", "11", "11"].map((r) => r.split("").map(Number));
  const ox = 6 + n * 40, oy = 2;
  const at = (x: number, y: number) => (shape[y]?.[x] ?? 0) === 1;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) {
    if (!at(x, y)) continue;
    let mask = 0; for (const [bit, dx, dy] of NB) if (at(x + dx, y + dy)) mask |= bit;
    const tile = g.variantMap[String(mask)] ?? g.variantMap[String(mask & 15)] ?? g.variantMap["255"]!;
    blit(recol, tiles.indexOf(tile), 16, ox + x * 16, oy + y * 16);
  }
});
writeFileSync("public/assets/workshop/terrain-quick-stage.png", PNG.sync.write(out));
