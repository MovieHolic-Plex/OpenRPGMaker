/**
 * Browser-playable CC0 audio stubs for field BGM / UI SE.
 * Files: public/assets/cc0/audio/*.wav (generated procedural tones; no third-party sample).
 */
export type Cc0AudioAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly kind: "music" | "sound";
  readonly license: "CC0-1.0";
  readonly sourceName: string;
};

const SOURCE_NAME = "RPG ZZU generated CC0 tones";

export const CC0_AUDIO_ASSETS = [
  {
    id: "cc0-music-field-loop",
    name: "Field Loop (CC0)",
    path: "assets/cc0/audio/field-loop.wav",
    kind: "music",
    license: "CC0-1.0",
    sourceName: SOURCE_NAME,
  },
  {
    id: "cc0-sound-ui-confirm",
    name: "UI Confirm (CC0)",
    path: "assets/cc0/audio/ui-confirm.wav",
    kind: "sound",
    license: "CC0-1.0",
    sourceName: SOURCE_NAME,
  },
] as const satisfies readonly Cc0AudioAsset[];

export const CC0_MUSIC_ASSETS = CC0_AUDIO_ASSETS.filter((asset) => asset.kind === "music");
export const CC0_SOUND_ASSETS = CC0_AUDIO_ASSETS.filter((asset) => asset.kind === "sound");

export function resolveCc0AudioAssetUrl(resourceId: string): string | null {
  const asset = CC0_AUDIO_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** True when the packaged file is expected to play in HTMLAudioElement (wav/ogg/mp3). */
export function isBrowserPlayableAudioPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".mp3") || lower.endsWith(".m4a");
}
