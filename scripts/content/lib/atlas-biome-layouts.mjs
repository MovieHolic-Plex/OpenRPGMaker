// Layout archetypes of the atlas biome fields (tiledata/atlas-biomes): each returns build(b) for a BiomeMap
// (lib/atlas-biome-kit.mjs) — terrain (cliffs, stairs, rivers and falls, lakes, sea, islands), exits, the road spine
// and a few owned props. Geometry is jittered with the map's own seeded random (b.random), so a failed check redraws
// the same layout from the next seed. The biome dressing (pieces, fill, water decorations, grounds) runs afterwards
// in author-atlas-biomes.mjs.
import assert from "node:assert/strict";

const R = (b, a, c) => a + Math.floor(b.random() * (c - a + 1));
const pick = (b, list) => list[Math.floor(b.random() * list.length)];

// A cliff line across the whole map: segments of 3..7 columns, each rising or falling one row at most (no one-column
// peaks), wandering within ±amp of y.
export function cliffLine(b, y, amp = 2, { x0 = 0, x1 = b.W - 1 } = {}) {
  const pts = [[x0, y]];
  let x = x0, cy = y;
  while (x < x1) {
    const L = Math.min(x1 - x, R(b, 3, 7));
    if (x1 - (x + L) > 0 && x1 - (x + L) < 3) { pts.push([x1, cy]); break; }
    const dy = L >= 2 ? pick(b, [-1, 0, 0, 1]) : 0;
    const ny = Math.max(y - amp, Math.min(y + amp, cy + dy));
    x += L; cy = ny; pts.push([x, cy]);
  }
  if (pts.at(-1)[0] !== x1) pts.push([x1, cy]);
  return pts;
}
// A column range where the cliff has the same top row on two neighbouring columns (a stair fits): nearest to want.
export function stairSpot(b, want, { avoid = [], lo = 3, hi = b.W - 5, level = null } = {}) {
  const cols = b.cliffPlan.columns.filter((c) => level === null || c.level === level);
  const at = new Map(cols.map((c) => [c.x, c]));
  let best = null;
  for (let x = lo; x <= hi; x++) {
    const a = at.get(x), c = at.get(x + 1), l = at.get(x - 1), r = at.get(x + 2);
    if (!a || !c || a.y !== c.y || a.height !== c.height) continue;
    if (!l || !r || l.y !== a.y || r.y !== a.y) continue;   // a flat shoulder on both sides reads as a real flight
    if (avoid.some(([ax, r2]) => Math.abs(x - ax) < r2)) continue;
    if (!best || Math.abs(x - want) < Math.abs(best.x - want)) best = a;
  }
  assert(best, `Stair spot none ${b.spec.id} near ${want}`);
  return [best.x, best.y, best.height];
}
// A river from the top edge to the bottom edge; a straight run around each bridge row so the plank rows match.
export function riverPath(b, x, { bends = 3, amp = 3, straight = [], y0 = 0, y1 = b.H - 1, drift = 0 } = {}) {
  const pts = [[x, y0]];
  let cx = x;
  const n = bends + 1;
  for (let k = 1; k < n; k++) {
    const y = Math.round(y0 + (y1 - y0) * k / n);
    if (straight.some((s) => Math.abs(y - s) < 6)) continue;
    cx = Math.max(x - amp, Math.min(x + amp, cx + R(b, -2, 2) + drift));
    pts.push([cx, y]);
  }
  pts.push([cx, y1]);
  // straight segments: vertical from s-3 to s+4 at the x of the path at that height
  for (const s of straight) {
    const i = pts.findIndex((p) => p[1] > s); const px = i > 0 ? pts[i - 1][0] : cx;
    pts.splice(i < 0 ? pts.length : i, 0, [px, s - 3], [px, s + 4]);
  }
  pts.sort((p, q) => p[1] - q[1]);
  // remove duplicates in y
  return pts.filter((p, k) => k === 0 || p[1] !== pts[k - 1][1]);
}
function horizRiver(b, y, { bends = 3, amp = 3, straight = [] } = {}) {
  // a west→east river: columns of a vertical river transposed (points [x, y])
  const pts = [[0, y]];
  let cy = y;
  const n = bends + 1;
  for (let k = 1; k < n; k++) {
    const x = Math.round((b.W - 1) * k / n);
    if (straight.some((s) => Math.abs(x - s) < 6)) continue;
    cy = Math.max(y - amp, Math.min(y + amp, cy + R(b, -2, 2)));
    pts.push([x, cy]);
  }
  pts.push([b.W - 1, cy]);
  return pts;
}

