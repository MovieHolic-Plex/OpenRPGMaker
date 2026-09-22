import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";
const source = process.argv[2];
if (!source) throw Error("Usage: verify-diverse-village-distribution.mjs existing-project.json");
const shipped = JSON.parse(fs.readFileSync("src/assets/sharedDiverseVillageReferences.json")), [category, concept] = shipped.map((c) => c.id), out = "verify-shots/village-diversity", proof = {};
const retired = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/previous-reference.json")).map((r) => r.id);
let blank;
await withTsModule("src/project/defaults/blankProject.ts", "fresh.mjs", (m) => blank = m.createBlankProject());
assert.equal(blank.tilesets.forest_harmony.referenceDocuments.filter((c) => c.id === category).length, 1);
assert.equal(blank.tilesets.forest_harmony.referenceDocuments.filter((c) => c.id === concept).length, 1);
assert.equal(blank.tilesets.forest_harmony.tileMeta[84].label, "스테인드글라스 창");
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
  assert.equal(t.referenceDocuments.filter((c) => c.id === concept).length, 1);
  assert.equal(t.tileMeta[86].label, "덧문 창");
  proof.blankLabelsFilled = true;
  for (const c of before) {
    if (retired.includes(c.id)) assert(!t.referenceDocuments.some((a) => a.id === c.id));
    else assert.deepEqual(t.referenceDocuments.find((a) => a.id === c.id), c);
  }
  proof.shippedPreviousReplaced = before.some((c) => retired.includes(c.id));
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
  const authored = edited.referenceDocuments.find((c) => retired.includes(c.id));
  if (authored) {
    authored.documents[0].markdown += "\n저자 수정 보존";
    const copy = structuredClone(authored);
    m.ensureForestHarmonyReferences(edited);
    assert.deepEqual(edited.referenceDocuments.find((c) => c.id === copy.id), copy);
    assert(edited.referenceDocuments.some((c) => c.id === category));
    proof.editedPreviousPreservedAndCurrentAdded = true;
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
const ids = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json")).plans.map((p) => p.id);
await withTsModule("src/project/io/serialize.ts", "roundtrip.mjs", (m) => {
  for (const id of ids) {
    const p = JSON.parse(fs.readFileSync(`public/assets/region-references/${id}.oprn.json`));
    const after = m.deserialize(m.serialize(p));
    assert.deepEqual(after.maps[id].lowerTiles, p.maps[id].lowerTiles);
    assert.deepEqual(after.maps[id].upperTiles, p.maps[id].upperTiles);
    assert.deepEqual(after.tilesets.forest_harmony.tileGrafts, p.tilesets.forest_harmony.tileGrafts);
    assert.deepEqual(after.tilesets.forest_harmony.priority, p.tilesets.forest_harmony.priority);
    const c = after.tilesets.forest_harmony.referenceDocuments.find((c2) => c2.id === category);
    for (const [n, want] of [category, concept].entries()) {
      const got = after.tilesets.forest_harmony.referenceDocuments.find((c2) => c2.id === want);
      assert.equal(got.documents.length, shipped[n].documents.length);
      assert.equal(got.images.length, shipped[n].images.length);
    }
    assert(c.documents.length <= 64);
  }
  proof.exportRoundtrip = ids;
});
fs.writeFileSync(out + "/distribution-proof.json", JSON.stringify(proof, null, 2));
console.log(proof);
