// bbox-village: execute a model-written village layout exactly on the code terrain (beodeul_city), validate it, render it.
//   bun scripts/experiments/bbox-village/lay.mts <layout.json> <terrain.json> <catalog.json> <out dir> [--render]
// Prints {ok, errors[], warnings[], stats} (English, for the repair call). With --render and no errors: <out>/map.png (1x) + project.json.
// The model decided every road, plaza, stair, building, field, fence, forest, tree and prop cell. This code only paints what was written:
// materials by rect (fill_region exact cells), kits by stamp_object at the exact x,y, forest rects as the canopy autotile, fences as the
// fence ring pieces, cuts (ramps/stairs) as one-row relief slopes drawn with experiment-local cut pieces, the code terrain (levels, water) as map.relief. It never adds or moves anything.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../../src/editor/tools/v3/constructionTools.ts";
import { SHARED_OBJECT_TOOLS } from "../../../src/editor/tools/sharedObjectTools.ts";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "../../../src/project/defaults/beodeulNature.ts";
import { translateTiles } from "../../../src/project/objectStamp.ts";
import { layerTileAt, setLayerTileAt } from "../../../src/project/mapLayers.ts";
import { planBeodeulCanopy } from "../../../src/editor/tools/beodeulForest.ts";
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "../../../src/project/relief/walk.ts";
import { createBeodeulGroundTileset } from "../../../src/project/defaults/beodeulGround.ts";
import groundCatalog from "../../../src/assets/beodeulGroundCatalog.json";
import type { ReliefData } from "../../../src/project/relief/types.ts";
import { installPieces, STYLE } from "./ramps/install.mts";
import { canonicalStackSplit, CUT_MAX_RISE, reverseCutLength } from "../../../src/project/relief/cutPieces.ts";
const PIECES: Record<string, { w: number; h: number; rgba: number[] }> = JSON.parse(readFileSync(new URL("./ramps/pieces.json", import.meta.url), "utf8"));
installPieces(PIECES);

