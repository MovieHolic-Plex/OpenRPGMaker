// Column grammar measured from the immutable great-falls reference, not a perimeter outline.
import assert from "node:assert/strict";
function cliffColumns(profile) {
  assert(Number.isInteger(profile.height) && profile.height >= 2, "Cliff height must be an integer >= 2");
  assert(profile.points.length >= 2 && profile.points.every((p) => p.length === 2 && p.every(Number.isInteger)), "Cliff points must be integer pairs");
  const columns = [];
  for (let p = 0; p < profile.points.length - 1; p++) {
    const [x0, y0] = profile.points[p], [x1, y1] = profile.points[p + 1];
    assert(x1 > x0 && Math.abs(y1 - y0) <= x1 - x0, "Cliff contour must change at most one row per column");
    for (let x2 = x0; x2 < x1; x2++) columns.push({ x: x2, y: Math.round(y0 + (y1 - y0) * (x2 - x0) / (x1 - x0)) });
  }
  const [x, y] = profile.points.at(-1);
  columns.push({ x, y });
  return columns.map((c, i) => {
    const previous = columns[i - 1]?.y ?? c.y - 1, next = columns[i + 1]?.y ?? c.y - 1;
    assert(!(c.y > previous && c.y > next), "Single-column peak has no two-sided cap");
    const side = c.y > previous ? "left" : c.y > next ? "right" : "front";
    const source = side === "left" ? [18, 231, 48] : side === "right" ? [19, 232, 49] : [139, 172, 202];
    return { ...c, height: profile.height, side, source };
  });
}
function paintVillageCliffs(map, profiles, bindings) {
  const cells = Array(map.width * map.height).fill("ground"), cliff = new Set(), columns = [];
  for (const profile of profiles) for (const c of cliffColumns(profile)) {
    for (let y = profile.north ?? 5; y < c.y; y++) cells[y * map.width + c.x] = "plateau";
    for (let d = 0; d <= c.height; d++) {
      const y = c.y + d, i = y * map.width + c.x;
      assert(y < map.height && map.upperTiles[i] === -1, "Cliff faces overlap or leave the map");
      map.upperTiles[i] = bindings[c.source[d === 0 ? 0 : d === c.height ? 2 : 1]];
      cells[i] = "cliff";
      cliff.add(i);
    }
    columns.push(c);
  }
  return { cells, cliff, columns };
}
function inspectVillageCliffs(map, plan, bindings) {
  const errors = [];
  for (const profile of plan.cliffs) for (const c of cliffColumns(profile)) {
    for (let d = 0; d <= c.height; d++) {
      const x = c.x, y = c.y + d, i = y * map.width + x;
      const stair = plan.stairs.some(([sx, sy, h]) => x >= sx && x < sx + 2 && y >= sy && y <= sy + h);
      const mouth = plan.cave?.[0] === x && plan.cave?.[1] === y;
      // A river crossing: the rim cell is water and every cell below it is waterfall.
      const fall = plan.falls?.find((f) => f.x === x && f.y === c.y);
      if (fall) {
        if (d > 0 && (map.lowerTiles[i] !== fall.tile || map.upperTiles[i] !== -1)) errors.push({ code: "waterfall-gap", x, y, expectedLower: fall.tile, actualLower: map.lowerTiles[i], actualUpper: map.upperTiles[i] });
        continue;
      }
      const lower = stair ? bindings[374] : null;
      const upper = stair ? -1 : mouth ? bindings[413] : bindings[c.source[d === 0 ? 0 : d === c.height ? 2 : 1]];
      if (map.upperTiles[i] !== upper || lower !== null && map.lowerTiles[i] !== lower) {
        errors.push({ code: stair ? "cliff-stair-gap" : d === c.height ? "cliff-toe-gap" : "cliff-face-direction", x, y, expectedUpper: upper, actualUpper: map.upperTiles[i], ...stair ? { expectedLower: lower, actualLower: map.lowerTiles[i] } : {} });
      }
    }
  }
  return errors;
}
export {
  cliffColumns,
  inspectVillageCliffs,
  paintVillageCliffs
};
