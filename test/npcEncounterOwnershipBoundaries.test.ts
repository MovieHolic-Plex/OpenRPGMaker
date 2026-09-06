/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginCutsceneControl } from '@/player/cutsceneControl';
import { foregroundOwner } from '@/player/foregroundControl';
import { resetMapRuntime } from '@/player/playSceneMapRuntime';
import { updateParallelEvents } from '@/player/playSceneSchedulers';
import { dialogueUi } from '@/player/playSceneDom';
import { startSession } from '@/project/session';
import { bounded, deferred, encounterHarness, nextLeaseRelease, npcPage, required, saveReload } from './fixtures/npcEncounterPipeline';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));
let harness: ReturnType<typeof encounterHarness> | undefined;
afterEach(() => { harness?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const setup = () => (harness = encounterHarness());

describe('encounter command ownership boundaries', () => {
  it.each([false, true])('cancels an awaiting trainer list after an unrelated map replacement (same ID=%s)', async sameId => {
    const f = setup();
    const shown = deferred<void>(), answer = deferred<void>();
    vi.spyOn(required(dialogueUi(f.scene)), 'showText').mockImplementation(() => {
      shown.resolve(); return answer.promise;
    });
    f.page.commands = [{ kind: 'text', body: 'Deferred dialogue' },
      { kind: 'setFlag', flag: 'staleTrainerMutation', value: true }];
    await f.frames(120); await bounded(shown.promise);
    const released = nextLeaseRelease(required(foregroundOwner(f.scene)));
    const replacement = { ...structuredClone(f.map), id: sameId ? f.map.id : 'external_replacement', events: [] };
    f.project.maps[replacement.id] = replacement;
    f.scene.map = replacement; f.scene.session.currentMapId = replacement.id;
    resetMapRuntime(f.scene);
    await f.frame();
    answer.resolve(); await bounded(released);
    expect(f.scene.session.flags.staleTrainerMutation).not.toBe(true);
    expect(f.scene.session.detectionEncounterCompletions?.trainer?.trainer_page).not.toBe(true);
  });

  it.each(['selfSwitch', 'transfer', 'sameMapTransfer'] as const)('finishes an admitted command list and records completion after authored %s', async kind => {
    const f = setup();
    const destination = kind === 'sameMapTransfer' ? f.map : { ...structuredClone(f.map), id: 'after_transfer', events: [] };
    f.project.maps[destination.id] = destination;
    const second = npcPage('after_switch'); second.conditions = [{ kind: 'selfSwitch', key: 'A', value: true }];
    f.event.pages?.push(second);
    f.page.commands = [kind === 'selfSwitch' ? { kind: 'setSelfSwitch', key: 'A', value: true }
      : { kind: 'transfer', mapId: destination.id, x: 5, y: 5, fade: 'none' },
      { kind: 'text', body: 'Continue this admitted command list.' },
      { kind: 'setFlag', flag: 'afterAuthoredTransition', value: true }];
    // Keep the actual transfer/landing and map-reset seams; only map rendering/camera are adapters.
    f.scene.loadMap = mapId => {
      f.scene.map = structuredClone(required(f.project.maps[mapId]));
      f.scene.session.currentMapId = mapId; resetMapRuntime(f.scene); f.scene.registerPageMoveRoutes();
    };
    f.scene.centerCamera = () => undefined;
    const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
    await f.frames(120); await bounded(released);
    expect(f.scene.session.flags.afterAuthoredTransition).toBe(true);
    expect(f.scene.session.detectionEncounterCompletions?.trainer?.trainer_page).toBe(true);
    if (kind !== 'selfSwitch') expect(f.scene.session.currentMapId).toBe(destination.id);
    else expect(f.scene.session.selfSwitches?.trainer?.A).toBe(true);
    expect(f.battle).not.toHaveBeenCalled();
  });

  it.each(['cutscene', 'commandRoute'] as const)('does not seize an existing %s owner even when scene.running is false', async kind => {
    const f = setup();
    if (kind === 'cutscene') beginCutsceneControl(f.scene.session, 'director', false);
    else {
      f.scene.registerAutonomousMover('trainer', [{ kind: 'move', dir: 'left' }], false);
      f.scene.commandMoveRouteEventIds.add('trainer');
    }
    const route = f.scene.autonomousNPCs.get('trainer');
    await f.frame();
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
    expect(foregroundOwner(f.scene)).toBeUndefined(); expect(f.battle).not.toHaveBeenCalled();
    if (kind === 'commandRoute') expect(f.scene.autonomousNPCs.get('trainer')).toBe(route);
  });

  it.each(['session', 'map'] as const)('never restores input into a replacement %s after the complete scheduled finally', async kind => {
    const f = harness = encounterHarness('parallel'); updateParallelEvents(f.scene, 0);
    const lease = required(foregroundOwner(f.scene));
    if (kind === 'session') f.scene.session = startSession(f.project);
    else f.scene.map = { ...structuredClone(f.map), id: 'new_context', events: [] };
    f.scene.running = true; f.scene.inputEnabled = false; f.scene.session.battleResult = 'escape';
    const settled = nextLeaseRelease(lease);
    f.battleResult.resolve('victory'); await bounded(settled);
    expect(f.scene.running).toBe(true); expect(f.scene.inputEnabled).toBe(false);
    expect(f.scene.session.battleResult).toBe('escape');
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
  });

  it.each([
    { eventId: 'constructor', pageId: 'prototype', existing: false },
    { eventId: 'constructor', pageId: 'prototype', existing: true },
    { eventId: '__proto__', pageId: 'toString', existing: true },
  ])('records valid IDs $eventId/$pageId with existing receipts=$existing', async ({ eventId, pageId, existing }) => {
    const f = setup(); f.event.id = eventId; f.page.id = pageId;
    f.page.commands = [{ kind: 'setFlag', flag: 'idEncounterRan', value: true }];
    // Own runtime location entries isolate the new receipt contract from unrelated legacy dictionaries.
    f.scene.session.eventLocations = { [eventId]: { mapId: f.map.id, x: 2, y: 2 } };
    f.scene.eventPositions = { [eventId]: { x: 2, y: 2 } };
    if (existing) f.scene.session.detectionEncounterCompletions = {};
    const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
    await f.frames(120); await bounded(released);
    expect(f.scene.session.flags.idEncounterRan).toBe(true);
    const restored = saveReload(f.project, f.scene.session);
    const receipts = required(restored.detectionEncounterCompletions);
    expect(Object.hasOwn(receipts, eventId)).toBe(true);
    expect(Object.hasOwn(receipts[eventId], pageId)).toBe(true);
    expect(receipts[eventId]?.[pageId]).toBe(true);
    expect(Object.hasOwn(Object.prototype, 'toString')).toBe(true);
  });
});
