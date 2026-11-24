import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";
import { orderGen1TurnActions, type Gen1TurnOrderEntry } from "@/battle/battleStrictOrder";
import { gen1TypeModifiersForTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { deserialize, serialize } from "@/project/io";
import type { Project, ItemRecord, SkillRecord, StateRecord, ActorRecord, EnemyRecord, SkillEffect } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { createBattleRuntime } from "@/battle/runtime";
import { targetScopeForCommand } from "@/battle/battleTargetResolver";
import { normalizeCropRecord } from "@/project/farmModel";
import { startSession } from "@/project/session";
import { placeableKey } from "@/project/placeables";
import { giveMonster } from "@/project/monsterCollection";
import { setEquippedTool } from "@/project/toolActions";
import { interactWithFarmPlot } from "@/player/farming";
import { useItemFromMenu } from "@/player/playerItemUse";
import { usesMagicalDefense } from "@/battle/battleDamage";
import { addEmotionState, emotionDamageMultiplier } from "@/battle/battleEmotion";
import { enemyBattlers } from "@/battle/battleBattlers";
import { pokemonMoveColor, pokemonMoveMotion, pokemonStrikeFromBelow, spriteEmitPoint } from "@/battle/pokemonMoveMotion";
import { isolateTimers } from "./mergedTeardown";

describe("databaseBattleCommandCatalogIds", () => {
  isolateTimers();
  describe("battle command catalog ID allocation", () => {
    let restoreDom: () => void;
    let host: HTMLElement;
    let store: typeof import("@/project/store")["store"];
    let studio: typeof import("@/editor/panels/databaseBattleCommandStudio");
    let actorId: string;
    let classId: string;
    let skillId: string;

    function control(id: string): HTMLElement {
      const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    }

    function input(id: string, value: string, event: "input" | "change"): void {
      const node = control(id);
      if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) throw new Error(`Not a field: ${id}`);
      node.value = value;
      node.dispatchEvent(new Event(event));
    }

    beforeEach(async () => {
      restoreDom = installFakeDom();
      vi.stubGlobal("window", {
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
      });
      ({ store } = await import("@/project/store"));
      studio = await import("@/editor/panels/databaseBattleCommandStudio");
      const { renderBattleCommandsTab } = await import("@/editor/panels/databaseUtilityRecordViews");
      const { resetMapEditHistory } = await import("@/editor/mapEditHistory");
      const project = createBlankProject();
      const actor = project.database.actors[0];
      const klass = project.database.classes.find((row) => row.id === actor?.classId);
      const skill = project.database.skills[0];
      if (!actor || !klass || !skill) throw new Error("Missing starter actor/class/skill");
      actorId = actor.id;
      classId = klass.id;
      skillId = skill.id;
      project.system.monsterCollection = false;
      project.database.classes = [
        { ...klass, id: "unrelated_class", battleCommands: [] },
        { ...klass, battleCommands: [] },
      ];
      // Reserve the next candidate in the catalog as well as the placed cmd_002.
      project.database.battleCommands = [{ id: "cmd_003", name: "Source", kind: "skill" }];
      store.replace(project);
      resetMapEditHistory();
      host = document.createElement("div");
      renderBattleCommandsTab(host);
      input("db-command-class-select", classId, "change");
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      restoreDom();
    });

    it.each(["add", "duplicate"] as const)("%s does not relink a deleted catalog ID still placed in another class", (action) => {
      control("db-battle-command-add").dispatchEvent(new Event("click"));
      const original = store.getCurrent().database.battleCommands?.[1];
      if (!original) throw new Error("Missing added command");
      expect(original.id).toBe("cmd_002");
      input("db-field-battle-command-kind-1", "skill", "change");
      control(`db-command-place-${original.id}`).dispatchEvent(new Event("click"));
      const authoredBefore = structuredClone(store.getCurrent().database.classes);
      const runtimeBefore = battleCommandsForActor(store.getCurrent(), actorId);
      expect(runtimeBefore).toEqual([expect.objectContaining({ id: original.id, kind: "skill" })]);
      expect(runtimeBefore[0]?.skillId).toBeUndefined();
      expect(runtimeBefore[0]?.skillSubsetName).toBeUndefined();

      const remove = control("db-battle-command-delete-1");
      remove.dispatchEvent(new Event("click"));
      remove.dispatchEvent(new Event("click"));
      expect(store.getCurrent().database.battleCommands?.map((row) => row.id)).toEqual(["cmd_003"]);
      expect(store.getCurrent().database.classes).toEqual(authoredBefore);
      expect(battleCommandsForActor(store.getCurrent(), actorId)).toEqual(runtimeBefore);

      // Allocation must inspect every class, not only the currently displayed one.
      input("db-command-class-select", "unrelated_class", "change");
      control(action === "add" ? "db-battle-command-add" : "db-battle-command-duplicate-0").dispatchEvent(new Event("click"));
      input("db-picker-battle-command-skill-1", skillId, "change");
      input("db-field-battle-command-subset-1", "Replacement subset", "input");
      const replacement = store.getCurrent().database.battleCommands?.[1];
      expect(replacement).toEqual(expect.objectContaining({ skillId, skillSubsetName: "Replacement subset" }));
      expect(store.getCurrent().database.classes).toEqual(authoredBefore);
      // Assert the actual consequence before ID uniqueness, so RED exposes both fallback fields.
      expect(battleCommandsForActor(store.getCurrent(), actorId)).toEqual(runtimeBefore);
      expect(studio.resolvedStudioCommands(store.getCurrent(), classId, false)).toEqual(runtimeBefore);
      expect(replacement?.id).toBe("cmd_004");

      input("db-command-class-select", classId, "change");
      const place = control(`db-command-place-${replacement?.id}`);
      expect(place.getAttribute("disabled")).toBeNull();
      place.dispatchEvent(new Event("click"));
      const commands = store.getCurrent().database.classes.find((row) => row.id === classId)?.battleCommands;
      expect(commands?.map((row) => row.id)).toEqual([original.id, replacement?.id, "cmd_change"]);
      expect(battleCommandsForActor(store.getCurrent(), actorId).find((row) => row.id === original.id)).toEqual(runtimeBefore[0]);
    }, 60_000);
  });
});

