import assert from "node:assert/strict";
import { canMove, isPassableLanding } from "../../src/project/collision";
import { deserialize, serialize } from "../../src/project/io";
import { computeReachableCells, isAdjacentOrOn } from "../../src/project/lint/reachability";
import { own } from "../../src/project/spatial/domain";
import { sha256HexTextSync } from "../../src/util/sha256";
import type { Project } from "../../src/project/types";
import { fixtureDocument, spaceRoot } from "./spatialSpaceCompilerFixture";

/** Independent numeric oracle: reads persisted snapshots/bindings, not compiler placement helpers. */
export function inspectCompiledSpace(input: Project, proposal: Project) {
  const document = fixtureDocument(proposal);
  const root = own(document.occurrences, spaceRoot);
  const binding = root.bindings[0];
  assert.ok(binding);
  assert.equal(binding.kind, undefined);
  const map = own(proposal.maps, binding.mapId);
  const entry = binding.ports[0];
  assert.ok(entry);
  assert.ok(isPassableLanding(proposal, map, entry.x, entry.y));
  const reached = computeReachableCells(proposal, map, entry.x, entry.y);
  const children = Object.values(fixtureDocument(input).occurrences).filter(child => child.parentId === root.id);
  const objectReceipts = children.map(child => {
    const compiled = own(document.occurrences, child.id);
    assert.deepEqual(compiled.snapshot, child.snapshot);
    assert.deepEqual([compiled.x, compiled.y, compiled.parentSlot], [child.x, child.y, child.parentSlot]);
    const projection = compiled.bindings[0];
    assert.ok(projection);
    assert.equal(projection.kind, "projection");
    assert.equal(projection.mapId, map.id);
    const kit = own(child.snapshot.kitCells, child.source.id);
    const origin = { x: projection.rect.x - Math.min(0, ...child.snapshot.ports.map(port => port.x)),
      y: projection.rect.y - Math.min(0, ...child.snapshot.ports.map(port => port.y)) };
    const cells = kit.cells.map(cell => {
      const x = origin.x + cell.x, y = origin.y + cell.y;
      const actual = (cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[y * map.width + x];
      assert.equal(actual, cell.tile, `${child.id}:${x},${y}:${cell.layer}`);
      return { x, y, layer: cell.layer, tile: actual };
    });
    const anchor = { x: origin.x + Math.floor(kit.width / 2), y: origin.y + kit.height - 1 };
    assert.ok(isAdjacentOrOn(reached, anchor.x, anchor.y));
    return { occurrenceId: child.id, rect: projection.rect, cells, accessible: true };
  });
  const ports = [root, ...children.map(child => own(document.occurrences, child.id))].flatMap(occurrence => {
    const bound = occurrence.bindings.flatMap(binding => binding.ports);
    assert.equal(bound.length, occurrence.snapshot.ports.length);
    return bound.map(port => {
      assert.ok(isPassableLanding(proposal, map, port.x, port.y));
      assert.ok(reached.has(`${port.x},${port.y}`));
      const bidirectionalLanding = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx = 0, dy = 0]) =>
        canMove(proposal, map, port.x, port.y, port.x + dx, port.y + dy)
        && canMove(proposal, map, port.x + dx, port.y + dy, port.x, port.y));
      assert.ok(bidirectionalLanding);
      return { ...port, occurrenceId: occurrence.id, reachable: true, bidirectionalLanding };
    });
  });
  const reloaded = deserialize(serialize(proposal));
  assert.deepEqual(reloaded.spatialAuthoring, document);
  assert.deepEqual(own(reloaded.maps, map.id), map);
  const space = own(root.snapshot.library.spaces, root.source.id);
  const required = children.filter(child => space.objectSlots.some(slot => slot.id === child.parentSlot?.slotId && slot.required)).length;
  return { seed: root.seed, environment: space.environment, shape: space.shape, mapId: map.id, width: map.width, height: map.height,
    mapSHA256: sha256HexTextSync(JSON.stringify(map)), reachableCells: reached.size, ports, objects: objectReceipts,
    requiredObjects: required, accessibleRequiredObjects: required, eventIds: map.events.map(event => event.id), ioReloads: 1 };
}
