// editor/tools/scriptUnwrapTool.ts — write_script_as_commands: replace ONE script command with the ordinary
// event commands it converts to (src/editor/script/scriptToEvent.ts), only when behavior is fully preserved.
//
// Addressed like edit_script (mapId+eventId+pageIndex or commonEventId, then commandPath or name). Needs
// confirm:true. Not convertible → ToolError "script-not-convertible" with the English problem list, project
// unchanged. Kept out of scriptTools.ts on purpose (that file is edited by other work); the small target/script
// lookup below mirrors scriptTools.ts resolveTarget/findScript. Hidden with the other script tools when
// OPRN_V2_SCRIPTS=0 (src/ai/scriptsSwitch.ts SCRIPT_TOOL_NAMES).
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { prepareScriptCompiler, scriptCompilerReady } from "@/editor/script/compile";
import { scriptToCommands, scriptUnwrapProblemText } from "@/editor/script/scriptToEvent";
import type { Command, GameEvent, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type ScriptCommand = Extract<Command, { kind: "script" }>;

interface Target {
  readonly label: string;
  readonly commands: Command[];
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function resolveTarget(project: Project, args: Record<string, unknown>): Target {
  const commonEventId = str(args.commonEventId);
  const mapId = str(args.mapId);
  const eventId = str(args.eventId);
  if (commonEventId && (mapId || eventId)) throw new ToolError("Give either commonEventId, or mapId + eventId — not both.", { code: "invalid-args" });
  if (commonEventId) {
    const common = project.commonEvents.find((entry) => entry.id === commonEventId);
    if (!common) throw new ToolError(`Common event '${commonEventId}' does not exist.`, { code: "invalid-args" });
    common.commands ??= [];
    return { label: `common event ${commonEventId}`, commands: common.commands };
  }
  if (!mapId || !eventId) throw new ToolError("Address the script's owner: mapId + eventId (+ pageIndex), or commonEventId.", { code: "invalid-args" });
  const map = requireMap(project, mapId);
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) throw new ToolError(`Event '${eventId}' is not on map ${mapId}. Use find_events.`, { code: "event-not-found", mapId });
  return pageTarget(event, args.pageIndex);
}

function pageTarget(event: GameEvent, rawIndex: unknown): Target {
  const pages = event.pages ?? [];
  if (!pages.length) {
    event.commands ??= [];
    return { label: `event ${event.id}`, commands: event.commands };
  }
  const index = typeof rawIndex === "number" ? Math.trunc(rawIndex) : 0;
  const page = pages[index];
  if (!page) throw new ToolError(`Event '${event.id}' has ${pages.length} page(s); pageIndex ${index} does not exist (0-based).`, { code: "invalid-args" });
  page.commands ??= [];
  return { label: `event ${event.id} page ${index}`, commands: page.commands };
}

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

function findScript(target: Target, args: Record<string, unknown>): FoundScript {
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

const writeScriptAsCommands: ToolDefinition = {
  name: "write_script_as_commands",
  description: "Replace ONE `script` command with the ordinary event commands it is equivalent to (messages, choices, if/else on simple conditions, while(true)+break, switch/variable/gold/item changes, waits, transfers, battles, common events, game.cmd JSON). Only when behavior is exactly preserved: scripts with formulas, local variables, arrays, other loops, functions, @lib imports, computed ids, ${} text, random or state reads are refused with the lines to change, and nothing changes. Addressed like edit_script. Requires confirm:true.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "Map of the event that owns the script." },
      eventId: { type: "string", description: "Event id on that map (find_events / get_event)." },
      pageIndex: { type: "integer", minimum: 0, description: "Event page, 0-based. Default 0." },
      commonEventId: { type: "string", description: "Instead of mapId+eventId: the common event that owns the script." },
      commandPath: {
        type: "array",
        items: { type: "integer" },
        description: "Where the script command is: [index] in the top-level list, or [index, branch, index, …] for a nested one. Or use name.",
      },
      name: { type: "string", description: "Find the script by its name (when commandPath is not given)." },
      confirm: { type: "boolean", description: "Must be true: you accept that the script command is replaced by commands in place." },
    },
    required: ["confirm"],
    additionalProperties: false,
  },
  prepare: async () => {
    await prepareScriptCompiler();
  },
  run(draft, args): ToolExecResult {
    if (args.confirm !== true) {
      throw new ToolError("write_script_as_commands replaces the script command with ordinary commands. Set confirm:true.", { code: "confirm-required" });
    }
    if (!scriptCompilerReady()) {
      throw new ToolError("The TypeScript compiler did not load, so the script cannot be read. Call the tool again.", { code: "script-compiler-unavailable" });
    }
    const target = resolveTarget(draft, args);
    const found = findScript(target, args);
    const converted = scriptToCommands(found.command.source, { project: draft });
    if (!converted.ok) {
      const lines = converted.problems.map((problem) => `L${problem.line}: ${scriptUnwrapProblemText(problem, "en")} — ${problem.snippet}`);
      throw new ToolError(
        `This script cannot become ordinary commands without changing what it does, so nothing was changed. Keep it as a script, or rewrite these lines first:\n${lines.join("\n")}`,
        { code: "script-not-convertible" },
      );
    }
    found.list.splice(found.index, 1, ...converted.commands);
    const kinds = [...new Set(converted.commands.map((command) => command.kind))];
    const label = found.command.name ? ` "${found.command.name}"` : "";
    return {
      summary: `Replaced script${label} in ${target.label} with ${converted.commands.length} command(s)${kinds.length ? ` (${kinds.join(", ")})` : ""}.`,
      data: { replacedAt: found.index, commands: converted.commands.length, kinds },
    };
  },
};

export const SCRIPT_UNWRAP_TOOLS: readonly ToolDefinition[] = [writeScriptAsCommands];
