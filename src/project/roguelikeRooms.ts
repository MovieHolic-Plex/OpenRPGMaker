import type { RoguelikeRunState } from "./roguelikeRun";
import type { FieldSpawnDef, GameMap, RoguelikeEncounterChoice } from "./types";

export function roguelikeRoomId(map: GameMap): string {
  return map.roguelikeRoom?.roomId?.trim() || map.id;
}

export function roguelikeRoomGenerationKey(
  map: GameMap,
  run: RoguelikeRunState | undefined
): string | undefined {
  if (run?.status !== "active") return undefined;
  const roomId = roguelikeRoomId(map);
  const resetCount = normalizedResetCount(run.roomResetCounts[roomId]);
  return `${run.runId}:${run.seed}:${run.floor}:${roomId}:${resetCount}`;
}

export function resolveRoguelikeRoomFieldSpawns(
  map: GameMap,
  run: RoguelikeRunState | undefined
): FieldSpawnDef[] {
  const spawns = map.fieldSpawns ?? [];
  const slots = map.roguelikeRoom?.encounterSlots ?? [];
  if (run?.status !== "active" || slots.length === 0) return [...spawns];

  const managedIds = new Set(slots.flatMap((slot) => slot.choices.map((choice) => choice.fieldSpawnId)));
  const selectedIds = new Set<string>();
  const roomId = roguelikeRoomId(map);
  const resetCount = normalizedResetCount(run.roomResetCounts[roomId]);
  for (const slot of slots) {
    const eligible = slot.choices.filter((choice) => choiceIsEligible(choice, run.floor));
    const selected = pickChoice(eligible, `${run.seed}:${run.floor}:${roomId}:${resetCount}:${slot.id}`);
    if (selected) selectedIds.add(selected.fieldSpawnId);
  }
  return spawns.filter((spawn) => !managedIds.has(spawn.id) || selectedIds.has(spawn.id));
}

function choiceIsEligible(choice: RoguelikeEncounterChoice, floor: number): boolean {
  if (choice.minFloor !== undefined && floor < Math.trunc(choice.minFloor)) return false;
  if (choice.maxFloor !== undefined && floor > Math.trunc(choice.maxFloor)) return false;
  return true;
}

function pickChoice(
  choices: readonly RoguelikeEncounterChoice[],
  seedText: string
): RoguelikeEncounterChoice | undefined {
  if (choices.length === 0) return undefined;
  const total = choices.reduce((sum, choice) => sum + choiceWeight(choice), 0);
  let roll = fnv1a(seedText) % total;
  for (const choice of choices) {
    roll -= choiceWeight(choice);
    if (roll < 0) return choice;
  }
  return choices[choices.length - 1];
}

function choiceWeight(choice: RoguelikeEncounterChoice): number {
  const value = choice.weight;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function normalizedResetCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
