import type { Command } from "@/project/types";
import { changeGold, changeItem, changeParty, DEFAULT_MESSAGE_WINDOW_SETTINGS, evalCondition, learnSkill, setSwitch, setTimer, setVariable } from "@/project/session";
import { changeActorEquipment, changeActorExperience, changeActorLevel, changeActorVital, recoverAll } from "@/project/sessionActorCommands";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { resolveEventPage } from "@/project/io";
import type { CommandExecution, Frame, InterpreterState, PendingStep, StepResult } from "@/player/interpreter/types";
import { breakLoop, gotoLabel, pushFrame, pushLoopFrame } from "@/player/interpreter/stack";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { fieldNumber, fieldString } from "@/player/interpreter/m2RuntimeFields";

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

// 맵 이벤트 호출: 현재 맵의 eventId 이벤트를 찾아 활성 페이지의 commands 를 실행한다.
// 페이지가 없는 레거시 이벤트는 최상위 commands 로 폴백한다(RM2K3 "Call Event" 동작).
function callMapEvent(state: InterpreterState, frame: Frame, eventId: string): CommandExecution {
  const map = state.project?.maps[state.session.currentMapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!event) {
    console.warn(`[interpreter] 맵 이벤트 없음: ${eventId}`);
    return resumeNext(frame);
  }
  const page = event.pages?.length ? resolveEventPage(event, state.session) : undefined;
  const commands = page?.commands ?? event.commands;
  if (commands.length) {
    if (pushFrame(state, commands)) return { kind: "continue" };
    console.warn("[interpreter] map event recursion limit");
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

  if (entry.title === "Advanced Dialogue" && executeM2RuntimeCommand(state.session, entry, command)) {
    return pause("text", {
      kind: "text",
      speaker: fieldString(command.fields, "speaker", ""),
      body: fieldString(command.fields, "body", ""),
      settings: state.session.messageWindowSettings,
    });
  }

  if (entry.title === "Sound Layer" && executeM2RuntimeCommand(state.session, entry, command)) {
    return pause("playAudio", {
      kind: "playAudio",
      resourceId: fieldString(command.fields, "resourceId", ""),
      loop: true,
    });
  }

  if (entry.title === "Wait Until" && executeM2RuntimeCommand(state.session, entry, command)) {
    const condition = fieldString(command.fields, "condition", "switchOn");
    const target = fieldString(command.fields, "target", "");
    if (state.session.flags[`m2-wait:${condition}:${target}`] !== true) {
      return pause("wait", { kind: "wait", ms: fieldNumber(command.fields, "timeoutMs", 0) });
    }
    return resumeNext(frame);
  }

  // 일회성 화면 효과: 상태 기록(executeM2RuntimeCommand) 후 블로킹 pause 로 플레이어에 위임.
  if (entry.title === "Flash Screen" && executeM2RuntimeCommand(state.session, entry, command)) {
    const rgb = screenColorToRgb(fieldString(command.fields, "color", "white"));
    return pause("flashScreen", {
      kind: "flashScreen",
      red: rgb.red,
      green: rgb.green,
      blue: rgb.blue,
      durationMs: clampMs(fieldNumber(command.fields, "durationMs", 300)),
    });
  }

  if (entry.title === "Shake Screen" && executeM2RuntimeCommand(state.session, entry, command)) {
    return pause("shakeScreen", {
      kind: "shakeScreen",
      intensity: fieldNumber(command.fields, "intensity", 3),
      durationMs: clampMs(fieldNumber(command.fields, "durationMs", 400)),
    });
  }

  if (executeM2RuntimeCommand(state.session, entry, command)) {
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
      const branch = evalCondition(state.session, command.condition, state.currentEventId) ? command.then : command.else ?? [];
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
    case "timer": {
      const timerId = command.timerId ?? "timer1";
      if (command.action === "set") setTimer(state.session, timerId, command.seconds ?? 0);
      if (command.action === "start" && command.seconds !== undefined) setTimer(state.session, timerId, command.seconds);
      return pause("timer", { kind: "timer", action: command.action, seconds: command.seconds, timerId });
    }
    case "inputWait":
      return pause("inputWait", { kind: "inputWait", variableId: command.variableId });
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
    case "loop": {
      frame.pc += 1;
      // 빈 본문이면 한 번의 반복도 의미가 없으므로 건너뛴다.
      if (command.body.length === 0) return { kind: "continue" };
      state.loopIterations = 0;
      if (pushLoopFrame(state, command.body, frame.commands, frame.pc - 1)) {
        return { kind: "continue" };
      }
      console.warn("[interpreter] 루프 본문 프레임 push 실패 (스택 한계)");
      return { kind: "continue" };
    }
    case "breakLoop":
      breakLoop(state);
      return { kind: "continue" };
    case "transfer":
      return pause("transfer", { kind: "transfer", mapId: command.mapId, x: command.x, y: command.y, direction: command.direction, fade: command.fade });
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
        wait: command.route.wait === true,
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
    case "callMapEvent":
      return callMapEvent(state, frame, command.eventId);
    case "learnSkill":
      learnSkill(state.session, command.actorId, command.skillId);
      return resumeNext(frame);
    case "changeExp":
      changeActorExperience(state.session, command);
      return resumeNext(frame);
    case "changeLevel":
      changeActorLevel(state.session, command);
      return resumeNext(frame);
    case "changeEquipment":
      changeActorEquipment(state.session, command);
      return resumeNext(frame);
    case "changeActorHp":
    case "changeActorMp":
      changeActorVital(state.session, command);
      return resumeNext(frame);
    case "recoverAll":
      recoverAll(state.session, command.actorId);
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
    case "setSelfSwitch": {
      const eventId = state.currentEventId;
      if (eventId) {
        state.session.selfSwitches ??= {};
        state.session.selfSwitches[eventId] ??= {};
        state.session.selfSwitches[eventId][command.key] = command.value;
      }
      return resumeNext(frame);
    }
    case "m2Command":
      return executeM2Command(state, frame, command);
    default:
      console.warn("[interpreter] 알 수 없는 command kind, 이벤트 중단");
      return { kind: "done" };
  }
}

const SCREEN_COLOR_RGB: Record<string, { red: number; green: number; blue: number }> = {
  white: { red: 255, green: 255, blue: 255 },
  red: { red: 255, green: 0, blue: 0 },
  green: { red: 0, green: 255, blue: 0 },
  blue: { red: 0, green: 0, blue: 255 },
  yellow: { red: 255, green: 255, blue: 0 },
  purple: { red: 180, green: 0, blue: 255 },
  black: { red: 0, green: 0, blue: 0 },
  neutral: { red: 200, green: 200, blue: 200 },
};

// 화면 효과 색상 문자열(white/red/.../neutral 또는 #rrggbb)을 RGB 로 변환한다.
export function screenColorToRgb(color: string): { red: number; green: number; blue: number } {
  const named = SCREEN_COLOR_RGB[color];
  if (named) return named;
  const hexMatch = color.match(/^#?([0-9a-f]{6})$/i);
  if (hexMatch) {
    const value = parseInt(hexMatch[1] ?? "", 16);
    return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
  }
  return SCREEN_COLOR_RGB.white;
}

// 화면 효과 지속시간을 안전한 범위(50ms~5000ms)로 묶는다.
export function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 300;
  return Math.max(50, Math.min(5000, Math.round(ms)));
}
