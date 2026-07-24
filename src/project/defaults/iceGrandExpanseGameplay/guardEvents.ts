import { buildFieldMonsterEvent } from "@/project/fieldMonsterTemplate";
import { ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseGameplay/bossSpecs";
import { iceMonsterGraphic } from "@/project/defaults/iceGrandExpanseGameplay/monsterGraphic";
import type { GameEvent } from "@/project/types";

export function buildIceGrandExpanseGuardEvent(
  guard: (typeof ICE_GRAND_EXPANSE_GUARDS)[number],
  ordinal: number,
): GameEvent {
  return buildFieldMonsterEvent({
    eventId: guard.id, troopId: "troop_golem_guard", clearSwitchId: guard.clearSwitchId,
    x: guard.x, y: guard.y, graphic: iceMonsterGraphic("tex_easyrpg_charset_monster2", 4),
    fightPageName: `정상 수문 골렘 ${ordinal + 1} · 전투`,
    clearedPageName: `정상 수문 골렘 ${ordinal + 1} · 격파`,
    fightMovement: { type: "fixed", speed: 2, frequency: 3 },
    intro: ["서리 수문 골렘이 정상으로 향하는 길을 막아선다!"],
    victory: ["얼음 갑주가 갈라지며 정상으로 가는 길이 열린다!"],
    canEscape: true,
  });
}
