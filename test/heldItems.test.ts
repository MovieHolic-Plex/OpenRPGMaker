import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { runTool } from "@/editor/tools";
import { normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { giveGiftToNpc, giftRankForItem } from "@/project/friendship";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { resolveShopStock } from "@/project/shopStock";
import { changeFriendship, evalCondition, getFriendship, startSession } from "@/project/session";
import type { Command, GameEvent, Project, MonsterInstance, SkillId } from "@/project/types";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createNpcScheduleDemoProject } from "./fixtures/npcScheduleDemo";
import { createBattleRuntime, type BattleRuntime, type BattleSnapshot, type TargetedActorCommand } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";
import { heldBoostPercent, heldCuresStatus, heldEndureDamage, heldHealAmount, heldRegenAmount, normalizeHeldItemEffect } from "@/battle/heldItems";
import { giveHeldItem, takeHeldItem } from "@/project/monsterHeldItems";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { isolateTimers } from "./mergedTeardown";

describe("friendshipGiftsShop", () => {
  isolateTimers();
  describe("friendship runtime", () => {
    it("changes, clamps, and round-trips friendship through save/load", () => {
      const project = createBlankProject();
      const session = startSession(project);

      expect(changeFriendship(session, "ev_farmer", 1200)).toBe(1000);
      expect(changeFriendship(session, "ev_farmer", -1400)).toBe(0);
      expect(changeFriendship(session, "ev_farmer", 80)).toBe(80);

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.friendship).toEqual({ ev_farmer: 80 });
      expect(getFriendship(restored, "ev_farmer")).toBe(80);
    });

    it("evaluates friendshipAtLeast with characterId self host (not bare event id)", () => {
      const project = createBlankProject();
      const session = startSession(project);
      changeFriendship(session, "char_farmer", 120);

      expect(evalCondition(session, { kind: "friendshipAtLeast", value: 100 }, { id: "ev_farmer", characterId: "char_farmer" })).toBe(true);
      expect(evalCondition(session, { kind: "friendshipAtLeast", value: 100 }, { id: "ev_farmer" })).toBe(false);
      expect(evalCondition(session, { kind: "friendshipAtLeast", npcKey: "char_farmer", value: 140 })).toBe(false);
    });
  });
  describe("gift runtime", () => {
    it("applies deterministic preference deltas and daily gift reset", () => {
      const project = giftProject();
      const session = startSession(project);
      const event = giftEvent("ev_farmer");

      expect(giftRankForItem(event.giftPrefs, "item_strawberry")).toBe("loved");
      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({ ok: true, rank: "loved", delta: 80, friendship: 80 });
      expect(giveGiftToNpc(project, session, event, "item_neutral")).toMatchObject({ ok: false, reason: "already-gifted" });
      expect(session.inventory.item_neutral).toBe(1);
      expect(getFriendship(session, "ev_farmer")).toBe(80);

      session.gameTime = { minute: 0, hour: 6, day: 2, season: "spring", year: 1 };
      expect(giveGiftToNpc(project, session, event, "item_liked")).toMatchObject({ ok: true, rank: "liked", delta: 45, friendship: 125 });

      const dislikedSession = startSession(project);
      expect(giveGiftToNpc(project, dislikedSession, giftEvent("ev_miner"), "item_disliked")).toMatchObject({
        ok: true,
        rank: "disliked",
        delta: -20,
        friendship: 0,
      });
    });

    it("does not expose gift behavior when giftSystem is off", () => {
      const project = giftProject();
      project.system.giftSystem = false;
      const session = startSession(project);

      expect(giveGiftToNpc(project, session, giftEvent("ev_farmer"), "item_strawberry")).toMatchObject({ ok: false, reason: "system-disabled" });
      expect(session.inventory.item_strawberry).toBe(2);
      expect(getFriendship(session, "ev_farmer")).toBe(0);
    });

    it.each([
      ["astronomical", 1e300],
      ["over cap", ITEM_QUANTITY_MAX + 1],
      ["infinite", Number.POSITIVE_INFINITY],
      ["zero", 0],
      ["missing", undefined],
    ])("rejects %s gift inventory without mutating any session state", (_label, quantity) => {
      const project = giftProject();
      const session = startSession(project);
      const event = giftEvent("ev_farmer");
      event.socialCalendar = { birthday: { season: "spring", day: 1 } };
      session.friendship = { ev_farmer: 25 };
      session.dailyGifts = undefined;
      if (quantity === undefined) delete session.inventory.item_strawberry;
      else session.inventory.item_strawberry = quantity;
      const before = structuredClone(session);

      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: false,
        reason: "no-item",
      });
      expect(session).toEqual(before);
    });
  });
  describe("birthday gift multiplier", () => {
    it("doubles gift friendship delta on birthday season+day", () => {
      const project = giftProject();
      const session = startSession(project);
      session.gameTime = { minute: 0, hour: 9, day: 14, season: "summer", year: 1 };
      const event = giftEvent("ev_bday");
      event.socialCalendar = { birthday: { season: "summer", day: 14 } };

      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: true,
        rank: "loved",
        delta: 160,
        friendship: 160,
      });
    });

    it("keeps base delta on non-birthday days and when gameTime is missing", () => {
      const project = giftProject();
      const event = giftEvent("ev_bday");
      event.socialCalendar = { birthday: { season: "summer", day: 14 } };

      const noTime = startSession(project);
      noTime.gameTime = undefined;
      expect(giveGiftToNpc(project, noTime, event, "item_strawberry")).toMatchObject({
        ok: true,
        delta: 80,
        friendship: 80,
      });

      const otherDay = startSession(project);
      otherDay.gameTime = { minute: 0, hour: 9, day: 15, season: "summer", year: 1 };
      expect(giveGiftToNpc(project, otherDay, event, "item_strawberry")).toMatchObject({
        ok: true,
        delta: 80,
        friendship: 80,
      });
    });
  });
  describe("social shop discount", () => {
    it("lowers buy prices when merchant bond meets minFriendship", () => {
      const project = giftProject();
      const session = startSession(project);
      changeFriendship(session, "char_merchant", 200);
      const command: Extract<Command, { kind: "shop" }> = {
        kind: "shop",
        itemIds: ["item_spring_seed"],
        stock: [{ itemId: "item_spring_seed", priceOverride: 100 }],
      };
      const merchant: GameEvent = {
        ...giftEvent("ev_merchant"),
        characterId: "char_merchant",
        socialShop: { minFriendship: 100, priceMultiplier: 0.8 },
      };

      expect(resolveShopStock(project, session, command, merchant)).toEqual([
        { itemId: "item_spring_seed", price: 80 },
      ]);
    });

    it("does not discount without characterId or insufficient friendship", () => {
      const project = giftProject();
      const session = startSession(project);
      changeFriendship(session, "char_merchant", 200);
      const command: Extract<Command, { kind: "shop" }> = {
        kind: "shop",
        itemIds: ["item_spring_seed"],
        stock: [{ itemId: "item_spring_seed", priceOverride: 100 }],
      };

      const noCharacter: GameEvent = {
        id: "ev_merchant",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        socialShop: { minFriendship: 100, priceMultiplier: 0.5 },
      };
      expect(resolveShopStock(project, session, command, noCharacter)).toEqual([
        { itemId: "item_spring_seed", price: 100 },
      ]);

      const lowBond: GameEvent = {
        ...giftEvent("ev_merchant"),
        characterId: "char_merchant",
        socialShop: { minFriendship: 500, priceMultiplier: 0.5 },
      };
      expect(resolveShopStock(project, session, command, lowBond)).toEqual([
        { itemId: "item_spring_seed", price: 100 },
      ]);

      expect(resolveShopStock(project, session, command)).toEqual([
        { itemId: "item_spring_seed", price: 100 },
      ]);
    });
  });
  describe("seasonal shop stock", () => {
    it("filters stock by current season and applies seasonal prices", () => {
      const project = giftProject();
      const session = startSession(project);
      const command: Extract<Command, { kind: "shop" }> = {
        kind: "shop",
        itemIds: ["item_strawberry"],
        stock: [
          { itemId: "item_spring_seed", seasons: ["spring"], priceOverride: 30, priceBySeason: { spring: 18 } },
          { itemId: "item_winter_firewood", seasons: ["winter"], priceOverride: 40, priceBySeason: { winter: 28 } },
        ],
      };

      expect(resolveShopStock(project, session, command)).toEqual([{ itemId: "item_spring_seed", price: 18 }]);
      session.gameTime = { minute: 0, hour: 9, day: 1, season: "winter", year: 1 };
      expect(resolveShopStock(project, session, command)).toEqual([{ itemId: "item_winter_firewood", price: 28 }]);
    });

    it("keeps legacy shops and timeSystem-off projects unchanged", () => {
      const project = giftProject();
      const session = startSession(project);
      const legacy: Extract<Command, { kind: "shop" }> = { kind: "shop", itemIds: ["item_strawberry", "item_liked"] };
      expect(resolveShopStock(project, session, legacy)).toEqual([{ itemId: "item_strawberry" }, { itemId: "item_liked" }]);

      project.system.timeSystem = undefined;
      const seasonal: Extract<Command, { kind: "shop" }> = {
        kind: "shop",
        itemIds: [],
        stock: [
          { itemId: "item_spring_seed", seasons: ["spring"], priceBySeason: { spring: 18 } },
          { itemId: "item_winter_firewood", seasons: ["winter"], priceBySeason: { winter: 28 } },
        ],
      };
      expect(resolveShopStock(project, session, seasonal).map((entry) => entry.itemId)).toEqual(["item_spring_seed", "item_winter_firewood"]);
    });
  });
  describe("friendship and shop tools", () => {
    it("set_shop_stock writes seasonal stock onto an existing event", () => {
      const ctx = { project: giftProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      map.events.push({ ...giftEvent("ev_merchant"), pages: [eventPage("ev_merchant_page", [])] });

      const result = runTool(ctx, "set_shop_stock", {
        mapId: map.id,
        eventId: "ev_merchant",
        stock: [{ itemId: "item_spring_seed", seasons: ["spring"], priceBySeason: { spring: 18 } }],
      });

      expect(result.ok, result.summary).toBe(true);
      const shop = ctx.project.maps[map.id].events.find((event) => event.id === "ev_merchant")?.pages?.[0]?.commands[0];
      expect(shop).toMatchObject({ kind: "shop", itemIds: ["item_spring_seed"], stock: [{ itemId: "item_spring_seed" }] });
    });

    it("make_villager accepts gift preferences and shopkeeper stock", () => {
      const ctx = { project: giftProject() };
      const map = ctx.project.maps[ctx.project.startMapId];

      const result = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_seed_seller",
        name: "씨앗 상인",
        home: { x: 1, y: 1 },
        dialogue: [{ text: "씨앗이 필요해?" }],
        giftPrefs: { liked: ["item_strawberry"] },
        shop: { stock: [{ itemId: "item_spring_seed", seasons: ["spring"], priceOverride: 22 }] },
      });

      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[map.id].events.find((entry) => entry.id === "ev_seed_seller");
      expect(event?.giftPrefs).toEqual({ liked: ["item_strawberry"] });
      expect(event?.pages?.[0]?.commands.some((command) => command.kind === "shop")).toBe(true);
      const scene = runSceneTest(ctx.project, {
        mapId: map.id,
        start: { x: 1, y: 2 },
        steps: [
          {
            kind: "expect",
            shopStock: { eventId: "ev_seed_seller", itemIds: ["item_spring_seed"] },
          },
        ],
      });
      expect(scene.ok, scene.failureReason).toBe(true);
    });
  });
  describe("Phase 11b run_scene_test integration", () => {
    it("gifts a loved item, branches on friendship, and changes shop stock by season", () => {
      const { project, ids } = createNpcScheduleDemoProject();
      const result = runSceneTest(project, {
        mapId: ids.townMapId,
        start: { x: 8, y: 1 },
        steps: [
          { kind: "gift", eventId: ids.farmerEventId, itemId: ids.strawberryItemId },
          { kind: "expect", friendshipAtLeast: { npcKey: ids.farmerEventId, value: 80 }, inventoryCount: { [ids.strawberryItemId]: 0 } },
          { kind: "interact" },
          { kind: "expect", variableEquals: { [ids.farmerFieldVariableId]: 2, [ids.farmerFriendshipVariableId]: 80 } },
          { kind: "wait", ticks: 188 },
          { kind: "expect", eventOnMap: { eventId: ids.merchantEventId, mapId: ids.shopMapId } },
          { kind: "expect", shopStock: { eventId: ids.merchantEventId, mapId: ids.shopMapId, itemIds: [ids.springSeedItemId], prices: { [ids.springSeedItemId]: 18 } } },
          { kind: "advanceDays", days: 84 },
          { kind: "wait", ticks: 188 },
          { kind: "expect", shopStock: { eventId: ids.merchantEventId, mapId: ids.shopMapId, itemIds: [ids.winterFirewoodItemId], prices: { [ids.winterFirewoodItemId]: 28 } } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.log).toContain(`gift ${ids.farmerEventId} ${ids.strawberryItemId}: loved 80 => 80`);
    });
  });
  function giftProject(): Project {
    const project = createBlankProject();
    project.system.giftSystem = true;
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    project.database.items.push(
      normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 12 }),
      normalizeItemRecord({ id: "item_liked", name: "좋은 선물", scope: "none", price: 8 }),
      normalizeItemRecord({ id: "item_disliked", name: "싫은 선물", scope: "none", price: 4 }),
      normalizeItemRecord({ id: "item_neutral", name: "평범한 선물", scope: "none", price: 2 }),
      normalizeItemRecord({ id: "item_spring_seed", name: "봄 씨앗", scope: "none", price: 30 }),
      normalizeItemRecord({ id: "item_winter_firewood", name: "겨울 장작", scope: "none", price: 50 })
    );
    project.session.inventory = {
      item_strawberry: 2,
      item_liked: 1,
      item_disliked: 1,
      item_neutral: 1,
    };
    return project;
  }
  function giftEvent(id: string): GameEvent {
    return {
      id,
      characterId: id,
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      giftPrefs: {
        loved: ["item_strawberry"],
        liked: ["item_liked"],
        disliked: ["item_disliked"],
      },
      pages: [eventPage(`${id}_page`, [])],
    };
  }
  function eventPage(id: string, commands: Command[]) {
    return {
      id,
      name: id,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" as const },
      priority: "same" as const,
      overlapForbidden: true,
      movement: { type: "fixed" as const, speed: 3, frequency: 3 },
      commands,
    };
  }
});

