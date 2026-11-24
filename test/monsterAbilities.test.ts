import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { giveMonster, normalizeMonsterSpeciesRecord, applyMonsterExperienceAndEvolution, DEFAULT_MONSTER_EXP_CURVE, moveMonster } from "@/project/monsterCollection";
import { startSession, type PlaySession } from "@/project/session";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { ItemRecord, Project, Command } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { fusionResultSpeciesId, fuseMonsters, removeMonster, tradeMonster } from "@/project/monsterTrade";
import { createInterpreter } from "@/player/interpreter";
import { abilityBlocksStatus, abilityContactStatus, abilityDamagePercent, abilityDefensePercent, abilityEndureDamage, abilityOffensePercent, abilityTypeImmunity, normalizeMonsterAbility, scaleDamageByPercent } from "@/battle/abilities";
import { totalExpForLevel } from "@/project/actorModel";
import { addFollowerToSession, removeFollowerFromSession, syncMonsterPartyFollowers } from "@/project/followers";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("defaultFeatureItemRuntime", () => {
  isolateTimers();
  function catalogItem(project: Project, id: string): ItemRecord {
    const item = project.database.items.find((record) => record.id === id);
    if (!item) throw new Error(`기본 아이템이 없습니다: ${id}`);
    return item;
  }
  function battleFor(project: Project, itemId: string, inventory = 1, itemUseCharges?: Record<string, number>) {
    const actorIds = project.database.actors.slice(0, 2).map((actor) => actor.id);
    const troopId = project.database.troops[0]?.id;
    if (actorIds.length < 2 || !troopId) throw new Error("기본 전투 데이터가 부족합니다.");
    const runtime = createBattleRuntime({
      project,
      troopId,
      canEscape: false,
      canLose: true,
      rng: () => 0,
      sessionState: { switches: {}, variables: {}, inventory: { [itemId]: inventory }, itemUseCharges },
      party: {
        levels: Object.fromEntries(actorIds.map((id) => [id, 1])),
        experience: Object.fromEntries(actorIds.map((id) => [id, 0])),
        vitals: Object.fromEntries(actorIds.map((id) => [id, { hp: 1, mp: 0 }])),
        stateIds: Object.fromEntries(actorIds.map((id) => [id, []])),
        partyActorIds: actorIds,
      },
    });
    runtime.tick(1_000);
    return { runtime, actorIds };
  }
  describe("확장 기본 아이템 실행 경로", () => {
    it("아이템 고유 상태 효과 경로로 전투 강화 상태를 부여한다", () => {
      const project = createBlankProject();
      const { runtime, actorIds } = battleFor(project, "item_gen2_war_draught");

      runtime.performActorCommand({ kind: "item", itemId: "item_gen2_war_draught", targetEnemyId: "", targetActorId: actorIds[1]! });

      expect(runtime.snapshot().actors.find((actor) => actor.recordId === actorIds[1])?.stateIds).toContain("state_attack_up");
      expect(runtime.snapshot().eventState.inventory.item_gen2_war_draught ?? 0).toBe(0);
    });

    it("아군 전체 회복을 모든 대상에 적용하고 한 개만 소모한다", () => {
      const project = createBlankProject();
      const { runtime, actorIds } = battleFor(project, "item_gen2_party_potion");

      runtime.performActorCommand({ kind: "item", itemId: "item_gen2_party_potion", targetEnemyId: "", targetActorId: actorIds[0]! });

      expect(runtime.snapshot().actors.map((actor) => actor.hp).every((hp) => hp > 1)).toBe(true);
      expect(runtime.snapshot().eventState.inventory.item_gen2_party_potion ?? 0).toBe(0);
    });

    it("사료와 장난감의 돌봄 수치를 파티 몬스터에게 적용한다", () => {
      const project = createBlankProject();
      project.system.monsterCollection = true;
      const session = startSession(project, 41);
      const speciesId = project.database.monsterSpecies?.[0]?.id;
      if (!speciesId) throw new Error("기본 몬스터 종이 없습니다.");
      const given = giveMonster(project, session, { speciesId, level: 1, friendship: 20 });
      if (!given.ok) throw new Error("몬스터를 파티에 넣지 못했습니다.");
      session.inventory.item_gen2_monster_feast = 1;
      session.inventory.item_gen2_training_frisbee = 1;

      expect(useItemFromMenu(project, session, "item_gen2_monster_feast", undefined, given.instance.instanceId).kind).toBe("used");
      expect(useItemFromMenu(project, session, "item_gen2_training_frisbee", undefined, given.instance.instanceId).kind).toBe("used");
      expect(session.monsterInstances[given.instance.instanceId]?.friendship).toBe(47);
      expect(session.monsterInstances[given.instance.instanceId]?.exp).toBe(55);
    });

    it("성장 씨앗은 선택한 배우의 영구 능력 보너스를 올린다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.inventory.item_gen2_might_seed = 1;

      expect(useItemFromMenu(project, session, "item_gen2_might_seed", actorId).kind).toBe("used");
      expect(session.actorParamBonuses?.[actorId]?.attack).toBe(2);
      expect(session.inventory.item_gen2_might_seed ?? 0).toBe(0);
    });

    it("스위치 아이템은 서로 겹치지 않는 전용 스위치를 켜고 재사용을 거부한다", () => {
      const project = createBlankProject();
      const relaySwitches = Object.fromEntries(
        project.database.items
          .filter((item) => item.id.endsWith("_relay"))
          .map((item) => [item.id, item.switchId]),
      );
      expect(relaySwitches).toMatchObject({
        item_gen2_sun_relay: "sw_gen2_sun_relay",
        item_gen2_moon_relay: "sw_gen2_moon_relay",
        item_gen2_bridge_relay: "sw_gen2_bridge_relay",
        item_gen2_seal_relay: "sw_gen2_seal_relay",
      });
      // 계약은 "기동패는 4개다" 가 아니라 "기동패마다 전용 스위치를 하나씩 갖는다" 다.
      // 카탈로그가 기동패를 더 실을 수 있으므로 개수를 박지 않고 1:1 성질을 확인한다.
      const relayIds = Object.keys(relaySwitches);
      expect(relayIds.length).toBeGreaterThanOrEqual(4);
      expect(Object.values(relaySwitches).every((switchId) => typeof switchId === "string" && switchId.length > 0)).toBe(true);
      expect(new Set(Object.values(relaySwitches)).size).toBe(relayIds.length);

      const session = startSession(project);
      session.inventory.item_gen2_sun_relay = 2;

      expect(useItemFromMenu(project, session, "item_gen2_sun_relay").kind).toBe("used");
      expect(session.switches.sw_gen2_sun_relay).toBe(true);
      expect(session.inventory.item_gen2_sun_relay).toBe(1);
      expect(useItemFromMenu(project, session, "item_gen2_sun_relay").kind).toBe("unusable");
      expect(session.inventory.item_gen2_sun_relay).toBe(1);
    });

    it("유한 사용 횟수를 메뉴와 전투 모두 같은 충전 권위자로 계산한다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.inventory.item_gen2_twin_dose_kit = 1;
      session.actorVitals[actorId] = { hp: 1, mp: 0, maxHp: 500, maxMp: 100 };

      expect(useItemFromMenu(project, session, "item_gen2_twin_dose_kit", actorId).kind).toBe("used");
      expect(session.inventory.item_gen2_twin_dose_kit).toBe(1);
      expect(session.itemUseCharges?.item_gen2_twin_dose_kit).toBe(1);
      session.actorVitals[actorId]!.hp = 1;
      expect(useItemFromMenu(project, session, "item_gen2_twin_dose_kit", actorId).kind).toBe("used");
      expect(session.inventory.item_gen2_twin_dose_kit ?? 0).toBe(0);
      expect(session.itemUseCharges?.item_gen2_twin_dose_kit).toBeUndefined();

      const { runtime, actorIds } = battleFor(project, "item_gen2_five_spark_core");
      const enemyId = runtime.snapshot().enemies[0]?.id;
      if (!enemyId) throw new Error("기본 적이 없습니다.");
      runtime.performActorCommand({ kind: "item", itemId: "item_gen2_five_spark_core", targetEnemyId: enemyId });
      expect(runtime.snapshot().eventState.inventory.item_gen2_five_spark_core).toBe(1);
      expect(runtime.snapshot().eventState.itemUseCharges?.item_gen2_five_spark_core).toBe(1);
      expect(actorIds.length).toBe(2);
    });

    it("네 속성 아이템 스킬과 두 상태 공격 아이템이 실제 적에게 효과를 남긴다", () => {
      const project = createBlankProject();
      for (const itemId of [
        "item_gen2_frost_vial",
        "item_gen2_quake_stone",
        "item_gen2_gale_fan",
        "item_gen2_shadow_dust",
        "item_gen2_venom_ampoule",
        "item_gen2_paralysis_coil",
      ]) {
        const { runtime } = battleFor(project, itemId);
        const before = runtime.snapshot().enemies[0];
        if (!before) throw new Error("기본 적이 없습니다.");
        runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: before.id });
        const after = runtime.snapshot().enemies[0]!;
        expect(after.hp < before.hp || after.stateIds.length > before.stateIds.length, itemId).toBe(true);
        expect(runtime.snapshot().lastAnimation?.animationId, itemId).toBe(catalogItem(project, itemId).animationId);
      }
    });
  });
});

