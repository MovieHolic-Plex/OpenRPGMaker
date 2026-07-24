import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { canMove } from "../src/project/collision";
import { createBlankProject, createSampleAdventureProject } from "../src/project/defaults";
import { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS } from "../src/project/defaults/iceGrandExpanseBoss";
import { ICE_GRAND_EXPANSE_CHECKPOINTS } from "../src/project/defaults/iceGrandExpanseCheckpoints";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "../src/project/defaults/iceGrandExpanseFieldSpawns";
import { ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS, hashIceGrandExpanseMap, installIceGrandExpanse } from "../src/project/defaults/iceGrandExpanse";
import { ICE_GRAND_ADVENTURE_MAP_ID } from "../src/project/defaults/iceGrandAdventure";
import { ICE_DIAGONAL_CANONICAL_SOURCE, stampCanonicalIceRidge } from "../src/project/defaults/iceDiagonalTerrain";
import { ICE_GRAND_EXPANSE_MAP_ID, ICE_GRAND_EXPANSE_START } from "../src/project/defaults/iceGrandExpansePlan";
import {
  ICE_GRAND_EXPANSE_GATE,
  ICE_GRAND_EXPANSE_SEALS,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES,
  ICE_GRAND_EXPANSE_SHORTCUT_EVENTS,
  IceGrandExpanseGameplayError,
  assertIceGrandExpanseSummitAccess,
} from "../src/project/defaults/iceGrandExpanseSeals";
import { deserialize, serialize } from "../src/project/io/serialize";
import { runSceneTest } from "../src/testing/sceneTestRunner";
import type { Dir, GameEvent, GameMap, Project } from "../src/project/types";
import type { SceneStep, SceneTestResult } from "../src/testing/sceneTestRunner";

export const ICE_EXPANSE_RUN_ID = "ice-expanse-source-bound-20260722T080324Z-final";
export const ICE_EXPANSE_SOURCE_MANIFEST_SHA256 = "70f44d5e85a25e88b58480de3623aa07c0687f8a590b5d97e567175d2afa6901";
export type IceExpanseOrder = "west-east" | "east-west";
export type LocalIceExpanse = { readonly canonicalMapSha256: string; readonly derivedMapSha256: string; readonly project: Project; readonly serialized: string };
export type IceExpanseGateProof = { readonly code: "GATE_CLOSED"; readonly order: IceExpanseOrder; readonly stepsRun: number };
export type IceExpanseOrderProof = { readonly battleTroops: readonly string[]; readonly order: IceExpanseOrder; readonly result: SceneTestResult };
export type IceExpanseOrderInput = {
  readonly mapId: typeof ICE_GRAND_EXPANSE_MAP_ID; readonly milestones: {
    readonly bossEventId: string; readonly checkpointIds: readonly string[]; readonly guardIds: readonly string[];
    readonly sealIds: readonly string[]; readonly shortcutIds: readonly string[];
  }; readonly order: IceExpanseOrder; readonly start: typeof ICE_GRAND_EXPANSE_START; readonly steps: readonly SceneStep[];
};
export type IceExpanseBudgetReceipt = {
  readonly derivedMapSha256: string; readonly deserializeMedianMs: number; readonly deserializeSamplesMs: readonly number[];
  readonly runId: string; readonly sceneMedianMs: number; readonly sceneSamplesMs: readonly number[];
  readonly serializedBytes: number; readonly sourceManifestSha256: string;
};

export class IceExpanseVerificationError extends Error {
  constructor(readonly code: "BUDGET_EXCEEDED" | "LOCAL_PROJECT_INVALID" | "ROUTE_INVALID", message: string) {
    super(message); this.name = "IceExpanseVerificationError";
  }
}

function canonicalMap(): GameMap {
  const width = 55; const height = 55; const lower = Array.from({ length: width * height }, () => 67);
  const stamped = stampCanonicalIceRidge({ width, height, lower }, { x: 24, y: 9 });
  if (!stamped.ok) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "canonical ridge fixture rejected");
  return {
    id: ICE_DIAGONAL_CANONICAL_SOURCE.mapId, name: ICE_DIAGONAL_CANONICAL_SOURCE.name, width, height,
    tilesetId: "easyrpg_chipset_dungeon", tileSize: 16, lowerTiles: [...stamped.lower],
    upperTiles: Array.from({ length: width * height }, () => -1), events: [],
  };
}

