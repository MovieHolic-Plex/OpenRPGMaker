// bbox-chipsets: outdoor piece list for a chipset WITHOUT a room role table — read straight from the tileset definition:
//   grounds = tileGroups with role terrain/water (autotile groups are drawn with edges), pieces = structureKits (building/wall/prop) picked by search words.
//   bun outdoor_catalog.mts <base dir> <tilesetId> <out pieces.json> --query "w1 w2 ..." [--max 70] [--grounds "id1,id2"]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const [baseDir, tilesetId, out] = process.argv.slice(2);
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const query = (arg("--query") ?? "").split(/\s+/u).filter(Boolean), max = Number(arg("--max") ?? 70);
const { loadHeadlessProject } = await import("../../../src/headless/index");
const { BUNDLED_EASYRPG_CHIPSET_ASSETS } = await import("../../../src/assets/bundled");
const { bundledChipsetTilesPerRow } = await import("../../../src/assets/bundledChipsetGeometry");
const p = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const t = p.tilesets[tilesetId!]!;
const key = (t.image as any).id as string;
const asset = (BUNDLED_EASYRPG_CHIPSET_ASSETS as any[]).find((a) => a.textureKey === key);
const autoByMember = new Map<number, string>();
for (const g of Object.values(t.autotileGroups ?? {}) as any[]) for (const m of g.memberTileIds ?? []) autoByMember.set(m, g.id);
const blocked = (n: number) => { const q = t.passability[n]; return !!q && !q.up && !q.down && !q.left && !q.right; };
const score = (text: string) => query.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
// grounds: flat terrain groups; an autotile group is used when the group's tiles belong to one (its full tile is drawn with edges)
const grounds: any[] = [];
for (const g of (t.tileGroups ?? []) as any[]) {
  if (!["terrain", "water"].includes(g.role) || g.defaultLayer !== "lower" || !g.tileIds?.length) continue;
  const auto = autoByMember.get(g.tileIds[0]);
  const s = score(`${g.name} ${g.id}`);
  grounds.push({ id: g.id.replace(/^[a-z]+:/u, ""), group: g.id, ko: g.name, tiles: g.tileIds, autotile: auto ?? null, score: s, walk: !blocked(g.tileIds[0]) });
}
grounds.sort((a, b) => b.score - a.score);
const keepGrounds = grounds.filter((g) => g.score > 0).slice(0, 12);
for (const g of grounds) if (keepGrounds.length < 8 && !keepGrounds.includes(g)) keepGrounds.push(g);
// pieces
const kits = (t.structureKits ?? []).filter((k: any) => k.kind === "section" && k.rows?.length && ["building", "wall", "prop", "fence"].includes(k.ai?.role ?? ""));
const ranked = kits.map((k: any) => ({ k, s: score(`${k.name} ${k.id} ${k.ai?.description ?? ""} ${(k.ai?.tags ?? []).join(" ")}`) })).filter((r: any) => r.s > 0).sort((a: any, b: any) => b.s - a.s);
const seen = new Map<string, number>();
const picked = ranked.filter(({ k }: any) => { const stem = k.id.replace(/_[a-j]$/u, ""); const n = seen.get(stem) ?? 0; seen.set(stem, n + 1); return n < 1; });
const objects = picked.slice(0, max).map(({ k }: any) => {
  const cells: [number, number, number, number][] = [];
  const grid: string[] = [];
  k.rows.forEach((row: any, y: number) => {
    let line = "";
    for (let x = 0; x < k.width; x++) {
      const lo = row.tiles?.[x] ?? -1, up = row.upperTiles?.[x] ?? -1;
      if (lo >= 0) cells.push([x, y, lo, 1]); if (up >= 0) cells.push([x, y, up, 3]);
      line += lo < 0 && up < 0 ? "." : (lo >= 0 && blocked(lo)) || (up >= 0 && blocked(up)) ? "X" : "o";
    }
    grid.push(line);
  });
  return { id: k.id, ko: k.name ?? k.id, role: k.ai?.role, kind: "kit", w: k.width, h: k.rows.length, up: 0, cells, grid, desc: (k.ai?.description ?? "").replace(/칸 통행 격자.*$/su, "").slice(0, 200), tags: k.ai?.tags ?? [], place: k.ai?.placementRules ?? "", use: [], stairs: null };
});
writeFileSync(out!, JSON.stringify({ tileset: tilesetId, mode: "outdoor", sheet: asset?.path ? `public/${asset.path}` : null, tilesPerRow: bundledChipsetTilesPerRow(key), tileSize: t.tileSize,
  rooms: {}, floors: [], walls: [], tables: [], lines: [], daises: [], grounds: keepGrounds, objects }, null, 1));
console.log(JSON.stringify({ tileset: tilesetId, grounds: keepGrounds.length, kits: kits.length, matched: ranked.length, objects: objects.length }));
