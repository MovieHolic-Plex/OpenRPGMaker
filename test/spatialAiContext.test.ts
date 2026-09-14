import { expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { own, spatialId } from "@/project/spatial/domain";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

it("includes machine-readable frozen source provenance when canonical authoring is active", () => {
  // Given
  const project = spaceCompilerFixture();
  const document = fixtureDocument(project);
  project.spatialAuthoring = { ...document, library: { ...document.library, spaces: {} } };
  const before = JSON.stringify(project);
  // When
  const context = buildSystemPrompt(project, { budgetChars: 6000 });
  // Then: parsed structural payload, not prose.
  const payload = context.match(/<spatial-authoring>(.*?)<\/spatial-authoring>/s)?.[1];
  expect(payload).toBeDefined();
  if (!payload) throw new TypeError("Missing spatial context payload");
  const parsed: unknown = JSON.parse(payload);
  expect(parsed).toMatchObject({ active: true, occurrences: expect.arrayContaining([
    expect.objectContaining({ id: "compiler-room", source: { kind: "place", id: spaceDesign, revision: 1 }, sourceMissing: true }),
  ]) });
  expect(JSON.stringify(project)).toBe(before);
});

it("keeps complete places discoverable beside a large prop library and reports omitted designs", () => {
  const project = placeCompilerFixture();
  const document = fixtureDocument(project);
  const object = own(document.library.objects, "hearth-design");
  const facility = own(document.library.places, "nested-inn-design");
  const objects = Object.fromEntries(Array.from({ length: 40 }, (_, index) => {
    const id = spatialId(`prop-${index}`);
    return [id, { ...object, id, name: `Prop ${index}`, tags: ["건물 외형", "주택"] }];
  }));
  project.spatialAuthoring = { ...document, library: { ...document.library,
    objects: { ...objects, ...document.library.objects },
    places: { ...document.library.places, [facility.id]: { ...facility, name: "House </spatial-authoring>",
      tags: ["주택"], exterior: object.graphic } },
  } };
  const before = JSON.stringify(project);
  const context = buildSystemPrompt(project, { budgetChars: 6000 });
  const payload = context.match(/<spatial-authoring>(.*?)<\/spatial-authoring>/s)?.[1];
  if (!payload) throw new TypeError("Missing spatial context payload");
  const parsed = JSON.parse(payload);
  expect(parsed.designs).toHaveLength(10); // 6 objects, 2 spaces, 2 places
  expect(parsed.designs).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "object", tags: ["건물 외형", "주택"], graphic: object.graphic }),
    expect.objectContaining({ kind: "place", id: facility.id, placeKind: "facility", name: "House </spatial-authoring>",
      exterior: object.graphic, portCount: 0, connectionCount: 0 }),
    expect.objectContaining({ kind: "place", environment: "outdoor" }),
  ]));
  expect(parsed.designCounts).toEqual({ object: Object.keys(objects).length + Object.keys(document.library.objects).length,
    place: 4, region: 0, world: 0 });
  expect(parsed.omittedDesignCount).toBe(parsed.designCount - parsed.designs.length);
  expect(context).toContain("use list_spatial_designs kind:place");
  expect(context).toContain("copy design.graphic into place.exterior");
  expect(context).toContain("interior children remain separate maps even at the same level");
  expect(JSON.stringify(project)).toBe(before);
});
