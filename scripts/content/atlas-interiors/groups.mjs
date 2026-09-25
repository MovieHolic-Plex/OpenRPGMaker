// The atlas interior groups, in authoring order. Each module adds its rooms to the kit (K.room(...).done({...})).
import homes from "./homes.mjs";
import shops from "./shops.mjs";
import taverns from "./taverns.mjs";
import { guilds, schools } from "./guilds.mjs";
import civic from "./civic.mjs";
import civic2 from "./civic2.mjs";
import crafts from "./crafts.mjs";
import castle from "./castle.mjs";
import sacred from "./sacred.mjs";
import ships from "./ships.mjs";
import climate from "./climate.mjs";

export const GROUPS = { homes, shops, taverns, guilds, schools, civic, civic2, crafts, castle, sacred, ships, climate };
