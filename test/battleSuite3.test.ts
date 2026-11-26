import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { nextLivingBattler, targetScopeForCommand } from "@/battle/battleTargetResolver";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project, ItemRecord, ClassBattleCommand, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { createBlankProject } from "@/project/defaults";
import { normalizeCropRecord } from "@/project/farmModel";
import { startSession } from "@/project/session";
import { placeableKey } from "@/project/placeables";
import { giveMonster } from "@/project/monsterCollection";
import { setEquippedTool } from "@/project/toolActions";
import { interactWithFarmPlot } from "@/player/farming";
import { useItemFromMenu } from "@/player/playerItemUse";
import { isolateTimers } from "./mergedTeardown";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { installFakeDom } from "./fakeDom";
import { usesMagicalDefense } from "@/battle/battleDamage";
import { pokemonMoveColor, pokemonMoveMotion, pokemonStrikeFromBelow, spriteEmitPoint } from "@/battle/pokemonMoveMotion";

describe("battleTargetResolver", () => {
  isolateTimers();
  describe("battleDownedTargetRetarget", () => {
    isolateTimers();
    function battleProject(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }
    function addAlly(project: Project): void {
      const source = project.database.actors[0];
      if (!source) throw new Error("missing fixture actor");
      const ally = JSON.parse(JSON.stringify(source)) as typeof source;
      ally.id = "actor_ally";
      ally.name = "동료";
      project.database.actors.push(ally);
    }
    describe("nextLivingBattler", () => {
      const downed = { id: "enemy-1", recordId: "enemy_slime" };
      const living = { id: "enemy-2", recordId: "enemy_dragon" };
      const later = { id: "enemy-3", recordId: "enemy_dragon" };

      it("walks forward to the next candidate and wraps the roster", () => {
        expect(nextLivingBattler([downed, living], [living], "enemy-1")).toBe(living);
        expect(nextLivingBattler([living, downed], [living], "enemy-1")).toBe(living);
        expect(nextLivingBattler([downed, later, living], [living], "enemy-1")).toBe(living);
      });

      it("does not substitute an id that is not on the roster", () => {
        expect(nextLivingBattler([downed, living], [living], "enemy-99")).toBeUndefined();
        expect(nextLivingBattler([downed, living], [living], "")).toBeUndefined();
      });
    });
    describe("strict battle retargets a downed single target", () => {
      it("lands the later actor attack on the next living enemy", () => {
        const project = battleProject();
        addAlly(project);
        const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
        if (!troop) throw new Error("missing troop");
        troop.enemyIds = ["enemy_slime", "enemy_dragon"];
        troop.members = [
          { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
          { enemyId: "enemy_dragon", x: 140, y: 90, hidden: false },
        ];
        const slime = project.database.enemies.find((entry) => entry.id === "enemy_slime");
        const dragon = project.database.enemies.find((entry) => entry.id === "enemy_dragon");
        if (!slime || !dragon) throw new Error("missing enemies");
        slime.stats = { ...slime.stats, maxHp: 1, attack: 1, defense: 0, agility: 1 };
        dragon.stats = { ...dragon.stats, maxHp: 999, attack: 1, defense: 0, agility: 1, mind: 0 };
        dragon.skillIds = [];

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0,
          party: {
            levels: { actor_hero: 1, actor_ally: 1 },
            experience: {},
            partyActorIds: ["actor_hero", "actor_ally"],
          },
        });

        expect(runtime.snapshot().activeActorId).toBe("actor_hero");
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().activeActorId).toBe("actor_ally");
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        const snapshot = runtime.snapshot();
        const slimeBattler = snapshot.enemies.find((enemy) => enemy.id === "enemy-1");
        const dragonBattler = snapshot.enemies.find((enemy) => enemy.id === "enemy-2");
        expect(slimeBattler?.hp).toBe(0);
        expect(dragonBattler?.hp).toBeLessThan(dragonBattler?.maxHp ?? 0);
        expect(snapshot.timeline.some((entry) => entry.kind === "damage" && entry.targetId === "enemy-2" && entry.userRecordId === "actor_ally")).toBe(true);
      });

      it("lands the later enemy attack on the next living actor", () => {
        const project = battleProject();
        addAlly(project);
        const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
        if (!troop) throw new Error("missing troop");
        troop.enemyIds = ["enemy_slime", "enemy_slime"];
        troop.members = [
          { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
          { enemyId: "enemy_slime", x: 140, y: 90, hidden: false },
        ];
        const slime = project.database.enemies.find((entry) => entry.id === "enemy_slime");
        if (!slime) throw new Error("missing slime");
        slime.stats = { ...slime.stats, maxHp: 500, attack: 80, defense: 80, agility: 90, mind: 0 };
        slime.skillIds = [];

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0,
          party: {
            levels: { actor_hero: 1, actor_ally: 1 },
            experience: {},
            vitals: { actor_hero: { hp: 1, mp: 0 }, actor_ally: { hp: 400, mp: 0 } },
            partyActorIds: ["actor_hero", "actor_ally"],
          },
        });

        runtime.performActorCommand({ kind: "defend" });
        runtime.performActorCommand({ kind: "defend" });

        const snapshot = runtime.snapshot();
        const hero = snapshot.actors.find((actor) => actor.recordId === "actor_hero");
        const ally = snapshot.actors.find((actor) => actor.recordId === "actor_ally");
        expect(hero?.hp).toBe(0);
        expect(ally?.hp).toBeLessThan(400);
        const enemyHits = snapshot.timeline.filter((entry) => entry.kind === "damage" && entry.commandKind === "enemyAttack");
        expect(enemyHits.map((entry) => entry.targetId)).toEqual(["actor_hero", "actor_ally"]);
      });

      it("does not spend the turn when the attack names an unknown enemy", () => {
        const project = battleProject();
        const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime");
        if (!enemy) throw new Error("missing slime");
        enemy.stats = { ...enemy.stats, maxHp: 40, agility: 1 };
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0,
          party: { levels: { actor_hero: 1 }, experience: {}, partyActorIds: ["actor_hero"] },
        });
        const before = runtime.snapshot();
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-99" });
        const after = runtime.snapshot();
        expect(after.phase).toBe("actorCommand");
        expect(after.activeActorId).toBe("actor_hero");
        expect(after.enemies[0]?.hp).toBe(before.enemies[0]?.hp);
        expect(after.timeline).toHaveLength(before.timeline.length);
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
});

describe("databaseBattleCommand", () => {
  isolateTimers();
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
  describe("databaseBattleCommandStaleClass", () => {
    isolateTimers();
    const attack: ClassBattleCommand = { id: "attack", name: "Strike", kind: "attack" };
    const item: ClassBattleCommand = { id: "item", name: "Pack", kind: "item" };
    const magic: ClassBattleCommand = { id: "magic", name: "Fire", kind: "skill", skillId: "skill_fire" };
    const footer: ClassBattleCommand = { id: "cmd_change", name: "Switch", kind: "switch" };
    describe("battle command controls after external selected-class deletion", () => {
      let restore: () => void;
      let host: HTMLElement;
      let studio: typeof import("@/editor/panels/databaseBattleCommandStudio");
      let store: typeof import("@/project/store")["store"];
      let history: typeof import("@/editor/mapEditHistory");
      let rerender: ReturnType<typeof vi.fn>;

      function control(id: string): HTMLElement {
        const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!node) throw new Error(`Missing control ${id}`);
        return node;
      }

      beforeEach(async () => {
        restore = installFakeDom();
        vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
        ({ store } = await import("@/project/store"));
        history = await import("@/editor/mapEditHistory");
        studio = await import("@/editor/panels/databaseBattleCommandStudio");
        const project = createBlankProject();
        const base = project.database.classes[0];
        if (!base) throw new Error("Missing starter class");
        project.database.classes = ["survivor_a", "selected", "survivor_b"].map((id) => ({
          ...base, id, name: id,
          battleCommands: [{ ...attack, name: `${id} override`, skillId: `${id}_skill` }, { ...item }, { ...footer }],
        }));
        project.database.battleCommands = [{ ...magic }];
        store.replace(project);
        history.resetMapEditHistory();
        host = document.createElement("div");
        document.body.append(host);
        // Deliberately retain DOM on external updates, as the modal does during input focus.
        rerender = vi.fn(() => {
          const palette = document.createElement("div");
          for (const command of store.getCurrent().database.battleCommands ?? []) {
            const card = document.createElement("article");
            studio.attachCatalogPlacement(card, command, rerender);
            palette.append(card);
          }
          host.replaceChildren(studio.battleCommandPlacement(palette, rerender));
        });
        rerender();
        const select = control("db-command-class-select") as HTMLSelectElement;
        select.value = "selected";
        select.dispatchEvent(new Event("change"));
      });

      afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        restore();
      });

      it.each([
        ["add", "db-command-place-magic"],
        ["move", "db-command-down-attack"],
        ["remove", "db-command-remove-attack"],
      ])("rejects retained %s without touching surviving classes or history, then refreshes", (_action, testid) => {
        const select = control("db-command-class-select") as HTMLSelectElement;
        const button = control(testid) as HTMLButtonElement;
        expect(button.disabled).toBe(false);
        store.update((project) => {
          project.database.classes = project.database.classes.filter((row) => row.id !== "selected");
        }, { scope: "database", collection: "classes", label: "External class deletion", origin: "system" });
        expect(control(testid)).toBe(button);
        expect(control("db-command-class-select")).toBe(select);
        expect(select.value).toBe("selected");
        const before = structuredClone(store.getCurrent().database.classes);
        const marker = history.getMapEditHistoryMarker();
        const labels = history.pendingHistoryLabels();
        const updates = vi.spyOn(store, "update");
        const snapshots = vi.spyOn(history, "recordProjectSnapshot");
        rerender.mockClear();

        button.dispatchEvent(new Event("click"));

        expect(store.getCurrent().database.classes).toEqual(before);
        expect(updates).not.toHaveBeenCalled();
        expect(snapshots).not.toHaveBeenCalled();
        expect(history.getMapEditHistoryMarker()).toBe(marker);
        expect(history.pendingHistoryLabels()).toEqual(labels);
        expect(rerender).toHaveBeenCalledOnce();
        expect(control("db-command-class-select")).not.toBe(select);
        expect((control("db-command-class-select") as HTMLSelectElement).value).toBe("survivor_a");
        expect((control("db-command-place-magic") as HTMLButtonElement).disabled).toBe(false);
      });
    });
  });
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
