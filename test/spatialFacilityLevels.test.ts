import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { checkedDocument, spatialId } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { placeCompilerFixture } from "./support/spatialConnectionSceneFixture";

function projectWithFloor(level: number, outdoor = false) {
  const project = placeCompilerFixture();
  const document = project.spatialAuthoring!;
  const inn = document.library.places["nested-inn-design"]!;
  project.spatialAuthoring = { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [], library: {
    ...document.library, places: { ...document.library.places, [inn.id]: { ...inn, children: [...inn.children, {
      id: spatialId("new-floor"), level, x: 0, y: 0,
      source: { kind: "space", id: spatialId(outdoor ? "nested-square-design" : "room-design") },
    }] } },
  } };
  return project;
}

describe("facilities with yards and four floors", () => {
  it("compiles floor four and preserves its frozen source through ordinary save/load", () => {
    const project = projectWithFloor(4);
    const document = checkedDocument(project.spatialAuthoring, project);
    project.spatialAuthoring = instantiateSpatialDesign(document, project, {
      source: { kind: "place", id: spatialId("nested-inn-design") }, rootId: spatialId("four-floor-house"),
      x: 0, y: 0, level: 0, seed: 7, generatorVersion: "facility-floor-contract",
    });
    const compiled = compileSpatialOccurrence(project, { occurrenceId: "four-floor-house" });
    const reloaded = deserialize(serialize(compiled));
    expect(reloaded.spatialAuthoring).toEqual(compiled.spatialAuthoring);
    const fourth = Object.values(reloaded.spatialAuthoring!.occurrences).find(value => value.parentId === "four-floor-house" && value.level === 4);
    expect(fourth?.bindings[0]?.mapId).toBeTruthy();
    expect(reloaded.maps[fourth!.bindings[0]!.mapId]).toBeDefined();
  });

  it("allows a ground-level outdoor yard without accepting ground-level indoor rooms", () => {
    const yard = projectWithFloor(0, true);
    expect(() => deserialize(serialize(yard))).not.toThrow();
    const room = projectWithFloor(0);
    expect(() => checkedDocument(room.spatialAuthoring, room)).toThrow(/facility supports floors/);
  });

  it.each([-1, 5])("rejects unsupported floor %s instead of silently clipping", level => {
    const project = projectWithFloor(level);
    expect(() => checkedDocument(project.spatialAuthoring, project)).toThrow(/facility supports floors/);
  });
});
