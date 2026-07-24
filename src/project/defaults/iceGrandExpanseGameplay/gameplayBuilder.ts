import { buildIceGrandExpanseBossEvents } from "@/project/defaults/iceGrandExpanseBoss";
import { buildIceGrandExpanseCheckpointEvents } from "@/project/defaults/iceGrandExpanseCheckpoints";
import { buildIceGrandExpanseFieldSpawns } from "@/project/defaults/iceGrandExpanseGameplay/fieldSpawnBuilder";
import { buildIceGrandExpanseRegionEvents } from "@/project/defaults/iceGrandExpanseGameplay/regionEvents";
import { buildIceGrandExpanseRewardEvents } from "@/project/defaults/iceGrandExpanseGameplay/rewardEvents";
import { ICE_GRAND_EXPANSE_REGIONS } from "@/project/defaults/iceGrandExpanseMap";
import { buildIceGrandExpanseSealEvents } from "@/project/defaults/iceGrandExpanseSeals";
import type { GameMap } from "@/project/types";

export const ICE_GRAND_EXPANSE_SAFE_ZONES = [
  { x: 61, y: 115, w: 7, h: 5 }, { x: 61, y: 78, w: 7, h: 5 }, { x: 61, y: 23, w: 7, h: 5 },
] as const;

export function buildIceGrandExpanseGameplay(map: GameMap): GameMap {
  const gameplay = structuredClone(map);
  gameplay.events = [
    ...buildIceGrandExpanseRegionEvents(), ...buildIceGrandExpanseCheckpointEvents(),
    ...buildIceGrandExpanseSealEvents(), ...buildIceGrandExpanseRewardEvents(), ...buildIceGrandExpanseBossEvents(),
  ];
  gameplay.fieldSpawns = buildIceGrandExpanseFieldSpawns();
  gameplay.safeZones = ICE_GRAND_EXPANSE_SAFE_ZONES.map((zone) => ({ ...zone }));
  gameplay.troopIds = ["troop_slime_pair", "troop_bat_swarm", "troop_golem_guard", "troop_dragon"];
  if (gameplay.layoutPlan !== undefined) gameplay.layoutPlan = {
    ...gameplay.layoutPlan,
    regions: gameplay.layoutPlan.regions.map((region, index) => ({ ...region, label: ICE_GRAND_EXPANSE_REGIONS[index]?.label ?? region.label })),
  };
  return gameplay;
}
