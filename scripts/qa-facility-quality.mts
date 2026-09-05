// Test-only fixtures for checking the real assistant tool and exported player.
// Never writes a user's project or replaces their authored concept bundles.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createBlankProject } from "../src/project/defaults";
import { CONCEPT_FACILITY_TEMPLATES } from "../src/project/defaults/conceptFacilityTemplates";
import { layoutConceptFacility } from "../src/editor/conceptBundleResolve";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline";
import { runTool } from "../src/editor/tools/toolRunner";
import { renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

const phase = process.argv[2] ?? "after";
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error("Expected a phase name");
const out = path.resolve("output/evidence/facility-quality", phase);
mkdirSync(out, { recursive: true });
const records = [];
for (const bundle of CONCEPT_FACILITY_TEMPLATES) {
  const facility = bundle.facilities[0];
  if (!facility) throw new Error(`No facility in ${bundle.id}`);
  const context = { project: createBlankProject() };
  const mapId = `qa_facility_${bundle.id}`;
  const result = runTool(context, "place_concept", {
    query: facility.label, mapId, seed: 7,
  }, { dryRun: false });
  if (!result.ok) throw new Error(`${bundle.id}: ${result.summary}`);
  const project = context.project;
  const map = project.maps[mapId];
  const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
  if (!map || !tileset) throw new Error(`Missing generated map or tileset: ${bundle.id}`);
  const layout = layoutConceptFacility(bundle, facility);
  project.startMapId = mapId;
  project.startPos = { x: layout.door.x, y: layout.door.y - 1 };
  project.meta.title = `QA ${facility.label}`;
  writePng(renderInteriorMapPng(map, tileset, { scale: 3 }), path.join(out, `${bundle.id}.png`));
  writeFileSync(path.join(out, `${bundle.id}.json`), JSON.stringify(project));
  records.push({
    id: bundle.id, label: facility.label, mapId,
    width: map.width, height: map.height, start: project.startPos,
    rooms: layout.rooms, door: layout.door,
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
  });
}
writeFileSync(path.join(out, "manifest.json"), JSON.stringify(records, null, 2));
console.log(`FACILITIES ${records.length}: ${out}`);
