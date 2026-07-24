import { FIXED_EVENT_MOVEMENT, iceObjectGraphic, iceUi } from "@/project/defaults/iceGrandExpanseGameplay/eventPrimitives";
import { ICE_GRAND_EXPANSE_GATE, ICE_GRAND_EXPANSE_SEAL_SWITCHES } from "@/project/defaults/iceGrandExpanseGameplay/sealSpecs";
import type { EventPage, GameEvent } from "@/project/types";

function closedGatePage(id: string, conditions: EventPage["conditions"], progress: "0/2" | "1/2"): EventPage {
  return {
    id, name: `중앙 빙문 · ${progress}`, conditions, graphic: iceObjectGraphic(7), trigger: { kind: "action" },
    priority: "same", overlapForbidden: true, movement: FIXED_EVENT_MOVEMENT,
    commands: [iceUi("objectiveChip", `서리 인장 ${progress}`)],
  };
}

export function buildIceGrandExpanseGateEvent(): GameEvent {
  return {
    ...ICE_GRAND_EXPANSE_GATE, trigger: { kind: "action" }, commands: [], pages: [
      closedGatePage(`${ICE_GRAND_EXPANSE_GATE.id}_closed_0`, [], "0/2"),
      closedGatePage(`${ICE_GRAND_EXPANSE_GATE.id}_closed_west`, [{ kind: "switch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.west, value: true }], "1/2"),
      closedGatePage(`${ICE_GRAND_EXPANSE_GATE.id}_closed_east`, [{ kind: "switch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.east, value: true }], "1/2"),
      {
        id: `${ICE_GRAND_EXPANSE_GATE.id}_open`, name: "중앙 빙문 · 개방",
        conditions: [{ kind: "switch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate, value: true }],
        graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
        overlapForbidden: false, movement: FIXED_EVENT_MOVEMENT, commands: [],
      },
    ],
  };
}
