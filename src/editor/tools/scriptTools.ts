// editor/tools/scriptTools.ts — assistant tools for sandboxed TypeScript event scripts (openwiki/script-sandbox.md).
//
// The model writes TypeScript against the generated `game` API (.d.ts with this project's ids). Every write
// compiles first and rejects on errors with English diagnostics, so the model fixes and retries; only
// compiled scripts reach the project (the generic event tools refuse hand-written `{kind:"script"}`).
// `dry_run_script` runs a script headless on a copy of the project with scripted answers and reports what
// happened. Compiler and QuickJS are lazy: every tool awaits them in `prepare` because `run` is synchronous.
//
// Model-facing text is English. Skill: assistant-skills/event-scripts/SKILL.md.
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import {
  compileScript,
  formatScriptDiagnostics,
  prepareScriptCompiler,
  scriptCommandFields,
  scriptCompilerReady,
  type ScriptCompileResult,
} from "@/editor/script/compile";
import { commandsToScript } from "@/editor/script/eventToScript";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { preloadScriptEngine, scriptEngineModule } from "@/player/script/engine";
import { onScriptLog } from "@/player/script/scriptLog";
import { buildGameApiDts, scriptApiCheatSheet, scriptDtsIds } from "@/project/script/dts";
import { findScriptModule } from "@/project/script/library";
import {
  SCRIPT_LIBRARY_ID_PATTERN,
  SCRIPT_LIBRARY_LIMIT,
  scriptCompiledIsFresh,
  type ScriptModule,
} from "@/project/script/types";
import { startSession } from "@/project/session";
import type { Command, GameEvent, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type ScriptCommand = Extract<Command, { kind: "script" }>;

// ── lazy runtime ─────────────────────────────────────────────────────────────

const prepareCompiler = async (): Promise<void> => {
  await prepareScriptCompiler();
};
const prepareCompilerAndEngine = async (): Promise<void> => {
  await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
};

function requireCompiler(): void {
  if (!scriptCompilerReady()) {
    throw new ToolError("The TypeScript compiler did not load, so the script cannot be checked. Call the tool again.", { code: "script-compiler-unavailable" });
  }
}

// ── targets ──────────────────────────────────────────────────────────────────

interface ScriptTarget {
  readonly label: string;
  readonly mapId?: string;
  readonly eventId?: string;
  readonly commands: Command[];
  replace(next: Command[]): void;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function resolveTarget(project: Project, args: Record<string, unknown>): ScriptTarget {
  const commonEventId = str(args.commonEventId);
  const mapId = str(args.mapId);
  const eventId = str(args.eventId);
  if (commonEventId && (mapId || eventId)) {
    throw new ToolError("Give either commonEventId, or mapId + eventId — not both.", { code: "invalid-args" });
  }
  if (commonEventId) {
    const common = project.commonEvents.find((entry) => entry.id === commonEventId);
    if (!common) {
      const ids = project.commonEvents.slice(0, 20).map((entry) => entry.id).join(", ");
      throw new ToolError(`Common event '${commonEventId}' does not exist. Existing: ${ids || "(none)"}.`, { code: "invalid-args" });
    }
    common.commands ??= [];
    return { label: `common event ${commonEventId}`, commands: common.commands, replace: (next) => { common.commands = next; } };
  }
  if (!mapId || !eventId) {
    throw new ToolError("Address the script's owner: mapId + eventId (+ pageIndex), or commonEventId.", { code: "invalid-args" });
  }
  const map = requireMap(project, mapId);
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) {
    const ids = map.events.slice(0, 30).map((entry) => entry.id).join(", ");
    throw new ToolError(`Event '${eventId}' is not on map ${mapId}. Events there: ${ids || "(none)"}. Use find_events.`, { code: "event-not-found", mapId });
  }
  return pageTarget(mapId, event, args.pageIndex);
}

function pageTarget(mapId: string, event: GameEvent, rawIndex: unknown): ScriptTarget {
  const pages = event.pages ?? [];
  if (!pages.length) {
    event.commands ??= [];
    return { label: `event ${event.id}`, mapId, eventId: event.id, commands: event.commands, replace: (next) => { event.commands = next; } };
  }
  const index = typeof rawIndex === "number" ? Math.trunc(rawIndex) : 0;
  const page = pages[index];
  if (!page) throw new ToolError(`Event '${event.id}' has ${pages.length} page(s); pageIndex ${index} does not exist (0-based).`, { code: "invalid-args" });
  page.commands ??= [];
  return { label: `event ${event.id} page ${index}`, mapId, eventId: event.id, commands: page.commands, replace: (next) => { page.commands = next; } };
}

/** Branch lists of a command (choices, fork, loop, battle results, shop/inn/promote branches…). */
function childLists(command: Command): Command[][] {
  const out: Command[][] = [];
  for (const [key, value] of Object.entries(command as unknown as Record<string, unknown>)) {
    if (!Array.isArray(value) || !value.length) continue;
    if (key === "options") {
      for (const option of value as { branch?: unknown }[]) if (Array.isArray(option?.branch)) out.push(option.branch as Command[]);
      continue;
    }
    const first = value[0] as unknown;
    if (first && typeof first === "object" && "kind" in (first as object)) out.push(value as Command[]);
  }
  return out;
}

interface FoundScript {
  readonly list: Command[];
  readonly index: number;
  readonly command: ScriptCommand;
}

function scriptsIn(list: Command[], out: FoundScript[] = [], depth = 0): FoundScript[] {
  if (depth > 40) return out;
  list.forEach((command, index) => {
    if (!command || typeof command !== "object") return;
    if (command.kind === "script") out.push({ list, index, command });
    for (const child of childLists(command)) scriptsIn(child, out, depth + 1);
  });
  return out;
}

function findScript(target: ScriptTarget, args: Record<string, unknown>): FoundScript {
  const path = Array.isArray(args.commandPath) ? (args.commandPath as unknown[]).map((value) => Number(value)) : [];
  const name = str(args.name);
  const all = scriptsIn(target.commands);
  const listing = all.map((found) => `${found.command.name ? `"${found.command.name}"` : "(unnamed)"} at top-level index ${target.commands.indexOf(found.command)}`).join("; ");
  if (path.length) {
    if (path.some((value) => !Number.isInteger(value)) || path.length % 2 === 0) {
      throw new ToolError("commandPath is [index] for a top-level command, or [index, branch, index, …] for a nested one (odd length, integers).", { code: "invalid-args" });
    }
    const list = resolveCommandListAtPath(target.commands, path);
    const index = path[path.length - 1]!;
    const command = list?.[index];
    if (!list || !command || command.kind !== "script") {
      throw new ToolError(`No script command at commandPath ${JSON.stringify(path)} in ${target.label}. Scripts there: ${listing || "(none)"}.`, { code: "invalid-args" });
    }
    return { list, index, command };
  }
  if (name) {
    const matches = all.filter((found) => found.command.name === name);
    if (matches.length === 1) return matches[0]!;
    throw new ToolError(matches.length
      ? `${matches.length} scripts in ${target.label} are named "${name}"; address one with commandPath.`
      : `No script named "${name}" in ${target.label}. Scripts there: ${listing || "(none)"}.`, { code: "invalid-args" });
  }
  if (all.length === 1) return all[0]!;
  throw new ToolError(`Say which script: commandPath or name. Scripts in ${target.label}: ${listing || "(none)"}.`, { code: "invalid-args" });
}

// ── compile helpers ──────────────────────────────────────────────────────────

function nonErrors(result: ScriptCompileResult): string[] {
  return result.diagnostics.filter((diagnostic) => diagnostic.severity !== "error")
    .map((diagnostic) => `L${diagnostic.line}:${diagnostic.column} ${diagnostic.severity}: ${diagnostic.message}`);
}

function compileOrThrow(project: Project, source: string, mapId: string | undefined, libraryId?: string): ScriptCompileResult {
  requireCompiler();
  if (!source.trim()) throw new ToolError("source is empty. Write the TypeScript body of the script.", { code: "invalid-args" });
  const result = compileScript(source, { project, ...(mapId ? { mapId } : {}), ...(libraryId ? { libraryId } : {}) });
  if (!result.ok || !result.compiled) {
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    throw new ToolError(
      `The script did not compile, so nothing was changed. Fix these and call again (get_script_api shows the typed API):\n${formatScriptDiagnostics(errors.length ? errors : result.diagnostics)}`,
      { code: "script-compile-error" },
    );
  }
  return result;
}

const TARGET_PROPS: Record<string, JsonSchema> = {
  mapId: { type: "string", description: "Map of the event that owns the script." },
  eventId: { type: "string", description: "Event id on that map (find_events / get_event)." },
  pageIndex: { type: "integer", minimum: 0, description: "Event page, 0-based. Default 0." },
  commonEventId: { type: "string", description: "Instead of mapId+eventId: the common event that owns the script." },
};

const COMMAND_PATH: JsonSchema = {
  type: "array",
  items: { type: "integer" },
  description: "Where the script command is: [index] in the top-level list, or [index, branch, index, …] for a nested one (same paths as other event tools). Or use name.",
};

// ── check_script ─────────────────────────────────────────────────────────────

const checkScript: ToolDefinition = {
  name: "check_script",
  description: "Type-check a TypeScript event script against this project's game API without changing anything. Returns ok, diagnostics (line:col), what it reads/writes and a one-line summary. Use before author_script when unsure; get_script_api shows the API.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      source: { type: "string", description: "TypeScript script body (top-level await allowed)." },
      mapId: { type: "string", description: "Map whose event ids the script may name (EventId type). Optional." },
      libraryId: { type: "string", description: "Check it as the library module @lib/<id> instead of an event script." },
    },
    required: ["source"],
    additionalProperties: false,
  },
  prepare: prepareCompiler,
  run(project, args): ToolExecResult {
    requireCompiler();
    const source = typeof args.source === "string" ? args.source : "";
    const mapId = str(args.mapId) || undefined;
    if (mapId) requireMap(project, mapId);
    const result = compileScript(source, { project, ...(mapId ? { mapId } : {}), ...(str(args.libraryId) ? { libraryId: str(args.libraryId) } : {}) });
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    return {
      summary: result.ok
        ? `Script compiles${result.diagnostics.length ? ` with ${result.diagnostics.length} warning(s)` : ""}. ${result.summary}`.trim()
        : `Script has ${errors} error(s).`,
      data: { ok: result.ok, diagnostics: formatScriptDiagnostics(result.diagnostics), effects: result.effects, summary: result.summary },
    };
  },
};

