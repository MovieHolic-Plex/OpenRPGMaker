import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { ItemRecord, Project } from "@/project/types";
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
