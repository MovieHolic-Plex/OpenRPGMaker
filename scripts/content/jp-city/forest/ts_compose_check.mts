// 나무 composer TS 판 대조(테스트 묶음 아님 — 손으로 돌리는 확인):
//   bun scripts/content/jp-city/forest/ts_compose_check.mts <구운 jpCityTileset.json> <shapes.json> <out.json>
// shapes.json: [{name, W, H, mask[H][W], avoid?[H][W]}] (forest_r3_scenes.shapes). 칸마다 4·3·2층 칸 번호를 out.json 에 쓴다.
// 그리고 붓 국소성: 무작위 붓질을 composeTreesAround 로 쌓은 결과 = 마지막 마스크를 composeTreesAll 한 결과인지 본다.
import fs from "node:fs";
import type { AutotileGroup, GameMap } from "../../../../src/project/types";
import { composeTreesAll, composeTreesAround } from "../../../../src/project/defaults/treeComposer";
import { shapeAutotileGroupAround, autotileLayerView } from "../../../../src/project/defaults/autotileEngine";

const [tsPath, shapesPath, outPath] = process.argv.slice(2) as [string, string, string];
const ts = JSON.parse(fs.readFileSync(tsPath, "utf8"));
const group = ts.autotileGroups.find((a: { id: string }) => a.id === "jp-forest4-bl") as AutotileGroup;
const floor = group.memberTileIds[0]!;
const GRASS = 3281, ROCK = 0;

function blank(W: number, H: number): GameMap {
  return { id: "t", name: "t", width: W, height: H, tilesetId: "jp_city", lowerTiles: new Array(W * H).fill(GRASS), upperTiles: new Array(W * H).fill(-1) } as unknown as GameMap;
}
function layers(m: GameMap): number[][] {
  return [m.upperOverlayTiles ?? new Array(m.width * m.height).fill(-1), m.upperTiles, m.lowerOverlayTiles ?? new Array(m.width * m.height).fill(-1), m.lowerTiles.slice()];
}
const out: Record<string, number[][]> = {};
for (const s of JSON.parse(fs.readFileSync(shapesPath, "utf8")) as { name: string; W: number; H: number; mask: number[][]; avoid: number[][] | null }[]) {
  const m = blank(s.W, s.H);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    if (s.mask[y]![x]) m.lowerTiles[y * s.W + x] = floor;
    else if (s.avoid?.[y]?.[x]) m.lowerTiles[y * s.W + x] = ROCK;
  }
  composeTreesAll(m, group);
  out[s.name] = layers(m);
  // 붓 국소성: 마스크 칸을 무작위 순서 덩이로 칠해 가며 엔진 경로(shapeAutotileGroupAround → composer)로 맞춘다
  const b = blank(s.W, s.H);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (!s.mask[y]![x] && s.avoid?.[y]?.[x]) b.lowerTiles[y * s.W + x] = ROCK;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.mask[y]![x]) cells.push({ x, y });
  let r = 12345;
  const rnd = (): number => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; }
  for (let i = 0; i < cells.length; i += 5) {
    const stroke = cells.slice(i, i + 5);
    for (const c of stroke) b.lowerTiles[c.y * s.W + c.x] = floor;
    shapeAutotileGroupAround(autotileLayerView(b, 1), group, stroke);
  }
  // 지우개도 한 번: 덩이 가운데 3칸을 지웠다 다시 칠한다
  const mid = cells.slice(0, 3);
  for (const c of mid) b.lowerTiles[c.y * s.W + c.x] = GRASS;
  composeTreesAround(b, group, mid);
  for (const c of mid) b.lowerTiles[c.y * s.W + c.x] = floor;
  shapeAutotileGroupAround(b, group, mid);
  const A = layers(m).flat(), B = layers(b).flat();
  let diff = 0;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) diff++;
  console.log(`${s.name}: tiles ${A.filter((t) => t >= 0).length}, brush-vs-full diff ${diff}`);
}
fs.writeFileSync(outPath, JSON.stringify(out));