describe("mgL7sysMonsterTrade", () => {
  isolateTimers();
  function tradeProject(): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.system.monsterFusions = [
      { speciesA: "species_wild_slime", speciesB: "species_cave_bat", resultSpeciesId: "species_king_slime" },
    ];
    return project;
  }
  function give(project: Project, session: PlaySession, speciesId: string, level = 5): string {
    const result = giveMonster(project, session, { speciesId, level });
    if (!result.ok) throw new Error(`fixture ${speciesId}`);
    return result.instance.instanceId;
  }
  function run(commands: Command[], project: Project, session: PlaySession): void {
    const interpreter = createInterpreter(commands, session, project);
    let step = interpreter.start();
    while (step.kind !== "done") step = interpreter.resume();
  }
  describe("monster release / trade / fusion (#14)", () => {
    it("removeMonster releases the named instance but never the last party monster", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      const only = give(project, session, "species_wild_slime");
      expect(removeMonster(project, session, only)).toEqual({ ok: false, reason: "lastPartyMonster" });
      const second = give(project, session, "species_cave_bat");
      run([{ kind: "removeMonster", instanceId: second }], project, session);
      expect(session.flags.removeMonsterSuccess).toBe(true);
      expect(session.monsterInstances[second]).toBeUndefined();
      expect(session.monsterParty).toEqual([only]);
    });

    it("removeMonster with a blank id releases the first boxed monster", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      for (let i = 0; i < 6; i += 1) give(project, session, "species_wild_slime");
      const boxed = give(project, session, "species_cave_bat");
      expect(session.monsterBox).toEqual([boxed]);
      run([{ kind: "removeMonster", instanceId: "" }], project, session);
      expect(session.monsterBox).toEqual([]);
      expect(session.monsterInstances[boxed]).toBeUndefined();
    });

    it("tradeMonster swaps one owned monster of the offered species for the requested one in the same party slot", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      const first = give(project, session, "species_wild_slime");
      const offered = give(project, session, "species_cave_bat", 12);
      const third = give(project, session, "species_wild_slime");
      run([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], project, session);
      expect(session.flags.tradeMonsterSuccess).toBe(true);
      expect(session.monsterInstances[offered]).toBeUndefined();
      const received = session.monsterInstances[session.monsterParty[1]!]!;
      expect(session.monsterParty[0]).toBe(first);
      expect(session.monsterParty[2]).toBe(third);
      expect(received.speciesId).toBe("species_stone_golem");
      expect(received.level).toBe(12);
    });

    it("tradeMonster fails without an owned monster of the offered species and changes nothing", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      const kept = give(project, session, "species_wild_slime");
      const before = structuredClone(session.monsterInstances);
      run([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], project, session);
      expect(session.flags.tradeMonsterSuccess).toBe(false);
      expect(session.monsterInstances).toEqual(before);
      expect(session.monsterParty).toEqual([kept]);
      expect(tradeMonster(project, session, { fromSpeciesId: "species_wild_slime", toSpeciesId: "missing" })).toEqual({ ok: false, reason: "missingSpecies" });
    });

    it("fuseMonsters consumes both instances and creates the table result at their average level", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      const bat = give(project, session, "species_cave_bat", 10);
      const slime = give(project, session, "species_wild_slime", 20);
      // 표는 순서를 따지지 않는다(bat + slime 도 slime + bat 줄에 맞는다).
      expect(fusionResultSpeciesId(project, "species_cave_bat", "species_wild_slime")).toBe("species_king_slime");
      run([{ kind: "fuseMonsters", instanceIdA: bat, instanceIdB: slime }], project, session);
      expect(session.flags.fuseMonstersSuccess).toBe(true);
      expect(session.monsterInstances[bat]).toBeUndefined();
      expect(session.monsterInstances[slime]).toBeUndefined();
      expect(session.monsterParty).toHaveLength(1);
      const result = session.monsterInstances[session.monsterParty[0]!]!;
      expect(result.speciesId).toBe("species_king_slime");
      expect(result.level).toBe(15);
      // 합성 결과는 방금 지운 재료 id 를 다시 쓰지 않는다 — 재료 id 를 가리키던 명령이 새 개체를 건드리면 안 된다.
      expect([bat, slime]).not.toContain(result.instanceId);
    });

    it("fuseMonsters rejects pairs missing from the table and the same instance twice", () => {
      const project = tradeProject();
      const session = startSession(project, 1);
      const a = give(project, session, "species_wild_slime");
      const b = give(project, session, "species_wild_slime");
      expect(fuseMonsters(project, session, a, b)).toEqual({ ok: false, reason: "noRecipe" });
      expect(fuseMonsters(project, session, a, a)).toEqual({ ok: false, reason: "sameInstance" });
      expect(Object.keys(session.monsterInstances).sort()).toEqual([a, b].sort());
    });

    it("keeps the fusion table and the new commands through serialize/deserialize", () => {
      const project = tradeProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({
        id: "ev_trader", x: 1, y: 1, trigger: { kind: "action" },
        commands: [
          { kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem", level: 3 },
          { kind: "removeMonster", instanceId: "" },
          { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" },
        ],
      });
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.monsterFusions).toEqual(project.system.monsterFusions);
      expect(reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_trader")!.commands.map((command) => command.kind))
        .toEqual(["tradeMonster", "removeMonster", "fuseMonsters"]);
    });
  });
});

