import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  cacheDir: ".omo/evidence/life-full-20260906/1/vite-cache",
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { serialize, deserialize } = await server.ssrLoadModule("/src/project/io.ts");
  const { createLegacyLifeProject } = await server.ssrLoadModule("/test/fixtures/life-full/legacyProject.ts");
  const original = createBlankProject();
  const before = serialize(original);
  const loaded = deserialize(before);
  const stable = serialize(createLegacyLifeProject());
  assert.deepEqual(original.system.titleScreen.titleGraphic, { mode: "text", x: 32, y: 62 });
  assert.equal(loaded.system.titleScreen.titleGraphic, undefined);
  assert.equal(serialize(loaded), stable);
  assert.equal(serialize(deserialize(stable)), stable);
  assert.equal(serialize(deserialize(serialize(loaded))), stable);
  assert.equal(serialize(original), before);
  console.log("Public createBlankProject -> serialize -> deserialize: only redundant text title removed; source unchanged; N(P)=N(N(P)).");
  console.log(JSON.stringify({ beforeBytes: Buffer.byteLength(before), afterBytes: Buffer.byteLength(stable) }));

  for (const key of ["energy", "shipping", "bundles", "worldUnlocks", "makers", "dailyWeather", "farmAnimalBuildings", "fishing", "seasonalForage", "collections", "museum"]) {
    assert.equal(Object.hasOwn(loaded.system, key), false, key);
  }
  for (const key of ["farmAnimalSpecies", "fishSpecies", "farmBuildingTypes", "homeDecorationTypes"]) {
    assert.equal(Object.hasOwn(loaded.database, key), false, key);
  }
  for (const key of ["farmAnimals", "farmBuildingPlacements", "homeDecorationPlacements"]) {
    assert.equal(Object.hasOwn(loaded.session, key), false, key);
  }
  console.log("18 absent optional authored fields remain absent, including spatial and animal definitions.");

  for (const [key, value, pattern] of [
    ["energy", { max: "full" }, /system\.energy\.max/i],
    ["dailyWeather", { enabled: true, seasons: { spring: [{ kind: "meteor", weight: 1 }] } }, /dailyWeather.*kind/i],
    ["fishing", { enabled: true, energyCost: -1, spots: [] }, /fishing.*energyCost/i],
  ]) {
    const wire = JSON.parse(stable);
    wire.system[key] = value;
    assert.throws(() => deserialize(JSON.stringify(wire)), pattern);
    console.log(`Public deserialize rejects malformed optional ${key}.`);
  }

  const coverage = JSON.parse(readFileSync("test/fixtures/life-full/coverage.json", "utf8"));
  const ids = [["C", 1, 8], ["R", 1, 8], ["L", 0, 10], ["W", 1, 5], ["A", 1, 6], ["S", 1, 6], ["K", 1, 7]]
    .flatMap(([prefix, min, max]) => Array.from({ length: max - min + 1 }, (_, i) => `${prefix}${i + min}`));
  assert.deepEqual(coverage.features.map(row => row.id), ids);
  assert.deepEqual(coverage.findings.map(row => row.id), Array.from({ length: 13 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`));
  for (const row of [...coverage.features, ...coverage.findings]) {
    assert.equal(row.status, "not-run");
    assert.deepEqual(row.evidence, []);
    assert.deepEqual(row.scenarioIds, []);
    assert(row.ownerTasks.length > 0 && row.ownerTasks.every(n => Number.isInteger(n) && n >= 1 && n <= 20));
  }
  console.log("Parsed coverage: exact 51 unique feature IDs + F01..F13; all not-run; no claimed execution; valid owners.");
  console.log("PASS: real public serialization boundary, not a mocked normalizer. No browser or remote write.");
} finally {
  await server.close();
  console.log("Teardown: Vite SSR server closed; no listening HTTP port created.");
}