const SIDE_KO = { west: "서", east: "동", north: "북", south: "남" };

// ── archetypes ──────────────────────────────────────────────────────────────────────────────────────────────────
// Each: (o) => { build(b) → entry | undefined, extraTargets? }. o.meets: { west: "...", east: "...", ... }.

// River crossing: a river from north to south, one or two bridges, the road west ↔ east (and a north or south spur).
export const riverFord = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H;
    const rx = Math.round(W * (o.riverAt ?? 0.5)) + R(b, -2, 2), by = Math.round(H * (o.bridgeAt ?? 0.5)) + R(b, -2, 2);
    const by2 = o.twoBridges ? (by < H / 2 ? by + Math.round(H * 0.3) : by - Math.round(H * 0.3)) : null;
    b.river({ width: o.width ?? 3, points: riverPath(b, rx, { bends: 3, amp: 3, straight: [by, ...(by2 ? [by2] : [])] }),
      pools: o.pool ? [[rx + (b.random() < 0.5 ? -3 : 3), by < H / 2 ? by + Math.round(H * 0.28) : by - Math.round(H * 0.28), 6 + R(b, 0, 2), 4 + R(b, 0, 1)]] : [] });
    b.smoothWater(); b.paintWater();
    b.bridges([[b.findWaterX(by, rx), by], ...(by2 ? [[b.findWaterX(by2, rx), by2]] : [])]);
    const ex = [{ side: "west", at: by + R(b, -4, 4), meets: o.meets?.west ?? "서쪽 필드" }, { side: "east", at: by + R(b, -4, 4), meets: o.meets?.east ?? "동쪽 필드" }];
    if (o.north) ex.push({ side: "north", at: Math.round(W * (rx > W / 2 ? 0.25 : 0.75)), meets: o.meets?.north ?? "북쪽 필드" });
    if (o.south) ex.push({ side: "south", at: Math.round(W * (rx > W / 2 ? 0.2 : 0.8)), meets: o.meets?.south ?? "남쪽 필드" });
    b.exits(ex);
    const lines = [["exit:0", [Math.round(W * 0.25), by + R(b, -2, 2)], "bridge-west:0"], ["bridge-east:0", [Math.round(W * 0.75), by + R(b, -2, 2)], "exit:1"]];
    if (by2) lines.push([[Math.round(W * 0.25), by + 1], [Math.round(W * 0.25), by2], "bridge-west:1"], ["bridge-east:1", [Math.round(W * 0.75), by2], [Math.round(W * 0.75), by]]);
    let n = 2;
    if (o.north) { lines.push([`exit:${n}`, [ex[n].at, Math.round(H * 0.3)], rx > W / 2 ? [Math.round(W * 0.25), by] : [Math.round(W * 0.75), by]]); n++; }
    if (o.south) { lines.push([`exit:${n}`, [ex[n].at, Math.round(H * 0.7)], rx > W / 2 ? [Math.round(W * 0.2), by] : [Math.round(W * 0.8), by]]); n++; }
    b.spine(lines); b.connect(); b.paintRoads();
    b.props([["나무 이정표", Math.round(W * 0.25) + 2, by - 3, "갈림길 표지"]]);
    b.forest({ bands: { north: [o.band ?? 3, 1.5], south: [o.band ?? 3, 1.5] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
  },
});

