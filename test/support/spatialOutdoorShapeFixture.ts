import type { SpaceDesign } from "../../src/project/spatial/types";
import { outdoorCompilerFixture, reinstantiateSpace } from "./spatialSpaceCompilerFixture";

/** Nondefault dimensions; both material overlays cross the northern shape cutouts. */
export function outdoorShapeFixture(seed: number, shape: SpaceDesign["shape"]) {
  return reinstantiateSpace(outdoorCompilerFixture(seed), space => ({ ...space, shape, width: 22, height: 16,
    floorAreas: [
      { kind: "rect", material: "path", x: 0, y: 0, width: 22, height: 3 },
      { kind: "polygon", material: "shore", points: [{ x: 12, y: 0 }, { x: 21, y: 0 }, { x: 21, y: 9 }] },
    ],
  }));
}
