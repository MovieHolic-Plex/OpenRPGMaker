// Two alternative, CORRECT 100x100 layouts of 버들항 built the way the editor assistant builds them (same tools, same kits):
// create_map -> fill_region -> stamp_object (district kits, houses, props, trees) -> lay_path / fill_region (autotile streets, canal, sand path).
// Every call is logged; the log is the recipe that the reference documents print. The layouts are NOT the original city:
// districts move, the harbour is rebuilt from the lake kit, streets are new.
//
//   bun scripts/content/author-beodeul-layouts.mts [--only hilltop|estuary]
// Output: verify-shots/beodeul-layouts/<id>/{render.png, recipe.json, metrics.json, roles.txt}
import fs from "node:fs";
import { createBlankProject } from "../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { analyzeBeodeul, type Stamp } from "./lib/beodeul-metrics.ts";
import { LAYOUTS } from "./lib/beodeul-layout-specs.ts";

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
const canon = JSON.parse(fs.readFileSync("tiledata/beodeul-city/map.json", "utf8"));
for (const spec of LAYOUTS) {
  if (only && spec.id !== only) continue;
  const p: any = createBlankProject(); ensureBundledTilesets(p);
  const ctx: any = { project: p }; const log: { name: string; args: unknown; ok: boolean; summary: string }[] = []; const stamps: Stamp[] = [];
  const { api } = makeApi(ctx, spec.id, stamps, log);
  call0(api, spec);
  const map = ctx.project.maps[spec.id];
  const dir = `verify-shots/beodeul-layouts/${spec.id}`; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/render.png`, renderMapPng(ctx.project, map, 1).png);
  const metrics = analyzeBeodeul(ctx.project, spec.id, stamps, { lower: canon.lowerTiles, upper: canon.upperTiles });
  fs.writeFileSync(`${dir}/recipe.json`, JSON.stringify({ id: spec.id, name: spec.name, calls: log.filter((l) => l.ok).map((l) => ({ name: l.name, args: l.args })) }, null, 1));
  fs.writeFileSync(`${dir}/metrics.json`, JSON.stringify(metrics, null, 1));
  fs.writeFileSync(`${dir}/map.json`, JSON.stringify({ width: map.width, height: map.height, lowerTiles: map.lowerTiles, upperTiles: map.upperTiles }));
  console.log(spec.id, JSON.stringify({ calls: log.length, failed: log.filter((l) => !l.ok).length, ...metrics, districts: metrics.districts.map((d) => `${d.id}${d.present ? "✓" : "·"}`).join(" "), defects: Object.fromEntries(Object.entries(metrics.defects).map(([k, v]) => [k, (v as unknown[]).length])) }));
  // tampered copies: the same checks must catch each one (error pictures for the reference documents)
  const tres: unknown[] = [];
  for (const t of spec.tampers ?? []) {
    const ctx2: any = { project: structuredClone(ctx.project) }; const st2 = [...stamps]; const log2: typeof log = [];
    const { api: api2 } = makeApi(ctx2, spec.id, st2, log2);
    t.apply(api2, st2);
    const m2 = analyzeBeodeul(ctx2.project, spec.id, st2);
    fs.writeFileSync(`${dir}/${t.id}.png`, renderMapPng(ctx2.project, ctx2.project.maps[spec.id], 1).png);
    const d2 = Object.fromEntries(Object.entries(m2.defects).filter(([, v]) => (v as unknown[]).length).map(([k, v]) => [k, v]));
    tres.push({ id: t.id, caption: t.caption, box: t.box, calls: log2.map((l) => ({ name: l.name, args: l.args, ok: l.ok })), detected: d2,
      streetReach: { reached: m2.streetReach.reached, total: m2.streetReach.total, unreached: m2.streetReach.unreached } });
    console.log(spec.id, t.id, JSON.stringify(d2).slice(0, 300));
  }
  fs.writeFileSync(`${dir}/tampers.json`, JSON.stringify(tres, null, 1));
}
function call0(api: any, spec: any) {
  api.call("create_map", { id: spec.id, name: spec.name, width: 100, height: 100, tilesetId: "beodeul_city" });
  api.fill({ x: 0, y: 0, w: 100, h: 100 }, "버들항 풀밭");
  spec.build(api);
}
function makeApi(ctx: any, mapId: string, stamps: Stamp[], log: { name: string; args: unknown; ok: boolean; summary: string }[]) {
  const call = (name: string, args: any) => { const r = runTool(ctx, name, args); log.push({ name, args, ok: r.ok, summary: String(r.summary ?? "").slice(0, 300) });
    if (!r.ok) console.log(`[${mapId}] FAIL ${name} ${JSON.stringify(args).slice(0, 140)} → ${String(r.summary).slice(0, 200)}`); return r; };
  const spec = { id: mapId };
  const api = {
    project: () => ctx.project as any,
    tileset: () => ctx.project.tilesets.beodeul_city as any,
    map: () => ctx.project.maps[spec.id] as any,
    call,
    stamp(id: string, x: number, y: number) { const r = call("stamp_object", { objectId: `kit:beodeul_city/${id}`, mapId: spec.id, x, y }); if (r.ok) stamps.push({ objectId: `kit:beodeul_city/${id}`, x, y }); return r.ok; },
    fill(rect: { x: number; y: number; w: number; h: number }, material: string) { return call("fill_region", { mapId: spec.id, rect, material }).ok; },
    path(points: { x: number; y: number }[], material = "버들항 길 포석") { return call("lay_path", { mapId: spec.id, points, material, naturalness: 0 }).ok; },
  };
  return { api };
}