// Cliff terrace: one cliff across the map, stairs (one or two), the road from the south exit up to the north exit.
export const cliffTerrace = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, cy = Math.round(H * (o.cliffAt ?? 0.42));
    b.cliffs([{ points: cliffLine(b, cy, 2), height: o.height ?? R(b, 3, 5), left: "open", right: "open" }]);
    const s1 = stairSpot(b, Math.round(W * (o.stairAt ?? 0.3)));
    const st = [s1];
    if (o.twoStairs) st.push(stairSpot(b, Math.round(W * 0.75), { avoid: [[s1[0], 10]] }));
    b.stairs(st);
    const cave = o.cave ? b.shaft(...caveSpot(b, Math.round(W * (o.caveAt ?? 0.65)), st)) : null;
    const ex = [{ side: "south", at: Math.round(W * (o.southAt ?? 0.5)) + R(b, -3, 3), meets: o.meets?.south ?? "남쪽 필드" },
      { side: "north", at: Math.round(W * (o.northAt ?? 0.6)) + R(b, -3, 3), meets: o.meets?.north ?? "북쪽 필드" }];
    if (o.east) ex.push({ side: "east", at: Math.round((cy + H) / 2) + R(b, 2, 5), meets: o.meets?.east ?? "동쪽 필드" });
    if (o.west) ex.push({ side: "west", at: Math.round(cy / 2) + R(b, -1, 1), meets: o.meets?.west ?? "서쪽 윗단 필드" });
    b.exits(ex);
    const lines = [["exit:0", [ex[0].at, Math.round(H * 0.72)], "stairs-bottom:0"], ["stairs-top:0", [Math.round(W * 0.5), Math.round(cy * 0.5)], "exit:1"]];
    if (st[1]) lines.push(["stairs-bottom:1", [Math.round(W * 0.6), Math.round(H * 0.72)]], ["stairs-top:1", [Math.round(W * 0.5), Math.round(cy * 0.5)]]);
    let n = 2;
    if (o.east) { lines.push([[ex[0].at, Math.round(H * 0.72)], `exit:${n}`]); n++; }
    if (o.west) { lines.push([[Math.round(W * 0.5), Math.round(cy * 0.5)], `exit:${n}`]); n++; }
    b.spine(lines); b.connect();
    if (cave) b.route([cave.x, cave.y], [ex[0].at, Math.round(H * 0.72)]);
    b.paintRoads();
    b.props([["나무 이정표", st[0][0] + 3, st[0][1] + st[0][2] + 3, "계단 어귀 표지"]]);
    b.forest({ bands: { west: [o.band ?? 3, 1.5], east: [o.band ?? 3, 1.5], north: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
    return undefined;
  },
});
function caveSpot(b, want, stairs) {
  const cols = b.cliffPlan.columns.filter((c) => c.height >= 3 && c.side === "front");
  const ok = cols.filter((c) => !stairs.some(([sx]) => Math.abs(c.x - sx) < 5) && c.x > 3 && c.x < b.W - 5)
    .filter((c) => { const n = cols.find((q) => q.x === c.x + 1); return n && n.y === c.y && n.height === c.height; });
  assert(ok.length, "No cave spot " + b.spec.id);
  ok.sort((p, q) => Math.abs(p.x - want) - Math.abs(q.x - want));
  const c = ok[0];
  return [c.x, c.y + 1, 2, Math.min(2, c.height - 1)];
}

// Two terraces: two cliffs, a stair each (never above one another), a pond on the middle terrace, a cave above.
export const twoTier = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, y1 = Math.round(H * 0.28), y2 = Math.round(H * 0.6);
    b.cliffs([{ points: cliffLine(b, y2, 2), height: R(b, 3, 4), left: "open", right: "open" }, { points: cliffLine(b, y1, 1), height: R(b, 3, 4), left: "open", right: "open" }]);
    const low = b.cliffPlan.columns.filter((c) => c.y > (y1 + y2) / 2), high = b.cliffPlan.columns.filter((c) => c.y < (y1 + y2) / 2);
    low.forEach((c) => (c.level = 0)); high.forEach((c) => (c.level = 1));
    const leftFirst = b.random() < 0.5;
    const s0 = stairSpot(b, Math.round(W * (leftFirst ? 0.22 : 0.78)), { level: 0 });
    const s1 = stairSpot(b, Math.round(W * (leftFirst ? 0.72 : 0.28)), { level: 1, avoid: [[s0[0], 8]] });
    b.stairs([s0, s1]);
    if (o.pond !== false) { const px = leftFirst ? W * 0.32 : W * 0.68, py = (y1 + y2) / 2 + 2.5; b.pond(px, py, Math.min(7, W * 0.12), 2.6, 0.14); b.smoothWater(); b.paintWater(); }
    const cave = o.cave !== false ? b.shaft(...caveSpot2(b, s1)) : null;
    const ex = [{ side: "south", at: Math.round(W * 0.5) + R(b, -4, 4), meets: o.meets?.south ?? "남쪽 필드" }, { side: "north", at: Math.round(W * (leftFirst ? 0.35 : 0.65)), meets: o.meets?.north ?? "북쪽 고개" }];
    if (o.east) ex.push({ side: "east", at: Math.round((y1 + y2) / 2) + 3, meets: o.meets?.east ?? "동쪽 가운뎃단 필드" });
    b.exits(ex);
    const mid = Math.round((y1 + y2) / 2) + 1;
    const lines = [["exit:0", [ex[0].at, H - 6], "stairs-bottom:0"], ["stairs-top:0", [Math.round(W / 2), mid], "stairs-bottom:1"], ["stairs-top:1", [ex[1].at, Math.round(y1 / 2)], "exit:1"]];
    if (o.east) lines.push([[Math.round(W / 2), mid], "exit:2"]);
    b.spine(lines); b.connect();
    if (cave) b.route([cave.x, cave.y], [Math.round(W / 2), mid]);
    b.paintRoads();
    b.props([["나무 이정표", s0[0] + 3, s0[1] + s0[2] + 3, "계단 어귀 표지"]]);
    b.forest({ bands: { west: [3, 1.5], east: [3, 1.5] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
  },
});
function caveSpot2(b, s1) {
  const cols = b.cliffPlan.columns.filter((c) => c.level === 1 && c.height >= 3 && c.side === "front");
  const ok = cols.filter((c) => Math.abs(c.x - s1[0]) > 6 && c.x > 4 && c.x < b.W - 6).filter((c) => { const n = cols.find((q) => q.x === c.x + 1); return n && n.y === c.y && n.height === c.height; });
  assert(ok.length, "No cave spot " + b.spec.id);
  const c = ok[Math.floor(b.random() * ok.length)];
  return [c.x, c.y + 1, 2, Math.min(2, c.height - 1)];
}