// ── author_script / edit_script ──────────────────────────────────────────────

const authorScript: ToolDefinition = {
  name: "author_script",
  description: "Insert a NEW `script` command (TypeScript using the game API) into an event page or common event. It compiles first: on errors nothing changes and you get the diagnostics to fix. Prefer one script over long command lists for logic with conditions, math, loops or many branches (puzzles, formulas, time/inventory checks). Then test it with dry_run_script.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      ...TARGET_PROPS,
      source: { type: "string", description: "TypeScript script body. Always await awaitable calls (showMessage, showChoices, wait, battle, transfer, cmd …)." },
      name: { type: "string", description: "Short label shown in the event list (e.g. 'lever puzzle')." },
      index: { type: "integer", minimum: 0, description: "Insert position in the top-level command list. Default: append at the end." },
    },
    required: ["source"],
    additionalProperties: false,
  },
  prepare: prepareCompiler,
  run(draft, args): ToolExecResult {
    const target = resolveTarget(draft, args);
    const source = typeof args.source === "string" ? args.source : "";
    const result = compileOrThrow(draft, source, target.mapId);
    const command = scriptCommandFields(source, result, str(args.name) || undefined);
    const index = typeof args.index === "number" ? Math.max(0, Math.min(target.commands.length, Math.trunc(args.index))) : target.commands.length;
    target.commands.splice(index, 0, command);
    const warnings = nonErrors(result);
    return {
      summary: `Added script${command.name ? ` "${command.name}"` : ""} to ${target.label} at index ${index}. ${result.summary}`.trim(),
      ...(warnings.length ? { warnings } : {}),
      data: { commandPath: [index], ...(target.mapId ? { mapId: target.mapId, eventId: target.eventId } : {}), summary: result.summary, effects: result.effects },
    };
  },
};

