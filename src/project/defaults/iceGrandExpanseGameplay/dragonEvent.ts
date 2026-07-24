import { buildFieldMonsterEvent } from "@/project/fieldMonsterTemplate";
import { ICE_GRAND_EXPANSE_BOSS_EVENT } from "@/project/defaults/iceGrandExpanseGameplay/bossSpecs";
import { iceMonsterGraphic } from "@/project/defaults/iceGrandExpanseGameplay/monsterGraphic";
import type { GameEvent } from "@/project/types";

export function buildIceGrandExpanseDragonEvent(): GameEvent {
  return buildFieldMonsterEvent({
    eventId: ICE_GRAND_EXPANSE_BOSS_EVENT.id,
    troopId: ICE_GRAND_EXPANSE_BOSS_EVENT.troopId,
    clearSwitchId: ICE_GRAND_EXPANSE_BOSS_EVENT.clearSwitchId,
    x: ICE_GRAND_EXPANSE_BOSS_EVENT.x,
    y: ICE_GRAND_EXPANSE_BOSS_EVENT.y,
    graphic: iceMonsterGraphic("tex_easyrpg_charset_monster3", 5),
    fightPageName: "빙하룡 · 결전",
    clearedPageName: "빙하룡 · 격파",
    fightMovement: { type: "fixed", speed: 2, frequency: 3 },
    intro: ["태고 설산의 냉기를 머금은 빙하룡이 포효한다!"],
    victory: ["빙하룡의 포효가 멎고 대원정의 길이 완성되었다."],
    victoryItems: [{ itemId: "item_potion", amount: 3 }],
    canEscape: false,
  });
}
