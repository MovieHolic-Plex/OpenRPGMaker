// project/script/effects.ts — what a `script` command touches, for validators and graphs (player-safe).
//
// The editor extracts `effects` at save time (src/editor/script/analyze.ts). Validators that walk command
// lists ask this module instead of reading `effects` directly, so library imports (`@lib/<id>`) are merged,
// scripts compiled before effects existed count as fully dynamic, and switch/variable names resolve to ids.
// Wiki: openwiki/script-sandbox.md 「검증기」.
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, Project } from "@/project/types";
import { SCRIPT_API_BY_NAME } from "./apiSpec";
import { findScriptModule, normalizeScriptEffects } from "./library";
import { EMPTY_SCRIPT_EFFECTS, SCRIPT_REF_KINDS, type ScriptDynamicRef, type ScriptEffects, type ScriptModule, type ScriptRef, type ScriptRefKind } from "./types";

export type ScriptAccess = "read" | "write" | "call";
const ACCESSES: readonly ScriptAccess[] = ["read", "write", "call"];

/** `game.cmd({ kind, … })` object fields that name ids. Shared with the analyzer. */
export const SCRIPT_CMD_ID_FIELDS: Readonly<Record<string, ScriptRefKind>> = {
  switchId: "switch",
  variableId: "variable",
  stringVariableId: "string",
  itemId: "item",
  actorId: "actor",
  skillId: "skill",
  commonEventId: "commonEvent",
  mapId: "map",
  troopId: "troop",
  eventId: "event",
  animationId: "animation",
  resourceId: "resource",
};
/** `game.cmd` kinds whose id fields are flow targets (call). */
export const SCRIPT_CMD_CALL_KINDS: ReadonlySet<string> = new Set(["callCommonEvent", "callMapEvent", "transfer", "battleProcessing", "tacticsBattle"]);
/** `game.cmd` kinds whose id fields are only read. Every other kind writes. */
export const SCRIPT_CMD_READ_KINDS: ReadonlySet<string> = new Set(["fork", "presentItem", "shop", "playAudio", "showAnimation", "showPicture", "moveEvent"]);

/** Access of a `game.cmd` id field. */
export function scriptCmdAccess(kind: string | undefined): ScriptAccess {
  return kind && SCRIPT_CMD_CALL_KINDS.has(kind) ? "call" : kind && SCRIPT_CMD_READ_KINDS.has(kind) ? "read" : "write";
}

/** Marker api for a script that has no effects record (compiled before effects existed): it may touch anything. */
export const SCRIPT_UNKNOWN_EFFECTS_API = "*";
const FULLY_DYNAMIC: ScriptEffects = Object.freeze({ reads: [], writes: [], calls: [], dynamic: [{ api: SCRIPT_UNKNOWN_EFFECTS_API, line: 0 }] });

