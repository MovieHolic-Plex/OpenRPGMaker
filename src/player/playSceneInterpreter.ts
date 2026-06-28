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
  const interpreter = createInterpreter([...commands], scene.session, project);
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
    case "inputWait":
      await waitForKey();
      return resumeAfterSurface(scene, interpreter);
    case "inputNumber":
      return resumeWithValue(scene, interpreter, await dialogue.showNumberInput({
        digits: step.digits,
        settings: step.settings,
        playerTileY: scene.tileY,
        mapHeight: scene.map.height,
      }));
    case "transfer":
      dialogue.hide();
      scene.transferTo(step.mapId, step.x, step.y);
      return resumeAfterSurface(scene, interpreter);
    case "changeTile":
      scene.applyChangeTileStep(step);
      return resumeAfterSurface(scene, interpreter);
    case "moveEvent":
      scene.registerAutonomousMover(resolveMoveEventTarget(step.eventId, currentEventId), step.moves, step.repeat);
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

function waitForKey(): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (): void => {
      document.removeEventListener("keydown", handler);
      resolve();
    };
    document.addEventListener("keydown", handler);
  });
}
