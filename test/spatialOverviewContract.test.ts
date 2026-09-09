import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { own } from "../src/project/spatial/domain";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

describe("overview public output contract", () => {
  it("retains complete route bookkeeping and entry pairs when real output crosses project IO", () => {
    // Given: real task9 children and an explicitly associated overview raster.
    const witness = geographyOutputContract(109);
    const before = JSON.stringify(witness.complete);
    // When: full project IO parses the submitted output.
    const loaded = deserialize(before);
    // Then: both associations survive without changing ordinary port ownership or output.
    expect(fixtureDocument(loaded).connections).toEqual(witness.complete.spatialAuthoring.connections);
    expect(own(fixtureDocument(loaded).occurrences, geographyRoot).bindings).toEqual(witness.complete.spatialAuthoring.occurrences[geographyRoot]?.bindings);
    expect(loaded.mapConnections).toEqual(witness.complete.mapConnections);
    expect(JSON.stringify(witness.complete)).toBe(before);
    expect(deserialize(serialize(loaded)).spatialAuthoring).toEqual(loaded.spatialAuthoring);
  });

  it("does not execute overview routes as direct transfers when compiling an uncompiled child", () => {
    // Given: the ordinary child compiler receives intact authored overview routes.
    const input = geographyFixture("region", 109);
    const child = Object.values(fixtureDocument(input).occurrences).find(value => value.parentId === geographyRoot);
    if (!child) throw new TypeError("Missing fixture child");
    const before = serialize(input);
    // When: compile through the public consumer, without hiding any connections.
    const output = compileSpatialOccurrence(input, { occurrenceId: child.id });
    // Then: overview navigation remains logical, with no child-to-child teleports.
    expect(output.mapConnections).toEqual([]);
    expect(fixtureDocument(output).connections).toEqual(fixtureDocument(input).connections);
    expect(serialize(input)).toBe(before);
  });
});
