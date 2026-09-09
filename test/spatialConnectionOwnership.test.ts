import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../src/project/io";
import { own, spatialId } from "../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../src/project/spatial/duplicate";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion, occurrenceSubtree } from "../src/project/spatial/ownership";
import { projectedStairOutput } from "./support/spatialConnectionOutputFixture";
import { connectionOwnershipFixture, connectionRejections } from "./support/spatialConnectionOwnershipFixture";
import { spatialBindingFixture } from "./support/spatialSchemaFixture";

describe("projected endpoint connection ownership", () => {
  it.each([7, 19, 31])("accepts complete owner bookkeeping when real stair output is deserialized for seed %i", seed => {
    // Given: real task8 rasters and transfer helper events, not nested compiler output.
    const { proposal, control } = projectedStairOutput(seed);
    assert.ok(proposal.spatialAuthoring);
    // When
    const loaded = deserialize(JSON.stringify(proposal));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(proposal.spatialAuthoring);
    expect(loaded.maps).toStrictEqual(deserialize(JSON.stringify(control)).maps);
  });

  it.each([serialize, serializePretty])("retains complete bookkeeping when saved output is reloaded", encode => {
    // Given
    const { proposal } = projectedStairOutput();
    // When
    const loaded = deserialize(encode(deserialize(JSON.stringify(proposal))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(proposal.spatialAuthoring);
    expect([loaded.version, loaded.spatialAuthoring?.version]).toStrictEqual([4, 1]);
  });

  it.each([false, true])("accepts exact opaque external endpoints when endpoint direction is reversed=%s", reverse => {
    // Given: owner is neither endpoint; peer is an independent root, not a descendant.
    const f = connectionOwnershipFixture();
    const connections = f.document.connections.map(link => reverse ? { ...link, from: link.to, to: link.from } : link);
    const document = { ...f.document, connections, occurrences: Object.fromEntries(Object.entries(f.document.occurrences).reverse()) };
    // When
    const loaded = deserialize(JSON.stringify({ ...f.project, spatialAuthoring: document }));
    // Then
    assert.deepEqual(loaded.spatialAuthoring, document);
  });

  it.each(connectionRejections())("rejects $name when persisted evidence cannot authorize bookkeeping", ({ input }) => {
    // Given: the candidate changes only the named proof or prohibited ownership field.
    const wire = JSON.stringify(input);
    // When
    const load = () => deserialize(wire);
    // Then
    expect(load).toThrow(ProjectFormatError);
  });

  it.each([
    { x: 6, y: 9, accepted: true }, { x: 8, y: 10, accepted: true },
    { x: 5, y: 10, accepted: false }, { x: 9, y: 10, accepted: false },
    { x: 7, y: 8, accepted: false }, { x: 7, y: 11, accepted: false },
  ])("uses projected port coordinates when point is ($x,$y)", ({ x, y, accepted }) => {
    // Given: projection extent spans the owner, but only the actual port authorizes it.
    const f = connectionOwnershipFixture();
    const owner = { ...f.owner, bindings: [{ ...f.owned, rect: { x: 6, y: 9, width: 3, height: 2 },
      eventIds: [], ports: [], connectionIds: [f.link.id] }] };
    const child = { ...f.child, bindings: [{ ...f.projection, rect: { x: 0, y: 0, width: 14, height: 12 },
      ports: f.projection.ports.map(port => ({ ...port, x, y })) }] };
    const project = { ...f.project, spatialAuthoring: { ...f.document, occurrences: { ...f.document.occurrences, [owner.id]: owner, [child.id]: child } } };
    // When
    const load = () => deserialize(JSON.stringify(project));
    // Then
    if (accepted) assert.deepEqual(load().spatialAuthoring, project.spatialAuthoring);
    else expect(load).toThrow("connectionIds: missing owned connection");
  });

  it("rejects an adjacent owned endpoint when no actual projection exists", () => {
    // Given: separate owner extents; unrelated raster adjacency is not projection authority.
    const f = connectionOwnershipFixture();
    const owner = { ...f.owner, bindings: [{ ...f.owned, eventIds: [], ports: [], rect: { x: 0, y: 0, width: 7, height: 12 } }] };
    const child = { ...f.child, bindings: [{ ...f.owned, eventIds: [], connectionIds: [], rect: f.projection.rect, ports: f.projection.ports }] };
    const project = { ...f.project, spatialAuthoring: { ...f.document, occurrences: { ...f.document.occurrences, [owner.id]: owner, [child.id]: child } } };
    // When
    const load = () => deserialize(JSON.stringify(project));
    // Then
    expect(load).toThrow("connectionIds: missing owned connection");
  });

  it.each([serialize, serializePretty])("preserves unbound old self-endpoint bookkeeping when reloaded", encode => {
    // Given: self ownership never required a compiled port on that map.
    const f = spatialBindingFixture();
    const document = { ...f.document, occurrences: Object.fromEntries(Object.entries(f.document.occurrences).map(([id, value]) =>
      [id, { ...value, bindings: value.bindings.map(binding => ({ ...binding, ports: [] })) }])) };
    // When
    const loaded = deserialize(encode(deserialize(JSON.stringify({ ...f.project, spatialAuthoring: document }))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
  });

  it("reports connection removal but no erasable artifacts when inspecting a projected child", () => {
    // Given
    const f = connectionOwnershipFixture();
    // When
    const impact = inspectSpatialOccurrenceDeletion(f.document, f.project, f.child.id);
    // Then
    expect(impact).toStrictEqual({ occurrenceIds: [f.child.id], connections: [f.link], externalConnectionIds: [f.link.id],
      artifacts: [], projections: [{ occurrenceId: f.child.id, binding: f.projection }], overviewEntries: [] });
  });

  it("prunes only affected owners when a real compiled stair is deleted and saved", () => {
    // Given: floor 2 owns both links; floor 3 and all unrelated projections must survive.
    const { proposal, routes } = projectedStairOutput();
    const document = proposal.spatialAuthoring;
    const route = routes[0];
    assert.ok(document && route);
    const before = structuredClone(proposal);
    const connections = document.connections.filter(link => link.id !== route.connectionId);
    const occurrences = Object.fromEntries(Object.values(document.occurrences).filter(value => value.id !== route.from.occurrenceId).map(value => [value.id,
      { ...value, bindings: value.bindings.map(binding => isOwnedSpatialBinding(binding)
        ? { ...binding, connectionIds: binding.connectionIds.filter(id => id !== route.connectionId) } : binding) }]));
    // When
    const result = deleteSpatialOccurrence(document, proposal, { occurrenceId: route.from.occurrenceId, externalConnections: "remove" });
    const loaded = deserialize(serializePretty({ ...proposal, spatialAuthoring: result }));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual({ ...document, occurrences, connections });
    expect(loaded.maps).toStrictEqual(deserialize(JSON.stringify(before)).maps);
    expect(loaded.mapConnections).toStrictEqual(before.mapConnections);
    expect(proposal).toStrictEqual(before);
  });

  it("rejects child deletion when external connection removal is not authorized", () => {
    // Given
    const f = connectionOwnershipFixture();
    // When
    const remove = () => deleteSpatialOccurrence(f.document, f.project, { occurrenceId: f.child.id, externalConnections: "reject" });
    // Then
    expect(remove).toThrow("external-connection");
  });

  it("releases all compiled bindings but preserves navigation when the complete witness is detached", () => {
    // Given
    const { proposal } = projectedStairOutput();
    const document = proposal.spatialAuthoring;
    assert.ok(document);
    const rootId = document.rootOccurrenceIds[0];
    assert.ok(rootId);
    // When
    const result = detachSpatialOccurrence(document, proposal, rootId);
    // Then
    expect(result).toStrictEqual({ ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(value => [value.id, { ...value, bindings: [] }])) });
  });

  it("prunes only unsupported bookkeeping when the supporting projection is detached", () => {
    // Given: a remaining independent projection still supports the unrelated link.
    const f = connectionOwnershipFixture();
    const before = structuredClone(f.project);
    // When
    const result = detachSpatialOccurrence(f.document, f.project, f.child.id);
    const loaded = deserialize(serialize({ ...f.project, spatialAuthoring: result }));
    // Then
    assert.deepEqual(loaded.spatialAuthoring, { ...f.document, occurrences: { ...f.document.occurrences,
      [f.child.id]: { ...f.child, bindings: [] }, [f.owner.id]: { ...f.owner, bindings: [{ ...f.owned, connectionIds: [f.unrelated.id] }] } } });
    assert.deepEqual(f.project, before);
  });

  it("retains bookkeeping when detachment leaves the other endpoint projected into the owner", () => {
    // Given
    const f = connectionOwnershipFixture();
    const link = { ...f.link, to: f.unrelated.from };
    const document = { ...f.document, connections: [link, f.unrelated] };
    // When
    const result = detachSpatialOccurrence(document, f.project, f.child.id);
    // Then
    assert.deepEqual(result, { ...document, occurrences: { ...document.occurrences, [f.child.id]: { ...f.child, bindings: [] } } });
  });

  it.each([false, true])("returns real CLI status when saved input has missing bookkeeping target=%s", invalid => {
    // Given: isolated files, no network service or fixed process-global paths.
    const directory = mkdtempSync(join(tmpdir(), "spatial-connections-"));
    const f = connectionOwnershipFixture();
    const input = invalid ? { ...f.project, spatialAuthoring: { ...f.document, connections: [] } } : f.project;
    writeFileSync(join(directory, "input.json"), JSON.stringify(input));
    try {
      // When
      const result = spawnSync("bun", ["scripts/qa/spatial-connections.mts", "--input", join(directory, "input.json"), "--evidence", directory], { encoding: "utf8", timeout: 15_000 });
      // Then
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(invalid ? 1 : 0);
      expect(JSON.parse(result.stdout)).toMatchObject({ exitCode: invalid ? 1 : 0,
        errors: invalid ? [{ scenario: "input", expected: false }] : [] });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("clears duplicate bindings without altering original owners or endpoints when copied", () => {
    // Given
    const f = connectionOwnershipFixture();
    const before = structuredClone(f.project);
    // When
    const copy = duplicateSpatialOccurrence(f.document, f.project, { occurrenceId: f.owner.id, rootId: "copy", externalConnections: "copy" });
    // Then
    expect(occurrenceSubtree(copy, spatialId("copy")).flatMap(id => own(copy.occurrences, id).bindings)).toStrictEqual([]);
    for (const original of Object.values(f.document.occurrences)) expect(copy.occurrences[original.id]).toStrictEqual(original);
    expect(copy.connections.slice(0, 2)).toStrictEqual(f.document.connections);
    const copiedChild = Object.values(copy.occurrences).find(value => value.parentId === "copy");
    assert.ok(copiedChild);
    expect(copy.connections.slice(2)).toHaveLength(1);
    expect(copy.connections[2]?.from.occurrenceId).toBe(copiedChild.id);
    expect(copy.connections[2]?.to).toStrictEqual(f.link.to);
    assert.deepEqual(f.project, before);
  });
});
