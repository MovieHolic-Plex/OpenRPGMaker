import { isCutsceneInputLocked } from './cutsceneControl';
import { store } from '@/project/store';
import { completeDetectionEncounter } from '@/project/npcBehavior';
import { passageBounds } from '@/project/footprint';
import { resolvePlayerBody } from '@/project/playerFootprint';
import { runtimeEventViewById, runtimeEventViewsForMap, type RuntimeEventView } from '@/project/runtimeEventState';
import type { FootprintRect } from '@/project/types';
import type { PlaySceneContext } from './playSceneTypes';
import { claimForeground, foregroundOwner, type ForegroundLease } from './foregroundControl';
import { isPlayerHiding } from './horrorRuntime';
import { npcSeesPoint } from './npcPerception';
import { showSceneEmote, clearSceneEmote } from './playSceneEmotes';
import { planPathfindMove, playPathfindMove } from './playScenePathfinding';
import { runCommands } from './playSceneInterpreter';
import { dialogueUi } from './playSceneDom';
import type { DialogueUI } from './dialogue';

type DetectionRun = {
  readonly eventId: string;
  readonly pageId: string;
  readonly lease: ForegroundLease;
  readonly session: PlaySceneContext['session'];
  phase: 'emote' | 'approach' | 'commands';
  remainingMs: number;
  dialogue?: DialogueUI;
};
type DetectionController = {
  session: PlaySceneContext['session'];
  mapId: string;
  readonly suppressed: Set<string>;
  run?: DetectionRun;
  closed: boolean;
};
const controllers = new WeakMap<object, DetectionController>();

function controllerFor(scene: PlaySceneContext): DetectionController {
  const found = controllers.get(scene);
  if (found) return found;
  const controller: DetectionController = { session: scene.session, mapId: scene.map.id, suppressed: new Set(), closed: false };
  controllers.set(scene, controller);
  const shutdown = () => {
    controller.closed = true; cancelDetectionEncounter(scene, false);
    scene.events?.off('shutdown', shutdown); scene.events?.off('destroy', shutdown);
  };
  scene.events?.once('shutdown', shutdown); scene.events?.once('destroy', shutdown);
  return controller;
}

export function cancelDetectionEncounter(scene: PlaySceneContext, restore = true): void {
  const controller = controllers.get(scene), run = controller?.run;
  if (!controller || !run) return;
  delete controller.run;
  clearSceneEmote(scene, run.eventId);
  const owned = foregroundOwner(scene) === run.lease;
  run.lease.release(false);
  if (owned) run.dialogue?.hide();
  // Synchronous lifecycle cleanup may retire the old context's detector. A late async
  // finally instead uses lease.release(), which can only restore its captured context.
  if (restore && owned && !foregroundOwner(scene)) { scene.running = false; scene.setInputEnabled(true); }
}

export function resetDetectionForMap(scene: PlaySceneContext): void {
  const run = controllers.get(scene)?.run;
  if (run && (run.phase !== 'commands' || !commandsCurrent(scene, run))) cancelDetectionEncounter(scene);
}

export function isDetectionEmoting(scene: object, eventId: string): boolean {
  const run = controllers.get(scene)?.run;
  return run?.eventId === eventId && run.phase === 'emote';
}

/** Runs before input and autonomous movement, including fixed event pages without movers. */
export function updateDetectionEncounters(scene: PlaySceneContext, deltaMs: number): void {
  const controller = controllerFor(scene);
  if (controller.closed) return;
  if (controller.run?.phase === 'commands') {
    if (!commandsCurrent(scene, controller.run)) cancelDetectionEncounter(scene, false);
    return; // The admitted command list owns its original page context across authored changes.
  }
  if (controller.session !== scene.session || controller.mapId !== scene.map.id) {
    cancelDetectionEncounter(scene);
    controller.session = scene.session; controller.mapId = scene.map.id; controller.suppressed.clear();
    return; // The replaced session/map gets its first fresh scan on its own next frame.
  }
  const run = controller.run;
  if (run) {
    if (!currentRun(scene, run)) { cancelDetectionEncounter(scene); return; }
    if (run.phase === 'emote') {
      run.remainingMs = Math.max(0, run.remainingMs - Math.max(0, deltaMs));
      if (run.remainingMs === 0) startApproach(scene, controller, run);
    }
    return;
  }
  if (scene.running || !scene.inputEnabled || scene.moving || scene.playerHop || isCutsceneInputLocked(scene.session)) return;
  const project = store.getCurrent();
  const world = { project, map: scene.map, session: scene.session, positions: scene.eventPositions };
  if (isPlayerHiding(world)) { controller.suppressed.clear(); return; }
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    const config = view.page?.detectionEncounter;
    if (!config || !view.pageId || scene.session.horror?.pursuits[view.event.id]?.doors.length) continue;
    if (scene.commandMoveRouteEventIds.has(view.event.id)) continue;
    const key = `${view.event.id}:${view.pageId}`;
    const visible = npcSeesPoint(world, view, scene.session, config.sight, scene.autonomousNPCs.get(view.event.id)?.facing ?? view.direction);
    if (!visible) { controller.suppressed.delete(key); continue; }
    const receipts = scene.session.detectionEncounterCompletions;
    const completed = receipts && Object.hasOwn(receipts, view.event.id)
      && Object.hasOwn(receipts[view.event.id], view.pageId) && receipts[view.event.id][view.pageId] === true;
    if (controller.suppressed.has(key) || completed) continue;
    const lease = claimForeground(scene);
    if (!lease) return;
    const admitted: DetectionRun = { eventId: view.event.id, pageId: view.pageId, lease, session: scene.session, phase: 'emote', remainingMs: config.emoteMs };
    controller.run = admitted; controller.suppressed.add(key);
    if (config.emote) showSceneEmote(scene, view.event.id, config.emote, config.emoteMs);
    if (admitted.remainingMs === 0) startApproach(scene, controller, admitted);
    return; // Stable first active view owns this foreground.
  }
}

