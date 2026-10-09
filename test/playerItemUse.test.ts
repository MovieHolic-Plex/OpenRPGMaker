import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { useItemFromMenu } from "@/player/playerItemUse";

describe("player menu item use", () => {
  // Break caught: 메뉴 경로가 stateEffects 의 remove 만 읽어서, 상태를 "부여"하는 아이템은
  // 필드에서 항상 "효과가 없습니다" 였다(전투에서만 작동).
  it("applies a guaranteed add-op state effect from the menu and consumes the item", () => {
    const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);

    const result = useItemFromMenu(project, session, itemId, actorId);

    expect(result.kind).toBe("used");
    expect(session.actorStateIds?.[actorId]).toContain(stateId);
    expect(session.inventory[itemId]).toBeUndefined();
  });

  it("refuses an add-op state item when the target already carries the state", () => {
    const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
    session.actorStateIds = { [actorId]: [stateId] };

    const result = useItemFromMenu(project, session, itemId, actorId);

    expect(result.kind).toBe("unusable");
    expect(session.actorStateIds[actorId]).toEqual([stateId]);
    expect(session.inventory[itemId]).toBe(1);
  });

  // Break caught: 부여 판정을 Math.random 으로 굴리면 같은 시드의 세이브가 다른 결과를 낳는다
  // (저장소 계약: src/player·src/battle 는 세션 시드 스트림만 쓴다).
  it("replays the same partial-chance inflict outcome for the same session seed", () => {
    const outcomeFor = (seed: number): readonly string[] => {
      const { project, session, itemId, actorId } = stateInflictFixture(50, seed);
      const results: string[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        session.inventory[itemId] = 1;
        session.actorStateIds = { [actorId]: [] };
        results.push(useItemFromMenu(project, session, itemId, actorId).kind);
      }
      return results;
    };

    expect(outcomeFor(20260904)).toEqual(outcomeFor(20260904));
    // 부분 확률이므로 시드가 다르면 시퀀스도 갈라져야 한다(상수 반환 방지).
    expect(outcomeFor(20260904)).not.toEqual(outcomeFor(11111));
  });

  it("keeps a zero-chance add-op state item unused instead of burning a copy", () => {
    const { project, session, itemId, actorId, stateId } = stateInflictFixture(0);

    const result = useItemFromMenu(project, session, itemId, actorId);

    expect(result.kind).toBe("unusable");
    expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
    expect(session.inventory[itemId]).toBe(1);
  });

  it("does not advance the battle RNG for guaranteed, impossible, existing or missing states", () => {
    for (const condition of ["guaranteed", "impossible", "existing", "missing"] as const) {
      const { project, session, itemId, actorId, stateId } = stateInflictFixture(condition === "impossible" ? 0 : condition === "guaranteed" ? 100 : 50, 42);
      if (condition === "existing") session.actorStateIds = { [actorId]: [stateId] };
      if (condition === "missing") project.database.states = project.database.states.filter((state) => state.id !== stateId);
      const beforeRng = structuredClone(session.rng);

      const result = useItemFromMenu(project, session, itemId, actorId);

      expect(session.rng).toEqual(beforeRng);
      expect(result.kind).toBe(condition === "guaranteed" ? "used" : "unusable");
      if (condition === "missing") expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
    }
  });

  it("applies a party state item to each eligible actor and spends one charge for the whole use", () => {
    const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
    const secondActorId = project.database.actors.find((actor) => actor.id !== actorId)!.id;
    session.partyActorIds.push(secondActorId);
    session.actorVitals[secondActorId] = { ...session.actorVitals[actorId]! };
    const item = project.database.items.find((item) => item.id === itemId)!;
    item.scope = "allAllies";
    item.consumptionLimit = 3;

    expect(useItemFromMenu(project, session, itemId).kind).toBe("used");
    expect(session.actorStateIds?.[actorId]).toEqual([stateId]);
    expect(session.actorStateIds?.[secondActorId]).toEqual([stateId]);
    expect(session.inventory[itemId]).toBe(1);
    // FIFO cursor counts successful uses of the current copy, not remaining charges.
    expect(session.itemUseCharges?.[itemId]).toBe(1);
  });

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

function stateInflictFixture(chance: number, seed?: number) {
  const project = createBlankProject();
  const session = startSession(project, seed);
  const state = project.database.states[0];
  const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
  if (!state || !item) throw new Error("missing fixture");
  item.name = "테스트 강화제";
  item.scope = "ally";
  item.occasion = "field";
  item.occasionField = true;
  item.consumable = true;
  item.consumptionLimit = "noLimit";
  item.hpRecovery = { percentMax: 0, flat: 0 };
  item.mpRecovery = { percentMax: 0, flat: 0 };
  item.healStateIds = [];
  item.stateEffects = [{ stateId: state.id, chance, operation: "add" }];
  session.inventory = { [item.id]: 1 };
  const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
  if (!actorId) throw new Error("missing actor fixture");
  session.partyActorIds = [actorId];
  session.actorVitals[actorId] = { hp: 40, mp: 10, maxHp: 40, maxMp: 10 };
  return { project, session, itemId: item.id, actorId, stateId: state.id };
}

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