const [lf, tf, cf, outDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
mkdirSync(outDir!, { recursive: true });
const L = JSON.parse(readFileSync(lf!, "utf8"));
const T = JSON.parse(readFileSync(tf!, "utf8"));
const CAT: Record<string, { kind: string; w: number; h: number; door?: { dx: number; dy: number } }> = JSON.parse(readFileSync(cf!, "utf8")).kits;
const W: number = T.W, H: number = T.H;
const lv: number[] = T.levels.slice(), water: number[] = T.water;
const errors: string[] = [], warnings: string[] = [];
const done = (extra: Record<string, unknown> = {}) => { const r = { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], ...extra }; writeFileSync(resolve(outDir!, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
const num = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const idx = (x: number, y: number) => y * W + x;
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const P = (c: number) => `(${c % W},${Math.floor(c / W)})`;
const arr = (k: string): any[] => (Array.isArray(L[k]) ? L[k] : []);
const rectOk = (r: any, tag: string, minW = 1, minH = 1): boolean => {
  if (![r?.x, r?.y, r?.w, r?.h].every(num) || r.w < minW || r.h < minH) { errors.push(`${tag}: x,y,w,h must be integers with w>=${minW}, h>=${minH} (got ${JSON.stringify(r).slice(0, 80)}).`); return false; }
  if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) { errors.push(`${tag} rect (${r.x},${r.y},${r.w}x${r.h}) is out of the ${W}x${H} map.`); return false; }
  return true;
};
const cellsOf = (r: any) => { const out: number[] = []; for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) out.push(idx(x, y)); return out; };

// ── 1. claim cells: one owner per cell ──
const owner = new Array<string>(W * H).fill("");   // "" = free ground
const kind = new Array<string>(W * H).fill("");    // road|track|pier|plaza|stair|bld|prop|tree|boat|field|fence|forest|gate
const claim = (c: number, k: string, who: string, allowOn: string[] = []) => {
  if (owner[c] && !allowOn.includes(kind[c]!)) { errors.push(`${who} overlaps ${owner[c]} at ${P(c)} — move one of them.`); return; }
  owner[c] = who; kind[c] = k;
};
// roads: rect chains
const roadMat = new Map<number, string>(); // cell → road kind (main|lane|track|pier)
arr("roads").forEach((rd, i) => {
  const k = ["main", "lane", "track", "pier"].includes(rd?.kind) ? rd.kind : null;
  if (!k) { errors.push(`roads[${i}].kind must be main|lane|track|pier (got ${JSON.stringify(rd?.kind)}).`); return; }
  (Array.isArray(rd.rects) ? rd.rects : []).forEach((r: any, j: number) => {
    const tag = `roads[${i}] (${k}) rect ${j}`;
    if (!rectOk(r, tag)) return;
    if (r.w > 3 && r.h > 3) errors.push(`${tag} (${r.w}x${r.h}) is not a road strip — a road rect must be at most 3 cells wide in one direction (use plazas for squares).`);
    for (const c of cellsOf(r)) {
      if (water[c] && k !== "pier" && !(water[c] === 1)) { errors.push(`${tag} cell ${P(c)} is on ${water[c] === 3 ? "sea" : "lake"} water — only a 'pier' road may go onto the sea.`); continue; }
      if (k === "pier" && !water[c] && !roadMat.has(c)) { /* pier root on land: fine */ }
      if (kind[c] === "road" || kind[c] === "track" || kind[c] === "pier") continue; // roads may overlap each other (junctions)
      claim(c, k === "track" ? "track" : k === "pier" ? "pier" : "road", `road ${i}`);
      roadMat.set(c, k);
    }
  });
});
arr("plazas").forEach((r, i) => {
  if (!rectOk(r, `plazas[${i}]`, 2, 2)) return;
  for (const c of cellsOf(r)) { if (water[c]) { errors.push(`plazas[${i}] cell ${P(c)} is on water.`); continue; } if (roadMat.has(c)) { roadMat.delete(c); owner[c] = ""; kind[c] = ""; } claim(c, "plaza", `plaza ${i}`); }
  const ls = new Set(cellsOf(r).map((c) => lv[c])); if (ls.size > 1) errors.push(`plazas[${i}] spans terrain levels ${[...ls].join("/")} — a plaza must lie on one level.`);
});
// same-level land patches (4-neighbour, dry) — a level boundary = a pair of patches (low, high)
const patch = new Int32Array(W * H).fill(-1);
{ let n = 0; for (let s0 = 0; s0 < W * H; s0 += 1) { if (patch[s0] >= 0 || water[s0]) continue; const q = [s0]; patch[s0] = n;
    for (let k = 0; k < q.length; k += 1) { const c = q[k]!, x = c % W, y = Math.floor(c / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (!inMap(X, Y)) continue; const d2 = idx(X, Y);
        if (patch[d2] < 0 && !water[d2] && lv[d2] === lv[c]) { patch[d2] = n; q.push(d2); } } } n += 1; } }
// cliff cuts (ramps / stairs): one foot row on the lower level against the cliff, as tall as the face (ramps/pieces.py).
// Stacked flight (r3): a cut whose exit row is a ONE-row strip of a middle level can carry a second cut on that strip (same
// columns, same kind, foot = the strip row, its own cliff height) — the strip is the landing. The chain becomes one relief
// slope h = number of flights (the strip cells take the bottom level, the slope convention), drawn by a stacked piece
// composed from the single pieces (upper flight, its foot as the landing, lower flight, foot) — no new pixels.
const ramps = new Array<number>(W * H).fill(0);
const stairCells = new Set<number>();
const rampCells = new Set<number>(); // cut cells of a ramp: painted as track (sand) so the road autotile runs on through the cut
const MAXR = CUT_MAX_RISE;
type Cut = { i: number; id: string; x: number; y: number; w: number; rise: number; cut: string; dir: string; lo: number; hi: number; tag: string; len: number };
const cuts: (Cut & { stackedOn?: number })[] = [];
const cutId = (k: string, r: number, w: number) => `${k}-h${r}-w${w}`;
const pathKind = (c: number) => ["road", "track", "plaza"].includes(kind[c]!);
arr("cuts").forEach((s, i) => {
  const d = CAT[s?.id] as any, tag = `cuts[${i}] "${s?.id}"`;
  if (!d || d.kind !== "cut") { errors.push(`${tag}: unknown cut id — use ramp-h<1..${MAXR}>-w<2|3> or stairs-h<1..${MAXR}>-w<2|3> from the catalog.`); return; }
  if (!num(s.x) || !num(s.y)) { errors.push(`${tag}: needs integer x, y (the left foot cell on the lower level).`); return; }
  if (s.dir !== "north" && s.dir !== "south") { errors.push(`${tag}.dir must be "north" (climbs through a south-facing cliff: high ground north of the foot) or "south" (climbs through a north-facing cliff: high ground south of the foot).`); return; }
  const w = d.w, north = s.dir === "north";
  if (!rectOk({ x: s.x, y: s.y, w, h: 1 }, tag)) return;
  const cs = cellsOf({ x: s.x, y: s.y, w, h: 1 }), lo = lv[cs[0]!]!;
  if (cs.some((c) => lv[c] !== lo || water[c])) { errors.push(`${tag} at (${s.x},${s.y}): its ${w} foot cells must be dry land on ONE lower level (found ${[...new Set(cs.map((c) => lv[c]))].join("/")}).`); return; }
  const hiY = north ? s.y - 1 : s.y + 1, loY = north ? s.y + 1 : s.y - 1;
  if (!inMap(s.x, hiY) || !inMap(s.x, loY)) { errors.push(`${tag}: needs an entry row and an exit row inside the map.`); return; }
  const his = new Set<number>(); for (let x = s.x; x < s.x + w; x += 1) his.add(lv[idx(x, hiY)]!);
  const hi = [...his][0]!;
  if (his.size > 1 || hi <= lo) { errors.push(`${tag}: the row just ${s.dir} of its foot (y=${hiY}) must be ONE higher level across all ${w} columns (foot level ${lo}; found ${[...his].join("/")}). Put the foot directly ${north ? "south" : "north"} of a straight stretch of cliff.`); return; }
  const rise = hi - lo;
  if (rise > MAXR) { errors.push(`${tag}: the cliff there is ${rise} tall — cuts exist for heights 1-${MAXR} only; choose another spot.`); return; }
  if (rise !== d.rise) errors.push(`${tag}: the cliff face there is ${rise} tall, so the piece must be ${cutId(d.cut, rise, w)} (a ${d.rise}-tall piece does not fit). Fixed: {"id": "${cutId(d.cut, rise, w)}", "x": ${s.x}, "y": ${s.y}, "dir": "${s.dir}"}.`);
  // reverse cut (r5, 2026-10-31): through a NORTH-facing cliff the climb runs rise+2 cells north of the cliff on the lower level
  // (cutPieces.ts reverseCutLength): in 3/4 view `rise` of them hide behind the terrace and 2 show as a way down from its lip
  const len = north ? 1 : reverseCutLength(rise);
  const body = north ? cs : cellsOf({ x: s.x, y: s.y - len + 1, w, h: len });
  if (!north) {
    if (!inMap(s.x, s.y - len)) { errors.push(`${tag}: a ${rise}-tall reverse cut runs ${len} cells north of the cliff (rows ${s.y - len + 1}..${s.y}) plus an entry row y=${s.y - len} — that leaves the map; climb elsewhere.`); return; }
    const badLv = body.filter((c) => lv[c] !== lo || water[c]);
    if (badLv.length) { errors.push(`${tag}: a reverse cut through a north-facing ${rise}-tall cliff takes ${len} cells on the lower level north of the cliff: rows ${s.y - len + 1}..${s.y}, columns ${s.x}..${s.x + w - 1}, all dry level ${lo} — ${P(badLv[0]!)} is not. Use a spot with ${len + 1} rows of level-${lo} ground north of the cliff.`); return; }
  }
  if (body.some((c) => stairCells.has(c))) { errors.push(`${tag}: overlaps another cut.`); return; }
  // flanks (r4 VQA): the cliff right beside the cut, on both sides, must be the same face (foot level ${lo} under level ${hi}) —
  // a cut where the cliff steps (one side a different height) leaves its side wall standing in the grass of the lower side
  const flankOk = (fx: number) => !inMap(fx, s.y) || water[idx(fx, s.y)] || (lv[idx(fx, s.y)] === lo && lv[idx(fx, hiY)] === hi);
  if (!flankOk(s.x - 1) || !flankOk(s.x + w)) {
    let alt: number | null = null;
    for (let dx = 1; dx < W && alt === null; dx += 1) for (const nx of [s.x - dx, s.x + dx]) {
      if (alt !== null || nx < 1 || nx + w > W - 1) continue;
      let ok = flankOk(nx - 1) && flankOk(nx + w);
      for (let x = nx; x < nx + w && ok; x += 1) ok = lv[idx(x, s.y)] === lo && lv[idx(x, hiY)] === hi && !water[idx(x, s.y)];
      if (ok) alt = nx;
    }
    errors.push(`${tag} at (${s.x},${s.y}) sits where the cliff steps: the face beside it (column ${!flankOk(s.x - 1) ? s.x - 1 : s.x + w}) is not the same level-${lo}-to-${hi} face, so the cut's side wall would stand in the grass. ${alt !== null ? `Fixed: {"id": "${s.id}", "x": ${alt}, "y": ${s.y}, "dir": "${s.dir}"} (move the road to columns ${alt}..${alt + w - 1}).` : "No straight stretch of that face is wide enough here — climb elsewhere."}`);
    return;
  }
  for (const c of body) { if (kind[c] === "road" || kind[c] === "track") { owner[c] = ""; kind[c] = ""; roadMat.delete(c); } claim(c, "stair", `cut ${i}`); ramps[c] = rampCode(north ? "n" : "s", d.cut === "stairs"); stairCells.add(c); if (d.cut === "ramp") rampCells.add(c); }
  cuts.push({ i, id: s.id, x: s.x, y: s.y, w, rise, cut: d.cut, dir: s.dir, lo, hi, tag, len });
});
// entry / exit rows (pass 2, after every cut is known): a row may be road/track/plaza, or the foot of the next flight of a stack
const footOf = (x: number, y: number, w: number) => cuts.find((q) => q.dir === "north" && q.x === x && q.y === y && q.w === w);
for (const q of cuts) {
  const north = q.dir === "north", hiY = north ? q.y - 1 : q.y + 1, loY = north ? q.y + 1 : q.y - q.len;
  const up = north ? footOf(q.x, hiY, q.w) : undefined, down = north ? footOf(q.x, loY, q.w) : undefined;
  if (up && up.cut !== q.cut) errors.push(`${q.tag} and ${up.tag} form a stacked flight but mix a ramp and stairs — both flights of a stack must be the same kind. Fixed: {"id": "${cutId(q.cut, up.rise, up.w)}", "x": ${up.x}, "y": ${up.y}, "dir": "north"}.`);
  if (up && up.cut === q.cut) up.stackedOn = q.i;
  if (!up) {
    const top = cellsOf({ x: q.x, y: hiY, w: q.w, h: 1 });
    const bad = top.filter((c) => !pathKind(c));
    if (bad.length) {
      // the exit lands on a one-row strip with a further cliff right behind it: name the second flight that climbs it
      const y2 = hiY - 1, lv2 = inMap(q.x, y2) ? new Set(cellsOf({ x: q.x, y: y2, w: q.w, h: 1 }).map((c) => lv[c])) : new Set<number>();
      const r2 = lv2.size === 1 ? [...lv2][0]! - q.hi : 0;
      if (north && r2 > 0 && r2 <= MAXR) errors.push(`${q.tag}: exit row y=${hiY} (level ${q.hi}) is a one-row strip under another ${r2}-tall cliff — it is the landing of a stacked flight. Fixed: add the second flight on it {"id": "${cutId(q.cut, r2, q.w)}", "x": ${q.x}, "y": ${hiY}, "dir": "north"} and make row y=${y2} (columns ${q.x}..${q.x + q.w - 1}, level ${q.hi + r2}) a road/track/plaza cell.`);
      else for (const c of bad) errors.push(`${q.tag}: exit cell ${P(c)} (level ${q.hi}) must be a road/track/plaza cell.`);
    }
  }
  if (!down) for (const c of cellsOf({ x: q.x, y: loY, w: q.w, h: 1 })) if (!pathKind(c) || lv[c] !== q.lo) errors.push(`${q.tag}: entry cell ${P(c)} must be a road/track/plaza cell on level ${q.lo}.`);
}
// stack chains (bottom flight first): the landing/foot cells of the upper flights take the chain's bottom level (one relief slope)
const stacks: Cut[][] = [];
for (const q of cuts) {
  if (q.stackedOn !== undefined) continue;
  const chain: Cut[] = [q]; let cur: Cut | undefined = q;
  while ((cur = cuts.find((u) => u.stackedOn === cur!.i))) chain.push(cur);
  if (chain.length > 2) { errors.push(`${chain[2]!.tag}: a stacked flight has at most two cuts (one landing) — climb the rest at another face or add a path on the next terrace.`); continue; }
  if (chain.length === 2) {
    const total = q.rise + chain[1]!.rise, split = canonicalStackSplit(total);
    if (!split || split[0] !== q.rise || split[1] !== chain[1]!.rise) { errors.push(`${q.tag} + ${chain[1]!.tag}: a ${q.rise}+${chain[1]!.rise} stack has no art — two-flight stacks are drawn only in the canonical split${split ? ` ${split[0]} (lower) + ${split[1]} (upper) for a ${total}-level climb` : ""}. This terrain cannot take that split here; climb at another south face of the same terraces or take the path around.`); continue; }
  }
  if (chain.length > 1) { stacks.push(chain); for (const u of chain.slice(1)) for (const c of cellsOf({ x: u.x, y: u.y, w: u.w, h: 1 })) lv[c] = q.lo; }
}
if (arr("stairs").length) errors.push(`"stairs" is no longer a key — use "cuts" with a ramp-/stairs- piece id from the catalog.`);
// kit placements
type Placed = { id: string; x: number; y: number; w: number; h: number; k: string; who: string; door?: { dx: number; dy: number } };
const placed: Placed[] = [];
const placeKit = (o: any, group: string, i: number, kinds: string[]) => {
  const tag = `${group}[${i}] "${o?.id}"`;
  const d = CAT[o?.id];
  if (!d) { errors.push(`${tag}: unknown id — use an exact id from the catalog.`); return; }
  if (!kinds.includes(d.kind)) { errors.push(`${tag} is a ${d.kind}, not allowed in "${group}" (use ${d.kind === "building" ? "buildings" : d.kind === "tree" ? "trees" : "props"}).`); return; }
  if (!num(o.x) || !num(o.y)) { errors.push(`${tag}: needs integer x, y.`); return; }
  const r = { x: o.x, y: o.y, w: d.w, h: d.h };
  if (!rectOk(r, tag)) return;
  const cs = cellsOf(r), who = `${o.id}@(${o.x},${o.y})`;
  if (d.kind === "boat") { if (cs.some((c) => !water[c])) errors.push(`${tag}: a boat must lie fully on water.`); }
  else if (cs.some((c) => water[c])) { errors.push(`${tag} (${d.w}x${d.h} at ${o.x},${o.y}) touches water — only boats go on water.`); return; }
  const ls = new Set(cs.map((c) => lv[c])); if (ls.size > 1) errors.push(`${tag} (${d.w}x${d.h} at ${o.x},${o.y}) straddles terrain levels ${[...ls].join("/")} — its whole footprint must be on one level.`);
  const L0 = lv[cs[cs.length - 1]!]!;
  if (d.kind === "building") for (let i2 = 0; i2 < d.w; i2 += 1) for (const kk of [1, 2]) { const Y = o.y + d.h - 1 + kk; if (Y < H && lv[idx(o.x + i2, Y)]! > L0 + kk - 1) { errors.push(`${tag}: higher ground right in front of it at (${o.x + i2},${Y}) would hide its front — move it.`); break; } }
  for (const c of cs) { const onPlaza = kind[c] === "plaza" && d.kind === "prop"; claim(c, onPlaza ? "plazaprop" : d.kind === "building" ? "bld" : d.kind, who, d.kind === "prop" ? ["plaza"] : []); }
  placed.push({ id: o.id, x: o.x, y: o.y, w: d.w, h: d.h, k: d.kind, who, door: d.door });
};
arr("buildings").forEach((o, i) => placeKit(o, "buildings", i, ["building"]));
// fields
const fieldCells = new Map<number, string>();
arr("fields").forEach((f, i) => {
  const tag = `fields[${i}]`;
  if (!rectOk(f, tag, 2, 2)) return;
  const crop = f.crop;
  if (!["wheat", "barley", "rye", "vines", "herbs", "flowers"].includes(crop)) { errors.push(`${tag}.crop must be wheat|barley|rye|vines|herbs|flowers.`); return; }
  if (crop === "vines" && (f.w % 8 || f.h % 4)) errors.push(`${tag}: a vines field must be a multiple of 8x4 cells (got ${f.w}x${f.h}).`);
  if ((crop === "herbs" || crop === "flowers") && (f.w % 2 || f.h % 2)) errors.push(`${tag}: herbs/flowers beds come in 2x2 — use even w and h (got ${f.w}x${f.h}).`);
  const cs = cellsOf(f);
  if (cs.some((c) => water[c])) { errors.push(`${tag} touches water.`); return; }
  const ls = new Set(cs.map((c) => lv[c])); if (ls.size > 1) errors.push(`${tag} spans terrain levels ${[...ls].join("/")} — a field must lie on one level.`);
  for (const c of cs) { claim(c, "field", `field ${i}`); fieldCells.set(c, crop); }
});
// fences: ring of the rect, one gate on the ring (not a corner)
type FenceKind = "h" | "v" | "tl" | "tr" | "bl" | "br" | "endW" | "endE" | "endN" | "endS";
const fenceAt = new Map<number, FenceKind>();
const gates: { c: number; out: number; who: string }[] = [];
arr("fences").forEach((f, i) => {
  const tag = `fences[${i}]`;
  if (!rectOk(f, tag, 4, 3)) return;
  const x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1;
  const g = Array.isArray(f.gate) ? { x: f.gate[0], y: f.gate[1] } : f.gate;
  const onRing = (x: number, y: number) => (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (!g || !num(g.x) || !num(g.y) || !onRing(g.x, g.y) || ((g.x === x0 || g.x === x1) && (g.y === y0 || g.y === y1))) { errors.push(`${tag}.gate must be one cell [x,y] on the fence ring, not a corner.`); return; }
  const ring: number[] = [];
  for (let x = x0; x <= x1; x += 1) ring.push(idx(x, y0), idx(x, y1));
  for (let y = y0 + 1; y < y1; y += 1) ring.push(idx(x0, y), idx(x1, y));
  const ls = new Set(ring.map((c) => lv[c])); if (ls.size > 1) errors.push(`${tag} ring spans terrain levels ${[...ls].join("/")} — a fence must lie on one level.`);
  if (ring.some((c) => water[c])) { errors.push(`${tag} touches water.`); return; }
  const gc = idx(g.x, g.y);
  for (const c of ring) {
    const x = c % W, y = Math.floor(c / W);
    if (c === gc) { claim(c, "gate", `fence ${i} gate`); continue; }
    let k: FenceKind = y === y0 ? (x === x0 ? "tl" : x === x1 ? "tr" : "h") : y === y1 ? (x === x0 ? "bl" : x === x1 ? "br" : "h") : "v";
    if (k === "h" && y === g.y && Math.abs(x - g.x) === 1) k = x < g.x ? "endE" : "endW";
    if (k === "v" && x === g.x && Math.abs(y - g.y) === 1) k = y < g.y ? "endS" : "endN";
    claim(c, "fence", `fence ${i}`); fenceAt.set(c, k);
  }
  const [ox, oy] = g.y === y0 ? [g.x, g.y - 1] : g.y === y1 ? [g.x, g.y + 1] : g.x === x0 ? [g.x - 1, g.y] : [g.x + 1, g.y];
  gates.push({ c: gc, out: inMap(ox, oy) ? idx(ox, oy) : -1, who: tag });
});
const forestSet = new Set<number>();
arr("forests").forEach((f, i) => {
  if (!rectOk(f, `forests[${i}]`, 2, 2)) return;
  for (const c of cellsOf(f)) { if (water[c]) continue; if (kind[c] === "forest") continue; claim(c, "forest", `forest ${i}`); forestSet.add(c); }
});
arr("trees").forEach((o, i) => placeKit(o, "trees", i, ["tree"]));
arr("props").forEach((o, i) => placeKit(o, "props", i, ["prop", "boat"]));

// ── 2. connectivity under the real walking rules (relief + stairs) ──
const rel: ReliefData = { width: W, height: H, levels: lv.slice(), ramps: ramps.slice() };
invalidateReliefSlopes(rel);
const pathy = (c: number) => ["road", "track", "pier", "plaza", "stair", "gate"].includes(kind[c]!);
// road cells meeting across a level change without stairs
const reported = new Set<string>();
for (let c = 0; c < W * H; c += 1) {
  if (!pathy(c)) continue; const x = c % W, y = Math.floor(c / W);
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy);
    if (!pathy(n) || lv[c] === lv[n] || stairCells.has(c) || stairCells.has(n)) continue;
    const key = `${Math.min(lv[c]!, lv[n]!)}-${dx}-${Math.floor(x / 3)}-${Math.floor(y / 3)}`; if (reported.has(key)) continue; reported.add(key);
    errors.push(dx ? `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across an east-west level change — paths cannot climb sideways; route the path north/south through stairs.`
      : (() => { const r = Math.abs(lv[c]! - lv[n]!), lowC = lv[c]! < lv[n]! ? c : n, northHigh = lowC === n;
          const fx = lowC % W, fy = Math.floor(lowC / W);
          const hiC0 = lowC === c ? n : c, sy = Math.floor(hiC0 / W) - 1, r2 = northHigh && sy >= 0 ? lv[idx(fx, sy)]! - lv[hiC0]! : 0;
          if (northHigh && r <= MAXR && r2 > 0 && r2 <= MAXR) return `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across a ${r}-tall cliff, and row y=${fy - 1} is a one-row level-${lv[hiC0]} strip under a further ${r2}-tall cliff. Fixed: climb both with a stacked flight (the strip is the landing): {"id": "stairs-h${r}-w2", "x": <left column>, "y": ${fy}, "dir": "north"} and {"id": "stairs-h${r2}-w2", "x": <same column>, "y": ${fy - 1}, "dir": "north"} (or ramp-h${r}-w2 + ramp-h${r2}-w2 for a track; x=${fx} must be inside both), with row y=${fy - 2} a road/track/plaza on level ${lv[hiC0]! + r2}.`;
          return r > MAXR ? `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across a ${r}-tall cliff — too tall for a cut (max ${MAXR}); route the path elsewhere.`
            : `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across a ${r}-tall cliff without a cut. Fixed: add {"id": "ramp-h${r}-w2" (track) or "stairs-h${r}-w2" (paved; -w3 for a 3-wide road), "x": <left column>, "y": ${fy}, "dir": "${northHigh ? "north" : "south"}"} with its foot on the lower row y=${fy} (x=${fx} must be inside it)${northHigh ? "" : ` — this face looks north, so it is a reverse cut: it takes rows ${fy - reverseCutLength(r) + 1}..${fy} (${reverseCutLength(r)} cells on level ${lv[lowC]}) and row y=${fy - reverseCutLength(r)} must be the road/track on level ${lv[lowC]} leading to it`}.`; })());
  }
}
const pathCells = [...Array(W * H).keys()].filter(pathy);
let comps: number[][] = [];
{
  const seen = new Uint8Array(W * H);
  for (const s of pathCells) {
    if (seen[s]) continue; const q = [s]; seen[s] = 1;
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = Math.floor(c / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
        if (seen[n] || !pathy(n) || !reliefAllowsStep(rel, x, y, nx, ny)) continue; seen[n] = 1; q.push(n); } }
    comps.push(q);
  }
  comps.sort((a, b) => b.length - a.length);
}
const net = new Set(comps[0] ?? []);
if (!pathCells.length) errors.push("No roads at all: give road rect chains.");
if (comps.length > 1) for (const cp of comps.slice(1, 6)) errors.push(`path network is split: ${cp.length} path cell(s) around ${P(cp[0]!)} are not connected (walking, stairs included) to the main network around ${P(comps[0]![0]!)}.`);
if (pathCells.length && !pathCells.some((c) => { const x = c % W, y = Math.floor(c / W); return net.has(c) && (x === 0 || y === 0 || x === W - 1 || y === H - 1) && !water[c]; }))
  errors.push("No road leaves the map: at least one main road must reach a dry map edge cell (the village entrance).");
