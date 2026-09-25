#!/usr/bin/env node
// tiledata/atlas-scenes/vehicles.json (build_vehicles.py) → src/assets/atlasVehiclesTileset.json: the bundled custom
// tileset `oprn_atlas_vehicles` (texture tex_oprn_atlas_vehicles = public/assets/atlas-scenes/vehicles.png).
// Every slot gets its passage (O walkable under walkers · X blocked · ★ walkable above walkers), its home layer and a
// Korean label; every piece becomes a tile group with a preview map (the palette shows whole ships, carts, tents …).
// Reference documents are added by prepare-atlas-scenes-references.mjs (kept when this runs again).
// Usage: node scripts/content/atlas-scenes/register-vehicles.mjs
import fs from "node:fs";

const SRC = "tiledata/atlas-scenes/vehicles.json";
const OUT = "src/assets/atlasVehiclesTileset.json";
const v = JSON.parse(fs.readFileSync(SRC, "utf8"));
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;

// Home layer of a slot = the layer the pieces use it on (lower wins when both).
const home = new Array(v.count).fill(null);
for (const p of Object.values(v.pieces)) {
  p.lower.forEach((t) => { if (t >= 0) home[t] = "lower"; });
  p.upper.forEach((t) => { if (t >= 0 && home[t] !== "lower") home[t] = "upper"; });
}
const open = { up: true, down: true, left: true, right: true }, shut = { up: false, down: false, left: false, right: false };
const passability = [], priority = [], terrain = [], tileMeta = [];
for (let i = 0; i < v.count; i++) {
  const slot = v.slots[i];
  if (!slot) { passability.push({ ...open }); priority.push("upper"); terrain.push(0); tileMeta.push({ label: "", description: "", source: "bundled-default" }); continue; }
  const layer = home[i] ?? "upper";
  passability.push(slot.pass === "X" ? { ...shut } : { ...open });
  // ★ = walkable + upper priority; O on the upper layer stays under walkers (priority lower).
  priority.push(slot.pass === "star" ? "upper" : slot.pass === "X" && layer === "upper" ? "upper" : "lower");
  terrain.push(0);
  tileMeta.push({ label: slot.name, description: "", source: "bundled-default", defaultLayer: layer,
    passage: slot.pass === "X" ? "solid" : slot.pass === "star" ? "star" : "passable", role: "prop" });
}
const tileGroups = Object.entries(v.pieces).map(([id, p]) => ({
  id: `atlas-vehicles:${id}`, name: p.label ?? id, role: p.kind === "floor" || p.kind === "sky" ? "terrain" : "prop",
  defaultLayer: p.lower.some((t) => t >= 0) && p.upper.some((t) => t >= 0) ? "mixed" : p.lower.some((t) => t >= 0) ? "lower" : "upper",
  tileIds: [...new Set([...p.lower, ...p.upper].filter((t) => t >= 0))],
  description: `${p.label ?? id} (${p.w}×${p.h}) — 통째로 찍는다. -1 칸은 맵의 물·땅을 그대로 둔다.`,
  placementRules: "조각 전체를 한 번에 찍는다(잘라 쓰지 않는다). 배는 물 위, 수레·마차는 길 위, 천막·관람석은 광장 가장자리에.",
  source: "bundled-default", layerHome: "perCell",
  previewMap: { width: p.w, height: p.h, lowerTiles: p.lower, upperTiles: p.upper },
}));
const def = {
  id: "oprn_atlas_vehicles", kind: "custom", name: "탈것·장면 조각 · 배·비공정·마차·축제·처형대 (EasyRPG 배 시트 + 손 도트)",
  count: v.count, image: { type: "bundled", id: "tex_oprn_atlas_vehicles" }, tileSize: v.tileSize, tilesPerRow: v.tilesPerRow,
  transparentColor: undefined, passability, priority, terrain, tileMeta, tileGroups, autotileGroups: [],
  referenceDocuments: old?.referenceDocuments ?? [],
};
delete def.transparentColor;
fs.writeFileSync(OUT, JSON.stringify(def) + "\n");
console.log(`${OUT}: ${v.count} slots, ${tileGroups.length} groups, ${def.referenceDocuments.length} reference categories kept`);
