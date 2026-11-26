// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { seesPlayer } from "@/player/horrorRuntime";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { createSaveSnapshot, readSaveSlot } from "@/player/saveSlots";
import { encounterHarness, required, saveReload, bounded, deferred, nextLeaseRelease, npcPage } from "./fixtures/npcEncounterPipeline";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { foregroundOwner, claimForeground } from "@/player/foregroundControl";
import { resetMapRuntime } from "@/player/playSceneMapRuntime";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { dialogueUi } from "@/player/playSceneDom";
import { startSession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";
import { describeSceneEmotes } from "@/player/playSceneEmotes";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));

describe("npcEncounter", () => {
  isolateTimers();
  describe("npcEncounterBoundaries", () => {
    isolateTimers();
    let harness: ReturnType<typeof encounterHarness> | undefined;
    afterEach(() => { harness?.dispose(); vi.unstubAllGlobals(); });
    const setup = () => (harness = encounterHarness());
    describe('encounter sensing and completion boundaries', () => {
      it.each(['corner', 'spatial', 'runtimeFacing'] as const)('respects %s instead of the legacy sight approximation', kind => {
        const f = setup(); f.page.movement.sight = { range: 8, lineOfSight: true, facing: 'any' };
        if (f.page.detectionEncounter) delete f.page.detectionEncounter;
        if (kind === 'corner') { f.scene.session.x = 3; f.scene.session.y = 3; f.map.lowerTiles[23] = 1; }
        if (kind === 'runtimeFacing') {
          f.page.movement.sight.facing = 'forward'; f.scene.eventPositions.trainer = { x: 2, y: 2, direction: 'up' };
        }
        if (kind === 'spatial') {
          f.project.database.homeDecorationTypes = [{ id: 'screen', name: 'Screen', placementItemId: '',
            footprint: { width: 1, height: 1 }, blocksMovement: true, allowedOrientations: ['down'], graphicResourceId: '' }];
          f.scene.session.homeDecorationPlacements = { screen: { instanceId: 'screen', typeId: 'screen', mapId: f.map.id, x: 2, y: 3, orientation: 'down' } };
        }
        const view = required(runtimeEventViewsForMap(f.project, f.map, f.scene.session, f.scene.eventPositions)[0]);
        expect(seesPlayer({ project: f.project, map: f.map, session: f.scene.session, positions: f.scene.eventPositions }, view)).toBe(false);
      });
      it('retains per-event/page completion through the actual save-slot boundary', () => {
        const f = setup(); const completions = { trainer: { trainer_page: true } };
        Object.assign(f.scene.session, { detectionEncounterCompletions: completions });
        expect(saveReload(f.project, f.scene.session)).toMatchObject({ detectionEncounterCompletions: completions });
      });

      it.each([false, 1, null])('rejects an invalid completion receipt %s', value => {
        const f = setup(); Object.assign(f.scene.session, { detectionEncounterCompletions: { trainer: { trainer_page: value } } });
        const json = JSON.stringify(createSaveSnapshot(f.project, f.scene.session));
        const storage: Storage = { length: 1, key: () => null, getItem: () => json,
          clear: () => undefined, removeItem: () => undefined, setItem: () => undefined };
        expect(readSaveSlot(storage, 1).kind).toBe('corrupt');
      });
    });
  });
  describe("npcEncounterOwnershipBoundaries", () => {
    isolateTimers();
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
  });
});

