import { expect } from "vitest";
import { canMove, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseBoss";
import { ICE_GRAND_EXPANSE_CHECKPOINTS } from "@/project/defaults/iceGrandExpanseCheckpoints";
import {
  buildIceGrandExpanseGameplay,
  ICE_GRAND_EXPANSE_REGION_EVENTS,
  ICE_GRAND_EXPANSE_REWARDS,
} from "@/project/defaults/iceGrandExpanseEvents";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "@/project/defaults/iceGrandExpanseFieldSpawns";
import { buildIceGrandExpanseMap } from "@/project/defaults/iceGrandExpanseMap";
import { ICE_GRAND_EXPANSE_BOSS, ICE_GRAND_EXPANSE_START } from "@/project/defaults/iceGrandExpansePlan";
import {
  ICE_GRAND_EXPANSE_GATE,
  ICE_GRAND_EXPANSE_SEALS,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES,
  ICE_GRAND_EXPANSE_SHORTCUT_EVENTS,
  IceGrandExpanseGameplayError,
} from "@/project/defaults/iceGrandExpanseSeals";
import { startSession, type PlaySession } from "@/project/session";
import { runSceneTest, type SceneStep, type SceneTestResult } from "@/testing/sceneTestRunner";
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";

export type IceExpanseOrder = "west-east" | "east-west";

type IceExpanseVerifier = {
  readonly iceGrandExpanseOrderInputs: (order: IceExpanseOrder) => Promise<{
    readonly start: typeof ICE_GRAND_EXPANSE_START;
    readonly steps: readonly SceneStep[];
    readonly milestones: {
      readonly bossEventId: string;
      readonly checkpointIds: readonly string[];
      readonly guardIds: readonly string[];
      readonly sealIds: readonly string[];
      readonly shortcutIds: readonly string[];
    };
  }>;
  readonly proveIceGrandExpanseGateClosed: (order: IceExpanseOrder) => Promise<{
    readonly code: "GATE_CLOSED";
    readonly order: IceExpanseOrder;
    readonly stepsRun: number;
  }>;
  readonly runIceGrandExpanseOrder: (order: IceExpanseOrder) => Promise<{
    readonly battleTroops: readonly string[];
    readonly result: SceneTestResult;
  }>;
};

const ICE_EXPANSE_VERIFIER_PATH = "../../scripts/verify-ice-grand-expanse.mts";

function isIceExpanseVerifier(value: unknown): value is IceExpanseVerifier {
  if (typeof value !== "object" || value === null) return false;
  return ["iceGrandExpanseOrderInputs", "proveIceGrandExpanseGateClosed", "runIceGrandExpanseOrder"]
    .every((key) => typeof Reflect.get(value, key) === "function");
}

export async function loadIceExpanseVerifier(): Promise<IceExpanseVerifier> {
  const verifier: unknown = await import(ICE_EXPANSE_VERIFIER_PATH);
  if (!isIceExpanseVerifier(verifier)) throw new TypeError("invalid ice grand expanse verifier module");
  return verifier;
}

const SWITCH_IDS = [
  ICE_GRAND_EXPANSE_SEAL_SWITCHES.west, ICE_GRAND_EXPANSE_SEAL_SWITCHES.east,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate, "sw_ice_expanse_boss_clear",
  "sw_ice_expanse_guard_01_clear", "sw_ice_expanse_guard_02_clear",
  "sw_ice_expanse_guard_03_clear", "sw_ice_expanse_guard_04_clear",
  "sw_ice_expanse_checkpoint_summit",
] as const;

export const EXPEDITION_ORDERS = ["west-east", "east-west"] as const satisfies readonly IceExpanseOrder[];

export const EXPECTED_FIELD_SPAWNS = [
  ["fs_ice_expanse_south_01", 48, 116, "troop_slime_pair", "tex_easyrpg_charset_monster1", 0, false],
  ["fs_ice_expanse_south_02", 56, 111, "troop_slime_pair", "tex_easyrpg_charset_monster1", 0, false],
  ["fs_ice_expanse_south_03", 72, 111, "troop_slime_pair", "tex_easyrpg_charset_monster1", 0, false],
  ["fs_ice_expanse_south_04", 80, 116, "troop_slime_pair", "tex_easyrpg_charset_monster1", 0, false],
  ["fs_ice_expanse_south_05", 64, 104, "troop_slime_pair", "tex_easyrpg_charset_monster1", 0, false],
  ["fs_ice_expanse_west_01", 18, 96, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, false],
  ["fs_ice_expanse_west_02", 32, 91, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, false],
  ["fs_ice_expanse_west_03", 17, 71, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, false],
  ["fs_ice_expanse_west_04", 34, 72, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, false],
  ["fs_ice_expanse_east_01", 93, 98, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, true],
  ["fs_ice_expanse_east_02", 111, 92, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, true],
  ["fs_ice_expanse_east_03", 88, 84, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, true],
  ["fs_ice_expanse_east_04", 108, 84, "troop_golem_guard", "tex_easyrpg_charset_monster2", 4, true],
  ["fs_ice_expanse_east_05", 98, 58, "troop_golem_guard", "tex_easyrpg_charset_monster2", 4, true],
  ["fs_ice_expanse_lake_01", 49, 60, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, true],
  ["fs_ice_expanse_lake_02", 66, 57, "troop_golem_guard", "tex_easyrpg_charset_monster2", 4, true],
  ["fs_ice_expanse_lake_03", 84, 68, "troop_bat_swarm", "tex_easyrpg_charset_monster3", 0, true],
] as const;

export function gameplayFixture(): { readonly project: Project; readonly map: GameMap } {
  const project = createBlankProject();
  const map = buildIceGrandExpanseGameplay(buildIceGrandExpanseMap({ tilesetId: "easyrpg_chipset_dungeon", tileSize: 16 }));
  project.maps[map.id] = map;
  for (const id of SWITCH_IDS) {
    if (!project.switches.some((entry) => entry.id === id)) project.switches.push({ id, name: id });
    project.session.switches[id] = false;
  }
  return { project, map };
}

export function facingPoint(project: Project, map: GameMap, x: number, y: number): { readonly x: number; readonly y: number; readonly dir: Dir } {
  const candidates = [
    { x: x - 1, y, dir: "right" }, { x: x + 1, y, dir: "left" },
    { x, y: y - 1, dir: "down" }, { x, y: y + 1, dir: "up" },
  ] as const;
  const point = candidates.find((candidate) => isPassable(project, map, candidate.x, candidate.y) && canMove(project, map, candidate.x, candidate.y, x, y));
  if (point === undefined) throw new RangeError(`no facing tile for ${x},${y}`);
  return point;
}

export function actionScenario(project: Project, map: GameMap, event: GameEvent) {
  const start = facingPoint(project, map, event.x, event.y);
  return runSceneTest(project, { mapId: map.id, start, steps: [{ kind: "face", dir: start.dir }, { kind: "interact" }] });
}

export function requiredEvent(map: GameMap, eventId: string): GameEvent {
  const event = map.events.find((entry) => entry.id === eventId);
  if (event === undefined) throw new RangeError(`missing ${eventId}`);
  return event;
}

function appendInteraction(steps: SceneStep[], point: { readonly x: number; readonly y: number; readonly dir: Dir }): void {
  steps.push({ kind: "set", x: point.x, y: point.y, facing: point.dir }, { kind: "interact" });
}

export function fullyUnlockedScenario(project: Project, map: GameMap, finalEvent?: GameEvent) {
  const west = requiredEvent(map, ICE_GRAND_EXPANSE_SEALS[0].id);
  const start = facingPoint(project, map, west.x, west.y);
  const steps: SceneStep[] = [{ kind: "face", dir: start.dir }, { kind: "interact" }];
  for (const event of [requiredEvent(map, ICE_GRAND_EXPANSE_SEALS[1].id), requiredEvent(map, "ev_ice_expanse_checkpoint_summit")]) {
    appendInteraction(steps, facingPoint(project, map, event.x, event.y));
  }
  if (finalEvent !== undefined) appendInteraction(steps, facingPoint(project, map, finalEvent.x, finalEvent.y));
  return runSceneTest(project, { mapId: map.id, start, steps });
}

export function frozenPoints() {
  return [
    ICE_GRAND_EXPANSE_START, ...ICE_GRAND_EXPANSE_CHECKPOINTS, ...ICE_GRAND_EXPANSE_SEALS,
    ICE_GRAND_EXPANSE_GATE, ...ICE_GRAND_EXPANSE_SHORTCUT_EVENTS, ...ICE_GRAND_EXPANSE_REWARDS,
    ...ICE_GRAND_EXPANSE_REGION_EVENTS, ...ICE_GRAND_EXPANSE_FIELD_SPAWNS,
    ...ICE_GRAND_EXPANSE_GUARDS, ICE_GRAND_EXPANSE_BOSS,
  ];
}

export function actionFaceReached(reachable: ReadonlySet<number>, map: GameMap, point: { readonly x: number; readonly y: number }): boolean {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable.has((point.y + dy) * map.width + point.x + dx));
}