export async function createLocalIceGrandExpanseProject(): Promise<LocalIceExpanse> {
  const base = createSampleAdventureProject(); const originalStart = `${base.startMapId}:${base.startPos.x},${base.startPos.y}`;
  const collisionTileset = createBlankProject().tilesets.easyrpg_chipset_dungeon;
  if (collisionTileset === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "canonical collision tileset missing");
  base.tilesets.easyrpg_chipset_dungeon = structuredClone(collisionTileset);
  const canonical = canonicalMap(); const adventure = structuredClone(canonical);
  adventure.id = ICE_GRAND_ADVENTURE_MAP_ID; adventure.name = "local canonical sibling";
  base.maps[canonical.id] = canonical; base.maps[adventure.id] = adventure;
  base.mapTree.children.push({ mapId: canonical.id, children: [{ mapId: adventure.id, children: [] }] });
  for (const switchId of ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS) {
    if (!base.switches.some(({ id }) => id === switchId)) base.switches.push({ id: switchId, name: switchId });
    base.session.switches[switchId] = false;
  }
  const canonicalMapSha256 = await hashIceGrandExpanseMap(canonical);
  const installed = await installIceGrandExpanse(base, { expectedCanonicalMapHash: canonicalMapSha256 });
  if (installed.kind !== "installed" || installed.project.maps[ICE_GRAND_EXPANSE_MAP_ID] === undefined
    || `${installed.project.startMapId}:${installed.project.startPos.x},${installed.project.startPos.y}` !== originalStart) {
    throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "installer changed start or omitted derived map");
  }
  const serialized = serialize(installed.project);
  return { canonicalMapSha256, derivedMapSha256: installed.mapHash, project: installed.project, serialized };
}

const DELTAS = [
  { dir: "up", x: 0, y: -1 }, { dir: "left", x: -1, y: 0 },
  { dir: "right", x: 1, y: 0 }, { dir: "down", x: 0, y: 1 },
] as const satisfies readonly { readonly dir: Dir; readonly x: number; readonly y: number }[];
type Point = { readonly x: number; readonly y: number };

function path(project: Project, map: GameMap, from: Point, to: Point, blocked: ReadonlySet<number>): readonly Dir[] {
  const start = from.y * map.width + from.x; const goal = to.y * map.width + to.x;
  const queue = [start]; const previous = new Map<number, { readonly index: number; readonly dir: Dir }>();
  for (let cursor = 0; cursor < queue.length && !previous.has(goal); cursor += 1) {
    const index = queue[cursor]; if (index === undefined) break;
    const x = index % map.width; const y = Math.floor(index / map.width);
    for (const delta of DELTAS) {
      const nx = x + delta.x; const ny = y + delta.y; const next = ny * map.width + nx;
      if (next === start || previous.has(next) || (blocked.has(next) && next !== goal) || !canMove(project, map, x, y, nx, ny)) continue;
      previous.set(next, { index, dir: delta.dir }); queue.push(next);
    }
  }
  if (goal === start) return [];
  const reversed: Dir[] = []; let cursor = goal;
  while (cursor !== start) { const edge = previous.get(cursor); if (edge === undefined) throw new IceExpanseVerificationError("ROUTE_INVALID", `unreachable ${from.x},${from.y}->${to.x},${to.y}`); reversed.push(edge.dir); cursor = edge.index; }
  return reversed.reverse();
}

