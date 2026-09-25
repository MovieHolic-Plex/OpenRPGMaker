// The atlas interior groups, in authoring order. Each module adds its rooms to the kit (K.room(...).done({...})).
import homes from "./homes.mjs";
import shops from "./shops.mjs";
import taverns from "./taverns.mjs";
import { guilds, schools } from "./guilds.mjs";
import civic from "./civic.mjs";

export const GROUPS = { homes, shops, taverns, guilds, schools, civic };
