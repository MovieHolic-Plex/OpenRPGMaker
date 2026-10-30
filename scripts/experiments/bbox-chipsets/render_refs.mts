// bbox-chipsets: render each place's judge anchors = that chipset's own existing example maps, with the same review renderer as the runs.
//   bun render_refs.mts <base dir> <out dir> <tilesetId> <src>...     src = jpx:<name> | mcx:<name> (HandInteriorInput example files) | wzr:<name> (regionReferences map snapshot)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildHandInteriorLayers } from "../../../src/editor/handInterior/builder";
import { effectiveSpec } from "./spec.mts";
const [baseDir, outDir, TS, ...srcs] = process.argv.slice(2);
mkdirSync(outDir!, { recursive: true });
const { loadHeadlessProject } = await import("../../../src/headless/index");
const base = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const tileset = base.tilesets[TS!]!; const S = effectiveSpec(tileset)!;
const { addRenderAssetRoot, renderReviewMapPng } = await import("../../qa-game/render.mts");
const { store } = await import("../../../src/project/store");
addRenderAssetRoot(resolve(baseDir!, "assets"));
const proto = structuredClone(Object.values(base.maps)[0]!);
for (const src of srcs) {
  const [kind, name] = src.split(":") as [string, string];
  const id = `ref-${name}`;
  let m: any;
  if (kind === "wzr") {
    const snap = JSON.parse(readFileSync(`src/project/regionReferences/${name}.json`, "utf8")).map;
    m = { ...proto, ...snap, id, events: [], tilesetId: TS };
  } else {
    const dir = kind === "jpx" ? "tiledata/jp-city/interior/examples" : "tiledata/modern-city/interior/examples";
    const input = JSON.parse(readFileSync(`${dir}/${name}.json`, "utf8"));
    const b = buildHandInteriorLayers(input, tileset, S);
    m = { ...proto, id, name, width: b.width, height: b.height, tilesetId: TS, tileSize: tileset.tileSize, lowerTiles: b.lowerTiles, upperTiles: b.upperTiles,
      lowerOverlayTiles: b.lowerOverlayTiles, upperOverlayTiles: b.upperOverlayTiles, events: [], climate: { mode: "indoor" } };
    for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete m[k];
  }
  base.maps[id] = m; base.mapTree.children.push({ mapId: id, children: [] });
}
store.replaceProject(base);
const cur = store.getCurrent();
for (const src of srcs) { const name = src.split(":")[1]!; writeFileSync(resolve(outDir!, `${name}.png`), renderReviewMapPng(cur, cur.maps[`ref-${name}`]!, 1).png as Buffer); console.log("ref", name); }
