import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "@/project/defaults/iceGrandExpanseGameplay/fieldSpawnSpecs";
import type { IceGrandExpanseFieldSpawnSpec } from "@/project/defaults/iceGrandExpanseGameplay/fieldSpawnSpecs";
import type { EventPageGraphic, FieldSpawnDef } from "@/project/types";

function graphic(spec: IceGrandExpanseFieldSpawnSpec): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spec.textureKey }, direction: "down",
    pattern: charsetFrameIndex({ characterIndex: spec.characterIndex, direction: "down", pattern: 1 }),
  };
}

export function buildIceGrandExpanseFieldSpawns(): FieldSpawnDef[] {
  return ICE_GRAND_EXPANSE_FIELD_SPAWNS.map((spec) => ({
    id: spec.id, troopId: spec.troopId, area: { x: spec.x, y: spec.y, w: 1, h: 1 },
    maxAlive: 1, graphic: graphic(spec), chase: spec.chase, persistKill: true,
  }));
}
