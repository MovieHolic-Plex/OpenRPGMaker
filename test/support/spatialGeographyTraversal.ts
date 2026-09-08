import assert from "node:assert/strict";
import { canMove, isPassableLanding } from "../../src/project/collision";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own } from "../../src/project/spatial/domain";
import { overviewDesign, spatialPortLanding } from "../../src/project/spatial/overview";
import type { SpatialPoint } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { inspectNestedTraversal } from "./spatialPlaceTraversal";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

/** Independent oracle follows authored route geometry, not the compiler's path helper. */
export function inspectGeographyTraversal(project: Project) {
  const document = fixtureDocument(project);
  const overviews = Object.values(document.occurrences).filter(occurrence => occurrence.kind === "region" || occurrence.kind === "world").map(owner => {
    const design = overviewDesign(owner);
    const binding = owner.bindings.find(isOwnedSpatialBinding);
    assert.ok(binding);
    const map = own(project.maps, binding.mapId);
    const routes = document.connections.filter(link => link.overviewRoute?.occurrenceId === owner.id).map(link => {
      const endpoints = [link.from, link.to].map(endpoint => {
        if (endpoint.occurrenceId === owner.id) {
          const port = binding.ports.find(port => port.portId === endpoint.portId);
          assert.ok(port);
          return port;
        }
        const entry = binding.overviewEntries?.find(entry => entry.target.occurrenceId === endpoint.occurrenceId && entry.target.portId === endpoint.portId);
        assert.ok(entry);
        const landing = spatialPortLanding(document, entry.target);
        assert.ok(landing);
        assert.notEqual(landing.mapId, map.id);
        return entry;
      });
      const [from, to] = endpoints;
      assert.ok(from && to);
      const local = ("routes" in design ? design.routes : design.connections).find(local => local.id === link.overviewRoute?.localConnectionId);
      assert.ok(local);
      const points = "routes" in design ? design.routes.find(route => route.id === local.id)?.points : [from, { x: to.x, y: from.y }, to];
      assert.ok(points);
      const walk: SpatialPoint[] = [{ x: from.x, y: from.y }];
      let cursor: SpatialPoint = from;
      for (const point of points.slice(1)) {
        assert.ok(cursor.x === point.x || cursor.y === point.y);
        while (cursor.x !== point.x || cursor.y !== point.y) {
          const next = { x: cursor.x + Math.sign(point.x - cursor.x), y: cursor.y + Math.sign(point.y - cursor.y) };
          assert.ok(canMove(project, map, cursor.x, cursor.y, next.x, next.y));
          assert.ok(canMove(project, map, next.x, next.y, cursor.x, cursor.y));
          walk.push(next);
          cursor = next;
        }
      }
      assert.equal(cursor.x, to.x);
      assert.equal(cursor.y, to.y);
      assert.ok(isPassableLanding(project, map, to.x, to.y));
      return { connectionId: link.id, provenance: link.overviewRoute, from: link.from, to: link.to, points, walk,
        pathTiles: walk.map(point => ({ ...point, lower: map.lowerTiles[point.y * map.width + point.x], upper: map.upperTiles[point.y * map.width + point.x] })) };
    });
    return { occurrenceId: owner.id, sourceId: owner.source.id, mapId: map.id, tilesetId: map.tilesetId,
      width: map.width, height: map.height, digest: binding.contentDigest, ports: binding.ports, entries: binding.overviewEntries, routes };
  });
  return { overviews, ...inspectNestedTraversal(project) };
}
