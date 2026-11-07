// test/rmTypeExpanderV3.test.ts 의 새 두 단언을 vitest 없이 같은 입력으로 돌린다(로컬 vitest 금지 규칙 — CI 가 진짜 테스트를 돈다).
import { buildEightNeighborVariantMap, resolveAutotile } from "../../src/editor/tools/v3/rmTypeExpander";
import { shapeAutotileGroupAround } from "../../src/project/defaults/autotileEngine";
import type { AutotileGroup } from "../../src/project/types";

const paintBoth = (group: AutotileGroup, cells: readonly { x: number; y: number }[], width: number, height: number) => {
  const body = group.variantMap[group.neighborhood === 8 ? "255" : "15"]!;
  const fresh = () => { const lowerTiles = Array.from({ length: width * height }, () => -1); for (const c of cells) lowerTiles[c.y * width + c.x] = body; return { width, height, lowerTiles }; };
  const brush = fresh();
  shapeAutotileGroupAround(brush, group, cells);
  const ai = fresh();
  resolveAutotile(group, cells, ai);
  return { brush: brush.lowerTiles, ai: ai.lowerTiles };
};

const tiles = { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 };
const edge: AutotileGroup = {
  id: "edge8", name: "edge", neighborhood: 8, edgeConnects: true,
  memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  variantMap: buildEightNeighborVariantMap(tiles, { innerNW: 10, innerNE: 11, innerSW: 12, innerSE: 13 }),
};
const e = paintBoth(edge, Array.from({ length: 4 }, (_, x) => ({ x, y: 0 })), 4, 3);

const variantMap: Record<string, number> = {};
for (let mask = 0; mask < 256; mask += 1) variantMap[String(mask)] = mask === 255 ? 100 : 50;
const phase: AutotileGroup = {
  id: "phase", name: "phase", neighborhood: 8, edgeConnects: true,
  memberTileIds: [50, 100, 101, 102, 103], variantMap,
  phaseVariants: { w: 2, h: 2, maps: [{ "255": 100 }, { "255": 101 }, { "255": 102 }, { "255": 103 }] },
};
const p = paintBoth(phase, Array.from({ length: 16 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4) })), 4, 4);

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

const depth: AutotileGroup = {
  id: "depth", name: "depth", neighborhood: 8,
  memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 20],
  variantMap: buildEightNeighborVariantMap(tiles),
  interiorVariants: [[20]],
};
const dFresh = () => { const lowerTiles = Array.from({ length: 25 }, () => 1); lowerTiles[12] = 20; return { width: 5, height: 5, lowerTiles }; };
const dCells = Array.from({ length: 25 }, (_, i) => ({ x: i % 5, y: Math.floor(i / 5) }));
const dBrush = dFresh(); shapeAutotileGroupAround(dBrush, depth, dCells);
const dAi = dFresh(); resolveAutotile(depth, dCells, dAi);
const checks = [
  ["edge: brush row = [3,3,3,3]", same(e.brush.slice(0, 4), [3, 3, 3, 3])],
  ["edge: ai === brush", same(e.ai, e.brush)],
  ["phase: brush uses 4 phase bodies", [100, 101, 102, 103].every((t) => p.brush.includes(t))],
  ["phase: ai === brush", same(p.ai, p.brush)],
  ["depth: ai keeps interior variant 20", dAi.lowerTiles[12] === 20],
  ["depth: ai === brush", same(dAi.lowerTiles, dBrush.lowerTiles)],
] as const;
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
console.log(`edge brush=${e.brush.join(",")}\nedge ai   =${e.ai.join(",")}\nphase brush=${p.brush.join(",")}\nphase ai   =${p.ai.join(",")}`);
console.log(`REGRESSION ${checks.every(([, ok]) => ok) ? "ALL_PASS" : "HAS_FAIL"}`);