describe("gen1StrictOrder", () => {
  isolateTimers();
  function entry(
    id: string,
    commandClass: Gen1TurnOrderEntry["commandClass"],
    speed: number,
    priority = 0
  ): Gen1TurnOrderEntry & { readonly id: string } {
    return { id, commandClass, speed, priority };
  }
  describe("Gen1 strict command ordering", () => {
    it("orders switch, field command, then combat commands", () => {
      const rng = vi.fn(() => 0.5);
      const ordered = orderGen1TurnActions([
        entry("fast-attack", "combat", 100),
        entry("run", "field", 1),
        entry("switch", "switch", 1),
      ], rng);

      expect(ordered.map((action) => action.id)).toEqual(["switch", "run", "fast-attack"]);
      expect(rng).not.toHaveBeenCalled();
    });

    it("uses move priority before speed inside the combat band", () => {
      const rng = vi.fn(() => 0.5);
      const ordered = orderGen1TurnActions([
        entry("fast", "combat", 100, 0),
        entry("quick", "combat", 1, 1),
      ], rng);

      expect(ordered.map((action) => action.id)).toEqual(["quick", "fast"]);
      expect(rng).not.toHaveBeenCalled();
    });

    it("does not consume RNG unless command class, priority, and speed all tie", () => {
      const unequalRng = vi.fn(() => 0.9);
      orderGen1TurnActions([
        entry("slow", "combat", 9),
        entry("fast", "combat", 10),
      ], unequalRng);
      expect(unequalRng).not.toHaveBeenCalled();

      const tieRng = vi.fn(() => 0.9);
      const tied = orderGen1TurnActions([
        entry("actor", "combat", 10),
        entry("enemy", "combat", 10),
      ], tieRng);
      expect(tieRng).toHaveBeenCalledTimes(1);
      expect(tied.map((action) => action.id)).toEqual(["actor", "enemy"]);
    });
  });
});

describe("gen1TypeChart", () => {
  isolateTimers();
  function projectWithChart(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    project.system.typeChart = {
      types: ["fire", "grass", "water"],
      multipliers: {
        fire: { fire: 1, grass: 2, water: 0.5 },
        grass: { fire: 0.5, grass: 1, water: 2 },
        water: { fire: 2, grass: 0.5, water: 1 },
      },
    };
    return project;
  }
  describe("Gen1 type modifier extraction", () => {
    it("break: exposes STAB separately and preserves dual-type factors for sequential floors", () => {
      const result = gen1TypeModifiersForTypes(
        projectWithChart(),
        "fire",
        ["fire"],
        ["grass", "water"],
      );
      expect(result).toEqual({ stab: true, typeFactors: [20, 5] });
    });

    it("break: effectiveness order follows the authored chart, not a species' type-slot order", () => {
      expect(gen1TypeModifiersForTypes(projectWithChart(), "fire", ["fire"], ["water", "grass"]))
        .toEqual({ stab: true, typeFactors: [20, 5] });
    });

    it("break: a duplicate monotype slot must not apply effectiveness twice", () => {
      const project = projectWithChart();
      expect(gen1TypeModifiersForTypes(project, "fire", [], ["grass", "grass"]))
        .toEqual({ stab: false, typeFactors: [20] });
    });

    it("keeps the existing combined multiplier API byte-for-byte compatible", () => {
      const project = projectWithChart();
      expect(typeChartMultiplierForTypes(project, "fire", ["fire"], ["grass", "water"]))
        .toBe(1.5);
    });
  });
});

