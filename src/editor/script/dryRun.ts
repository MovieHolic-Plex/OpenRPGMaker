// editor/script/dryRun.ts — run a command list (usually one `script` command) headless on a project copy.
//
// Shared by the assistant tools (dry_run_script, author_script/edit_script `tests`) and the event editor's
// script card (example table). Nothing is saved: the caller passes a project it may mutate (a clone).
// Requires the QuickJS engine loaded (`preloadScriptEngine()`) when the commands contain scripts.
// Wiki: openwiki/script-sandbox.md.
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { onScriptLog } from "@/player/script/scriptLog";
import { initialGameTime, resolveTimeSystem } from "@/project/gameTime";
import type { ScriptExample } from "@/project/script/types";
import { startSession } from "@/project/session";
import type { Command, Project } from "@/project/types";

export const DRY_RUN_DEFAULT_STEPS = 200;
export const DRY_RUN_MAX_STEPS = 1000;

/** Preset state + scripted answers. Same fields as a stored ScriptExample (minus its label). */
export type DryRunSetup = Omit<ScriptExample, "label">;

export interface DryRunOptions {
  /** Map the run starts on (event ids resolve against it). */
  readonly mapId?: string;
  /** The event running the commands (`this` event, self switches, `game.eventId()`). */
  readonly eventId?: string;
  readonly setup?: DryRunSetup;
  readonly maxSteps?: number;
}

export interface DryRunChange<T> {
  readonly from: T;
  readonly to: T;
}

export interface DryRunChanges {
  readonly switches?: Record<string, DryRunChange<boolean>>;
  readonly variables?: Record<string, DryRunChange<number>>;
  readonly textVariables?: Record<string, DryRunChange<string>>;
  readonly selfSwitches?: Record<string, DryRunChange<boolean>>;
  readonly items?: Record<string, DryRunChange<number>>;
  readonly gold?: DryRunChange<number>;
}

/** One interpreter step the player would see, structured (the tool formats it to English lines). */
export type DryRunStep =
  | { readonly kind: "message"; readonly body: string; readonly speaker?: string }
  | { readonly kind: "error"; readonly body: string }
  | { readonly kind: "choices"; readonly prompt?: string; readonly options: readonly string[]; readonly pick: number; readonly defaulted: boolean }
  | { readonly kind: "number"; readonly prompt?: string; readonly digits: number; readonly value: number; readonly defaulted: boolean }
  | { readonly kind: "battle"; readonly troopId: string; readonly canLose: boolean; readonly result: string; readonly defaulted: boolean }
  | { readonly kind: "transfer"; readonly mapId: string; readonly x: number; readonly y: number }
  | { readonly kind: "wait"; readonly ms: number }
  | { readonly kind: "other"; readonly stepKind: string };

export interface DryRunResult {
  readonly ok: boolean;
  readonly endedBy: "done" | "transfer" | "maxSteps" | "exception";
  readonly steps: readonly DryRunStep[];
  readonly changes: DryRunChanges;
  readonly log: readonly string[];
  readonly errors: readonly string[];
}

interface Snapshot {
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly strings: Record<string, string>;
  readonly selfSwitches: Record<string, Partial<Record<string, boolean>>>;
  readonly gold: number;
  readonly items: Record<string, number>;
}

function snapshot(session: ReturnType<typeof startSession>): Snapshot {
  return structuredClone({
    switches: session.switches ?? {},
    variables: session.variables ?? {},
    strings: session.stringVariables ?? {},
    selfSwitches: session.selfSwitches ?? {},
    gold: session.gold ?? 0,
    items: session.inventory ?? {},
  });
}

function diffRecord<T>(before: Record<string, T>, after: Record<string, T>, fallback: T): Record<string, DryRunChange<T>> {
  const out: Record<string, DryRunChange<T>> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key.startsWith("__script")) continue;
    const from = before[key] ?? fallback;
    const to = after[key] ?? fallback;
    if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
  }
  return out;
}

function changesOf(before: Snapshot, after: Snapshot): DryRunChanges {
  const selfSwitches: Record<string, DryRunChange<boolean>> = {};
  for (const eventId of new Set([...Object.keys(before.selfSwitches), ...Object.keys(after.selfSwitches)])) {
    for (const [key, change] of Object.entries(diffRecord(before.selfSwitches[eventId] ?? {}, after.selfSwitches[eventId] ?? {}, false as boolean | undefined))) {
      selfSwitches[`${eventId}.${key}`] = { from: change.from === true, to: change.to === true };
    }
  }
  const switches = diffRecord(before.switches, after.switches, false);
  const variables = diffRecord(before.variables, after.variables, 0);
  const strings = diffRecord(before.strings, after.strings, "");
  const items = diffRecord(before.items, after.items, 0);
  return {
    ...(Object.keys(switches).length ? { switches } : {}),
    ...(Object.keys(variables).length ? { variables } : {}),
    ...(Object.keys(strings).length ? { textVariables: strings } : {}),
    ...(Object.keys(selfSwitches).length ? { selfSwitches } : {}),
    ...(Object.keys(items).length ? { items } : {}),
    ...(before.gold !== after.gold ? { gold: { from: before.gold, to: after.gold } } : {}),
  };
}

/**
 * Runs `commands` on `project` (mutated — pass a clone) from a fresh session. Prompts are answered from the
 * setup in order (defaults: choice 0, number 0, battle victory).
 */
