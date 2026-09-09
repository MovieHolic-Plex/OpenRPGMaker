import type { M2RuntimeState } from "@/project/sessionRuntimeTypes";

export const SYSTEM_AUDIO_SLOTS = ["field", "battle", "defeat", "escape"] as const;
export type SystemAudioSlot = (typeof SYSTEM_AUDIO_SLOTS)[number];

export function isSystemAudioSlot(value: string): value is SystemAudioSlot {
  return SYSTEM_AUDIO_SLOTS.some((slot) => slot === value);
}

export function systemAudioOverrideKey(slot: SystemAudioSlot): string {
  return `system_audio:${slot}`;
}

/** Empty selection restores the authored project default. Overrides belong to the session. */
export function systemAudioOverride(
  runtime: Pick<M2RuntimeState, "system"> | undefined,
  slot: SystemAudioSlot,
): string | undefined {
  const raw = runtime?.system[systemAudioOverrideKey(slot)];
  return typeof raw === "string" ? raw.trim() || undefined : undefined;
}