const editScript: ToolDefinition = {
  name: "edit_script",
  description: "Replace the source of an existing `script` command (addressed by commandPath or name; if the page has one script it is found automatically). Recompiles; on errors nothing changes and you get the diagnostics.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      ...TARGET_PROPS,
      commandPath: COMMAND_PATH,
      name: { type: "string", description: "Find the script by its name (when commandPath is not given)." },
      source: { type: "string", description: "The full new TypeScript source." },
      rename: { type: "string", description: "New label for the script. Omit to keep it." },
    },
    required: ["source"],
    additionalProperties: false,
  },
  prepare: prepareCompiler,
  run(draft, args): ToolExecResult {
    const target = resolveTarget(draft, args);
    const found = findScript(target, args);
    const source = typeof args.source === "string" ? args.source : "";
    const result = compileOrThrow(draft, source, target.mapId);
    const name = str(args.rename) || found.command.name;
    found.list[found.index] = scriptCommandFields(source, result, name);
    const warnings = nonErrors(result);
    return {
      summary: `Updated script${name ? ` "${name}"` : ""} in ${target.label}. ${result.summary}`.trim(),
      ...(warnings.length ? { warnings } : {}),
      data: { summary: result.summary, effects: result.effects },
    };
  },
};

// ── dry_run_script ───────────────────────────────────────────────────────────

