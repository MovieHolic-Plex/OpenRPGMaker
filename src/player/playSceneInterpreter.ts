import {
  clearAudioState,
  erasePictureState,
  evalCondition,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import { resolveEventPage } from "@/project/io";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { Interpreter } from "@/player/interpreter";
import { dialogueUi } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { assertNever } from "@/player/playSceneTypes";

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
  scene.running = true;
  scene.setInputEnabled(false);
  scene.session.commonEvents = store.getCurrent().commonEvents;
  const interpreter = createInterpreter(page?.commands ?? event.commands, scene.session);
  try {
    let result = interpreter.start();
    scene.refreshRuntimeSurfaces();
    while (result.kind !== "done") {
      result = await consumeBlockingStep(scene, interpreter, result);
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
  step: Exclude<StepResult, { kind: "done" }>
): Promise<StepResult> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return { kind: "done" };
  switch (step.kind) {
    case "text":
      await dialogue.showText(step.speaker, step.body);
      return resumeAfterSurface(scene, interpreter);
    case "choices":
      return resumeWithChoice(scene, interpreter, await dialogue.showChoices(step.prompt, step.options));
    case "wait":
      await new Promise<void>((resolve) => window.setTimeout(resolve, step.ms));
      return resumeAfterSurface(scene, interpreter);
    case "inputWait":
      await waitForKey();
      return resumeAfterSurface(scene, interpreter);
    case "transfer":
      dialogue.hide();
      scene.transferTo(step.mapId, step.x, step.y);
      return resumeAfterSurface(scene, interpreter);
    case "changeTile":
      scene.applyChangeTileStep(step);
      return resumeAfterSurface(scene, interpreter);
    case "moveEvent":
      scene.registerAutonomousMover(step.eventId, step.moves, step.repeat);
      return resumeAfterSurface(scene, interpreter);
    case "battleProcessing":
      scene.session.battleResult = await scene.playBattle(step);
      return resumeAfterSurface(scene, interpreter);
    case "showPicture":
      showPictureState(scene.session, step);
      scene.showRuntimeOverlay("picture-overlay", step.pictureId || step.resourceId);
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "erasePicture":
      erasePictureState(scene.session, step.pictureId);
      scene.clearRuntimeOverlay("picture-overlay");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "playAudio":
      setAudioState(scene.session, step);
      scene.showRuntimeOverlay("audio-indicator", step.resourceId || "audio");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "stopAudio":
      clearAudioState(scene.session);
      scene.clearRuntimeOverlay("audio-indicator");
      scene.syncRuntimeState();
      return resumeInterpreter(interpreter);
    case "shop":
      scene.showRuntimeOverlay("shop-scene", step.itemIds.join(",") || "shop");
      return resumeInterpreter(interpreter);
    case "inn":
      scene.showRuntimeOverlay("inn-scene", String(step.price));
      return resumeInterpreter(interpreter);
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
  const result = interpreter.resume(index);
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