function commandsCurrent(scene: PlaySceneContext, run: DetectionRun): boolean {
  return controllers.get(scene)?.run === run && foregroundOwner(scene) === run.lease
    && run.lease.current() && scene.session === run.session;
}

function currentRun(scene: PlaySceneContext, run: DetectionRun): RuntimeEventView | undefined {
  if (!run.lease.current() || controllers.get(scene)?.run !== run) return undefined;
  const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, run.eventId);
  return view?.pageId === run.pageId && view.page?.detectionEncounter ? view : undefined;
}

function adjacent(a: FootprintRect, b: FootprintRect): boolean {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return dx + dy === 1;
}

function playerRect(scene: PlaySceneContext): FootprintRect {
  const body = resolvePlayerBody(store.getCurrent(), scene.session);
  return passageBounds(scene.tileX, scene.tileY, body.footprint, body.passRows);
}

function approachStep(scene: PlaySceneContext, view: RuntimeEventView, speed: number) {
  const target = playerRect(scene);
  let best: { step: Parameters<typeof planPathfindMove>[1]; length: number } | undefined;
  for (let y = target.top - 1; y <= target.bottom + view.passRows; y++) {
    for (let x = target.left - view.footprint.width; x <= target.right + view.footprint.width; x++) {
      if (!adjacent(passageBounds(x, y, view.footprint, view.passRows), target)) continue;
      const step = { kind: 'pathfindMove', target: view.event.id, x, y, speed, wait: true } as const;
      const plan = planPathfindMove(scene, step, view.event.id);
      if (!plan || (!plan.moves.length && (plan.from.x !== x || plan.from.y !== y))) continue;
      if (!best || plan.moves.length < best.length) best = { step, length: plan.moves.length };
    }
  }
  return best?.step;
}

function startApproach(scene: PlaySceneContext, controller: DetectionController, run: DetectionRun): void {
  run.phase = 'approach'; clearSceneEmote(scene, run.eventId);
  const view = currentRun(scene, run), config = view?.page?.detectionEncounter;
  if (!view || !config) { cancelDetectionEncounter(scene); return; }
  const step = approachStep(scene, view, config.approachSpeed);
  if (!step) { cancelDetectionEncounter(scene); return; }
  void playPathfindMove(scene, step, run.eventId, run.lease.signal).then(async () => {
    const arrived = currentRun(scene, run);
    if (!arrived || !adjacent(arrived.passRect, playerRect(scene))) return;
    run.phase = 'commands';
    const dialogue = dialogueUi(scene);
    if (dialogue) run.dialogue = dialogue;
    await runCommands(scene, arrived.page?.commands ?? [], run.eventId, {
      allowNested: true, continueAfterTransfer: true, isCurrent: () => commandsCurrent(scene, run),
      onComplete: () => completeDetectionEncounter(run.session, run.eventId, run.pageId),
    });
  }).catch((error: unknown) => {
    console.error('[player] detection encounter failed', error);
    if (commandsCurrent(scene, run)) scene.showRuntimeOverlay('runtime-error', error instanceof Error ? error.message : '발견 이벤트 실행 오류');
  }).finally(() => {
    if (controller.run !== run) return;
    delete controller.run;
    const restore = foregroundOwner(scene) === run.lease;
    run.lease.release(restore);
    if (restore && !controller.closed) scene.registerPageMoveRoutes();
  });
}
