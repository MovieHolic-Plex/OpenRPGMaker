/**
 * beodeul_organic sample — paints the Fallen Star B1 broadleaf woodland (shrine clearing spec) on a blank project,
 * then places the bundled natural props (`bd-org-*` kits on beodeul_city) between the trees and along the path.
 * Shared assets demo only: it does not touch Fallen Star content.
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/beodeul-organic/sample-map.mts <out.project.json>
 *   bun scripts/qa-game/render.mts --project <out.project.json> --out <dir>
 * Prints a passability check: every exit still reaches every other exit after placement.
 */
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { serialize } from "@/project/io";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { SHRINE_SPEC } from "@/project/flagship/fallen/forestSpecs";
import { paintWoodland } from "@/project/flagship/fallen/woodland";
import { beodeulOrganicKit } from "@/project/defaults/beodeulOrganic";
import catalog from "@/assets/beodeulOrganicCatalog.json";
import type { Project, StructureKitDef } from "@/project/types";

const out = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/beodeul-organic-sample.project.json";
const project: Project = createBlankProject();
ensureBundledTilesets(project as never);
const spec = {
  ...SHRINE_SPEC, id: "organic_sample_woodland", name: "자연 기물 견본 · 활엽 숲 빈터", undergrowth: 0,
  clearings: [...SHRINE_SPEC.clearings!, { cx: 8, cy: 22, rx: 5, ry: 3.6 }, { cx: 31, cy: 22, rx: 5, ry: 3.6 }, { cx: 20, cy: 4, rx: 4.5, ry: 2.6 }],
};
const r = paintWoodland(project, spec);
const map = project.maps[spec.id]!;
const ts = project.tilesets[map.tilesetId]!;
const W = map.width, H = map.height;
let s = 0x2f6b9 >>> 0;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const used = new Set<number>();
const reserve = new Set<number>();
for (const c of r.path) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserve.add(c + dy * W + dx);
for (const e of spec.exits) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 3; dx++) reserve.add((e.y + dy) * W + e.x + dx);

function fits(k: StructureKitDef, x: number, y: number, stand: boolean): boolean {
  if (x < 1 || y < 1 || x + k.width > W - 1 || y + k.height > H - 1) return false;
  for (let dy = -1; dy <= k.height; dy++) for (let dx = -1; dx <= k.width; dx++) if (used.has((y + dy) * W + x + dx)) return false;
  for (let dy = 0; dy < k.height; dy++) for (let dx = 0; dx < k.width; dx++) {
    const c = (y + dy) * W + x + dx;
    if (r.water.has(c) || r.path.has(c) || (stand && reserve.has(c))) return false;
    if (!r.open.has(c) && !(stand && r.forest.has(c) && dy < k.height - 1)) return false;
    if (layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 2, c) >= 0) return false;
  }
  return true;
}
function place(k: StructureKitDef, x: number, y: number): void {
  k.rows.forEach((row, dy) => {
    (row.upperTiles ?? []).forEach((n, dx) => { if (n >= 0) setLayerTileAt(map, 3, (y + dy) * W + x + dx, n); });
    (row.lowerOverlayTiles ?? []).forEach((n, dx) => { if (n >= 0) setLayerTileAt(map, 2, (y + dy) * W + x + dx, n); });
  });
  for (let dy = 0; dy < k.height; dy++) for (let dx = 0; dx < k.width; dx++) used.add((y + dy) * W + x + dx);
}

// landmarks first (clearing heart), then every item once, then extra walk-over decor in clumps
const order = [...catalog.items].sort((a, b) => (b.width * b.height) - (a.width * a.height));
const placed: string[] = [];
for (const it of order) {
  const k = beodeulOrganicKit(ts, it.id);
  if (!k) throw new Error(`kit bd-org-${it.id} missing on ${ts.id}`);
  for (let tries = 0; tries < 4000; tries++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (fits(k, x, y, it.layer === 3)) { place(k, x, y); placed.push(it.id); break; }
  }
}
const decor = catalog.items.filter((i) => i.layer === 2 && i.width === 1);
for (let n = 0; n < 40; n++) {
  const it = decor[Math.floor(rnd() * decor.length)]!;
  const k = beodeulOrganicKit(ts, it.id)!;
  for (let tries = 0; tries < 400; tries++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (fits(k, x, y, false)) { place(k, x, y); break; }
  }
}

// every exit must still reach every other exit
const start = spec.exits[0]!;
const seen = new Set([start.y * W + start.x]);
const q = [start.y * W + start.x];
while (q.length) {
  const c = q.pop()!, x = c % W, y = (c - x) / W;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, ny = y + dy, n = ny * W + nx;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !isPassable(project, map, nx, ny)) continue;
    seen.add(n); q.push(n);
  }
}
const unreached = spec.exits.filter((e) => !seen.has(e.y * W + e.x));
console.log(`placed ${placed.length}/${catalog.items.length} items (+decor), exits unreached: ${unreached.length}`);
const missing = catalog.items.filter((i) => !placed.includes(i.id)).map((i) => i.id);
if (missing.length) console.log("not placed:", missing.join(","));
for (const id of Object.keys(project.maps)) if (id !== spec.id) delete project.maps[id];
project.startMapId = spec.id;
writeFileSync(out, serialize(project));
console.log(out);
if (unreached.length) process.exit(1);
