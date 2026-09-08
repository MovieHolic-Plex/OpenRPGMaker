export const SYSTEM_BGM_CUES = ["battle", "victory"] as const;
export const SYSTEM_SE_CUES = [
  "cursor", "confirm", "cancel", "buzzer", "attack", "damage", "critical",
  "miss", "heal", "faint", "defend", "defeat", "escape",
] as const;

export type SystemBgmCue = typeof SYSTEM_BGM_CUES[number];
export type SystemSeCue = typeof SYSTEM_SE_CUES[number];
export type SystemAudioCueOverride = { readonly resourceId: string; readonly volume: number };
export type SystemAudioOverrides = {
  bgm?: Partial<Record<SystemBgmCue, SystemAudioCueOverride>>;
  se?: Partial<Record<SystemSeCue, SystemAudioCueOverride>>;
};

export function isSystemBgmCue(value: unknown): value is SystemBgmCue {
  return SYSTEM_BGM_CUES.some(cue => cue === value);
}

export function isSystemSeCue(value: unknown): value is SystemSeCue {
  return SYSTEM_SE_CUES.some(cue => cue === value);
}
