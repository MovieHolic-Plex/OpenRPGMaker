// Render the 버들항 map reloaded from the canonical store (save-beodeul-city.mjs → verify-shots/beodeul-assistant-r2/reloaded-map.json)
// with the repo's canvas renderer (scripts/qa-game/render.mts → editor/mapTileDraw, frame 0 of every animation strip) and
// diff it against the Python originals: city6.png (with townsfolk drawn in) and the no-townsfolk render the tiles were cut from.
//   bun scripts/content/render-beodeul-city.mts
import fs from "node:fs";
import { PNG } from "pngjs";
import { renderMapPng } from "../qa-game/render.mts";
import { createBlankProject } from "../../src/project/defaults/defaultProject.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import type { GameMap } from "../../src/project/types.ts";

const OUT = "verify-shots/beodeul-assistant-r2";
const saved = JSON.parse(fs.readFileSync(`${OUT}/reloaded-map.json`, "utf8")) as { projectId: string; map: GameMap };
const project = createBlankProject();
ensureBundledTilesets(project);
const map: GameMap = { ...saved.map, events: [] };           // townsfolk are events; the tile render leaves them out
project.maps = { [map.id]: map };
project.startMapId = "none";
const { png, note } = renderMapPng(project, map);
if (note) throw new Error(note);
fs.writeFileSync(`${OUT}/reloaded-render.png`, png);
const read = (file: string) => PNG.sync.read(fs.readFileSync(file));
const got = PNG.sync.read(png);
function diff(label: string, file: string) {
  const want = read(file);
  if (want.width !== got.width || want.height !== got.height) throw new Error(`${label}: size ${want.width}x${want.height} vs ${got.width}x${got.height}`);
  let px = 0, max = 0, sum = 0;
  const heat = new PNG({ width: got.width, height: got.height });
  const cells = new Set<number>();
  for (let i = 0; i < got.width * got.height; i += 1) {
    let d = 0;
    for (let c = 0; c < 3; c += 1) d = Math.max(d, Math.abs(got.data[i * 4 + c]! - want.data[i * 4 + c]!));
    const o = i * 4;
    const g = Math.round((want.data[o]! + want.data[o + 1]! + want.data[o + 2]!) / 3 * 0.35);
    heat.data[o] = d ? 255 : g; heat.data[o + 1] = d ? 40 : g; heat.data[o + 2] = d ? 40 : g; heat.data[o + 3] = 255;
    if (d) { px += 1; sum += d; max = Math.max(max, d); cells.add(Math.floor(Math.floor(i / got.width) / 16) * 100 + Math.floor((i % got.width) / 16)); }
  }
  fs.writeFileSync(`${OUT}/diff-${label}.png`, PNG.sync.write(heat));
  return { against: file, pixels: got.width * got.height, differing: px, ratio: +(px / (got.width * got.height)).toFixed(6), maxChannelDelta: max,
    meanDeltaOfDiffering: px ? +(sum / px).toFixed(2) : 0, cellsTouched: cells.size };
}
const result = {
  projectId: saved.projectId,
  render: `${OUT}/reloaded-render.png`,
  vsNoTownsfolk: diff("vs-cut-source", "tiledata/beodeul-city/render/city6.png"),
  vsCity6: diff("vs-city6", "tiledata/beodeul-city/render-full/city6.png"),
};
fs.writeFileSync(`${OUT}/pixel-diff.json`, JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify(result));
