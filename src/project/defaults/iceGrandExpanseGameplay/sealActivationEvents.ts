import { FIXED_EVENT_MOVEMENT, iceObjectGraphic, iceUi } from "@/project/defaults/iceGrandExpanseGameplay/eventPrimitives";
import { ICE_GRAND_EXPANSE_SEALS, ICE_GRAND_EXPANSE_SEAL_SWITCHES } from "@/project/defaults/iceGrandExpanseGameplay/sealSpecs";
import type { Command, EventPage, GameEvent } from "@/project/types";

function quest(progress: "1/2" | "2/2"): Command {
  return {
    kind: "m2Command", commandId: "m2-208-quest-objective",
    fields: { questId: "ice-expanse-seals", objectiveId: "activate-seals", state: progress === "2/2" ? "complete" : "progress", text: `서리 인장 ${progress}` },
  };
}

function sealCommands(side: "west" | "east", otherSide: "west" | "east"): Command[] {
  return [{ kind: "setSwitch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES[side], value: true }, {
    kind: "fork", condition: { kind: "switch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES[otherSide], value: true },
    then: [{ kind: "setSwitch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate, value: true }, quest("2/2"), iceUi("objectiveChip", "서리 인장 2/2")],
    else: [quest("1/2"), iceUi("objectiveChip", "서리 인장 1/2")],
  }];
}

export function buildSealActivationEvent(spec: (typeof ICE_GRAND_EXPANSE_SEALS)[number]): GameEvent {
  const pages: EventPage[] = [{
    id: `${spec.id}_sealed`, name: `${spec.label} · 비활성`, conditions: [], graphic: iceObjectGraphic(5),
    trigger: { kind: "action" }, priority: "same", overlapForbidden: true, animationType: "step", movement: FIXED_EVENT_MOVEMENT,
    commands: sealCommands(spec.side, spec.otherSide),
  }, {
    id: `${spec.id}_active`, name: `${spec.label} · 활성`, conditions: [{ kind: "switch", switchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES[spec.side], value: true }],
    graphic: iceObjectGraphic(5), trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
    animationType: "step", movement: FIXED_EVENT_MOVEMENT, commands: [{ kind: "text", body: `${spec.label}이 푸르게 빛난다.` }],
  }];
  return { id: spec.id, x: spec.x, y: spec.y, trigger: { kind: "action" }, commands: [], pages };
}
