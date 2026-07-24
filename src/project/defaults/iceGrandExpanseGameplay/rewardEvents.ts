import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPage, EventPageGraphic, GameEvent } from "@/project/types";

export const ICE_GRAND_EXPANSE_REWARDS = [
  { id: "ev_ice_expanse_reward_west", x: 23, y: 58, label: "서쪽 수정 광맥 보급품", amount: 2 },
  { id: "ev_ice_expanse_reward_east", x: 105, y: 64, label: "동쪽 빙결벽 보급품", amount: 2 },
  { id: "ev_ice_expanse_reward_lake", x: 64, y: 49, label: "거울 빙호 보급품", amount: 2 },
  { id: "ev_ice_expanse_reward_summit", x: 64, y: 19, label: "정상 원정 보급품", amount: 3 },
] as const;

const GRAPHIC: EventPageGraphic = {
  sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down",
  pattern: charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 }),
};
const FIXED = { type: "fixed", speed: 3, frequency: 3 } as const;

function toast(message: string): Command {
  return { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "toast", message, durationMs: 1800 } };
}

function rewardEvent(spec: (typeof ICE_GRAND_EXPANSE_REWARDS)[number]): GameEvent {
  const closed: EventPage = {
    id: `${spec.id}_closed`, name: `${spec.label} 미개봉`, conditions: [], graphic: GRAPHIC,
    trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: FIXED,
    commands: [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: spec.amount }, toast(`${spec.label} 획득`), { kind: "setSelfSwitch", key: "A", value: true }],
  };
  const opened: EventPage = {
    id: `${spec.id}_opened`, name: `${spec.label} 개봉 완료`, conditions: [{ kind: "selfSwitch", key: "A", value: true }],
    graphic: GRAPHIC, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: FIXED,
    commands: [{ kind: "text", body: "이미 비어 있는 보급품이다." }],
  };
  return { id: spec.id, x: spec.x, y: spec.y, trigger: { kind: "action" }, commands: [], pages: [closed, opened] };
}

export function buildIceGrandExpanseRewardEvents(): GameEvent[] {
  return ICE_GRAND_EXPANSE_REWARDS.map(rewardEvent);
}
