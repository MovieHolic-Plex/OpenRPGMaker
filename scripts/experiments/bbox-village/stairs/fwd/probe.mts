// fwd copy of ../probe-any.mts (+ PROBE_ALT / PROBE_NOCUT). Per-style cliff-cut probe: one map with a cliff face of rise 1..4 and a ramp (w2) + stairs (w3) cut for each rise.
//   bun probe-any.mts <style> <face s|n> <out.png>     face s = south-facing cliff (high ground north, cut dir "n"),
//                                                       face n = north-facing cliff (high ground south, cut dir "s", reverse)
// Pieces come from the bundled rampArt.json, or from RAMP_PIECES=<pieces.json> (keys "<kind>:<dir>:<w>x<h>:<rise>", injected at runtime).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ensureBundledTilesets } from "../../../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../../../src/project/defaults.ts";
import { invalidateReliefSlopes, rampCode } from "../../../../../src/project/relief/walk.ts";
import rampArt from "../../../../../src/project/relief/rampArt.json";
import { STYLE_GROUND } from "../styles.mts";
import { reverseCutLength as revLen } from "../../../../../src/project/relief/cutPieces.ts";

const [style, face, out] = process.argv.slice(2) as [string, "s" | "n", string];
if (process.env.RAMP_PIECES) {
  const add = JSON.parse(readFileSync(process.env.RAMP_PIECES, "utf8"));
  const a = (rampArt as any)[style] ?? ((rampArt as any)[style] = {});
  a.pieces = { ...(a.pieces ?? {}), ...(add[style] ?? add) };
}
const G = STYLE_GROUND[style]!;
const W = 46, H = 15, CLIFF = 8;
const proj = createBlankProject() as any; ensureBundledTilesets(proj);
const TS = "beodeul_city", ts = proj.tilesets[TS], mapId = "probe";
proj.maps[mapId] = { ...structuredClone(Object.values(proj.maps)[0] as any), id: mapId, name: `probe ${style} ${face}`, width: W, height: H, tilesetId: TS, tileSize: 16,
  lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete proj.maps[mapId][k];
const m = proj.maps[mapId];
const kitRows = (id: string) => { const k = ts.structureKits.find((k: any) => k.id === id); if (!k) throw new Error(`kit ${id}`); return k.rows.map((r: any) => r.tiles as number[]); };
const tileFill = (kit: string, x0: number, y0: number, w: number, h: number) => { const R = kitRows(kit);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m.lowerTiles[y * W + x] = R[1 + ((y % 2) ? 0 : 0)]![1]!; // centre tile of the 3x3 (edge-free)
};
import { CONSTRUCTION_TOOLS_V3 } from "../../../../../src/editor/tools/v3/constructionTools.ts";
const fillTool = CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!;
const paint = (what: string, x0: number, y0: number, w: number, h: number) => G.material
  ? fillTool.run(proj, { mapId, rect: { x: x0, y: y0, w, h }, material: what, _exactCells: true }) : tileFill(what, x0, y0, w, h);
paint(G.ground, 0, 0, W, H);
const lv = new Array(W * H).fill(0), ramps = new Array(W * H).fill(0);
// sections: rise 1..4, each a ramp w2 + stairs w3
const S: [number, number, number, "ramp" | "stairs"][] = [];
let x = 1;
// PROBE_ALT=1: the other widths (ramp w3, stairs w2); PROBE_NOCUT=1: the same terraces with roads but no cut (face sampling)
const ALT = !!process.env.PROBE_ALT;
for (const r of [1, 2, 3, 4]) { S.push([x, ALT ? 3 : 2, r, "ramp"]); x += ALT ? 5 : 4; S.push([x, ALT ? 2 : 3, r, "stairs"]); x += ALT ? 4 : 5; if (r < 4) x += 1; }
const riseAt = (cx: number) => { let best = 1; for (const [x0, , r] of S) if (cx >= x0 - 1) best = r; return best; };
// high side: rows 0..CLIFF-1 (face s) or rows CLIFF..H-1 (face n)
const high = (y: number) => (face === "s" ? y < CLIFF : y >= CLIFF);
for (let y = 0; y < H; y++) for (let cx = 0; cx < W; cx++) if (high(y)) lv[y * W + cx] = riseAt(cx);
for (const [x0, w, , kind] of S) {
  paint(kind === "stairs" ? G.stairRoad ?? G.road : G.road, x0, 1, w, H - 2);
  // reverse (face n): the cut runs REV_LEN(r) cells north of the cliff on the low side (r of them hide behind the terrace in 3/4)
  const r = riseAt(x0), rows = face === "s" ? [CLIFF] : Array.from({ length: revLen(r) }, (_, k) => CLIFF - 1 - k);
  if (!process.env.PROBE_NOCUT) for (const cy of rows) for (let cx = x0; cx < x0 + w; cx++) ramps[cy * W + cx] = rampCode(face === "s" ? "n" : "s", kind === "stairs");
}
m.relief = { width: W, height: H, levels: lv, ramps, style };
invalidateReliefSlopes(m.relief);
if (process.env.PROBE_PROJECT) { mkdirSync(process.env.PROBE_PROJECT, { recursive: true }); writeFileSync(`${process.env.PROBE_PROJECT}/project.json`, JSON.stringify({ project: proj, mapId })); }
const { renderMapPng } = await import("../../../../qa-game/render.mts");
writeFileSync(out, renderMapPng(proj, m).png);
writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify({ W, H, CLIFF, face, style, sections: S }));
console.log("ok", out);
