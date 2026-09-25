// Atlas dungeon plans (tiledata/atlas-dungeons). Legend: rpg-dungeons/kit.mjs (TERRAIN, PROPS) + parts stamp keys
// (tiledata/atlas-dungeons/parts.json). Each file is one or more series of connected floors and rooms.
import { cavePlans } from "./caves.mjs";
import { cryptPlans } from "./crypts.mjs";
import { ghostPlans } from "./ghosts.mjs";

export function atlasPlans() {
  return [...cavePlans(), ...cryptPlans(), ...ghostPlans()];
}
