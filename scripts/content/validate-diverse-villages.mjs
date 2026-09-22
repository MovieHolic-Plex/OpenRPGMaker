import { inspectVillageCliffs } from "./lib/village-cliffs.mjs";
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
  for (const { code, x, y, ...extra } of inspectVillageCliffs(m, plan, catalog.cliffBindings)) add(code, x, y, extra);
  for (const j of plan.grassJoins) {
    const actual=m.lowerTiles[j.y*m.width+j.x];
    if(actual!==j.tile) add([504,505,559].includes(actual)?'grass-color-mismatch':'grass-edge-direction',j.x,j.y,{expected:j.tile,actual});
    if(t.tileMeta[j.tile]?.layerBacking!==240) add('grass-backing',j.x,j.y,{expected:240,actual:t.tileMeta[j.tile]?.layerBacking});
  }
  const crest=plan.crest;
  for(let dx=0;dx<crest.width;dx++) {
    const end=crest.width-1-dx,x=crest.x+dx,y=crest.y+Math.max(0,crest.shoulder-Math.min(dx,end));
    const source=dx<=crest.shoulder?504:end<=crest.shoulder?505:559;
    if(m.lowerTiles[y*m.width+x]!==catalog.grassBindings[source]) add('grass-crest-gap',x,y,{sourceTile:source});
  }
  if(plan.entrance.x!==0 && plan.entrance.y!==m.height-1) add('entrance-not-on-boundary',plan.entrance.x,plan.entrance.y);
  await withTsModule("src/project/lint/reachability.ts", "study-reach.mjs", (api) => {
    const seen = api.computeReachableCells(project, m, plan.start.x, plan.start.y);
    for(const a of plan.access.filter(a=>a.role==='map-entrance')) if(!seen.has(a.x+','+a.y)) add('map-entrance-blocked',a.x,a.y);
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
function cliffFaults() {
  const mapId = "terrace-cliff-village", m = catalog.maps[mapId], p = catalog.plans.find((p2) => p2.id === mapId), b = catalog.cliffBindings;
  const side = p.cliffColumns.find((c) => c.side === "right" && c.x > 60);
  const flat = p.cliffColumns.find((c) => c.side === "front" && c.x === 40);
  const [x, y, h] = p.stairs[1];
  return [
    { code: "cliff-face-direction", mapId, x: side.x, y: side.y + 2, layer: "upper", tile: b[232], replacement: b[231] },
    { code: "cliff-toe-gap", mapId, x: flat.x, y: flat.y + flat.height, layer: "upper", tile: b[202], replacement: -1 },
    { code: "cliff-stair-gap", mapId, x, y: y + h, layer: "lower", tile: b[374], replacement: 240 }
  ];
}
function applyStudyFault(project, f) {
  const m = project.maps[f.mapId], i = f.y * m.width + f.x;
  m[f.layer + "Tiles"][i] = f.replacement;
  if (f.move) m[(f.layer === "upper" ? "lower" : "upper") + "Tiles"][i] = f.tile;
}
function grassFaults() {
  const mapId='terrace-cliff-village', j=catalog.plans.find(p=>p.id===mapId).grassJoins.find(j=>j.sourceTile===504);
  return [
    {code:'grass-edge-direction',mapId,x:j.x,y:j.y,layer:'lower',tile:j.tile,replacement:catalog.grassBindings[505]},
    {code:'grass-color-mismatch',mapId,x:j.x,y:j.y,layer:'lower',tile:j.tile,replacement:504},
    {code:'grass-crest-gap',mapId,...(()=>{const q=catalog.plans.find(p=>p.id===mapId).grassJoins.find(j=>j.sourceTile===559);return{x:q.x,y:q.y,layer:'lower',tile:q.tile,replacement:240}})()},
    {code:'map-entrance-blocked',mapId,...catalog.plans.find(p=>p.id===mapId).entrance,layer:'upper',tile:-1,replacement:237}
  ];
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
  cliffFaults,
  grassFaults,
  studyFaults,
  validateVillageStudy
};
