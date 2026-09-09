/// <reference path="../test/pngjs.d.ts" />
/** Read the saved inn; produce inspection evidence without rewriting authored content. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync";
import { serialize } from "../src/project/io";
import { INTERIOR_OBJECT_CATALOG } from "../src/editor/interiorObjectCatalog";
import { resolveInteriorRoomVocab } from "../src/editor/interiorRoomVocab";
import { INTERIOR_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsInterior";
import { INTERIOR_HARNESS_GROUPS } from "../src/project/tilesetHarness/themePacks";
import { renderInteriorMapPng, writePng, INTERIOR_CHIPSET_PNG } from "./lib/renderInteriorMapPng.mts";
import type { InteriorObjectCell, InteriorObjectDef } from "../src/editor/interiorObjectCatalog";

const out = "output/evidence/inn-inspection-v5";
const config = { ...await configFromEnv(), projectId: "rpg-zzu-inn-exploration-v4" };
const project = await loadProjectFromSupabase(config);
assert.ok(project, "Saved inn must load");
const tileset = project.tilesets.easyrpg_chipset_interior;
assert.ok(tileset);
const bundle = tileset.scratchConceptBundles?.find(bundle => bundle.id === "inn");
assert.ok(bundle);
const vocab = resolveInteriorRoomVocab(tileset, INTERIOR_OBJECT_CATALOG, []);
const objects: readonly InteriorObjectDef[] = [...vocab.objectsById.values()];
const maps = ["map_inn_wander", "map_inn_wander_2f", "map_inn_wander_3f"].map(id => {
  const map = project.maps[id];
  assert.ok(map, id);
  return map;
});
const sheetBytes = fs.readFileSync(INTERIOR_CHIPSET_PNG);
const sheet = PNG.sync.read(sheetBytes);
assert.equal(sheet.width, 480);
assert.equal(sheet.height, 256);
fs.mkdirSync(`${out}/images`, { recursive: true });
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const projectJson = serialize(project);
fs.writeFileSync(`${out}/project.json`, projectJson);
const drawCells = (width: number, height: number, cells: readonly InteriorObjectCell[]) => {
  const png = new PNG({ width: width * 16, height: height * 16 });
  const pixels = png.data;
  assert.ok(pixels);
  for (const layer of ["lower", "upper"]) for (const cell of cells.filter(cell => cell.layer === layer)) {
    const sx = (cell.tile % 30) * 16;
    const sy = Math.floor(cell.tile / 30) * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const source = ((sy + y) * sheet.width + sx + x) * 4;
      const dest = ((cell.dy * 16 + y) * png.width + cell.dx * 16 + x) * 4;
      const alpha = (sheet.data[source + 3] ?? 0) / 255;
      const belowAlpha = (pixels[dest + 3] ?? 0) / 255;
      const combined = alpha + belowAlpha * (1 - alpha);
      for (let channel = 0; channel < 3; channel++) {
        pixels[dest + channel] = combined ? Math.round(((sheet.data[source + channel] ?? 0) * alpha + (pixels[dest + channel] ?? 0) * belowAlpha * (1 - alpha)) / combined) : 0;
      }
      pixels[dest + 3] = Math.round(combined * 255);
    }
  }
  return png;
};
const tileRows = Array.from({ length: tileset.count }, (_, id) => {
  const file = `images/tile-${id}.png`;
  writePng(drawCells(1, 1, [{ dx: 0, dy: 0, layer: "upper", tile: id }]), `${out}/${file}`);
  const meta = tileset.tileMeta?.[id];
  const rejected = [408, 409, 410].includes(id);
  const uncertain = rejected || id === 201 || meta?.source === "unknown" || !meta?.label;
  return { id, file, label: meta?.label || "미분류", role: meta?.role ?? "", passage: meta?.passage ?? "", layer: meta?.defaultLayer ?? "", tags: meta?.tags ?? [], status: uncertain ? "unconfirmed" : [176,209,239,474,475,235,141,111,171,402,403,404,432,433,434,462,463,464].includes(id) ? "user" : "defined", excluded: rejected };
});
const rendered = new Map(maps.map((map, index) => {
  const png = renderInteriorMapPng(map, tileset, { scale: 3 });
  writePng(png, `${out}/images/floor-${index + 1}.png`);
  return [map.id, png];
}));
const records = objects.map(object => {
  const assemblyFile = `images/assembly-${object.id}.png`;
  writePng(drawCells(object.width, object.height, object.cells), `${out}/${assemblyFile}`);
  const occurrences: { mapId: string; mapName: string; x: number; y: number }[] = [];
  for (const map of maps) {
    for (let y = 0; y <= map.height - object.height; y++) for (let x = 0; x <= map.width - object.width; x++) {
      const matches = object.cells.every(cell => {
        const layer = object.snap === "wall-any" ? "upper" : cell.layer;
        return (layer === "upper" ? map.upperTiles : map.lowerTiles)[(y + cell.dy) * map.width + x + cell.dx] === cell.tile;
      });
      if (matches) occurrences.push({ mapId: map.id, mapName: map.name, x, y });
    }
  }
  const occurrence = occurrences[0];
  let placementFile: string | null = null;
  if (occurrence) {
    const map = project.maps[occurrence.mapId];
    const full = rendered.get(occurrence.mapId);
    assert.ok(map && full);
    const x = Math.max(0, occurrence.x - 2) * 48;
    const y = Math.max(0, occurrence.y - 2) * 48;
    const width = Math.min(full.width - x, (object.width + 4) * 48);
    const height = Math.min(full.height - y, (object.height + 4) * 48);
    const crop = new PNG({ width, height });
    const targetPixels = crop.data;
    const sourcePixels = full.data;
    assert.ok(targetPixels && sourcePixels);
    for (let row = 0; row < height; row++) {
      const start = ((y + row) * full.width + x) * 4;
      targetPixels.set(sourcePixels.subarray(start, start + width * 4), row * width * 4);
    }
    placementFile = `images/placement-${object.id}.png`;
    writePng(crop, `${out}/${placementFile}`);
  }
  return {
    id: object.id, label: object.label, width: object.width, height: object.height, snap: object.snap,
    description: object.description ?? "",
    cells: object.cells, tiles: [...new Set(object.cells.map(cell => cell.tile))],
    assemblyFile, placementFile, occurrence: occurrence ?? null, matchCount: occurrences.length,
    authoredThings: bundle.things.filter(thing => thing.objectId === object.id).map(thing => ({ label: thing.label, places: thing.placeIds })),
    status: ["stairs_down", "flue", "kettle", "stairs_horizontal", "stone_hearth_unlit", "stone_hearth_lit"].includes(object.id) ? "user" : "defined",
  };
});
const exclusion = [201,408,409,410].map(tile => {
  const semantic = INTERIOR_TILE_SEMANTICS.some(entry => entry.index === tile);
  const grouped = INTERIOR_HARNESS_GROUPS.some(group => group.tileIds.includes(tile));
  const catalogUses = INTERIOR_OBJECT_CATALOG.filter(object => object.cells.some(cell => cell.tile === tile)).map(object => object.id);
  const savedUses = objects.filter(object => object.cells.some(cell => cell.tile === tile)).map(object => object.id);
  const mapUses = maps.flatMap(map => [...map.lowerTiles, ...map.upperTiles].filter(id => id === tile));
  assert.deepEqual(catalogUses, [], `Unknown tile ${tile} in code catalog`);
  assert.deepEqual(savedUses, [], `Unknown tile ${tile} in saved catalog`);
  assert.equal(mapUses.length, 0, `Unknown tile ${tile} in saved maps`);
  if (tile !== 201) {
    assert.equal(semantic, false);
    assert.equal(grouped, false);
  }
  return { tile, semantic, grouped, catalogUses, savedUses, mapUses: mapUses.length, autoPlacementExcluded: true };
});
const innEvents = maps.flatMap(map => map.events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]
  .flatMap(command => command.kind === "inn" ? [{ mapId: map.id, eventId: event.id, x: event.x, y: event.y, price: command.price, recoverMp: command.recoverMp }] : [])));
assert.equal(innEvents.length, 1);
const data = {
  projectId: config.projectId, title: project.meta.title, checkedAt: new Date().toISOString(),
  projectSha256: hash(projectJson), sheetSha256: hash(sheetBytes),
  remoteLoad: true, remoteWrite: false, tiles: tileRows, objects: records, exclusion, inn: innEvents[0],
  maps: maps.map((map,index) => ({ id: map.id, name: map.name, width: map.width, height: map.height, file: `images/floor-${index+1}.png` })),
  interpretation: "사용자 정정과 저장된 정의를 구분한다. 구조적 일치 검사는 그림의 의미를 새로 확정하는 육안 검수와 다르다.",
};
fs.writeFileSync(`${out}/audit.json`, JSON.stringify(data, null, 2));
console.log(JSON.stringify({ projectId: config.projectId, tiles: tileRows.length, objects: records.length, placed: records.filter(record => record.placementFile).length, exclusion, inn: innEvents[0], projectSha256: data.projectSha256 }));
