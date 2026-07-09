import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { useItemFromMenu } from "@/player/playerItemUse";

describe("player menu item use", () => {
  it("does not consume a recovery item on a full-HP target", () => {
    const { project, session, itemId, actorId } = itemUseFixture();
    const beforeHp = session.actorVitals[actorId]!.hp;

    const result = useItemFromMenu(project, session, itemId, actorId);

    expect(result.kind).toBe("unusable");
    expect(session.actorVitals[actorId]!.hp).toBe(beforeHp);
    expect(session.inventory[itemId]).toBe(1);
  });

  it("does not let a normal recovery item revive a dead actor", () => {
    const { project, session, itemId, actorId } = itemUseFixture();
    session.actorVitals[actorId]!.hp = 0;

    const result = useItemFromMenu(project, session, itemId, actorId);

    expect(result.kind).toBe("unusable");
    expect(session.actorVitals[actorId]!.hp).toBe(0);
    expect(session.inventory[itemId]).toBe(1);
  });

  it("applies all-ally recovery to every eligible actor and consumes once", () => {
    const { project, session, itemId, actorId } = itemUseFixture();
    const secondActorId = project.database.actors[1]!.id;
    session.partyActorIds = [actorId, secondActorId];
    session.actorVitals[actorId]!.hp = 10;
    session.actorVitals[secondActorId] = { hp: 80, mp: 10, maxHp: 80, maxMp: 10 };
    session.actorVitals[secondActorId]!.hp = session.actorVitals[secondActorId]!.maxHp;
    const item = project.database.items.find((record) => record.id === itemId)!;
    item.scope = "allAllies";

    const result = useItemFromMenu(project, session, itemId);

    expect(result.kind).toBe("used");
    expect(session.actorVitals[actorId]!.hp).toBe(40);
    expect(session.actorVitals[secondActorId]!.hp).toBe(session.actorVitals[secondActorId]!.maxHp);
    expect(session.inventory[itemId]).toBeUndefined();
  });

  it("removes cured states from the menu and refuses battle-only items", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.actorVitals[actorId] = { hp: 50, mp: 10, maxHp: 100, maxMp: 20 };
    session.actorStateIds = { [actorId]: ["state_poison"] };
    session.inventory = { item_antidote: 1, item_poison_dart: 1 };

    expect(useItemFromMenu(project, session, "item_antidote", actorId).kind).toBe("used");
    expect(session.actorStateIds[actorId]).toEqual([]);
    expect(useItemFromMenu(project, session, "item_poison_dart", actorId).kind).toBe("unusable");
  });
});

function itemUseFixture() {
  const project = createBlankProject();
  const session = startSession(project);
  const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
  if (!item) throw new Error("missing item fixture");
  item.name = "테스트 회복약";
  item.scope = "ally";
  item.occasion = "field";
  item.consumable = true;
  item.hpRecovery = { percentMax: 0, flat: 30 };
  item.mpRecovery = { percentMax: 0, flat: 0 };
  session.inventory = { [item.id]: 1 };
  const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
  if (!actorId) throw new Error("missing actor fixture");
  session.partyActorIds = [actorId];
  return { project, session, itemId: item.id, actorId };
}