for (const p of placed.filter((q) => q.k === "building")) {
  if (!p.door) continue;
  const fx = p.x + p.door.dx, fy = p.y + p.door.dy + 1;
  if (!inMap(fx, fy)) { errors.push(`building ${p.who}: its door front cell (${fx},${fy}) is off the map.`); continue; }
  const f = idx(fx, fy);
  if (!["road", "track", "plaza", "pier"].includes(kind[f]!)) errors.push(`building ${p.who}: door front cell (${fx},${fy}) must be a road/path/plaza cell (lay at least a 1-cell track from the door to the network).`);
  else if (lv[f] !== lv[idx(p.x, p.y + p.h - 1)]) errors.push(`building ${p.who}: door front cell (${fx},${fy}) is on level ${lv[f]} but the building stands on level ${lv[idx(p.x, p.y + p.h - 1)]}.`);
  else if (!net.has(f)) errors.push(`building ${p.who}: door front (${fx},${fy}) is on a path piece not connected to the main network.`);
}
for (const g of gates) if (g.out < 0 || !net.has(g.out)) errors.push(`${g.who}: the cell just outside the gate ${g.out >= 0 ? P(g.out) : ""} must be a connected road/path cell.`);
// stats + soft warnings
const free = [...Array(W * H).keys()].filter((c) => !water[c] && !owner[c]).length, land = water.filter((v) => !v).length;
if (free / land > 0.6) warnings.push(`${Math.round((free / land) * 100)}% of the dry land is still bare grass — consider more fields, forests, orchards or props.`);
const stats = { W, H, buildings: placed.filter((p) => p.k === "building").length, props: placed.filter((p) => p.k === "prop" || p.k === "boat").length, trees: placed.filter((p) => p.k === "tree").length,
  pathCells: pathCells.length, cuts: cuts.length, cutsSouthFacing: cuts.filter((q) => q.dir === "north").length, stackedFlights: stacks.length, fields: fieldCells.size, forest: forestSet.size, bareLandPct: Math.round((free / land) * 100) };
