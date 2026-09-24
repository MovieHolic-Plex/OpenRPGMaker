import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import { createBattleRuntime } from "@/battle/runtime";
import { isBattleItemUserEligible } from "@/battle/battleItemEligibility";

function fixture() {
  const project = createBlankProject();
  project.system.battleParty = "monsters";
  const session = startSession(project);
  const speciesId = project.database.monsterSpecies![0]!.id;
  const gift = giveMonster(project, session, { speciesId, level: 10 });
  if (!gift.ok) throw new Error("Monster fixture admission failed");
  gift.instance.currentHp = 1;
  const item = normalizeItemRecord({ id: "monster_medicine", name: "Medicine", type: "medicine", scope: "ally", occasion: "battle", consumable: true, hpRecovery: { flat: 20, percentMax: 0 } });
  project.database.items.push(item);
  session.inventory[item.id] = 2;
  const user = { recordId: gift.instance.instanceId, monsterInstanceId: gift.instance.instanceId, speciesId };
  return { project, session, instance: gift.instance, item, user };
}

describe("monster battle medicine", () => {
  it("accepts and executes medicine once for a wounded monster", () => {
    const { project, session, instance, item } = fixture();
    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, partyMonsters: [instance], sessionState: session, canEscape: true, canLose: true, rng: () => 0.5 });
    try {
      for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i++) runtime.tick(100);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.beginActorCommand({ kind: "item", itemId: item.id });
      const selection = runtime.snapshot().targetSelection;
      if (selection) runtime.selectTarget(selection.targetIds[0]!);
      const result = runtime.snapshot();
      expect(result.eventState.inventory[item.id]).toBe(1);
      expect(result.actionLog.some(action => action.targetId === `mon:${instance.instanceId}` && action.amount > 0)).toBe(true);
      expect(result.actors[0]!.hp).toBeGreaterThan(1);
    } finally { runtime.cancel(); }
  });

  it("preserves actor/class restrictions and does not turn actor books or seeds into monster items", () => {
    const { project, item, user } = fixture();
    expect(isBattleItemUserEligible(project, item, user)).toBe(true);
    expect(isBattleItemUserEligible(project, item, { ...user, speciesId: "missing" })).toBe(false);
    for (const restricted of [{ ...item, usableActorIds: [project.database.actors[0]!.id] }, { ...item, usableClassIds: [project.database.classes[0]!.id] }]) {
      expect(isBattleItemUserEligible(project, restricted, user)).toBe(false);
    }
    for (const type of ["book", "seed"] as const) expect(isBattleItemUserEligible(project, { ...item, type }, user)).toBe(false);
    const actor = project.database.actors[0]!;
    expect(isBattleItemUserEligible(project, { ...item, usableActorIds: [actor.id] }, { recordId: actor.id, classId: actor.classId })).toBe(true);
    expect(isBattleItemUserEligible(project, { ...item, usableActorIds: ["someone_else"] }, { recordId: actor.id })).toBe(false);
  });
});
