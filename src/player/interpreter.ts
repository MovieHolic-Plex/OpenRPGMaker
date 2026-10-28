import type { Command, Project } from "@/project/types";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { runtimeEventViewById } from "@/project/runtimeEventState";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import { advanceResume } from "@/player/interpreter/resume";
import { advanceCompletedFrame, gotoLabel, topFrame, withLabelIndexPass, invalidateLabelIndexPass } from "@/player/interpreter/stack";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type {
  Interpreter,
  InterpreterOptions,
  InterpreterState,
  PendingStep,
  ResumeValue,
  StepResult,
} from "@/player/interpreter/types";

export type { Interpreter, ResumeValue, StepResult } from "@/player/interpreter/types";

export function createInterpreter(
  commands: Command[],
  session: PlaySessionLike,
  project?: Project,
  options?: InterpreterOptions
): Interpreter {
  const map = project?.maps[session.currentMapId];
  const event = project && map && options?.currentEventId
    ? runtimeEventViewById(project, map, session, options.eventPositions ?? {}, options.currentEventId)
    : undefined;
  const state: InterpreterState = {
    beforeCommand: options?.beforeCommand,
    onUnverified: options?.onUnverified,
    continueAfterTransfer: options?.continueAfterTransfer,
    currentFace: project ? resolveAppearancePortrait(project, event?.page?.graphic.appearanceId, "face") : undefined,
    stack: [{ commands, pc: 0 }],
    session,
    maxStackDepth: 1000,
    maxLoopIterations: options?.maxLoopIterations ?? 100000,
    maxInstructions: Math.max(1, Math.trunc(options?.maxInstructions ?? 100000)),
    instructionsExecuted: 0,
    currentEventId: options?.currentEventId,
    get eventPositions() { return options?.getEventPositions?.() ?? options?.eventPositions; },
    isEventIdle: options?.isEventIdle,
    onFactionStanceChanged: options?.onFactionStanceChanged,
    onFriendshipChanged: options?.onFriendshipChanged,
    project,
  };
  let done = false;
  let pending: PendingStep | "none" = "none";

  function finish(): StepResult {
    done = true;
    return { kind: "done" };
  }

  function run(): StepResult {
    return withLabelIndexPass(runCommands);
  }

  function runCommands(): StepResult {
    while (true) {
      const frame = topFrame(state.stack);
      if (!frame) return finish();
      if (frame.pc >= frame.commands.length) {
        invalidateLabelIndexPass(); // loop-budget callbacks may edit commands before the parent resumes
        if (advanceCompletedFrame(state) === "done") return finish();
        continue;
      }

      const command = frame.commands[frame.pc] ?? null;
      if (!command) return finish();
      if (state.instructionsExecuted >= state.maxInstructions) {
        state.onUnverified?.("Interpreter instruction budget exhausted");
        console.warn(
          `[interpreter:instruction-budget-exhausted] maxInstructions=${state.maxInstructions} executed=${state.instructionsExecuted}`
        );
        return finish();
      }
      state.instructionsExecuted += 1;
      // All other commands and hooks are conservative mutation boundaries. Never trust a
      // cache across user callbacks, yielded steps, or arbitrary authored command execution.
      if (state.beforeCommand || (command.kind !== "label" && command.kind !== "gotoLabel")) invalidateLabelIndexPass();
      const result = executeCommand(state, frame, command);
      switch (result.kind) {
        case "continue":
          continue;
        case "done":
          return finish();
        case "pause":
          pending = result.pending;
          return result.step;
      }
    }
  }

  return {
    start(): StepResult {
      if (done) return { kind: "done" };
      pending = "none";
      return run();
    },
    resume(value: ResumeValue): StepResult {
      if (done) return { kind: "done" };
      const result = advanceResume(state, pending, value);
      if (result === "done") return finish();
      pending = "none";
      return run();
    },
    skip(): StepResult {
      if (done) return { kind: "done" };
      state.waitUntil = undefined;
      // pending(블로킹 단계)을 무시하고 현재 프레임의 pc 만 전진시킨다.
      const frame = topFrame(state.stack);
      if (frame) frame.pc += 1;
      pending = "none";
      return run();
    },
    jumpToLabel(name: string): StepResult {
      if (done) return { kind: "done" };
      state.waitUntil = undefined;
      const kept = skippedStateCommands(state.stack, name);
      if (!gotoLabel(state.stack, name)) return { kind: "done" };
      // 건너뛴 구간의 상태 명령(스위치·변수·아이템·금화·파티…)은 그대로 반영한다 — 연출만 건너뛴다.
      // 독립 판정(2026-10-28): 여는 장면을 Esc Esc 로 건너뛰자 빵·스위치가 안 들어와 감방에서 700걸음을 갇혔다.
      for (const command of kept) executeCommand(state, { commands: [command], pc: 0 }, command);
      pending = "none";
      return run();
    },
    isDone(): boolean {
      return done;
    },
  };
}

/** 컷신 「전체 건너뛰기」가 지나쳐도 결과는 남아야 하는 명령 — 게임 상태만 바꾸고 화면·시간을 쓰지 않는다. */
const SKIP_KEEPS_STATE: ReadonlySet<string> = new Set([
  "setSwitch", "setSelfSwitch", "setVariable", "setFlag", "changeItem", "changeGold", "changeParty", "changeEquipment", "changeExp", "changeLevel",
]);

/**
 * `jumpToLabel(name)` 이 건너뛸 명령 가운데 상태 명령만 실행 순서대로 모은다(같은 줄 — 분기 안쪽은 안 들어간다).
 * 맨 위 프레임은 멈춘 명령(pc)부터, 바깥 프레임은 자식을 연 명령 다음(pc+1)부터 그 라벨 앞까지.
 */
function skippedStateCommands(stack: readonly { commands: Command[]; pc: number }[], name: string): Command[] {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    if (!frame) continue;
    const labelAt = frame.commands.findIndex((c) => c.kind === "label" && (c as { name?: string }).name === name);
    if (labelAt < 0) continue;
    const out: Command[] = [];
    for (let j = stack.length - 1; j > i; j -= 1) {
      const inner = stack[j];
      if (inner) out.push(...inner.commands.slice(inner.pc + (j === stack.length - 1 ? 0 : 1)));
    }
    const from = frame.pc + (i === stack.length - 1 ? 0 : 1);
    if (from < labelAt) out.push(...frame.commands.slice(from, labelAt));
    return out.filter((c) => SKIP_KEEPS_STATE.has(c.kind));
  }
  return [];
}
