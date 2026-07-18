import { charsetFrameIndex } from "../../src/assets/easyrpgRtp";
import type { Command, EventPage, EventPageGraphic, EventPageMovement, GameEvent } from "../../src/project/types";
import { FINAL_MAP_ID } from "./blueprint";
import { VILLAGERS, type VillagerBlueprint } from "./villagers";

export function createReferenceVillagers(): GameEvent[] {
  return VILLAGERS.map(createVillager);
}

function createVillager(villager: VillagerBlueprint): GameEvent {
  const movement: EventPageMovement = {
    type: villager.movement,
    speed: villager.movement === "random" ? 3 : 2,
    frequency: villager.movement === "random" ? 4 : 3,
  };
  const commands: Command[] = [{ kind: "text", speaker: villager.name, body: villager.line }];
  const page: EventPage = {
    id: `${villager.id}_page`,
    name: villager.name,
    conditions: [],
    graphic: charsetGraphic(villager.spriteId, villager.characterIndex),
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement,
    commands,
  };
  return {
    id: villager.id,
    characterId: villager.id.replace("ev_reference_villager_", "character_reference_"),
    x: villager.at.x,
    y: villager.at.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
    schedule: villager.routine.map((entry) => ({
      when: { timePhase: entry.phase },
      at: { mapId: FINAL_MAP_ID, x: entry.at.x, y: entry.at.y },
      facing: entry.facing,
      activity: entry.activity,
    })),
  };
}

function charsetGraphic(spriteId: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}
