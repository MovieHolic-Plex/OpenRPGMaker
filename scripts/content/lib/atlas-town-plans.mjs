// All plans of tiledata/atlas-towns, in catalog order. Each group file owns one kind of town.
import { HOME_PLANS } from "./atlas-plans-home.mjs";
import { WATER_PLANS } from "./atlas-plans-water.mjs";
import { CAPITAL_PLANS } from "./atlas-plans-capital.mjs";
export const PLANS = [...HOME_PLANS, ...WATER_PLANS, ...CAPITAL_PLANS];
