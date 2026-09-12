/** Independent read-only Supabase proof after editor and shipping-player checks. */
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { configFromEnv } from "../supabase-resource-root/supabaseRest.mjs";
import { loadProjectForPersistenceProof } from "../../src/project/supabaseProjectSync";
import { computeReachableCells } from "../../src/project/lint/reachability";
const config = await configFromEnv();
assert.equal(config.projectId, "rpg-zzu-house-template-gallery");
const source = process.argv[2] ?? "output/evidence/compact-village/reloaded-project.json";
const expected = JSON.parse(fs.readFileSync(source, "utf8"));
const savedProof = JSON.parse(fs.readFileSync(path.join(path.dirname(source), "supabase-proof.json"), "utf8"));
assert.match(savedProof.canonicalSHA256, /^[a-f0-9]{64}$/);
const snapshot = await loadProjectForPersistenceProof(config);
assert.ok(snapshot);
assert.equal(snapshot.sha256, savedProof.canonicalSHA256, "Canonical server revision changed after save");
const project = snapshot.project;
// Fresh load can normalize priority defaults on unrelated historical tilesets differently.
// Compare the canonical server revision plus all authored maps/spatial content directly.
assert.ok(isDeepStrictEqual(project.maps, expected.maps), "Saved maps changed");
assert.ok(isDeepStrictEqual(project.spatialAuthoring, expected.spatialAuthoring), "Saved spatial library changed");
assert.ok(isDeepStrictEqual(project.tilesets[expected.maps[expected.startMapId].tilesetId],
  expected.tilesets[expected.maps[expected.startMapId].tilesetId]), "Village tileset or house graphics changed");
assert.equal(project.startMapId, expected.startMapId);
assert.ok(isDeepStrictEqual(project.startPos, expected.startPos));
const mapId = expected.startMapId, map = project!.maps[mapId]!;
const regions = map.layoutPlan!.regions, houses = regions.filter(r => r.objectExterior);
const doors = houses.flatMap(r => r.objectExterior!.doorApproaches);
const market = regions.filter(r => r.tags?.includes("market-display"));
const shores = regions.filter(r => r.tags?.includes("lakeside"));
const decorations = regions.filter(r => r.tags?.includes("village-decoration"));
const seen = computeReachableCells(project!, map, project!.startPos.x, project!.startPos.y);
const targets = [...doors, ...market.map(r => r.front!), ...shores.map(r => r.front!), ...decorations.map(r => r.front!)];
assert.ok(targets.every(p => seen.has(`${p.x},${p.y}`)));
const proof = { projectId: config.projectId, mapId, canonicalSHA256: snapshot.sha256, canonicalRevisionMatches: true, authoredContentMatches: true,
  compactHouseLibraryCount: Object.keys(project.spatialAuthoring!.library.objects).filter(id => id.startsWith("compact-village:object:")).length, libraryHouseCount:
  Object.keys(project!.spatialAuthoring!.library.objects).filter(id => id.startsWith("house30:object:")).length,
  maps: Object.keys(project!.maps).length, houses: houses.length, doors: doors.length, marketDisplays: market.length,
  lakesideAccess: shores.length, decorationSpaces: decorations.length, exactDestinationsReachable: targets.length,
  // Hash a fixed tuple of actual raster fields, independent of object key order after normalization.
  rasterSHA256: createHash("sha256").update(JSON.stringify([map.width, map.height, map.lowerTiles, map.upperTiles,
    map.lowerTileStacks ?? {}, map.upperTileStacks ?? {}])).digest("hex"), verifiedAt: new Date().toISOString() };
const out = process.argv[3] ?? ".omo/evidence/compact-village";
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/final-remote-check.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