function requiredEvent(map: GameMap, id: string): GameEvent {
  const event = map.events.find((entry) => entry.id === id);
  if (event === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", `missing event ${id}`);
  return event;
}

function sceneSteps(project: Project, order: IceExpanseOrder, oneSealOnly: boolean): readonly SceneStep[] {
  const map = project.maps[ICE_GRAND_EXPANSE_MAP_ID];
  if (map === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "derived map missing");
  const blocked = new Set(map.events.filter((event) => event.trigger.kind === "action").map((event) => event.y * map.width + event.x));
  for (const spawn of ICE_GRAND_EXPANSE_FIELD_SPAWNS) blocked.add(spawn.y * map.width + spawn.x);
  const steps: SceneStep[] = []; let at: Point = ICE_GRAND_EXPANSE_START;
  const interact = (id: string, transferred?: Point): void => {
    const event = requiredEvent(map, id); const faces = DELTAS.map((delta) => ({ x: event.x - delta.x, y: event.y - delta.y, dir: delta.dir }));
    const viable = faces.flatMap((face) => { try { return [{ face, route: path(project, map, at, face, blocked) }]; } catch (error) { if (error instanceof IceExpanseVerificationError) return []; throw error; } }).sort((a, b) => a.route.length - b.route.length)[0];
    if (viable === undefined) throw new IceExpanseVerificationError("ROUTE_INVALID", `no action face for ${id}`);
    steps.push(...viable.route.map((dir): SceneStep => ({ kind: "move", dir })), { kind: "face", dir: viable.face.dir }, { kind: "interact" });
    at = transferred ?? { x: viable.face.x, y: viable.face.y };
  };
  interact(ICE_GRAND_EXPANSE_CHECKPOINTS[0].id);
  const firstSeal = order === "west-east" ? ICE_GRAND_EXPANSE_SEALS[0] : ICE_GRAND_EXPANSE_SEALS[1];
  const secondSeal = order === "west-east" ? ICE_GRAND_EXPANSE_SEALS[1] : ICE_GRAND_EXPANSE_SEALS[0];
  interact(firstSeal.id); if (oneSealOnly) return steps;
  interact(secondSeal.id);
  blocked.delete(ICE_GRAND_EXPANSE_GATE.y * map.width + ICE_GRAND_EXPANSE_GATE.x);
  const lake = order === "west-east" ? ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[0] : ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[1];
  interact(lake.id, lake.to); interact(ICE_GRAND_EXPANSE_CHECKPOINTS[1].id);
  const spawn = ICE_GRAND_EXPANSE_FIELD_SPAWNS[0]; if (spawn === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "field spawn missing");
  const contacts = DELTAS.map((delta) => ({ x: spawn.x - delta.x, y: spawn.y - delta.y, dir: delta.dir }));
  const contact = contacts.flatMap((face) => { try { return [{ face, route: path(project, map, at, face, blocked) }]; } catch (error) { if (error instanceof IceExpanseVerificationError) return []; throw error; } }).sort((a, b) => a.route.length - b.route.length)[0];
  if (contact === undefined) throw new IceExpanseVerificationError("ROUTE_INVALID", "field spawn has no reachable contact face");
  steps.push(...contact.route.map((dir): SceneStep => ({ kind: "move", dir })), { kind: "move", dir: contact.face.dir }); at = contact.face;
  for (const guard of (order === "west-east" ? ICE_GRAND_EXPANSE_GUARDS : [...ICE_GRAND_EXPANSE_GUARDS].reverse())) interact(guard.id);
  interact(ICE_GRAND_EXPANSE_CHECKPOINTS[2].id);
  const crown = order === "west-east" ? ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[2] : ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[3];
  interact(crown.id, crown.to); interact(ICE_GRAND_EXPANSE_BOSS_EVENT.id);
  return steps;
}

export async function iceGrandExpanseOrderInputs(order: IceExpanseOrder): Promise<IceExpanseOrderInput> {
  const { project } = await createLocalIceGrandExpanseProject();
  return {
    mapId: ICE_GRAND_EXPANSE_MAP_ID, order, start: ICE_GRAND_EXPANSE_START, steps: sceneSteps(project, order, false),
    milestones: {
      bossEventId: ICE_GRAND_EXPANSE_BOSS_EVENT.id, checkpointIds: ICE_GRAND_EXPANSE_CHECKPOINTS.map(({ id }) => id),
      guardIds: ICE_GRAND_EXPANSE_GUARDS.map(({ id }) => id), sealIds: ICE_GRAND_EXPANSE_SEALS.map(({ id }) => id),
      shortcutIds: order === "west-east" ? [ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[0].id, ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[2].id] : [ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[1].id, ICE_GRAND_EXPANSE_SHORTCUT_EVENTS[3].id],
    },
  };
}

export async function proveIceGrandExpanseGateClosed(order: IceExpanseOrder): Promise<IceExpanseGateProof> {
  const local = await createLocalIceGrandExpanseProject(); const map = local.project.maps[ICE_GRAND_EXPANSE_MAP_ID];
  if (map === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "derived map missing");
  const result = runSceneTest(local.project, { mapId: map.id, start: ICE_GRAND_EXPANSE_START, steps: sceneSteps(local.project, order, true) });
  if (!result.ok) throw new IceExpanseVerificationError("ROUTE_INVALID", result.failureReason ?? "one-seal scene failed");
  try { assertIceGrandExpanseSummitAccess(local.project, map, result.session); }
  catch (error) { if (error instanceof IceGrandExpanseGameplayError && error.code === "GATE_CLOSED") return { code: error.code, order, stepsRun: result.stepsRun }; throw error; }
  throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "one seal unexpectedly opened summit");
}

