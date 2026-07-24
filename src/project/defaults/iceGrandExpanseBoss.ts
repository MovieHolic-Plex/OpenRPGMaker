import { buildIceGrandExpanseDragonEvent } from "@/project/defaults/iceGrandExpanseGameplay/dragonEvent";
import { buildIceGrandExpanseGuardEvent } from "@/project/defaults/iceGrandExpanseGameplay/guardEvents";
import { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseGameplay/bossSpecs";
import type { GameEvent } from "@/project/types";

export { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS };

export function buildIceGrandExpanseBossEvents(): GameEvent[] {
  return [...ICE_GRAND_EXPANSE_GUARDS.map(buildIceGrandExpanseGuardEvent), buildIceGrandExpanseDragonEvent()];
}