const DRY_RUN_DEFAULT_STEPS = 200;
const DRY_RUN_MAX_STEPS = 1000;

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

function diffRecord<T>(before: Record<string, T>, after: Record<string, T>, fallback: T): Record<string, { from: T; to: T }> {
  const out: Record<string, { from: T; to: T }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key.startsWith("__script")) continue;
    const from = before[key] ?? fallback;
    const to = after[key] ?? fallback;
    if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
  }
  return out;
}

function changesOf(before: Snapshot, after: Snapshot): Record<string, unknown> {
  const selfSwitches: Record<string, { from: boolean; to: boolean }> = {};
  for (const eventId of new Set([...Object.keys(before.selfSwitches), ...Object.keys(after.selfSwitches)])) {
    for (const [key, change] of Object.entries(diffRecord(before.selfSwitches[eventId] ?? {}, after.selfSwitches[eventId] ?? {}, false as boolean | undefined))) {
      selfSwitches[`${eventId}.${key}`] = { from: change.from === true, to: change.to === true };
    }
  }
  const out: Record<string, unknown> = {};
  const switches = diffRecord(before.switches, after.switches, false);
  const variables = diffRecord(before.variables, after.variables, 0);
  const strings = diffRecord(before.strings, after.strings, "");
  const items = diffRecord(before.items, after.items, 0);
  if (Object.keys(switches).length) out.switches = switches;
  if (Object.keys(variables).length) out.variables = variables;
  if (Object.keys(strings).length) out.textVariables = strings;
  if (Object.keys(selfSwitches).length) out.selfSwitches = selfSwitches;
  if (Object.keys(items).length) out.items = items;
  if (before.gold !== after.gold) out.gold = { from: before.gold, to: after.gold };
  return out;
}

const BATTLE_RESULTS = ["victory", "defeat", "escape"] as const;

