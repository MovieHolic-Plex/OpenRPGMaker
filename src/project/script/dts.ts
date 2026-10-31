// project/script/dts.ts — builds the `.d.ts` that scripts are type-checked against, from SCRIPT_API.
//
// With a project, id aliases list that project's ids (`SwitchId = "sw_door" | … | (string & {})`) so the
// editor can autocomplete them; unknown ids are still allowed by the types and reported by the analyzer
// (src/editor/script/analyze.ts) as warnings with a "did you mean" hint.
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { EMOTE_KINDS } from "@/project/emotes";
import type { Project } from "@/project/types";
import { SCRIPT_API, SCRIPT_API_GROUP_LABELS, type ScriptApiEntry, type ScriptApiGroup } from "./apiSpec";
import { SCRIPT_API_VERSION } from "./types";

/** Cap per alias so a huge project does not produce a megabyte of literal unions. */
const ID_UNION_LIMIT = 400;

function quote(id: string): string {
  return JSON.stringify(id);
}

function idUnion(ids: readonly string[]): string {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(0, ID_UNION_LIMIT);
  return unique.length ? `${unique.map(quote).join(" | ")} | (string & {})` : "string";
}

export interface ScriptDtsIds {
  readonly switches: readonly string[];
  readonly variables: readonly string[];
  readonly strings: readonly string[];
  readonly items: readonly string[];
  readonly actors: readonly string[];
  readonly skills: readonly string[];
  readonly commonEvents: readonly string[];
  readonly maps: readonly string[];
  readonly troops: readonly string[];
  readonly events: readonly string[];
  readonly animations: readonly string[];
}

export function scriptDtsIds(project: Project | undefined, mapId?: string): ScriptDtsIds {
  if (!project) {
    return { switches: [], variables: [], strings: [], items: [], actors: [], skills: [], commonEvents: [], maps: [], troops: [], events: [], animations: [] };
  }
  const map = mapId ? project.maps[mapId] : undefined;
  const db = project.database;
  return {
    switches: project.switches.map((entry) => entry.id),
    variables: project.variables.map((entry) => entry.id),
    strings: [],
    items: db.items.map((entry) => entry.id),
    actors: db.actors.map((entry) => entry.id),
    skills: db.skills.map((entry) => entry.id),
    commonEvents: project.commonEvents.map((entry) => entry.id),
    maps: Object.keys(project.maps),
    troops: db.troops.map((entry) => entry.id),
    events: (map?.events ?? []).map((entry) => entry.id),
    animations: (db.battleAnimations ?? []).map((entry) => entry.id),
  };
}

function entrySignature(entry: ScriptApiEntry): string {
  const returns = entry.awaits ? `Promise<${entry.returns}>` : entry.returns;
  return `  /** ${entry.doc} */\n  ${entry.name}(${entry.params}): ${returns};`;
}

/** Shared helper types (options, info objects, enums) — in the `.d.ts` and at the end of the cheat sheet. */
const SCRIPT_HELPER_TYPE_LINES: readonly string[] = [
  'type SelfSwitchKey = "A" | "B" | "C" | "D";',
  'type Direction = "up" | "down" | "left" | "right";',
  'type TileLayer = "lower" | "upper" | "lower2" | "upper2";',
  'type BattleResult = "victory" | "defeat" | "escape";',
  'type FlashColor = "white" | "red" | "black" | `#${string}`;',
  `type EmoteName = ${EMOTE_KINDS.map(quote).join(" | ")};`,
  'type MoveTarget = "player" | "this" | EventId;',
  "type MoveStep =",
  '  | Direction',
  '  | "face-up" | "face-down" | "face-left" | "face-right" | "face-player" | "face-away"',
  '  | "toward-player" | "away-from-player" | "forward" | "random" | "jump" | "wait"',
  "  | { kind: string; [field: string]: unknown };",
  "type AnimTarget = \"player\" | \"this\" | EventId | { x: number; y: number };",
  "interface MessageOptions { speaker?: string }",
  "interface ChoiceSettings {",
  "  prompt?: string;",
  "  /** 'cancel' → Esc resolves -1. A number → Esc picks that index. Default: Esc does nothing. */",
  "  cancel?: \"cancel\" | number;",
  "}",
  "interface NumberInputSettings { digits?: number; prompt?: string }",
  'interface TransferOptions { direction?: Direction; fade?: "black" | "white" | "none" }',
  "interface MoveOptions { wait?: boolean; skippable?: boolean }",
  "interface TileOptions { layer?: TileLayer; mapId?: MapId }",
  "interface BattleOptions { canEscape?: boolean; canLose?: boolean }",
  "interface AudioOptions { volume?: number }",
  "interface ActorInfo { readonly id: ActorId; readonly name: string; readonly level: number; readonly exp: number; readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number; readonly inParty: boolean }",
  "interface PlayerInfo { readonly mapId: MapId; readonly x: number; readonly y: number; readonly direction: Direction }",
  "interface EventInfo { readonly id: EventId; readonly name: string; readonly x: number; readonly y: number }",
  'interface GameClock { readonly enabled: boolean; readonly hour: number; readonly minute: number; readonly day: number; readonly season: string; readonly year: number; readonly phase: "morning" | "day" | "evening" | "night" }',
];