// Lake shore: a big irregular lake, the road bending round it, a pier and a small island.
export const lakeShore = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H;
    const cx = W * (o.lakeX ?? 0.5) + R(b, -2, 2), cy = H * (o.lakeY ?? 0.42) + R(b, -1, 1), rx = W * (o.rx ?? 0.24), ry = H * (o.ry ?? 0.22);
    b.pond(cx, cy, rx, ry, 0.18);
    if (o.island) b.unwater((x, y) => ((x - cx) / (rx * 0.28)) ** 2 + ((y - cy + 1) / (ry * 0.3)) ** 2 < 1);
    b.smoothWater(); b.paintWater();
    const south = Math.round(Math.min(H - 5, cy + ry + 5));
    const ex = [{ side: "west", at: south - R(b, 0, 3), meets: o.meets?.west ?? "서쪽 필드" }, { side: "east", at: south - R(b, 0, 3), meets: o.meets?.east ?? "동쪽 필드" }];
    if (o.north !== false) ex.push({ side: "north", at: Math.round(cx + (b.random() < 0.5 ? -1 : 1) * (rx + 5)), meets: o.meets?.north ?? "북쪽 필드" });
    b.exits(ex);
    const pierFoot = [Math.round(cx) + R(b, -3, 3), Math.round(cy + ry + 2)];
    const lines = [["exit:0", [Math.round(W * 0.3), south], [Math.round(W * 0.7), south], "exit:1"]];
    if (o.north !== false) lines.push(["exit:2", [ex[2].at, Math.round(cy)], [ex[2].at, south]]);
    b.spine(lines);
    const pier = b.pier(pierFoot[0], pierFoot[1], "north", R(b, 3, 5));
    b.connect(["pier-foot", "dock-end"]);
    b.route(pier.land, [pierFoot[0], south]);
    b.paintRoads();
    b.props([["낚시 바구니", pier.land[0] + 1, pier.land[1], "나루 낚시꾼 자리", "나루"], ["나무 이정표", Math.round(W * 0.3) + 2, south - 3, "호숫가 갈림길 표지"]]);
    b.forest({ bands: { north: [3, 1.5], west: [2, 1], east: [2, 1], south: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
  },
});

