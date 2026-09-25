import { inspectCivicProps } from "./lib/village-civic-props.mjs";
import { inspectHouseholdProps } from "./lib/village-household-props.mjs";
import { inspectVillageCliffs } from "./lib/village-cliffs.mjs";
import fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { STAIR_LEFT } from "./lib/cliff-stairs.mjs";
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
      add(want >= 0 && other === want ? "wrong-layer" : layer === "lower" && roots.has(want) ? "cut-root" : layer === "lower" && trunks.has(want) ? "missing-trunk" : layer === "upper" && want >= 2550 && want <= 2607 ? "wrong-edge-direction" : "tile-mismatch", x, y, { layer, expected: want, actual });
    }
    if (m[layer + "TileStacks"]?.[i]?.length) add("unexpected-stack", x, y, { layer });
  }
  // One window kind per house (84 stained glass is for the church only; 88 broken marks an abandoned house).
  for (const h of plan.houses) if (h.window) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) {
    const tile = m.upperTiles[y * m.width + x];
    if ([84, 85, 86, 87, 88].includes(tile) && tile !== h.window) add("mixed-windows", x, y, { house: h.id, expected: h.window, actual: tile });
  }
  for(const e of inspectCivicProps(m,plan)) add(e.code,e.x,e.y);
  for(const e of inspectHouseholdProps(m,plan)) add(e.code,e.x,e.y);
  for (const { code, x, y, ...extra } of inspectVillageCliffs(m, plan, catalog.cliffBindings)) add(code, x, y, extra);
  for (const j of plan.grassJoins) {
    const actual=m.lowerTiles[j.y*m.width+j.x];
    if(actual!==j.tile) add([504,505,559].includes(actual)?'grass-color-mismatch':'grass-edge-direction',j.x,j.y,{expected:j.tile,actual});
    if(t.tileMeta[j.tile]?.layerBacking!==240) add('grass-backing',j.x,j.y,{expected:240,actual:t.tileMeta[j.tile]?.layerBacking});
  }
  const crest=plan.crest;
  for(let dx=0;dx<(crest?.width??0);dx++) {
    const end=crest.width-1-dx,x=crest.x+dx,y=crest.y+Math.max(0,crest.shoulder-Math.min(dx,end));
    const source=dx<=crest.shoulder?504:end<=crest.shoulder?505:559;
    if(m.lowerTiles[y*m.width+x]!==catalog.grassBindings[source]) add('grass-crest-gap',x,y,{sourceTile:source});
  }
  if(plan.entrance.x!==0 && plan.entrance.y!==m.height-1) add('entrance-not-on-boundary',plan.entrance.x,plan.entrance.y);
  await withTsModule("src/project/lint/reachability.ts", "study-reach.mjs", (api) => {
    const seen = api.computeReachableCells(project, m, plan.start.x, plan.start.y);
    for(const a of plan.access.filter(a=>a.role==='map-entrance')) if(!seen.has(a.x+','+a.y)) add('map-entrance-blocked',a.x,a.y);
    for (const a of plan.access) if (!seen.has(a.x + "," + a.y)) add(a.landmarkId ? "landmark-sealed" : "blocked-entrance", a.x, a.y, { role: a.role, ...a.landmarkId ? { landmark: a.landmarkId } : {} });
    for(const o of plan.placements.filter(o=>o.kind==='civic-prop'&&o.useAt))if(!seen.has(o.useAt.x+','+o.useAt.y))add('civic-use-blocked',o.useAt.x,o.useAt.y,{name:o.name});
    // Height: with every stair shut, no terrace cell above a cliff may be reachable. Reported at the open cliff end.
    const shut = structuredClone(m), W = m.width, face = catalog.cliffBindings[172];
    for (const [x, y, h] of plan.stairs) for (let yy = y; yy <= y + h; yy++) for (let xx = x; xx < x + 2; xx++) shut.lowerTiles[yy * W + xx] = face;
    const below = api.computeReachableCells({ ...project, maps: { ...project.maps, [m.id]: shut } }, shut, plan.start.x, plan.start.y);
    for (const c of plan.cliffs) {
      const [x0] = c.points[0], [x1] = c.points.at(-1);
      const tops = new Map(plan.cliffColumns.filter((k) => k.x >= x0 && k.x <= x1).map((k) => [k.x, k.y]));
      const leak = [...below].map((k) => k.split(",").map(Number)).find(([x, y]) => tops.has(x) && y >= (c.north ?? 5) && y < tops.get(x));
      if (leak) {
        const [ex, ey] = Math.abs(leak[0] - x0) <= Math.abs(leak[0] - x1) ? c.points[0] : c.points.at(-1);
        add("terrace-without-stairs", ex, ey, { reached: { x: leak[0], y: leak[1] } });
      }
    }
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
  return [{ code: "cut-root", ...find(1430, "lower"), replacement: 240 }, { code: "missing-trunk", ...find(1426, "lower"), replacement: 240 }, { code: "wrong-edge-direction", ...find(2577, "upper"), replacement: 2589 }, { code: "wrong-layer", ...find(plan.placements.find(o=>o.kind==="prop").upper[0], "upper"), replacement: -1, move: true }, { code: "blocked-entrance", mapId: id, ...front, layer: "upper", tile: m.upperTiles[front.y * m.width + front.x], replacement: 237 }];
}
function cliffFaults() {
  const mapId = "terrace-cliff-village", m = catalog.maps[mapId], p = catalog.plans.find((p2) => p2.id === mapId), b = catalog.cliffBindings;
  // The easternmost right-hand column and a front column near x=40 (compaction moves them).
  const side = p.cliffColumns.filter((c) => c.side === "right").sort((a, b2) => b2.x - a.x)[0];
  const onStair = (c) => p.stairs.some(([sx]) => c.x >= sx && c.x < sx + 2);
  const flat = p.cliffColumns.filter((c) => c.side === "front" && !onStair(c)).sort((a, b2) => Math.abs(a.x - 40) - Math.abs(b2.x - 40))[0];
  const [x, y, h] = p.stairs[1];
  return [
    { code: "cliff-face-direction", mapId, x: side.x, y: side.y + 2, layer: "upper", tile: b[232], replacement: b[231] },
    { code: "cliff-toe-gap", mapId, x: flat.x, y: flat.y + flat.height, layer: "upper", tile: b[202], replacement: -1 },
    { code: "cliff-stair-gap", mapId, x, y: y + h, layer: "lower", tile: STAIR_LEFT, replacement: 240 },
    // Clearing the forest that closes the west end of pine-hamlets' cliff lets you walk round it onto the terrace.
    (() => { const q = catalog.plans.find((p2) => p2.id === "pine-hamlets"), [ex, ey] = q.cliffs[0].points[0];
      // Clamped to the map (the compacted village keeps only two forest columns west of the cliff).
      const x0 = Math.max(0, ex - 4), wing = ex - x0;
      return { code: "terrace-without-stairs", mapId: q.id, x: x0, y: ey - 3, layer: "lower", tile: catalog.maps[q.id].lowerTiles[(ey - 3) * q.width + x0], replacement: 240, rects: [{ x: x0, y: ey - 3, w: wing + 5, h: 3 }, { x: x0, y: ey, w: wing, h: q.cliffs[0].height + 1 }, { x: x0, y: ey + q.cliffs[0].height + 1, w: wing + 8, h: 2 }], errorX: ex, errorY: ey }; })(),
    // A waterfall column painted back to grass mid-face.
    (() => { const q = catalog.plans.find((p2) => p2.id === "twin-falls-river-village"), f = q.falls[0];
      return { code: "waterfall-gap", mapId: q.id, x: f.x, y: f.y + 3, layer: "lower", tile: f.tile, replacement: 240 }; })()
  ];
}
function applyStudyFault(project, f) {
  const m = project.maps[f.mapId], i = f.y * m.width + f.x;
  if (f.rects) {
    for (const r of f.rects) for (let dy = 0; dy < r.h; dy++) for (let dx = 0; dx < r.w; dx++) {
      const j = (r.y + dy) * m.width + r.x + dx;
      m.lowerTiles[j] = 240;
      m.upperTiles[j] = -1;
    }
    return;
  }
  m[f.layer + "Tiles"][i] = f.replacement;
  if (f.move) m[(f.layer === "upper" ? "lower" : "upper") + "Tiles"][i] = f.tile;
}
function grassFaults() {
  const mapId='terrace-cliff-village', j=catalog.plans.find(p=>p.id===mapId).grassJoins.find(j=>j.sourceTile===504);
  const entrance={code:'map-entrance-blocked',mapId,...catalog.plans.find(p=>p.id===mapId).entrance,layer:'upper',tile:-1,replacement:237};
  // Revision 14 removed the grass crest (it read as half-laid tiles), so only the entrance check has a target.
  if(!j)return [entrance];
  return [
    {code:'grass-edge-direction',mapId,x:j.x,y:j.y,layer:'lower',tile:j.tile,replacement:catalog.grassBindings[505]},
    {code:'grass-color-mismatch',mapId,x:j.x,y:j.y,layer:'lower',tile:j.tile,replacement:504},
    {code:'grass-crest-gap',mapId,...(()=>{const q=catalog.plans.find(p=>p.id===mapId).grassJoins.find(j=>j.sourceTile===559);return{x:q.x,y:q.y,layer:'lower',tile:q.tile,replacement:240}})()},
    {code:'map-entrance-blocked',mapId,...catalog.plans.find(p=>p.id===mapId).entrance,layer:'upper',tile:-1,replacement:237}
  ];
}
function householdFaults() {
 const mapId='terrace-cliff-village',p=catalog.plans.find(p=>p.id===mapId),m=catalog.maps[mapId];
 const bed=p.placements.find(o=>o.name==='채소밭'),scare=p.placements.find(o=>o.name==='허수아비'&&o.ownerId===bed.ownerId);
 const barrel=p.placements.find(o=>o.name==='나무통');
 const wood=p.placements.find(o=>o.name==='장작'),table=p.placements.find(o=>o.ownerId===wood.ownerId&&o.name==='가로 탁자');
 const i=m.upperTiles.findIndex((t,i)=>t===-1&&m.lowerTiles[i]===240&&i%m.width>20&&i%m.width<60&&Math.floor(i/m.width)>30&&Math.floor(i/m.width)<65&&!p.houses.some(h=>Math.abs(h.x-i%m.width)<10&&Math.abs(h.y-Math.floor(i/m.width))<10)&&!p.roadCells.includes(i));
 if(i<0)throw Error('No unowned-prop fault target');
 return [{code:'unowned-prop',mapId,x:i%m.width,y:Math.floor(i/m.width),layer:'upper',tile:-1,replacement:barrel.upper[0]},
 {code:'scarecrow-without-garden',mapId,x:bed.x,y:bed.y,layer:'upper',tile:bed.upper[0],replacement:-1,errorX:scare.x,errorY:scare.y},
 {code:'prop-purpose-anchor-missing',mapId,x:table.x,y:table.y,layer:'upper',tile:table.upper[0],replacement:-1,errorX:wood.x,errorY:wood.y}];
}
function civicFaults() {
 const mapId='reed-bay-village',plan=catalog.plans.find(p=>p.id===mapId),m=catalog.maps[mapId];
 const well=plan.placements.find(o=>o.kind==='civic-prop'&&o.name==='낮은 돌 우물');
 const jar=plan.placements.find(o=>o.kind==='civic-prop'&&o.placeId===well.placeId&&o.name==='항아리');
 const lamp=plan.placements.find(o=>o.kind==='civic-prop'&&o.name==='벽걸이 등불');
 return [
  {code:'civic-anchor-missing',mapId,x:well.x,y:well.y,layer:'upper',tile:well.upper[0],replacement:-1,errorX:jar.x,errorY:jar.y},
  {code:'civic-use-blocked',mapId,...well.useAt,layer:'upper',tile:m.upperTiles[well.useAt.y*m.width+well.useAt.x],replacement:237},
  {code:'wall-light-backing',mapId,x:lamp.x,y:lamp.y,layer:'lower',tile:m.lowerTiles[lamp.y*m.width+lamp.x],replacement:240}
 ];
}
function landmarkFaults() {
 const castle=catalog.plans.find(p=>p.id==='ford-castle-town'),cm=catalog.maps[castle.id];
 const h=castle.houses.find(h=>h.window===87),i=Array.from({length:h.w*h.h},(_,k)=>(h.y+Math.floor(k/h.w))*cm.width+h.x+k%h.w).find(i=>cm.upperTiles[i]===87);
 const chapel=catalog.plans.find(p=>p.id==='chapel-hill-parish'),yard=chapel.landmarks.find(l=>l.kind==='graveyard');
 return [
  {code:'mixed-windows',mapId:castle.id,x:i%cm.width,y:Math.floor(i/cm.width),layer:'upper',tile:87,replacement:85},
  {code:'landmark-sealed',mapId:chapel.id,x:yard.gate.x,y:yard.gate.y,layer:'upper',tile:-1,replacement:439,errorX:yard.gate.x,errorY:yard.gate.y-1}
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
  civicFaults,
  landmarkFaults,
  applyStudyFault,
  catalog,
  cliffFaults,
  grassFaults,
  householdFaults,
  studyFaults,
  validateVillageStudy
};
