import { FIXED_EVENT_MOVEMENT, iceObjectGraphic, iceUi } from "@/project/defaults/iceGrandExpanseGameplay/eventPrimitives";
import { ICE_GRAND_EXPANSE_SHORTCUT_EVENTS } from "@/project/defaults/iceGrandExpanseGameplay/sealSpecs";
import { ICE_GRAND_EXPANSE_MAP_ID } from "@/project/defaults/iceGrandExpansePlan";
import type { GameEvent } from "@/project/types";

export function buildIceGrandExpanseShortcutEvent(spec: (typeof ICE_GRAND_EXPANSE_SHORTCUT_EVENTS)[number]): GameEvent {
  return {
    id: spec.id, x: spec.x, y: spec.y, trigger: { kind: "action" }, commands: [], pages: [{
      id: `${spec.id}_closed`, name: "빙결 지름길 · 잠김", conditions: [], graphic: iceObjectGraphic(7),
      trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: FIXED_EVENT_MOVEMENT,
      commands: [iceUi("toast", "지름길이 얼어붙어 있다.")],
    }, {
      id: `${spec.id}_open`, name: "빙결 지름길 · 개방",
      conditions: [{ kind: "switch", switchId: spec.unlockSwitchId, value: true }], graphic: { transparent: true },
      trigger: { kind: "action" }, priority: "below", overlapForbidden: false, movement: FIXED_EVENT_MOVEMENT,
      commands: [{ kind: "transfer", mapId: ICE_GRAND_EXPANSE_MAP_ID, x: spec.to.x, y: spec.to.y }],
    }],
  };
}
