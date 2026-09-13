import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
  type ProjectWriteAuthority,
} from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import {
  registerSpecialInteriors,
  SPECIAL_PLACES,
  SPECIAL_ROOTS,
} from "./lib/specialInteriorCatalog.mts";
import { runTool } from "../src/editor/tools/toolRunner";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { isPassableLanding } from "../src/project/collision";
import { computeReachableCells } from "../src/project/lint/reachability";
const out = "output/evidence/special-interiors";
fs.mkdirSync(out, { recursive: true });
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, (a) => (authority = a));
assert.ok(before && authority);
const context = { project: registerSpecialInteriors(before) };
assert.deepEqual(
  registerSpecialInteriors(context.project),
  context.project,
  "Idempotent authoring",
);
fs.writeFileSync(`${out}/candidate.json`, serialize(context.project));
const refresh = [
  "house-example:inn-3f",
  "house-example:workshop-4f",
  "compact-interior:example:cottage",
];
const roots = [...refresh, ...SPECIAL_ROOTS];
const ownedBefore = new Set(
  Object.values(before.spatialAuthoring!.occurrences)
    .filter((o) => roots.some((r) => o.id.includes(r)))
    .flatMap((o) => o.bindings.map((b) => b.mapId)),
);
const transcript = [];
for (const root of refresh) {
  const r = runTool(context, "edit_spatial_occurrence", {
    operation: "refresh",
    occurrenceId: root,
  });
  assert.ok(r.ok, JSON.stringify(r));
}
for (const [i, root] of SPECIAL_ROOTS.entries()) {
  const read = runTool(context, "get_spatial_design", {
    kind: "place",
    id: SPECIAL_PLACES[i],
    resolved: true,
  });
  assert.ok(read.ok, JSON.stringify(read));
  if (context.project.spatialAuthoring!.occurrences[root]) {
    const r = runTool(context, "edit_spatial_occurrence", {
      operation: "refresh",
      occurrenceId: root,
    });
    assert.ok(r.ok, JSON.stringify(r));
  } else {
    const preview = runTool(context, "preview_spatial_build", {
      kind: "place",
      id: SPECIAL_PLACES[i],
      occurrenceId: root,
      seed: 20260914,
    });
    assert.ok(preview.ok, JSON.stringify(preview));
    const applied = runTool(context, "apply_spatial_build", {
      previewId: (preview.data as any).previewId,
    });
    assert.ok(applied.ok, JSON.stringify(applied));
  }
  transcript.push({ placeId: SPECIAL_PLACES[i], root, read: read.ok });
}
const next = context.project;
assert.deepEqual(
  next.tilesets.easyrpg_chipset_interior.tileMeta,
  before.tilesets.easyrpg_chipset_interior.tileMeta,
);
for (const [key, map] of Object.entries(before.maps))
  if (!ownedBefore.has(key))
    assert.deepEqual(next.maps[key], map, `Unrelated ${key}`);
assert.equal(next.startMapId, before.startMapId);
assert.deepEqual(next.startPos, before.startPos);
const maps = Object.values(next.maps).filter(
  (m) => !before.maps[m.id] || ownedBefore.has(m.id),
);
for (const map of maps) {
  assert.deepEqual(
    validateClusterRules(next, map.id).filter((i) => i.severity === "error"),
    [],
    map.id,
  );
  const plan = map.roomHarnessPlan?.plan;
  if (!plan) continue;
  const reach = computeReachableCells(next, map, plan.door.x, plan.door.y);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (isPassableLanding(next, map, x, y))
        assert.ok(reach.has(`${x},${y}`), `${map.id}: isolated ${x},${y}`);
}
const specialMaps = maps.filter((m) =>
  SPECIAL_ROOTS.some((root) => m.id.includes(root)),
);
const proof = {
  projectId: config.projectId,
  places: SPECIAL_PLACES,
  roots: SPECIAL_ROOTS,
  specialMaps: specialMaps.map((m) => ({
    id: m.id,
    name: m.name,
    width: m.width,
    height: m.height,
    rooms: m.roomHarnessPlan?.plan.rooms.length,
  })),
  refreshedHouseMaps: maps.filter(
    (m) =>
      m.roomHarnessPlan && !SPECIAL_ROOTS.some((root) => m.id.includes(root)),
  ).length,
  unrelatedMapsPreserved: Object.keys(before.maps).filter(
    (k) => !ownedBefore.has(k),
  ).length,
  tileMetadataPreserved: true,
};
fs.writeFileSync(`${out}/publish-candidate.json`, serialize(next));
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2));
fs.writeFileSync(`${out}/tool-proof.json`, JSON.stringify(transcript, null, 2));
console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  assert.equal(
    serializeForComparison(await loadProjectFromSupabase(config)),
    serializeForComparison(before),
    "Concurrent edit; abort",
  );
  const result = await saveProjectToSupabase(next, config, authority);
  assert.equal(result.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config);
  assert.ok(reloaded);
  assert.equal(serializeForComparison(reloaded), serializeForComparison(next));
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(
    `${out}/supabase-proof.json`,
    JSON.stringify(
      { ...proof, saved: true, reloaded: true, sha256: result.sha256 },
      null,
      2,
    ),
  );
  console.log("Saved and reloaded");
}
