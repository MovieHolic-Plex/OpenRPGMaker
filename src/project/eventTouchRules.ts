import type { Trigger } from "@/project/types";

export type PlayerCollisionTriggerKind = Extract<Trigger["kind"], "touch" | "playerTouch" | "eventTouch">;

export const PLAYER_COLLISION_TRIGGER_KINDS: readonly PlayerCollisionTriggerKind[] = [
  "touch",
  "playerTouch",
  "eventTouch",
];

export function firesOnPlayerCollision(triggerKind: Trigger["kind"]): boolean {
  return PLAYER_COLLISION_TRIGGER_KINDS.some((kind) => kind === triggerKind);
}
