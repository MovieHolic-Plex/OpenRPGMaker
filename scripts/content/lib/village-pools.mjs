// Plunge pools with an irregular shore. The authored pools are integer ellipses, which the lake autotile draws as a
// plus/cross (review 2026-09-24: 「폭포 아래 웅덩이가 십자 모양」). Each pool is redrawn as a lopsided blob — its
// radius wanders with the angle and its centre sits a little off the channel — then smoothed (no one-cell notches or
// spurs). The river channel through the pool (the columns of the fall above and the water/bridge below) is kept, and
// only plain ground that the caller allows (`canWet`) becomes water; pool water outside the new shore becomes grass.
import { reautotile } from "./village-compact.mjs";

export function reshapePools({ map, pools, lakeGroup, wet, canWet, canDry, random }) {
  const W = map.width, H = map.height, at = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const LAKE = new Set(Object.values(lakeGroup.variantMap)), isWater = (x, y) => inside(x, y) && LAKE.has(map.lowerTiles[at(x, y)]);
  const report = [];
  for (const pool of pools) {
    const [cx0, cy0, rx0, ry0] = pool;
    const cx = Math.round(cx0), cy = Math.round(cy0);
    // The pool's water: lake cells connected to the centre inside a generous box.
    const bx0 = Math.floor(cx - rx0 - 4), bx1 = Math.ceil(cx + rx0 + 4), by0 = Math.floor(cy - ry0 - 4), by1 = Math.ceil(cy + ry0 + 4);
    const inBox = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
    let start = null;
    for (let r = 0; r < 4 && !start; r++) for (let dy = -r; dy <= r && !start; dy++) for (let dx = -r; dx <= r && !start; dx++) if (isWater(cx + dx, cy + dy)) start = [cx + dx, cy + dy];
    if (!start) { report.push({ pool, skipped: "no water at centre" }); continue; }
    const comp = new Set([at(...start)]), queue = [start];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (inBox(X, Y) && isWater(X, Y) && !comp.has(at(X, Y))) { comp.add(at(X, Y)); queue.push([X, Y]); }
      }
    }
    // The channel: in each row, the water columns that line up with the channel above and below the pool (the
    // narrowest water rows of the component are the channel entering and leaving).
    const rows = new Map();
    for (const i of comp) { const x = i % W, y = Math.floor(i / W); rows.set(y, [...(rows.get(y) ?? []), x]); }
    const widths = [...rows.values()].map((xs) => xs.length), narrow = Math.min(...widths);
    // Channel rows are kept whole. In the pool rows only the columns joining the fall above to the channel rows just
    // above and below the pool are kept (a river that bends further down must not pin the whole pool).
    const isChan = (y) => rows.get(y).length <= narrow + 1;
    const poolRows = [...rows.keys()].filter((y) => !isChan(y)).sort((a, b) => a - b);
    const keep = new Set([...comp].filter((i) => isChan(Math.floor(i / W))));
    if (poolRows.length) {
      const top = poolRows[0], bottom = poolRows.at(-1), join = [];
      for (const y of [top - 1, bottom + 1]) if (rows.has(y)) join.push(...rows.get(y));
      for (const i of comp) { const x = i % W, y = Math.floor(i / W); if (inside(x, y - 1) && wet.has(map.lowerTiles[at(x, y - 1)]) && !LAKE.has(map.lowerTiles[at(x, y - 1)])) join.push(x); }
      const c0 = Math.min(...join), c1 = Math.max(...join);
      for (const i of comp) if (!isChan(Math.floor(i / W)) && i % W >= c0 && i % W <= c1) keep.add(i);
    }
    // Cells that touch a fall or a bridge (and their row neighbours) stay as they are; the rest of that row may move,
    // so the pool's rim under the fall is not a straight bar the width of the pool.
    const locked = new Set();
    for (const i of comp) {
      const x = i % W, y = Math.floor(i / W);
      if ([[0, -1], [0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => inside(x + dx, y + dy) && wet.has(map.lowerTiles[at(x + dx, y + dy)]) && !LAKE.has(map.lowerTiles[at(x + dx, y + dy)]))) for (let xx = x - 1; xx <= x + 1; xx++) locked.add(at(xx, y));
    }
    // New shore: a lopsided blob round a centre shifted off the channel.
    const sx = cx + (random() < 0.5 ? -1 : 1) * (1 + random()), sy = cy + (random() - 0.5);
    const rx = rx0 * (1.05 + random() * 0.25), ry = ry0 * (1.0 + random() * 0.3);
    const p1 = random() * 6.28, p2 = random() * 6.28, p3 = random() * 6.28;
    const target = new Set(keep);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const dx = (x + 0.5 - sx - 0.5) / rx, dy = (y + 0.5 - sy - 0.5) / ry, th = Math.atan2(dy, dx);
      const r = 1 + 0.26 * Math.sin(2 * th + p1) + 0.18 * Math.sin(3 * th + p2) + 0.1 * Math.sin(5 * th + p3);
      if (Math.hypot(dx, dy) <= r) target.add(at(x, y));
    }
    const want = (i) => target.has(i);
    const state = new Map();
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (inside(x, y)) state.set(at(x, y), isWater(x, y));
    // Drying: the pool's own water, or a cell this pass just wetted (a spur the blob made); never other water.
    const can = (i, v) => !locked.has(i) && (v ? canWet(i % W, Math.floor(i / W))
      : !keep.has(i) && (comp.has(i) ? canDry(i % W, Math.floor(i / W)) : !isWater(i % W, Math.floor(i / W))));
    for (const [i, v] of state) if (want(i) !== v && can(i, want(i))) state.set(i, want(i));
    // Smooth: fill notches (three or four water sides), drop spurs (one water side or none, or one cell thick).
    for (let pass = 0; pass < 3; pass++) for (const [i, v] of [...state]) {
      const x = i % W, y = Math.floor(i / W);
      const w = ([dx, dy]) => state.get(at(x + dx, y + dy)) ?? isWater(x + dx, y + dy);
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(w).length;
      // A one-cell-thick arm (water on neither side across it) is a spur too.
      const thin = !(w([1, 0]) || w([-1, 0])) || !(w([0, 1]) || w([0, -1]));
      if (!v && n >= 3 && can(i, true)) state.set(i, true);
      else if (v && (n <= 1 || thin) && can(i, false)) state.set(i, false);
    }
    let added = 0, dried = 0;
    for (const [i, v] of state) {
      if (v === LAKE.has(map.lowerTiles[i])) continue;
      if (v) { map.lowerTiles[i] = lakeGroup.variantMap["255"]; added++; }
      else { map.lowerTiles[i] = 240; dried++; }
    }
    reautotile(map, lakeGroup, "lower", wet);
    report.push({ pool, added, dried });
  }
  return report;
}
