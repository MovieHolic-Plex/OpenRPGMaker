import { compareVariableValue } from "./conditionEvaluation";

export const ROGUELIKE_RUN_VERSION = 1 as const;
export const ROGUELIKE_FLOOR_MIN = 1;
export const ROGUELIKE_FLOOR_MAX = 9_999;

export type RoguelikeRunResult = "completed" | "failed" | "abandoned";
export type RoguelikeRunStatus = "active" | RoguelikeRunResult;

export type RoguelikeRunState = {
  readonly version: typeof ROGUELIKE_RUN_VERSION;
  readonly runId: string;
  readonly seed: number;
  floor: number;
  status: RoguelikeRunStatus;
  flags: Record<string, boolean>;
  roomResetCounts: Record<string, number>;
  currentRoomId?: string;
};

export type RoguelikeRunHost = {
  roguelikeRun?: RoguelikeRunState;
};

export type RoguelikeRunCondition =
  | { kind: "run"; query: "active"; value?: boolean }
  | { kind: "run"; query: "floor"; op: "==" | ">=" | "<=" | ">" | "<" | "!="; value: number }
  | { kind: "run"; query: "flag"; flag: string; value: boolean }
  | { kind: "run"; query: "result"; result: RoguelikeRunResult };

export type StartRoguelikeRunOptions = {
  readonly seed: number;
  readonly runId?: string;
  readonly startFloor?: number;
};

export function startRoguelikeRun(
  host: RoguelikeRunHost,
  options: StartRoguelikeRunOptions
): RoguelikeRunState {
  const seed = normalizeRunSeed(options.seed);
  const runId = options.runId?.trim() || defaultRunId(seed);
  const state: RoguelikeRunState = {
    version: ROGUELIKE_RUN_VERSION,
    runId,
    seed,
    floor: clampRunFloor(options.startFloor ?? ROGUELIKE_FLOOR_MIN),
    status: "active",
    flags: {},
    roomResetCounts: {},
  };
  host.roguelikeRun = state;
  return state;
}

export function advanceRoguelikeRunFloor(host: RoguelikeRunHost, amount = 1): boolean {
  const run = activeRun(host);
  if (!run) return false;
  const step = Number.isFinite(amount) ? Math.max(1, Math.trunc(amount)) : 1;
  run.floor = clampRunFloor(run.floor + step);
  run.currentRoomId = undefined;
  return true;
}

export function endRoguelikeRun(host: RoguelikeRunHost, result: RoguelikeRunResult): boolean {
  const run = activeRun(host);
  if (!run) return false;
  run.status = result;
  return true;
}

export function setRoguelikeRunFlag(
  host: RoguelikeRunHost,
  flag: string,
  value: boolean
): boolean {
  const run = activeRun(host);
  const key = flag.trim();
  if (!run || !key) return false;
  run.flags[key] = value;
  return true;
}

export function resetRoguelikeRunRoom(host: RoguelikeRunHost, roomId?: string): boolean {
  const run = activeRun(host);
  const key = roomId?.trim() || run?.currentRoomId?.trim();
  if (!run || !key) return false;
  run.currentRoomId = key;
  run.roomResetCounts[key] = (run.roomResetCounts[key] ?? 0) + 1;
  return true;
}

export function enterRoguelikeRunRoom(host: RoguelikeRunHost, roomId: string): boolean {
  const run = activeRun(host);
  const key = roomId.trim();
  if (!run || !key) return false;
  run.currentRoomId = key;
  return true;
}

export function evalRoguelikeRunCondition(
  host: RoguelikeRunHost,
  condition: RoguelikeRunCondition
): boolean {
  const run = host.roguelikeRun;
  switch (condition.query) {
    case "active":
      return (run?.status === "active") === (condition.value ?? true);
    case "floor":
      return run !== undefined && compareVariableValue(run.floor, condition.op, condition.value);
    case "flag":
      return (run?.flags[condition.flag.trim()] ?? false) === condition.value;
    case "result":
      return run?.status === condition.result;
  }
}

export function normalizeRoguelikeRunState(value: unknown): RoguelikeRunState | undefined {
  if (!isRecord(value) || value.version !== ROGUELIKE_RUN_VERSION) return undefined;
  if (typeof value.runId !== "string" || !value.runId.trim()) return undefined;
  if (typeof value.seed !== "number" || !Number.isFinite(value.seed)) return undefined;
  if (typeof value.floor !== "number" || !Number.isFinite(value.floor)) return undefined;
  if (!isRunStatus(value.status) || !isBooleanRecord(value.flags) || !isNumberRecord(value.roomResetCounts)) {
    return undefined;
  }
  const roomResetCounts: Record<string, number> = {};
  for (const [roomId, count] of Object.entries(value.roomResetCounts)) {
    if (!roomId.trim()) continue;
    roomResetCounts[roomId] = Math.max(0, Math.trunc(count));
  }
  return {
    version: ROGUELIKE_RUN_VERSION,
    runId: value.runId.trim(),
    seed: normalizeRunSeed(value.seed),
    floor: clampRunFloor(value.floor),
    status: value.status,
    flags: { ...value.flags },
    roomResetCounts,
    currentRoomId: typeof value.currentRoomId === "string" && value.currentRoomId.trim()
      ? value.currentRoomId.trim()
      : undefined,
  };
}

export function normalizeRunSeed(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value) >>> 0;
}

function activeRun(host: RoguelikeRunHost): RoguelikeRunState | undefined {
  return host.roguelikeRun?.status === "active" ? host.roguelikeRun : undefined;
}

function defaultRunId(seed: number): string {
  return `run-${seed.toString(16).padStart(8, "0")}`;
}

function clampRunFloor(value: number): number {
  return Math.max(ROGUELIKE_FLOOR_MIN, Math.min(ROGUELIKE_FLOOR_MAX, Math.trunc(value)));
}

function isRunStatus(value: unknown): value is RoguelikeRunStatus {
  return value === "active" || value === "completed" || value === "failed" || value === "abandoned";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number" && Number.isFinite(entry));
}
