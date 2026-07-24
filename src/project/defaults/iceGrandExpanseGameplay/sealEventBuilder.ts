import { buildIceGrandExpanseGateEvent } from "@/project/defaults/iceGrandExpanseGameplay/gateEvent";
import { buildSealActivationEvent } from "@/project/defaults/iceGrandExpanseGameplay/sealActivationEvents";
import { ICE_GRAND_EXPANSE_SEALS, ICE_GRAND_EXPANSE_SHORTCUT_EVENTS } from "@/project/defaults/iceGrandExpanseGameplay/sealSpecs";
import { buildIceGrandExpanseShortcutEvent } from "@/project/defaults/iceGrandExpanseGameplay/shortcutEvents";
import type { GameEvent } from "@/project/types";

export function buildIceGrandExpanseSealEvents(): GameEvent[] {
  return [
    ...ICE_GRAND_EXPANSE_SEALS.map(buildSealActivationEvent),
    buildIceGrandExpanseGateEvent(),
    ...ICE_GRAND_EXPANSE_SHORTCUT_EVENTS.map(buildIceGrandExpanseShortcutEvent),
  ];
}
