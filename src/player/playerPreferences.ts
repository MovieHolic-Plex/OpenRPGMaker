/** Device preferences deliberately live outside project/session/save codecs. */
import { isTouchStickMode, type TouchStickMode } from '@/project/touchControls';
import { DIALOGUE_SPEEDS, SKIP_SCOPES, WINDOW_OPACITY_MAX, WINDOW_OPACITY_MIN, type AuthoredDialogueSystem, type DialogueSpeed, type SkipScope } from '@/project/dialogueSystem';
export const PLAYER_PREFERENCES_KEY = 'oprn:player-preferences:v1';
export type PlayerPreferences = {
  bgm: number;
  se: number;
  /** 대사 글자 소리(목소리) 음량. 효과음과 따로 줄일 수 있게 분리했다. */
  voice: number;
  textSpeed: 'slow' | 'normal' | 'fast';
  reduceMenuMotion: boolean;
  /** 필드 메뉴 「대기 ON/OFF」: 플레이어가 고른 ATB 방식. 생략하면 게임 저작 값(system.atbMode, 기본 wait)을 따른다. */
  atbMode?: 'wait' | 'active';
  /** 오토 넘김 속도. 생략 = 게임 저작 값(meta.oprnDialogueSystem.defaults.autoSpeed, 기본 보통). */
  autoSpeed?: DialogueSpeed;
  /** 스킵 범위(읽은 글만/전부). 생략 = 게임 저작 값(기본 읽은 글만). */
  skipScope?: SkipScope;
  /** 대사창 투명도(0.4~1). 생략 = 게임 저작 값(기본 1 = 현행 그대로). */
  windowOpacity?: number;
  /** 항상 달리기(RPG Maker MZ 「항상 대시」). 달리기 키(Shift)·터치 달리기 단추는 이 값을 뒤집는다. */
  alwaysRun?: boolean;
  /** 터치: 맵을 탭해 걷기. 생략 = 게임 저작 값(system.touchControls.tapToMove, 기본 켬). */
  touchTapToMove?: boolean;
  /** 터치: 조이스틱 방식. 생략 = 게임 저작 값(기본 auto). */
  touchStick?: TouchStickMode;
  /** 터치: 진동. 생략 = 게임 저작 값(기본 켬). */
  touchHaptics?: boolean;
  /** 플레이어가 대사 속도를 직접 골랐다. 이게 없으면 게임 저작 값이 시작값이다(textSpeed 는 늘 값이 있어 따로 표시한다). */
  textSpeedChosen?: true;
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
    ...(input.atbMode === 'wait' || input.atbMode === 'active' ? { atbMode: input.atbMode } : {}),
    ...(DIALOGUE_SPEEDS.includes(input.autoSpeed as DialogueSpeed) ? { autoSpeed: input.autoSpeed as DialogueSpeed } : {}),
    ...(SKIP_SCOPES.includes(input.skipScope as SkipScope) ? { skipScope: input.skipScope as SkipScope } : {}),
    ...(typeof input.windowOpacity === 'number' && Number.isFinite(input.windowOpacity)
      ? { windowOpacity: Math.round(Math.max(WINDOW_OPACITY_MIN, Math.min(WINDOW_OPACITY_MAX, input.windowOpacity)) * 100) / 100 } : {}),
    ...(input.alwaysRun === true ? { alwaysRun: true } : {}),
    ...(typeof input.touchTapToMove === 'boolean' ? { touchTapToMove: input.touchTapToMove } : {}),
    ...(isTouchStickMode(input.touchStick) ? { touchStick: input.touchStick } : {}),
    ...(typeof input.touchHaptics === 'boolean' ? { touchHaptics: input.touchHaptics } : {}),
    // 표식이 없던 예전 저장본(이 필드가 생기기 전)에서 보통이 아닌 속도는 플레이어가 직접 고른 값이다 — 한 번 승격해 연애 게임의 저작 시작값에 덮이지 않게 한다.
    ...(input.textSpeedChosen === true || input.textSpeed === 'slow' || input.textSpeed === 'fast' ? { textSpeedChosen: true as const } : {}),
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
/** 매 프레임 읽는다 — 복사본을 만들지 않는다. */
export function playerAlwaysRun(): boolean {
  return (current ??= readPlayerPreferences()).alwaysRun === true;
}
export function updatePlayerPreferences(patch: Partial<PlayerPreferences>, storage = deviceStorage()): boolean {
  // textSpeed 를 주면 플레이어가 직접 고른 것이다(게임 저작 시작값보다 우선). 호출자가 textSpeedChosen 을 직접 주면(초기화 등) 그 값을 따른다.
  current = normalizePlayerPreferences({ ...getPlayerPreferences(), ...patch, ...(patch.textSpeed !== undefined && !('textSpeedChosen' in patch) ? { textSpeedChosen: true } : {}) });
  // 같은 창의 다른 UI(터치 달리기 단추 등)가 바뀐 값을 바로 그리게 알린다.
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oprn:player-preferences')); } catch { /* 이벤트 없음 */ }
  try {
    if (!storage) return false;
    storage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify(current));
    return true;
  } catch { return false; }
}
/** 지금 실행 중인 게임이 저작한 시작값. 대사창·설정 화면이 프로젝트를 읽을 때마다 맞춘다(없으면 undefined = 옛 동작). */
let authoredDefaults: AuthoredDialogueSystem['defaults'] | undefined;
export function setAuthoredPreferenceDefaults(defaults: AuthoredDialogueSystem['defaults'] | undefined): void {
  authoredDefaults = defaults;
}
export type EffectiveReadingPreferences = { textSpeed: DialogueSpeed; autoSpeed: DialogueSpeed; skipScope: SkipScope; windowOpacity: number };
/** 기기 설정 > 게임 저작 시작값 > 기본값 순으로 합친 읽기 설정. */
export function getEffectiveReadingPreferences(
  defaults: AuthoredDialogueSystem['defaults'] | undefined = authoredDefaults,
  prefs: PlayerPreferences = getPlayerPreferences(),
): EffectiveReadingPreferences {
  return {
    textSpeed: prefs.textSpeedChosen === true ? prefs.textSpeed : (defaults?.textSpeed ?? prefs.textSpeed),
    autoSpeed: prefs.autoSpeed ?? defaults?.autoSpeed ?? 'normal',
    skipScope: prefs.skipScope ?? defaults?.skipScope ?? 'read',
    windowOpacity: prefs.windowOpacity ?? defaults?.windowOpacity ?? 1,
  };
}
export function playerTextDelay(delayMs: number, speed: DialogueSpeed = getEffectiveReadingPreferences().textSpeed): number {
  return delayMs * (speed === 'slow' ? 2 : speed === 'fast' ? 0.5 : 1);
}