// poke-depth PR3: 특성(선언형 일곱 종류). 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("monsterAbilities", () => {
  isolateTimers();
  describe("normalizeMonsterAbility", () => {
    it("drops abilities missing their required parameter or kind", () => {
      expect(normalizeMonsterAbility(undefined)).toBeUndefined();
      expect(normalizeMonsterAbility({ name: "x", kind: "bogus" })).toBeUndefined();
      expect(normalizeMonsterAbility({ name: "x", kind: "immuneType" })).toBeUndefined();
      expect(normalizeMonsterAbility({ name: "x", kind: "immuneStatus", status: "confusion" })).toBeUndefined();
      expect(normalizeMonsterAbility({ kind: "endure" })).toBeUndefined();
    });
    it("clamps percentages per kind and fills defaults", () => {
      expect(normalizeMonsterAbility({ name: "a", kind: "resistType", type: "fire" })).toMatchObject({ percent: 50 });
      expect(normalizeMonsterAbility({ name: "a", kind: "resistType", type: "fire", percent: 500 })).toMatchObject({ percent: 99 });
      expect(normalizeMonsterAbility({ name: "a", kind: "boostLowHp", type: "fire", percent: 50 })).toMatchObject({ percent: 101 });
      expect(normalizeMonsterAbility({ name: "a", kind: "contactStatus", status: "burn", percent: 0 })).toMatchObject({ percent: 1 });
      expect(normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "mind", percent: 9999 })).toMatchObject({ percent: 400 });
      expect(normalizeMonsterAbility({ name: "a", kind: "immuneType", type: "water", healPercent: 25 })).toMatchObject({ healPercent: 25 });
      expect(normalizeMonsterAbility({ name: "a", kind: "endure" })).toEqual({ name: "a", kind: "endure" });
    });
    it("is omitted from species records that do not set it (unchanged bytes)", () => {
      expect("ability" in normalizeMonsterSpeciesRecord({ id: "s", name: "s" })).toBe(false);
      expect(normalizeMonsterSpeciesRecord({ id: "s", name: "s", ability: { name: "a", kind: "endure" } }).ability).toEqual({ name: "a", kind: "endure" });
    });
  });
  describe("ability effects", () => {
    it("type immunity matches only the declared type and reports the heal percent", () => {
      const ability = normalizeMonsterAbility({ name: "a", kind: "immuneType", type: "water", healPercent: 25 });
      expect(abilityTypeImmunity(ability, "water")).toEqual({ healPercent: 25 });
      expect(abilityTypeImmunity(ability, "fire")).toBeUndefined();
      expect(abilityTypeImmunity(undefined, "water")).toBeUndefined();
    });
    it("stat multiplier hits only its own side of the formula", () => {
      const atk = normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "attack", percent: 150 });
      expect(abilityOffensePercent(atk, false)).toBe(150);
      expect(abilityOffensePercent(atk, true)).toBe(100);
      expect(abilityDefensePercent(atk, false)).toBe(100);
      const mind = normalizeMonsterAbility({ name: "a", kind: "statMultiplier", stat: "mind", percent: 200 });
      expect(abilityOffensePercent(mind, true)).toBe(200);
      expect(abilityDefensePercent(mind, true)).toBe(200);
    });
    it("low-HP boost needs HP <= 1/3 and the same type; resist stacks multiplicatively", () => {
      const boost = normalizeMonsterAbility({ name: "a", kind: "boostLowHp", type: "fire", percent: 150 });
      const resist = normalizeMonsterAbility({ name: "b", kind: "resistType", type: "fire", percent: 50 });
      expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, {}, "fire")).toBe(150);
      expect(abilityDamagePercent({ ability: boost, hp: 40, maxHp: 100 }, {}, "fire")).toBe(100);
      expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, {}, "water")).toBe(100);
      expect(abilityDamagePercent({ ability: boost, hp: 30, maxHp: 100 }, { ability: resist }, "fire")).toBe(75);
      expect(scaleDamageByPercent(1, 50)).toBe(1);
      expect(scaleDamageByPercent(0, 150)).toBe(0);
    });
    it("status immunity and contact status", () => {
      expect(abilityBlocksStatus(normalizeMonsterAbility({ name: "a", kind: "immuneStatus", status: "sleep" }), "sleep")).toBe(true);
      expect(abilityBlocksStatus(normalizeMonsterAbility({ name: "a", kind: "immuneStatus", status: "sleep" }), "burn")).toBe(false);
      expect(abilityContactStatus(normalizeMonsterAbility({ name: "a", kind: "contactStatus", status: "paralysis", percent: 30 }))).toEqual({ status: "paralysis", percent: 30 });
    });
    it("endure only saves a full-HP holder from a lethal hit", () => {
      const endure = normalizeMonsterAbility({ name: "a", kind: "endure" });
      expect(abilityEndureDamage(endure, 50, 50, 80)).toEqual({ damage: 49, endured: true });
      expect(abilityEndureDamage(endure, 40, 50, 80)).toEqual({ damage: 80, endured: false });
      expect(abilityEndureDamage(endure, 50, 50, 10)).toEqual({ damage: 10, endured: false });
    });
  });
});

