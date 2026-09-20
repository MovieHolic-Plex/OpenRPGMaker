import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYER_PREFERENCES, PLAYER_PREFERENCES_KEY, getPlayerPreferences, normalizePlayerPreferences, playerTextDelay, readPlayerPreferences, updatePlayerPreferences } from '@/player/playerPreferences';
import { createPlayerOptionsDetail } from '@/player/playerOptionsDetail';
const mixer = vi.hoisted(() => ({ setVolume: vi.fn() }));
vi.mock('@/player/audio', () => ({ getAudioEngine: () => mixer }));

beforeEach(() => { updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES }); mixer.setVolume.mockClear(); });
describe('device player preferences', () => {
  it('sanitizes malformed storage and finite volume bounds', () => {
    expect(readPlayerPreferences({ getItem: () => '{', setItem() {} })).toEqual(DEFAULT_PLAYER_PREFERENCES);
    expect(normalizePlayerPreferences({ bgm: -1, se: 5, textSpeed: 'instant', reduceMenuMotion: 'yes' }))
      .toEqual({ bgm: 0, se: 1, textSpeed: 'normal', reduceMenuMotion: false });
    expect(normalizePlayerPreferences({ bgm: NaN, se: Infinity })).toEqual(DEFAULT_PLAYER_PREFERENCES);
  });
  it('roundtrips only preferences under a dedicated key', () => {
    const records = new Map([['save-slot-1', 'untouched']]);
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
    expect(updatePlayerPreferences({ bgm: 0, textSpeed: 'fast' }, storage)).toBe(true);
    expect(readPlayerPreferences(storage)).toEqual({ ...DEFAULT_PLAYER_PREFERENCES, bgm: 0, textSpeed: 'fast' });
    expect([...records.keys()]).toEqual(['save-slot-1', PLAYER_PREFERENCES_KEY]);
    expect(records.get('save-slot-1')).toBe('untouched');
  });
  it('keeps current-session choices when storage refuses writes', () => {
    expect(updatePlayerPreferences({ se: 0 }, { getItem: () => null, setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(getPlayerPreferences().se).toBe(0);
  });
  it('options activation updates the actual mixer groups and refreshes the screen', () => {
    const changed = vi.fn();
    createPlayerOptionsDetail(changed).entries.find(e => e.testId === 'player-option-bgm-down')!.onActivate!();
    expect(mixer.setVolume).toHaveBeenCalledWith('bgm', 0.6);
    expect(mixer.setVolume).toHaveBeenCalledWith('se', 0.8);
    expect(changed).toHaveBeenCalledOnce();
    createPlayerOptionsDetail().entries.find(e => e.testId === 'player-option-text-speed')!.onActivate!();
    expect(playerTextDelay(24)).toBe(12);
    expect(playerTextDelay(80, 'slow')).toBe(160);
  });
});
