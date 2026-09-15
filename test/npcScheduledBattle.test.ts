/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateParallelEvents } from '@/player/playSceneSchedulers';
import { claimForeground, foregroundOwner } from '@/player/foregroundControl';
import { startSession } from '@/project/session';
import { bounded, encounterHarness, nextLeaseRelease, required } from './fixtures/npcEncounterPipeline';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));
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
