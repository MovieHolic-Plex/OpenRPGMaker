// All plans of tiledata/atlas-towns, in catalog order. Each group file owns one kind of town.
import { HOME_PLANS } from "./atlas-plans-home.mjs";
import { WATER_PLANS } from "./atlas-plans-water.mjs";
import { CAPITAL_PLANS } from "./atlas-plans-capital.mjs";
import { PORT_PLANS } from "./atlas-plans-port.mjs";
import { MOUNTAIN_PLANS } from "./atlas-plans-mountain.mjs";
import { RURAL_PLANS } from "./atlas-plans-rural.mjs";
import { CLIMATE_PLANS } from "./atlas-plans-climate.mjs";
export const PLANS = [...HOME_PLANS, ...WATER_PLANS, ...CAPITAL_PLANS, ...PORT_PLANS, ...MOUNTAIN_PLANS, ...RURAL_PLANS, ...CLIMATE_PLANS];
