// player/script/hostApi.ts — the engine side of the script `game` API. One implementation per SCRIPT_API row
// (the mapped type below fails to compile when a row is missing or has the wrong sync/await kind).
//
// Two shapes:
// - sync (`awaits: false`): runs immediately inside the VM call. Writes go through `executeCommand` on a
//   throwaway frame so side effects (sounds, followers, affection mirrors…) match the equivalent command.
// - awaitable (`awaits: true`): returns a plan of ordinary event commands. scriptCommand.ts pushes them as a
//   child frame of the script command; when that frame completes, `result()` produces the promise value.
//   Results that commands write somewhere (choices, number input) go through the reserved session variable
//   SCRIPT_RESULT_VARIABLE, which is removed right after it is read.
import { SCRIPT_API, SCRIPT_RESULT_VARIABLE } from "@/project/script/apiSpec";
import { EMOTE_KINDS, type EmoteKind } from "@/project/emotes";
import { createDefaultM2Fields, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { isPassable } from "@/project/collision";
import { runtimeMap } from "@/project/runtimeMap";
import { layerTileAt, type TileLayerNo } from "@/project/mapLayers";
import { runtimeEventViewById, runtimeEventViewsForMap, type RuntimeEventView } from "@/project/runtimeEventState";
import { nextSessionRandom } from "@/project/session";
import { syncActorVitals } from "@/project/sessionVitals";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";
import { normalizeActorRecord } from "@/project/actorModel";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { ChoiceCancelBehavior, Command, Dir, GameMap, MoveCommand } from "@/project/types";
import type { CommandExecution, Frame, InterpreterState } from "@/player/interpreter/types";
import { recordScriptLog } from "./scriptLog";

export type ExecuteCommandFn = (state: InterpreterState, frame: Frame, command: Command) => CommandExecution;

export interface HostContext {
  readonly state: InterpreterState;
  readonly exec: ExecuteCommandFn;
  /** Label for log lines ("event ev_door" / "common ce_shop"). */
  readonly source?: string;
}

export interface AwaitPlan {
  readonly commands: Command[];
  /** Value the script's promise resolves with, read after the commands finished. */
  readonly result?: (ctx: HostContext) => unknown;
}

type SyncImpl = (ctx: HostContext, args: readonly unknown[]) => unknown;
type AwaitImpl = (ctx: HostContext, args: readonly unknown[]) => AwaitPlan;
type ApiRow = (typeof SCRIPT_API)[number];
type HostApiTable = { readonly [Row in ApiRow as Row["name"]]: Row["awaits"] extends true ? AwaitImpl : SyncImpl };

// ── argument checks (errors become script exceptions with the API name in them) ───────────────────

class ScriptArgumentError extends TypeError {}

function fail(api: string, message: string): never {
  throw new ScriptArgumentError(`game.${api}: ${message}`);
}

function str(api: string, args: readonly unknown[], index: number, name: string): string {
  const value = args[index];
  if (typeof value !== "string" || value.length === 0) fail(api, `${name} must be a non-empty string (got ${describe(value)})`);
  return value;
}

function optStr(api: string, args: readonly unknown[], index: number, name: string): string | undefined {
  const value = args[index];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") fail(api, `${name} must be a string (got ${describe(value)})`);
  return value;
}

function num(api: string, args: readonly unknown[], index: number, name: string): number {
  const value = args[index];
  if (typeof value !== "number" || !Number.isFinite(value)) fail(api, `${name} must be a finite number (got ${describe(value)})`);
  return value;
}

function optNum(api: string, args: readonly unknown[], index: number, name: string, fallback: number): number {
  const value = args[index];
  if (value === undefined || value === null) return fallback;
  return num(api, args, index, name);
}

function int(api: string, args: readonly unknown[], index: number, name: string): number {
  return Math.trunc(num(api, args, index, name));
}

function bool(api: string, args: readonly unknown[], index: number, name: string): boolean {
  const value = args[index];
  if (typeof value !== "boolean") fail(api, `${name} must be true or false (got ${describe(value)})`);
  return value;
}

function options(api: string, args: readonly unknown[], index: number): Record<string, unknown> {
  const value = args[index];
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) fail(api, `options must be an object (got ${describe(value)})`);
  return value as Record<string, unknown>;
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value.slice(0, 40));
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  return Array.isArray(value) ? "an array" : typeof value;
}

