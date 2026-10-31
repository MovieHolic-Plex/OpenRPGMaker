// bbox-village ramps: synthetic cliff test map (cliff heights 1, 2, 3; south faces) with ramp/stair cuts, rendered with the
// experiment-local pieces injected into the relief style art at runtime (not bundled).
//   bun scripts/experiments/bbox-village/ramps/probe.mts <pieces.json> <out.png> [--none]
import { readFileSync, writeFileSync } from "node:fs";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../../src/project/defaults.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../../../src/editor/tools/v3/constructionTools.ts";
import { invalidateReliefSlopes, rampCode } from "../../../../src/project/relief/walk.ts";
import { installPieces } from "./install.mts";

const [pf, out] = process.argv.slice(2);
if (!process.argv.includes("--none")) installPieces(JSON.parse(readFileSync(pf!, "utf8")));
const W = 33, H = 13;
const proj = createBlankProject() as any; ensureBundledTilesets(proj);
const TS = "beodeul_city", ts = proj.tilesets[TS], mapId = "probe";
proj.maps[mapId] = { ...structuredClone(Object.values(proj.maps)[0] as any), id: mapId, name: "probe", width: W, height: H, tilesetId: TS, tileSize: 16,
  lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete proj.maps[mapId][k];
const fill = CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!;
const f = (rect: any, material: string) => fill.run(proj, { mapId, rect, material, _exactCells: true });
f({ x: 0, y: 0, w: W, h: H }, "버들항 풀밭");
const lv = new Array(W * H).fill(0), ramps = new Array(W * H).fill(0);
const CLIFF = 6;   // first low row
// sections: [x0, width, rise, kind, road material]
const S: [number, number, number, "ramp" | "stairs", string][] = [
  [1, 2, 1, "ramp", "버들항 모랫길"], [6, 3, 1, "stairs", "버들항 길 포석"],
  [12, 2, 2, "ramp", "버들항 모랫길"], [17, 3, 2, "stairs", "버들항 길 포석"],
  [23, 3, 3, "ramp", "버들항 모랫길"], [28, 2, 3, "stairs", "버들항 길 포석"]];
const rise = (x: number) => (x < 11 ? 1 : x < 22 ? 2 : 3);
for (let y = 0; y < CLIFF; y++) for (let x = 0; x < W; x++) lv[y * W + x] = rise(x);
for (const [x0, w, r, kind, mat] of S) {
  f({ x: x0, y: 1, w, h: CLIFF - 1 }, mat); f({ x: x0, y: CLIFF, w, h: H - CLIFF - 1 }, mat);
  for (let x = x0; x < x0 + w; x++) ramps[CLIFF * W + x] = rampCode("n", kind === "stairs");
}
f({ x: 0, y: H - 2, w: W, h: 1 }, "버들항 모랫길");
const m = proj.maps[mapId];
m.relief = { width: W, height: H, levels: lv, ramps, style: "grass-steps" };
invalidateReliefSlopes(m.relief);
if (process.env.PROBE_PROJECT) { const { mkdirSync } = await import("node:fs"); mkdirSync(process.env.PROBE_PROJECT, { recursive: true }); writeFileSync(`${process.env.PROBE_PROJECT}/project.json`, JSON.stringify({ project: proj, mapId })); }
const { renderMapPng } = await import("../../../qa-game/render.mts");
writeFileSync(out!, renderMapPng(proj, m).png);
writeFileSync(out!.replace(/\.png$/, ".json"), JSON.stringify({ W, H, CLIFF, sections: S }));
console.log("ok", out);