describe("monsterInitialExperience", () => {
  isolateTimers();
  describe("new monster cumulative experience", () => {
    it("needs only the next-level gap after a high-level capture/gift", () => {
      const project = createBlankProject();
      const species = project.database.monsterSpecies![0]!;
      species.expCurve = { base: 3, extra: 1, acceleration: 1 };
      species.evolutions = [];
      const session = startSession(project);
      const gift = giveMonster(project, session, { speciesId: species.id, level: 24 });
      if (!gift.ok) throw new Error("Fixture species missing");
      const floor = totalExpForLevel(species.expCurve, 24);
      const gap = totalExpForLevel(species.expCurve, 25) - floor;
      expect(gift.instance.exp).toBe(floor);
      applyMonsterExperienceAndEvolution(project, session, gap - 1, [gift.instance.instanceId]);
      expect(session.monsterInstances[gift.instance.instanceId]!.level).toBe(24);
      applyMonsterExperienceAndEvolution(project, session, 1, [gift.instance.instanceId]);
      expect(session.monsterInstances[gift.instance.instanceId]!.level).toBe(25);
    });

    it("preserves explicit experience and uses the fallback curve with the clamped level", () => {
      const project = createBlankProject();
      const species = project.database.monsterSpecies![0]!;
      species.expCurve = undefined;
      const session = startSession(project);
      for (const [level, exp, expected] of [[24, 0, 0], [24, 42, 42], [0, undefined, totalExpForLevel(DEFAULT_MONSTER_EXP_CURVE, 1)], [150, undefined, totalExpForLevel(DEFAULT_MONSTER_EXP_CURVE, 99)]] as const) {
        const gift = giveMonster(project, session, { speciesId: species.id, level, exp });
        if (!gift.ok) throw new Error("Fixture species missing");
        expect(gift.instance.exp).toBe(expected);
      }
    });
  });
});