const SELF_SWITCH_KEYS = new Set(["A", "B", "C", "D"]);
const DIRECTIONS = new Set<Dir>(["up", "down", "left", "right"]);
const TILE_LAYERS: Readonly<Record<string, TileLayerNo>> = { lower: 1, lower2: 2, upper: 3, upper2: 4 };

function selfSwitchKey(api: string, args: readonly unknown[], index: number): "A" | "B" | "C" | "D" {
  const key = args[index];
  if (typeof key !== "string" || !SELF_SWITCH_KEYS.has(key)) fail(api, `key must be "A", "B", "C" or "D" (got ${describe(key)})`);
  return key as "A" | "B" | "C" | "D";
}

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────

/** Runs one non-blocking command on a throwaway frame. The listed commands never pause or push frames. */
function runNow(ctx: HostContext, command: Command): void {
  const frame: Frame = { commands: [command], pc: 0 };
  const depth = ctx.state.stack.length;
  const result = ctx.exec(ctx.state, frame, command);
  if (result.kind !== "continue" || ctx.state.stack.length !== depth) {
    ctx.state.stack.length = Math.min(ctx.state.stack.length, depth);
    throw new Error(`internal: ${command.kind} did not complete synchronously`);
  }
}

/** Switch/variable lookup accepts the id or an exact display name (authors read names, not ids). */
function resolveDefId(list: readonly { id: string; name: string }[] | undefined, value: string): string {
  if (!list || list.some((entry) => entry.id === value)) return value;
  return list.find((entry) => entry.name === value)?.id ?? value;
}

function currentMap(ctx: HostContext): GameMap | undefined {
  return ctx.state.project?.maps[ctx.state.session.currentMapId];
}

function liveMap(ctx: HostContext, mapId?: string): GameMap | undefined {
  const map = ctx.state.project?.maps[mapId ?? ctx.state.session.currentMapId];
  if (!map) return undefined;
  const session = ctx.state.session;
  return session.mapOverrides ? runtimeMap(map, { mapOverrides: session.mapOverrides }) : map;
}

function eventViews(ctx: HostContext): RuntimeEventView[] {
  const project = ctx.state.project;
  const map = currentMap(ctx);
  if (!project || !map) return [];
  return runtimeEventViewsForMap(project, map, ctx.state.session, ctx.state.eventPositions ?? {})
    .filter((view) => view.page !== undefined || !(view.event.pages?.length));
}

function eventInfo(view: RuntimeEventView): { id: string; name: string; x: number; y: number } {
  return { id: view.event.id, name: view.event.name ?? view.event.id, x: view.x, y: view.y };
}

function actorInfo(ctx: HostContext, actorId: string): unknown {
  const project = ctx.state.project;
  const record = project?.database.actors.find((entry) => entry.id === actorId);
  if (!project || !record) return undefined;
  const session = ctx.state.session;
  session.actorVitals ??= {};
  syncActorVitals(project, session.actorVitals, actorId);
  const vitals = session.actorVitals[actorId];
  const level = session.actorLevels?.[actorId] ?? normalizeActorRecord(record).initialLevel;
  return {
    id: actorId,
    name: session.actorNames?.[actorId] ?? record.name,
    level,
    exp: session.actorExperience?.[actorId] ?? 0,
    hp: vitals?.hp ?? 0,
    mp: vitals?.mp ?? 0,
    maxHp: vitals?.maxHp ?? 0,
    maxMp: vitals?.maxMp ?? 0,
    inParty: session.partyActorIds.includes(actorId),
  };
}

function takeResult(ctx: HostContext, fallback: number): number {
  const variables = ctx.state.session.variables;
  const value = variables[SCRIPT_RESULT_VARIABLE];
  delete variables[SCRIPT_RESULT_VARIABLE];
  return typeof value === "number" ? value : fallback;
}

