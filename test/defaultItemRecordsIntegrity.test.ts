import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBattleRuntime } from "@/battle/runtime";
import { startSession } from "@/project/session";
import { useItemFromMenu } from "@/player/playerItemUse";
import { DEFAULT_ITEM_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";

describe("default item catalog integrity", () => {
  it("types recovery items as medicine and key items as normalGoods", () => {
    const items = createBlankProject().database.items;
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));

    expect(byId.item_potion?.type).toBe("medicine");
    expect(byId.item_ether?.type).toBe("medicine");
    expect(byId.item_antidote?.type).toBe("medicine");
    expect(byId.item_hi_potion?.type).toBe("medicine");
    expect(byId.item_elixir?.type).toBe("medicine");
    expect(byId.item_panacea?.type).toBe("medicine");
    expect(byId.item_poison_dart?.type).toBe("special");
    expect(byId.item_throwing_knife?.type).toBe("special");
    expect(byId.item_guard_talisman?.type).toBe("special");
    expect(byId.item_sword_manual?.type).toBe("book");
    expect(byId.item_old_key?.type).toBe("normalGoods");
    expect(byId.item_warp_scroll?.occasion).toBe("never");
  });

  it("uses menu recovery and state cures for medicine items", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.actorVitals[actorId] = { hp: 10, mp: 2, maxHp: 100, maxMp: 40 };
    session.actorStateIds = { [actorId]: [DEFAULT_STATE_ID, "state_sleep"] };
    session.inventory = {
      [DEFAULT_ITEM_ID]: 1,
      item_ether: 1,
      item_hi_potion: 1,
      item_elixir: 1,
      item_antidote: 1,
      item_panacea: 1,
    };

    expect(useItemFromMenu(project, session, DEFAULT_ITEM_ID, actorId).kind).toBe("used");
    expect(session.actorVitals[actorId]!.hp).toBe(60);

    expect(useItemFromMenu(project, session, "item_hi_potion", actorId).kind).toBe("used");
    expect(session.actorVitals[actorId]!.hp).toBe(100);

    session.actorVitals[actorId]!.mp = 2;
    expect(useItemFromMenu(project, session, "item_ether", actorId).kind).toBe("used");
    expect(session.actorVitals[actorId]!.mp).toBe(32);

    session.actorVitals[actorId] = { hp: 1, mp: 1, maxHp: 100, maxMp: 40 };
    expect(useItemFromMenu(project, session, "item_elixir", actorId).kind).toBe("used");
    expect(session.actorVitals[actorId]).toMatchObject({ hp: 100, mp: 40 });

    session.actorStateIds[actorId] = [DEFAULT_STATE_ID];
    expect(useItemFromMenu(project, session, "item_antidote", actorId).kind).toBe("used");
    expect(session.actorStateIds[actorId]).toEqual([]);

    session.actorStateIds[actorId] = [DEFAULT_STATE_ID, "state_sleep"];
    expect(useItemFromMenu(project, session, "item_panacea", actorId).kind).toBe("used");
    expect(session.actorStateIds[actorId]).toEqual([]);
  });

  it("teaches skills from book items once and consumes the book", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.inventory = { item_sword_manual: 1 };
    session.actorSkillIds = { [actorId]: [] };

    const first = useItemFromMenu(project, session, "item_sword_manual", actorId);
    expect(first.kind).toBe("used");
    expect(session.actorSkillIds[actorId]).toContain("skill_sword_slash");
    expect(session.inventory.item_sword_manual ?? 0).toBe(0);

    session.inventory.item_sword_manual = 1;
    const second = useItemFromMenu(project, session, "item_sword_manual", actorId);
    expect(second.kind).toBe("unusable");
    expect(session.inventory.item_sword_manual).toBe(1);
  });

  it("applies medicine recovery and special skills in battle", () => {
    const project = createBlankProject();
    const troopId = project.database.troops[0]?.id;
    const actorId = project.database.actors[0]?.id;
    if (!troopId || !actorId) throw new Error("missing troop/actor");

    const medicine = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      sessionState: {
        switches: {},
        variables: {},
        inventory: { [DEFAULT_ITEM_ID]: 1, item_elixir: 1 },
      },
      party: {
        levels: { [actorId]: 1 },
        experience: { [actorId]: 0 },
        vitals: { [actorId]: { hp: 20, mp: 5 } },
      },
    });
    medicine.tick(1_000);
    expect(medicine.snapshot().actors[0]!.hp).toBe(20);
    medicine.performActorCommand({ kind: "item", itemId: DEFAULT_ITEM_ID, targetEnemyId: "" });
    expect(medicine.snapshot().actors[0]!.hp).toBe(70);
    expect(medicine.snapshot().eventState.inventory[DEFAULT_ITEM_ID] ?? 0).toBe(0);

    medicine.tick(5_000);
    expect(medicine.snapshot().phase).toBe("actorCommand");
    medicine.performActorCommand({ kind: "item", itemId: "item_elixir", targetEnemyId: "" });
    const afterElixir = medicine.snapshot().actors[0]!;
    expect(afterElixir.hp).toBe(afterElixir.maxHp);
    expect(afterElixir.mp).toBe(afterElixir.maxMp);

    const knife = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      sessionState: { switches: {}, variables: {}, inventory: { item_throwing_knife: 1 } },
      party: { levels: { [actorId]: 1 }, experience: { [actorId]: 0 } },
    });
    knife.tick(1_000);
    const enemyBefore = knife.snapshot().enemies[0]!;
    knife.performActorCommand({ kind: "item", itemId: "item_throwing_knife", targetEnemyId: enemyBefore.id });
    const enemyAfter = knife.snapshot().enemies.find((entry) => entry.id === enemyBefore.id)!;
    expect(enemyAfter.hp).toBeLessThan(enemyBefore.hp);
    expect(enemyAfter.stateIds ?? []).not.toContain(DEFAULT_STATE_ID);

    const guard = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      sessionState: { switches: {}, variables: {}, inventory: { item_guard_talisman: 1 } },
      party: { levels: { [actorId]: 1 }, experience: { [actorId]: 0 } },
    });
    guard.tick(1_000);
    guard.performActorCommand({ kind: "item", itemId: "item_guard_talisman", targetEnemyId: "" });
    expect(guard.snapshot().actors[0]!.stateIds).toContain("state_defense_up");
  });
});
