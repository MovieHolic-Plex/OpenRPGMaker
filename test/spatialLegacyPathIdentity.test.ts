import { describe, expect, it } from "vitest";
import { canonicalConceptBundles, canonicalConceptLayout } from "@/editor/spatial/legacyConcepts";
import { conceptOverlayFor } from "@/editor/conceptBundleResolve";
import { runTool } from "@/editor/tools/toolRunner";
import { checkedDocument, own, spatialId } from "@/project/spatial/domain";
import type { Project } from "@/project/types";
import type { PlaceDesign } from "@/project/spatial/types";
import { fixtureDocument, interiorAtlas, spaceCompilerFixture } from "./support/spatialSpaceCompilerFixture";

// T17-AV-2: promoted from independent/legacy-probes.mts, preserving its valid 1-based floors.
function collisionProject(path: readonly [string, string] = ["A", "B"]): Project {
  const project = spaceCompilerFixture();
  const document = fixtureDocument(project);
  const space = own(document.library.spaces, "room-design");
  const first = { ...space, id: spatialId("room-one"), name: "First room", objectSlots: space.objectSlots.filter(slot => slot.id === "beds") };
  const second = { ...space, id: spatialId("room-two"), name: "Second room", objectSlots: space.objectSlots.filter(slot => slot.id === "hearth") };
  const base = { revision: 1, tags: [], provenance: { origin: "user" }, kind: "facility", layout: "manual", ports: [], connections: [] } as const;
  const nested: PlaceDesign = { ...base, id: spatialId("nested"), name: "Nested", children: [
    { id: spatialId(path[1]), source: { kind: "space", id: second.id }, x: 0, y: 0, level: 1 },
  ] };
  const root: PlaceDesign = { ...base, id: spatialId("collision-root"), name: "Collision root", children: [
    { id: spatialId(`${path[0]}/${path[1]}`), source: { kind: "space", id: first.id }, x: 0, y: 0, level: 1 },
    { id: spatialId(path[0]), source: { kind: "place", id: nested.id }, x: 20, y: 0, level: 1 },
  ] };
  project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library,
    spaces: { ...document.library.spaces, [first.id]: first, [second.id]: second }, places: { [root.id]: root, [nested.id]: nested },
  } }, project);
  return project;
}

function projectedBundle(project: Project, id = "collision-root") {
  const bundle = canonicalConceptBundles(project, interiorAtlas).find(bundle => bundle.id === id);
  if (!bundle) throw new TypeError(`Missing projected fixture bundle: ${id}`);
  return bundle;
}

describe("canonical legacy opaque path identity", () => {
  it.each([
    ["A", "B"],
    ['A/"\\', "B:2/[x]"],
    ['["A"]', "B\\C"],
  ] as const)("keeps bed and hearth overlays separate when direct %s/%s also occurs as a nested path", (left, right) => {
    // Given: the exact adversarial fixture first, then delimiter/escaping variants.
    const project = collisionProject([left, right]);
    const before = JSON.stringify(project);
    // When: registered lookup followed by actual compatibility layout/overlay composition.
    const lookup = runTool({ project }, "get_concept_facility", { query: "collision-root" });
    const bundle = projectedBundle(project);
    const facility = bundle.facilities[0];
    const layout = canonicalConceptLayout(bundle);
    if (!facility || !layout) throw new TypeError("Missing fixture facility layout");
    const overlay = conceptOverlayFor(bundle, facility, layout);
    // Then: exact object multiplicities and membership survive, without rewriting source IDs.
    expect(lookup.ok, lookup.summary).toBe(true);
    expect(lookup.data).toMatchObject({ canonical: { kind: "place", design: { id: "collision-root", children: [
      { id: `${left}/${right}`, source: { kind: "place", id: "room-one" } },
      { id: left, source: { kind: "place", id: "nested" } },
    ] } } });
    expect(Object.values(overlay.rooms).map(room => room.things.map(thing => thing.objectId))).toEqual([
      ["bed_v", "bed_v"], ["fixture-asymmetric"],
    ]);
    const roomIds = bundle.places.map(room => room.id);
    expect(new Set(roomIds).size).toBe(2);
    expect(facility.placeIds).toEqual(roomIds);
    expect(layout.rooms.map(room => ({ id: room.id, placeId: room.placeId, x: room.x, y: room.y }))).toEqual([
      { id: roomIds[0], placeId: roomIds[0], x: 2, y: 3 },
      { id: roomIds[1], placeId: roomIds[1], x: 22, y: 3 },
    ]);
    expect(bundle.places.map(room => room.level)).toEqual([1, 2]);
    expect(bundle.things.map(thing => thing.placeIds)).toEqual([[roomIds[0]], [roomIds[0]], [roomIds[1]]]);
    expect(new Set(bundle.things.map(thing => thing.id)).size).toBe(3);
    expect(Object.keys(overlay.rooms)).toEqual(roomIds);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("retains separate room and thing occurrences when a canonical space is reused under colliding paths", () => {
    // Given: valid source reuse must not be deduplicated or rejected, even with identical labels and slots.
    const project = collisionProject();
    const document = fixtureDocument(project);
    const nested = own(document.library.places, "nested");
    project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library, places: { ...document.library.places,
      [nested.id]: { ...nested, children: nested.children.map(child => ({ ...child, source: { kind: "space", id: spatialId("room-one") } })) },
    } } }, project);
    // When
    const bundle = projectedBundle(project);
    // Then
    expect(new Set(bundle.places.map(room => room.id)).size).toBe(2);
    expect(new Set(bundle.things.map(thing => thing.id)).size).toBe(4);
    expect(bundle.places.map(room => bundle.things.filter(thing => thing.placeIds.includes(room.id)).map(thing => thing.objectId)))
      .toEqual([["bed_v", "bed_v"], ["bed_v", "bed_v"]]);
  });

  it("encodes the root boundary when different facilities have the same flattened room path", () => {
    // Given: root A/B + slot C and root A + slot B/C are different complete tuples.
    const project = collisionProject();
    const document = fixtureDocument(project);
    const template = own(document.library.places, "collision-root");
    const places = Object.fromEntries([["A/B", "C"], ["A", "B/C"]].map(([root, slot]) => {
      if (!root || !slot) throw new TypeError("Missing root/slot fixture");
      const place: PlaceDesign = { ...template, id: spatialId(root), children: [
        { id: spatialId(slot), source: { kind: "space", id: spatialId("room-one") }, x: 0, y: 0, level: 1 },
      ] };
      return [place.id, place];
    }));
    project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library, places } }, project);
    // When
    const bundles = canonicalConceptBundles(project, interiorAtlas);
    // Then
    expect(new Set(bundles.flatMap(bundle => bundle.places.map(room => room.id))).size).toBe(2);
    expect(new Set(bundles.flatMap(bundle => bundle.things.map(thing => thing.id))).size).toBe(4);
  });

  it("projects deterministic identities when the same canonical input is read again", () => {
    // Given
    const project = collisionProject();
    const first = projectedBundle(project);
    const layout = canonicalConceptLayout(first);
    const before = JSON.stringify(project);
    // When
    const second = projectedBundle(project);
    // Then
    expect(second).toEqual(first);
    expect(canonicalConceptLayout(second)).toEqual(layout);
    expect(JSON.stringify(project)).toBe(before);
  });
});