const dryRunScript: ToolDefinition = {
  name: "dry_run_script",
  description: "Run a script headless on a COPY of the project (nothing is saved) and report a transcript (messages, choices, battles, transfers, waits), the final switch/variable/gold/item changes, script log lines and errors. Give source to test unsaved code, or address an existing script (commandPath/name), or give only the target to run the whole page. Answer prompts in order with choices / numbers / battleResults (defaults: choice 0, number 0, victory). Preset state with switches / variables / gold / items.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      ...TARGET_PROPS,
      source: { type: "string", description: "TypeScript to run (compiled on the fly). Omit to run an existing script or the whole page." },
      commandPath: COMMAND_PATH,
      name: { type: "string", description: "Run the existing script with this name." },
      choices: { type: "array", items: { type: "integer" }, description: "Answers for choice windows in order (0-based index; -1 = cancel)." },
      numbers: { type: "array", items: { type: "integer" }, description: "Answers for number inputs in order." },
      battleResults: { type: "array", items: { type: "string", enum: [...BATTLE_RESULTS] }, description: "Results of battles in order." },
      switches: {
        type: "array",
        description: "Switch values to set before running.",
        items: { type: "object", properties: { id: { type: "string" }, value: { type: "boolean" } }, required: ["id", "value"], additionalProperties: false },
      },
      variables: {
        type: "array",
        description: "Variable values to set before running.",
        items: { type: "object", properties: { id: { type: "string" }, value: { type: "number" } }, required: ["id", "value"], additionalProperties: false },
      },
      gold: { type: "integer", minimum: 0, description: "Party gold before running." },
      items: {
        type: "array",
        description: "Inventory counts to set before running.",
        items: { type: "object", properties: { id: { type: "string" }, count: { type: "integer", minimum: 0 } }, required: ["id", "count"], additionalProperties: false },
      },
      maxSteps: { type: "integer", minimum: 1, maximum: DRY_RUN_MAX_STEPS, description: `Stop after this many interpreter steps (default ${DRY_RUN_DEFAULT_STEPS}).` },
    },
    required: [],
    additionalProperties: false,
  },
  prepare: prepareCompilerAndEngine,
  run(original, args): ToolExecResult {
    if (!scriptEngineModule()) {
      throw new ToolError("The script engine (QuickJS) did not load, so the script cannot run. Call dry_run_script again.", { code: "script-engine-unavailable" });
    }
    const project = structuredClone(original);
    // mapId alone is only context (event ids for the type check, the map the run starts on).
    const hasTarget = !!(str(args.commonEventId) || str(args.eventId));
    const target = hasTarget ? resolveTarget(project, args) : undefined;
    const source = typeof args.source === "string" ? args.source : "";
    const mapId = target?.mapId ?? (str(args.mapId) || undefined);
    const warnings: string[] = [];
    let commands: Command[];
    let what: string;
    if (source.trim()) {
      const result = compileOrThrow(project, source, mapId);
      warnings.push(...nonErrors(result));
      commands = [scriptCommandFields(source, result)];
      what = "the given source";
    } else if (target && (Array.isArray(args.commandPath) && args.commandPath.length || str(args.name))) {
      const found = findScript(target, args);
      let command = found.command;
      if (!scriptCompiledIsFresh(command)) {
        const result = compileOrThrow(project, command.source, mapId);
        command = scriptCommandFields(command.source, result, command.name);
        warnings.push("The stored compiled code was stale; ran a fresh compile of the source (edit_script to save it).");
      }
      commands = [command];
      what = `script${command.name ? ` "${command.name}"` : ""} in ${target.label}`;
    } else if (target) {
      commands = target.commands;
      what = `the whole ${target.label}`;
    } else {
      throw new ToolError("Give source, or a target (mapId+eventId or commonEventId) with an optional commandPath/name.", { code: "invalid-args" });
    }

    const session = startSession(project, 1);
    let eventId: string | undefined;
    if (mapId && project.maps[mapId]) {
      session.currentMapId = mapId;
      const event = target?.eventId ? project.maps[mapId]!.events.find((entry) => entry.id === target.eventId) : undefined;
      if (event) {
        eventId = event.id;
        session.x = event.x;
        session.y = Math.min(project.maps[mapId]!.height - 1, event.y + 1);
      }
    }
    for (const entry of (args.switches as { id: string; value: boolean }[] | undefined) ?? []) session.switches[entry.id] = entry.value;
    for (const entry of (args.variables as { id: string; value: number }[] | undefined) ?? []) session.variables[entry.id] = Math.trunc(entry.value);
    for (const entry of (args.items as { id: string; count: number }[] | undefined) ?? []) session.inventory[entry.id] = entry.count;
    if (typeof args.gold === "number") session.gold = Math.max(0, Math.trunc(args.gold));

    const choices = [...((args.choices as number[] | undefined) ?? [])];
    const numbers = [...((args.numbers as number[] | undefined) ?? [])];
    const battles = [...((args.battleResults as string[] | undefined) ?? [])];
    const maxSteps = typeof args.maxSteps === "number" ? Math.max(1, Math.min(DRY_RUN_MAX_STEPS, Math.trunc(args.maxSteps))) : DRY_RUN_DEFAULT_STEPS;
    const before = snapshot(session);
    const transcript: string[] = [];
    const log: string[] = [];
    const errors: string[] = [];
    const stop = onScriptLog((entry) => {
      (entry.level === "error" ? errors : log).push(entry.message);
    });
    let endedBy: "done" | "transfer" | "maxSteps" | "exception" = "done";
    try {
      const interpreter = createInterpreter(commands, session, project, eventId ? { currentEventId: eventId } : undefined);
      let step: StepResult = interpreter.start();
      let count = 0;
      while (step.kind !== "done") {
        if (count >= maxSteps) { endedBy = "maxSteps"; break; }
        count += 1;
        let answer: unknown;
        switch (step.kind) {
          case "text":
            if (step.body.startsWith("[Script error")) transcript.push(`ERROR ${step.body}`);
            else transcript.push(`message${step.speaker ? ` (${step.speaker})` : ""}: ${step.body}`);
            break;
          case "choices": {
            const given = choices.shift();
            const pick = typeof given === "number" ? given : 0;
            answer = pick;
            const picked = pick >= 0 ? step.options[pick]?.text ?? "?" : "cancel";
            transcript.push(`choices${step.prompt ? ` "${step.prompt}"` : ""}: [${step.options.map((option) => option.text).join(" | ")}] → ${pick} (${picked})${given === undefined ? " [default]" : ""}`);
            break;
          }
          case "inputNumber": {
            const given = numbers.shift();
            answer = typeof given === "number" ? given : 0;
            transcript.push(`number input${step.prompt ? ` "${step.prompt}"` : ""} (${step.digits} digits) → ${String(answer)}${given === undefined ? " [default]" : ""}`);
            break;
          }
          case "battleProcessing": {
            const given = battles.shift();
            const result = given === "defeat" || given === "escape" ? given : "victory";
            session.battleResult = result;
            answer = result;
            transcript.push(`battle ${step.troopId} (canLose ${step.canLose}) → ${result}${given === undefined ? " [default]" : ""}`);
            break;
          }
          case "transfer":
            transcript.push(`transfer → ${step.mapId} (${step.x}, ${step.y})`);
            endedBy = "transfer";
            break;
          case "wait":
            transcript.push(`wait ${step.ms}ms`);
            break;
          default:
            transcript.push(step.kind);
        }
        step = interpreter.resume(answer as never);
      }
    } catch (cause) {
      endedBy = "exception";
      errors.push(cause instanceof Error ? cause.message : String(cause));
    } finally {
      stop();
    }
    for (const line of transcript) if (line.startsWith("ERROR ") && !errors.some((error) => line.includes(error))) errors.push(line.slice(6));
    const changes = changesOf(before, snapshot(session));
    const ok = errors.length === 0 && endedBy !== "maxSteps";
    return {
      summary: `Dry run of ${what}: ${transcript.length} step(s), ended by ${endedBy}${errors.length ? `, ${errors.length} error(s)` : ""}. Nothing was saved.`,
      ...(warnings.length ? { warnings } : {}),
      data: { ok, endedBy, transcript, changes, log, errors },
    };
  },
};

