// Before/after look check for the Beodeul tree and ground redraw: renders the five shipped example maps and a
// fresh tool-built village (author_beodeul_town, river theme, broadleaf forest, seed 7) at 1x with the current bundle.
//   bun scripts/qa/beodeul-provenance/render-examples.mts <outDir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { prepareTool } from "../../../src/editor/tools/asyncToolRunner";
import { renderMapPng } from "../../qa-game/render.mts";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: render-examples.mts <outDir>");
mkdirSync(outDir, { recursive: true });
const EXAMPLES: [string, string][] = [
  ["facilities-town", "tiledata/beodeul-facilities/town-example.json"],
  ["forms-town", "tiledata/beodeul-forms/town-example.json"],
  ["river-town", "tiledata/beodeul-ground/river-town-example.json"],
  ["village50", "tiledata/beodeul-ground/village50-example.json"],
  ["reviewed-street", "tiledata/beodeul-reviewed/street-example.json"],
];
for (const [name, file] of EXAMPLES) {
  const project = createBlankProject() as any;
  const ex = JSON.parse(readFileSync(file, "utf8"));
  const map = ex.map;
  const ts = project.tilesets[map.tilesetId];
  if (!ts) { console.log(name, "missing tileset", map.tilesetId); continue; }
  if (Array.isArray(ex.grafts) && ex.grafts.length) {
    const have = new Map((ts.tileGrafts ?? []).map((g: any) => [g.targetTile, g]));
    for (const g of ex.grafts) have.set(g.targetTile, g);
    ts.tileGrafts = [...have.values()];
    ts.count = Math.max(ts.count, ...ex.grafts.map((g: any) => g.targetTile + 1));
  }
  if (Array.isArray(ex.structureKits)) {
    const ids = new Set((ts.structureKits ?? []).map((k: any) => k.id));
    ts.structureKits = [...(ts.structureKits ?? []), ...ex.structureKits.filter((k: any) => !ids.has(k.id))];
  }
  project.maps[map.id] = map;
  const { png, note } = renderMapPng(project, map);
  writeFileSync(join(outDir, `${name}.png`), png);
  console.log(name, map.width, "x", map.height, note ?? "");
}
{
  const ctx = { project: createBlankProject() as any };
  const args = { name: "버들 마을 시험", theme: "river", forestType: "broadleaf", seed: 7 };
  await prepareTool("author_beodeul_town", args, ctx.project);
  const result = runTool(ctx, "author_beodeul_town", args, { dryRun: false });
  if (!result.ok) throw new Error(result.summary);
  const mapId = (result.data as any).mapId;
  const map = ctx.project.maps[mapId];
  const { png, note } = renderMapPng(ctx.project, map);
  writeFileSync(join(outDir, "tool-village.png"), png);
  console.log("tool-village", map.width, "x", map.height, note ?? "");
}