export function dryRunCommands(project: Project, commands: readonly Command[], options: DryRunOptions = {}): DryRunResult {
  const setup = options.setup ?? {};
  const session = startSession(project, 1);
  let eventId: string | undefined;
  const map = options.mapId ? project.maps[options.mapId] : undefined;
  if (map) {
    session.currentMapId = map.id;
    const event = options.eventId ? map.events.find((entry) => entry.id === options.eventId) : undefined;
    if (event) {
      eventId = event.id;
      session.x = event.x;
      session.y = Math.min(map.height - 1, event.y + 1);
    }
  }
  for (const entry of setup.switches ?? []) session.switches[entry.id] = entry.value;
  for (const entry of setup.variables ?? []) session.variables[entry.id] = Math.trunc(entry.value);
  for (const entry of setup.items ?? []) session.inventory[entry.id] = entry.count;
  if (typeof setup.gold === "number") session.gold = Math.max(0, Math.trunc(setup.gold));

  const choices = [...(setup.choices ?? [])];
  const numbers = [...(setup.numbers ?? [])];
  const battles = [...(setup.battleResults ?? [])];
  const maxSteps = typeof options.maxSteps === "number" ? Math.max(1, Math.min(DRY_RUN_MAX_STEPS, Math.trunc(options.maxSteps))) : DRY_RUN_DEFAULT_STEPS;
  // Clock preset: write the session clock directly (the game's Set Time path needs a play scene). Projects
  // without a time system have no clock — game.time() reports enabled:false there, so the preset is a no-op.
  if (typeof setup.hour === "number") {
    const system = resolveTimeSystem(project);
    const time = system ? session.gameTime ?? initialGameTime(system) : undefined;
    if (time) {
      session.gameTime = {
        ...time,
        hour: Math.max(0, Math.min(23, Math.trunc(setup.hour))),
        minute: typeof setup.minute === "number" ? Math.max(0, Math.min(59, Math.trunc(setup.minute))) : 0,
      };
    }
  }
  const run: Command[] = [...commands];
  const before = snapshot(session);
  const steps: DryRunStep[] = [];
  const log: string[] = [];
  const errors: string[] = [];
  const stop = onScriptLog((entry) => {
    (entry.level === "error" ? errors : log).push(entry.message);
  });
  let endedBy: DryRunResult["endedBy"] = "done";
  try {
    const interpreter = createInterpreter(run, session, project, eventId ? { currentEventId: eventId } : undefined);
    let step: StepResult = interpreter.start();
    let count = 0;
    while (step.kind !== "done") {
      if (count >= maxSteps) { endedBy = "maxSteps"; break; }
      count += 1;
      let answer: unknown;
      switch (step.kind) {
        case "text":
          if (step.body.startsWith("[Script error")) steps.push({ kind: "error", body: step.body });
          else steps.push({ kind: "message", body: step.body, ...(step.speaker ? { speaker: step.speaker } : {}) });
          break;
        case "choices": {
          const given = choices.shift();
          const pick = typeof given === "number" ? given : 0;
          answer = pick;
          steps.push({ kind: "choices", ...(step.prompt ? { prompt: step.prompt } : {}), options: step.options.map((option) => option.text), pick, defaulted: given === undefined });
          break;
        }
        case "inputNumber": {
          const given = numbers.shift();
          const value = typeof given === "number" ? given : 0;
          answer = value;
          steps.push({ kind: "number", ...(step.prompt ? { prompt: step.prompt } : {}), digits: step.digits, value, defaulted: given === undefined });
          break;
        }
        case "battleProcessing": {
          const given = battles.shift();
          const result = given === "defeat" || given === "escape" ? given : "victory";
          session.battleResult = result;
          answer = result;
          steps.push({ kind: "battle", troopId: step.troopId, canLose: step.canLose, result, defaulted: given === undefined });
          break;
        }
        case "transfer":
          steps.push({ kind: "transfer", mapId: step.mapId, x: step.x, y: step.y });
          endedBy = "transfer";
          break;
        case "wait":
          steps.push({ kind: "wait", ms: step.ms });
          break;
        default:
          steps.push({ kind: "other", stepKind: step.kind });
      }
      step = interpreter.resume(answer as never);
    }
  } catch (cause) {
    endedBy = "exception";
    errors.push(cause instanceof Error ? cause.message : String(cause));
  } finally {
    stop();
  }
  for (const entry of steps) if (entry.kind === "error" && !errors.some((error) => entry.body.includes(error))) errors.push(entry.body);
  const changes = changesOf(before, snapshot(session));
  return { ok: errors.length === 0 && endedBy !== "maxSteps", endedBy, steps, changes, log, errors };
}

/** English transcript lines (model-facing), same wording dry_run_script always used. */
export function dryRunTranscript(steps: readonly DryRunStep[]): string[] {
  return steps.map((step) => {
    switch (step.kind) {
      case "message": return `message${step.speaker ? ` (${step.speaker})` : ""}: ${step.body}`;
      case "error": return `ERROR ${step.body}`;
      case "choices": {
        const picked = step.pick >= 0 ? step.options[step.pick] ?? "?" : "cancel";
        return `choices${step.prompt ? ` "${step.prompt}"` : ""}: [${step.options.join(" | ")}] → ${step.pick} (${picked})${step.defaulted ? " [default]" : ""}`;
      }
      case "number": return `number input${step.prompt ? ` "${step.prompt}"` : ""} (${step.digits} digits) → ${String(step.value)}${step.defaulted ? " [default]" : ""}`;
      case "battle": return `battle ${step.troopId} (canLose ${step.canLose}) → ${step.result}${step.defaulted ? " [default]" : ""}`;
      case "transfer": return `transfer → ${step.mapId} (${step.x}, ${step.y})`;
      case "wait": return `wait ${step.ms}ms`;
      default: return step.stepKind;
    }
  });
}