// Coast: open sea along one side (south or east), a beach strip, a pier; the road runs along the shore.
export const coast = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, side = o.sea ?? "south";
    const base = side === "south" ? H * (o.shore ?? 0.62) : W * (o.shore ?? 0.64);
    const ph = b.random() * 6.28, ph2 = b.random() * 6.28;
    const line = (t) => base + 3 * Math.sin(t / 7 + ph) + 1.6 * Math.sin(t / 3.3 + ph2);
    b.waterWhere(side === "south" ? (x, y) => y > line(x) : (x, y) => x > line(y));
    if (o.cove) b.waterWhere((x, y) => ((x - W * 0.55) / 6) ** 2 + ((y - (side === "south" ? line(W * 0.55) - 2 : H * 0.5)) / 4) ** 2 < 1, false);
    b.smoothWater(); b.paintWater();
    let ex;
    if (side === "south") {
      const ry = Math.round(base - 7);
      ex = [{ side: "west", at: ry + R(b, -2, 1), meets: o.meets?.west ?? "서쪽 해안" }, { side: "east", at: ry + R(b, -2, 1), meets: o.meets?.east ?? "동쪽 해안" }, { side: "north", at: Math.round(W * 0.5) + R(b, -5, 5), meets: o.meets?.north ?? "내륙 필드" }];
      b.exits(ex);
      b.spine([["exit:0", [Math.round(W * 0.35), ry], [Math.round(W * 0.65), ry], "exit:1"], ["exit:2", [ex[2].at, Math.round(ry / 2)], [ex[2].at, ry]]]);
      const px = Math.round(W * (o.pierAt ?? 0.4)) + R(b, -3, 3);
      const pier = b.pier(px, ry, "south", R(b, 3, 5));
      b.connect(["pier-foot", "dock-end"]); b.route(pier.land, [px, ry]);
    } else {
      const rx = Math.round(base - 7);
      ex = [{ side: "north", at: rx + R(b, -2, 1), meets: o.meets?.north ?? "북쪽 해안" }, { side: "south", at: rx + R(b, -2, 1), meets: o.meets?.south ?? "남쪽 해안" }, { side: "west", at: Math.round(H * 0.5) + R(b, -4, 4), meets: o.meets?.west ?? "내륙 필드" }];
      b.exits(ex);
      b.spine([["exit:0", [rx, Math.round(H * 0.35)], [rx, Math.round(H * 0.65)], "exit:1"], ["exit:2", [Math.round(rx / 2), ex[2].at], [rx, ex[2].at]]]);
      const py = Math.round(H * (o.pierAt ?? 0.4)) + R(b, -3, 3);
      const pier = b.pier(rx, py, "east", R(b, 3, 5));
      b.connect(["pier-foot", "dock-end"]); b.route(pier.land, [rx, py]);
    }
    b.paintRoads();
    // beach: the sand autotile on a strip of the shore (walkable)
    if (o.beach !== false) {
      const cells = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = b.at(x, y); if (b.water.has(i) || b.roads.has(i) || !b.bare(i)) continue;
        const d = side === "south" ? line(x) - y : line(y) - x;
        if (d > 0 && d < (o.beachWidth ?? 3.2) + Math.sin((side === "south" ? x : y) / 4 + ph) * 0.8) cells.push(i);
      }
      b.pave(cells, "sand", { name: "모래사장" });
    }
    b.props([["나무 이정표", Math.round(W * 0.5) + 3, side === "south" ? Math.round(base - 10) : Math.round(H * 0.5) - 3, "해안 갈림길 표지"]]);
    b.forest({ bands: side === "south" ? { north: [4, 1.5], west: [2, 1], east: [2, 1] } : { west: [4, 1.5], north: [2, 1], south: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
  },
});

// Waterfall valley: a river from the north edge drops over a cliff into a basin pond and leaves south; a bridge on the
// outflow, a stair to the plateau.
export const waterfallValley = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, cy = Math.round(H * (o.cliffAt ?? 0.3));
    b.cliffs([{ points: cliffLine(b, cy, 1), height: o.height ?? R(b, 4, 5), left: "open", right: "open" }]);
    const fx = Math.round(W * (o.fallAt ?? 0.55)) + R(b, -2, 2);
    const col = b.cliffPlan.columns.find((c) => c.x === fx);
    const basinY = col.y + col.height + 5;
    const by = Math.round(basinY + (H - basinY) * 0.55);
    b.river({ width: o.width ?? 3, points: [[fx, 0], [fx, col.y + col.height + 1], [fx, basinY]] });
    b.pond(fx + 0.5, basinY + 0.5, Math.min(8, W * 0.13), 3.4, 0.12);
    b.river({ width: o.width ?? 3, points: riverPath(b, fx + R(b, 1, 3), { y0: basinY + 2, bends: 2, amp: 3, straight: [by], drift: b.random() < 0.5 ? -1 : 1 }) });
    b.smoothWater(); b.paintWater();
    b.bridges([[b.findWaterX(by, fx), by]]);
    const leftStair = fx > W / 2;
    const s = stairSpot(b, Math.round(W * (leftStair ? 0.22 : 0.78)), { avoid: [[fx, 6]] });
    b.stairs([s]);
    const ex = [{ side: leftStair ? "west" : "east", at: by + R(b, -2, 2), meets: o.meets?.[leftStair ? "west" : "east"] ?? "옆 필드" },
      { side: leftStair ? "east" : "west", at: by + R(b, -2, 2), meets: o.meets?.[leftStair ? "east" : "west"] ?? "건너편 필드" },
      { side: "north", at: Math.round(W * (leftStair ? 0.25 : 0.75)), meets: o.meets?.north ?? "절벽 위 고개" }];
    b.exits(ex);
    const near = leftStair ? Math.round(W * 0.2) : Math.round(W * 0.8);
    b.spine([["exit:0", [near, by], leftStair ? "bridge-west:0" : "bridge-east:0"], [leftStair ? "bridge-east:0" : "bridge-west:0", "exit:1"], [[near, by], "stairs-bottom:0"], ["stairs-top:0", "exit:2"]]);
    b.connect(); b.paintRoads();
    b.props([["벤치", s[0] + (leftStair ? 4 : -3), s[1] - 3, "폭포를 내려다보는 쉼터 벤치", "절벽 위 길"], ["나무 이정표", near + (leftStair ? 3 : -3), by - 3, "갈림길 표지"]]);
    b.forest({ bands: { west: [3, 1.5], east: [3, 1.5], south: [2, 1], north: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.85, clear: [[fx, basinY, 9, 5, 12]] });
  },
});

