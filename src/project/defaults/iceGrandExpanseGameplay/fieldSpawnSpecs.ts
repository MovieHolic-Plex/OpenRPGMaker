export type IceGrandExpanseFieldSpawnSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly troopId: "troop_slime_pair" | "troop_bat_swarm" | "troop_golem_guard";
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly chase: boolean;
};

export const ICE_GRAND_EXPANSE_FIELD_SPAWNS = [
  { id: "fs_ice_expanse_south_01", x: 48, y: 116, troopId: "troop_slime_pair", textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_south_02", x: 56, y: 111, troopId: "troop_slime_pair", textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_south_03", x: 72, y: 111, troopId: "troop_slime_pair", textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_south_04", x: 80, y: 116, troopId: "troop_slime_pair", textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_south_05", x: 64, y: 104, troopId: "troop_slime_pair", textureKey: "tex_easyrpg_charset_monster1", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_west_01", x: 18, y: 96, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_west_02", x: 32, y: 91, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_west_03", x: 17, y: 71, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_west_04", x: 34, y: 72, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: false },
  { id: "fs_ice_expanse_east_01", x: 93, y: 98, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: true },
  { id: "fs_ice_expanse_east_02", x: 111, y: 92, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: true },
  { id: "fs_ice_expanse_east_03", x: 88, y: 84, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: true },
  { id: "fs_ice_expanse_east_04", x: 108, y: 84, troopId: "troop_golem_guard", textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4, chase: true },
  { id: "fs_ice_expanse_east_05", x: 98, y: 58, troopId: "troop_golem_guard", textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4, chase: true },
  { id: "fs_ice_expanse_lake_01", x: 49, y: 60, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: true },
  { id: "fs_ice_expanse_lake_02", x: 66, y: 57, troopId: "troop_golem_guard", textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4, chase: true },
  { id: "fs_ice_expanse_lake_03", x: 84, y: 68, troopId: "troop_bat_swarm", textureKey: "tex_easyrpg_charset_monster3", characterIndex: 0, chase: true },
] as const satisfies readonly IceGrandExpanseFieldSpawnSpec[];
