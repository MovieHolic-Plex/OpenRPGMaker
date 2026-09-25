// Terrain first: before any debris, a big bare cave floor is broken with rock outcrops — bulges of the cave wall
// (void blobs touching the wall mass) that the kit turns into rim + the two-row face under them.
// Each outcrop goes in the barest square left, never on the entrance→goal routes, and is kept only if every goal
// stays reachable and no floor the entrance reached is cut off. Stops once the room is near the gate so the
// dressing that follows is a light touch.
import { lines } from "./kit.mjs";
import { bareStats } from "./dress.mjs";

// Blob shapes (void cells). Small and irregular: a pillar, a ridge, a knuckle.
const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0]],
];

export function carveOutcrops(spec, { build, reach, routes, goal = { sq: 4, screen: 0.42 }, max = 18 }) {
  const art = lines(spec.art).map((r) => [...r]);
  const overlay = spec.overlay ? lines(spec.overlay).map((r) => [...r]) : null;
  const text = (g) => "\n" + g.map((r) => r.join("")).join("\n") + "\n";
  const make = () => ({ ...spec, art: text(art), ...(overlay ? { overlay: text(overlay) } : {}) });
  let seed = [...spec.id].reduce((a, c) => (a * 17 + c.charCodeAt(0)) >>> 0, 3);
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const W = art[0].length, H = art.length, log = [];
  const goals = [...spec.targets, ...(spec.exits ?? []).map((e) => e.at)];
  let { map } = build(make());
  for (let n = 0; n < max; n++) {
    const s = bareStats(map);
    if (s.sq <= goal.sq && s.screen <= goal.screen) break;
    const route = routes(map), before = reach(map);
    // Candidates anywhere; the best one removes the most bare cells from the barest screen (or covers the
    // barest square), keeps off the route and stays a few cells from the other outcrops so they read as
    // separate pillars, not a maze.
    const [wx, wy] = s.win ?? [0, 0];
    const inWin = (a, b) => a >= wx && a < wx + 17 && b >= wy && b < wy + 13;
    const inSq = (a, b) => s.at && a >= s.at[0] && a < s.at[0] + s.sq && b >= s.at[1] && b < s.at[1] + s.sq;
    const tries = [];
    for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) for (const shape of SHAPES) {
      const cells = shape.map(([a, b]) => [x + a, y + b]);
      if (log.some((o) => cells.some(([a, b]) => Math.abs(a - o.at[0] - 1) < 4 && Math.abs(b - o.at[1]) < 4))) continue;
      let score = 0;
      for (const [a, b] of cells) for (let k = 0; k <= 2; k++) score += (s.sq > goal.sq ? inSq(a, b + k) * 2 : 0) + inWin(a, b + k);
      if (score) tries.push({ x, y, shape, score: score + rnd() });
    }
    tries.sort((a, b) => b.score - a.score);
    let done = false;
    const why = { attached: 0, foot: 0, ring: 0, lost: 0, goal: 0 };
    for (const t of tries) {
      const blob = t.shape.map(([a, b]) => [t.x + a, t.y + b]);
      const floorCh = (a, b) => a > 0 && b > 0 && a < W - 1 && b < H - 1 && ".,;Rs".includes(art[b][a]);
      // An outcrop is a bulge of the cave wall, never a free-standing block: it must touch the wall mass.
      // Under a north wall the face rows between the blob and the void become void too, so the ceiling runs
      // on unbroken and the face is drawn once, under the bulge.
      const lift = [];
      for (const [a, b] of blob) {
        if (floorCh(a, b - 1) && art[b - 2]?.[a] === "#") lift.push([a, b - 1]);
        else if (floorCh(a, b - 1) && floorCh(a, b - 2) && art[b - 3]?.[a] === "#") lift.push([a, b - 1], [a, b - 2]);
      }
      const cells = [...blob, ...lift.filter(([a, b]) => !blob.some(([c, d]) => c === a && d === b))];
      const inBlob = new Set(cells.map(([a, b]) => `${a},${b}`));
      const attached = cells.some(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => art[b + dy]?.[a + dx] === "#" && !inBlob.has(`${a + dx},${b + dy}`)));
      if (!attached) { why.attached++; continue; }
      // the blob and the two face rows it will cast must all be bare floor off the route
      const foot = new Set();
      for (const [a, b] of blob) for (let k = 0; k <= 2; k++) foot.add(`${a},${b + k}`);
      const ok = [...foot].every((key) => {
        const [a, b] = key.split(",").map(Number);
        return floorCh(a, b) && map.upperTiles[b * W + a] === -1 && !route.has(b * W + a) && !goals.some(([gx, gy]) => gx === a && gy === b);
      }) && lift.every(([a, b]) => floorCh(a, b) && !route.has(b * W + a));
      // …and keep a clear cell between the outcrop and the route, and off the map edge, so no outcrop
      // stands in a corridor or crowds the walking line.
      const ring = [...foot].flatMap((key) => { const [a, b] = key.split(",").map(Number); return [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]; });
      if (!ok) { why.foot++; continue; }
      if (ring.some(([a, b]) => route.has(b * W + a) || a < 2 || b < 2 || a > W - 3 || b > H - 3)) { why.ring++; continue; }
      const old = cells.map(([a, b]) => [art[b][a], overlay?.[b][a]]);
      cells.forEach(([a, b]) => { art[b][a] = "#"; if (overlay) overlay[b][a] = "#"; });
      const next = build(make()).map, after = reach(next);
      const lost = [...before].filter((k) => !after.has(k) && !foot.has(`${k % W},${Math.floor(k / W)}`));
      const stats = bareStats(next);
      if (lost.length || goals.some(([gx, gy]) => before.has(gy * W + gx) && !after.has(gy * W + gx)) || stats.sq > s.sq || stats.screen > s.screen) {
        if (lost.length) why.lost++; else why.goal++;
        cells.forEach(([a, b], i) => { art[b][a] = old[i][0]; if (overlay) overlay[b][a] = old[i][1]; });
        continue;
      }
      map = next; done = true;
      log.push({ at: [t.x, t.y], cells: cells.length });
      break;
    }
    if (!done) { if (process.env.OUTCROP_DEBUG) console.error(spec.id, 'outcrops stop', n, tries.length, JSON.stringify(why)); break; }
  }
  return { spec: make(), log };
}
