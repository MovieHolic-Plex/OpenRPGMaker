import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
const source = process.argv[2];
if (!source) throw Error("Usage: verify-diverse-village-distribution.mjs existing-project.json");
const category = "diverse-villages-civic-v7", out = "verify-shots/village-diversity", proof = {};
let blank;
await withTsModule("src/project/defaults/blankProject.ts", "fresh.mjs", (m) => blank = m.createBlankProject());
assert.equal(blank.tilesets.forest_harmony.referenceDocuments.filter((c) => c.id === category).length, 1);
assert.equal(blank.tilesets.forest_harmony_grass_joins.count,10);
assert.equal(blank.tilesets.forest_harmony_grass_joins.referenceSourceTilesetId,"forest_harmony");
proof.freshProject = true;
proof.sharedGrassTilesAndGuidance = true;
await withTsModule("src/project/defaults/defaultAssets.ts", "backfill.mjs", (m) => {
  const old = JSON.parse(fs.readFileSync(source));
  const t = old.tilesets.forest_harmony;
  t.referenceDocuments.push({ id: "author-kept", name: "내 문서", description: "보존", documents: [{ id: "custom", name: "custom", markdown: "고치지 말 것" }], images: [] });
  const before = structuredClone(t.referenceDocuments);
  m.ensureBundledTilesets(old);
  assert.equal(t.referenceDocuments.filter((c) => c.id === category).length, 1);
  for (const c of before) {
    if (["diverse-villages-v1","diverse-villages-cliff-v2","diverse-villages-grass-v3","diverse-villages-winding-v4","diverse-villages-households-v5","diverse-villages-purpose-v6"].includes(c.id)) assert(!t.referenceDocuments.some((a) => a.id === c.id));
    else assert.deepEqual(t.referenceDocuments.find((a) => a.id === c.id), c);
  }
  proof.shippedPreV7Replaced = before.some((c) => ["diverse-villages-v1","diverse-villages-cliff-v2","diverse-villages-grass-v3","diverse-villages-winding-v4","diverse-villages-households-v5","diverse-villages-purpose-v6"].includes(c.id));
  const once = JSON.stringify(old);
  m.ensureBundledTilesets(old);
  assert.equal(JSON.stringify(old), once);
  assert.equal(old.tilesets.forest_harmony_grass_joins.count,10);
  assert.equal(old.tilesets.forest_harmony_grass_joins.tilesPerRow,10);
  assert.equal(old.tilesets.forest_harmony_grass_joins.tileMeta[9].defaultLayer,'lower');
  proof.existingProjectBackfill = true;
  proof.authorDocumentsPreserved = true;
  proof.idempotent = true;
});
await withTsModule("src/project/defaults/forestHarmony.ts", "guards.mjs", (m) => {
  const edited = structuredClone(JSON.parse(fs.readFileSync(source)).tilesets.forest_harmony);
  const authored = edited.referenceDocuments.find((c) => ["diverse-villages-v1","diverse-villages-cliff-v2","diverse-villages-grass-v3","diverse-villages-winding-v4","diverse-villages-households-v5","diverse-villages-purpose-v6"].includes(c.id));
  if (authored) {
    authored.documents[0].markdown += "\n저자 수정 보존";
    const copy = structuredClone(authored);
    m.ensureForestHarmonyReferences(edited);
    assert.deepEqual(edited.referenceDocuments.find((c) => c.id === copy.id), copy);
    assert(edited.referenceDocuments.some((c) => c.id === category));
    proof.editedPreviousPreservedAndV7Added = true;
  }
  const shared = m.createForestHarmonyTileset();
  shared.referenceDocuments = [];
  shared.referenceSourceTilesetId = "my-owner";
  assert.equal(m.ensureForestHarmonyReferences(shared), false);
  assert.equal(shared.referenceDocuments.length, 0);
  const unrelated = m.createForestHarmonyTileset();
  unrelated.image = { type: "bundled", id: "other-atlas" };
  unrelated.referenceDocuments = [];
  assert.equal(m.ensureForestHarmonyReferences(unrelated), false);
  proof.sharedPointerAndOtherAtlasPreserved = true;
});
const ids = ["pine-hamlets", "terrace-cliff-village", "reed-bay-village"];
await withTsModule("src/project/io/serialize.ts", "roundtrip.mjs", (m) => {
  for (const id of ids) {
    const p = JSON.parse(fs.readFileSync(`public/assets/region-references/${id}.oprn.json`));
    const after = m.deserialize(m.serialize(p));
    assert.deepEqual(after.maps[id].lowerTiles, p.maps[id].lowerTiles);
    assert.deepEqual(after.maps[id].upperTiles, p.maps[id].upperTiles);
    assert.deepEqual(after.tilesets.forest_harmony.tileGrafts, p.tilesets.forest_harmony.tileGrafts);
    assert.deepEqual(after.tilesets.forest_harmony.priority, p.tilesets.forest_harmony.priority);
    const c = after.tilesets.forest_harmony.referenceDocuments.find((c2) => c2.id === category);
    assert.equal(c.documents.length, 38);
    assert.equal(c.images.length, 25);
  }
  proof.exportRoundtrip = ids;
});
fs.writeFileSync(out + "/distribution-proof.json", JSON.stringify(proof, null, 2));
console.log(proof);
