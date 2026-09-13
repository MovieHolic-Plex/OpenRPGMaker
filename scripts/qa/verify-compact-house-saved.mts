import fs from "node:fs";
import assert from "node:assert/strict";
import { configFromEnv } from "../supabase-resource-root/supabaseRest.mjs";
import { loadProjectForPersistenceProof } from "../../src/project/supabaseProjectSync";
const out = "output/evidence/compact-interior",
  expected = JSON.parse(
    fs.readFileSync(`${out}/reloaded-project.json`, "utf8"),
  );
const saved = JSON.parse(fs.readFileSync(`${out}/supabase-proof.json`, "utf8"));
const config = await configFromEnv(),
  snapshot = await loadProjectForPersistenceProof(config);
assert.ok(snapshot);
const project = snapshot.project,
  room = "spatial:child:32:compact-interior:example:cottage7:floor-1:0",
  yard =
    "spatial-place:32:compact-interior:example:cottage:0:29:easyrpg_chipset_combined_town";
for (const id of [room, yard])
  assert.deepEqual(project.maps[id], expected.maps[id]);
for (const id of ["compact-interior:cabinet", "compact-interior:wall-stove"])
  assert.deepEqual(
    project.spatialAuthoring!.library.objects[id],
    expected.spatialAuthoring.library.objects[id],
  );
assert.deepEqual(
  project.spatialAuthoring!.library.spaces["house-catalog:room:single"],
  expected.spatialAuthoring.library.spaces["house-catalog:room:single"],
);
assert.deepEqual(
  project.spatialAuthoring!.library.places["house-catalog:place:cottage"],
  expected.spatialAuthoring.library.places["house-catalog:place:cottage"],
);
assert.deepEqual(
  project.tilesets.easyrpg_chipset_interior,
  expected.tilesets.easyrpg_chipset_interior,
);
const proof = {
  projectId: config.projectId,
  canonicalSHA256: snapshot.sha256,
  canonicalRevisionMatches: snapshot.sha256 === saved.canonicalSHA256,
  authoredMapsMatch: true,
  sourceDefinitionsMatch: true,
  maps: Object.keys(project.maps).length,
  roomMapId: room,
  checkedAt: new Date().toISOString(),
};
fs.writeFileSync(
  `${out}/final-remote-check.json`,
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
