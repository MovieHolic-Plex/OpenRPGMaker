// bbox-chipsets: raw piece list for one place, chosen from the chipset's own metadata (no hand lists).
//   bun catalog.mts <base dir> <tilesetId> <out pieces.json> [--rooms k1,k2] [--query "w1 w2 ..."] [--max 70]
// Selection: room-kind example tables (spec.rooms) when the chipset has them, then tag/description search hits; all floors/walls/tables.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { searchParts } from "../../../src/editor/handInterior/parts";
import { effectiveSpec } from "./spec.mts";
const [baseDir, tilesetId, out] = process.argv.slice(2);
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const rooms = (arg("--rooms") ?? "").split(",").filter(Boolean), query = arg("--query") ?? "", max = Number(arg("--max") ?? 70);
const { loadHeadlessProject } = await import("../../../src/headless/index");
const { BUNDLED_EASYRPG_CHIPSET_ASSETS } = await import("../../../src/assets/bundled");
const { bundledChipsetTilesPerRow } = await import("../../../src/assets/bundledChipsetGeometry");
const p = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const t = p.tilesets[tilesetId!];
const S = effectiveSpec(t);
const report: Record<string, unknown> = { tileset: tilesetId, roomKit: t?.roomKit ?? null, hasSpec: !!S };
if (!t || !S) { writeFileSync(out!, JSON.stringify({ ...report, error: "no room role table (roomKit) for this chipset" }, null, 1)); console.log("NO SPEC", tilesetId); process.exit(0); }
const key = (t.image as any).id as string;
const asset = (BUNDLED_EASYRPG_CHIPSET_ASSETS as any[]).find((a) => a.textureKey === key);
// 1) room-kind example tables
const used = new Map<string, number>();
const kindInfo: Record<string, unknown> = {};
for (const k of rooms) if (S.rooms?.kinds[k]) kindInfo[k] = S.rooms.kinds[k];
for (const [, , room, items] of S.rooms?.examples ?? []) if (rooms.includes(room)) for (const [id, n] of items) used.set(id, (used.get(id) ?? 0) + n);
const tablesUsed = new Set<string>();
const objIds: string[] = [];
for (const [id] of [...used].sort((a, b) => b[1] - a[1])) {
  const sized = /^([a-z-]+) (\d+)x(\d+)$/u.exec(id);
  if (S.objects[id]) objIds.push(id); else if (sized && S.tables[sized[1]!]) tablesUsed.add(sized[1]!);
}
report.fromExamples = objIds.length;
// 2) search hits (tags, names, descriptions, place notes) for the query words, ranked by number of words hit
if (query) {
  const r = searchParts(query, "", S);
  const ranked = [...r.hits].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  for (const id of ranked) { if (objIds.length >= max) break; if (!objIds.includes(id)) objIds.push(id); }
}
report.objects = objIds.length;
const objects = objIds.slice(0, max).map((id) => { const o = S.objects[id]!; return { id, ko: o.ko, kind: o.kind, w: o.w, h: o.h, up: o.up ?? 0, cells: o.cells, desc: o.desc ?? "", tags: o.tags ?? [], place: o.place ?? "", use: o.use ?? [], stairs: o.stairs ?? null, fromExample: used.has(id) }; });
const floors = Object.entries(S.floors).map(([id, f]) => ({ id, ko: f.ko, cols: f.cols, rows: f.rows, tiles: f.tiles }));
const walls = Object.entries(S.walls).map(([id, w]) => ({ id, ko: w.ko, cols: w.cols, tiles: w.tiles }));
const tables = Object.entries(S.tables).map(([id, tb]) => ({ id, ko: tb.ko, oneRow: tb.oneRow, used: tablesUsed.has(id) }));
const lines = Object.entries(S.lines).map(([id, l]) => ({ id, ko: l.ko, kind: l.kind }));
const daises = Object.entries(S.daises).map(([id, d]) => ({ id, ko: d.ko }));
writeFileSync(out!, JSON.stringify({ ...report, sheet: asset?.path ? `public/${asset.path}` : null, tilesPerRow: bundledChipsetTilesPerRow(key), tileSize: t.tileSize,
  rooms: kindInfo, floors, walls, tables, lines, daises, objects }, null, 1));
console.log(JSON.stringify(report));
