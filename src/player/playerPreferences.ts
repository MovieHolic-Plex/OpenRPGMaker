/** Device preferences deliberately live outside project/session/save codecs. */
export const PLAYER_PREFERENCES_KEY = 'oprn:player-preferences:v1';
export type PlayerPreferences = {
  bgm: number;
  se: number;
  /** 대사 글자 소리(목소리) 음량. 효과음과 따로 줄일 수 있게 분리했다. */
  voice: number;
  textSpeed: 'slow' | 'normal' | 'fast';
  reduceMenuMotion: boolean;
};
export const DEFAULT_PLAYER_PREFERENCES: Readonly<PlayerPreferences> = {
  bgm: 0.7, se: 0.8, voice: 0.8, textSpeed: 'normal', reduceMenuMotion: false,
};
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function normalizePlayerPreferences(value: unknown): PlayerPreferences {
  const input = value && typeof value === 'object' ? value as Partial<PlayerPreferences> : {};
  const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(1, v)) : fallback;
  return {
    bgm: volume(input.bgm, 0.7), se: volume(input.se, 0.8), voice: volume(input.voice, 0.8),
    textSpeed: input.textSpeed === 'slow' || input.textSpeed === 'fast' ? input.textSpeed : 'normal',
    reduceMenuMotion: input.reduceMenuMotion === true,
  };
}
function deviceStorage(): PreferenceStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
export function readPlayerPreferences(storage = deviceStorage()): PlayerPreferences {
  try { return normalizePlayerPreferences(JSON.parse(storage?.getItem(PLAYER_PREFERENCES_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_PLAYER_PREFERENCES }; }
}
let current: PlayerPreferences | undefined;
export function getPlayerPreferences(): PlayerPreferences {
  return { ...(current ??= readPlayerPreferences()) };
}
export function updatePlayerPreferences(patch: Partial<PlayerPreferences>, storage = deviceStorage()): boolean {
  current = normalizePlayerPreferences({ ...getPlayerPreferences(), ...patch });
  try {
    if (!storage) return false;
    storage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify(current));
    return true;
  } catch { return false; }
}
export function playerTextDelay(delayMs: number, speed = getPlayerPreferences().textSpeed): number {
  return delayMs * (speed === 'slow' ? 2 : speed === 'fast' ? 0.5 : 1);
}