// ── get_script_api ───────────────────────────────────────────────────────────

const getScriptApi: ToolDefinition = {
  name: "get_script_api",
  description: "Get the typed game API scripts are checked against: the .d.ts with this project's switch/variable/item/actor/map/event ids as literal types. Read it once before writing scripts. format:'cheatsheet' gives a shorter one-line-per-call list.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "Include this map's event ids in the EventId type." },
      format: { type: "string", enum: ["dts", "cheatsheet"], description: "dts (default) = full declaration file; cheatsheet = compact list." },
    },
    required: [],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const mapId = str(args.mapId) || undefined;
    if (mapId) requireMap(project, mapId);
    if (args.format === "cheatsheet") {
      return { summary: "Game script API (cheat sheet).", data: { cheatSheet: scriptApiCheatSheet() } };
    }
    return { summary: `Game script API .d.ts${mapId ? ` with event ids of ${mapId}` : ""}.`, data: { dts: buildGameApiDts(scriptDtsIds(project, mapId)) } };
  },
};

// ── library ──────────────────────────────────────────────────────────────────

function dependents(project: Project, libraryId: string): string[] {
  const out: string[] = [];
  const marker = `@lib/${libraryId}`;
  const visit = (label: string, commands: Command[] | undefined): void => {
    for (const found of scriptsIn(commands ?? [])) if (found.command.source.includes(marker)) out.push(label);
  };
  for (const common of project.commonEvents) visit(`common event ${common.id}`, common.commands);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      visit(`${map.id}/${event.id}`, event.commands);
      (event.pages ?? []).forEach((page, index) => visit(`${map.id}/${event.id} page ${index}`, page.commands));
    }
  }
  for (const module of project.scriptLibrary ?? []) if (module.id !== libraryId && module.source.includes(marker)) out.push(`@lib/${module.id}`);
  return [...new Set(out)];
}

