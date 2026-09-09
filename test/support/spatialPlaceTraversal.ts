import assert from "node:assert/strict";
import { createInterpreter } from "../../src/player/interpreter";
import { canMove, isPassableLanding } from "../../src/project/collision";
import { deserialize, serialize } from "../../src/project/io";
import { computeReachableCells } from "../../src/project/lint/reachability";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own } from "../../src/project/spatial/domain";
import type { SpatialPoint } from "../../src/project/spatial/types";
import type { PlaySessionLike } from "../../src/project/sessionRuntimeTypes";
import type { GameMap, Project } from "../../src/project/types";

/** Independent route reconstruction: every edge must pass the production movement engine. */
function walkingRoute(project: Project, map: GameMap, endpoints: { readonly from: SpatialPoint; readonly to: SpatialPoint }) {
  const queue = [endpoints.from];
  const previous = new Map<string, SpatialPoint | null>([[`${endpoints.from.x},${endpoints.from.y}`, null]]);
  for (const cell of queue) {
    if (cell.x === endpoints.to.x && cell.y === endpoints.to.y) break;
    for (const delta of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
      const next = { x: cell.x + delta.x, y: cell.y + delta.y };
      const key = `${next.x},${next.y}`;
      if (previous.has(key) || !canMove(project, map, cell.x, cell.y, next.x, next.y)) continue;
      previous.set(key, cell);
      queue.push(next);
    }
  }
  const reversed: SpatialPoint[] = [endpoints.to];
  let cursor = endpoints.to;
  for (;;) {
    const parent = previous.get(`${cursor.x},${cursor.y}`);
    assert.notEqual(parent, undefined, `No engine walking route to ${map.id}@${cursor.x},${cursor.y}`);
    if (!parent) break;
    reversed.push(parent);
    cursor = parent;
  }
  return reversed.reverse();
}

/** Executes generated command pages, not a reassembled or mocked transfer command. */
export function inspectNestedTraversal(proposal: Project) {
  const loaded = deserialize(serialize(proposal));
  const document = loaded.spatialAuthoring;
  assert.ok(document);
  const ports = Object.values(document.occurrences).flatMap(occurrence => occurrence.bindings.flatMap(binding => binding.ports.map(port => {
    assert.ok(isPassableLanding(loaded, own(loaded.maps, binding.mapId), port.x, port.y));
    return { occurrenceId: occurrence.id, mapId: binding.mapId, ...port };
  })));
  const routes = (loaded.mapConnections ?? []).map(connection => {
    const map = own(loaded.maps, connection.from.mapId);
    const event = map.events.find(event => event.id === connection.id);
    assert.ok(event);
    const page = event.pages?.[0];
    assert.ok(page);
    assert.equal(page.trigger.kind, "playerTouch");
    assert.equal(page.priority, "below");
    const owner = Object.values(document.occurrences).flatMap(occurrence => occurrence.bindings).find(binding =>
      isOwnedSpatialBinding(binding) && binding.mapId === map.id && binding.eventIds.includes(event.id));
    assert.ok(owner);
    const from = connection.from;
    // Start away from the source, so a zero-edge route cannot masquerade as walking.
    const candidates = [...computeReachableCells(loaded, map, from.x, from.y)].map(key => {
      const [x, y] = key.split(",").map(Number);
      assert.ok(x !== undefined && y !== undefined);
      return { x, y };
    }).sort((a, b) => (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)) - (Math.abs(a.x - from.x) + Math.abs(a.y - from.y)));
    const start = candidates[0];
    assert.ok(start);
    const walk = walkingRoute(loaded, map, { from: start, to: from });
    assert.ok(walk.length > 1);
    const session: PlaySessionLike = { flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
      partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
      currentMapId: map.id, x: start.x, y: start.y };
    for (const step of walk.slice(1)) {
      assert.ok(canMove(loaded, map, session.x, session.y, step.x, step.y));
      session.x = step.x;
      session.y = step.y;
    }
    const interpreter = createInterpreter(page.commands, session, loaded);
    const transfer = interpreter.start();
    assert.equal(transfer.kind, "transfer");
    if (transfer.kind !== "transfer") throw new TypeError("Generated page did not execute a transfer");
    assert.deepEqual({ mapId: transfer.mapId, x: transfer.x, y: transfer.y }, connection.to);
    assert.ok(isPassableLanding(loaded, own(loaded.maps, transfer.mapId), transfer.x, transfer.y));
    assert.deepEqual(interpreter.resume(undefined), { kind: "done" });
    assert.equal(interpreter.isDone(), true);
    return { eventId: event.id, from, to: connection.to, commands: page.commands, walk,
      executedTransfer: transfer, interpreterExecuted: true, landingPassable: true,
      engine: { walking: "project/collision.canMove", execution: "player/interpreter.createInterpreter" } };
  });
  return { ports, routes, mapTree: loaded.mapTree, serializerReloads: 1 };
}