// Crossroads: three or four exits meeting at a clearing with a traveller's rest (campfire, logs, tent).
export const crossroads = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, cx = Math.round(W * 0.5) + R(b, -4, 4), cy = Math.round(H * 0.5) + R(b, -3, 3);
    if (o.pond) { b.pond(cx + (b.random() < 0.5 ? -10 : 10), cy + (b.random() < 0.5 ? -7 : 7), 4.5, 3, 0.18); b.smoothWater(); b.paintWater(); }
    const ex = [{ side: "west", at: cy + R(b, -4, 4), meets: o.meets?.west ?? "서쪽 필드" }, { side: "east", at: cy + R(b, -4, 4), meets: o.meets?.east ?? "동쪽 필드" },
      { side: "north", at: cx + R(b, -6, 6), meets: o.meets?.north ?? "북쪽 필드" }];
    if (o.south !== false) ex.push({ side: "south", at: cx + R(b, -6, 6), meets: o.meets?.south ?? "남쪽 필드" });
    b.exits(ex);
    b.spine(ex.map((_, k) => [`exit:${k}`, [cx, cy]]));
    const camp = b.pave(b.ellipseCells(cx + 5, cy + 4, 3.2, 2.2, 0.1), "dirt", { name: "나그네 쉼터" });
    b.connect(); b.paintRoads();
    b.props([["모닥불", cx + 5, cy + 4, "나그네 쉼터 모닥불", "나그네 쉼터"], ["통나무 더미", cx + 3, cy + 4, "모닥불 둘레 통나무", "나그네 쉼터"], ["천막", cx + 7, cy + 2, "나그네 천막", "나그네 쉼터"],
      ["나무 이정표", cx - 2, cy - 2, "네 갈래 표지"]]);
    b.forest({ bands: { north: [3, 1.5], south: [3, 1.5], west: [3, 1.5], east: [3, 1.5] }, blobs: o.blobs ?? [], noise: 0.8, coverage: o.coverage ?? 0.85 });
  },
});

// Cave road: a high cliff wall across the north with a cave mouth the road leads to and a stair up the side; a stream
// crosses the lowland under a plank bridge (optional).
export const caveRoad = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, cy = Math.round(H * (o.cliffAt ?? 0.28));
    b.cliffs([{ points: cliffLine(b, cy, 1), height: R(b, 4, 5), left: "open", right: "open" }]);
    const s = stairSpot(b, Math.round(W * (o.stairAt ?? 0.18)));
    b.stairs([s]);
    const cave = b.shaft(...caveSpot(b, Math.round(W * (o.caveAt ?? 0.55)), [s]));
    let by = null, sx = null;
    if (o.stream) {
      sx = Math.round(W * 0.72) + R(b, -2, 2); by = Math.round(H * 0.72) + R(b, -1, 1);
      b.river({ width: 2, points: riverPath(b, sx, { y0: 0, bends: 2, amp: 2, straight: [by] }) });
      b.smoothWater(); b.paintWater(); b.bridges([[b.findWaterX(by, sx), by]]);
    }
    const ex = [{ side: "west", at: Math.round(H * 0.72) + R(b, -2, 2), meets: o.meets?.west ?? "서쪽 필드" }, { side: "north", at: Math.round(W * 0.3) + R(b, -3, 3), meets: o.meets?.north ?? "절벽 위 고원" },
      { side: o.stream ? "east" : "south", at: o.stream ? (by ?? Math.round(H * 0.7)) + R(b, -2, 2) : Math.round(W * 0.6) + R(b, -4, 4), meets: o.meets?.[o.stream ? "east" : "south"] ?? "건너편 필드" }];
    b.exits(ex);
    const hub = [Math.round(W * 0.42), Math.round(H * 0.72)];
    const lines = [["exit:0", hub], [hub, [cave.x, cave.y]], [hub, [s[0], s[1] + s[2] + 3], "stairs-bottom:0"], ["stairs-top:0", "exit:1"]];
    if (o.stream) lines.push([hub, [sx - 4, by], "bridge-west:0"], ["bridge-east:0", "exit:2"]);
    else lines.push([hub, "exit:2"]);
    b.spine(lines); b.connect(); b.paintRoads();
    b.props([["돌 석상", cave.x + 3, cave.y + 1, "동굴 입구 수호상", "동굴 입구"], ["나무 이정표", hub[0] + 2, hub[1] - 3, "갈림길 표지 · 동굴 / 고원"]]);
    b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.85 });
  },
});