describe("monsterPartyFollowers", () => {
  isolateTimers();
  function monsterProject(): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    return project;
  }
  describe("monster party overworld train followers (G001)", () => {
    it("giveMonster adds monster followers matching party size and order", () => {
      const project = monsterProject();
      const session = startSession(project, 1);

      const first = giveMonster(project, session, {
        speciesId: "species_wild_slime",
        level: 3,
        nickname: "방울",
      });
      const second = giveMonster(project, session, {
        speciesId: "species_leafling",
        level: 2,
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);

      const monsters = session.followers.filter((entry) => entry.kind === "monster");
      expect(monsters).toHaveLength(2);
      expect(monsters.map((entry) => entry.monsterInstanceId)).toEqual(session.monsterParty);
      expect(monsters[0]?.name).toBe("방울");
      expect(monsters[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_monster1");
      expect(session.followerTrail.length).toBeGreaterThan(0);
    });

    it("actor followers come before monster train in trail order", () => {
      const project = monsterProject();
      const session = startSession(project, 2);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 4, nickname: "슬라" });
      giveMonster(project, session, { speciesId: "species_sparkit", level: 4 });

      expect(session.followers.map((entry) => entry.kind ?? "actor")).toEqual(["actor", "monster", "monster"]);
      expect(session.followers[0]?.name).toBe("가리");
      expect(session.followers.slice(1).map((entry) => entry.monsterInstanceId)).toEqual(session.monsterParty);
    });

    it("moveMonster party->box reduces monster followers when project is provided", () => {
      const project = monsterProject();
      const session = startSession(project, 3);
      const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 5 });
      expect(gift.ok).toBe(true);
      if (!gift.ok) return;

      const moved = moveMonster(session, gift.instance.instanceId, "box", project);
      expect(moved.ok).toBe(true);
      expect(session.monsterParty).toHaveLength(0);
      expect(session.followers.filter((entry) => entry.kind === "monster")).toHaveLength(0);
    });

    it("reordering monsterParty changes monster follower order on sync", () => {
      const project = monsterProject();
      const session = startSession(project, 4);
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "A" });
      giveMonster(project, session, { speciesId: "species_leafling", level: 3, nickname: "B" });
      expect(session.monsterParty).toHaveLength(2);

      const [first, second] = session.monsterParty;
      session.monsterParty = [second!, first!];
      syncMonsterPartyFollowers(project, session);

      expect(session.followers.filter((entry) => entry.kind === "monster").map((entry) => entry.name)).toEqual([
        "B",
        "A",
      ]);
    });

    it("save/load resync restores monster train from monsterParty", () => {
      const project = monsterProject();
      const session = startSession(project, 5);
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "방울" });
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      const monsters = restored.followers.filter((entry) => entry.kind === "monster");
      expect(monsters).toHaveLength(1);
      expect(monsters[0]?.monsterInstanceId).toBe(restored.monsterParty[0]);
      expect(monsters[0]?.name).toBe("방울");
      expect(restored.followers.some((entry) => entry.kind !== "monster" && entry.name === "가리")).toBe(true);
    });

    it("removeFollower all keeps monster train entries", () => {
      const project = monsterProject();
      const session = startSession(project, 6);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 2, nickname: "슬라" });

      const removed = removeFollowerFromSession(session, { all: true });
      expect(removed).toBe(1);
      expect(session.followers).toHaveLength(1);
      expect(session.followers[0]?.kind).toBe("monster");
      expect(session.followers[0]?.name).toBe("슬라");
    });

    it("uses species fieldCharsetId when authored", () => {
      const project = monsterProject();
      const species = project.database.monsterSpecies?.find((record) => record.id === "species_wild_slime");
      if (!species) throw new Error("missing slime");
      species.graphic = {
        ...species.graphic,
        fieldCharsetId: "tex_easyrpg_charset_monster2",
      };
      const session = startSession(project, 7);
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 1 });
      expect(session.followers[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_monster2");
    });

    it("actor addFollower still tags kind actor", () => {
      const project = monsterProject();
      const session = startSession(project, 8);
      const follower = addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      expect(follower?.kind).toBe("actor");
      expect(session.followers).toHaveLength(1);
      expect(session.followers[0]?.kind).toBe("actor");
    });
  });
});
