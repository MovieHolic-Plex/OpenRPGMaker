/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleDomOptions } from '@/player/battleDom';
import { playBattle } from '@/player/playSceneBattle';
import { startSession } from '@/project/session';
import { bounded, deferred, encounterHarness } from './fixtures/npcEncounterPipeline';

const surfaces = vi.hoisted(() => ({ mount: vi.fn(), transition: vi.fn() }));
vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));
vi.mock('@/player/battleDom', () => ({ mountBattleScene: surfaces.mount }));
vi.mock('@/player/battleTransition', () => ({ createSkinBattleTransition: surfaces.transition }));
vi.mock('@/player/battleAudio', () => ({ enterBattleAudio: () => ({}), exitBattleAudio: vi.fn() }));
let harness: ReturnType<typeof encounterHarness> | undefined;
afterEach(() => { harness?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); surfaces.mount.mockReset(); surfaces.transition.mockReset(); });

describe('real battle result lifetime', () => {
  it.each(['unchanged', 'session', 'map', 'shutdown'] as const)('applies rewards only to the live battle owner: %s', async change => {
    const f = harness = encounterHarness();
    const host = document.createElement('div');
    vi.spyOn(f.scene.game.registry, 'get').mockReturnValue(host);
    const mounted = deferred<BattleDomOptions>(), exit = deferred<void>();
    const destroyed = vi.fn();
    surfaces.mount.mockImplementation((options: BattleDomOptions) => { mounted.resolve(options); return { root: host, destroy: destroyed }; });
    surfaces.transition.mockImplementation(() => ({ cover: async () => undefined, reveal: async () => undefined,
      exit: () => exit.promise, destroy: () => undefined }));
    const done = playBattle(f.scene, { kind: 'battleProcessing', troopId: f.troopId, canEscape: false, canLose: false }, 0);
    const battle = await bounded(mounted.promise);
    const snapshot = battle.runtime.snapshot();
    battle.onResult('victory', { ...snapshot, rewards: { ...snapshot.rewards, gold: 17 } });
    if (change === 'session') f.scene.session = startSession(f.project);
    if (change === 'map') f.scene.map = { ...f.map, id: 'other_map' };
    if (change === 'shutdown') f.scene.events.emit('shutdown');
    exit.resolve();
    expect(await bounded(done)).toBe(change === 'unchanged' ? 'victory' : null);
    expect(f.scene.session.gold).toBe(change === 'unchanged' ? 17 : 0);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });
});