// Islands: the map is water (or sky) with three to five islands in a chain, joined by plank bridges; the road runs
// from the west island to the east one, a pier on one island.
export const islands = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, n = o.count ?? 4;
    const isl = [];
    for (let k = 0; k < n; k++) {
      const cx = Math.round(W * (k + 0.5) / n) + R(b, -2, 2), cy = Math.round(H * 0.5) + (k % 2 ? 1 : -1) * R(b, 2, Math.round(H * 0.12));
      isl.push({ cx, cy, rx: W / n * 0.34 + R(b, 0, 2), ry: H * 0.3 + R(b, -2, 2) });
    }
    isl[0].cx = Math.max(isl[0].cx, Math.ceil(isl[0].rx) - 2); isl[n - 1].cx = Math.min(isl[n - 1].cx, W - Math.ceil(isl[n - 1].rx) + 1);
    const ph = b.random() * 6.28, eyW = isl[0].cy + R(b, -2, 2), eyE = isl[n - 1].cy + R(b, -2, 2);
    // land tongues from the first / last island out to the map edge where the exits are
    const tongue = (x, y) => (x <= isl[0].cx && Math.abs(y - eyW) <= 2 + (x % 3 === 0 ? 1 : 0)) || (x >= isl[n - 1].cx && Math.abs(y - eyE) <= 2 + (x % 3 === 1 ? 1 : 0));
    const land = (x, y) => tongue(x, y) || isl.some((q) => { const a = Math.atan2(y - q.cy, x - q.cx), r = 1 + 0.16 * Math.sin(a * 3 + ph + q.cx) + 0.08 * Math.sin(a * 5 + q.cy); return ((x - q.cx) / q.rx) ** 2 + ((y - q.cy) / q.ry) ** 2 < r * r; });
    // bridge corridors between neighbouring islands: two rows of water exactly from one island's rim to the next
    const spans = [];
    for (let k = 0; k + 1 < n; k++) {
      const a = isl[k], c = isl[k + 1], y = Math.round((a.cy + c.cy) / 2) + R(b, -1, 1);
      let xa = Math.round(a.cx), xb = Math.round(c.cx);
      while (xa < xb && land(xa + 1, y) && land(xa + 1, y + 1)) xa++;
      while (xb > xa && land(xb - 1, y) && land(xb - 1, y + 1)) xb--;
      spans.push({ y, xa, xb });
    }
    b.waterWhere((x, y) => {
      if (spans.some((s) => (y === s.y || y === s.y + 1) && x > s.xa && x < s.xb)) return true;
      if (spans.some((s) => (y === s.y || y === s.y + 1) && (x === s.xa || x === s.xb || x === s.xa - 1 || x === s.xb + 1))) return false;
      if (spans.some((s) => (y === s.y - 1 || y === s.y + 2) && x >= s.xa - 1 && x <= s.xa && false)) return false;
      return !land(x, y);
    });
    b.smoothWater();
    // smoothing may nibble the landing cells: put them back
    for (const s of spans) for (const y of [s.y, s.y + 1]) { for (const x of [s.xa, s.xa - 1, s.xb, s.xb + 1]) { b.water.delete(b.at(x, y)); b.edgeWet.delete(b.at(x, y)); } for (let x = s.xa + 1; x < s.xb; x++) b.water.add(b.at(x, y)); }
    b.paintWater();
    b.bridges(spans.map((s) => [Math.round((s.xa + s.xb) / 2), s.y]));
    const ex = [{ side: "west", at: eyW, meets: o.meets?.west ?? "서쪽 섬" }, { side: "east", at: eyE, meets: o.meets?.east ?? "동쪽 섬" }];
    b.exits(ex);
    const lines = [["exit:0", [isl[0].cx, isl[0].cy], "bridge-west:0"]];
    for (let k = 1; k + 1 < n; k++) lines.push([`bridge-east:${k - 1}`, [isl[k].cx, isl[k].cy], `bridge-west:${k}`]);
    lines.push([`bridge-east:${n - 2}`, [isl[n - 1].cx, isl[n - 1].cy], "exit:1"]);
    b.spine(lines); b.connect(); b.paintRoads();
    b.islandList = isl;
    const k = 1 + Math.floor(b.random() * (n - 2));
    b.props([["나무 이정표", isl[k].cx + 2, isl[k].cy - 2, "섬 길 표지"]]);
    b.forest({ blobs: isl.map((q) => [q.cx + (b.random() < 0.5 ? -1 : 1) * q.rx * 0.5, q.cy - q.ry * 0.45, q.rx * 0.45, q.ry * 0.35, 9]), noise: 0.6, coverage: o.coverage ?? 0.8 });
  },
});

