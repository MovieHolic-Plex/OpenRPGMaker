import { preparePlaceContainer } from "@/editor/panels/spatialPlaceContainer";
import { mixedFixture } from "./support/spatialMixedFixture";
import { expect, it } from "vitest";
import { composedPlaceFloorsFixture } from "./support/spatialComposedFloorsFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "@/project/io";
import { spatialId } from "@/project/spatial/domain";

it("keeps a painted room, nested projections and two-way floor transfers on separate maps", () => {
  const { compiled, first, second } = composedPlaceFloorsFixture();
  const occurrences = Object.values(compiled.spatialAuthoring!.occurrences);
  const room = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === first.id)!;
  const upstairs = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === second.id)!;
  expect(room.bindings[0].mapId).not.toBe(upstairs.bindings[0].mapId);
  const map = compiled.maps[room.bindings[0].mapId];
  expect(map.lowerTiles[5 * map.width + 3]).toBe(240);
  const bed = occurrences.find(o => o.parentId === room.id && o.source.id === "bed-design")!;
  expect(bed.bindings[0]).toMatchObject({ kind: "projection", mapId: map.id, rect: { x: 5, y: 6 } });
  const links = compiled.mapConnections!.filter(link => [room.bindings[0].mapId, upstairs.bindings[0].mapId].includes(link.from.mapId));
  expect(links).toHaveLength(2);
  expect(links.map(link => link.to.mapId).sort()).toEqual([room.bindings[0].mapId, upstairs.bindings[0].mapId].sort());
  const read = deserialize(serialize(compiled));
  expect(compileSpatialOccurrence(read, { occurrenceId: "painted-floors" }).maps).toEqual(read.maps);
  read.maps[map.id].lowerTiles[5 * map.width + 3] = 0;
  expect(() => compileSpatialOccurrence(read, { occurrenceId: "painted-floors" })).toThrow("ownership");
}, 60_000);

it("wraps a directly painted place without changing its original design", () => {
  const project = mixedFixture();
  const before = serialize(project);
  const wrapped = preparePlaceContainer(project, { kind: "place", id: spatialId("inn") });
  expect(serialize(project)).toBe(before);
  expect(wrapped.project.spatialAuthoring!.library.places.inn).toEqual(project.spatialAuthoring!.library.places.inn);
  expect(wrapped.project.spatialAuthoring!.library.places[wrapped.source.id].children[0]).toMatchObject({ source: { kind: "place", id: "inn" }, level: 1 });
  const document = instantiateSpatialDesign(wrapped.project.spatialAuthoring, wrapped.project, { source: wrapped.source, rootId: "wrapped-painted-place", x: 0, y: 0, level: 0, seed: 7, generatorVersion: "wrapped-place-v1" });
  const compiled = compileSpatialOccurrence({ ...wrapped.project, spatialAuthoring: document }, { occurrenceId: "wrapped-painted-place" });
  const child = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === "wrapped-painted-place")!;
  expect(compiled.maps[child.bindings[0].mapId]).toMatchObject({ width: 40, height: 30 });
  expect(compileSpatialOccurrence(deserialize(serialize(compiled)), { occurrenceId: "wrapped-painted-place" }).maps).toEqual(compiled.maps);
}, 60_000);
