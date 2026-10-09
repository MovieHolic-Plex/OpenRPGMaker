import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { deserialize, serialize, serializePretty } from "../../src/project/io";
import { checkedDocument, findOccurrenceChildId, resolveOccurrencePortId, own, spatialId, SpatialOperationError } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import { deleteSpatialDesign, deleteSpatialOccurrence, inspectSpatialDesignReferences, inspectSpatialOccurrenceDeletion } from "../../src/project/spatial/ownership";
import { resolveSpatialDesign, resolveSpatialOccurrenceRefresh, SPATIAL_EXPANSION_LIMITS } from "../../src/project/spatial/resolve";
import type { SpatialAuthoringDocument } from "../../src/project/spatial/types";
import { expansionFixture, first, instancesFixture, selectedCells } from "../../test/support/spatialInstancesFixture";
import { legacyOccurrence, opaqueOccurrenceFixture } from "../../test/support/spatialOccurrenceIdentityFixture";

const { values } = parseArgs({ options: { scenario: { type: "string", default: "snapshots" }, evidence: { type: "string", default: "output/evidence/tile-to-world/task-7" } } });
if (values.scenario !== "snapshots") throw new TypeError(`Unsupported scenario: ${values.scenario}`);
const output = resolve(values.evidence);
const digest = (value: unknown): string => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const rejected: { readonly scenario: string; readonly name: string; readonly diagnostic: string }[] = [];
const reject = (scenario: string, action: () => unknown, diagnostic?: RegExp): void => {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    if (diagnostic) assert.match(error.message, diagnostic);
    rejected.push({ scenario, name: error.name, diagnostic: error.message });
    return true;
  });
};
const sandbox = await mkdtemp(join(tmpdir(), "spatial-instances-"));
try {
  // Given: real project IO creates the typed source; fixture events include owned and unmanaged data.
  const { project, document, request, tilesetId } = instancesFixture();
  const sourceBefore = serialize(project);
  const sourcePath = join(sandbox, "source.json");
  await writeFile(sourcePath, sourceBefore);
  const placed = instantiateSpatialDesign(document, project, request);
  assert.equal(Object.keys(placed.occurrences).length, 16);
  const root = own(placed.occurrences, request.rootId);
  assert.deepEqual(root.snapshot.kitCells.desk?.cells, selectedCells);
  const nested = Object.values(placed.occurrences).find(value => value.kind === "place");
  assert.ok(nested);
  const duplicated = duplicateSpatialOccurrence(placed, project, { occurrenceId: nested.id, rootId: "nested-copy", externalConnections: "omit" });
  assert.equal(Object.keys(duplicated.occurrences).length, 23);
  assert.equal(duplicated.connections.length, 4);
  const copy = own(duplicated.occurrences, "nested-copy");
  assert.deepEqual(copy.snapshot.kitCells, nested.snapshot.kitCells);
  assert.notEqual(copy.snapshot.library, nested.snapshot.library);
  const ports = Object.values(duplicated.occurrences).flatMap(value => value.snapshot.ports.map(port => port.id));
  assert.equal(new Set(ports).size, ports.length);
  const beforeSnapshots = digest(duplicated.occurrences);

  // When: edit nested source, overrides and the actual authored kit, then explicitly resolve refresh.
  const room = own(duplicated.library.spaces, "room");
  const changed = { ...duplicated, library: { ...duplicated.library, spaces: { room: { ...room, revision: 6, floor: "stone",
    objectSlots: [{ ...first(room.objectSlots), quantity: 3, chipOverrides: ["new-service"] }] } } } };
  const changedProject = structuredClone(project);
  own(changedProject.tilesets, tilesetId).structureKits = [{ id: "kit", kind: "section", width: 2, height: 1,
    rows: [{ tiles: [12, -1], upperTiles: [13, 14] }], learnedFrom: "db-authored" }];
  const refresh = resolveSpatialOccurrenceRefresh(changed, changedProject, root.id);
  assert.equal(refresh.occurrenceCount, 20);
  assert.equal(refresh.snapshot.library.spaces.room?.revision, 6);
  assert.deepEqual(refresh.snapshot.library.spaces.room?.objectSlots[0]?.chipOverrides, ["new-service"]);
  assert.equal(refresh.snapshot.kitCells.desk?.cells[0]?.tile, 12);
  assert.equal(digest(changed.occurrences), beforeSnapshots);

  const references = inspectSpatialDesignReferences(duplicated, project, { kind: "space", id: room.id });
  assert.equal(references.strong.length, 2);
  reject("strong-source-delete", () => deleteSpatialDesign(duplicated, project, { kind: "space", id: room.id }));
  reject("duplicate-id", () => instantiateSpatialDesign(placed, project, request));
  reject("blank-id", () => instantiateSpatialDesign(document, project, { ...request, rootId: " " }));
  reject("invalid-parent", () => checkedDocument({ ...placed, rootOccurrenceIds: [...placed.rootOccurrenceIds, nested.id] }, project));
  const peers = Object.values(placed.occurrences).filter(value => value.kind === "place");
  const left = first(peers);
  const right = first(peers.slice(1));
  reject("occurrence-cycle", () => checkedDocument({ ...placed, occurrences: { ...placed.occurrences,
    [left.id]: { ...left, parentId: right.id }, [right.id]: { ...right, parentId: left.id } } }, project), /containment cycle/);
  const inn = own(document.library.places, "inn");
  reject("design-cycle", () => resolveSpatialDesign({ ...document, library: { ...document.library, places: { inn: { ...inn, connections: [],
    children: [{ id: spatialId("cycle"), source: { kind: "place", id: inn.id }, x: 0, y: 0, level: 1 }] } } } }, project, request.source), /containment cycle/);
  const unsupported = structuredClone(project);
  own(unsupported.tilesets, tilesetId).structureKits = [{ id: "kit", kind: "house", houseKitId: "old", wings: [], learnedFrom: "db-authored" }];
  reject("unsupported-authored-kit", () => instantiateSpatialDesign(document, unsupported, request));
  const raster = own(root.snapshot.kitCells, "desk");
  reject("empty-placeholder-raster", () => checkedDocument({ ...placed, occurrences: { ...placed.occurrences, [root.id]: { ...root,
    snapshot: { ...root.snapshot, kitCells: { ...root.snapshot.kitCells, desk: { ...raster, cells: [] } } } } } }, project));
  for (const [depth, repetitions] of [[13, 2], [129, 1]] as const) {
    const huge = expansionFixture(depth, repetitions);
    reject(`expansion-${depth}-${repetitions}`, () => instantiateSpatialDesign(huge.document, huge.project, huge.request));
  }
  const huge = { ...document, library: { ...document.library, spaces: { room: { ...room, objectSlots: [{ ...first(room.objectSlots), quantity: Number.MAX_SAFE_INTEGER }] } } } };
  reject("huge-quantity", () => instantiateSpatialDesign(huge, project, request));
  for (const id of ["__proto__", "constructor", "terrainTemplates"]) {
    const opaque = instantiateSpatialDesign(document, project, { ...request, rootId: id });
    assert.deepEqual(deserialize(serialize({ ...project, spatialAuthoring: opaque })).spatialAuthoring?.rootOccurrenceIds, [id]);
  }

  // Explicit source deletion proceeds from strong owners down; historical uses never block it.
  let orphaned: SpatialAuthoringDocument = changed;
  for (const [kind, id] of [["world", "kingdom"], ["region", "country"], ["place", "inn"], ["space", "room"], ["object", "desk"]] as const) {
    orphaned = deleteSpatialDesign(orphaned, changedProject, { kind, id: spatialId(id) });
  }
  own(changedProject.tilesets, tilesetId).structureKits = [];
  reject("refresh-missing-source", () => resolveSpatialOccurrenceRefresh(orphaned, changedProject, root.id));
  const roundtrips = [];
  for (const [format, write] of [["compact", serialize], ["pretty", serializePretty]] as const) {
    const path = join(sandbox, `${format}.json`);
    await writeFile(path, write({ ...changedProject, spatialAuthoring: orphaned }));
    const loaded = deserialize(await readFile(path, "utf8"));
    assert.deepEqual(loaded.spatialAuthoring, orphaned);
    assert.deepEqual(loaded.maps, project.maps);
    assert.equal(digest(loaded.spatialAuthoring?.occurrences), beforeSnapshots);
    roundtrips.push({ format, snapshotSha256: digest(loaded.spatialAuthoring?.occurrences), mapsSha256: digest(loaded.maps) });
  }
  const binding = { mapId: project.startMapId, rect: { x: 1, y: 2, width: 3, height: 4 }, eventIds: ["owned-event"], connectionIds: [], ports: [], contentDigest: "a".repeat(64) };
  const bound = { ...orphaned, occurrences: { ...orphaned.occurrences, [root.id]: { ...root, bindings: [binding] } } };
  const impact = inspectSpatialOccurrenceDeletion(bound, changedProject, root.id);
  assert.deepEqual(impact.artifacts, [{ occurrenceId: root.id, binding }]);
  const deleted = deleteSpatialOccurrence(bound, changedProject, { occurrenceId: root.id, externalConnections: "reject" });
  assert.equal(Object.keys(deleted.occurrences).length, 7);
  assert.deepEqual(deleted.occurrences[copy.id], copy);
  assert.deepEqual(changedProject.maps, project.maps);
  assert.equal(serialize(project), sourceBefore);
  assert.equal(await readFile(sourcePath, "utf8"), sourceBefore);

  await mkdir(output, { recursive: true });
  const identityRoundtrips = [];
  for (const externalConnections of ["omit", "copy"] as const) for (const [format, write] of [["compact", serialize], ["pretty", serializePretty]] as const) {
    // Given: independent opaque/equal-payload records, with index 1 already absent.
    const fixture = opaqueOccurrenceFixture();
    const originalRoom = own(fixture.document.occurrences, fixture.room);
    const originalDesk = own(fixture.document.occurrences, fixture.desk);
    assert.equal(resolveOccurrencePortId(originalRoom, spatialId("terrainTemplates")), "opaque-port-B");
    assert.equal(resolveOccurrencePortId(originalRoom, spatialId("room-door")), "opaque-port-A");
    const surviving = deleteSpatialOccurrence(fixture.document, fixture.project, { occurrenceId: fixture.otherDesk, externalConnections: "remove" });
    const absentSources = { ...surviving, library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} } };
    for (const tileset of Object.values(fixture.project.tilesets)) tileset.structureKits = [];
    const firstCopy = duplicateSpatialOccurrence(absentSources, fixture.project, { occurrenceId: fixture.room, rootId: "opaque-copy", externalConnections });
    // When: persist/reload the copy with reversed dictionaries/ports, then copy that loaded copy.
    const reordered = checkedDocument({ ...firstCopy, occurrences: Object.fromEntries(Object.entries(firstCopy.occurrences).reverse().map(([id, occurrence]) =>
      [id, { ...occurrence, snapshot: { ...occurrence.snapshot, ports: [...occurrence.snapshot.ports].reverse() } }])) }, fixture.project);
    const firstPath = join(output, `identity-first-${externalConnections}-${format}.json`);
    await writeFile(firstPath, write({ ...fixture.project, spatialAuthoring: reordered }));
    const firstLoaded = deserialize(await readFile(firstPath, "utf8")).spatialAuthoring;
    assert.deepEqual(firstLoaded, reordered);
    const secondCopy = duplicateSpatialOccurrence(firstLoaded, fixture.project, { occurrenceId: spatialId("opaque-copy"), rootId: "opaque-again", externalConnections });
    const path = join(output, `identity-again-${externalConnections}-${format}.json`);
    await writeFile(path, write({ ...fixture.project, spatialAuthoring: secondCopy }));
    const wire = await readFile(path, "utf8");
    const loaded = deserialize(wire).spatialAuthoring;
    // Then: only index 2 survives, with original frozen data and precisely remapped endpoints.
    assert.deepEqual(loaded, secondCopy);
    assert.ok(loaded);
    const copiedRoom = own(loaded.occurrences, "opaque-again");
    const slot = { slotId: spatialId("constructor"), index: 2 };
    const copiedDeskId = findOccurrenceChildId(loaded, copiedRoom.id, slot);
    assert.ok(copiedDeskId);
    const copiedDesk = own(loaded.occurrences, copiedDeskId);
    assert.equal(findOccurrenceChildId(loaded, copiedRoom.id, { ...slot, index: 0 }), undefined);
    assert.equal(findOccurrenceChildId(loaded, copiedRoom.id, { ...slot, index: 1 }), undefined);
    assert.deepEqual(copiedDesk.parentSlot, slot);
    assert.equal(copiedRoom.parentSlot, null);
    assert.deepEqual(copiedRoom.bindings, []);
    assert.deepEqual(copiedDesk.snapshot.library, originalDesk.snapshot.library);
    assert.deepEqual(copiedDesk.snapshot.kitCells, originalDesk.snapshot.kitCells);
    assert.deepEqual(copiedRoom.source, originalRoom.source);
    const localPort = resolveOccurrencePortId(copiedRoom, spatialId("terrainTemplates"));
    const links = loaded.connections.filter(link => link.from.occurrenceId === copiedRoom.id);
    assert.deepEqual(links.map(link => [link.from, link.to]), externalConnections === "omit" ? [] : [[
      { occurrenceId: copiedRoom.id, portId: localPort }, { occurrenceId: fixture.otherRoom, portId: "opaque-other-A" },
    ]]);
    const allIds = Object.values(loaded.occurrences).flatMap(value => [value.id, ...value.snapshot.ports.map(port => port.id)]);
    assert.equal(new Set(allIds).size, allIds.length);
    const legacy = legacyOccurrence(loaded, copiedRoom.id);
    const incomplete = { ...loaded, occurrences: { ...loaded.occurrences, [legacy.id]: legacy } };
    assert.deepEqual(deserialize(write({ ...fixture.project, spatialAuthoring: incomplete })).spatialAuthoring, incomplete);
    assert.throws(() => duplicateSpatialOccurrence(incomplete, fixture.project, { occurrenceId: legacy.id, rootId: "blocked", externalConnections }),
      new SpatialOperationError("association-required", `occurrences.${legacy.id}`));
    identityRoundtrips.push({ format, externalConnections, firstPath, path, wireSha256: digest(wire),
      exactRoundtrip: true, survivingIndex: 2, deletedIndices: [0, 1], concretePort: localPort,
      parentSlot: copiedDesk.parentSlot, rootParentSlot: copiedRoom.parentSlot, links, legacyIO: true, legacyIdentityRejected: true });
  }
  const report = { verdict: "passed", scenario: values.scenario,
    executedHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    sourceSha256: digest(sourceBefore), sourceAfterSha256: digest(serialize(project)), sourceUnchanged: true,
    occurrencesBefore: 16, occurrencesAfterNestedDuplicate: 23, independentPorts: ports.length,
    snapshotsBeforeSha256: beforeSnapshots, snapshotsAfterSourceAndKitDeletionSha256: digest(orphaned.occurrences),
    frozenRoot: root.snapshot, frozenNestedCopy: copy.snapshot, refreshProposal: refresh, references, deletionImpact: impact,
    roundtrips, identityRoundtrips, rejected, limits: SPATIAL_EXPANSION_LIMITS, databaseWrites: 0, servers: [], imageDecisions: 0 };
  await writeFile(join(output, "snapshot-diff.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ verdict: report.verdict, executedHead: report.executedHead, occurrences: 23, rejected: rejected.length, sourceUnchanged: true, evidence: join(output, "snapshot-diff.json") }));
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
