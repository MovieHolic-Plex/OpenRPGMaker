// Map plans for tiledata/rpg-dungeons. Each plan = terrain art + a prop overlay (a copy of the art with prop
// letters written over it) + entry/targets/exits. Legend: rpg-dungeons/kit.mjs (TERRAIN, PROPS).
// Exits are positions only (no transfer events): `at` is the floor cell to stand on, `to`/`arrive` the
// matching cell of the next map.
import { cavePlans } from "./caves.mjs";
import { hallPlans } from "./halls.mjs";
import { towerPlans } from "./tower.mjs";
import { demonPlans } from "./demon.mjs";
import { climatePlans } from "./climate.mjs";
import { grandPlans } from "./grand.mjs";
import { sunkenPlans } from "./sunken.mjs";
import { frontierPlans } from "./frontier.mjs";

export function dungeonPlans() {
  return [...cavePlans(), ...hallPlans(), ...towerPlans(), ...demonPlans(), ...climatePlans(), ...grandPlans(), ...sunkenPlans(), ...frontierPlans()];
}