describe("gen1BattleCommandDom", () => {
  isolateTimers();
  type Gen1Harness = {
    readonly project: Project;
    readonly runtime: BattleRuntime;
    readonly snapshot: BattleSnapshot;
  };
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("Gen1 monster battle command DOM", () => {
    it("renders exactly Fight / PKMN / Item / Run for a Pokemon monster actor", () => {
      const { runtime, snapshot } = gen1Harness();
      const { options } = panelOptions(runtime);

      const root = commandPanel(snapshot, options) as unknown as FakeElement;

      expect(commandIds(root)).toEqual([
        "actor-command-fight",
        "actor-command-item",
        "actor-command-pkmn",
        "actor-command-run",
      ]);
      // 한국어판 포켓몬 전투 화면 순서·이름(f115c53bb9): 싸운다 · 가방 / 몬스터 · 도망간다.
      expect(commandLabels(root)).toEqual(["싸운다", "가방", "몬스터", "도망간다"]);
      expect(root.querySelector("[data-testid='actor-command-attack']")).toBeNull();
      expect(root.querySelector("[data-testid='actor-command-defend']")).toBeNull();
      expect(root.querySelector("[data-testid='actor-command-capture']")).toBeNull();
    });

    it("limits Fight to four moves, shows current/max PP, and disables PP 0", () => {
      const { runtime, snapshot } = gen1Harness();
      const state = panelOptions(runtime);
      const root = commandPanel(snapshot, state.options) as unknown as FakeElement;

      button(root, "actor-command-fight").click();
      expect(state.submenu()).toEqual({ kind: "pokemonFight" });

      const fight = commandPanel(snapshot, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;
      expect(fight.querySelectorAll(".battle-command").filter((node) => node.dataset.testid?.startsWith("actor-skill-"))).toHaveLength(4);
      expect(fight.textContent).toContain("횟수 0/20");
      expect(fight.textContent).toContain("횟수 5/5");
      expect(fight.querySelector("[data-testid='actor-skill-skill_move_1']")).toBeNull();
      // 횟수 0 인 기술은 `disabled` 가 아니라 `aria-disabled` 로 남긴다 — 커서가 서야 "남은 횟수가 없습니다" 를 읽는다.
      expect(button(fight, "actor-skill-skill_move_2").dataset.battleCommandInert).toBe("true");
      expect(button(fight, "actor-skill-skill_move_2").textContent).toContain("남은 횟수가 없습니다");
      expect(button(fight, "actor-skill-skill_move_4").dataset.battleCommandInert).toBeUndefined();
      expect(button(fight, "actor-skill-skill_move_5").dataset.battleCommandInert).toBeUndefined();
    });

    it("offers Struggle when every finite move is out of PP", () => {
      const { runtime, snapshot } = gen1Harness();
      const exhausted: BattleSnapshot = {
        ...snapshot,
        actors: snapshot.actors.map((actor) => ({
          ...actor,
          skillIds: actor.skillIds.filter((skillId) => skillId !== "skill_move_4"),
          skillPp: Object.fromEntries(actor.skillIds.map((skillId) => [skillId, 0])),
        })),
      };
      const state = panelOptions(runtime);
      const root = commandPanel(exhausted, state.options) as unknown as FakeElement;

      button(root, "actor-command-fight").click();
      const fight = commandPanel(exhausted, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

      expect(button(fight, "actor-command-struggle").textContent).toContain("발버둥");
      expect(button(root, "actor-command-fight").disabled).toBe(false);
    });

    it("offers Struggle when the only PP-less legacy move cannot afford its MP cost", () => {
      const { project, runtime, snapshot } = gen1Harness();
      const legacy = project.database.skills.find((skill) => skill.id === "skill_move_4")!;
      legacy.mpCost = { flat: 99, percentMax: 0 };
      store.replace(project);
      const exhausted: BattleSnapshot = {
        ...snapshot,
        actors: snapshot.actors.map((actor) => ({
          ...actor,
          mp: 0,
          skillIds: ["skill_move_1", "skill_move_2", "skill_move_3", "skill_move_4"],
          skillPp: { skill_move_1: 0, skill_move_2: 0, skill_move_3: 0 },
        })),
      };
      const state = panelOptions(runtime);
      const root = commandPanel(exhausted, state.options) as unknown as FakeElement;

      button(root, "actor-command-fight").click();
      const fight = commandPanel(exhausted, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

      expect(button(fight, "actor-command-struggle").textContent).toContain("발버둥");
    });

    it.each(["trainerBattle", "uncapturable"] as const)("omits balls from Item when %s forbids capture, preserving medicine", (flag) => {
      const { project, runtime, snapshot } = gen1Harness();
      project.database.troops.find((troop) => troop.id === snapshot.troopId)![flag] = true;
      store.replace(project);
      const { options } = panelOptions(runtime);
      const items = commandPanel(snapshot, { ...options, submenu: { kind: "item" } }) as unknown as FakeElement;
      expect(items.querySelector("[data-testid='actor-capture-item_capture_orb']")).toBeNull();
      expect(items.querySelector(`[data-testid='actor-item-${DEFAULT_ITEM_ID}']`)).not.toBeNull();
    });

    it("puts normal items and balls in Item and routes a ball through canonical capture targeting", () => {
      const { runtime, snapshot } = gen1Harness();
      const beginTargetCommand = vi.fn<(command: TargetedActorCommand) => void>();
      const state = panelOptions(runtime, beginTargetCommand);
      const root = commandPanel(snapshot, state.options) as unknown as FakeElement;

      button(root, "actor-command-item").click();
      const items = commandPanel(snapshot, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

      expect(items.querySelector(`[data-testid='actor-item-${DEFAULT_ITEM_ID}']`)).not.toBeNull();
      button(items, "actor-capture-item_capture_orb").click();
      expect(beginTargetCommand).toHaveBeenCalledWith({ kind: "capture", captureItemId: "item_capture_orb" });
    });

    it("keeps the classic RM2K3 actor command surface unchanged", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "retro2003";
      store.replace(project);
      const runtime = createBattleRuntime({
        project,
        troopId: DEFAULT_TROOP_ID,
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0.5,
      });
      const root = commandPanel(runtime.snapshot(), panelOptions(runtime).options) as unknown as FakeElement;

      expect(root.querySelector("[data-testid='actor-command-attack']")).not.toBeNull();
      expect(root.querySelector("[data-testid='actor-command-defend']")).not.toBeNull();
      expect(root.querySelector("[data-testid='actor-command-fight']")).toBeNull();
    });
  });
  function gen1Harness(): Gen1Harness {
    const project = createBlankProject();
    project.system.battleUiStyle = "pokemon";
    project.system.battleParty = "monsters";
    const skillIds = Array.from({ length: 5 }, (_, index) => `skill_move_${index + 1}` as SkillId);
    project.database.skills.push(...skillIds.map((id, index) => normalizeSkillRecord({
      id,
      name: `Move ${index + 1}`,
      scope: "enemy",
      power: 20 + index,
      maxPp: [35, 20, 15, undefined, 5][index],
    })));
    const monster: MonsterInstance = {
      instanceId: "monster_001",
      speciesId: "species_wild_slime",
      level: 5,
      exp: 0,
      skillIds,
      friendship: 70,
      caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    };
    store.replace(project);
    const inventory = { [DEFAULT_ITEM_ID]: 2, item_capture_orb: 3 };
    const runtime = createBattleRuntime({
      project,
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      partyMonsters: [monster],
      sessionState: { switches: {}, variables: {}, inventory },
      rng: () => 0.5,
    });
    const current = runtime.snapshot();
    const actor = current.actors[0];
    if (!actor) throw new Error("missing monster battler");
    const snapshot: BattleSnapshot = {
      ...current,
      actors: [{
        ...actor,
        skillPp: {
          skill_move_1: 12,
          skill_move_2: 0,
          skill_move_3: 8,
          skill_move_4: 0,
          skill_move_5: 5,
        },
      }],
    };
    return { project, runtime, snapshot };
  }
  function panelOptions(runtime: BattleRuntime, begin = vi.fn<(command: TargetedActorCommand) => void>()) {
    let currentSubmenu: BattleCommandSubmenu = null;
    const options: BattleCommandPanelOptions = {
      runtime,
      submenu: currentSubmenu,
      setSubmenu: (submenu) => {
        currentSubmenu = submenu;
      },
      setDirectorState: () => undefined,
      render: () => undefined,
      runActorCommand: () => undefined,
      beginTargetCommand: begin,
      confirmTargetSelection: () => undefined,
    };
    return { options, submenu: () => currentSubmenu };
  }
  function button(root: FakeElement, testid: string): FakeElement {
    const found = root.querySelector(`[data-testid='${testid}']`);
    if (!found) throw new Error(`missing button ${testid}`);
    return found;
  }
  function commandIds(root: FakeElement): string[] {
    return root.querySelectorAll(".battle-command").map((node) => node.dataset.testid).filter(Boolean);
  }
  function commandLabels(root: FakeElement): string[] {
    return root.querySelectorAll(".battle-command").map((node) => node.querySelector("strong")?.textContent ?? "");
  }
});

// poke-depth PR4: 지닌 도구. 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("heldItems", () => {
  isolateTimers();
  describe("normalizeHeldItemEffect", () => {
    it("drops unknown kinds and boostType without a type", () => {
      expect(normalizeHeldItemEffect(undefined)).toBeUndefined();
      expect(normalizeHeldItemEffect({ kind: "bogus" })).toBeUndefined();
      expect(normalizeHeldItemEffect({ kind: "boostType" })).toBeUndefined();
    });
    it("clamps and fills defaults", () => {
      expect(normalizeHeldItemEffect({ kind: "healBelow" })).toMatchObject({ thresholdPercent: 50, healPercent: 30 });
      expect(normalizeHeldItemEffect({ kind: "healBelow", thresholdPercent: 500, healPercent: 900 })).toMatchObject({ thresholdPercent: 100, healPercent: 100 });
      expect(normalizeHeldItemEffect({ kind: "boostType", type: "fire", percent: 5 })).toMatchObject({ percent: 101 });
      expect(normalizeHeldItemEffect({ kind: "regen", percent: 99 })).toMatchObject({ percent: 25 });
      expect(normalizeHeldItemEffect({ kind: "cureStatus", status: "nonsense" })).toMatchObject({ status: "any" });
      expect(normalizeHeldItemEffect({ kind: "endureOnce" })).toEqual({ kind: "endureOnce" });
    });
    it("is omitted from item records that do not set it (unchanged bytes)", () => {
      expect("heldEffect" in normalizeItemRecord({ id: "i", name: "i" })).toBe(false);
      expect(normalizeItemRecord({ id: "i", name: "i", heldEffect: { kind: "endureOnce" } }).heldEffect).toEqual({ kind: "endureOnce" });
    });
  });
  describe("held item effects", () => {
    it("healBelow heals only at or below the threshold and never overheals", () => {
      const berry = normalizeHeldItemEffect({ kind: "healBelow", thresholdPercent: 50, healPercent: 50 });
      expect(heldHealAmount(berry, 60, 100)).toBe(0);
      expect(heldHealAmount(berry, 50, 100)).toBe(50);
      expect(heldHealAmount(berry, 40, 100)).toBe(50);
      expect(heldHealAmount(berry, 10, 20)).toBe(10);
      expect(heldHealAmount(berry, 0, 100)).toBe(0);
    });
    it("boostType scales only the declared type", () => {
      const charm = normalizeHeldItemEffect({ kind: "boostType", type: "fire", percent: 150 });
      expect(heldBoostPercent(charm, "fire")).toBe(150);
      expect(heldBoostPercent(charm, "water")).toBe(100);
      expect(heldBoostPercent(undefined, "fire")).toBe(100);
    });
    it("endureOnce only saves a full-HP holder from a lethal hit", () => {
      const sash = normalizeHeldItemEffect({ kind: "endureOnce" });
      expect(heldEndureDamage(sash, 30, 30, 99)).toEqual({ damage: 29, endured: true });
      expect(heldEndureDamage(sash, 29, 30, 99)).toEqual({ damage: 99, endured: false });
      expect(heldEndureDamage(sash, 30, 30, 10)).toEqual({ damage: 10, endured: false });
    });
    it("regen heals at least 1 and stops at full HP; cureStatus matches the status or any", () => {
      const left = normalizeHeldItemEffect({ kind: "regen", percent: 10 });
      expect(heldRegenAmount(left, 10, 100)).toBe(10);
      expect(heldRegenAmount(left, 5, 6)).toBe(1);
      expect(heldRegenAmount(left, 100, 100)).toBe(0);
      expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus", status: "poison" }), "poison")).toBe(true);
      expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus", status: "poison" }), "burn")).toBe(false);
      expect(heldCuresStatus(normalizeHeldItemEffect({ kind: "cureStatus" }), "burn")).toBe(true);
    });
  });
  describe("give / take held item", () => {
    function setup() {
      const project: any = createScarloxyPokemonDemoProject();
      for (const id of ["h_a", "h_b"]) project.database.items.push(normalizeItemRecord({ id, name: id === "h_a" ? "열매" : "띠", heldEffect: { kind: "endureOnce" } }));
      const session: any = structuredClone(project.session);
      session.inventory = { h_a: 1, h_b: 1 };
      session.monsterInstances = { m1: { instanceId: "m1", speciesId: project.database.monsterSpecies[0].id, level: 5, exp: 0, skillIds: [], friendship: 70 } };
      session.monsterParty = ["m1"];
      return { project, session };
    }
    it("moves the item from the bag to the monster and swaps an old one back", () => {
      const { project, session } = setup();
      expect(giveHeldItem(project, session, "h_a", "m1").kind).toBe("done");
      expect(session.monsterInstances.m1.heldItemId).toBe("h_a");
      expect(session.inventory.h_a ?? 0).toBe(0);
      expect(giveHeldItem(project, session, "h_b", "m1").kind).toBe("done");
      expect(session.monsterInstances.m1.heldItemId).toBe("h_b");
      expect(session.inventory.h_a).toBe(1);
      expect(session.inventory.h_b ?? 0).toBe(0);
    });
    it("refuses non-holdable items, missing targets and an already held item", () => {
      const { project, session } = setup();
      project.database.items.push(normalizeItemRecord({ id: "plain", name: "돌" }));
      session.inventory.plain = 1;
      expect(giveHeldItem(project, session, "plain", "m1").kind).toBe("unusable");
      expect(giveHeldItem(project, session, "h_a", undefined).kind).toBe("unusable");
      giveHeldItem(project, session, "h_a", "m1");
      session.inventory.h_a = 1;
      expect(giveHeldItem(project, session, "h_a", "m1").kind).toBe("unusable");
    });
    it("takes the item back to the bag and clears the field", () => {
      const { project, session } = setup();
      giveHeldItem(project, session, "h_a", "m1");
      expect(takeHeldItem(project, session, "m1").kind).toBe("done");
      expect("heldItemId" in session.monsterInstances.m1).toBe(false);
      expect(session.inventory.h_a).toBe(1);
      expect(takeHeldItem(project, session, "m1").kind).toBe("unusable");
    });
  });
});
