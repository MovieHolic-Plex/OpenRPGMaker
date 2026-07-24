import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPageGraphic } from "@/project/types";

export const FIXED_EVENT_MOVEMENT = { type: "fixed", speed: 3, frequency: 3 } as const;

export function iceObjectGraphic(characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: "tex_easyrpg_charset_object2" },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

export function iceUi(surface: "objectiveChip" | "toast", message: string): Command {
  return { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface, message, durationMs: 1800 } };
}
