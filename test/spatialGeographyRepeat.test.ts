import { beforeAll, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import type { Project } from "../src/project/types";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";

let loaded: Project;
beforeAll(() => {
  loaded = deserialize(serialize(compileSpatialOccurrence(geographyRecipeFixture("lake-kingdom"), { occurrenceId: geographyRoot })));
});
it("retains exact child ownership when a connected three-region world is recompiled", () => {
  // Given: the loaded real world, including generated overview return events on region maps.
  const input = loaded;
  // When: regenerate the complete write set.
  const repeated = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
  // Then: compare by top-level contract to retain a useful bounded failure diagnostic.
  expect(repeated.maps).toEqual(input.maps);
  expect(repeated.mapConnections).toEqual(input.mapConnections);
  expect(repeated.spatialAuthoring).toEqual(input.spatialAuthoring);
  expect(repeated).toEqual(input);
});