const upsertScriptModule: ToolDefinition = {
  name: "upsert_script_module",
  description: "Create or replace a shared script library module. Scripts import it with `import { fn } from \"@lib/<id>\"` — use it for helpers several events share (price formulas, puzzle checks). Compiles first; on errors nothing changes. Library code cannot use top-level await.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", pattern: SCRIPT_LIBRARY_ID_PATTERN.source, description: "Module id: lowercase letters, digits, _ or -, starting with a letter (e.g. 'shop', 'lever_puzzle')." },
      source: { type: "string", description: "TypeScript module source with exports." },
      name: { type: "string", description: "Human label." },
      description: { type: "string", description: "One line: what the module provides." },
    },
    required: ["id", "source"],
    additionalProperties: false,
  },
  prepare: prepareCompiler,
  run(draft, args): ToolExecResult {
    const id = str(args.id);
    if (!SCRIPT_LIBRARY_ID_PATTERN.test(id)) throw new ToolError(`Module id '${id}' is invalid: lowercase letters, digits, _ or -, starting with a letter, max 40.`, { code: "invalid-args" });
    const source = typeof args.source === "string" ? args.source : "";
    const result = compileOrThrow(draft, source, undefined, id);
    const library = (draft.scriptLibrary ??= []);
    const existing = findScriptModule(library, id);
    if (!existing && library.length >= SCRIPT_LIBRARY_LIMIT) throw new ToolError(`The script library is full (${SCRIPT_LIBRARY_LIMIT} modules).`, { code: "invalid-args" });
    const module: ScriptModule = {
      id,
      source,
      compiled: result.compiled,
      effects: result.effects,
      sourceHash: result.sourceHash,
      apiVersion: result.apiVersion,
      ...(str(args.name) ? { name: str(args.name) } : existing?.name ? { name: existing.name } : {}),
      ...(str(args.description) ? { description: str(args.description) } : existing?.description ? { description: existing.description } : {}),
    };
    if (existing) library[library.indexOf(existing)] = module;
    else library.push(module);
    const users = existing ? dependents(draft, id) : [];
    const warnings = [
      ...nonErrors(result),
      ...(users.length ? [`Scripts importing @lib/${id}: ${users.slice(0, 12).join(", ")}. Re-check them with check_script if you changed exports.`] : []),
    ];
    return {
      summary: `${existing ? "Updated" : "Created"} library module @lib/${id}.`,
      ...(warnings.length ? { warnings } : {}),
      data: { id, import: `@lib/${id}`, effects: result.effects },
    };
  },
};

