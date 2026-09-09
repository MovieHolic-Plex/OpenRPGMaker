import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { appendToTree } from "../../src/project/mapTree";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { assertNever, own, spatialId } from "../../src/project/spatial/domain";
import type { Project } from "../../src/project/types";
import { editedRegion, editedWorld } from "./spatialGeographyEdits";
import { geographyFixture, geographyRoot } from "./spatialGeographyFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

/** Three regions: the middle marker is shared by two declared crossings; the first is the world selector. */
export function geographyControllerInput(kind: "region" | "world"): Project {
  switch (kind) {
    case "region": return geographyFixture("region", 7);
    case "world": return editedWorld(world => {
      const first = world.regions[0];
      if (!first) throw new TypeError("Missing region source");
      return { ...world, terrain: { ...world.terrain, width: 64 }, regions: [...world.regions,
        { ...first, id: spatialId("third"), x: 46, y: 10 }], connections: [...world.connections,
        { id: spatialId("second-crossing"), from: { childId: spatialId("second"), portId: spatialId("entry") },
          to: { childId: spatialId("third"), portId: spatialId("entry") }, bidirectional: true }] };
    });
    default: return assertNever(kind);
  }
}

export type GeographyControllerFault = "narrow-mountain" | "mountain-overflow" | "shared-atlas" | "blocked-route";
export function geographyControllerFault(fault: GeographyControllerFault): Project {
  switch (fault) {
    case "narrow-mountain": return editedRegion(region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: 12, y: 12, width: 6, height: 5, material: "mountain:grass" }] } }));
    case "mountain-overflow": return editedRegion(region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: 12, y: 19, width: 7, height: 5, material: "mountain:grass" }] } }));
    case "blocked-route": return editedRegion(region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: 12, y: 7, width: 3, height: 3, material: "forest" }] } }));
    case "shared-atlas": {
      const project = compileSpatialOccurrence(editedRegion(region => ({ ...region, terrain: { ...region.terrain,
        areas: [{ kind: "rect", x: 12, y: 12, width: 7, height: 5, material: "mountain:grass" }] } })), { occurrenceId: geographyRoot });
      const binding = own(fixtureDocument(project).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing compiled region owner");
      const map = own(project.maps, binding.mapId);
      const manual = { ...structuredClone(map), id: "manual-atlas-user", events: [] };
      project.maps[manual.id] = manual;
      appendToTree(project.mapTree, manual.id);
      return project;
    }
    default: return assertNever(fault);
  }
}
