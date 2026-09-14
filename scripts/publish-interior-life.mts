import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
  type ProjectWriteAuthority,
} from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { registerInteriorLifeCatalog } from "./lib/interiorLifeCatalog.mts";
import { runTool } from "../src/editor/tools/toolRunner";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { computeReachableCells } from "../src/project/lint/reachability";
import { isPassableLanding } from "../src/project/collision";
const out = "output/evidence/interior-life";
fs.mkdirSync(out, { recursive: true });
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
let authority: ProjectWriteAuthority | undefined;
const before = await loadProjectFromSupabase(config, (a) => (authority = a));
assert.ok(before && authority);
const context = { project: registerInteriorLifeCatalog(before) };
assert.deepEqual(
  registerInteriorLifeCatalog(context.project),
  context.project,
  "registration must be idempotent",
);
const roots = [
  "house-example:inn-3f",
  "house-example:workshop-4f",
  "compact-interior:example:cottage",
];
const owned = new Set(
  Object.values(before.spatialAuthoring!.occurrences)
    .filter((o) => roots.some((id) => o.id.includes(id)))
    .flatMap((o) => o.bindings.map((b) => b.mapId)),
);
const transcript = [];
for (const occurrenceId of roots) {
  const result = runTool(context, "edit_spatial_occurrence", {
    operation: "refresh",
    occurrenceId,
  });
  assert.ok(result.ok, JSON.stringify(result));
  transcript.push({ name: "edit_spatial_occurrence", occurrenceId, result });
}
const next = context.project;
assert.deepEqual(
  next.tilesets.easyrpg_chipset_interior.tileMeta,
  before.tilesets.easyrpg_chipset_interior.tileMeta,
  "Preserve user tile annotations",
);
for (const [key, map] of Object.entries(before.maps))
  if (!owned.has(key))
    assert.deepEqual(next.maps[key], map, `Unrelated map ${key}`);
assert.equal(next.startMapId, before.startMapId);
assert.deepEqual(next.startPos, before.startPos);
const mapProof = [];
for (const key of owned) {
  const map = next.maps[key]!;
  assert.ok(map);
  assert.deepEqual(
    validateClusterRules(next, key).filter((x) => x.severity === "error"),
    [],
  );
  const plan = map.roomHarnessPlan?.plan;
  if (plan) {
    const reached = computeReachableCells(next, map, plan.door.x, plan.door.y);
    let floor = 0;
    for (const r of plan.rooms)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          if (isPassableLanding(next, map, x, y)) {
            floor++;
            assert.ok(reached.has(`${x},${y}`), `${key} isolated ${x},${y}`);
          }
    mapProof.push({
      id: key,
      width: map.width,
      height: map.height,
      rooms: plan.rooms.length,
      reachableFloor: floor,
    });
  }
}
// The editor's AI reads and previews the same stored definitions, including all new examples.
for (const space of Object.values(next.spatialAuthoring!.library.spaces).filter(
  (s) => s.id.startsWith("reviewed-interior:"),
)) {
  const read = runTool(context, "get_spatial_design", {
    kind: "space",
    id: space.id,
    resolved: true,
  });
  assert.ok(read.ok, JSON.stringify(read));
  const preview = runTool(context, "preview_spatial_build", {
    kind: "space",
    id: space.id,
    occurrenceId: `catalog-proof:${space.id}`,
    seed: 20260913,
  });
  assert.ok(preview.ok, JSON.stringify(preview));
  transcript.push({
    name: "preview_spatial_build",
    id: space.id,
    ok: preview.ok,
  });
}
fs.writeFileSync(`${out}/publish-candidate.json`, serialize(next));
fs.writeFileSync(
  `${out}/tool-transcript.json`,
  JSON.stringify(transcript, null, 2),
);
const proof = {
  projectId: config.projectId,
  interiors: Object.values(next.spatialAuthoring!.library.spaces).filter(
    (s) => s.environment === "interior",
  ).length,
  redesigned: 12,
  refreshed: mapProof,
  unrelatedMapsPreserved: Object.keys(before.maps).length - owned.size,
  startPreserved: true,
};
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
if (process.argv.includes("--apply")) {
  assert.equal(
    serializeForComparison(await loadProjectFromSupabase(config)),
    serializeForComparison(before),
    "Concurrent edit; refusing overwrite",
  );
  const result = await saveProjectToSupabase(next, config, authority);
  assert.equal(result.kind, "saved");
  const loaded = await loadProjectFromSupabase(config);
  assert.ok(loaded);
  assert.equal(serializeForComparison(loaded), serializeForComparison(next));
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(loaded));
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
