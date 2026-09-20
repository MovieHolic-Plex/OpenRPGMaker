// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { getAudioEngine } from '@/player/audio';
import { createPlayerOptionsDetail } from '@/player/playerOptionsDetail';
import { DEFAULT_PLAYER_PREFERENCES, updatePlayerPreferences } from '@/player/playerPreferences';
import { createDialogueUI } from '@/player/dialogue';

afterEach(() => {
  updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES });
  getAudioEngine().stopAll(false);
  vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren();
});
it('initializes the singleton from device preferences and applies options to both mixer groups', () => {
  updatePlayerPreferences({ bgm: 0.3, se: 0.4 });
  const engine = getAudioEngine();
  expect(engine.audioStateSnapshot().volume).toEqual({ bgm: 0.3, se: 0.4 });
  createPlayerOptionsDetail().entries.find(e => e.testId === 'player-option-se-down')!.onActivate!();
  expect(engine.audioStateSnapshot().volume).toEqual({ bgm: 0.3, se: 0.3 });
});
it.each([['normal', 24], ['fast', 12], ['slow', 48]] as const)('dialogue schedules actual characters at %s device speed', (textSpeed, delay) => {
  vi.useFakeTimers();
  updatePlayerPreferences({ textSpeed });
  const timeout = vi.spyOn(window, 'setTimeout');
  const host = document.createElement('div'); document.body.append(host);
  const dialogue = createDialogueUI(host);
  void dialogue.showText({ body: 'ABCDE', playerTileY: 0, mapHeight: 20 }).catch(error => {
    expect(error.name).toBe('AbortError');
  });
  expect(timeout.mock.calls.some(([, milliseconds]) => milliseconds === delay)).toBe(true);
  dialogue.hide();
});
