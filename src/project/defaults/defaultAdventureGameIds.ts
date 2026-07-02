export const ADVENTURE_TITLE = "별등 마을과 세 개의 봉인";
export const ADVENTURE_TITLE_SHORT = "별등 마을";

export const ADVENTURE_MAP = {
  village: "map_lantern_village",
  forest: "map_moonwell_forest",
  mine: "map_old_copper_mine",
  shrine: "map_sky_lantern_shrine",
} as const;

export const ADVENTURE_SWITCH = {
  started: "sw_lantern_quest_started",
  forestSeal: "sw_lantern_forest_seal",
  mineSeal: "sw_lantern_mine_seal",
  bossClear: "sw_lantern_boss_clear",
} as const;

export const ADVENTURE_VARIABLE = {
  shards: "var_lantern_shards",
} as const;
