import type { Command } from "@/project/types";
import {
  changeGold,
  changeItem,
  changeParty,
  DEFAULT_MESSAGE_WINDOW_SETTINGS,
  evalCondition,
  setSwitch,
  setTimer,
  setVariable,
} from "@/project/session";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import type { CommandExecution, Frame, InterpreterState, PendingStep, StepResult } from "@/player/interpreter/types";
import { gotoLabel, pushFrame } from "@/player/interpreter/stack";

function pause(pending: PendingStep, step: Exclude<StepResult, { kind: "done" }>): CommandExecution {
  return { kind: "pause", pending, step };
}

function resumeNext(frame: Frame): CommandExecution {
  frame.pc += 1;
  return { kind: "continue" };
}

function callCommonEvent(state: InterpreterState, frame: Frame, commonEventId: string): CommandExecution {
  const commonEvent = state.session.commonEvents?.find((entry) => entry.id === commonEventId);
  if (commonEvent?.commands.length) {
    if (pushFrame(state, commonEvent.commands)) return { kind: "continue" };
    console.warn("[interpreter] common event recursion limit");
  } else {
    console.warn(`[interpreter] 공통 이벤트 없음: ${commonEventId}`);
  }
  return resumeNext(frame);
}

function executeM2Command(
  state: InterpreterState,
  frame: Frame,
  command: Extract<Command, { kind: "m2Command" }>
): CommandExecution {
  const entry = m2CommandById(command.commandId);
  if (!entry) {
    console.warn(`[interpreter] M2 command is unclassified: ${command.commandId}`);
    return resumeNext(frame);
  }

  if (entry.existingKind === "displayTextSettings") {
    state.session.messageWindowSettings = {
      format: "normal",
      position: "bottom",
      preventObscuringPlayer: true,
      allowEventMovementDuringWait: false,
    };
    return resumeNext(frame);
  }

  switch (entry.runtimeClassification) {
    case "editor-only":
      console.warn(`[interpreter] M2 editor-only command skipped: ${entry.label}`);
      return resumeNext(frame);
    case "shell":
    case "battle-only":
    case "disabled":
    case "missing-runtime":
    case "internal-non-pdf":
      console.warn(`[interpreter] M2 command cannot run in map interpreter (${entry.runtimeClassification}): ${entry.label}`);
      return resumeNext(frame);
    case "runtime":
      console.warn(`[interpreter] M2 runtime command should use native command kind: ${entry.label}`);
      return resumeNext(frame);
  }
}