if (errors.length || !render) done({ stats });

// ── 3. paint exactly ──
const proj = createBlankProject() as any; ensureBundledTilesets(proj);
const TS = "beodeul_city", ts = proj.tilesets[TS];
const mapId = "bbox-village";
proj.maps[mapId] = { ...structuredClone(Object.values(proj.maps)[0] as any), id: mapId, name: L.name ?? "bbox village", width: W, height: H, tilesetId: TS, tileSize: ts.tileSize,
  lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete proj.maps[mapId][k];
proj.mapTree?.children?.push?.({ mapId, children: [] });
const map = () => proj.maps[mapId];
const fillTool = CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!, stampTool = SHARED_OBJECT_TOOLS.find((t: any) => t.name === "stamp_object")!;
const GRASS = "버들항 풀밭", PAVING = "버들항 길 포석", PLAZA = "버들항 광장 판석", WATER = "버들항 강·운하 물", SAND = "버들항 모랫길";
const fill = (rect: any, material: string, clearUpper?: boolean) => { try { fillTool.run(proj, { mapId, rect, material, ...(clearUpper ? { clearUpper } : {}), _exactCells: true }); } catch (e) { warnings.push(`paint ${material}: ${(e as Error).message.slice(0, 120)}`); } };
const paintCells = (cells: number[], mat: string) => {
  const rows = new Map<number, number[]>(); for (const c of cells) { const y = Math.floor(c / W); (rows.get(y) ?? rows.set(y, []).get(y)!).push(c % W); }
  for (const [y, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0]!, p = s; for (let i = 1; i <= xs.length; i += 1) { const v = xs[i]; if (v === p + 1) { p = v; continue; } fill({ x: s, y, w: p - s + 1, h: 1 }, mat); if (v !== undefined) { s = v; p = v; } } }
};
fill({ x: 0, y: 0, w: W, h: H }, GRASS, true);
const all = [...Array(W * H).keys()];
paintCells(all.filter((c) => (kind[c] === "road" || (kind[c] === "stair" && !rampCells.has(c))) && !water[c] && roadMat.get(c) !== "track"), PAVING);
paintCells(all.filter((c) => (kind[c] === "track" || roadMat.get(c) === "track" || kind[c] === "gate" || rampCells.has(c)) && !water[c]), SAND);
paintCells(all.filter((c) => kind[c] === "plaza" || kind[c] === "plazaprop"), PLAZA);
paintCells(all.filter((c) => water[c]), WATER);
const canal = ts.autotileGroups?.find((g: any) => g.id === "beodeul_canal_lake_47");
const canalMembers = new Set(canal?.memberTileIds ?? []), fullWater = canal?.variantMap?.["255"] ?? -1;
for (const c of all) if (water[c] && canalMembers.has(map().lowerTiles[c])) map().lowerTiles[c] = fullWater;
// stamps
const stampFails: string[] = [];
const kitDef = (id: string) => (ts.structureKits ?? []).find((k: any) => k.id === id);
const stamp = (id: string, x: number, y: number) => { try { stampTool.run(proj, { objectId: `kit:${TS}/${id}`, mapId, x, y }); return true; } catch (e) { stampFails.push(`${id}@(${x},${y}): ${(e as Error).message.slice(0, 120)}`); return false; } };
// fields first (ground decals), then buildings, trees, props
const fieldList = arr("fields");
fieldList.forEach((f, i) => {
  if (f.crop === "vines") { for (let y = f.y; y < f.y + f.h; y += 4) for (let x = f.x; x < f.x + f.w; x += 8) stamp("bd-pick-vineyard-vine-field", x, y); return; }
  if (f.crop === "herbs" || f.crop === "flowers") { for (let y = f.y; y < f.y + f.h; y += 2) for (let x = f.x; x < f.x + f.w; x += 2) stamp(`bd-pick-wizard-tower-bed-${f.crop === "herbs" ? "herb" : "flower"}`, x, y); return; }
  const id = `bd-pick-wheat-roman-road-wheat-${f.crop === "wheat" ? "a" : f.crop === "barley" ? "b" : "c"}`;
  for (let y = f.y; y < f.y + f.h; y += 1) for (let x = f.x; x < f.x + f.w; x += 1) stamp(id, x, y);
});
const REVIEWED = [{ house: "bd-house-rv-", shadow: "bd-rv-shadow-", foundation: "bd-rv-foundation-" }, { house: "bd-house-mk-", shadow: "bd-mk-shadow-", foundation: "bd-mk-foundation-" }];
const stampedOk = placed.filter((p) => stamp(p.id, p.x, p.y));
// reviewed buildings' ground shadow (layer 2) and foundation (layer 4) go on after every kit, only on empty cells (as the village builder does)
for (const p of stampedOk) {
  const set = REVIEWED.find((r) => p.id.startsWith(r.house));
  if (set) for (const [prefix, layer] of [[set.shadow, 2], [set.foundation, 4]] as const) {
    const kit = kitDef(prefix + p.id.slice(set.house.length)); if (!kit) continue;
    kit.rows.forEach((row: any, j: number) => (row.upperTiles ?? []).forEach((t: number, i: number) => { const x = p.x + i, y = p.y + j; if (t >= 0 && inMap(x, y) && layerTileAt(map(), layer, idx(x, y)) < 0) setLayerTileAt(map(), layer, idx(x, y), t); }));
  }
}
if (stampFails.length) warnings.push(...stampFails.slice(0, 8).map((s) => `stamp failed ${s}`));
// fences (nature pack pieces, layer 3, passability of the ground woodland fence)
const natureTileset = () => { const t = proj.tilesets[BEODEUL_NATURE_ID]; return t && t.count >= BEODEUL_NATURE.count ? t : (proj.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset()); };
if (fenceAt.size) {
  const common = proj.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  const srcH = (groundCatalog as any).recipes.find((r: any) => r.id === "bdg-woodland-fence-horizontal")!.rows[0]![0]!;
  const tr = translateTiles(natureTileset(), ts, new Set([...fenceAt.values()].map((k) => BEODEUL_NATURE.fence[k])));
  for (const to of tr.map.values()) { ts.priority[to] = common.priority[srcH]!; ts.passability[to] = structuredClone(common.passability[srcH]!); }
  for (const [c, k] of fenceAt) setLayerTileAt(map(), 3, c, tr.map.get(BEODEUL_NATURE.fence[k])!);
}
// nature overlay (layer 2): grass banks on river/sea, forest canopy autotile, kit shadows
{
  const m = map(); const want = new Map<number, number>(), canopyAt = new Map<number, number>();
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  const wetOrPier = (n: number) => water[n] > 0;
  for (const c of all) if (water[c] && !roadMat.has(c) && m.lowerTiles[c] === fullWater) {
    const x = c % W, y = Math.floor(c / W); let mask = 0;
    N8.forEach(([dx, dy], b) => { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || wetOrPier(idx(nx, ny))) mask |= 1 << b; });
    const t = BEODEUL_NATURE.bankGrass[mask]!; if (t >= 0) want.set(c, t);
  }
  if (forestSet.size) {
    const plan = planBeodeulCanopy(W, H, "leaf", forestSet, (s) => !water[s] && !forestSet.has(s) && layerTileAt(m, 2, s) < 0 && !want.has(s) && !stairCells.has(s) && lv[s] === lv[s - W], (a, b) => lv[a] === lv[b]);
    for (const [c, t] of plan.canopy) canopyAt.set(c, t);
    for (const [c, t] of plan.shade) want.set(c, t);
  }
  for (const st of placed) {
    const sh = (BEODEUL_NATURE.shadows as any)[st.id]; if (!sh) continue;
    sh.rows.forEach((row: number[], j: number) => row.forEach((t, i) => {
      if (t < 0) return; const x = st.x + sh.dx + i, y = st.y + sh.dy + j; if (!inMap(x, y)) return; const c = idx(x, y);
      if (water[c] || forestSet.has(c) || want.has(c) || layerTileAt(m, 2, c) >= 0 || stairCells.has(c) || lv[c] !== lv[idx(st.x, st.y + st.h - 1)]) return;
      want.set(c, t);
    }));
  }
  if (want.size || canopyAt.size) {
    const tr = translateTiles(natureTileset(), ts, new Set([...want.values(), ...canopyAt.values()]));
    const blocked = new Set(canopyAt.values());
    for (const [from, to] of tr.map) { ts.priority[to] = "upper"; ts.passability[to] = blocked.has(from) ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true }; }
    for (const [c, t] of want) setLayerTileAt(m, 2, c, tr.map.get(t)!);
    for (const [c, t] of canopyAt) setLayerTileAt(m, c + W < W * H && canopyAt.has(c + W) ? 3 : 2, c, tr.map.get(t)!);
  }
}
// planks: road/pier cells on water = plank deck (fishing-port jetty art)
{
  const plank = kitDef("bd-pick-fishing-port-jetty-west");
  const mids = (plank?.rows ?? []).map((r: any) => r.tiles?.[0] ?? -1).filter((t: number) => t >= 0);
  let i = 0;
  for (const c of all) if (water[c] && roadMat.has(c) && mids.length) { map().lowerTiles[c] = mids[1 + (i % Math.max(1, mids.length - 1))] ?? mids[0]; for (const Lr of [2, 3, 4] as const) setLayerTileAt(map(), Lr, c, -1); i += 1; }
}
// relief; cut art = experiment-local ramp/stair pieces installed into the style art (ramps/install.mts), drawn by the relief renderer
{
  const m = map();
  if (lv.some((v) => v > 0)) {
    // stacked flights: drawn by the renderer from the single pieces in the canonical split (src/project/relief/cutPieces.ts)
    m.relief = { width: W, height: H, levels: lv.slice(), ramps: ramps.slice(), style: STYLE };
    invalidateReliefSlopes(m.relief);
    for (const c of stairCells) for (const Lr of [2, 3, 4] as const) setLayerTileAt(m, Lr, c, -1);
  }
}
const { renderMapPng } = await import("../../qa-game/render.mts");
writeFileSync(resolve(outDir!, "map.png"), renderMapPng(proj, map()).png);
writeFileSync(resolve(outDir!, "project.json"), JSON.stringify({ project: proj, mapId }));
done({ stats, rendered: true, stampFails: stampFails.length });