function setResult(value: number): Command {
  return { kind: "setVariable", variableId: SCRIPT_RESULT_VARIABLE, op: "=", value };
}

function framesToMs(frames: number): number {
  return Math.max(0, Math.round((frames * 1000) / 60));
}

function m2(commandId: string, overrides: Record<string, string | number | boolean>): Command {
  const entry = m2CommandById(commandId);
  const fields = entry ? createDefaultM2Fields(entry) : {};
  return { kind: "m2Command", commandId, fields: { ...fields, ...overrides } };
}

const MOVE_WORDS: Readonly<Record<string, MoveCommand>> = {
  up: { kind: "move", dir: "up" },
  down: { kind: "move", dir: "down" },
  left: { kind: "move", dir: "left" },
  right: { kind: "move", dir: "right" },
  "face-up": { kind: "turn", dir: "up" },
  "face-down": { kind: "turn", dir: "down" },
  "face-left": { kind: "turn", dir: "left" },
  "face-right": { kind: "turn", dir: "right" },
  "face-player": { kind: "turnTowardPlayer" },
  "face-away": { kind: "turnAwayFromPlayer" },
  "toward-player": { kind: "moveTowardPlayer" },
  "away-from-player": { kind: "moveAwayFromPlayer" },
  forward: { kind: "stepForward" },
  random: { kind: "moveRandom" },
  jump: { kind: "jump", dx: 0, dy: 0 },
  wait: { kind: "wait" },
};

function moveSteps(api: string, value: unknown): MoveCommand[] {
  if (!Array.isArray(value)) fail(api, "steps must be an array");
  if (value.length > 500) fail(api, "steps: at most 500 steps per call");
  return value.map((step, index) => {
    if (typeof step === "string") {
      const move = MOVE_WORDS[step];
      if (!move) fail(api, `steps[${index}] ${JSON.stringify(step)} is not a step word (${Object.keys(MOVE_WORDS).join(", ")})`);
      return { ...move };
    }
    if (step && typeof step === "object" && typeof (step as { kind?: unknown }).kind === "string") return step as MoveCommand;
    fail(api, `steps[${index}] must be a step word or a move command object`);
  });
}

function moveTarget(ctx: HostContext, api: string, value: unknown): string {
  if (value === "player") return PLAYER_MOVE_TARGET;
  if (value === "this") {
    if (!ctx.state.currentEventId) fail(api, "'this' needs an event; this script runs without one");
    return ctx.state.currentEventId;
  }
  if (typeof value !== "string" || !value) fail(api, `target must be 'player', 'this' or an event id (got ${describe(value)})`);
  return value;
}

