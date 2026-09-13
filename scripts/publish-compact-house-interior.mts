import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
  type ProjectWriteAuthority,
} from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { isPassableLanding } from "../src/project/collision";
import { computeReachableCells } from "../src/project/lint/reachability";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { runTool } from "../src/editor/tools/toolRunner";
import {
  registerCompactHouseInterior,
  COMPACT_INTERIOR_PLACE,
  COMPACT_INTERIOR_OCCURRENCE,
} from "./lib/compactHouseInterior.mts";
const out = "output/evidence/compact-interior";
fs.mkdirSync(out, { recursive: true });
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, (a) => (authority = a));
assert.ok(before && authority);
fs.writeFileSync(`${out}/before.json`, serialize(before));
const context = { project: registerCompactHouseInterior(before) };
assert.deepEqual(
  registerCompactHouseInterior(context.project),
  context.project,
);
const transcript = [];
const existing =
  context.project.spatialAuthoring!.occurrences[COMPACT_INTERIOR_OCCURRENCE];
if (existing) {
  const result = runTool(context, "edit_spatial_occurrence", {
    operation: "refresh",
    occurrenceId: COMPACT_INTERIOR_OCCURRENCE,
  });
  assert.ok(result.ok, JSON.stringify(result));
  transcript.push({ name: "edit_spatial_occurrence", result });
} else {
  for (const [name, args] of [
    [
      "get_spatial_design",
      { kind: "place", id: COMPACT_INTERIOR_PLACE, resolved: true },
    ],
    [
      "preview_spatial_build",
      {
        kind: "place",
        id: COMPACT_INTERIOR_PLACE,
        occurrenceId: COMPACT_INTERIOR_OCCURRENCE,
        seed: 20260913,
      },
    ],
  ] as const) {
    const result = runTool(context, name, args);
    assert.ok(result.ok, JSON.stringify(result));
    transcript.push({ name, args, result });
    if (name === "preview_spatial_build") {
      const applied = runTool(context, "apply_spatial_build", {
        previewId: (result.data as { previewId: string }).previewId,
      });
      assert.ok(applied.ok, JSON.stringify(applied));
      transcript.push({ name: "apply_spatial_build", result: applied });
    }
  }
}
const next = context.project;
const owned = new Set(
  Object.values(before.spatialAuthoring!.occurrences)
    .filter((o) => o.id.includes(COMPACT_INTERIOR_OCCURRENCE))
    .flatMap((o) => o.bindings.map((b) => b.mapId)),
);
for (const [id, map] of Object.entries(before.maps))
  if (!owned.has(id)) assert.deepEqual(next.maps[id], map);
assert.equal(next.startMapId, before.startMapId);
assert.deepEqual(next.startPos, before.startPos);
const maps = Object.keys(next.maps).filter(
  (id) => !before.maps[id] || owned.has(id),
);
assert.equal(maps.length, 2);
fs.writeFileSync(`${out}/candidate-project.json`, serialize(next));
for (const mapId of maps) {
  assert.deepEqual(
    validateClusterRules(next, mapId).filter((i) => i.severity === "error"),
    [],
  );
  const map = next.maps[mapId]!,
    plan = map.roomHarnessPlan?.plan;
  if (plan) {
    const reached = computeReachableCells(next, map, plan.door.x, plan.door.y);
    for (const room of plan.rooms)
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++)
          if (isPassableLanding(next, map, x, y))
            assert.ok(reached.has(`${x},${y}`), `Isolated floor ${x},${y}`);
  }
}
fs.writeFileSync(`${out}/preview-project.json`, serialize(next));
fs.writeFileSync(
  `${out}/tool-transcript.json`,
  JSON.stringify(transcript, null, 2),
);
const proof = {
  projectId: config.projectId,
  spaceId: "house-catalog:room:single",
  placeId: COMPACT_INTERIOR_PLACE,
  occurrenceId: COMPACT_INTERIOR_OCCURRENCE,
  referenceFloor: { w: 12, h: 10 },
  afterFloor: { w: 8, h: 6 },
  furniture: 8,
  structuralRooms: 2,
  bedroomDoorway: { x: 4, y: 3 },
  exampleMaps: maps,
  unrelatedMapsPreserved: true,
};
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  const result = await saveProjectToSupabase(next, config, authority);
  assert.equal(result.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config);
  assert.ok(reloaded);
  assert.equal(serializeForComparison(reloaded), serializeForComparison(next));
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(
    `${out}/supabase-proof.json`,
    JSON.stringify(
      { ...proof, saved: true, reloaded: true, canonicalSHA256: result.sha256 },
      null,
      2,
    ),
  );
  console.log("Saved and reloaded");
}