export function sealScenario(project: Project, map: GameMap, order: readonly ("west" | "east")[]): PlaySession {
  if (order.length === 0) return startSession(project);
  const first = ICE_GRAND_EXPANSE_SEALS.find((seal) => seal.side === order[0]);
  if (first === undefined) throw new RangeError("missing first seal");
  const start = facingPoint(project, map, first.x, first.y);
  const steps: SceneStep[] = [{ kind: "face", dir: start.dir }, { kind: "interact" }];
  for (const side of order.slice(1)) {
    const seal = ICE_GRAND_EXPANSE_SEALS.find((entry) => entry.side === side);
    if (seal === undefined) throw new RangeError(`missing ${side} seal`);
    const next = facingPoint(project, map, seal.x, seal.y);
    steps.push({ kind: "set", x: next.x, y: next.y, facing: next.dir }, { kind: "interact" });
  }
  const result = runSceneTest(project, { mapId: map.id, start, steps });
  expect(result.ok, result.failureReason).toBe(true);
  return result.session;
}

export function expectGameplayError(action: () => void, code: IceGrandExpanseGameplayError["code"]): void {
  try {
    action();
    throw new RangeError(`expected ${code}`);
  } catch (error) {
    if (!(error instanceof IceGrandExpanseGameplayError)) throw error;
    expect(error.code).toBe(code);
    expect(error.message.length).toBeLessThan(160);
  }
}
