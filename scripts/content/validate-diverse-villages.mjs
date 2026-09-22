// Exact study comparison, not an aesthetic scorer or detector for arbitrary villages.
import fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
const catalog = JSON.parse(fs.readFileSync(new URL("../../tiledata/forest-villages/diverse/catalog.json", import.meta.url)));
const roots = new Set([1430, 1431, 1432, 1433, 1461, 1462, 1463]), trunks = new Set([1422, 1423, 1424, 1425, 1350, 1426, 1427, 1428, 1429, 1453, 1454, 1455, 1457, 1458, 1459]);
async function validateVillageStudy(project, mapId) {
  const expected = catalog.maps[mapId], plan = catalog.plans.find((s) => s.id === mapId), m = project.maps?.[mapId];
  if (!expected || !m || m.width !== expected.width || m.height !== expected.height) return { valid: false, totalErrors: 1, errors: [{ code: "reference-dimensions", mapId }] };
  const t = project.tilesets?.[m.tilesetId], ref = catalog.tileset;
  if (!t || t.image.type !== "bundled" || t.image.id !== ref.image.id || t.tilesPerRow !== 30 || t.tileSize !== 16) return { valid: false, totalErrors: 1, errors: [{ code: "reference-tileset", mapId }] };
  const errors = [];
  let totalErrors = 0;
  const add = (code, x, y, extra = {}) => {
    totalErrors++;
    if (errors.length < 128) errors.push({ code, x, y, ...extra });
  };
  const size = m.width * m.height;
  if (m.lowerTiles?.length !== size || m.upperTiles?.length !== size) return { valid: false, totalErrors: 1, errors: [{ code: "array-length", mapId }] };
  const graft = (t2, id) => t2.tileGrafts?.find((g) => g.targetTile === id) ?? null;
  for (let i = 0; i < size; i++) for (const layer of ["lower", "upper"]) {
    const want = expected[layer + "Tiles"][i], actual = m[layer + "Tiles"][i], x = i % m.width, y = Math.floor(i / m.width);
    if (want >= 0 && (want >= t.count || !isDeepStrictEqual(graft(t, want), graft(ref, want)))) add("source-binding", x, y, { layer, tile: want });
    if (actual !== want) {
      const other = m[(layer === "lower" ? "upper" : "lower") + "Tiles"][i];
      add(want >= 0 && other === want ? "wrong-layer" : layer === "lower" && roots.has(want) ? "cut-root" : layer === "lower" && trunks.has(want) ? "missing-trunk" : layer === "upper" && want >= 2550 && want <= 2596 ? "wrong-edge-direction" : "tile-mismatch", x, y, { layer, expected: want, actual });
    }
    if (m[layer + "TileStacks"]?.[i]?.length) add("unexpected-stack", x, y, { layer });
  }
  await withTsModule("src/project/lint/reachability.ts", "study-reach.mjs", (api) => {
    const seen = api.computeReachableCells(project, m, plan.start.x, plan.start.y);
    for (const a of plan.access) if (!seen.has(a.x + "," + a.y)) add("blocked-entrance", a.x, a.y, { role: a.role });
    for (const o of plan.placements.filter((o2) => o2.kind === "prop")) if (!Array.from({ length: o.w * o.h }, (_, i) => [o.x + i % o.w, o.y + Math.floor(i / o.w)]).some(([x, y]) => api.isAdjacentOrOn(seen, x, y))) add("inaccessible-object", o.x, o.y, { name: o.name });
  });
  return { valid: totalErrors === 0, mapId, totalErrors, errors, truncated: totalErrors > errors.length, scope: "Frozen reference arrays, source grafts, engine tile reachability. No event execution or aesthetic scoring." };
}
function studyFaults() {
  const id = "terrace-cliff-village", m = catalog.maps[id], plan = catalog.plans.find((p) => p.id === id);
  const find = (tile, layer) => {
    const i = m[layer + "Tiles"].findIndex((n, i2) => n === tile && i2 > m.width * 5 && i2 % m.width > 3 && i2 % m.width < m.width - 4);
    if (i < 0) throw Error("Missing fault target " + tile);
    return { mapId: id, x: i % m.width, y: Math.floor(i / m.width), layer, tile };
  };
  const front = plan.houses[0].front;
  return [{ code: "cut-root", ...find(1430, "lower"), replacement: 240 }, { code: "missing-trunk", ...find(1426, "lower"), replacement: 240 }, { code: "wrong-edge-direction", ...find(2577, "upper"), replacement: 2589 }, { code: "wrong-layer", ...find(2639, "upper"), replacement: -1, move: true }, { code: "blocked-entrance", mapId: id, ...front, layer: "upper", tile: m.upperTiles[front.y * m.width + front.x], replacement: 237 }];
}
function applyStudyFault(project, f) {
  const m = project.maps[f.mapId], i = f.y * m.width + f.x;
  m[f.layer + "Tiles"][i] = f.replacement;
  if (f.move) m[(f.layer === "upper" ? "lower" : "upper") + "Tiles"][i] = f.tile;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, mapId] = process.argv.slice(2);
  if (!input || !mapId) throw Error("Usage: validate-diverse-villages.mjs project.json mapId");
  const result = await validateVillageStudy(JSON.parse(fs.readFileSync(input)), mapId);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
export {
  applyStudyFault,
  catalog,
  studyFaults,
  validateVillageStudy
};
