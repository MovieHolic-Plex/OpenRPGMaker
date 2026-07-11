/**
 * Diagnose: does sand road paint inside house wings / under house lower tiles?
 */
import { buildLargeRiverMarketVillageProject } from "../src/project/defaults/largeRiverMarketVillageBuild.ts";
import { CHIPSET_TILE_GROUPS, SAND_TILE } from "../src/project/defaults/chipsetMapping.ts";
import { isMapWaterTile } from "../src/editor/tools/queryTools.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const sandAll = new Set<number>([
  ...Object.values(SAND_TILE),
  ...CHIPSET_TILE_GROUPS.sandGround,
]);

const outDir = "output/evidence/large-river-market-village";
mkdirSync(outDir, { recursive: true });

const built = buildLargeRiverMarketVillageProject({ seed: 42 });
const project = built.project;
const map = project.maps[built.mapId]!;
const plan = built.plan;

const hits: {
  kind: string;
  x: number;
  y: number;
  lower: number;
  upper: number;
  lotId?: string;
}[] = [];

// 1) sand inside planned house lots
for (const lot of plan.houseLots) {
  for (let y = lot.y; y < lot.y + lot.h; y++) {
    for (let x = lot.x; x < lot.x + lot.w; x++) {
      const i = y * map.width + x;
      const L = map.lowerTiles[i] ?? -1;
      if (sandAll.has(L)) {
        hits.push({ kind: "sand-in-lot", x, y, lower: L, upper: map.upperTiles[i] ?? -1, lotId: lot.id });
      }
    }
  }
}

// 2) sand inside actual wing mass (lot+1 inset)
const wings = plan.houseLots.map((lot) => ({
  id: lot.id,
  x: lot.x + 1,
  y: lot.y + 1,
  w: Math.max(5, lot.w - 2),
  h: Math.max(6, lot.h - 2),
}));

for (const wing of wings) {
  for (let y = wing.y; y < wing.y + wing.h; y++) {
    for (let x = wing.x; x < wing.x + wing.w; x++) {
      const i = y * map.width + x;
      const L = map.lowerTiles[i] ?? -1;
      if (sandAll.has(L)) {
        hits.push({ kind: "sand-in-wing", x, y, lower: L, upper: map.upperTiles[i] ?? -1, lotId: wing.id });
      }
    }
  }
}

// 3) sand under any non-empty upper (visual "road under house roof/wall object")
let sandUnderUpper = 0;
const underSamples: string[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    const L = map.lowerTiles[i] ?? -1;
    const U = map.upperTiles[i] ?? -1;
    if (sandAll.has(L) && U !== -1 && U !== 0) {
      // skip pure props like tables/trees if far from houses — still count near lots
      const nearHouse = plan.houseLots.some(
        (h) => x >= h.x - 1 && x < h.x + h.w + 1 && y >= h.y - 1 && y < h.y + h.h + 1,
      );
      if (nearHouse) {
        sandUnderUpper += 1;
        if (underSamples.length < 40) underSamples.push(`${x},${y} L=${L} U=${U}`);
      }
    }
  }
}

// 4) house structure lower tiles that are NOT roof/wall (overwritten?) — scan wing cells for grass/sand
const GRASS = new Set([270, 240, -1]);
let wingGrass = 0;
let wingSand = 0;
let wingOther = 0;
const wingOtherHist = new Map<number, number>();
for (const wing of wings) {
  for (let y = wing.y; y < wing.y + wing.h; y++) {
    for (let x = wing.x; x < wing.x + wing.w; x++) {
      const L = map.lowerTiles[y * map.width + x] ?? -1;
      if (sandAll.has(L)) wingSand += 1;
      else if (GRASS.has(L)) wingGrass += 1;
      else {
        wingOther += 1;
        wingOtherHist.set(L, (wingOtherHist.get(L) ?? 0) + 1);
      }
    }
  }
}

// 5) dual ascii: H=house-lower R=sand-road X=sand-in-lot(BUG) o=lot-yard ~=water .=else
const step = 2;
const lines: string[] = ["# dual: H=house-lower R=sand-road X=sand-in-lot o=lot-yard ~=water .=else step=2"];
for (let y = 0; y < map.height; y += step) {
  let row = `${String(y).padStart(3, "0")} `;
  for (let x = 0; x < map.width; x += step) {
    const L = map.lowerTiles[y * map.width + x] ?? -1;
    const inLot = plan.houseLots.some((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
    if (isMapWaterTile(L)) row += "~";
    else if (sandAll.has(L)) row += inLot ? "X" : "R"; // X = sand inside lot = BUG
    else if (inLot && !GRASS.has(L)) row += "H";
    else if (inLot) row += "o"; // lot yard grass
    else row += ".";
  }
  lines.push(row);
}

const report = {
  qaFromBuild: built.qa,
  sandInLot: hits.filter((h) => h.kind === "sand-in-lot").length,
  sandInWing: hits.filter((h) => h.kind === "sand-in-wing").length,
  sandUnderUpperNearHouse: sandUnderUpper,
  underSamples,
  wingGrass,
  wingSand,
  wingOther,
  wingOtherTop: [...wingOtherHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
  sampleHits: hits.slice(0, 30),
  doorFrontsInsideLot: plan.houseLots.map((lot) => {
    const wing = { x: lot.x + 1, y: lot.y + 1, w: lot.w - 2, h: lot.h - 2 };
    // door on south wall row, front is one south
    const doorY = wing.y + wing.h - 1;
    const doorFrontY = doorY + 1;
    return {
      id: lot.id,
      doorY,
      doorFrontY,
      inside: doorFrontY >= lot.y && doorFrontY < lot.y + lot.h,
    };
  }),
};

writeFileSync(join(outDir, "diagnose-road-house.json"), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "diagnose-road-house.txt"), lines.join("\n"));
console.log(JSON.stringify(report, null, 2));
console.log("\n--- dual ascii (first 50 lines) ---");
console.log(lines.slice(0, 50).join("\n"));
