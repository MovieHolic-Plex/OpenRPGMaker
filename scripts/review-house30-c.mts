/** Observe actual raster floors/shoulders, with deliberately broken controls. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { buildHouse30BatchC } from "./lib/house30BatchC.mts";
import type { House30Entry } from "./lib/house30Contract.mts";

const roofs = new Set([354, 355, 356, 357, 374, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 467]);
const walls = new Set([12, 13, 14, 42, 43, 44, 72, 73, 74, 15, 16, 17, 45, 46, 47, 75, 76, 77, 102, 103, 104, 132, 133, 134, 162, 163, 164, 116, 146]);

function inspect(entry: House30Entry) {
  const { kit } = entry;
  const roofAt = (x: number, y: number) => roofs.has(kit.rows[y]?.tiles[x] ?? -1) || roofs.has(kit.rows[y]?.upperTiles?.[x] ?? -1);
  const floorCounts = Array.from({ length: kit.width }, (_, x) => {
    let count = 0, previous = false;
    for (const row of kit.rows) {
      const wall = walls.has(row.tiles[x]!);
      if (wall && !previous) count++;
      previous = wall;
    }
    return count;
  });
  assert.equal(Math.max(...floorCounts), entry.floors, `${entry.number}: observed floor count`);
  const facades: { x: number; y: number; width: number }[] = [];
  for (let y = 0; y < kit.height; y++) for (let x = 0; x < kit.width; x++) {
    const top = kit.rows[y]!.tiles[x]!;
    if (![12, 15, 102].includes(top)) continue;
    let right = x + 1;
    while (kit.rows[y]!.tiles[right] === top + 1) right++;
    if (kit.rows[y]!.tiles[right] !== top + 2) continue;
    // An upper facade has a lower roof immediately below its three wall rows.
    // Fronts whose next row is yard are ground-floor wings, not extra storeys.
    if (!Array.from({ length: right - x + 1 }, (_, dx) => roofAt(x + dx, y + 3)).every(Boolean)) continue;
    facades.push({ x, y, width: right - x + 1 });
    assert.ok([384, 386].includes(kit.rows[y - 1]?.upperTiles?.[x] ?? -1), `${entry.number}: missing left eave`);
    assert.ok([385, 387].includes(kit.rows[y - 1]?.upperTiles?.[right] ?? -1), `${entry.number}: missing right eave`);
    for (let dy = 0; dy < 3; dy++) for (const sx of [x - 2, x - 1, right + 1, right + 2]) {
      assert.ok(roofAt(sx, y + dy), `${entry.number}: missing two-cell shoulder at ${sx},${y + dy}`);
    }
  }
  assert.equal(facades.length, entry.floors - 1, `${entry.number}: upper facade count`);
  return { number: entry.number, visibleFloors: Math.max(...floorCounts), upperFacades: facades, minimumShoulderWidth: 2 };
}

const checks = buildHouse30BatchC().map(entry => {
  const result = inspect(entry), first = result.upperFacades[0]!;
  const noCorner = structuredClone(entry);
  noCorner.kit.rows[first.y - 1]!.upperTiles![first.x] = -1;
  assert.throws(() => inspect(noCorner), /missing left eave/);
  const noSlope = structuredClone(entry);
  noSlope.kit.rows[first.y]!.tiles[first.x - 2] = -1;
  noSlope.kit.rows[first.y]!.upperTiles![first.x - 2] = -1;
  assert.throws(() => inspect(noSlope), /missing two-cell shoulder/);
  return { ...result, removedEaveRejected: true, removedShoulderRejected: true };
});
const out = "output/evidence/house-30/c";
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/depth-review.json`, JSON.stringify({ houses: 10, negativeControls: 20, checks }, null, 2));
console.log(JSON.stringify({ houses: 10, visibleFloors: checks.map(check => check.visibleFloors), negativeControlsRejected: 20 }));
