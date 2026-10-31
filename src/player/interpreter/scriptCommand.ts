// player/interpreter/scriptCommand.ts — runs a `script` command (TypeScript compiled to JS) in the QuickJS sandbox.
//
// Bridge: an awaited game call (showMessage, battle, cmd …) becomes ordinary event commands pushed as a child
// frame. Like runSchedule, the script frame's pc is stepped back by one first, so when the child frame ends
// (advanceCompletedFrame: parent.pc += 1) the interpreter lands on this same script command again; the live run
// for this frame then resolves the awaited promise and the script continues. Text, choices, battles, transfers,
// waits and saves therefore behave exactly like the matching event commands, including pauses and resumes.
//
// Failure never crashes the game: the run is disposed, the error is logged (scriptLog.ts) and shown in a
// message window, then the event continues after the script.
import { pushFrame } from "@/player/interpreter/stack";
import type { CommandExecution, Frame, InterpreterState } from "@/player/interpreter/types";
import type { Command } from "@/project/types";
import { requestScriptEngine, scriptEngineLoadFailure, scriptEngineModule } from "@/player/script/engine";
import type { ExecuteCommandFn, HostContext } from "@/player/script/hostApi";
import { recordScriptLog } from "@/player/script/scriptLog";
import { ScriptRun, type ScriptOutcome } from "@/player/script/scriptRun";

type ScriptCommand = Extract<Command, { kind: "script" }>;

/** How long a script waits for a late wasm load (polls × 16 ms ≈ 10 s) before giving up with an error. */
const ENGINE_POLL_LIMIT = 600;
const enginePolls = new WeakMap<Frame, number>();

const registry: FinalizationRegistry<Map<Frame, ScriptRun>> | undefined =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry((runs) => {
        for (const run of runs.values()) run.dispose();
      })
    : undefined;

function runsOf(state: InterpreterState): Map<Frame, ScriptRun> {
  if (!state.scriptRuns) {
    state.scriptRuns = new Map();
    // Backup for interpreters dropped without finishing (scene change mid-script): free the wasm runtime.
    registry?.register(state, state.scriptRuns);
  }
  return state.scriptRuns;
}

/** Called by the interpreter when it finishes. Frees every sandbox it still holds. */
export function disposeScriptRuns(state: InterpreterState): void {
  const runs = state.scriptRuns;
  if (!runs?.size) return;
  for (const run of runs.values()) run.dispose();
  runs.clear();
}

function sourceLabel(state: InterpreterState, command: ScriptCommand): string | undefined {
  const name = command.name?.trim();
  const where = state.currentEventId ? `event ${state.currentEventId}` : undefined;
  return [where, name].filter(Boolean).join(" · ") || undefined;
}

function fail(state: InterpreterState, frame: Frame, command: ScriptCommand, message: string): CommandExecution {
  const runs = state.scriptRuns;
  const run = runs?.get(frame);
  if (run) {
    run.dispose();
    runs?.delete(frame);
  }
  const source = sourceLabel(state, command);
  recordScriptLog("error", message, source);
  // Show it: a silent failure looks like "the lever does nothing". The event continues after the script.
  const body = `[Script error${command.name ? ` · ${command.name}` : ""}] ${message}`;
  if (!pushFrame(state, [{ kind: "text", body }])) frame.pc += 1;
  return { kind: "continue" };
}

function follow(state: InterpreterState, frame: Frame, command: ScriptCommand, outcome: ScriptOutcome): CommandExecution {
  switch (outcome.kind) {
    case "request":
      frame.pc -= 1;
      if (!pushFrame(state, outcome.commands)) {
        frame.pc += 1;
        return fail(state, frame, command, "event call stack is too deep to run this game call");
      }
      return { kind: "continue" };
    case "done": {
      const run = state.scriptRuns?.get(frame);
      run?.dispose();
      state.scriptRuns?.delete(frame);
      frame.pc += 1;
      return { kind: "continue" };
    }
    case "error":
      return fail(state, frame, command, outcome.message);
  }
}

export function executeScriptCommand(
  state: InterpreterState,
  frame: Frame,
  command: ScriptCommand,
  exec: ExecuteCommandFn
): CommandExecution {
  const ctx: HostContext = { state, exec, source: sourceLabel(state, command) };
  const existing = state.scriptRuns?.get(frame);
  if (existing) {
    if (existing.command === command && existing.waiting && !existing.isDisposed) {
      return follow(state, frame, command, existing.resolveCurrent(ctx));
    }
    // Stale run (label jump, edited command list): start over.
    existing.dispose();
    state.scriptRuns?.delete(frame);
  }

  if (!command.compiled.trim()) {
    if (command.source.trim()) return fail(state, frame, command, "This script was never compiled. Open it in the editor and save (or use the assistant's author_script tool).");
    frame.pc += 1;
    return { kind: "continue" };
  }

  const module = scriptEngineModule();
  if (!module) {
    const failure = scriptEngineLoadFailure();
    if (failure) return fail(state, frame, command, `The script engine could not load: ${failure}`);
    requestScriptEngine();
    const polls = (enginePolls.get(frame) ?? 0) + 1;
    if (polls > ENGINE_POLL_LIMIT) {
      enginePolls.delete(frame);
      return fail(state, frame, command, "The script engine did not finish loading in time.");
    }
    enginePolls.set(frame, polls);
    // Same re-entry trick as a child frame: the wait's resume does pc += 1 and lands here again.
    frame.pc -= 1;
    return { kind: "pause", pending: "wait", step: { kind: "wait", ms: 16 } };
  }
  enginePolls.delete(frame);

  let run: ScriptRun;
  try {
    run = new ScriptRun(module, command);
  } catch (error) {
    return fail(state, frame, command, `Could not start the script sandbox: ${error instanceof Error ? error.message : String(error)}`);
  }
  runsOf(state).set(frame, run);
  return follow(state, frame, command, run.start(ctx, command.compiled));
}
