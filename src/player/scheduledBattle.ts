import { showBattleAdmissionError } from "@/player/playSceneOverlays";
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
  // 소유권(alive)과 페이지 조건(pageValid)을 나눈다. 전투가 자기 write-back 으로 이 페이지를
  // 면 페이지 조건만 거짓이 되는데, 그걸 취소로 읽으면 이미 커밋된 결과가 사라지고
  // session.battleResult 가 직전 전투 값으로 남는다.
  const alive = () =>
    scene.session === pending.session && scene.map === pending.map && scene.parallelProcesses.get(key) === process;
  const pageValid = () => {
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
  const valid = () => alive() && pageValid();
  // 페이지의 **작성된 정의**(페이지 배열·조건 배열·트리거)를 참조로 추적한다. 바깥에서 페이지를
  // 갈아끼운 것과, 전투가 자기 상태를 커밋해 조건이 거짓이 된 것을 가르는 유일한 신호다.
  const pageShapes = (): readonly unknown[] => {
    const project = store.getCurrent();
    if (process.currentEventId) {
      const local = scene.map.events?.find(entry => entry.id === process.currentEventId);
      return [local, local?.pages, local?.trigger, local?.condition, ...(local?.pages ?? []).map(page => page.conditions)];
    }
    const common = project.commonEvents.find(entry => entry.id === process.pageId);
    return [common, common?.trigger, common?.conditionSwitchId];
  };
  if (!valid()) { scene.parallelProcesses.delete(key); return; }
  const lease = claimForeground(scene);
  if (!lease) return;
  pending.started = true;
  const shapesBefore = pageShapes();
  const pageUnchanged = () => {
    const after = pageShapes();
    return after.length === shapesBefore.length && after.every((entry, i) => entry === shapesBefore[i]);
  };
  void playCommandBattle(scene, pending.step, () => valid() && lease.current(), () => alive() && lease.current()).then(result => {
    if (result === null || !alive() || !lease.current() || !pageUnchanged()) {
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
      showBattleAdmissionError(scene, error);
    }
  }).finally(() => lease.release()); // The token itself refuses to release any replacement owner.
}
