import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { normalizeCropRecord } from "@/project/farmModel";
import { startSession } from "@/project/session";
import { placeableKey } from "@/project/placeables";
import { setEquippedTool } from "@/project/toolActions";
import type { ItemRecord, Project } from "@/project/types";
import { interactWithFarmPlot } from "@/player/farming";
import { useItemFromMenu } from "@/player/playerItemUse";

const POISON = "state_poison";
const SLEEP = "state_sleep";

describe("default item runtime usability", () => {
  it("uses every field or always item through the real menu authority", () => {
    const project = createBlankProject();

    for (const item of project.database.items.filter(isMenuUsable)) {
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      if (!actorId) throw new Error("default party actor is missing");
      session.inventory[item.id] = 1;
      session.actorVitals[actorId] = { hp: 1, mp: 0, maxHp: 500, maxMp: 200 };
      session.actorStateIds ??= {};
      session.actorStateIds[actorId] = [POISON, SLEEP];
      session.actorSkillIds ??= {};
      session.actorSkillIds[actorId] = project.database.skills
        .map((skill) => skill.id)
        .filter((skillId) => skillId !== learnedSkillId(item));

      if (item.onlyEffectiveOnDeadActors) session.actorVitals[actorId]!.hp = 0;
      const before = session.inventory[item.id] ?? 0;
      const result = useItemFromMenu(project, session, item.id, actorId);

      expect(result.kind, item.id).toBe("used");
      expect(session.inventory[item.id] ?? 0, item.id).toBe(before - 1);
    }
  });

  it("drives the three default farm tools through till, water, and mine actions", () => {
    const project = createBlankProject();
    project.database.crops ??= [];
    project.database.crops.push(normalizeCropRecord({
      id: "crop_tool_probe",
      name: "도구 시험 작물",
      seedItemId: "item_seed_bag",
      harvestItemId: "item_potato",
      stages: [{ days: 1 }],
      seasons: ["spring"],
    }));
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("default map is missing");
    const map = { ...sourceMap, farmableArea: [{ x: 2, y: 2, w: 2, h: 1 }] };
    const session = startSession(project);
    session.inventory.item_hoe = 1;
    session.inventory.item_watering_can = 1;
    session.inventory.item_pickaxe = 1;

    setEquippedTool(session, "item_hoe");
    expect(interactWithFarmPlot(project, session, map, 2, 2, "till")).toMatchObject({
      kind: "tilled",
      itemId: "item_hoe",
    });

    setEquippedTool(session, "item_watering_can");
    const plot = session.farmPlots?.[map.id]?.["2,2"];
    if (!plot) throw new Error("tilled plot is missing");
    session.farmPlots![map.id]!["2,2"] = { ...plot, cropId: "crop_tool_probe" };
    expect(interactWithFarmPlot(project, session, map, 2, 2, "water")).toMatchObject({
      kind: "watered",
      itemId: "item_watering_can",
    });

    const rockKey = placeableKey(map.id, 3, 2);
    session.placeables ??= {};
    session.placeables[rockKey] = { id: "runtime-tool-rock", mapId: map.id, x: 3, y: 2, kind: "rock", itemId: "item_iron_ore" };
    const oreBefore = session.inventory.item_iron_ore ?? 0;
    setEquippedTool(session, "item_pickaxe");
    expect(interactWithFarmPlot(project, session, map, 3, 2)).toMatchObject({
      kind: "harvested",
      itemId: "item_iron_ore",
      source: "rock",
    });
    expect(session.placeables[rockKey]).toBeUndefined();
    expect(session.inventory.item_iron_ore).toBe(oreBefore + 1);
  });

  it("lands a real effect and consumes one copy for every battle item", () => {
    const project = createBlankProject();
    const actorId = project.system.startActorIds[0];
    const targetActorId = project.database.actors.find((actor) => actor.id !== actorId)?.id;
    const troopId = project.database.troops[0]?.id;
    if (!actorId || !targetActorId || !troopId) throw new Error("default battle fixture is incomplete");

    for (const item of project.database.items.filter(isBattleUsable)) {
      const runtime = battleRuntimeFor(project, troopId, actorId, targetActorId, item);
      runtime.tick(1_000);
      const before = runtime.snapshot();
      const enemyId = before.enemies[0]?.id;
      if (!enemyId) throw new Error("default troop enemy is missing");

      runtime.performActorCommand({
        kind: "item",
        itemId: item.id,
        targetEnemyId: item.scope === "enemy" ? enemyId : "",
        ...(item.scope === "ally" || item.scope === "allAllies" ? { targetActorId } : {}),
      });
      const after = runtime.snapshot();

      expect(after.eventState.inventory[item.id] ?? 0, item.id).toBe(1);
      expect(battleEffectLanded(before, after), item.id).toBe(true);
    }
  });
});

function isMenuUsable(item: ItemRecord): boolean {
  return item.occasion === "always" || item.occasion === "field" || item.occasionField;
}

function isBattleUsable(item: ItemRecord): boolean {
  if (item.occasion === "never" || item.occasion === "field" || item.captureProfile) return false;
  if (item.occasionBattle === false && item.occasion !== "battle" && item.occasion !== "always") return false;
  return Boolean(
    item.skillId ||
      item.activateSkillId ||
      item.hpRecovery.flat > 0 ||
      item.hpRecovery.percentMax > 0 ||
      item.mpRecovery.flat > 0 ||
      item.mpRecovery.percentMax > 0 ||
      item.healStateIds.length > 0 ||
      item.stateEffects.length > 0
  );
}

function learnedSkillId(item: ItemRecord): string | undefined {
  return item.learnedSkillId ?? (item.type === "book" ? item.skillId : undefined);
}

function battleRuntimeFor(project: Project, troopId: string, actorId: string, targetActorId: string, item: ItemRecord) {
  return createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    rng: () => 0,
    sessionState: {
      switches: {},
      variables: {},
      inventory: { [item.id]: 2 },
    },
    party: {
      levels: { [actorId]: 1 },
      experience: { [actorId]: 0 },
      vitals: {
        [actorId]: { hp: 500, mp: 200 },
        [targetActorId]: { hp: 1, mp: 0 },
      },
      stateIds: { [targetActorId]: [POISON, SLEEP] },
      partyActorIds: [actorId, targetActorId],
    },
  });
}

function battleEffectLanded(
  before: ReturnType<ReturnType<typeof createBattleRuntime>["snapshot"]>,
  after: ReturnType<ReturnType<typeof createBattleRuntime>["snapshot"]>,
): boolean {
  const beforeBattlers = [...before.actors, ...before.enemies];
  const afterBattlers = [...after.actors, ...after.enemies];
  return beforeBattlers.some((previous) => {
    const next = afterBattlers.find((battler) => battler.id === previous.id);
    return Boolean(
      next &&
        (next.hp !== previous.hp ||
          next.mp !== previous.mp ||
          JSON.stringify(next.stateIds) !== JSON.stringify(previous.stateIds))
    );
  });
}
