import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPageGraphic, GameEvent } from "@/project/types";

export const ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH = "sw_ice_expanse_checkpoint_summit";

export const ICE_GRAND_EXPANSE_CHECKPOINTS = [
  { id: "ev_ice_expanse_checkpoint_entry", x: 64, y: 117, label: "남쪽 원정 기지" },
  { id: "ev_ice_expanse_checkpoint_gate", x: 64, y: 80, label: "중앙 빙문 전초" },
  { id: "ev_ice_expanse_checkpoint_summit", x: 64, y: 25, label: "정상 설원 쉼터" },
] as const;

function crystalGraphic(): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: "tex_easyrpg_charset_object2" },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 }),
  };
}

function checkpointCommands(id: string, label: string): Command[] {
  return [
    { kind: "recoverAll" },
    { kind: "checkpointSave", label },
    ...(id === "ev_ice_expanse_checkpoint_summit"
      ? [{ kind: "setSwitch", switchId: ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH, value: true } satisfies Command]
      : []),
    {
      kind: "m2Command",
      commandId: "m2-214-ui-command",
      fields: { surface: "toast", message: `${label} · 원정 기록 완료`, durationMs: 1800 },
    },
  ];
}

export function buildIceGrandExpanseCheckpointEvents(): GameEvent[] {
  return ICE_GRAND_EXPANSE_CHECKPOINTS.map((checkpoint) => ({
    id: checkpoint.id,
    x: checkpoint.x,
    y: checkpoint.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${checkpoint.id}_active`,
      name: `${checkpoint.label} · 체크포인트`,
      conditions: [],
      graphic: crystalGraphic(),
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      animationType: "step",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: checkpointCommands(checkpoint.id, checkpoint.label),
    }],
  }));
}