// Marsh: many small ponds across the map, the road threading between them on a causeway, a boardwalk pier.
export const marsh = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H, n = o.ponds ?? Math.round(W * H / 420);
    const ry = Math.round(H * 0.5) + R(b, -3, 3);
    const road = (x) => ry + 3 * Math.sin(x / 9 + b.seed);
    let made = 0;
    for (let k = 0; k < n * 6 && made < n; k++) {
      const cx = R(b, 4, W - 5), cy = R(b, 4, H - 5), rx = R(b, 4, 8), ry2 = R(b, 3, 5);
      if (Math.abs(cy - road(cx)) < ry2 + 3) continue;
      b.pond(cx, cy, rx, ry2, 0.26); made++;
    }
    b.unwater((x, y) => Math.abs(y - road(x)) < 3 + 1.2 * (1 + Math.sin(x / 3.3 + y / 5)) || x < 5 || x > W - 6);
    b.smoothWater(); b.paintWater();
    const ex = [{ side: "west", at: Math.round(road(0)), meets: o.meets?.west ?? "서쪽 늪" }, { side: "east", at: Math.round(road(W - 1)), meets: o.meets?.east ?? "동쪽 늪" }];
    if (o.north !== false) ex.push({ side: "north", at: Math.round(W * 0.5) + R(b, -6, 6), meets: o.meets?.north ?? "북쪽 필드" });
    b.exits(ex);
    const pts = [0.2, 0.4, 0.6, 0.8].map((f) => [Math.round(W * f), Math.round(road(W * f))]);
    const lines = [["exit:0", ...pts, "exit:1"]];
    if (o.north !== false) lines.push(["exit:2", [ex[2].at, Math.round(road(ex[2].at))]]);
    b.spine(lines); b.connect(); b.paintRoads();
    b.props([["나무 이정표", pts[1][0] + 1, pts[1][1] - 3, "늪길 표지"]]);
    b.forest({ bands: { north: [2, 1], south: [2, 1] }, noise: 0.7, coverage: o.coverage ?? 0.8 });
  },
});

// Meadow road: a wide open plain crossed by a meandering road, a lone landmark hill of rocks, a small pond.
export const meadowRoad = (o = {}) => ({
  build(b) {
    const W = b.W, H = b.H;
    if (o.pond !== false) { b.pond(W * (b.random() < 0.5 ? 0.3 : 0.7), H * (b.random() < 0.5 ? 0.3 : 0.7), R(b, 4, 6), R(b, 3, 4), 0.2); b.smoothWater(); b.paintWater(); }
    const ex = [{ side: "west", at: Math.round(H * 0.45) + R(b, -5, 5), meets: o.meets?.west ?? "서쪽 필드" }, { side: "east", at: Math.round(H * 0.55) + R(b, -5, 5), meets: o.meets?.east ?? "동쪽 필드" }];
    if (o.south !== false) ex.push({ side: "south", at: Math.round(W * 0.35) + R(b, -5, 5), meets: o.meets?.south ?? "남쪽 필드" });
    b.exits(ex);
    const mids = [[Math.round(W * 0.3), Math.round(H * 0.4) + R(b, -4, 4)], [Math.round(W * 0.55), Math.round(H * 0.6) + R(b, -4, 4)], [Math.round(W * 0.75), Math.round(H * 0.45) + R(b, -4, 4)]];
    const lines = [["exit:0", ...mids, "exit:1"]];
    if (o.south !== false) lines.push(["exit:2", mids[1]]);
    b.spine(lines); b.connect(); b.paintRoads();
    b.props([["나무 이정표", mids[1][0] + 2, mids[1][1] - 3, "들길 표지"]]);
    if (o.forest !== false) b.forest({ bands: { north: [2, 1], south: [2, 1] }, noise: 0.6, coverage: o.coverage ?? 0.7 });
  },
});

export const ARCHETYPES = { riverFord, cliffTerrace, twoTier, lakeShore, coast, waterfallValley, crossroads, caveRoad, islands, marsh, meadowRoad };
export { SIDE_KO };