describe("itemRuntimeUsability", () => {
  isolateTimers();
  const POISON = "state_poison";
  const SLEEP = "state_sleep";
  describe("default item runtime usability", () => {
    it("uses every field or always item through the real menu authority", () => {
      const project = createBlankProject();

      for (const item of project.database.items.filter(isMenuUsable)) {
        const session = startSession(project);
        const actorId = eligibleActorId(project, item, session);
        if (!actorId) throw new Error("default party actor is missing");
        session.inventory[item.id] = 1;
        session.actorVitals[actorId] = { hp: 1, mp: 0, maxHp: 500, maxMp: 200 };
        session.actorStateIds ??= {};
        session.actorStateIds[actorId] = afflictedStateIds(item);
        session.actorSkillIds ??= {};
        session.actorSkillIds[actorId] = project.database.skills
          .map((skill) => skill.id)
          .filter((skillId) => skillId !== learnedSkillId(item));

        if (item.onlyEffectiveOnDeadActors) session.actorVitals[actorId]!.hp = 0;
        const before = session.inventory[item.id] ?? 0;
        let targetMonsterInstanceId: string | undefined;
        if (item.careProfile) {
          project.system.monsterCollection = true;
          const speciesId = project.database.monsterSpecies?.[0]?.id;
          if (!speciesId) throw new Error("default monster species is missing");
          const given = giveMonster(project, session, { speciesId, level: 1 });
          if (!given.ok) throw new Error("default monster could not be added");
          targetMonsterInstanceId = given.instance.instanceId;
        }
        const result = useItemFromMenu(project, session, item.id, actorId, targetMonsterInstanceId);

        expect(result.kind, item.id).toBe("used");
        const expected = afterOneUse(item, before);
        expect(session.inventory[item.id] ?? 0, item.id).toBe(expected.copies);
        if (item.consumptionLimit !== "noLimit") {
          expect(session.itemUseCharges?.[item.id], item.id).toBe(expected.charge);
        }
      }
    });

    it("기본 농기구 세 개로 경작, 물주기, 채굴 경로를 실행한다", () => {
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
      if (!sourceMap) throw new Error("기본 맵이 없습니다");
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
      if (!plot) throw new Error("경작된 밭이 없습니다");
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

        // scope "none" 인 투척물은 발동 기술의 대상 범위를 따른다(battleTargetResolver) — 실제 전투 UI 와 같은 판정으로 대상을 고른다.
        const scope = targetScopeForCommand(project, { kind: "item", itemId: item.id });
        runtime.performActorCommand({
          kind: "item",
          itemId: item.id,
          targetEnemyId: scope === "enemy" ? enemyId : "",
          ...(scope === "ally" || scope === "allAllies" ? { targetActorId } : {}),
        });
        const after = runtime.snapshot();

        const expected = afterOneUse(item, 2);
        expect(after.eventState.inventory[item.id] ?? 0, item.id).toBe(expected.copies);
        if (item.consumptionLimit !== "noLimit") {
          expect(after.eventState.itemUseCharges?.[item.id], item.id).toBe(expected.charge);
        }
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
  /**
   * 한 번 쓴 뒤의 사본 수·충전 — consumptionLimit N 은 사본 하나를 N 번 쓰고 없앤다(itemTransitions normalizeItemState).
   * 공용 투척물(item_shared_battle_*)은 N=1 이라 한 번에 사본 하나가 줄고 충전은 남지 않는다.
   */
  function afterOneUse(item: ItemRecord, before: number): { copies: number; charge: number | undefined } {
    if (item.consumptionLimit === "noLimit") return { copies: before - 1, charge: undefined };
    return item.consumptionLimit === 1 ? { copies: before - 1, charge: undefined } : { copies: before, charge: 1 };
  }
  /** 직업·인물 제한이 있는 비전서(item_shared_manual_*)는 그 직업 인물이 써야 한다 — 그 인물을 파티 맨 앞에 세운다. */
  function eligibleActorId(project: Project, item: ItemRecord, session: ReturnType<typeof startSession>): string | undefined {
    const fallback = session.partyActorIds[0];
    if (item.usableActorIds.length === 0 && item.usableClassIds.length === 0) return fallback;
    const eligible = project.database.actors.find((actor) => item.usableActorIds.includes(actor.id) || item.usableClassIds.includes(actor.classId));
    if (!eligible) return fallback;
    if (!session.partyActorIds.includes(eligible.id)) session.partyActorIds = [eligible.id, ...session.partyActorIds];
    return eligible.id;
  }
  const BASE_AFFLICTIONS = [
    POISON,
    SLEEP,
    "state_paralysis",
    "state_deep_poison",
    "state_silence",
    "state_attack_down",
    "state_defense_down",
    "state_agility_down",
  ] as const;
  /**
   * 대상에게 미리 걸어 두는 상태 — 기본 묶음에 그 아이템이 푸는 상태를 더한다. 공용 아이템 카탈로그(item_shared_remedy_*)가
   * 암흑·석화 같은 상태를 stateEffects remove 로 풀게 되면서, 기본 묶음에 없는 상태만 푸는 치료제는 「효과 없음」으로 거절됐다.
   */
  function afflictedStateIds(item: ItemRecord): string[] {
    const removes = item.stateEffects.filter((effect) => effect.operation === "remove").map((effect) => effect.stateId);
    return [...new Set([...BASE_AFFLICTIONS, ...item.healStateIds, ...removes])];
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
        stateIds: {
          [targetActorId]: afflictedStateIds(item),
        },
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
});

// magical 속성의 mind(마법 방어력) 라우팅은 battleModel="gen1" 에서만 활성이어야 한다.
//
// 회귀: 게이트 없이 적용되어 있었다. normalizeElementKind 의 폴백이 "magical" 이고
// 기본 속성 17개 중 13개(fire/ice/thunder/water/earth/wind/holy/dark/...)가 magical 이라,
// 저장된 모든 RM2k3 프로젝트의 마법 스킬 데미지가 마이그레이션 없이 바뀌는 상태였다.
// `.omo/plans/pokemon-clone-feature.md` task 1 "Must NOT change RM2k3 behavior",
// task 2 "defense mis-wire — fix in gen1 path" 와도 어긋난다.
describe("magicalDefenseGate", () => {
  isolateTimers();
  function projectWithModel(model?: "rm2k3" | "gen1"): Project {
    const project = createBlankProject();
    if (model) project.system.battleModel = model;
    else delete project.system.battleModel;
    return project;
  }
  describe("magical 방어 라우팅 게이트", () => {
    it("rm2k3(기본/생략)에서는 magical 속성도 defense 를 쓴다", () => {
      expect(usesMagicalDefense(projectWithModel(), "fire")).toBe(false);
      expect(usesMagicalDefense(projectWithModel("rm2k3"), "fire")).toBe(false);
    });

    it("gen1 에서만 magical 속성이 mind 로 라우팅된다", () => {
      expect(usesMagicalDefense(projectWithModel("gen1"), "fire")).toBe(true);
    });

    it("gen1 이어도 physical 속성과 무속성은 defense 를 쓴다", () => {
      const project = projectWithModel("gen1");
      expect(usesMagicalDefense(project, "sword")).toBe(false);
      expect(usesMagicalDefense(project, undefined)).toBe(false);
      expect(usesMagicalDefense(project, "does_not_exist")).toBe(false);
    });

    it("predict 와 runtime 이 동일 판정을 공유한다(데미지 parity)", async () => {
      const { isMagicalElement } = await import("@/battle/battlePredict");
      for (const model of [undefined, "rm2k3", "gen1"] as const) {
        const project = projectWithModel(model);
        for (const elementId of ["fire", "sword", undefined]) {
          expect(isMagicalElement(project, elementId)).toBe(usesMagicalDefense(project, elementId));
        }
      }
    });
  });
});

// 감정 계열·단계(#23)와 약점 추가 행동 — 실제 전투 런타임을 통과해 확인한다.
describe("mgL3BattleEmotion", () => {
  isolateTimers();
  function project(): Project {
    const p = deserialize(JSON.stringify(battleFixture));
    const emotion = (id: string, name: string, family: string, tier: number): StateRecord => ({ id, name, emotion: { family, tier } });
    p.database.states.push(
      emotion("state_happy", "기쁨", "joy", 1),
      emotion("state_ecstatic", "환희", "joy", 2),
      emotion("state_manic", "광희", "joy", 3),
      emotion("state_angry", "분노", "anger", 1),
    );
    return p;
  }
  function skill(p: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
    return {
      ...p.database.skills[0]!,
      name: patch.id,
      scope: "enemy",
      power: 20,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      criticalRate: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      stateEffects: [],
      ...patch,
    };
  }
  function learn(p: Project, ...skillIds: string[]): void {
    p.database.actors[0]!.learnedSkills = skillIds.map((skillId) => ({ level: 1, skillId }));
  }
  function battle(p: Project, battleFlow: "gauge" | "strict" = "gauge") {
    return createBattleRuntime({ project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow, rng: () => 0.5 });
  }
  function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
    for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand" && !runtime.snapshot().result; guard += 1) runtime.tick(100);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  }
  describe("emotion states stack into tiers within a family", () => {
    it("re-applying the same family climbs one tier and caps at the highest", () => {
      const p = project();
      const slime = enemyBattlers(p, p.database.troops[0]!)[0]!;
      expect(addEmotionState(p, slime, "state_happy").added).toEqual(["state_happy"]);
      expect(addEmotionState(p, slime, "state_happy").added).toEqual(["state_ecstatic"]);
      expect(slime.stateIds).toEqual(["state_ecstatic"]);
      addEmotionState(p, slime, "state_happy");
      expect(slime.stateIds).toEqual(["state_manic"]);
      // 최고 단계에서 멈춘다 — 바뀐 것이 없으면 added 도 비어 있다.
      expect(addEmotionState(p, slime, "state_happy")).toEqual({ added: [], removed: [] });
      expect(slime.stateIds).toEqual(["state_manic"]);
    });

    it("a different family replaces the current emotion and keeps non-emotion states", () => {
      const p = project();
      const slime = enemyBattlers(p, p.database.troops[0]!)[0]!;
      slime.stateIds = ["state_burn"];
      addEmotionState(p, slime, "state_ecstatic");
      const result = addEmotionState(p, slime, "state_angry");
      expect(result).toEqual({ added: ["state_angry"], removed: ["state_ecstatic"] });
      expect(slime.stateIds).toEqual(["state_burn", "state_angry"]);
    });

    it("skill state effects go through tier stacking in battle and record the new tier on the timeline", () => {
      const p = project();
      p.database.skills.push(skill(p, { id: "skill_tease", power: 0, stateEffects: [{ stateId: "state_happy", chance: 100, operation: "add" }] }));
      learn(p, "skill_tease");
      const runtime = battle(p);
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_tease", targetEnemyId: "enemy-1" });
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_tease", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().enemies[0]!.stateIds).toEqual(["state_ecstatic"]);
      const added = runtime.snapshot().timeline.filter((entry) => entry.kind === "stateAdded").map((entry) => entry.stateId);
      expect(added).toEqual(["state_happy", "state_ecstatic"]);
    });
  });
  describe("emotion cycle multiplier", () => {
    it("scales damage by the attacker→target family rule and leaves unmatched pairs at 1", () => {
      const p = project();
      p.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }];
      const hero = { stateIds: ["state_happy"] };
      expect(emotionDamageMultiplier(p, hero, { stateIds: ["state_angry"] })).toBe(2);
      expect(emotionDamageMultiplier(p, hero, { stateIds: ["state_happy"] })).toBe(1);
      expect(emotionDamageMultiplier(p, { stateIds: [] }, { stateIds: ["state_angry"] })).toBe(1);

    });

    it("multiplies real battle damage in the same slot as an element weakness", () => {
      const run = (cycle: Project["system"]["emotionCycle"], weakElement = false): number => {
        const p = project();
        p.system.emotionCycle = cycle;
        p.database.elements = [
          { id: "fire", name: "불", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
        ];
        if (weakElement) p.database.enemies[0]!.elementRates = { fire: "A" };
        p.database.skills.push(
          skill(p, { id: "skill_anger", power: 0, stateEffects: [{ stateId: "state_angry", chance: 100, operation: "add" }] }),
          skill(p, { id: "skill_hit", power: 40, elementId: "fire" }),
        );
        learn(p, "skill_anger", "skill_hit");
        const runtime = createBattleRuntime({
          project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
          party: { levels: {}, experience: {}, stateIds: { actor_hero: ["state_happy"] } },
        });
        actorTurn(runtime);
        runtime.performActorCommand({ kind: "skill", skillId: "skill_anger", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().enemies[0]!.stateIds).toEqual(["state_angry"]);
        actorTurn(runtime);
        const before = runtime.snapshot().enemies[0]!.hp;
        runtime.performActorCommand({ kind: "skill", skillId: "skill_hit", targetEnemyId: "enemy-1" });
        return before - runtime.snapshot().enemies[0]!.hp;
      };
      const neutral = run(undefined);
      const boosted = run([{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }]);
      const reversed = run([{ attackerFamily: "anger", targetFamily: "joy", multiplier: 2 }]);
      expect(neutral).toBeGreaterThan(0);
      expect(boosted).toBeGreaterThan(neutral);
      expect(boosted).toBe(run(undefined, true));
      // 방향이 반대인 규칙은 이 공격(기쁨→분노)에 적용되지 않는다.
      expect(reversed).toBe(neutral);
    });

    it("survives save/load for both the state emotion and the cycle table", () => {
      const p = project();
      p.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 1.5 }];
      const reloaded = deserialize(serialize(p));
      expect(reloaded.system.emotionCycle).toEqual([{ attackerFamily: "joy", targetFamily: "anger", multiplier: 1.5 }]);
      expect(reloaded.database.states.find((state) => state.id === "state_ecstatic")?.emotion).toEqual({ family: "joy", tier: 2 });
    });
  });
  describe("weakness hit grants an extra action", () => {
    function weaknessProject(enabled: boolean): Project {
      const p = project();
      p.database.elements = [
        { id: "fire", name: "불", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      ];
      p.database.enemies[0]!.elementRates = { fire: "A" };
      p.database.enemies[0]!.stats.maxHp = 5000;
      p.database.skills.push(skill(p, { id: "skill_blaze", elementId: "fire", power: 10 }), skill(p, { id: "skill_plain", power: 10 }));
      learn(p, "skill_blaze", "skill_plain");
      if (enabled) p.system.weaknessExtraAction = true;
      return p;
    }

    it("gauge flow: hitting a weakness reopens the same actor's command immediately", () => {
      const runtime = battle(weaknessProject(true));
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().phase).toBe("actorCommand");
      expect(runtime.snapshot().activeActorId).toBe("actor_hero");
      // 쓰러진 적은 제 차례 전까지 다시 약점을 맞아도 행동을 더 주지 않는다.
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().phase).not.toBe("actorCommand");
    });

    it("no extra action without the option or for a non-weakness hit", () => {
      const off = battle(weaknessProject(false));
      actorTurn(off);
      off.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
      expect(off.snapshot().phase).not.toBe("actorCommand");

      const plain = battle(weaknessProject(true));
      actorTurn(plain);
      plain.performActorCommand({ kind: "skill", skillId: "skill_plain", targetEnemyId: "enemy-1" });
      expect(plain.snapshot().phase).not.toBe("actorCommand");
    });

    it("strict flow: the actor acts twice in the same round", () => {
      const runtime = battle(weaknessProject(true), "strict");
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
      const round = runtime.snapshot().roundLogs[0]!;
      const heroActions = round.actions.filter((action) => action.side === "actor");
      expect(heroActions).toHaveLength(2);
      expect(heroActions.every((action) => action.skillName === "skill_blaze")).toBe(true);
    });

    it("weaknessExtraAction survives save/load", () => {
      expect(deserialize(serialize(weaknessProject(true))).system.weaknessExtraAction).toBe(true);
      expect(deserialize(serialize(weaknessProject(false))).system.weaknessExtraAction).toBeUndefined();
    });
  });
});

describe("mgL4SpecialCommands", () => {
  isolateTimers();
  type Setup = { project: Project; actor: ActorRecord; enemy: EnemyRecord; troopId: string };
  function setup(): Setup {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const enemy = project.database.enemies[0]!;
    const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 100, y: 100 }];
    troop.battleEventPages = [];
    enemy.stats = { ...enemy.stats, maxHp: 9_999, maxMp: 50, attack: 1, defense: 10, mind: 10, agility: 1 };
    actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 500);
    actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
    actor.initialEquipment = {};
    for (const klass of project.database.classes) klass.learnedSkills = [];
    actor.learnedSkills = [];
    return { project, actor, enemy, troopId: troop.id };
  }
  function addSkill(project: Project, id: string, effect: SkillEffect, extra: Partial<SkillRecord> = {}): SkillRecord {
    const skill: SkillRecord = {
      ...project.database.skills[0]!,
      id, name: id, scope: "enemy", power: 0, mpCost: { flat: 0, percentMax: 0 },
      successRate: 100, hitRate: 100, variance: 0, effect, stateEffects: [], ...extra,
    };
    delete (skill as Partial<SkillRecord>).hitSequence;
    project.database.skills.push(skill);
    return skill;
  }
  function runtime(s: Setup, skillIds: string[], rng: () => number = () => 0.5, inventory: Record<string, number> = {}) {
    return createBattleRuntime({
      project: s.project, troopId: s.troopId, canEscape: false, canLose: true, battleFlow: "strict", rng,
      sessionState: { switches: {}, variables: {}, inventory: { ...inventory } },
      party: {
        levels: { [s.actor.id]: 1 }, experience: { [s.actor.id]: 0 },
        vitals: { [s.actor.id]: { hp: 500, mp: 100 } }, stateIds: { [s.actor.id]: [] },
        skillIds: { [s.actor.id]: skillIds }, partyActorIds: [s.actor.id],
      },
    });
  }
  const specialMessages = (rt: ReturnType<typeof runtime>) =>
    rt.snapshot().timeline.filter((entry) => entry.kind === "special").map((entry) => entry.message ?? "");
  describe("mg L4 battle special command effects (#10)", () => {
    it("steal takes one item from the enemy steal table, once per enemy", () => {
      const s = setup();
      const item = s.project.database.items[0]!;
      s.enemy.stealItems = [{ itemId: item.id, rate: 100 }];
      addSkill(s.project, "skill_steal", { kind: "steal" });
      const rt = runtime(s, ["skill_steal"]);
      const target = rt.snapshot().enemies[0]!.id;
      rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: target });
      expect(rt.snapshot().eventState.inventory[item.id]).toBe(1);
      expect(specialMessages(rt)[0]).toContain("훔쳤다");
      rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: target });
      expect(rt.snapshot().eventState.inventory[item.id]).toBe(1);
      expect(specialMessages(rt).at(-1)).toBe("이미 훔쳤다.");
    });

    it("steal fails when the rate roll misses", () => {
      const s = setup();
      const item = s.project.database.items[0]!;
      s.enemy.stealItems = [{ itemId: item.id, rate: 10 }];
      addSkill(s.project, "skill_steal", { kind: "steal" });
      const rt = runtime(s, ["skill_steal"], () => 0.5);
      rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: rt.snapshot().enemies[0]!.id });
      expect(rt.snapshot().eventState.inventory[item.id] ?? 0).toBe(0);
      expect(specialMessages(rt)[0]).toBe("훔치지 못했다.");
    });

    it("scan reports HP/MP and weakness and marks the enemy scanned", () => {
      const s = setup();
      const element = s.project.database.elements?.[0];
      if (!element) throw new Error("기본 속성이 없습니다.");
      s.enemy.elementRates = { ...s.enemy.elementRates, [element.id]: "A" };
      addSkill(s.project, "skill_scan", { kind: "scan" });
      const rt = runtime(s, ["skill_scan"]);
      expect(rt.snapshot().enemies[0]!.scanned).toBeUndefined();
      rt.performActorCommand({ kind: "skill", skillId: "skill_scan", targetEnemyId: rt.snapshot().enemies[0]!.id });
      const enemy = rt.snapshot().enemies[0]!;
      expect(enemy.scanned).toBe(true);
      expect(enemy.hp).toBe(9_999);
      const message = specialMessages(rt)[0]!;
      expect(message).toContain(`HP ${enemy.hp}/9999`);
      expect(message).toContain(element.name || element.id);
    });

    it("learnEnemySkill copies a learnable enemy skill into the actor's permanent skills", () => {
      const s = setup();
      addSkill(s.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { learnable: true, power: 1 });
      addSkill(s.project, "skill_lore", { kind: "learnEnemySkill" });
      s.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      s.enemy.skillIds = ["skill_blue"];
      const rt = runtime(s, ["skill_lore"]);
      rt.performActorCommand({ kind: "skill", skillId: "skill_lore", targetEnemyId: rt.snapshot().enemies[0]!.id });
      expect(rt.snapshot().actors[0]!.skillIds).toContain("skill_blue");
      expect(rt.snapshot().eventState.actorSkillIds?.[s.actor.id]).toContain("skill_blue");
    });

    it("a blue mage learns a learnable skill that hits them; non-learnable skills are not learned", () => {
      const s = setup();
      addSkill(s.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { learnable: true, power: 1 });
      addSkill(s.project, "skill_lore", { kind: "learnEnemySkill" }, { scope: "self" });
      s.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      const rt = runtime(s, ["skill_lore"]);
      rt.performActorCommand({ kind: "defend" });
      expect(rt.snapshot().actors[0]!.skillIds).toContain("skill_blue");

      const plain = setup();
      addSkill(plain.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { power: 1 });
      addSkill(plain.project, "skill_lore", { kind: "learnEnemySkill" }, { scope: "self" });
      plain.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      const plainRt = runtime(plain, ["skill_lore"]);
      plainRt.performActorCommand({ kind: "defend" });
      expect(plainRt.snapshot().actors[0]!.skillIds).not.toContain("skill_blue");
    });

    it("randomSkillFrom picks one listed skill by rng and applies it", () => {
      const s = setup();
      addSkill(s.project, "skill_weak", { kind: "damage", statistic: "attack", affects: "hp" }, { power: 1, damageFormula: "7" });
      addSkill(s.project, "skill_strong", { kind: "damage", statistic: "attack", affects: "hp" }, { power: 1, damageFormula: "300" });
      addSkill(s.project, "skill_slot", { kind: "randomSkillFrom", skillIds: ["skill_weak", "skill_strong"] });
      const low = runtime(s, ["skill_slot"], () => 0.1);
      low.performActorCommand({ kind: "skill", skillId: "skill_slot", targetEnemyId: low.snapshot().enemies[0]!.id });
      const high = runtime(s, ["skill_slot"], () => 0.9);
      high.performActorCommand({ kind: "skill", skillId: "skill_slot", targetEnemyId: high.snapshot().enemies[0]!.id });
      const lowLoss = 9_999 - low.snapshot().enemies[0]!.hp;
      const highLoss = 9_999 - high.snapshot().enemies[0]!.hp;
      expect(lowLoss).toBeGreaterThan(0);
      expect(highLoss).toBeGreaterThan(lowLoss * 10);
      expect(specialMessages(low)[0]).toContain("skill_weak");
      expect(specialMessages(high)[0]).toContain("skill_strong");
    });

    it("new fields survive serialize/deserialize", () => {
      const s = setup();
      s.enemy.stealItems = [{ itemId: s.project.database.items[0]!.id, rate: 40 }];
      addSkill(s.project, "skill_slot", { kind: "randomSkillFrom", skillIds: ["skill_attack"] }, { learnable: true });
      const round = deserialize(serialize(s.project));
      expect(round.database.enemies.find((e) => e.id === s.enemy.id)?.stealItems).toEqual([{ itemId: s.project.database.items[0]!.id, rate: 40 }]);
      const skill = round.database.skills.find((entry) => entry.id === "skill_slot");
      expect(skill?.effect).toEqual({ kind: "randomSkillFrom", skillIds: ["skill_attack"] });
      expect(skill?.learnable).toBe(true);
    });

    it("special skills carry their animationId on their own timeline entry (steal, scan, learnEnemySkill)", () => {
      for (const effect of [{ kind: "steal" }, { kind: "scan" }, { kind: "learnEnemySkill" }] as const) {
        const s = setup();
        const anim = s.project.database.battleAnimations[0]!;
        addSkill(s.project, `skill_${effect.kind}`, effect, { animationId: anim.id });
        const rt = runtime(s, [`skill_${effect.kind}`]);
        rt.performActorCommand({ kind: "skill", skillId: `skill_${effect.kind}`, targetEnemyId: rt.snapshot().enemies[0]!.id });
        const entry = rt.snapshot().timeline.find((row) => row.kind === "special" && row.skillId === `skill_${effect.kind}`);
        expect(entry?.animation?.animationId, effect.kind).toBe(anim.id);
      }
    });
  });
});