function validateOneCommand(api: string, command: unknown): Command {
  if (!command || typeof command !== "object" || Array.isArray(command)) fail(api, "command must be an event command object");
  if ((command as { kind?: unknown }).kind === "script") fail(api, "a script cannot run another script command; use a library module (@lib/…) or callCommonEvent");
  try {
    validateCommandArray(`game.${api}`, [command]);
  } catch (error) {
    fail(api, error instanceof Error ? error.message : String(error));
  }
  return structuredCloneSafe(command as Command);
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function logText(values: readonly unknown[]): string {
  return values.map((value) => (typeof value === "string" ? value : JSON.stringify(value) ?? String(value))).join(" ");
}

// ── the table ─────────────────────────────────────────────────────────────────────────────────────

export const HOST_API: HostApiTable = {
  // state
  getSwitch: (ctx, args) => ctx.state.session.switches[resolveDefId(ctx.state.project?.switches, str("getSwitch", args, 0, "id"))] ?? false,
  setSwitch: (ctx, args) => {
    const id = resolveDefId(ctx.state.project?.switches, str("setSwitch", args, 0, "id"));
    runNow(ctx, { kind: "setSwitch", switchId: id, value: bool("setSwitch", args, 1, "value") });
  },
  getVar: (ctx, args) => ctx.state.session.variables[resolveDefId(ctx.state.project?.variables, str("getVar", args, 0, "id"))] ?? 0,
  setVar: (ctx, args) => {
    const id = resolveDefId(ctx.state.project?.variables, str("setVar", args, 0, "id"));
    runNow(ctx, { kind: "setVariable", variableId: id, op: "=", value: int("setVar", args, 1, "value") });
  },
  addVar: (ctx, args) => {
    const id = resolveDefId(ctx.state.project?.variables, str("addVar", args, 0, "id"));
    runNow(ctx, { kind: "setVariable", variableId: id, op: "+=", value: int("addVar", args, 1, "delta") });
    return ctx.state.session.variables[id] ?? 0;
  },
  getText: (ctx, args) => ctx.state.session.stringVariables?.[str("getText", args, 0, "id")] ?? "",
  setText: (ctx, args) => {
    const id = str("setText", args, 0, "id");
    const value = args[1];
    if (typeof value !== "string") fail("setText", `value must be a string (got ${describe(value)})`);
    if (value.length > 10_000) fail("setText", "value is longer than 10,000 characters");
    ctx.state.session.stringVariables ??= {};
    ctx.state.session.stringVariables[id] = value;
  },
  getSelfSwitch: (ctx, args) => {
    const key = selfSwitchKey("getSelfSwitch", args, 0);
    const eventId = optStr("getSelfSwitch", args, 1, "eventId") ?? ctx.state.currentEventId;
    return eventId ? ctx.state.session.selfSwitches?.[eventId]?.[key] ?? false : false;
  },
  setSelfSwitch: (ctx, args) => {
    const key = selfSwitchKey("setSelfSwitch", args, 0);
    const value = bool("setSelfSwitch", args, 1, "value");
    const eventId = optStr("setSelfSwitch", args, 2, "eventId") ?? ctx.state.currentEventId;
    if (!eventId) fail("setSelfSwitch", "no event: pass eventId when the script runs from a common event");
    const session = ctx.state.session;
    session.selfSwitches ??= {};
    session.selfSwitches[eventId] ??= {};
    session.selfSwitches[eventId][key] = value;
  },
  // items
  gold: (ctx) => ctx.state.session.gold,
  addGold: (ctx, args) => {
    const amount = int("addGold", args, 0, "amount");
    runNow(ctx, { kind: "changeGold", op: amount < 0 ? "-=" : "+=", amount: Math.abs(amount) });
  },
  itemCount: (ctx, args) => ctx.state.session.inventory[str("itemCount", args, 0, "id")] ?? 0,
  hasItem: (ctx, args) => (ctx.state.session.inventory[str("hasItem", args, 0, "id")] ?? 0) >= Math.max(1, Math.trunc(optNum("hasItem", args, 1, "count", 1))),
  addItem: (ctx, args) => {
    const count = Math.trunc(optNum("addItem", args, 1, "count", 1));
    if (count < 0) fail("addItem", "count must be ≥ 0 (use removeItem to take items)");
    runNow(ctx, { kind: "changeItem", itemId: str("addItem", args, 0, "id"), op: "+=", amount: count });
  },
  removeItem: (ctx, args) => {
    const id = str("removeItem", args, 0, "id");
    const count = Math.trunc(optNum("removeItem", args, 1, "count", 1));
    if (count < 0) fail("removeItem", "count must be ≥ 0");
    if ((ctx.state.session.inventory[id] ?? 0) < count) return false;
    runNow(ctx, { kind: "changeItem", itemId: id, op: "-=", amount: count });
    return true;
  },
  // party
  party: (ctx) => [...ctx.state.session.partyActorIds],
  actor: (ctx, args) => actorInfo(ctx, str("actor", args, 0, "id")),
  addToParty: (ctx, args) => runNow(ctx, { kind: "changeParty", actorId: str("addToParty", args, 0, "id"), action: "add" }),
  removeFromParty: (ctx, args) => runNow(ctx, { kind: "changeParty", actorId: str("removeFromParty", args, 0, "id"), action: "remove" }),
  gainExp: (ctx, args) => {
    const amount = int("gainExp", args, 1, "amount");
    runNow(ctx, { kind: "changeExp", actorId: str("gainExp", args, 0, "id"), op: amount < 0 ? "-=" : "+=", amount: Math.abs(amount) });
  },
  setLevel: (ctx, args) => runNow(ctx, { kind: "changeLevel", actorId: str("setLevel", args, 0, "id"), op: "=", amount: int("setLevel", args, 1, "level") }),
  setHp: (ctx, args) => runNow(ctx, { kind: "changeActorHp", actorId: str("setHp", args, 0, "id"), op: "=", amount: int("setHp", args, 1, "hp") }),
  setMp: (ctx, args) => runNow(ctx, { kind: "changeActorMp", actorId: str("setMp", args, 0, "id"), op: "=", amount: int("setMp", args, 1, "mp") }),
  recoverAll: (ctx, args) => {
    const id = optStr("recoverAll", args, 0, "id");
    runNow(ctx, id ? { kind: "recoverAll", actorId: id } : { kind: "recoverAll" });
  },
  learnSkill: (ctx, args) => runNow(ctx, { kind: "learnSkill", actorId: str("learnSkill", args, 0, "id"), skillId: str("learnSkill", args, 1, "skillId") }),
  // dialogue
  showMessage: (_ctx, args) => {
    const text = args[0];
    if (typeof text !== "string") fail("showMessage", `text must be a string (got ${describe(text)})`);
    const speaker = optStr("showMessage", [options("showMessage", args, 1).speaker], 0, "options.speaker");
    return { commands: [{ kind: "text", body: text, ...(speaker ? { speaker } : {}) }] };
  },
  showChoices: (ctx, args) => {
    const list = args[0];
    if (!Array.isArray(list) || list.length === 0 || list.length > 5) fail("showChoices", "options must be an array of 1 to 5 strings");
    const labels = list.map((entry, index) => {
      if (typeof entry !== "string" || !entry) fail("showChoices", `options[${index}] must be a non-empty string`);
      return entry;
    });
    const settings = options("showChoices", args, 1);
    const prompt = typeof settings.prompt === "string" && settings.prompt ? settings.prompt : undefined;
    let cancelBehavior: ChoiceCancelBehavior = "disallow";
    if (settings.cancel === "cancel") cancelBehavior = "branch";
    else if (typeof settings.cancel === "number") {
      const index = Math.trunc(settings.cancel);
      if (index < 0 || index >= labels.length) fail("showChoices", `settings.cancel ${index} is not an option index`);
      cancelBehavior = `choice${index + 1}` as ChoiceCancelBehavior;
    }
    delete ctx.state.session.variables[SCRIPT_RESULT_VARIABLE];
    return {
      commands: [{
        kind: "choices",
        ...(prompt ? { prompt } : {}),
        options: labels.map((text, index) => ({ text, branch: [setResult(index)] })),
        cancelBehavior,
        ...(cancelBehavior === "branch" ? { cancelBranch: [setResult(-1)] } : {}),
      }],
      result: (live) => takeResult(live, -1),
    };
  },
  inputNumber: (ctx, args) => {
    const settings = options("inputNumber", args, 0);
    const digits = typeof settings.digits === "number" ? Math.min(6, Math.max(1, Math.trunc(settings.digits))) : 4;
    const prompt = typeof settings.prompt === "string" && settings.prompt ? settings.prompt : undefined;
    delete ctx.state.session.variables[SCRIPT_RESULT_VARIABLE];
    return {
      commands: [{ kind: "inputNumber", variableId: SCRIPT_RESULT_VARIABLE, digits, ...(prompt ? { prompt } : {}) }],
      result: (live) => takeResult(live, 0),
    };
  },
  // flow
  wait: (_ctx, args) => ({ commands: [{ kind: "wait", ms: framesToMs(Math.min(36_000, Math.max(0, num("wait", args, 0, "frames")))) }] }),
  callCommonEvent: (ctx, args) => {
    const id = str("callCommonEvent", args, 0, "id");
    const known = (ctx.state.session.commonEvents ?? ctx.state.project?.commonEvents)?.some((entry) => entry.id === id);
    if (!known) fail("callCommonEvent", `unknown common event ${JSON.stringify(id)}`);
    return { commands: [{ kind: "callCommonEvent", commonEventId: id }] };
  },
  random: (ctx, args) => {
    const max = Math.trunc(num("random", args, 0, "maxExclusive"));
    if (max < 1 || max > 2 ** 31) fail("random", "maxExclusive must be between 1 and 2^31");
    return Math.floor(nextSessionRandom(ctx.state.session, "misc") * max);
  },
  log: (ctx, args) => recordScriptLog("log", logText(args), ctx.source),
  cmd: (_ctx, args) => ({ commands: [validateOneCommand("cmd", args[0])] }),
  // map
  transfer: (_ctx, args) => {
    const mapId = str("transfer", args, 0, "mapId");
    const x = int("transfer", args, 1, "x");
    const y = int("transfer", args, 2, "y");
    const opts = options("transfer", args, 3);
    const direction = typeof opts.direction === "string" && DIRECTIONS.has(opts.direction as Dir) ? (opts.direction as Dir) : undefined;
    const fade = opts.fade === "black" || opts.fade === "white" || opts.fade === "none" ? opts.fade : undefined;
    return { commands: [{ kind: "transfer", mapId, x, y, ...(direction ? { direction } : {}), ...(fade ? { fade } : {}) }] };
  },
  moveEvent: (ctx, args) => {
    const eventId = moveTarget(ctx, "moveEvent", args[0]);
    const moves = moveSteps("moveEvent", args[1]);
    const opts = options("moveEvent", args, 2);
    return {
      commands: [{
        kind: "moveEvent",
        eventId,
        route: { moves, repeat: false, wait: opts.wait !== false, ...(opts.skippable === false ? { skippable: false } : {}) },
      }],
    };
  },
  setTile: (ctx, args) => {
    const x = int("setTile", args, 0, "x");
    const y = int("setTile", args, 1, "y");
    const tile = int("setTile", args, 2, "tile");
    const opts = options("setTile", args, 3);
    const layer = typeof opts.layer === "string" ? opts.layer : "lower";
    if (!(layer in TILE_LAYERS)) fail("setTile", `layer must be lower, lower2, upper or upper2 (got ${describe(opts.layer)})`);
    const mapId = typeof opts.mapId === "string" && opts.mapId ? opts.mapId : ctx.state.session.currentMapId;
    return { commands: [{ kind: "changeTile", mapId, layer: layer as "lower", x, y, tile }] };
  },
  // battle
  battle: (_ctx, args) => {
    const troopId = str("battle", args, 0, "troopId");
    const opts = options("battle", args, 1);
    return {
      commands: [{ kind: "battleProcessing", troopId, canEscape: opts.canEscape !== false, canLose: opts.canLose === true }],
      result: (live) => live.state.session.battleResult ?? "victory",
    };
  },
  // audio
  playBgm: (_ctx, args) => {
    const volume = options("playBgm", args, 1).volume;
    return { commands: [{ kind: "playAudio", resourceId: str("playBgm", args, 0, "resourceId"), loop: true, channel: "bgm", ...(typeof volume === "number" ? { volume } : {}) }] };
  },
  playSe: (_ctx, args) => {
    const volume = options("playSe", args, 1).volume;
    return { commands: [{ kind: "playAudio", resourceId: str("playSe", args, 0, "resourceId"), loop: false, channel: "se", ...(typeof volume === "number" ? { volume } : {}) }] };
  },
  stopBgm: () => ({ commands: [{ kind: "stopAudio", channel: "bgm" }] }),
  // screen
  shake: (_ctx, args) => {
    const power = Math.min(9, Math.max(1, Math.trunc(optNum("shake", args, 0, "power", 3))));
    const frames = optNum("shake", args, 1, "frames", 24);
    return { commands: [m2("m2-048-shake-screen", { value: power, intensity: power, durationMs: framesToMs(frames) })] };
  },
  flash: (_ctx, args) => {
    const color = optStr("flash", args, 0, "color") ?? "white";
    if (!/^(white|red|black|#[0-9a-f]{6})$/iu.test(color)) fail("flash", `color must be 'white', 'red', 'black' or '#rrggbb' (got ${describe(color)})`);
    const frames = optNum("flash", args, 1, "frames", 18);
    return { commands: [m2("m2-047-flash-screen", { color, durationMs: framesToMs(frames) })] };
  },
  fadeOut: () => ({ commands: [m2("m2-044-hide-screen", {})] }),
  fadeIn: () => ({ commands: [m2("m2-045-show-screen", {})] }),
  showAnimation: (ctx, args) => {
    const raw = args[0];
    let target: "player" | { eventId: string } | { x: number; y: number };
    if (raw === "player") target = "player";
    else if (raw === "this") target = { eventId: ctx.state.currentEventId ?? "" };
    else if (typeof raw === "string" && raw) target = { eventId: raw };
    else if (raw && typeof raw === "object" && Number.isFinite((raw as { x?: unknown }).x) && Number.isFinite((raw as { y?: unknown }).y)) {
      target = { x: Math.trunc((raw as { x: number }).x), y: Math.trunc((raw as { y: number }).y) };
    } else fail("showAnimation", "target must be 'player', 'this', an event id or {x, y}");
    const wait = options("showAnimation", args, 2).wait !== false;
    return { commands: [{ kind: "showAnimation", target, animationId: str("showAnimation", args, 1, "animationId"), wait }] };
  },
  showEmote: (ctx, args) => {
    const raw = str("showEmote", args, 0, "target");
    const emote = str("showEmote", args, 1, "emote");
    if (!(EMOTE_KINDS as readonly string[]).includes(emote)) fail("showEmote", `emote must be one of ${EMOTE_KINDS.join(", ")}`);
    const frames = optNum("showEmote", args, 2, "frames", 60);
    const target = raw === "player" ? "player" : { eventId: raw === "this" ? ctx.state.currentEventId ?? "" : raw };
    return { commands: [{ kind: "showEmote", target, emote: emote as EmoteKind, durationMs: framesToMs(frames) }] };
  },
  // queries
  player: (ctx) => {
    const session = ctx.state.session;
    return { mapId: session.currentMapId, x: session.x, y: session.y, direction: session.playerFacing ?? "down" };
  },
  mapId: (ctx) => ctx.state.session.currentMapId,
  eventId: (ctx) => ctx.state.currentEventId,
  events: (ctx) => eventViews(ctx).map(eventInfo),
  event: (ctx, args) => {
    const project = ctx.state.project;
    const map = currentMap(ctx);
    if (!project || !map) return undefined;
    const view = runtimeEventViewById(project, map, ctx.state.session, ctx.state.eventPositions ?? {}, str("event", args, 0, "id"));
    return view ? eventInfo(view) : undefined;
  },
  eventAt: (ctx, args) => {
    const x = int("eventAt", args, 0, "x");
    const y = int("eventAt", args, 1, "y");
    return eventViews(ctx).find((view) => view.x === x && view.y === y)?.event.id;
  },
  tileAt: (ctx, args) => {
    const x = int("tileAt", args, 0, "x");
    const y = int("tileAt", args, 1, "y");
    const layerName = optStr("tileAt", args, 2, "layer") ?? "lower";
    const layer = TILE_LAYERS[layerName];
    if (!layer) fail("tileAt", `layer must be lower, lower2, upper or upper2 (got ${describe(layerName)})`);
    const map = liveMap(ctx);
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return -1;
    return layerTileAt(map, layer, y * map.width + x);
  },
  passable: (ctx, args) => {
    const x = int("passable", args, 0, "x");
    const y = int("passable", args, 1, "y");
    const project = ctx.state.project;
    const map = liveMap(ctx);
    if (!project || !map || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    return isPassable(project, map, x, y);
  },
  time: (ctx) => {
    const system = resolveTimeSystem(ctx.state.project);
    const time = ctx.state.session.gameTime;
    if (!system || !time) return { enabled: false, hour: 12, minute: 0, day: 1, season: "spring", year: 1, phase: "day" };
    return { enabled: true, hour: time.hour, minute: time.minute, day: time.day, season: time.season, year: time.year, phase: timePhaseFor(time) ?? "day" };
  },
  playTime: (ctx) => Math.floor(ctx.state.session.playTimeSeconds ?? 0),
};

export function isAwaitableApi(name: string): boolean {
  return SCRIPT_API.some((entry) => entry.name === name && entry.awaits);
}
