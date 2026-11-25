import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYER_PREFERENCES, PLAYER_PREFERENCES_KEY, getPlayerPreferences, normalizePlayerPreferences, playerTextDelay, readPlayerPreferences, updatePlayerPreferences } from '@/player/playerPreferences';
import { createPlayerOptionsDetail, projectUsesDialogueVoice } from '@/player/playerOptionsDetail';
import { createBlankProject } from '@/project/defaults';
const mixer = vi.hoisted(() => ({ setVolume: vi.fn() }));
vi.mock('@/player/audio', () => ({ getAudioEngine: () => mixer }));

beforeEach(() => { updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES }); mixer.setVolume.mockClear(); });
describe('device player preferences', () => {
  it('sanitizes malformed storage and finite volume bounds', () => {
    expect(readPlayerPreferences({ getItem: () => '{', setItem() {} })).toEqual(DEFAULT_PLAYER_PREFERENCES);
    expect(normalizePlayerPreferences({ bgm: -1, se: 5, textSpeed: 'instant', reduceMenuMotion: 'yes' }))
      .toEqual({ bgm: 0, se: 1, voice: 0.8, textSpeed: 'normal', reduceMenuMotion: false });
    expect(normalizePlayerPreferences({ bgm: NaN, se: Infinity })).toEqual(DEFAULT_PLAYER_PREFERENCES);
  });
  it('roundtrips only preferences under a dedicated key', () => {
    const records = new Map([['save-slot-1', 'untouched']]);
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
    expect(updatePlayerPreferences({ bgm: 0, textSpeed: 'fast' }, storage)).toBe(true);
    expect(readPlayerPreferences(storage)).toEqual({ ...DEFAULT_PLAYER_PREFERENCES, bgm: 0, textSpeed: 'fast', textSpeedChosen: true });
    expect([...records.keys()]).toEqual(['save-slot-1', PLAYER_PREFERENCES_KEY]);
    expect(records.get('save-slot-1')).toBe('untouched');
  });
  it('keeps current-session choices when storage refuses writes', () => {
    expect(updatePlayerPreferences({ se: 0 }, { getItem: () => null, setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(getPlayerPreferences().se).toBe(0);
  });
  it('options activation updates the actual mixer groups and refreshes the screen', () => {
    const changed = vi.fn();
    createPlayerOptionsDetail(changed).entries.find(e => e.testId === 'player-option-bgm')!.onAdjust!(-1);
    expect(mixer.setVolume).toHaveBeenCalledWith('bgm', 0.6);
    expect(mixer.setVolume).toHaveBeenCalledWith('se', 0.8);
    expect(changed).toHaveBeenCalledOnce();
    createPlayerOptionsDetail().entries.find(e => e.testId === 'player-option-text-speed')!.onActivate!();
    expect(playerTextDelay(24)).toBe(12);
    expect(playerTextDelay(80, 'slow')).toBe(160);
  });
  // 2026-11-14 QA minor 6: 음량 하나가 「줄이기」「늘리기」 두 줄이었고, 목소리 없는 게임에도 「대사 목소리」 음량이 있었다.
  it('each volume is one row adjusted left and right, clamped at 0% and 100%', () => {
    const row = (id: string) => createPlayerOptionsDetail().entries.find(e => e.testId === id)!;
    expect(createPlayerOptionsDetail().entries.filter(e => e.onAdjust).map(e => e.testId)).toEqual(['player-option-bgm', 'player-option-se']);
    expect(row('player-option-bgm').value).toBe('◀ 70% ▶');
    row('player-option-bgm').onAdjust!(1);
    expect(getPlayerPreferences().bgm).toBe(0.8);
    for (let i = 0; i < 5; i += 1) row('player-option-bgm').onAdjust!(1);
    expect(getPlayerPreferences().bgm).toBe(1);
    for (let i = 0; i < 12; i += 1) row('player-option-bgm').onAdjust!(-1);
    expect(getPlayerPreferences().bgm).toBe(0);
    // 확인 키와 누르기는 올리기 — 100% 다음은 0% 로 돌아가 좌우 키 없이도(터치) 모든 값에 닿는다.
    updatePlayerPreferences({ se: 1 });
    row('player-option-se').onActivate!();
    expect(getPlayerPreferences().se).toBe(0);
    row('player-option-se').onActivate!();
    expect(getPlayerPreferences().se).toBe(0.1);
  });
  it('shows the dialogue voice volume only when the game has a dialogue voice', () => {
    const ids = (project: ReturnType<typeof createBlankProject>) => createPlayerOptionsDetail(undefined, project).entries.map(e => e.testId);
    const silent = createBlankProject();
    expect(projectUsesDialogueVoice(silent)).toBe(false);
    expect(ids(silent)).not.toContain('player-option-voice');
    const styled = createBlankProject();
    styled.system.dialogueStyle = 'pixel-cinematic';
    expect(ids(styled)).toContain('player-option-voice');
    const recorded = createBlankProject();
    recorded.maps[recorded.startMapId]!.events.push({
      id: 'ev_voice', name: '목소리', x: 1, y: 1,
      pages: [{ id: 'p1', name: 'p1', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' }, priority: 'same',
        movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: '안녕.', voiceResourceId: 'voice_hello' }] }],
    } as never);
    expect(projectUsesDialogueVoice(recorded)).toBe(true);
    const speaker = createBlankProject();
    speaker.characters = { hero: { displayName: '카엘', dialogue: { voice: 'blip' } } } as never;
    expect(projectUsesDialogueVoice(speaker)).toBe(true);
  });
});
