import {
  clearAudioState,
  erasePictureState,
  evalCondition,
  DEFAULT_MESSAGE_WINDOW_SETTINGS,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import { resolveEventPage } from "@/project/io";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { Interpreter } from "@/player/interpreter";
import { playInn, playShop } from "@/player/playSceneCommerce";
import { dialogueUi } from "@/player/playSceneDom";
import { applyTimerStep } from "@/player/playSceneTimers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { resourceDisplayName } from "@/player/resourceDisplay";
import { assertNever } from "@/player/playSceneTypes";
import type { Command } from "@/project/types";

export async function runEvent(scene: PlaySceneContext, eventId: string): Promise<void> {
  if (scene.running) return;
  const event = scene.map.events.find((entry) => entry.id === eventId);
  if (!event) return;
  const page = resolveEventPage(event, scene.session);
  if (!page && event.condition && !evalCondition(scene.session, event.condition)) return;
  const dialogue = dialogueUi(scene);
  if (!dialogue) {
    console.warn("[player] dialogue UI missing");
    return;
  }
  await runCommands(scene, page?.commands ?? event.commands, eventId);
}

export async function runCommands(
  scene: PlaySceneContext,
  commands: readonly Command[],
  currentEventId?: string
): Promise<void> {
  if (scene.running) return;
  const dialogue = dialogueUi(scene);
  if (!dialogue) {
    console.warn("[player] dialogue UI missing");
    return;
  }
  scene.running = true;
  scene.setInputEnabled(false);
  const project = store.getCurrent();
  scene.session.commonEvents = project.commonEvents;
  const interpreter = createInterpreter([...commands], scene.session, project, { currentEventId });
  try {
    let result = interpreter.start();
    scene.refreshRuntimeSurfaces();
    while (result.kind !== "done") {
      result = await consumeBlockingStep(scene, interpreter, result, currentEventId);
    }
  } finally {
    scene.running = false;
    scene.lastActionTargetKey = "";
    scene.setInputEnabled(true);
    dialogue.hide();
    scene.refreshRuntimeSurfaces();
  }
}

async function consumeBlockingStep(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  step: Exclude<StepResult, { kind: "done" }>,
  currentEventId: string | undefined
): Promise<StepResult> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return { kind: "done" };
  switch (step.kind) {
    case "text":
      await dialogue.showText({
        speaker: step.speaker,
        body: step.body,
        face: step.face,
        settings: scene.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
      });
      return resumeAfterSurface(scene, interpreter);
    case "choices":
      return resumeWithChoice(
        scene,
        interpreter,
        await dialogue.showChoices({
          prompt: step.prompt,
          options: step.options,
          settings: step.settings,
          cancelBehavior: step.cancelBehavior,
          playerTileY: scene.tileY,
          mapHeight: scene.map.height,
        })
      );
    case "wait":
      await new Promise<void>((resolve) => window.setTimeout(resolve, step.ms));
      return resumeAfterSurface(scene, interpreter);
    case "inputWait": {
      const keyCode = await waitForKey();
      if (step.variableId) {
        return resumeWithValue(scene, interpreter, keyCode);
      }
      return resumeAfterSurface(scene, interpreter);
    }
    case "inputNumber":
      return resumeWithValue(scene, interpreter, await dialogue.showNumberInput({
        digits: step.digits,
        settings: step.settings,
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
      }));
    case "timer":
      applyTimerStep(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "transfer":
      dialogue.hide();
      await scene.transferTo(step);
      return resumeAfterSurface(scene, interpreter);
    case "changeTile":
      scene.applyChangeTileStep(step);
      return resumeAfterSurface(scene, interpreter);
    case "moveEvent":
      scene.registerAutonomousMover(resolveMoveEventTarget(step.eventId, currentEventId), step.moves, step.repeat);
      if (step.wait) {
        await waitForMoverComplete(scene, resolveMoveEventTarget(step.eventId, currentEventId));
      }
      return resumeAfterSurface(scene, interpreter);
    case "battleProcessing":
      scene.session.battleResult = await scene.playBattle(step);
      return resumeAfterSurface(scene, interpreter);
    case "showPicture":
      showPictureState(scene.session, step);
      scene.showRuntimeOverlay("picture-overlay", resourceDisplayName(step.resourceId, step.pictureId || step.resourceId));
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "erasePicture":
      erasePictureState(scene.session, step.pictureId);
      scene.clearRuntimeOverlay("picture-overlay");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "playAudio":
      setAudioState(scene.session, step);
      scene.showRuntimeOverlay("audio-indicator", resourceDisplayName(step.resourceId, step.resourceId || "오디오"));
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "stopAudio":
      clearAudioState(scene.session);
      scene.clearRuntimeOverlay("audio-indicator");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "flashScreen":
      await scene.flashScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "shakeScreen":
      await scene.shakeScreen(step);
      return resumeAfterSurface(scene, interpreter);
    case "shop":
      return resumeWithValue(scene, interpreter, await playShop(scene, step));
    case "inn":
      await playInn(scene, step);
      return resumeAfterSurface(scene, interpreter);
    case "gameOver":
      scene.showGameOverScreen();
      return resumeInterpreter(interpreter);
    case "returnToTitle":
      if (step.title || step.message) {
        scene.showRuntimeOverlay("ending-screen", [step.title, step.message].filter(Boolean).join("\n"));
      } else {
        scene.returnToTitle();
      }
      return resumeInterpreter(interpreter);
    default:
      return assertNever(step);
  }
}

function resolveMoveEventTarget(eventId: string, currentEventId: string | undefined): string {
  return eventId || currentEventId || "";
}

// moveEvent 의 wait 옵션: mover 가 활동을 마칠 때(autonomousNPCs 에서 제거될 때)까지 대기.
// 반복(repeat) mover는 완료되지 않으므로 wait 와 함께 쓰면 무한 대기가 되나,
// RM2K3 동작과 일관되게 비반복 경로에만 의미를 둔다. 안전 가드로 최대 30초 후 타임아웃.
function waitForMoverComplete(scene: PlaySceneContext, eventId: string): Promise<void> {
  return new Promise((resolve) => {
    const timeoutMs = 30000;
    const startedAt = performance.now();
    const check = () => {
      if (!scene.autonomousNPCs.has(eventId)) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

function resumeAfterSurface(scene: PlaySceneContext, interpreter: Interpreter): StepResult {
  const result = resumeInterpreter(interpreter);
  scene.refreshRuntimeSurfaces();
  return result;
}

function resumeWithChoice(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  index: number
): StepResult {
  return resumeWithValue(scene, interpreter, index);
}

function resumeWithValue(
  scene: PlaySceneContext,
  interpreter: Interpreter,
  value: number | boolean
): StepResult {
  const result = interpreter.resume(value);
  scene.refreshRuntimeSurfaces();
  return result;
}

function resumeInterpreter(interpreter: Interpreter): StepResult {
  return interpreter.resume(undefined);
}

// 아무 키나 누를 때까지 대기하고, 눌린 키의 RM2K3 호환 코드를 반환한다.
// variableId 가 없는 inputWait 에서는 반환값을 무시한다.
function waitForKey(): Promise<number> {
  return new Promise<number>((resolve) => {
    const handler = (event: KeyboardEvent): void => {
      document.removeEventListener("keydown", handler);
      resolve(keyInputCodeFor(event));
    };
    document.addEventListener("keydown", handler);
  });
}

// RM2K3 Key Input Processing 호환 코드. 방향/결정/취소/숫자 등을 정수 코드로 매핑.
// 변수에 저장된 코드를 이벤트 조건에서 검사하는 용도.
function keyInputCodeFor(event: KeyboardEvent): number {
  switch (event.key) {
    case "ArrowDown": case "s": case "S": return 1;
    case "ArrowLeft": case "a": case "A": return 2;
    case "ArrowRight": case "d": case "D": return 3;
    case "ArrowUp": case "w": case "W": return 4;
    case "Enter": case " ": case "z": case "Z": return 5;  // 결정
    case "Escape": case "x": case "X": return 6;            // 취소
    case "Shift": return 7;
    default:
      // 숫자키 0-9
      if (/^[0-9]$/.test(event.key)) return 10 + parseInt(event.key, 10);
      return 0;
  }
}
