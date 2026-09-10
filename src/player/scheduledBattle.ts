import { store } from '@/project/store';
import { evalCondition } from '@/project/session';
import { runtimeEventViewById } from '@/project/runtimeEventState';
import type { StepResult } from './interpreter';
import type { ParallelProcess, PlaySceneContext } from './playSceneTypes';
import { claimForeground } from './foregroundControl';
import { playCommandBattle } from './commandBattle';

type BattleStep = Extract<StepResult, { kind: 'battleProcessing' }>;
export interface PendingScheduledBattle {
  readonly step: BattleStep;
  readonly session: PlaySceneContext['session'];
  readonly map: PlaySceneContext['map'];
  started: boolean;
}
type Consume = (scene: PlaySceneContext, key: string, process: ParallelProcess, result: StepResult) => void;

export function queueScheduledBattle(scene: PlaySceneContext, key: string, process: ParallelProcess, step: BattleStep, consume: Consume): void {
  process.pendingBattle = { step, session: scene.session, map: scene.map, started: false };
  resumeScheduledBattle(scene, key, process, consume);
}

export function resumeScheduledBattle(scene: PlaySceneContext, key: string, process: ParallelProcess, consume: Consume): void {
  const pending = process.pendingBattle;
  if (!pending || pending.started) return;
  const valid = () => {
    if (scene.session !== pending.session || scene.map !== pending.map || scene.parallelProcesses.get(key) !== process) return false;
    const project = store.getCurrent();
    if (process.currentEventId) {
      const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, process.currentEventId);
      return !!view && (view.pageId ?? 'legacy') === process.pageId && view.trigger.kind === 'parallel'
        && (view.event.pages?.length
          ? view.page !== undefined
          : evalCondition(scene.session, view.event.condition, view.event, { map: scene.map }));
    }
    const event = project.commonEvents.find(entry => entry.id === process.pageId);
    return event?.trigger === 'parallel' && (!event.conditionSwitchId || scene.session.switches[event.conditionSwitchId] === true);
  };
  if (!valid()) { scene.parallelProcesses.delete(key); return; }
  const lease = claimForeground(scene);
  if (!lease) return;
  pending.started = true;
  void playCommandBattle(scene, pending.step, () => valid() && lease.current()).then(result => {
    if (result === null || !valid() || !lease.current()) {
      if (scene.parallelProcesses.get(key) === process) scene.parallelProcesses.delete(key);
      return;
    }
    delete process.pendingBattle;
    if (result === 'defeat' && !pending.step.canLose) { process.stopped = true; return; }
    consume(scene, key, process, process.interpreter.resume(result));
  }).catch((error: unknown) => {
    console.error('[player] scheduled battle failed', error);
    if (valid() && lease.current()) {
      process.stopped = true;
      scene.showRuntimeOverlay('runtime-error', error instanceof Error ? error.message : '전투 실행 오류');
    }
  }).finally(() => lease.release()); // The token itself refuses to release any replacement owner.
}