/** Anything shaped like a script command or a library module. Raw (unnormalized) commands are accepted. */
export interface ScriptEffectSource {
  readonly kind?: unknown;
  readonly compiled?: unknown;
  readonly effects?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isScriptCommand(command: unknown): command is ScriptEffectSource & { readonly kind: "script" } {
  return isRecord(command) && command.kind === "script";
}

/**
 * Effects recorded on one script command or library module, without library expansion.
 * Missing effects with compiled code = fully dynamic (predates effects). No compiled code = does nothing.
 */
export function scriptCommandEffects(entry: ScriptEffectSource | undefined | null): ScriptEffects {
  if (!entry) return EMPTY_SCRIPT_EFFECTS;
  const effects = normalizeScriptEffects(entry.effects);
  if (effects) return effects;
  return typeof entry.compiled === "string" && entry.compiled.trim() ? FULLY_DYNAMIC : EMPTY_SCRIPT_EFFECTS;
}

function pushUnique(list: ScriptRef[], ref: ScriptRef): void {
  if (!list.some((entry) => entry.kind === ref.kind && entry.id === ref.id)) list.push(ref);
}

/** Merge the effects of imported `@lib` modules, transitively. Cycles and repeats are visited once. */
export function expandScriptEffects(effects: ScriptEffects, library: readonly ScriptModule[] | undefined): ScriptEffects {
  if (!effects.calls.some((ref) => ref.kind === "library")) return effects;
  const reads: ScriptRef[] = [];
  const writes: ScriptRef[] = [];
  const calls: ScriptRef[] = [];
  const dynamic: ScriptDynamicRef[] = [];
  const visited = new Set<string>();
  const merge = (current: ScriptEffects): void => {
    for (const ref of current.reads) pushUnique(reads, ref);
    for (const ref of current.writes) pushUnique(writes, ref);
    for (const ref of current.calls) pushUnique(calls, ref);
    for (const entry of current.dynamic) {
      if (!dynamic.some((other) => other.api === entry.api && other.line === entry.line)) dynamic.push(entry);
    }
    for (const ref of current.calls) {
      if (ref.kind !== "library" || visited.has(ref.id)) continue;
      visited.add(ref.id);
      const module = findScriptModule(library, ref.id);
      if (module) merge(scriptCommandEffects(module));
    }
  };
  merge(effects);
  return { reads, writes, calls, dynamic };
}

/** Effects of a script command with its library imports merged. Empty for non-script commands. */
export function scriptEffectsOf(command: unknown, library: readonly ScriptModule[] | undefined): ScriptEffects {
  if (!isScriptCommand(command)) return EMPTY_SCRIPT_EFFECTS;
  return expandScriptEffects(scriptCommandEffects(command), library);
}

function listFor(effects: ScriptEffects, access: ScriptAccess): readonly ScriptRef[] {
  return access === "read" ? effects.reads : access === "write" ? effects.writes : effects.calls;
}

/**
 * Switch and variable refs may name the record instead of its id (the runtime resolves names).
 * Map them back to ids so validators keyed by id see them. Unknown values are returned as written.
 */
export function resolveScriptRefId(project: Pick<Project, "switches" | "variables"> | undefined, kind: ScriptRefKind, id: string): string {
  if (!project) return id;
  const records = kind === "switch" ? project.switches : kind === "variable" ? project.variables : undefined;
  if (!records || records.some((record) => record.id === id)) return id;
  return records.find((record) => record.name === id)?.id ?? id;
}

function refIds(command: unknown, access: ScriptAccess, kind: ScriptRefKind, project: ScriptProjectContext | undefined): string[] {
  const effects = scriptEffectsOf(command, project?.scriptLibrary);
  const out: string[] = [];
  for (const ref of listFor(effects, access)) {
    if (ref.kind !== kind) continue;
    const id = resolveScriptRefId(project, kind, ref.id);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** The project parts these helpers read. Pass the project itself. */
export type ScriptProjectContext = Pick<Project, "switches" | "variables"> & { readonly scriptLibrary?: readonly ScriptModule[] };

/** Literal ids of `kind` the script writes (library merged, names resolved when `project` is given). */
export function scriptWrites(command: unknown, kind: ScriptRefKind, project?: ScriptProjectContext): string[] {
  return refIds(command, "write", kind, project);
}
export function scriptReads(command: unknown, kind: ScriptRefKind, project?: ScriptProjectContext): string[] {
  return refIds(command, "read", kind, project);
}
/** Flow targets: `commonEvent` = call, `map` = transfer, `troop` = battle, `library` = import. */
export function scriptCalls(command: unknown, kind: ScriptRefKind, project?: ScriptProjectContext): string[] {
  return refIds(command, "call", kind, project);
}

export interface ScriptDynamicKind {
  readonly kind: ScriptRefKind;
  readonly access: ScriptAccess;
}

const EVERYTHING: readonly ScriptDynamicKind[] = SCRIPT_REF_KINDS.flatMap((kind) => ACCESSES.map((access) => ({ kind, access })));

/**
 * Which ref kinds a dynamic entry may touch. `game.<api>` rows use the SCRIPT_API refs table,
 * `cmd.<kind>.<field>` uses the cmd field table; a non-literal `game.cmd(x)` or a script without
 * recorded effects (`*`) may touch anything. Unknown api names count as anything (fail open = quieter validators).
 */
export function dynamicRefKinds(api: string): readonly ScriptDynamicKind[] {
  if (api === SCRIPT_UNKNOWN_EFFECTS_API || api === "cmd") return EVERYTHING;
  if (api.startsWith("cmd.")) {
    const [, cmdKind, field] = api.split(".");
    const kind = field ? SCRIPT_CMD_ID_FIELDS[field] : undefined;
    if (!kind) return EVERYTHING;
    return [{ kind, access: scriptCmdAccess(cmdKind === "?" ? undefined : cmdKind) }];
  }
  const entry = SCRIPT_API_BY_NAME.get(api);
  if (!entry?.refs?.length) return EVERYTHING;
  return entry.refs.map((ref) => ({ kind: ref.kind, access: ref.access }));
}

function effectsHaveDynamic(effects: ScriptEffects, kind?: ScriptRefKind, access?: ScriptAccess): boolean {
  return effects.dynamic.some((entry) => dynamicRefKinds(entry.api).some((hit) =>
    (kind === undefined || hit.kind === kind) && (access === undefined || hit.access === access)));
}

/** Does this script use a computed id (of `kind`, with `access`)? Validators cannot see what those calls touch. */
export function scriptHasDynamic(command: unknown, kind?: ScriptRefKind, options: { readonly access?: ScriptAccess; readonly library?: readonly ScriptModule[] } = {}): boolean {
  return effectsHaveDynamic(scriptEffectsOf(command, options.library), kind, options.access);
}

/** Where a script command sits. */
export interface ScriptOwner {
  readonly mapId?: string;
  readonly eventId?: string;
  readonly pageIndex?: number;
  readonly commonEventId?: string;
  readonly troopId?: string;
}

function visitList(commands: unknown, owner: ScriptOwner, visit: (command: Command, owner: ScriptOwner) => void, depth: number): void {
  if (!Array.isArray(commands) || depth > 64) return;
  for (const command of commands as Command[]) {
    if (!isRecord(command)) continue;
    if (command.kind === "script") visit(command, owner);
    let branches: readonly (readonly Command[])[] = [];
    try {
      branches = nestedCommandLists(command);
    } catch {
      branches = [];
    }
    for (const branch of branches) visitList(branch, owner, visit, depth + 1);
  }
}

/** Every `script` command in the project: map events (legacy commands + pages), common events, troop pages, after-battle lists. */
export function forEachProjectScript(project: Project, visit: (command: Extract<Command, { kind: "script" }>, owner: ScriptOwner) => void): void {
  const cb = visit as (command: Command, owner: ScriptOwner) => void;
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      visitList(event.commands, { mapId: map.id, eventId: event.id }, cb, 0);
      (event.pages ?? []).forEach((page, pageIndex) => visitList(page.commands, { mapId: map.id, eventId: event.id, pageIndex }, cb, 0));
    }
  }
  for (const common of project.commonEvents ?? []) visitList(common.commands, { commonEventId: common.id }, cb, 0);
  for (const troop of project.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) visitList(page.commands, { troopId: troop.id }, cb, 0);
    for (const list of troopAfterBattleLists(troop)) visitList(list.commands, { troopId: troop.id }, cb, 0);
  }
}

