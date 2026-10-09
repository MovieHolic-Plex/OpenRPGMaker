import { describe, expect, it } from "vitest";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { giveMonster } from "@/project/monsterCollection";
import { battlerSnapshot, monsterPartyBattlers } from "@/battle/battleBattlers";

describe("battle rewards to play session", () => {
  it("grows a fallen actor's maximum HP without reviving them on level-up", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    const actor = normalizeActorRecord(project.database.actors.find((entry) => entry.id === actorId)!);
    const beforeMaxHp = session.actorVitals[actorId].maxHp;
    session.actorVitals[actorId].hp = 0;
    const levelUps = applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: totalExpForLevel(actor.expCurve, 40), gold: 0, items: [] },
    }, project);
    expect(levelUps.length).toBeGreaterThan(0);
    expect(session.actorVitals[actorId].maxHp).toBeGreaterThan(beforeMaxHp);
    expect(session.actorVitals[actorId].hp).toBe(0);
  });

  it("adds victory rewards to actor experience, gold, and inventory", () => {
    // Given: a play session with one party actor and no earned battle rewards.
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    expect(actorId).toBe("actor_hero");
    expect(session.actorExperience[actorId]).toBe(0);
    expect(session.gold).toBe(0);
    expect(session.inventory.item_bomb).toBeUndefined();

    // When: a victorious battle pays out EXP, gold, and an item drop.
    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
    }, project);

    // Then: the actual playable session carries the rewards forward.
    expect(session.actorExperience[actorId]).toBe(28);
    expect(session.gold).toBe(5);
    expect(session.inventory.item_bomb).toBe(1);
    expect(session.itemUseCharges).toEqual({});
  });

  it("grants duplicate reward entries as separate copies", () => {
    const project = createBlankProject();
    const session = startSession(project);

    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 0, gold: 0, items: ["item_bomb", "item_bomb"] },
    }, project);

    expect(session.inventory.item_bomb).toBe(2);
  });

  it("preserves the finite-use FIFO cursor when victory grants another copy", () => {
    const project = createBlankProject();
    const finiteItem = project.database.items.find((item) => item.id === "item_bomb")!;
    finiteItem.consumable = true;
    finiteItem.consumptionLimit = 3;
    const session = startSession(project);
    session.inventory[finiteItem.id] = 1;
    session.itemUseCharges = { [finiteItem.id]: 2 };

    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 0, gold: 0, items: [finiteItem.id] },
    }, project);

    expect(session.inventory[finiteItem.id]).toBe(2);
    expect(session.itemUseCharges).toEqual({ [finiteItem.id]: 2 });
  });

  it("does not pay rewards for escape or defeat", () => {
    // Given: a fresh play session.
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];

    // When: a non-victory result reports rewards in the battle snapshot.
    applyBattleRewardsToSession(session, {
      result: "escape",
      rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
    }, project);

    // Then: no victory reward leaks into the session.
    expect(session.actorExperience[actorId]).toBe(0);
    expect(session.gold).toBe(0);
    expect(session.inventory.item_bomb).toBeUndefined();
  });

  it("auto-levels the actor and grows vitals when victory exp crosses the curve", () => {
    // Given: a fresh session at level 1.
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    const hero = normalizeActorRecord(project.database.actors.find((entry) => entry.id === actorId)!);
    // 고레벨까지 올려 능력치 곡선 성장(양수)이 실제로 반영되는지 본다.
    const expForLevel40 = totalExpForLevel(hero.expCurve, 40);
    const beforeMaxHp = session.actorVitals[actorId].maxHp;

    // When: victory pays enough EXP to reach level 40.
    const levelUps = applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: { exp: expForLevel40, gold: 0, items: [] } },
      project
    );

    // Then: the level, max vitals, and current vitals all advance.
    expect(session.actorLevels[actorId]).toBe(40);
    expect(session.actorVitals[actorId].maxHp).toBeGreaterThan(beforeMaxHp);
    expect(session.actorVitals[actorId].hp).toBe(session.actorVitals[actorId].maxHp);
    expect(levelUps.length).toBeGreaterThanOrEqual(1);
    expect(levelUps.every((entry) => entry.toLevel === 40)).toBe(true);
    expect(levelUps.some((entry) => entry.actorId === actorId)).toBe(true);
  });

  it("teaches skills learned at the newly reached level", () => {
    // Given: the hero learns skill_heal at level 2.
    const project = createBlankProject();
    const heroRecord = project.database.actors.find((entry) => entry.id === "actor_hero")!;
    heroRecord.learnedSkills = [
      { level: 1, skillId: "default_skill" },
      { level: 2, skillId: "skill_heal" },
    ];
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    const expForLevel2 = totalExpForLevel(normalizeActorRecord(heroRecord).expCurve, 2);

    // When: victory triggers the level-up.
    applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: expForLevel2, gold: 0, items: [] } }, project);

    // Then: the newly learned skill is added to the session skill list.
    expect(session.actorSkillIds[actorId]).toContain("skill_heal");
  });

  it("returns battle-end state ids to the play session", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    session.actorStateIds ??= {};
    session.actorStateIds[actorId] = ["state_poison", "state_attack_up"];

    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 0, gold: 0, items: [] },
      actors: [{
        id: actorId,
        recordId: actorId,
        name: "Hero",
        hp: 10,
        maxHp: 10,
        mp: 3,
        maxMp: 3,
        gauge: 0,
        defeated: false,
        defending: false,
        stateIds: ["state_poison"],
        skillIds: [],
      }],
    }, project);

    expect(session.actorStateIds?.[actorId]).toEqual(["state_poison"]);
  });

  it("pays monster EXP only to battlers recorded as participants", () => {
    // Break caught: deriving participants from active + reserve snapshots grants
    // victory EXP to a monster that never entered the battle.
    const project = createBlankProject();
    const session = startSession(project);
    const active = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
    const reserve = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
    if (!active.ok || !reserve.ok) throw new Error("expected two party monsters");
    const [activeSnapshot, reserveSnapshot] = monsterPartyBattlers(
      project,
      [active.instance, reserve.instance],
    ).map((battler) => battlerSnapshot(battler));

    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 100, gold: 0, items: [] },
      actors: [activeSnapshot, reserveSnapshot],
      participatingActorIds: [active.instance.instanceId],
      monsterPartyMode: true,
    }, project);

    expect(session.monsterInstances[active.instance.instanceId]?.exp).toBe(100);
    expect(session.monsterInstances[reserve.instance.instanceId]?.exp).toBe(0);
  });

  it("keeps full live-monster-party EXP when regular actors fought", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const companion = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
    if (!companion.ok) throw new Error("expected a companion monster");

    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 100, gold: 0, items: [] },
      participatingActorIds: [session.partyActorIds[0]!],
      monsterPartyMode: false,
    }, project);

    expect(session.monsterInstances[companion.instance.instanceId]?.exp).toBe(100);
  });

  // 타이머의 진행(tick)은 맵 씬 소관이고 전투는 진입 시점 사본만 들고 있다. 사본 전체를
  // 되돌려 쓰면 전투 중 만료된 타이머가 진입 값으로 되살아나고, 이후 프레임도 만료된
  // 타이머를 건너뛰므로 자동 교정되지 않는다(2026-09-15 실측: 세션 1초 / 런타임 0초).
  describe("battle timer write-back", () => {
    function sessionWithTimer(seconds: number) {
      const project = createBlankProject();
      const session = startSession(project);
      session.timers.timer1 = seconds;
      return { project, session };
    }

    it("does not resurrect a timer the battle never wrote", () => {
      const { project, session } = sessionWithTimer(0);

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [] },
        eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 1 }, timerWrites: {} },
      }, project);

      expect(session.timers.timer1).toBe(0);
    });

    it("still writes back a timer the battle set", () => {
      const { project, session } = sessionWithTimer(0);

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [] },
        eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 7 }, timerWrites: { timer1: 7 } },
      }, project);

      expect(session.timers.timer1).toBe(7);
    });

    it("merges the whole snapshot when the writer did not report its keys", () => {
      const { project, session } = sessionWithTimer(0);

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [] },
        eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 3 } },
      }, project);

      expect(session.timers.timer1).toBe(3);
    });
  });
});