export function executeCommand(
  state: InterpreterState,
  frame: Frame,
  command: Command
): CommandExecution {
  switch (command.kind) {
    case "changeFace":
      state.currentFace = command.resourceId
        ? {
            resourceId: command.resourceId,
            faceIndex: command.faceIndex,
            position: command.position,
            flipHorizontally: command.flipHorizontally,
          }
        : undefined;
      return resumeNext(frame);
    case "text":
      return pause("text", {
        kind: "text",
        speaker: command.speaker,
        body: command.body,
        face: state.currentFace,
        settings: state.session.messageWindowSettings,
      });
    case "choices":
      return pause("choices", {
        kind: "choices",
        prompt: command.prompt,
        options: command.options.map((option) => ({ text: option.text })),
        settings: state.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
        cancelBehavior: command.cancelBehavior,
      });
    case "fork": {
      const branch = evalCondition(state.session, command.condition) ? command.then : command.else ?? [];
      if (pushFrame(state, branch)) return { kind: "continue" };
      return resumeNext(frame);
    }
    case "setSwitch":
      setSwitch(state.session, command.switchId, command.value);
      return resumeNext(frame);
    case "setVariable":
      setVariable(
        state.session,
        command.variableId,
        command.op,
        typeof command.value === "number" ? command.value : state.session.variables[command.value.id] ?? 0
      );
      return resumeNext(frame);
    case "timer":
      if (command.action === "set") setTimer(state.session, "default", command.seconds ?? 0);
      if (command.action === "stop") setTimer(state.session, "default", 0);
      return resumeNext(frame);
    case "inputWait":
      return pause("inputWait", { kind: "inputWait" });
    case "inputNumber":
      return pause("inputNumber", {
        kind: "inputNumber",
        variableId: command.variableId,
        digits: command.digits,
        settings: state.session.messageWindowSettings ?? DEFAULT_MESSAGE_WINDOW_SETTINGS,
      });
    case "label":
      return resumeNext(frame);
    case "gotoLabel":
      if (!gotoLabel(state.stack, command.name)) {
        console.warn(`[interpreter] 라벨을 찾을 수 없음: ${command.name}`);
        frame.pc += 1;
      }
      return { kind: "continue" };
    case "transfer":
      return pause("transfer", { kind: "transfer", mapId: command.mapId, x: command.x, y: command.y });
    case "wait":
      return pause("wait", { kind: "wait", ms: command.ms });
    case "changeTile":
      return pause("changeTile", {
        kind: "changeTile",
        mapId: command.mapId,
        layer: command.layer,
        x: command.x,
        y: command.y,
        tile: command.tile,
      });
    case "moveEvent":
      return pause("moveEvent", {
        kind: "moveEvent",
        eventId: command.eventId,
        moves: command.route.moves,
        repeat: command.route.repeat,
      });
    case "battleProcessing":
      return pause("battleProcessing", {
        kind: "battleProcessing",
        troopId: command.troopId,
        canEscape: command.canEscape,
        canLose: command.canLose,
      });
    case "showPicture":
      return pause("showPicture", {
        kind: "showPicture",
        pictureId: command.pictureId,
        resourceId: command.resourceId,
        x: command.x,
        y: command.y,
      });
    case "erasePicture":
      return pause("erasePicture", { kind: "erasePicture", pictureId: command.pictureId });
    case "playAudio":
      return pause("playAudio", { kind: "playAudio", resourceId: command.resourceId, loop: command.loop });
    case "stopAudio":
      return pause("stopAudio", { kind: "stopAudio" });
    case "displayTextSettings": {
      state.session.messageWindowSettings = {
        format: command.format,
        position: command.position,
        preventObscuringPlayer: command.preventObscuringPlayer,
        allowEventMovementDuringWait: command.allowEventMovementDuringWait,
      };
      return resumeNext(frame);
    }
    case "shop":
      return pause("shop", {
        kind: "shop",
        itemIds: command.itemIds,
        allowSell: command.allowSell,
        quantityMode: command.quantityMode,
        shopType: command.shopType,
        messageType: command.messageType,
        branchOnTransaction: command.branchOnTransaction,
      });
    case "inn":
      return pause("inn", { kind: "inn", price: command.price });
    case "gameOver":
      return pause("gameOver", { kind: "gameOver" });
    case "ending":
      return pause("returnToTitle", {
        kind: "returnToTitle",
        title: command.title,
        message: command.message,
      });
    case "returnToTitle":
      return pause("returnToTitle", { kind: "returnToTitle" });
    case "callCommonEvent":
      return callCommonEvent(state, frame, command.commonEventId);
    case "learnSkill":
      return resumeNext(frame);
    case "changeGold":
      changeGold(state.session, command.op, command.amount);
      return resumeNext(frame);
    case "changeItem":
      changeItem(state.session, command.itemId, command.op, command.amount);
      return resumeNext(frame);
    case "changeParty":
      changeParty(state.session, command.actorId, command.action, state.project);
      return resumeNext(frame);
    case "setFlag":
      state.session.flags[command.flag] = command.value;
      return resumeNext(frame);
    case "m2Command":
      return executeM2Command(state, frame, command);
    default:
      console.warn("[interpreter] 알 수 없는 command kind, 이벤트 중단");
      return { kind: "done" };
  }
}