describe("playerSuite5", () => {
  isolateTimers();
  describe("npcTrainerEncounter", () => {
    isolateTimers();
    let harness: ReturnType<typeof encounterHarness> | undefined;
    const setup = () => (harness = encounterHarness());
    afterEach(() => { harness?.dispose(); harness = undefined; vi.unstubAllGlobals(); });
    describe('explicit NPC sensing and detection encounters', () => {
      it('remembers a manually completed trainer page before automatic detection can repeat it', async () => {
        const f = setup();
        f.scene.tileY = 3; f.scene.session.y = 3;
        const manual = f.scene.runEvent('trainer');
        expect(f.battle).toHaveBeenCalledTimes(1);
        f.battleResult.resolve('victory');
        await bounded(manual);
        expect(f.scene.session.detectionEncounterCompletions?.trainer?.[f.page.id]).toBe(true);
        f.scene.session = saveReload(f.project, f.scene.session);
        await f.frames(120);
        expect(f.battle).toHaveBeenCalledTimes(1);
      });

      it.each(['behind', 'wall'] as const)('does not claim foreground for a player obscured by %s in real updates', async obstacle => {
        const f = setup();
        if (obstacle === 'behind') { f.scene.session.y = 1; f.scene.tileY = 1; }
        else f.map.lowerTiles[32] = 1;
        await f.frames(2);
        expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
        expect(f.battle).not.toHaveBeenCalled();
      });

      it.each([
        { name: 'front inclusive range', x: 2, y: 8, wall: false, visible: true },
        { name: 'behind', x: 2, y: 1, wall: false, visible: false },
        { name: 'off-axis', x: 3, y: 5, wall: false, visible: false },
        { name: 'outside authored range', x: 2, y: 9, wall: false, visible: false },
        { name: 'wall', x: 2, y: 5, wall: true, visible: false },
      ])('uses the authored forward ray: $name', spec => {
        const f = setup();
        f.page.movement.sight = { range: 6, lineOfSight: true, facing: 'forward' };
        f.scene.session.x = spec.x; f.scene.session.y = spec.y;
        if (spec.wall) f.map.lowerTiles[32] = 1;
        const view = required(runtimeEventViewsForMap(f.project, f.map, f.scene.session, f.scene.eventPositions)[0]);
        expect(seesPlayer({ project: f.project, map: f.map, session: f.scene.session, positions: f.scene.eventPositions }, view)).toBe(spec.visible);
      });

      it.each(['fixed', 'random'] as const)('synchronously claims input and foreground before a %s trainer emote', async movement => {
        const f = setup(); f.page.movement.type = movement; registerPageMoveRoutes(f.scene);
        Object.assign(required(f.page.detectionEncounter), { emote: 'exclamation', emoteMs: 600 });
        const frame = f.frame();
        expect(f.scene.running).toBe(true);
        expect(f.scene.inputEnabled).toBe(false);
        expect(describeSceneEmotes(f.scene).map(e => e.target)).toEqual(['trainer']);
        expect(f.battle).not.toHaveBeenCalled();
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        await frame;
      });

      it('walks a real route to adjacency, awaits foreground battle, and saves page completion without repeating', async () => {
        const f = setup();
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        await f.frame();
        expect(f.scene.running).toBe(true);
        expect(f.scene.inputEnabled).toBe(false);
        // Explicit game frames drive the real route/tweens; no wall-clock sleep or success polling.
        await f.frames(120); await bounded(entered);
        expect(f.overlay).not.toHaveBeenCalled();
        expect(f.battle.mock.calls[0]?.[0]).toMatchObject({ troopId: f.troopId, ownerEventId: 'trainer' });
        const last = required(f.positions.at(-1));
        expect(Math.abs(last.x - 2) + Math.abs(last.y - 5)).toBe(1);
        let previous = { x: 2, y: 2 };
        for (const position of f.positions) {
          expect(Math.abs(position.x - previous.x) + Math.abs(position.y - previous.y)).toBeLessThanOrEqual(1);
          previous = position;
        }
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
        f.battleResult.resolve('victory'); await bounded(released);
        expect(f.scene.session.selfSwitches?.trainer?.A).toBe(true);
        expect(f.scene.session.flags.encounterComplete).toBe(true);
        f.scene.session = saveReload(f.project, f.scene.session);
        await f.frames(120);
        expect(f.battle).toHaveBeenCalledTimes(1);
        f.page.id = 'trainer_second_page';
        const newPage = f.when(() => f.battle.mock.calls.length === 2);
        await f.frames(120); await bounded(newPage);
        expect(f.battle).toHaveBeenCalledTimes(2);
      });

      it('gives two simultaneous detectors one stable foreground owner', async () => {
        const f = setup();
        const second = structuredClone(f.event); second.id = 'second'; second.x = 3; second.y = 5;
        required(second.pages?.[0]).graphic.direction = 'left'; f.map.events.push(second);
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        await f.frame(); expect(f.scene.running).toBe(true);
        await f.frames(120); await bounded(entered);
        expect(f.battle).toHaveBeenCalledTimes(1);
        expect(f.battle.mock.calls[0]?.[0].ownerEventId).toBe('trainer');
        expect(f.scene.inputEnabled).toBe(false);
      });

      it('releases an unreachable approach without executing commands or marking completion', async () => {
        const f = setup(); required(f.page.detectionEncounter).sight.lineOfSight = false;
        for (let x = 0; x < 10; x++) f.map.lowerTiles[40 + x] = 1;
        const lock = vi.spyOn(f.scene, 'setInputEnabled');
        await f.frames(4);
        expect(lock).toHaveBeenCalledWith(false);
        expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
        expect(f.battle).not.toHaveBeenCalled(); expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        f.scene.tileY = 9; f.scene.session.y = 9; await f.frame(); // Leave sensing range before retry.
        f.map.lowerTiles.fill(0); f.scene.tileY = 5; f.scene.session.y = 5;
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        await f.frames(120); await bounded(entered);
      });

      it.each(['page', 'session', 'map'] as const)('cancels approach safely when the %s changes', async kind => {
        const f = setup(); await f.frame(); expect(f.scene.running).toBe(true);
        if (kind === 'page') { f.page.conditions = [{ kind: 'switch', switchId: 'unavailable', value: true }]; }
        if (kind === 'session') f.scene.session = startSession(f.project);
        if (kind === 'map') {
          const map = { ...structuredClone(f.map), id: 'elsewhere', events: [] };
          f.project.maps[map.id] = map; f.scene.map = map; f.scene.session.currentMapId = map.id;
        }
        await f.frames(4);
        expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
        expect(f.battle).not.toHaveBeenCalled();
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
      });
    });
  });
  describe("npcScheduledBattle", () => {
    isolateTimers();
    let harness: ReturnType<typeof encounterHarness> | undefined;
    const setup = () => (harness = encounterHarness('parallel'));
    afterEach(() => { harness?.dispose(); harness = undefined; vi.unstubAllGlobals(); });
    describe('scheduled battle foreground handoff', () => {
      it('does not mistake an inactive paged event for a legacy parallel event', () => {
        const f = setup();
        f.event.trigger = { kind: 'parallel' };
        f.event.commands = [{ kind: 'setFlag', flag: 'inactiveRootRan', value: true }, ...f.page.commands];
        f.page.conditions = [{ kind: 'switch', switchId: 'sw_0001', value: true }];
        f.scene.session.switches.sw_0001 = false;
        updateParallelEvents(f.scene, 0);
        expect(f.scene.session.flags.inactiveRootRan).not.toBe(true);
        expect(f.battle).not.toHaveBeenCalled();
      });

      it('runs and resumes a pageless legacy parallel event through the real battle path', async () => {
        const f = setup();
        f.event.trigger = { kind: 'parallel' };
        f.event.condition = { kind: 'switch', switchId: 'sw_0001', value: true };
        f.scene.session.switches.sw_0001 = false;
        f.event.commands = [...f.page.commands, { kind: 'setSwitch', switchId: 'sw_0001', value: false }];
        delete f.event.pages;
        updateParallelEvents(f.scene, 0);
        expect(f.battle).not.toHaveBeenCalled();
        f.scene.session.switches.sw_0001 = true;
        updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1);
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        const released = nextLeaseRelease(required(foregroundOwner(f.scene)));
        f.battleResult.resolve('victory');
        await bounded(released);
        expect(f.scene.session.battleResult).toBe('victory');
        expect(f.scene.session.flags.encounterComplete).toBe(true);
        expect(f.scene.session.switches.sw_0001).toBe(false);
        updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1);
      });

      it('releases cancelled ownership when no replacement owner exists', async () => {
        const f = setup(); updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1);
        f.page.conditions = [{ kind: 'switch', switchId: 'unavailable', value: true }];
        const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
        f.battleResult.resolve('victory'); await bounded(released);
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        expect(f.scene.session.selfSwitches?.trainer?.A).not.toBe(true);
      });

      it('resolves a variable troop through the same real battle path as foreground commands', () => {
        const f = setup();
        f.project.database.troops = [required(f.project.database.troops[0]), { ...required(f.project.database.troops[0]), id: 'variable_troop' }];
        const command = required(f.page.commands[0]);
        if (command.kind !== 'battleProcessing') throw new Error('Expected battle command');
        command.troopSource = 'variable'; command.troopVariableId = 'selectedTroop';
        f.scene.session.variables.selectedTroop = 2;
        updateParallelEvents(f.scene, 0);
        expect(f.battle.mock.calls[0]?.[0].troopId).toBe('variable_troop');
      });

      it.each([false, true])('handles defeat with canLose=%s before continuing commands', async canLose => {
        const f = setup();
        const command = required(f.page.commands[0]);
        if (command.kind !== 'battleProcessing') throw new Error('Expected battle command');
        command.canLose = canLose;
        command.defeatBranch = [{ kind: 'setSelfSwitch', key: 'B', value: true }];
        const gameOver = vi.spyOn(f.scene, 'showGameOverScreen');
        const ended = f.when(() => gameOver.mock.calls.length > 0 || f.scene.session.flags.encounterComplete === true);
        updateParallelEvents(f.scene, 0); expect(f.battle).toHaveBeenCalledTimes(1);
        f.battleResult.resolve('defeat'); await bounded(ended);
        expect(gameOver).toHaveBeenCalledTimes(canLose ? 0 : 1);
        expect(f.scene.session.flags.encounterComplete === true).toBe(canLose);
        expect(f.scene.session.selfSwitches?.trainer?.B === true).toBe(canLose);
      });

      it('holds the real interpreter until foreground is free, awaits battle and resumes its victory branch once', async () => {
        const f = setup(); f.scene.running = true; f.scene.inputEnabled = false;
        updateParallelEvents(f.scene, 0);
        expect(f.battle).not.toHaveBeenCalled();
        expect(f.overlay).not.toHaveBeenCalled();
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        f.scene.running = false; f.scene.setInputEnabled(true); updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1); await bounded(entered);
        expect(f.battle.mock.calls[0]?.[0]).toMatchObject({ troopId: f.troopId, ownerEventId: 'trainer' });
        expect(f.scene.running).toBe(true); expect(f.scene.inputEnabled).toBe(false);
        updateParallelEvents(f.scene, 1000);
        expect(f.battle).toHaveBeenCalledTimes(1);
        expect(f.scene.session.selfSwitches?.trainer?.A).not.toBe(true);
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
        f.battleResult.resolve('victory'); await bounded(released);
        expect(f.scene.session.battleResult).toBe('victory');
        expect(f.scene.session.selfSwitches?.trainer?.A).toBe(true);
        expect(f.scene.session.flags.encounterComplete).toBe(true);
        updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1); // The real self-switch condition deactivates this page.
      });

      it('delivers a committed result when the battle itself deactivates its page', async () => {
        const f = setup(); f.scene.running = true; f.scene.inputEnabled = false;
        updateParallelEvents(f.scene, 0);
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        f.scene.running = false; f.scene.setInputEnabled(true); updateParallelEvents(f.scene, 0);
        await bounded(entered);
        // 트룹 이밌트의 write-back 이 전투를 끝내면서 이 페이지 조건을 스스로 껐다.
        f.scene.session.selfSwitches ??= {};
        f.scene.session.selfSwitches.trainer = { ...(f.scene.session.selfSwitches.trainer ?? {}), A: true };
        f.scene.session.battleResult = 'escape';
        const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
        f.battleResult.resolve('victory'); await bounded(released);
        expect(f.scene.session.battleResult).toBe('victory');
        expect(f.scene.session.flags.encounterComplete).toBe(true);
      });

      it('does not run two simultaneous parallel battle owners', () => {
        const f = setup();
        const second = structuredClone(f.event); second.id = 'second';
        required(second.pages?.[0]).id = 'second_page'; f.map.events.push(second);
        updateParallelEvents(f.scene, 0); updateParallelEvents(f.scene, 0);
        expect(f.battle).toHaveBeenCalledTimes(1);
        expect(f.battle.mock.calls[0]?.[0].ownerEventId).toBe('trainer');
        expect(f.overlay).not.toHaveBeenCalled();
        expect(f.scene.inputEnabled).toBe(false);
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
      });

      it.each(['session', 'process', 'page'] as const)('discards a late battle result after %s replacement without unlocking another owner', async kind => {
        const f = setup();
        const entered = f.when(() => f.battle.mock.calls.length === 1);
        updateParallelEvents(f.scene, 0); expect(f.battle).toHaveBeenCalledTimes(1); await bounded(entered);
        const previousOwner = required(foregroundOwner(f.scene));
        if (kind === 'session') f.scene.session = startSession(f.project);
        if (kind === 'process') f.scene.parallelProcesses.clear();
        if (kind === 'page') f.page.conditions = [{ kind: 'switch', switchId: 'unavailable', value: true }];
        else f.map.events = []; // No new parallel process can be admitted during cleanup frames.
        f.scene.session.battleResult = 'escape'; f.scene.running = false; f.scene.inputEnabled = true;
        required(claimForeground(f.scene)); // A distinct real token, not merely identical busy booleans.
        const settled = nextLeaseRelease(previousOwner);
        f.battleResult.resolve('victory');
        await bounded(settled); // Await the entire then/catch/finally chain, not a microtask guess.
        expect(f.scene.session.battleResult).toBe('escape');
        expect(f.scene.session.selfSwitches?.trainer?.A).not.toBe(true);
        expect(f.scene.session.flags.encounterComplete).not.toBe(true);
        expect(f.scene.running).toBe(true); expect(f.scene.inputEnabled).toBe(false);
      });
    });
  });
});