/** Project-wide script usage: literal ids per access and kind (names resolved), plus which kinds are dynamic. */
export interface ProjectScriptUsage {
  readonly scriptCount: number;
  ids(access: ScriptAccess, kind: ScriptRefKind): ReadonlySet<string>;
  /** Some script touches `kind` (with `access`) through a computed id. */
  dynamic(kind: ScriptRefKind, access?: ScriptAccess): boolean;
}

export function projectScriptUsage(project: Project): ProjectScriptUsage {
  const table = new Map<string, Set<string>>();
  const dynamicKeys = new Set<string>();
  let scriptCount = 0;
  forEachProjectScript(project, (command) => {
    scriptCount += 1;
    const effects = scriptEffectsOf(command, project.scriptLibrary);
    for (const access of ACCESSES) {
      for (const ref of listFor(effects, access)) {
        const key = `${access}:${ref.kind}`;
        const set = table.get(key) ?? new Set<string>();
        set.add(resolveScriptRefId(project, ref.kind, ref.id));
        table.set(key, set);
      }
    }
    for (const entry of effects.dynamic) for (const hit of dynamicRefKinds(entry.api)) dynamicKeys.add(`${hit.access}:${hit.kind}`);
  });
  const empty: ReadonlySet<string> = new Set();
  return {
    scriptCount,
    ids: (access, kind) => table.get(`${access}:${kind}`) ?? empty,
    dynamic: (kind, access) => access ? dynamicKeys.has(`${access}:${kind}`) : ACCESSES.some((one) => dynamicKeys.has(`${one}:${kind}`)),
  };
}

/**
 * Does any script (command or library module) name `kind:id` literally? Used by delete guards, so library
 * modules count even when nothing imports them yet.
 */
export function scriptRefersTo(project: Project, kind: ScriptRefKind, id: string): boolean {
  const hits = (effects: ScriptEffects): boolean => ACCESSES.some((access) =>
    listFor(effects, access).some((ref) => ref.kind === kind && resolveScriptRefId(project, kind, ref.id) === id));
  let found = false;
  forEachProjectScript(project, (command) => {
    if (!found && hits(scriptCommandEffects(command))) found = true;
  });
  return found || (project.scriptLibrary ?? []).some((module) => hits(scriptCommandEffects(module)));
}

/** 스크립트가 계산된 id 를 써서 검사기가 놓칠 수 있을 때 검사기 문구에 덧붙이는 안내. */
export const SCRIPT_DYNAMIC_NOTE = "스크립트가 계산된 id 를 써서 검사기가 볼 수 없는 참조가 있습니다";

/**
 * Does any script name this `game.cmd` kind in its source (`kind: "triggerEnding"`)? effects record ids, not
 * command kinds, so checks like "nothing ever ends the game" use this text test to stay quiet. A heuristic:
 * it can be fooled by a comment, which only makes the validator quieter.
 */
export function projectScriptMentionsCmdKind(project: Project, cmdKind: string): boolean {
  const pattern = new RegExp(`kind\\s*:\\s*["'\`]${cmdKind.replace(/[^A-Za-z0-9_]/gu, "")}["'\`]`, "u");
  const mentions = (entry: { readonly source?: unknown; readonly compiled?: unknown }): boolean =>
    (typeof entry.source === "string" && pattern.test(entry.source)) || (typeof entry.compiled === "string" && pattern.test(entry.compiled));
  let found = false;
  forEachProjectScript(project, (command) => { if (!found && mentions(command)) found = true; });
  return found || (project.scriptLibrary ?? []).some(mentions);
}
