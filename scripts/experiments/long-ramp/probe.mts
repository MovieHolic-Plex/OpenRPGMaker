// Long ramp probe: cliffs of rise 2/4/6/8 (south faces) with a north ramp whose length = rise, rendered offline.
//   bun scripts/experiments/long-ramp/probe.mts <out.png> [pieces.json] [--short]
//   --short: the old one-row cut (length 1; 5~8 stacked) for the BEFORE picture.
import { readFileSync, writeFileSync } from "node:fs";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../../src/editor/tools/v3/constructionTools.ts";
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "../../../src/project/relief/walk.ts";
import rampArt from "../../../src/project/relief/rampArt.json";

const [out, pf] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const short = process.argv.includes("--short");
if (pf) Object.assign((rampArt as any)["grass-steps"].pieces, JSON.parse(readFileSync(pf, "utf8")));
const RISES = [2, 4, 6, 8], W = 28, TOP = 1, CLIFF = 9, H = CLIFF + 10;
const proj = createBlankProject() as any; ensureBundledTilesets(proj);
const mapId = "probe";
proj.maps[mapId] = { ...structuredClone(Object.values(proj.maps)[0] as any), id: mapId, name: "probe", width: W, height: H, tilesetId: "beodeul_city", tileSize: 16,
  lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete proj.maps[mapId][k];
const fill = CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!;
fill.run(proj, { mapId, rect: { x: 0, y: 0, w: W, h: H }, material: "버들항 풀밭", _exactCells: true });
const lv = new Array(W * H).fill(0), ramps = new Array(W * H).fill(0);
const walks: string[] = [];
RISES.forEach((rise, k) => {
  const x0 = k * 7;
  for (let y = TOP; y < CLIFF; y++) for (let x = x0; x < x0 + 6; x++) lv[y * W + x] = rise;
  const len = short ? (rise > 4 ? 2 : 1) : 2;
  for (let d = 0; d < len; d++) for (let x = x0 + 2; x < x0 + 4; x++) ramps[(CLIFF + d) * W + x] = rampCode("n", false);
});
const m = proj.maps[mapId];
m.relief = { width: W, height: H, levels: lv, ramps };
invalidateReliefSlopes(m.relief);
RISES.forEach((rise, k) => {
  const x = k * 7 + 2; let y = H - 1, ok = true;
  while (ok && y > TOP) { ok = reliefAllowsStep(m.relief, x, y, x, y - 1); y--; if (lv[y * W + x] === rise && !ramps[y * W + x]) break; }
  walks.push(`${rise}단:${ok && lv[y * W + x] === rise ? "올라감" : "막힘"}`);
});
const { renderMapPng } = await import("../../qa-game/render.mts");
writeFileSync(out!, renderMapPng(proj, m).png);
console.log("ok", out, walks.join(" "));