/** Full `.d.ts` text. Pure; the same text for the same ids. */
export function buildGameApiDts(ids: ScriptDtsIds = scriptDtsIds(undefined)): string {
  const groups = new Map<ScriptApiGroup, ScriptApiEntry[]>();
  for (const entry of SCRIPT_API as readonly ScriptApiEntry[]) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }
  const body: string[] = [];
  for (const [group, entries] of groups) {
    body.push(`  // ── ${SCRIPT_API_GROUP_LABELS[group]}`);
    for (const entry of entries) body.push(entrySignature(entry));
  }
  return [
    `// OPRN game script API v${SCRIPT_API_VERSION}. Generated from src/project/script/apiSpec.ts — do not edit.`,
    "// Scripts run in a sandbox: no DOM, network, storage, timers or Node. Only `game` talks to the engine.",
    "// Awaitable calls (Promise) run through the event interpreter one after another: always `await` them.",
    "// Local variables are NOT saved. Keep anything that must survive a save in switches/variables.",
    "",
    `type SwitchId = ${idUnion(ids.switches)};`,
    `type VariableId = ${idUnion(ids.variables)};`,
    `type StringVariableId = ${idUnion(ids.strings)};`,
    `type ItemId = ${idUnion(ids.items)};`,
    `type ActorId = ${idUnion(ids.actors)};`,
    `type SkillId = ${idUnion(ids.skills)};`,
    `type CommonEventId = ${idUnion(ids.commonEvents)};`,
    `type MapId = ${idUnion(ids.maps)};`,
    `type TroopId = ${idUnion(ids.troops)};`,
    `type EventId = ${idUnion(ids.events)};`,
    `type AnimationId = ${idUnion(ids.animations)};`,
    "type ResourceId = string;",
    ...SCRIPT_HELPER_TYPE_LINES,
    "/** Any event command object (same JSON as event pages). `kind` picks the command; other fields are checked at run time. */",
    `type EventCommand = { kind: ${COMMAND_KINDS.filter((kind) => kind !== "script").map(quote).join(" | ")}; [field: string]: unknown };`,
    "",
    "interface Game {",
    ...body,
    "}",
    "",
    "declare const game: Game;",
    "declare const console: { log(...values: unknown[]): void; warn(...values: unknown[]): void; error(...values: unknown[]): void };",
    "",
  ].join("\n");
}

/** Compact, model-facing API listing (English) for tool results and the skill doc. */
export function scriptApiCheatSheet(): string {
  const lines: string[] = [];
  let group: ScriptApiGroup | undefined;
  for (const entry of SCRIPT_API as readonly ScriptApiEntry[]) {
    if (entry.group !== group) {
      group = entry.group;
      lines.push(`## ${SCRIPT_API_GROUP_LABELS[group]}`);
    }
    const returns = entry.awaits ? `Promise<${entry.returns}>` : entry.returns;
    lines.push(`- game.${entry.name}(${entry.params}): ${returns} — ${entry.doc}`);
  }
  // Field names matter (2026-10-31 live run: Opus guessed `game.player().facing`; the field is `direction`).
  lines.push("## Types", ...SCRIPT_HELPER_TYPE_LINES);
  return lines.join("\n");
}