export async function runIceGrandExpanseOrder(order: IceExpanseOrder): Promise<IceExpanseOrderProof> {
  const local = await createLocalIceGrandExpanseProject(); const result = runSceneTest(local.project, { mapId: ICE_GRAND_EXPANSE_MAP_ID, start: ICE_GRAND_EXPANSE_START, steps: sceneSteps(local.project, order, false) });
  const fieldSpawn = ICE_GRAND_EXPANSE_FIELD_SPAWNS[0];
  if (fieldSpawn === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "field spawn missing");
  const fieldVictory = result.log.some((line) => line.startsWith(`field spawn __field_spawn__${fieldSpawn.id}_`) && line.endsWith(": victory"));
  const authoredBattles = result.log.flatMap((line) => /^battle ([^:]+):/u.exec(line)?.[1] ?? []);
  const battleTroops = fieldVictory ? [fieldSpawn.troopId, ...authoredBattles] : authoredBattles;
  const requiredTroops = ["troop_slime_pair", ...ICE_GRAND_EXPANSE_GUARDS.map(() => "troop_golem_guard"), "troop_dragon"];
  if (!result.ok || requiredTroops.some((troop, index) => battleTroops[index] !== troop)
    || result.session.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate] !== true) {
    throw new IceExpanseVerificationError("ROUTE_INVALID", result.failureReason ?? `unexpected battle sequence ${battleTroops.join(",")}`);
  }
  return { battleTroops, order, result };
}

function median(samples: readonly number[]): number { const ordered = [...samples].sort((a, b) => a - b); const value = ordered[1]; if (value === undefined) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", "median requires three samples"); return value; }

export async function measureIceGrandExpanseBudgets(): Promise<IceExpanseBudgetReceipt> {
  const local = await createLocalIceGrandExpanseProject(); deserialize(local.serialized);
  const deserializeSamplesMs = Array.from({ length: 3 }, () => { const started = performance.now(); deserialize(local.serialized); return performance.now() - started; });
  const scene = (): number => { const started = performance.now(); const result = runSceneTest(local.project, { mapId: ICE_GRAND_EXPANSE_MAP_ID, start: ICE_GRAND_EXPANSE_START, steps: [{ kind: "wait", ticks: 100 }] }); if (!result.ok) throw new IceExpanseVerificationError("LOCAL_PROJECT_INVALID", result.failureReason ?? "scene failed"); return performance.now() - started; };
  scene(); const sceneSamplesMs = Array.from({ length: 3 }, scene);
  const receipt = { runId: ICE_EXPANSE_RUN_ID, sourceManifestSha256: ICE_EXPANSE_SOURCE_MANIFEST_SHA256, derivedMapSha256: local.derivedMapSha256, serializedBytes: new TextEncoder().encode(local.serialized).length, deserializeSamplesMs, deserializeMedianMs: median(deserializeSamplesMs), sceneSamplesMs, sceneMedianMs: median(sceneSamplesMs) } satisfies IceExpanseBudgetReceipt;
  if (receipt.serializedBytes >= 12 * 1024 * 1024 || receipt.deserializeMedianMs >= 6_000 || receipt.sceneMedianMs >= 4_500) throw new IceExpanseVerificationError("BUDGET_EXCEEDED", JSON.stringify(receipt));
  return receipt;
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  Promise.all([measureIceGrandExpanseBudgets(), proveIceGrandExpanseGateClosed("west-east"), runIceGrandExpanseOrder("west-east"), runIceGrandExpanseOrder("east-west")])
    .then(([budgets, gate, westEast, eastWest]) => process.stdout.write(`${JSON.stringify({ budgets, gate, orders: [westEast, eastWest].map(({ order, battleTroops, result }) => ({ order, battleTroops, stepsRun: result.stepsRun })) })}\n`))
    .catch((error: unknown) => { // no-excuse-ok: catch -- top-level CLI boundary
      const payload = error instanceof IceExpanseVerificationError || error instanceof IceGrandExpanseGameplayError ? { code: error.code, message: error.message } : { code: "VERIFY_FAILED", message: error instanceof Error ? error.message : "unknown failure" };
      process.stderr.write(`${JSON.stringify(payload)}\n`); process.exitCode = 1;
    });
}
