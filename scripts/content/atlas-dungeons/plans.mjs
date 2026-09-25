// Atlas dungeon plans (tiledata/atlas-dungeons). Legend: rpg-dungeons/kit.mjs (TERRAIN, PROPS) + parts stamp keys
// (tiledata/atlas-dungeons/parts.json). Each file is one or more series of connected floors and rooms.
import { cavePlans } from "./caves.mjs";

export function atlasPlans() {
  return [...cavePlans()];
}