const listScriptModules: ToolDefinition = {
  name: "list_script_modules",
  description: "List the project's shared script library modules (@lib/<id>) with their exports. includeSource:true also returns the source.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      includeSource: { type: "boolean", description: "Also return each module's source." },
      id: { type: "string", description: "Only this module." },
    },
    required: [],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const only = str(args.id);
    const modules = (project.scriptLibrary ?? []).filter((module) => !only || module.id === only);
    const exportsOf = (source: string): string[] => [...source.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gu)].map((match) => match[1]!);
    return {
      summary: modules.length ? `${modules.length} script module(s): ${modules.map((module) => module.id).join(", ")}.` : "The project has no script library modules.",
      data: modules.map((module) => ({
        id: module.id,
        import: `@lib/${module.id}`,
        ...(module.name ? { name: module.name } : {}),
        ...(module.description ? { description: module.description } : {}),
        exports: exportsOf(module.source),
        fresh: scriptCompiledIsFresh(module),
        ...(args.includeSource === true ? { source: module.source } : {}),
      })),
    };
  },
};

// ── whole-event logic as TypeScript ──────────────────────────────────────────

const readEventAsScript: ToolDefinition = {
  name: "read_event_as_script",
  description: "Read an event page's (or common event's) command list as TypeScript using the game API — easier to follow than nested JSON. Commands without a direct API call appear as `await game.cmd({...exact JSON...})`. Read-only; to replace the page with your rewrite use write_event_as_script.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { ...TARGET_PROPS },
    required: [],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const target = resolveTarget(project, args);
    const converted = commandsToScript(target.commands, [`${target.label} — ${target.commands.length} command(s), read with read_event_as_script`]);
    return {
      summary: `${target.label} as TypeScript: ${converted.translated} command(s) as game calls, ${converted.passthrough} kept as game.cmd${converted.passthroughKinds.length ? ` (${converted.passthroughKinds.join(", ")})` : ""}.`,
      data: { source: converted.source, translated: converted.translated, passthrough: converted.passthrough },
    };
  },
};

const writeEventAsScript: ToolDefinition = {
  name: "write_event_as_script",
  description: "Replace the WHOLE command list of an event page (or common event) with ONE script command compiled from source. Every existing command on that page is removed — read it first with read_event_as_script and keep what must stay. Requires confirm:true. Compiles first; on errors nothing changes. Test afterwards with dry_run_script.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      ...TARGET_PROPS,
      source: { type: "string", description: "The full TypeScript that replaces the page's commands." },
      name: { type: "string", description: "Label for the script command." },
      confirm: { type: "boolean", description: "Must be true: you accept that the page's current commands are replaced." },
    },
    required: ["source", "confirm"],
    additionalProperties: false,
  },
  prepare: prepareCompiler,
  run(draft, args): ToolExecResult {
    if (args.confirm !== true) throw new ToolError("write_event_as_script replaces every command on the page. Set confirm:true once you have read the page (read_event_as_script) and your source keeps what must stay.", { code: "confirm-required" });
    const target = resolveTarget(draft, args);
    const source = typeof args.source === "string" ? args.source : "";
    const result = compileOrThrow(draft, source, target.mapId);
    const replaced = target.commands.length;
    target.replace([scriptCommandFields(source, result, str(args.name) || undefined)]);
    const warnings = nonErrors(result);
    return {
      summary: `Replaced ${replaced} command(s) of ${target.label} with one script. ${result.summary}`.trim(),
      ...(warnings.length ? { warnings } : {}),
      data: { replaced, commandPath: [0], summary: result.summary, effects: result.effects },
    };
  },
};

export const SCRIPT_TOOLS: readonly ToolDefinition[] = [
  checkScript,
  authorScript,
  editScript,
  dryRunScript,
  getScriptApi,
  upsertScriptModule,
  listScriptModules,
  readEventAsScript,
  writeEventAsScript,
];

export const SCRIPT_TOOL_NAMES: readonly string[] = SCRIPT_TOOLS.map((tool) => tool.name);