describe("pokemonMoveMotion", () => {
  isolateTimers();
  type MoveSkill = Pick<SkillRecord, "effect" | "scope" | "animationId" | "moveMotion" | "elementId">;
  const physical = (animationId: string, scope: SkillRecord["scope"] = "enemy"): MoveSkill => ({ effect: { kind: "damage", statistic: "attack", affects: "hp" }, scope, animationId });
  const special = (animationId: string, elementId?: string): MoveSkill => ({ effect: { kind: "damage", statistic: "mind", affects: "hp" }, scope: "enemy", animationId, elementId });
  describe("pokemonMoveMotion (기술 → 움직임 종류)", () => {
    it("기술이 없거나 몸으로 치는 물리 기술은 접촉", () => {
      expect(pokemonMoveMotion(undefined)).toBe("contact");
      expect(pokemonMoveMotion(physical("anim_gen_tackle_impact"))).toBe("contact");
      expect(pokemonMoveMotion(physical("anim_gen_slash_steel"))).toBe("contact");
    });

    it("던지는 물리 기술·특수 기술은 발사체, 물대포는 물줄기라 발사체", () => {
      expect(pokemonMoveMotion(physical("anim_gen_projectile_shot"))).toBe("projectile");
      expect(pokemonMoveMotion(physical("anim_gen_leaf_volley"))).toBe("projectile");
      expect(pokemonMoveMotion(special("anim_gen_fire_burst", "fire"))).toBe("projectile");
      expect(pokemonMoveMotion(special("anim_gen_water_column", "water"))).toBe("projectile");
    });

    it("번개·빛기둥은 위에서, 바위 솟음은 아래에서 — 현장 발생", () => {
      expect(pokemonMoveMotion(special("anim_gen_thunder_strike", "thunder"))).toBe("strike");
      expect(pokemonMoveMotion(special("anim_gen_holy_beam", "holy"))).toBe("strike");
      expect(pokemonMoveMotion(special("anim_gen_earth_spike", "earth"))).toBe("strike");
      expect(pokemonStrikeFromBelow({ animationId: "anim_gen_earth_spike" })).toBe(true);
      expect(pokemonStrikeFromBelow({ animationId: "anim_gen_thunder_strike" })).toBe(false);
    });

    it("상대 전부를 치면 범위, 회복은 회복, 보조는 대상 편으로 능력 올리기·상태 걸기", () => {
      expect(pokemonMoveMotion(physical("anim_gen_earth_spike", "allEnemies"))).toBe("area");
      expect(pokemonMoveMotion({ effect: { kind: "healing", statistic: "mind", affects: "hp" }, scope: "ally", animationId: "anim_heal" })).toBe("heal");
      expect(pokemonMoveMotion({ effect: { kind: "support" }, scope: "self", animationId: "anim_gen_power_aura" })).toBe("boost");
      expect(pokemonMoveMotion({ effect: { kind: "support" }, scope: "enemy", animationId: "anim_gen_sleep_dust" })).toBe("status");
    });

    it("저자가 적은 moveMotion 이 판정을 이긴다", () => {
      expect(pokemonMoveMotion({ ...special("anim_gen_fire_burst", "fire"), moveMotion: "contact" })).toBe("contact");
    });

    it("색은 속성 → 이펙트 낱말 → 흰색", () => {
      expect(pokemonMoveColor(special("anim_gen_fire_burst", "fire"))).toBe("#ff7a26");
      expect(pokemonMoveColor(special("anim_gen_shadow_pulse"))).toBe("#8a4ad0");
      expect(pokemonMoveColor(physical("anim_gen_tackle_impact"))).toBe("#ffffff");
    });
  });
  describe("spriteEmitPoint (입·손 자리)", () => {
    // 10×10: 몸통(아래) + 왼쪽으로 튀어나온 머리(위) + 오른쪽으로 더 튀어나온 발(맨 아래 줄)
    const rows = [
      "..........",
      "..........",
      ".####.....",
      "#####.....",
      ".#######..",
      "..######..",
      "..######..",
      "..######..",
      "..######..",
      "..#########",
    ];
    const at = (x: number, y: number) => rows[y]?.[x] === "#";

    it("상대가 왼쪽이면 몸 위쪽에서 가장 왼쪽 칸 — 발끝은 보지 않는다", () => {
      expect(spriteEmitPoint(10, 10, at, { x: -1, y: 1 })).toEqual({ x: 0, y: 3 });
    });

    it("상대가 오른쪽이면 위쪽 60% 안에서 가장 오른쪽 칸 (맨 아래 발끝 x=9 는 제외)", () => {
      expect(spriteEmitPoint(10, 10, at, { x: 1, y: -1 })).toEqual({ x: 7, y: 4 });
    });

    it("빈 그림이면 null", () => {
      expect(spriteEmitPoint(4, 4, () => false, { x: 1, y: -1 })).toBeNull();
    });
  });
});
