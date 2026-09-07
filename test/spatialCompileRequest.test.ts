import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { ProjectFormatError } from "../src/project/io";
import { objectStampFixture } from "./support/spatialSpaceCompilerFixture";

const invalidRequests = [
  null, [], {}, { occurrenceId: 7 }, { occurrenceId: "" },
  { occurrenceId: "standalone-hearth", extra: true },
  { occurrenceId: "standalone-hearth", target: null },
  ...[{}, { mapId: "stamp-target" }, { mapId: "", rect: { x: 3, y: 3, width: 3, height: 3 }, entry: { x: 1, y: 1 } },
    { mapId: "stamp-target", rect: { x: 3, y: 3, width: 3, height: 3 }, entry: { x: 1, y: 1 }, extra: true },
  ].map(target => ({ occurrenceId: "standalone-hearth", target })),
  ...["x", "y", "width", "height"].flatMap(field => [undefined, "3", -1, 1.5, NaN, Infinity].map(value => ({
    occurrenceId: "standalone-hearth", target: { mapId: "stamp-target", rect: { x: 3, y: 3, width: 3, height: 3, [field]: value }, entry: { x: 1, y: 1 } },
  }))),
  ...[{ x: 3, y: 3, width: 0, height: 3 }, { x: 3, y: 3, width: 3, height: 0 },
    { x: 3, y: 3, width: 3, height: 3, extra: true }].map(rect => ({
    occurrenceId: "standalone-hearth", target: { mapId: "stamp-target", rect, entry: { x: 1, y: 1 } },
  })),
  ...[{}, { x: 1 }, { x: -1, y: 1 }, { x: 1, y: 0.5 }, { x: 1, y: 1, extra: true }].map(entry => ({
    occurrenceId: "standalone-hearth", target: { mapId: "stamp-target", rect: { x: 3, y: 3, width: 3, height: 3 }, entry },
  })),
];

describe("compiler request boundary", () => {
  it.each(invalidRequests.map((request, index) => ({ request, index })))("rejects invalid request $index using project input errors before mutation", ({ request }) => {
    // Given
    const { project } = objectStampFixture();
    const before = JSON.stringify(project);
    // When / Then: invoke the public boundary with untrusted runtime input.
    expect(() => Reflect.apply(compileSpatialOccurrence, undefined, [project, request])).toThrowError(ProjectFormatError);
    expect(JSON.stringify(project)).toBe(before);
  });
});
