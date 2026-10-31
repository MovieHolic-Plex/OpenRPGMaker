// bbox-village ramps r3: h4 cliffs and stacked flights (a one-row strip of a middle level = the landing) on a synthetic map,
// rendered with the single pieces; the renderer composes stacks in the canonical split (src/project/relief/cutPieces.ts).
//   bun scripts/experiments/bbox-village/ramps/probe2.mts <pieces.json> <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../../src/project/defaults.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../../../src/editor/tools/v3/constructionTools.ts";
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "../../../../src/project/relief/walk.ts";
import { installPieces } from "./install.mts";

const [pf, out] = process.argv.slice(2);
const P: Record<string, { w: number; h: number; rgba: number[] }> = JSON.parse(readFileSync(pf!, "utf8"));
installPieces(P);
const W = 34, H = 15, CLIFF = 7;
const proj = createBlankProject() as any; ensureBundledTilesets(proj);
const TS = "beodeul_city", mapId = "probe2";
proj.maps[mapId] = { ...structuredClone(Object.values(proj.maps)[0] as any), id: mapId, name: "probe2", width: W, height: H, tilesetId: TS, tileSize: 16,
  lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete proj.maps[mapId][k];
const fill = CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!;
const f = (rect: any, material: string) => fill.run(proj, { mapId, rect, material, _exactCells: true });
f({ x: 0, y: 0, w: W, h: H }, "버들항 풀밭");
const lv = new Array(W * H).fill(0), ramps = new Array(W * H).fill(0);
// zones: [x0, x1) with a profile: "h4" = level 4 above the cliff; "s22" = 4 / strip 2 / 0; "s12" = 3 / strip 1 / 0
const Z: [number, number, string][] = [[0, 11, "h4"], [11, 23, "s22"], [23, 34, "s12"]];
// sections: [x0, w, kind, zone]
const S: [number, number, "ramp" | "stairs", string][] = [[2, 2, "ramp", "h4"], [6, 3, "stairs", "h4"], [13, 3, "stairs", "s22"], [18, 2, "ramp", "s22"], [25, 2, "stairs", "s12"], [29, 3, "ramp", "s12"]];
for (const [x0, x1, z] of Z) for (let x = x0; x < x1; x++) for (let y = 0; y < CLIFF; y++)
  lv[y * W + x] = z === "h4" ? 4 : z === "s22" ? (y === CLIFF - 1 ? 2 : 4) : (y === CLIFF - 1 ? 1 : 3);
const report: string[] = [];
for (const [x0, w, kind, z] of S) {
  const mat = kind === "ramp" ? "버들항 모랫길" : "버들항 길 포석";
  f({ x: x0, y: 1, w, h: CLIFF - 1 }, mat); f({ x: x0, y: CLIFF, w, h: H - CLIFF - 1 }, mat);
  const code = rampCode("n", kind === "stairs");
  if (z === "h4") { for (let x = x0; x < x0 + w; x++) ramps[CLIFF * W + x] = code; continue; }
  for (let x = x0; x < x0 + w; x++) { ramps[CLIFF * W + x] = code; ramps[(CLIFF - 1) * W + x] = code; lv[(CLIFF - 1) * W + x] = 0; }
}
f({ x: 0, y: H - 2, w: W, h: 1 }, "버들항 모랫길");
const m = proj.maps[mapId];
m.relief = { width: W, height: H, levels: lv, ramps, style: "grass-steps" };
invalidateReliefSlopes(m.relief);
// walking check: from the road below to the road above through every section
for (const [x0, , kind, z] of S) {
  let ok = true; for (let y = CLIFF + 1; y > 0; y--) ok &&= reliefAllowsStep(m.relief, x0, y, x0, y - 1);
  report.push(`${kind} ${z} x=${x0}: walk ${ok ? "ok" : "BLOCKED"}`);
}
if (process.env.PROBE_PROJECT) { const { mkdirSync } = await import("node:fs"); mkdirSync(process.env.PROBE_PROJECT, { recursive: true }); writeFileSync(`${process.env.PROBE_PROJECT}/project.json`, JSON.stringify({ project: proj, mapId })); }
const { renderMapPng } = await import("../../../qa-game/render.mts");
writeFileSync(out!, renderMapPng(proj, m).png);
writeFileSync(out!.replace(/\.png$/, ".json"), JSON.stringify({ W, H, CLIFF, sections: S, report }));
console.log(report.join("\n")); console.log("ok", out);
