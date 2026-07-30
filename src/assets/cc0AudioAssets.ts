/**
 * Browser-playable CC0 audio.
 * - assets/cc0/audio/*.wav — 자체 생성 절차적 톤(제3자 샘플 없음). 음악이라기보다 자리표시자다.
 * - assets/cc0/audio/bgm/* — OpenGameArt 에서 받은 실제 CC0 곡. 곡마다 sourceName 에 작곡자를 남긴다.
 *   CC0 는 표기 의무가 없지만 ATTRIBUTION.md 와 함께 출처를 남겨 재검증이 가능하게 한다.
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
  // ── 실제 CC0 곡(OpenGameArt) ─────────────────────────────────────────────
  // 장면별로 하나씩: 필드 / 마을 / 실내(여관) / 던전 / 전투.
  // 이게 없으면 맵 BGM 배선(player/mapBgm.ts)이 가리킬 곡이 없어 게임이 여전히 무음이다.
  {
    id: "cc0-bgm-field",
    name: "필드 — The Field Of Dreams (CC0)",
    path: "assets/cc0/audio/bgm/field-of-dreams.mp3",
    kind: "music",
    license: "CC0-1.0",
    sourceName: "pauliuw (OpenGameArt, CC0)",
  },
  {
    id: "cc0-bgm-town",
    name: "마을 — Town Theme (CC0)",
    path: "assets/cc0/audio/bgm/town-theme.mp3",
    kind: "music",
    license: "CC0-1.0",
    sourceName: "cynicmusic / pixelsphere.org (OpenGameArt, CC0)",
  },
  {
    id: "cc0-bgm-inn",
    name: "실내 — The Old Tower Inn (CC0)",
    path: "assets/cc0/audio/bgm/inn-old-tower.mp3",
    kind: "music",
    license: "CC0-1.0",
    sourceName: "RandomMind (OpenGameArt, CC0)",
  },
  {
    id: "cc0-bgm-dungeon",
    name: "던전 — Cave Theme (CC0)",
    path: "assets/cc0/audio/bgm/cave-theme.ogg",
    kind: "music",
    license: "CC0-1.0",
    sourceName: "Brandon Morris / Brandon75689 (OpenGameArt, CC0)",
  },
  {
    id: "cc0-bgm-battle",
    name: "전투 — Battle Theme A (CC0)",
    path: "assets/cc0/audio/bgm/battle-theme-a.mp3",
    kind: "music",
    license: "CC0-1.0",
    sourceName: "cynicmusic / pixelsphere.org (OpenGameArt, CC0)",
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
