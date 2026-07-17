import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import {
  applyCareItem,
  applyWalkCareTicks,
  resolveMonsterCare,
} from "@/project/monsterCare";
import { evolveMonster, giveMonster, moveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { Project } from "@/project/types";

function careProject(): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.database.items.push(
    normalizeItemRecord({
      id: "item_monster_berry",
      name: "몬스터 열매",
      scope: "none",
      price: 10,
      type: "special",
      occasion: "field",
      consumable: true,
      careProfile: { kind: "feed", friendshipDelta: 20, expDelta: 0 },
    }),
    normalizeItemRecord({
      id: "item_monster_toy",
      name: "장난감",
      scope: "none",
      price: 15,
      type: "special",
      occasion: "field",
      consumable: true,
      careProfile: { kind: "toy", friendshipDelta: 15 },
    })
  );
  return project;
}

describe("monster out-of-battle care", () => {
  it("resolves monsterCare defaults", () => {
    const project = createBlankProject();
    expect(resolveMonsterCare(project)).toEqual({
      stepsPerTick: 50,
      walkFriendship: 1,
      walkExp: 1,
      dailyCareCap: 30,
    });

    project.system.monsterCare = {
      stepsPerTick: 10,
      walkFriendship: 2,
      walkExp: 3,
      dailyCareCap: 5,
    };
    expect(resolveMonsterCare(project)).toEqual({
      stepsPerTick: 10,
      walkFriendship: 2,
      walkExp: 3,
      dailyCareCap: 5,
    });

    const normalized = normalizeSystemRecords({
      startActorIds: project.system.startActorIds,
      monsterCare: { stepsPerTick: 0, walkFriendship: -1, walkExp: 4, dailyCareCap: 9 },
    });
    expect(normalized.monsterCare).toEqual({
      stepsPerTick: 50,
      walkFriendship: 0,
      walkExp: 4,
      dailyCareCap: 9,
    });
  });

  it("care item on party monster increases friendship and consumes item", () => {
    const project = careProject();
    const session = startSession(project, 1);
    session.inventory.item_monster_berry = 2;
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    const result = applyCareItem(project, session, {
      itemId: "item_monster_berry",
      instanceId: gift.instance.instanceId,
    });
    expect(result).toMatchObject({
      ok: true,
      friendship: 90,
      friendshipDelta: 20,
      kind: "feed",
    });
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(90);
    expect(session.inventory.item_monster_berry).toBe(1);

    const menu = useItemFromMenu(project, session, "item_monster_berry", undefined, gift.instance.instanceId);
    expect(menu.kind).toBe("used");
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(110);
    expect(session.inventory.item_monster_berry ?? 0).toBe(0);
  });

  it("care item on box monster fails", () => {
    const project = careProject();
    const session = startSession(project, 2);
    session.inventory.item_monster_toy = 1;
    for (let index = 0; index < 6; index += 1) {
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 2 });
    }
    const boxed = giveMonster(project, session, { speciesId: "species_wild_slime", level: 2, friendship: 40 });
    expect(boxed.ok && boxed.location).toBe("box");
    if (!boxed.ok) return;

    const result = applyCareItem(project, session, {
      itemId: "item_monster_toy",
      instanceId: boxed.instance.instanceId,
    });
    expect(result).toEqual({ ok: false, reason: "notInParty" });
    expect(session.inventory.item_monster_toy).toBe(1);
    expect(session.monsterInstances[boxed.instance.instanceId]?.friendship).toBe(40);

    const moved = moveMonster(session, boxed.instance.instanceId, "box", project);
    expect(moved.ok).toBe(true);
    const menu = useItemFromMenu(project, session, "item_monster_toy", undefined, boxed.instance.instanceId);
    expect(menu.kind).toBe("unusable");
    expect(session.inventory.item_monster_toy).toBe(1);
  });

  it("walk ticks at 50 steps apply +1 friendship under cap", () => {
    const project = careProject();
    const session = startSession(project, 3);
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 10 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    const partial = applyWalkCareTicks(project, session, 49);
    expect(partial.ticksApplied).toBe(0);
    expect(session.monsterCareSteps).toBe(49);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(10);

    const tick = applyWalkCareTicks(project, session, 1);
    expect(tick.ticksApplied).toBe(1);
    expect(tick.friendshipGranted).toBe(1);
    expect(session.monsterCareSteps).toBe(0);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(11);
    expect(session.monsterCareDaily?.["no-time"]).toBe(1);
  });

  it("dailyCareCap blocks further walk friendship", () => {
    const project = careProject();
    project.system.monsterCare = {
      stepsPerTick: 1,
      walkFriendship: 5,
      walkExp: 0,
      dailyCareCap: 12,
    };
    const session = startSession(project, 4);
    session.gameTime = { minute: 0, hour: 8, day: 1, season: "spring", year: 1 };
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 0 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    applyWalkCareTicks(project, session, 3);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
    expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

    applyWalkCareTicks(project, session, 10);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
    expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

    session.gameTime = { minute: 0, hour: 8, day: 2, season: "spring", year: 1 };
    applyWalkCareTicks(project, session, 1);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(17);
    expect(session.monsterCareDaily?.["1:spring:2"]).toBe(5);
  });

  it("save/load preserves care counters and friendship", () => {
    const project = careProject();
    const session = startSession(project, 5);
    session.inventory.item_monster_berry = 1;
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 50 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
    applyWalkCareTicks(project, session, 75);
    expect(session.monsterCareSteps).toBe(25);
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.monsterCareSteps).toBe(25);
    expect(restored.monsterCareDaily).toEqual(session.monsterCareDaily);
    expect(restored.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);
    expect(restored.inventory.item_monster_berry ?? 0).toBe(0);
  });

  it("care item friendship can unlock friendship evolution", () => {
    const project = careProject();
    const species = project.database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
    if (!species) throw new Error("missing slime");
    species.evolutions = [{ toSpeciesId: "species_king_slime", requires: { friendshipAtLeast: 200 } }];

    const session = startSession(project, 6);
    session.inventory.item_monster_berry = 7;
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    for (let index = 0; index < 6; index += 1) {
      const care = applyCareItem(project, session, {
        itemId: "item_monster_berry",
        instanceId: gift.instance.instanceId,
      });
      expect(care.ok).toBe(true);
    }
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(190);

    const blocked = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
    expect(blocked.ok).toBe(false);

    applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
    expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(210);

    const evolved = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
    expect(evolved.ok && evolved.toSpeciesId).toBe("species_king_slime");
    expect(session.monsterInstances[gift.instance.instanceId]?.speciesId).toBe("species_king_slime");
  });
});
