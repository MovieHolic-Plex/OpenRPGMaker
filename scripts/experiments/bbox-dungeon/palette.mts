// bbox-dungeon: palette sheet (every catalog piece drawn in a real wall/floor setting) + catalog text for the layout model.
//   bun scripts/experiments/bbox-dungeon/palette.mts <out dir>   → palette-raw.png, palette.json (piece boxes), catalog.txt
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { composeDungeon } from "../../../src/editor/dungeonKit/beodeul/compose";
import { Grid } from "../../../src/editor/dungeonKit/grid";
import { kitSupportKind } from "../../../src/project/groundSupport";
import type { GameMap } from "../../../src/project/types";
import { PIECES, TRAPS, LIGHTS, STATUES } from "./pieces.mts";
import { loadPool, POOL_CLASS, POOL_NAMES } from "./pool.mts";

const out = process.argv[2]!; mkdirSync(out, { recursive: true });
const project = createBlankProject();
const ts = project.tilesets["beodeul_city"]!;
const poolN = await loadPool(project);
const kit = (n: string) => ts.structureKits!.find((k) => k.id === PIECES[n])!;
const cls = (n: string) => { if (POOL_CLASS[n]) return POOL_CLASS[n]; const k = kit(n); const sk = kitSupportKind(k); const role = String(k.ai?.role ?? ""); const up = k.rows.some((r) => (r.upperTiles ?? []).some((t) => t >= 0));
  return n === "stairs up" || sk === "mount" || sk === "door" ? "wall" : role === "terrain" || role === "floor" || !up ? "decal" : "floor"; };
const names = Object.keys(PIECES);
const wallN = names.filter((n) => cls(n) === "wall"), floorN = names.filter((n) => cls(n) !== "wall");
const W = 64;
// bands: band 0 = wall pieces on its north face; following bands = floor pieces (height 8 floor each)
const bands: { y: number; h: number }[] = [];
let y = 4; const BH = 4;
const boxes: { name: string; x: number; y: number; w: number; h: number }[] = [];
let bx = 2; let band = 0; bands.push({ y, h: 3 });
for (const n of wallN) { const k = kit(n); if (bx + k.width > W - 2) { band += 1; y += 3 + 4; bands.push({ y, h: 3 }); bx = 2; } boxes.push({ name: n, x: bx, y: y - 2 - (k.height > 2 ? k.height - 2 : 0), w: k.width, h: k.height }); bx += k.width + 3; }
y += 3 + 4; bands.push({ y, h: BH }); bx = 2;
for (const n of floorN) { const k = kit(n); if (bx + k.width > W - 2) { y += BH + 4; bands.push({ y, h: BH }); bx = 2; } boxes.push({ name: n, x: bx, y: y + 1, w: k.width, h: k.height }); bx += Math.max(k.width, 4) + 2; }
const H = y + BH + 2;
const g = new Grid(W, H);
for (const b of bands) for (let yy = b.y; yy < b.y + b.h; yy += 1) for (let x = 1; x < W - 1; x += 1) { g.floor[yy * W + x] = 1; g.roomAt[yy * W + x] = 0; }
const comp = composeDungeon(ts, { type: "catacomb", seed: 7, exact: { layout: { rooms: [{ id: "p", kind: "hall", x: 1, y: 4, w: W - 2, h: H - 6, from: null, dir: null, depth: 0 }], corridors: [], width: W, height: H, notes: [], grid: g, thin: true }, liqKind: new Uint8Array(W * H) } } as never) as any;
const { lower, upper } = comp.exactOut;
for (const b of boxes) { const k = kit(b.name); k.rows.forEach((r, dy) => r.tiles.forEach((t, dx) => { const i = (b.y + dy) * W + b.x + dx; if (t >= 0) lower[i] = t; const u = r.upperTiles?.[dx] ?? -1; if (u >= 0) upper[i] = u; })); }
const { renderReviewMapPng } = await import("../../qa-game/render.mts");
const start = project.maps[project.startMapId]!;
const m = { ...structuredClone(start), id: "pal", width: W, height: H, tilesetId: ts.id, lowerTiles: lower, upperTiles: upper, lowerOverlayTiles: new Array(W * H).fill(-1), upperOverlayTiles: new Array(W * H).fill(-1), events: [] } as GameMap;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete (m as any)[k];
writeFileSync(resolve(out, "palette-raw.png"), renderReviewMapPng(project, m, 1).png as Buffer);
writeFileSync(resolve(out, "palette.json"), JSON.stringify(boxes));
const cat = (n: string) => POOL_NAMES.has(n) ? "new object" : n === "stairs up" || n === "stairs down" ? "stairs" : TRAPS.has(n) ? "trap" : LIGHTS.has(n) ? "light" : STATUES.has(n) ? "statue" : "object";
const RULE: Record<string, string> = {
  wall: "wall-mounted: hangs on the north wall face of an open area (the solid rows right above its top floor row); a 2-tall piece covers the 2 face rows just above the floor, a 1-tall piece sits on the face row 2 above the floor",
  floor: "floor: stands on walkable floor and blocks walking; art taller than 1 row may overlap the wall face above",
  decal: "floor decal: walkable, drawn on the floor (may not overlap water/lava/pit)",
};
const L = ["# Piece catalog (beodeul dungeon chipset, 16px cells). The attached sheet shows every piece with its exact id.", "id | w x h cells | category | placement"];
for (const n of names) { const k = kit(n); L.push(`${n} | ${k.width}x${k.height} | ${cat(n)} | ${RULE[cls(n)]}`); }
writeFileSync(resolve(out, "catalog.txt"), L.join("\n") + "\n");
console.log("ok", boxes.length, W, H, "pool", poolN);
