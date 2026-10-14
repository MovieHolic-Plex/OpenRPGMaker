// 저장한 지도(jp-street-probe 의 street-N.map.json)를 다시 잰다 — bun scripts/qa/jp-lot-measure.mts a.map.json [...]
import fs from "node:fs";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { measureLotEmptiness } from "./jpLotEmptiness.mts";
const p = createNewProjectSeed("adventure-jrpg", "t") as never as Parameters<typeof measureLotEmptiness>[0]; ensureBundledTilesets(p as never);
for (const f of process.argv.slice(2)) {
  const m = JSON.parse(fs.readFileSync(f, "utf8"));
  const e = measureLotEmptiness(p, m);
  console.log(`${f} empty ${(e.ratio * 100).toFixed(1)}% (${e.empty}/${e.lot})`);
  fs.writeFileSync(f.replace(".map.json", ".empty.json"), JSON.stringify({ w: m.width, h: m.height, ratio: e.ratio, empty: e.empty, lot: e.lot, mask: Array.from(e.mask) }));
}
