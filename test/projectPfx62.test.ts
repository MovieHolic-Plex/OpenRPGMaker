import { describe, expect, it } from "vitest";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject, TILE } from "@/project/defaults";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import { clampAgreedBuyPrice, clampAgreedSellPrice, haggleBuyFloor, haggleSellCeiling, haggleVisitKey, hash32, normalizeHaggleConfig, proposeHaggle, resolveHaggleReserve, type HaggleSetup } from "@/project/haggle";
import { advanceFarmAnimalProduction, assignFarmAnimalToBuilding, collectFarmAnimalProduct, feedFarmAnimal, petFarmAnimal } from "@/project/farmAnimals";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession, type FarmAnimalState, type PlaySession, changeParty } from "@/project/session";
import type { Project, Command, ItemRecord, LifeSkillRecord } from "@/project/types";
import { animalProject, feedItemId, productItemId, replaceAnimal } from "./fixtures/p1FarmAnimals";
import { isolateTimers } from "./mergedTeardown";
import { isPassable } from "@/project/collision";
import { preflightProjectForPlay } from "@/project/playPreflight";
import { getRelationshipState, setRelationshipState } from "@/project/relationshipState";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { createInterpreter } from "@/player/interpreter";
import { advanceRoguelikeRunFloor, resetRoguelikeRunRoom, startRoguelikeRun } from "@/project/roguelikeRun";
import { drawDamageTargetIndex } from "@/battle/enemyTargetDraw";
import { createBattleRuntime } from "@/battle/runtime";
import { floorActorExperience, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { itemAllowsBattle } from "@/project/itemUsage";
import { changeActorLevel } from "@/project/sessionActorCommands";
import { mulberry32 } from "@/util/rng";
import { resolvePricedShopStock, resolveShopBuyUnitPrice, resolveShopSellUnitPrice } from "@/project/shopPrice";
import { shouldRestock } from "@/project/shopStock";
import { deserialize, serialize } from "@/project/io";
import { normalizeLifeSkillRecord, levelForXp, MAX_LIFE_SKILL_LEVEL } from "@/project/skillModel";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { createProjectPackage, LEGACY_RPGZZU_EXTENSION, projectPackageFileName, readProjectPackage, readProjectPackageEntryNames, OPRN_EXTENSION } from "@/project/package";

describe("projectBSuite", () => {
  isolateTimers();
  // 시스템 옵트인 파사드(configure_game_systems / set_project_genre)의 저작 필드 쓰기 계약.
  // 2026-08-27 커버리지 감사: 에디터 DB 시스템 탭은 이 필드를 쓰는데 어떤 툴도 못 써서
  // 어시스턴트가 "그 기능이 없습니다"로 답하던 표면이다.
  describe("toolsGameSystemToggles", () => {
    isolateTimers();
    function context(): ToolContext {
      return { project: createBlankProject() };
    }
    function errorText(result: ToolResult): string {
      return (result.issues ?? []).map((issue) => issue.message).join(" | ");
    }
    describe("configure_game_systems", () => {
      it("battleModel gen1 을 system.battleModel 에 쓴다", () => {
        const ctx = context();
        const result = runTool(ctx, "configure_game_systems", { battleModel: "gen1" });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.battleModel).toBe("gen1");
        // 규칙과 화면은 한 쌍이다(전투 방식, 2026-10-02) — gen1 은 몬스터 대치 화면까지 맞춘다.
        expect(ctx.project.system.battleUiStyle).toBe("pokemon");
      });

      it("battleModel rm2k3 은 기본값이므로 필드를 지운다(UI 계약과 동일)", () => {
        const ctx = context();
        ctx.project.system.battleModel = "gen1";
        ctx.project.system.battleUiStyle = "pokemon";
        const result = runTool(ctx, "configure_game_systems", { battleModel: "rm2k3" });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.battleModel).toBeUndefined();
        expect(ctx.project.system.battleUiStyle).toBeUndefined();
      });

      it("giftSystem·rewardPolicy·skillSystem 을 각 필드에 쓴다", () => {
        const ctx = context();
        const result = runTool(ctx, "configure_game_systems", {
          giftSystem: true,
          rewardPolicy: { participationOnly: true, levelGapPenalty: true },
          skillSystem: { enabled: true },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.giftSystem).toBe(true);
        expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: true });
        expect(ctx.project.system.skillSystem).toEqual({ enabled: true });
      });

      it("giftSystem false 와 rewardPolicy 전부 false 는 필드를 지운다", () => {
        const ctx = context();
        ctx.project.system.giftSystem = true;
        ctx.project.system.rewardPolicy = { participationOnly: true };
        const result = runTool(ctx, "configure_game_systems", {
          giftSystem: false,
          rewardPolicy: { participationOnly: false },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.giftSystem).toBeUndefined();
        expect(ctx.project.system.rewardPolicy).toBeUndefined();
      });

      it("rewardPolicy 는 부분 패치다(주지 않은 축은 유지)", () => {
        const ctx = context();
        ctx.project.system.rewardPolicy = { participationOnly: true };
        const result = runTool(ctx, "configure_game_systems", { rewardPolicy: { levelGapPenalty: true } });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: true });
      });

      it("monsterCare 를 켜면 기본값이 채워지고, 준 값만 덮어쓴다", () => {
        const ctx = context();
        const result = runTool(ctx, "configure_game_systems", {
          monsterCare: { enabled: true, stepsPerTick: 80 },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.monsterCare).toEqual({
          stepsPerTick: 80,
          walkFriendship: 1,
          walkExp: 1,
          dailyCareCap: 30,
        });

        const second = runTool(ctx, "configure_game_systems", { monsterCare: { dailyCareCap: 60 } });
        expect(second.ok, second.summary).toBe(true);
        expect(ctx.project.system.monsterCare).toEqual({
          stepsPerTick: 80,
          walkFriendship: 1,
          walkExp: 1,
          dailyCareCap: 60,
        });
      });

      it("monsterCare enabled false 는 필드를 지운다", () => {
        const ctx = context();
        ctx.project.system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
        const result = runTool(ctx, "configure_game_systems", { monsterCare: { enabled: false } });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.monsterCare).toBeUndefined();
      });

      it("한 섹션만 준 호출은 다른 섹션을 그대로 둔다", () => {
        const ctx = context();
        const first = runTool(ctx, "configure_game_systems", {
          battleModel: "gen1",
          giftSystem: true,
          rewardPolicy: { participationOnly: true },
          monsterCare: { enabled: true, walkExp: 5 },
          skillSystem: { enabled: true },
        });
        expect(first.ok, first.summary).toBe(true);

        const second = runTool(ctx, "configure_game_systems", { skillSystem: { enabled: false } });
        expect(second.ok, second.summary).toBe(true);
        expect(ctx.project.system.skillSystem).toEqual({ enabled: false });
        expect(ctx.project.system.battleModel).toBe("gen1");
        expect(ctx.project.system.giftSystem).toBe(true);
        expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true });
        expect(ctx.project.system.monsterCare?.walkExp).toBe(5);
      });

      it("섹션을 하나도 주지 않으면 유효한 섹션 이름을 알려주며 거부한다", () => {
        const ctx = context();
        const result = runTool(ctx, "configure_game_systems", {});
        expect(result.ok).toBe(false);
        const message = errorText(result);
        for (const section of ["battleModel", "giftSystem", "rewardPolicy", "monsterCare", "skillSystem"]) {
          expect(message).toContain(section);
        }
      });

      it("battleModel 이 허용 값이 아니면 허용 값을 알려주며 거부한다", () => {
        const ctx = context();
        ctx.project.system.giftSystem = true;
        const result = runTool(ctx, "configure_game_systems", { battleModel: "gen2" });
        expect(result.ok).toBe(false);
        const message = errorText(result);
        expect(message).toContain("rm2k3");
        expect(message).toContain("gen1");
        expect(ctx.project.system.giftSystem).toBe(true);
      });

      it("monsterCare 수치는 유효 범위로 클램프한다", () => {
        const ctx = context();
        const result = runTool(ctx, "configure_game_systems", {
          monsterCare: { enabled: true, stepsPerTick: 0, walkFriendship: -5, walkExp: -1, dailyCareCap: -2 },
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.monsterCare).toEqual({
          stepsPerTick: 50,
          walkFriendship: 0,
          walkExp: 0,
          dailyCareCap: 0,
        });
      });
    });
    describe("set_project_genre", () => {
      it("기존 프로젝트의 system.genre 만 바꾼다", () => {
        const ctx = context();
        const result = runTool(ctx, "set_project_genre", { genre: "farm-life" });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.genre).toBe("farm-life");
      });

      it("reset_project 덫: 맵·이벤트·데이터베이스를 지우지 않는다", () => {
        const ctx = context();
        const before = {
          mapIds: Object.keys(ctx.project.maps).sort(),
          startMapId: ctx.project.startMapId,
          mapEventCounts: Object.fromEntries(
            Object.entries(ctx.project.maps).map(([id, map]) => [id, map.events.length]),
          ),
          commonEvents: ctx.project.commonEvents.length,
          actors: ctx.project.database.actors.length,
          items: ctx.project.database.items.length,
          skills: ctx.project.database.skills.length,
          title: ctx.project.meta.title,
        };
        expect(before.mapIds.length).toBeGreaterThan(0);
        expect(before.commonEvents + before.actors + before.items).toBeGreaterThan(0);

        const result = runTool(ctx, "set_project_genre", { genre: "monster-collect" });
        expect(result.ok, result.summary).toBe(true);

        expect(ctx.project.system.genre).toBe("monster-collect");
        expect(Object.keys(ctx.project.maps).sort()).toEqual(before.mapIds);
        expect(ctx.project.startMapId).toBe(before.startMapId);
        expect(
          Object.fromEntries(Object.entries(ctx.project.maps).map(([id, map]) => [id, map.events.length])),
        ).toEqual(before.mapEventCounts);
        expect(ctx.project.commonEvents.length).toBe(before.commonEvents);
        expect(ctx.project.database.actors.length).toBe(before.actors);
        expect(ctx.project.database.items.length).toBe(before.items);
        expect(ctx.project.database.skills.length).toBe(before.skills);
        expect(ctx.project.meta.title).toBe(before.title);
      });

      it("장르를 바꿔도 다른 옵트인 설정은 건드리지 않는다", () => {
        const ctx = context();
        ctx.project.system.giftSystem = true;
        ctx.project.system.skillSystem = { enabled: true };
        const result = runTool(ctx, "set_project_genre", { genre: "story-cutscene" });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.giftSystem).toBe(true);
        expect(ctx.project.system.skillSystem).toEqual({ enabled: true });
      });

      it("모든 GenrePackId 를 받는다", () => {
        for (const genre of GENRE_PACK_IDS) {
          const ctx = context();
          const result = runTool(ctx, "set_project_genre", { genre });
          expect(result.ok, result.summary).toBe(true);
          expect(ctx.project.system.genre).toBe(genre);
        }
      });

      it("알 수 없는 장르는 유효 장르 목록을 알려주며 거부한다", () => {
        const ctx = context();
        const result = runTool(ctx, "set_project_genre", { genre: "roguelike" });
        expect(result.ok).toBe(false);
        const message = errorText(result);
        for (const genre of GENRE_PACK_IDS) expect(message).toContain(genre);
        expect(ctx.project.system.genre).toBeUndefined();
      });
    });
  });
  describe("haggle", () => {
    isolateTimers();
    function buySetup(overrides: Partial<HaggleSetup> = {}): HaggleSetup {
      return {
        role: "playerBuys",
        reference: 200,
        reserve: 160,
        patience: 3,
        insultRatio: 0.6,
        buyPrice: 200,
        ...overrides,
      };
    }
    describe("haggle core", () => {
      it("Given / When / Then accepts a buy offer at or above reserve inside [floor, reference]", () => {
        const verdict = proposeHaggle(buySetup(), 170);
        expect(verdict).toEqual({ kind: "accept", price: 170 });
      });

      it("Given / When / Then counters then exhausts patience instead of rolling a die", () => {
        const first = proposeHaggle(buySetup({ reserve: 180 }), 165);
        expect(first.kind).toBe("counter");
        if (first.kind !== "counter") return;
        expect(first.patience).toBe(2);
        expect(first.reserve).toBeGreaterThanOrEqual(180);
        const last = proposeHaggle({ ...buySetup({ reserve: first.reserve, patience: 1 }), }, 165);
        expect(last).toEqual({ kind: "broken", reason: "exhausted" });
      });

      it("Given / When / Then breaks immediately when the offer insults the counterparty", () => {
        expect(proposeHaggle(buySetup(), 40)).toEqual({ kind: "broken", reason: "insulted" });
      });

      it("Given / When / Then keeps sell agreements inside [reference, buy-1]", () => {
        expect(haggleBuyFloor(200)).toBe(100);
        expect(haggleSellCeiling(200)).toBe(199);
        expect(clampAgreedBuyPrice(200, 90)).toBe(100);
        expect(clampAgreedSellPrice(100, 200, 250)).toBe(199);
        const sell = proposeHaggle(
          {
            role: "playerSells",
            reference: 100,
            reserve: 140,
            patience: 3,
            insultRatio: 0.6,
            buyPrice: 200,
          },
          130,
        );
        expect(sell).toEqual({ kind: "accept", price: 130 });
      });

      it("Given / When / Then the same seed tuple always yields the same reserve", () => {
        const input = {
          role: "playerBuys" as const,
          reference: 220,
          buyPrice: 220,
          maxDiscount: 0.25,
          itemId: "item_sword",
          merchantKey: "shop_a",
          dayKey: "1:spring:3",
          attemptIndex: 0,
        };
        expect(resolveHaggleReserve(input)).toBe(resolveHaggleReserve(input));
        expect(hash32("a")).toBe(hash32("a"));
        expect(haggleVisitKey("shop_a", "item_sword", "1:spring:3")).toBe("shop_a:item_sword:1:spring:3");
        expect(normalizeHaggleConfig({ patience: 99, insultRatio: 0.1, maxDiscount: 0.9 })).toEqual({
          patience: 5,
          insultRatio: 0.4,
          maxDiscount: 0.4,
        });
      });
    });
  });
  describe("p1FarmAnimals", () => {
    isolateTimers();
    describe("P1 farm-animal runtime authority", () => {
      it("assigns and moves an animal only to a compatible home with remaining capacity", () => {
        // Break caught: authored homes exist, but no runtime authority commits a valid assignment or move.
        const project = animalProject();
        const session = startSession(project, 201);

        expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop")).toEqual({
          ok: true,
          instanceId: "animal_2",
          buildingId: "coop",
          previousBuildingId: undefined,
        });
        expect(session.farmAnimals?.animal_2?.buildingId).toBe("coop");

        project.system.farmAnimalBuildings!.push({
          id: "coop_small",
          name: "Small coop",
          mapId: project.startMapId,
          x: 4,
          y: 4,
          capacity: 1,
          allowedSpeciesIds: ["chicken"],
        });
        expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop_small")).toMatchObject({
          ok: true,
          previousBuildingId: "coop",
        });
        expect(session.farmAnimals?.animal_2?.buildingId).toBe("coop_small");
      });

      it("rejects missing, incompatible, and full homes without mutating the session", () => {
        // Break caught: assignment can overfill a home or silently accept a stale home/species reference.
        const cases = [
          { buildingId: "missing", reason: "missing-building" },
          { buildingId: "barn", reason: "species-not-allowed" },
          { buildingId: "coop", reason: "building-full", capacity: 1 },
        ] as const;
        for (const entry of cases) {
          const project = animalProject();
          if (entry.capacity) {
            project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!.map((building, index) =>
              index === 0 ? { ...building, capacity: entry.capacity } : building);
          }
          const session = startSession(project, 202);
          const before = structuredClone(session);

          expect(assignFarmAnimalToBuilding(project, session, "animal_2", entry.buildingId)).toEqual({
            ok: false,
            reason: entry.reason,
            instanceId: "animal_2",
            buildingId: entry.buildingId,
          });
          expect(session).toEqual(before);
        }
      });

      it("feeds from the species item exactly once per day and debits before the receipt", () => {
        // Break caught: feed can mint a daily receipt without a valid one-item debit or repeat on one day.
        const project = animalProject();
        const session = startSession(project, 203);
        session.inventory[feedItemId(project)] = 2;

        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toEqual({
          ok: true,
          instanceId: "animal_1",
          itemId: feedItemId(project),
          dayKey: "1:spring:1",
        });
        expect(session.inventory[feedItemId(project)]).toBe(1);
        expect(session.farmAnimals?.animal_1?.lastFedDayKey).toBe("1:spring:1");

        const afterFirst = structuredClone(session);
        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
          ok: false,
          reason: "already-fed",
        });
        expect(session).toEqual(afterFirst);
      });

      it("rejects empty and unsafe feed stacks without changing inventory or animal care", () => {
        // Break caught: a malformed source stack can still stamp lastFedDayKey.
        for (const value of [0, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 1e300]) {
          const project = animalProject();
          const session = startSession(project, 204);
          session.inventory[feedItemId(project)] = value;
          const before = structuredClone(session);

          expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(false);
          expect(session).toEqual(before);
        }
      });

      it("rejects feed and pet after that day was already advanced", () => {
        // Break caught: late care consumes feed or friendship after the production cursor closed the day.
        const project = animalProject();
        const session = startSession(project, 213);
        session.inventory[feedItemId(project)] = 1;
        replaceAnimal(session, "animal_1", { lastAdvancedDayKey: "1:spring:1" });
        const before = structuredClone(session);

        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
          ok: false,
          reason: "already-advanced",
        });
        expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
          ok: false,
          reason: "already-advanced",
        });
        expect(session).toEqual(before);
      });

      it("pets exactly once per day and caps friendship", () => {
        // Break caught: repeated petting exceeds the daily receipt or friendship maximum.
        const project = animalProject();
        const session = startSession(project, 205);
        replaceAnimal(session, "animal_1", { friendship: 995 });

        expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toEqual({
          ok: true,
          instanceId: "animal_1",
          dayKey: "1:spring:1",
          friendship: 1_000,
          gained: 5,
        });
        const afterFirst = structuredClone(session);
        expect(petFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
          ok: false,
          reason: "already-petted",
        });
        expect(session).toEqual(afterFirst);
      });

      it("advances cared animals on species cadence and never advances one day twice", () => {
        // Break caught: daily advancement ignores care/cadence or duplicates ready products on retry.
        const project = animalProject();
        const session = startSession(project, 206);
        replaceAnimal(session, "animal_1", {
          lastFedDayKey: "1:spring:1",
          lastPettedDayKey: "1:spring:1",
        });

        expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toEqual({
          ok: true,
          dayKey: "1:spring:1",
          advancedInstanceIds: ["animal_1", "animal_2"],
          products: [],
        });
        expect(session.farmAnimals?.animal_1).toMatchObject({
          productionProgress: 1,
          readyProductCount: 0,
          lastAdvancedDayKey: "1:spring:1",
        });
        const afterFirst = structuredClone(session);
        expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
          ok: false,
          reason: "already-advanced",
        });
        expect(session).toEqual(afterFirst);

        replaceAnimal(session, "animal_1", {
          lastFedDayKey: "1:spring:2",
          lastPettedDayKey: "1:spring:2",
        });
        expect(advanceFarmAnimalProduction(project, session, "1:spring:2")).toEqual({
          ok: true,
          dayKey: "1:spring:2",
          advancedInstanceIds: ["animal_1", "animal_2"],
          products: [{ instanceId: "animal_1", itemId: productItemId(project), count: 2 }],
        });
        expect(session.farmAnimals?.animal_1).toMatchObject({
          productionProgress: 0,
          readyProductCount: 2,
          lastAdvancedDayKey: "1:spring:2",
        });
      });

      it("requires both feed and pet receipts for production progress", () => {
        // Break caught: partial daily care produces an item despite the missing care receipt.
        const cases: Array<Partial<FarmAnimalState>> = [
          { lastFedDayKey: "1:spring:1" },
          { lastPettedDayKey: "1:spring:1" },
          {},
        ];
        for (const care of cases) {
          const project = animalProject();
          const session = startSession(project, 207);
          replaceAnimal(session, "animal_1", care);

          expect(advanceFarmAnimalProduction(project, session, "1:spring:1").ok).toBe(true);
          expect(session.farmAnimals?.animal_1).toMatchObject({
            productionProgress: 0,
            readyProductCount: 0,
            lastAdvancedDayKey: "1:spring:1",
          });
        }
      });

      it("preflights production overflow for the entire daily batch", () => {
        // Break caught: one overflowing animal leaves other animals partially advanced.
        const project = animalProject();
        const session = startSession(project, 208);
        replaceAnimal(session, "animal_1", {
          productionProgress: 1,
          readyProductCount: ITEM_QUANTITY_MAX - 1,
          lastFedDayKey: "1:spring:1",
          lastPettedDayKey: "1:spring:1",
        });
        const before = structuredClone(session);

        expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
          ok: false,
          reason: "product-overflow",
          instanceId: "animal_1",
        });
        expect(session).toEqual(before);
      });

      it("rejects future care receipts when advancing an older day", () => {
        // Break caught: a poisoned future receipt is silently consumed as an uncared earlier day.
        const project = animalProject();
        const session = startSession(project, 214);
        replaceAnimal(session, "animal_1", {
          lastFedDayKey: "1:spring:2",
          lastPettedDayKey: "1:spring:2",
        });
        const before = structuredClone(session);

        expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toMatchObject({
          ok: false,
          reason: "invalid-day-key",
          instanceId: "animal_1",
        });
        expect(session).toEqual(before);
      });

      it("collects all ready products with inventory and ready count committed together", () => {
        // Break caught: collection clears ready products before detecting a full inventory.
        const project = animalProject();
        const session = startSession(project, 209);
        session.inventory[productItemId(project)] = 4;
        replaceAnimal(session, "animal_1", { readyProductCount: 3 });

        expect(collectFarmAnimalProduct(project, session, "animal_1")).toEqual({
          ok: true,
          instanceId: "animal_1",
          itemId: productItemId(project),
          count: 3,
        });
        expect(session.inventory[productItemId(project)]).toBe(7);
        expect(session.farmAnimals?.animal_1?.readyProductCount).toBe(0);
      });

      it("rejects collection overflow without consuming ready products", () => {
        // Break caught: inventory overflow loses an animal's accumulated products.
        const project = animalProject();
        const session = startSession(project, 210);
        session.inventory[productItemId(project)] = ITEM_QUANTITY_MAX - 2;
        replaceAnimal(session, "animal_1", { readyProductCount: 3 });
        const before = structuredClone(session);

        expect(collectFarmAnimalProduct(project, session, "animal_1")).toMatchObject({
          ok: false,
          reason: "inventory-overflow",
        });
        expect(session).toEqual(before);
      });

      it("fails closed on unknown references, duplicate instances, and unsafe state", () => {
        // Break caught: poisoned live animal rows bypass later capacity/care/product validation.
        const cases: Array<(project: Project, session: PlaySession) => unknown> = [
          (_project, session) => {
            replaceAnimal(session, "animal_1", { speciesId: "missing_species" });
            return session;
          },
          (_project, session) => {
            replaceAnimal(session, "animal_1", { buildingId: "missing_home" });
            return session;
          },
          (_project, session) => {
            session.farmAnimals!.alias = { ...session.farmAnimals!.animal_1! };
            return session;
          },
          (_project, session) => {
            replaceAnimal(session, "animal_1", { productionProgress: 1e300 });
            return session;
          },
        ];
        for (const poison of cases) {
          const project = animalProject();
          const session = startSession(project, 211);
          poison(project, session);
          const before = structuredClone(session);

          expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(false);
          expect(session).toEqual(before);
        }
      });

      it("returns invalid-state instead of throwing for malformed animal containers and rows", () => {
        // Break caught: non-record live session payloads crash the daily authority or pass as an empty herd.
        const cases: unknown[] = [[], { animal_1: null }, { animal_1: 7 }];
        for (const value of cases) {
          const project = animalProject();
          const session = startSession(project, 216);
          session.farmAnimals = value as PlaySession["farmAnimals"];
          const before = structuredClone(session);
          let result: ReturnType<typeof advanceFarmAnimalProduction> | undefined;

          expect(() => { result = advanceFarmAnimalProduction(project, session, "1:spring:1"); }).not.toThrow();
          expect(result).toMatchObject({
            ok: false,
            reason: "invalid-state",
          });
          expect(session).toEqual(before);
        }
      });

      it("fails closed when authored feed or product item references are stale", () => {
        // Break caught: missing item definitions allow feed receipts or product loss to commit.
        const project = animalProject();
        const session = startSession(project, 215);
        session.inventory[feedItemId(project)] = 1;
        replaceAnimal(session, "animal_1", { readyProductCount: 1 });
        const before = structuredClone(session);
        project.database.farmAnimalSpecies = project.database.farmAnimalSpecies!.map((species) =>
          species.id === "chicken"
            ? { ...species, feedItemId: "missing_feed", productItemId: "missing_product" }
            : species);

        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1")).toMatchObject({
          ok: false,
          reason: "invalid-definition",
        });
        expect(collectFarmAnimalProduct(project, session, "animal_1")).toMatchObject({
          ok: false,
          reason: "invalid-definition",
        });
        expect(session).toEqual(before);
      });

      it("treats authored empty animal arrays as a compatible no-op package", () => {
        // Break caught: legacy/empty optional arrays crash daily advancement or invent session animals.
        const project = createBlankProject();
        project.database.farmAnimalSpecies = [];
        project.system.farmAnimalBuildings = [];
        project.session.farmAnimals = [];
        const session = startSession(project, 212);

        expect(session.farmAnimals).toEqual({});
        expect(advanceFarmAnimalProduction(project, session, "1:spring:1")).toEqual({
          ok: true,
          dayKey: "1:spring:1",
          advancedInstanceIds: [],
          products: [],
        });
      });
    });
  });
});

describe("projectBSuite3", () => {
  isolateTimers();
  // test/playPreflight.test.ts
  // 플레이 부팅 전 프로젝트 예비검사(순수) — 수리 코드별 1건, 차단 코드별 1건,
  // 건강한 프로젝트 무수리 통과, 입력 불변성.
  describe("playPreflight", () => {
    isolateTimers();
    function codes(list: readonly { code: string }[]): string[] {
      return list.map((entry) => entry.code);
    }
    describe("preflightProjectForPlay", () => {
      it("건강한 프로젝트는 수리도 차단도 없이 통과한다", () => {
        const project = createBlankProject();
        const result = preflightProjectForPlay(project);
        expect(result.repairs).toEqual([]);
        expect(result.blockers).toEqual([]);
        expect(result.project.startMapId).toBe(project.startMapId);
      });

      it("입력 프로젝트를 변형하지 않는다", () => {
        const project = createBlankProject();
        project.startMapId = "map_gone";
        project.session = { ...project.session, partyActorIds: [] };
        const before = JSON.stringify(project);
        preflightProjectForPlay(project);
        expect(JSON.stringify(project)).toBe(before);
      });

      it("없는 시작 맵은 맵 트리 루트로 재배선한다 (start-map-missing)", () => {
        const project = createBlankProject();
        const rootMapId = project.mapTree.mapId;
        project.startMapId = "map_gone";
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("start-map-missing");
        expect(result.project.startMapId).toBe(rootMapId);
        expect(result.blockers).toEqual([]);
      });

      it("시작 맵의 타일셋이 없으면 있는 타일셋으로 대체한다 (start-map-tileset-missing)", () => {
        const project = createBlankProject();
        const startMap = project.maps[project.startMapId]!;
        startMap.tilesetId = "tileset_gone";
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("start-map-tileset-missing");
        const repaired = result.project.maps[result.project.startMapId]!;
        expect(Object.keys(result.project.tilesets)).toContain(repaired.tilesetId);
      });

      it("빈 파티는 첫 액터로 채운다 (party-empty)", () => {
        const project = createBlankProject();
        project.session = { ...project.session, partyActorIds: [] };
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("party-empty");
        expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
      });

      it("존재하지 않는 파티 액터 id 도 첫 액터로 되돌린다 (party-empty)", () => {
        const project = createBlankProject();
        project.session = { ...project.session, partyActorIds: ["actor_gone"] };
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("party-empty");
        expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
      });

      it("맵 밖 시작 좌표는 통행 가능한 칸으로 옮긴다 (start-position-unreachable)", () => {
        const project = createBlankProject();
        project.startPos = { x: 999, y: 999 };
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("start-position-unreachable");
        const map = result.project.maps[result.project.startMapId]!;
        const pos = result.project.startPos;
        expect(isPassable(result.project, map, pos.x, pos.y)).toBe(true);
      });

      it("통행 불가 타일 위 시작 좌표는 가장 가까운 통행 가능 칸으로 옮긴다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        project.startPos = { x: 5, y: 5 };
        map.lowerTiles[5 * map.width + 5] = TILE.WATER;
        map.upperTiles[5 * map.width + 5] = TILE.EMPTY;
        const result = preflightProjectForPlay(project);
        expect(codes(result.repairs)).toContain("start-position-unreachable");
        const repairedMap = result.project.maps[result.project.startMapId]!;
        const pos = result.project.startPos;
        expect(isPassable(result.project, repairedMap, pos.x, pos.y)).toBe(true);
        const distance = Math.max(Math.abs(pos.x - 5), Math.abs(pos.y - 5));
        expect(distance).toBe(1);
      });

      it("startOverride 좌표도 같은 규칙으로 검증·수리한다", () => {
        const project = createBlankProject();
        const result = preflightProjectForPlay(project, { mapId: project.startMapId, x: -3, y: 40 });
        expect(codes(result.repairs)).toContain("start-position-unreachable");
        const map = result.project.maps[result.project.startMapId]!;
        expect(isPassable(result.project, map, result.project.startPos.x, result.project.startPos.y)).toBe(true);
      });

      it("startOverride 의 맵이 없으면 시작 맵을 재배선한다", () => {
        const project = createBlankProject();
        const result = preflightProjectForPlay(project, { mapId: "map_gone", x: 1, y: 1 });
        expect(codes(result.repairs)).toContain("start-map-missing");
        expect(result.project.maps[result.project.startMapId]).toBeTruthy();
      });

      it("맵이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-maps)", () => {
        const project = createBlankProject();
        const broken: Project = { ...project, maps: {}, mapTree: { mapId: "", children: [] } };
        const result = preflightProjectForPlay(broken);
        expect(codes(result.blockers)).toContain("no-maps");
        expect(result.blockers[0]!.detail.length).toBeGreaterThan(0);
      });

      it("타일셋이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-tilesets)", () => {
        const project = createBlankProject();
        const broken: Project = { ...project, tilesets: {} };
        const result = preflightProjectForPlay(broken);
        expect(codes(result.blockers)).toContain("no-tilesets");
      });

      it("액터가 하나도 없어도 던지지 않는다", () => {
        const project = createBlankProject();
        const broken: Project = {
          ...project,
          database: { ...project.database, actors: [] },
          session: { ...project.session, partyActorIds: [] },
        };
        expect(() => preflightProjectForPlay(broken)).not.toThrow();
      });
    });
  });
  describe("relationshipPersistence", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    /* 이 스위트는 반드시 saveToSlot → readSaveSlot 을 지나야 한다. createSaveSnapshot 을
       applySaveSnapshot 에 바로 넘기면 알려진 필드만 고르는 JSON 파서를 건너뛰어서,
       네 경계 중 파서만 빠뜨린 결함을 잡지 못한다. */
    describe("관계 상태 세이브 왕복", () => {
      it("네 경계를 모두 지나 살아남는다", () => {
        const project = createBlankProject();
        const storage = new MemoryStorage();
        const session = startSession(project);
        setRelationshipState(session, "npc_ha", "engaged");
        setRelationshipState(session, "npc_yu", "married");

        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") return;

        const restored = applySaveSnapshot(project, read.snapshot);
        expect(getRelationshipState(restored, "npc_ha")).toBe("engaged");
        expect(getRelationshipState(restored, "npc_yu")).toBe("married");
      });

      it("관계가 없는 낡은 세이브는 관계 없음으로 열린다", () => {
        const project = createBlankProject();
        const storage = new MemoryStorage();
        const snapshot = createSaveSnapshot(project, startSession(project));
        const legacy = {
          ...snapshot,
          session: Object.fromEntries(
            Object.entries(snapshot.session).filter(([key]) => key !== "relationships")
          ),
        } as typeof snapshot;
        expect("relationships" in legacy.session).toBe(false);

        saveToSlot(storage, 2, legacy);
        const read = readSaveSlot(storage, 2);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") return;

        const restored = applySaveSnapshot(project, read.snapshot);
        expect(getRelationshipState(restored, "npc_ha")).toBe("single");
      });

      it("열거 밖 값이 든 세이브는 그 항목만 버린다", () => {
        const project = createBlankProject();
        const storage = new MemoryStorage();
        const snapshot = createSaveSnapshot(project, startSession(project));
        const hostile = {
          ...snapshot,
          session: { ...snapshot.session, relationships: { npc_ha: "maried", npc_yu: "dating" } },
        } as unknown as typeof snapshot;

        saveToSlot(storage, 3, hostile);
        const read = readSaveSlot(storage, 3);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") return;

        const restored = applySaveSnapshot(project, read.snapshot);
        expect(getRelationshipState(restored, "npc_ha")).toBe("single");
        expect(getRelationshipState(restored, "npc_yu")).toBe("dating");
      });
    });
  });
  describe("roguelikeRun", () => {
    isolateTimers();
    type ExpectedRunState = {
      readonly version: 1;
      readonly runId: string;
      readonly seed: number;
      readonly floor: number;
      readonly status: "active" | "completed" | "failed" | "abandoned";
      readonly flags: Record<string, boolean>;
      readonly roomResetCounts: Record<string, number>;
      readonly roomEventGenerationKeys: Record<string, string>;
    };
    type SessionWithRun = PlaySession & { roguelikeRun?: ExpectedRunState };
    function asCommand(value: unknown): Command {
      return value as Command;
    }
    describe("roguelike run lifecycle", () => {
      it("executes start, flag, floor advance, run condition, and completion in one real event flow", () => {
        // Break named: an unknown runControl command currently terminates the interpreter without creating run state.
        const project = createBlankProject();
        const session = startSession(project, 99) as SessionWithRun;
        const commands = [
          asCommand({ kind: "runControl", action: "start", seed: 123, startFloor: 2 }),
          asCommand({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true }),
          asCommand({ kind: "runControl", action: "advance", amount: 2 }),
          asCommand({
            kind: "fork",
            condition: { kind: "run", query: "floor", op: ">=", value: 4 },
            then: [{ kind: "setSwitch", switchId: project.switches[0]!.id, value: true }],
          }),
          asCommand({ kind: "runControl", action: "end", result: "completed" }),
        ];

        expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
        expect(session.roguelikeRun).toEqual({
          version: 1,
          runId: "run-0000007b",
          seed: 123,
          floor: 4,
          status: "completed",
          flags: { bossDoor: true },
          roomResetCounts: {},
          roomEventGenerationKeys: {},
        });
        expect(session.switches[project.switches[0]!.id]).toBe(true);
      });

      it("preserves active run state through a save snapshot roundtrip", () => {
        // Break named: createSaveSnapshot omits run state, so applying the snapshot loses the active run.
        const project = createBlankProject();
        const session = startSession(project) as SessionWithRun;
        session.roguelikeRun = {
          version: 1,
          runId: "run-save",
          seed: 0xffff_ffff,
          floor: 7,
          status: "active",
          flags: { treasureTaken: true },
          roomResetCounts: { room_a: 2 },
          roomEventGenerationKeys: { map_blank_start: "run-save:4294967295:7:room_a:2" },
        };

        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session)) as SessionWithRun;

        expect(restored.roguelikeRun).toEqual(session.roguelikeRun);
      });

      it("loads legacy version-one run saves without event generation markers", () => {
        const project = createBlankProject();
        const session = startSession(project);
        startRoguelikeRun(session, { seed: 5 });
        const snapshot = createSaveSnapshot(project, session);
        const legacyRun = snapshot.session.roguelikeRun as unknown as Record<string, unknown>;
        delete legacyRun.roomEventGenerationKeys;

        expect(applySaveSnapshot(project, snapshot).roguelikeRun?.roomEventGenerationKeys).toEqual({});
      });

      it("treats advance as forward-only and records the current room id on reset", () => {
        const host: SessionWithRun = startSession(createBlankProject()) as SessionWithRun;
        startRoguelikeRun(host, { seed: 7, startFloor: 3 });

        expect(advanceRoguelikeRunFloor(host, -5)).toBe(true);
        expect(host.roguelikeRun?.floor).toBe(4);
        expect(resetRoguelikeRunRoom(host, " room-a ")).toBe(true);
        expect(host.roguelikeRun?.currentRoomId).toBe("room-a");
        expect(host.roguelikeRun?.roomResetCounts).toEqual({ "room-a": 1 });
      });
    });
  });
  // fs2 스웜 R2 ultrabrain 판정(엔진): 적 피해 대상 추첨 · 전투 부활약 · 레벨 EXP 바닥.
  describe("fs2SwarmR2Engine", () => {
    isolateTimers();
    function counting(seed: number) {
      const inner = mulberry32(seed);
      const rng = () => { rng.calls += 1; return inner(); };
      rng.calls = 0;
      return rng;
    }
    describe("enemy damage target draw", () => {
      const tank = { score: 30, expected: 20, hp: 200 };
      const mage = { score: 32, expected: 22, hp: 150 };

      it("spreads hits instead of always picking the top score", () => {
        const rng = counting(7);
        const hits = [0, 0];
        for (let i = 0; i < 2000; i += 1) hits[drawDamageTargetIndex([tank, mage], rng)]! += 1;
        expect(hits[0]).toBeGreaterThan(600);
        expect(hits[1]).toBeGreaterThan(hits[0]!);
      });

      it("gives every candidate with expected damage at least a 15% share", () => {
        const weak = { score: 1, expected: 1, hp: 300 };
        const rng = counting(3);
        let weakHits = 0;
        for (let i = 0; i < 4000; i += 1) if (drawDamageTargetIndex([weak, mage], rng) === 0) weakHits += 1;
        expect(weakHits / 4000).toBeGreaterThan(0.12);
        expect(weakHits / 4000).toBeLessThan(0.18);
      });

      it("takes a lethal target deterministically and skips the rng for a single or lethal pick", () => {
        const rng = counting(1);
        const dying = { score: 1010, expected: 20, hp: 5 };
        expect(drawDamageTargetIndex([tank, dying, mage], rng)).toBe(1);
        expect(drawDamageTargetIndex([mage], rng)).toBe(0);
        expect(rng.calls).toBe(0);
      });
    });
    describe("revive items in battle", () => {
      const phoenix = { id: "phoenix", name: "피닉스", type: "medicine", occasion: "always", onlyEffectiveOnDeadActors: true,
        hpRecovery: { flat: 0, percentMax: 50 }, mpRecovery: { flat: 0, percentMax: 0 }, scope: "ally" } as unknown as ItemRecord;

      it("allows a battle/always revive item", () => {
        expect(itemAllowsBattle(phoenix)).toBe(true);
        expect(itemAllowsBattle({ ...phoenix, occasion: "menu" } as ItemRecord)).toBe(false);
      });

      it("offers only downed allies as targets", () => {
        const project = createBlankProject();
        for (const enemy of project.database.enemies) enemy.stats.agility = 1;
        const base = project.database.actors[0]!;
        project.database.actors.push({ ...base, id: "actor_second", name: "둘째" });
        project.database.items.push(normalizeItemRecord({ ...phoenix, consumable: true } as never));
        const session = startSession(project);
        changeParty(session, "actor_second", "add", project);
        session.actorVitals.actor_second = { ...session.actorVitals.actor_second!, hp: 0 };
        session.inventory.phoenix = 2;
        const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, sessionState: session, canEscape: true, canLose: true, rng: () => 0.5,
          party: { levels: session.actorLevels, experience: session.actorExperience, vitals: session.actorVitals, partyActorIds: session.partyActorIds } });
        try {
          for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i++) runtime.tick(100);
          expect(runtime.snapshot().phase).toBe("actorCommand");
          runtime.beginActorCommand({ kind: "item", itemId: "phoenix" });
          const downed = runtime.snapshot().actors.find((actor) => actor.recordId === "actor_second")!;
          const selection = runtime.snapshot().targetSelection;
          if (selection) {
            expect(selection.targetIds).toEqual([downed.id]);
            runtime.selectTarget(downed.id);
          }
          expect(runtime.snapshot().actors.find((actor) => actor.recordId === "actor_second")!.hp).toBeGreaterThan(0);
        } finally { runtime.cancel(); }
      });
    });
    describe("EXP follows the level floor", () => {
      function floorOf(project: ReturnType<typeof createBlankProject>, actorId: string, level: number) {
        return totalExpForLevel(normalizeActorRecord(project.database.actors.find((a) => a.id === actorId)!).expCurve, level);
      }

      it("starts, levels and joins at the level floor", () => {
        const project = createBlankProject();
        const actorId = project.startState?.partyActorIds?.[0] ?? project.database.actors[0]!.id;
        project.database.actors = project.database.actors.map((a) => (a.id === actorId ? { ...a, initialLevel: 14 } : a));
        const session = startSession(project);
        expect(session.actorExperience[actorId]).toBe(floorOf(project, actorId, 14));
        changeActorLevel(session, { kind: "changeLevel", actorId, op: "=", amount: 20 } as never, project);
        expect(session.actorExperience[actorId]).toBe(floorOf(project, actorId, 20));
        const second = { ...project.database.actors[0]!, id: "actor_join", initialLevel: 9 };
        project.database.actors.push(second);
        changeParty(session, "actor_join", "add", project);
        expect(session.actorExperience.actor_join).toBe(floorOf(project, "actor_join", 9));
      });

      it("raises an old save's zero EXP to the floor on load but never lowers it", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const actorId = session.partyActorIds[0]!;
        session.actorLevels[actorId] = 12;
        session.actorExperience[actorId] = 0;
        const loaded = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(loaded.actorExperience[actorId]).toBe(floorOf(project, actorId, 12));
        const rich = { actorLevels: { [actorId]: 12 }, actorExperience: { [actorId]: 999_999 } };
        floorActorExperience(project, rich, actorId);
        expect(rich.actorExperience[actorId]).toBe(999_999);
      });
    });
  });
  describe("shopPrice", () => {
    isolateTimers();
    function shop(overrides: Partial<Extract<Command, { kind: "shop" }>> = {}): Extract<Command, { kind: "shop" }> {
      return {
        kind: "shop",
        itemIds: ["item_potion"],
        ...overrides,
      };
    }
    describe("shop price unification", () => {
      it("uses the equipment database price when stock has no override", () => {
        const project = createBlankProject();
        const equipment = { ...project.database.equipment[0], id: "equipment_price_test", price: 40 };
        project.database.equipment = [equipment];
        expect(resolvePricedShopStock(project, {}, shop({ itemIds: [equipment.id] }))).toEqual([
          { itemId: equipment.id, price: 40 },
        ]);
      });

      it("keeps equipment discount floors and explicit seasonal price priority", () => {
        const project = createBlankProject();
        project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
        const id = "equipment_price_test";
        const session = { gameTime: { minute: 0, hour: 21, day: 1, season: "spring" as const, year: 1 }, shopLoyaltySpend: { global: 60000 } };
        expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 10)).toBe(20);
        project.system.timeSystem = { ...project.system.timeSystem, enabled: true };
        expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: id, priceOverride: 60 }] }))[0]?.price).toBe(60);
        expect(resolvePricedShopStock(project, { gameTime: session.gameTime }, shop({ stock: [{ itemId: id, priceOverride: 60, priceBySeason: { spring: 80 } }] }))[0]?.price).toBe(80);
        expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 40)).toBe(30);
      });

      it("preserves zero prices and item-first lookup for duplicate ids", () => {
        const project = createBlankProject();
        project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 0 }];
        expect(resolvePricedShopStock(project, {}, shop({ itemIds: ["equipment_price_test"] }))[0]?.price).toBe(0);
        project.database.items = [{ ...project.database.items[0], id: "equipment_price_test", price: 0 }];
        project.database.equipment[0].price = 40;
        expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: "equipment_price_test", priceOverride: 0 }] }))[0]?.price).toBe(0);
      });

      it("applies the social discount to equipment without an override", () => {
        const project = createBlankProject();
        project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
        expect(resolvePricedShopStock(project, { friendship: { merchant: 100 } }, shop({ itemIds: ["equipment_price_test"] }), {
          id: "merchant", characterId: "merchant", socialShop: { minFriendship: 10, priceMultiplier: 0.75 },
        })).toEqual([{ itemId: "equipment_price_test", price: 30 }]);
      });

      it("Given / When / Then loyalty and closing sale never break sell < buy", () => {
        const project = createBlankProject();
        project.database.items = [{
          ...(project.database.items[0] ?? {
            id: "item_potion",
            name: "회복약",
            description: "",
            type: "medicine",
            scope: "ally",
            occasion: "always",
            consumable: true,
            stateEffects: [],
            consumptionLimit: "noLimit",
            usableActorIds: [],
            usableClassIds: [],
            healStateIds: [],
            hpRecovery: { flat: 0, percentMax: 0 },
            mpRecovery: { flat: 0, percentMax: 0 },
            onlyUsableInMenu: false,
            onlyEffectiveOnDeadActors: false,
            usageMessage: "normal",
            occasionField: true,
            occasionBattle: true,
            seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 },
            equipmentProfile: { equipable: false },
          }),
          id: "item_potion",
          price: 200,
        }];
        const buy = resolveShopBuyUnitPrice(
          project,
          {
            shopLoyaltySpend: { global: 60000 },
            gameTime: { minute: 0, hour: 21, day: 1, season: "spring", year: 1 },
          },
          shop({ economy: { closingSaleEnabled: true } }),
          "item_potion",
          200,
        );
        const sell = resolveShopSellUnitPrice(project, "item_potion", 200);
        expect(buy).toBeGreaterThanOrEqual(100);
        expect(sell).toBeLessThan(buy);
      });

      it("Given / When / Then weekly restock ignores same-week day changes", () => {
        expect(shouldRestock("daily", "1:spring:1", "1:spring:2")).toBe(true);
        expect(shouldRestock("weekly", "1:spring:1", "1:spring:6")).toBe(false);
        expect(shouldRestock("weekly", "1:spring:1", "1:spring:8")).toBe(true);
        expect(shouldRestock("onDemand", undefined, "1:spring:1")).toBe(false);
      });
    });
  });
  describe("skillSystem", () => {
    isolateTimers();
    function roundTrip(project: Project): Project {
      return deserialize(serialize(project));
    }
    function projectWithFarmingSkill(): Project {
      const project = createBlankProject();
      project.database.lifeSkills = [
        { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_farming_lv2" }] },
      ];
      project.switches.push({ id: "sw_farming_lv2", name: "농사 레벨 2" });
      return project;
    }
    function runLifeSkillExp(project: Project, session: PlaySession, amount: number): void {
      const interpreter = createInterpreter(
        [{ kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount }],
        session,
        project
      );
      interpreter.start();
    }
    describe("생활 스킬 시스템", () => {
      // 회귀: normalizeSystemRecords 가 화이트리스트 방식이라 skillSystem 이 목록에 없으면
      // 사용자가 켠 플래그가 저장/로드 1회 왕복에 조용히 사라졌다.
      it("skillSystem 플래그가 저장/로드 왕복에서 보존된다", () => {
        const project = createBlankProject();
        project.system.skillSystem = { enabled: true };
        expect(roundTrip(project).system.skillSystem?.enabled).toBe(true);
      });

      it("skillSystem 미설정이면 JSON 에 생략된다(기본 계약)", () => {
        expect(roundTrip(createBlankProject()).system.skillSystem).toBeUndefined();
      });

      it("lifeSkills 레코드가 저장/로드 왕복에서 정규화되어 보존된다", () => {
        const project = createBlankProject();
        project.database.lifeSkills = [
          { id: "skill_farming", name: "  농사  ", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_lv2" }] },
        ];
        project.switches.push({ id: "sw_lv2", name: "농사 레벨 2" });
        expect(roundTrip(project).database.lifeSkills?.[0]).toMatchObject({
          id: "skill_farming",
          name: "농사",
          skillType: "farming",
          maxLevel: 10,
        });
      });

      it("잘못된 skillType 과 빈 이름은 정규화된다", () => {
        const record = normalizeLifeSkillRecord({ id: "s1", name: "   ", skillType: "alchemy" as never, maxLevel: 0 });
        expect(record.skillType).toBe("farming");
        expect(record.name).toBe("스킬");
      });

      // 회귀: maxLevel 은 1..100 으로 정규화됐지만 XP 테이블은 10단계뿐이라
      // maxLevel 50 레코드가 영원히 레벨 10 에 머물렀다(스키마/런타임 불일치).
      it("maxLevel 은 XP 곡선이 지원하는 상한을 넘지 않는다", () => {
        const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", maxLevel: 50 });
        expect(record.maxLevel).toBe(MAX_LIFE_SKILL_LEVEL);
        expect(levelForXp(999_999, record.maxLevel)).toBe(record.maxLevel);
      });

      it("도달 불가능한 레벨의 보상은 maxLevel 로 클램프된다", () => {
        const input = { id: "s1", name: "농사", maxLevel: 5, levelUpRewards: [{ level: 99, switchId: "sw_x" }] };
        const record = normalizeLifeSkillRecord(input as Partial<LifeSkillRecord> & Pick<LifeSkillRecord, "id" | "name">);
        expect(record.levelUpRewards[0]?.level).toBe(5);
      });

      it("switchId·recipeId 가 모두 없는 보상은 버려진다", () => {
        const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", levelUpRewards: [{ level: 2 }] });
        expect(record.levelUpRewards).toHaveLength(0);
      });

      it("changeLifeSkillExp 명령으로 XP를 증가시키고 레벨업 시 스위치가 켜진다", () => {
        const project = projectWithFarmingSkill();
        project.system.skillSystem = { enabled: true };
        const session = startSession(project, 1);
        runLifeSkillExp(project, session, 100);
        expect(session.lifeSkills!.skill_farming.xp).toBe(100);
        expect(session.lifeSkills!.skill_farming.level).toBe(2);
        expect(session.switches.sw_farming_lv2).toBe(true);
      });

      // 회귀: "opt-in" 이라 문서화됐지만 게이트를 읽는 코드가 없어 플래그와 무관하게 동작했다.
      it("skillSystem 이 꺼져 있으면 changeLifeSkillExp 는 아무 일도 하지 않는다", () => {
        const project = projectWithFarmingSkill();
        const session = startSession(project, 1);
        runLifeSkillExp(project, session, 100);
        expect(session.lifeSkills?.skill_farming).toBeUndefined();
        // 세션 시작 시 선언된 스위치는 false 로 초기화된다 — 켜지지 않았음을 확인.
        expect(session.switches.sw_farming_lv2).toBe(false);
      });
    });
  });
});

describe("projectPackage", () => {
  isolateTimers();
  // 패키지가 보존해야 하는 것은 "팩토리가 뱉은 원본"이 아니라 **저장 계층이 보존하는 형태**다.
  // deserialize 는 기본값 채움·마이그레이션·정규화를 거치므로(예: 리소스 없는 text 모드
  // titleGraphic 은 의미가 없어 버려진다) 원본과의 바이트 비교는 정규화까지 회귀로 잡는다.
  function persistedForm(project: Project): string {
    return serialize(deserialize(serialize(projectWithoutEventDrafts(project))));
  }
  describe("project package", () => {
    it("writes the canonical .oprn package when a project is exported", async () => {
      // Given
      const project = createBlankProject();
      project.meta.title = "Village Test";

      // When
      const file = createProjectPackage(project);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const names = await readProjectPackageEntryNames(file);
      const restored = await readProjectPackage(file);

      // Then
      expect(OPRN_EXTENSION).toBe(".oprn");
      expect(projectPackageFileName(project)).toBe("Village-Test.oprn");
      expect(Array.from(bytes.slice(0, 2)).map((byte) => String.fromCharCode(byte)).join("")).toBe("PK");
      expect(names).toContain("project.json");
      expect(names).toContain("data/database.json");
      expect(names).not.toContain("data/tilesets.json");
      expect(names).not.toContain("metadata/ai-tile-labels.json");
      expect(names).toContain(`maps/${project.startMapId}.json`);
      expect(serialize(restored)).toBe(persistedForm(project));
    }, 15_000);

    it("reads a legacy .rpgzzu package when its bytes use the supported package format", async () => {
      // Given
      const project = createBlankProject();
      project.meta.title = "Legacy Village";
      const bytes = await createProjectPackage(project).arrayBuffer();
      const legacyFile = new File([bytes], `legacy${LEGACY_RPGZZU_EXTENSION}`);

      // When
      const restored = await readProjectPackage(legacyFile);

      // Then
      expect(LEGACY_RPGZZU_EXTENSION).toBe(".rpgzzu");
      expect(serialize(restored)).toBe(persistedForm(project));
    });

    it("reloads an editor-normalized package without changing boot-critical project data", async () => {
      // Given
      const project = createBlankProject();
      project.meta.title = "Normalization Contract";
      project.assets.uploaded.asset_contract = {
        id: "asset_contract",
        name: "Contract Asset",
        kind: "picture",
        dataUrl: "data:image/png;base64,AA==",
        meta: { width: 1, height: 1 },
      };
      const uploaded = createProjectPackage(project);

      // When
      const opened = await readProjectPackage(uploaded);
      const normalized = createProjectPackage(opened);
      const reloaded = await readProjectPackage(normalized);

      // Then
      expect(reloaded.meta.title).toBe(project.meta.title);
      expect(reloaded.startMapId).toBe(project.startMapId);
      expect(Object.keys(reloaded.maps)).toHaveLength(Object.keys(project.maps).length);
      expect(reloaded.assets.uploaded).toEqual(project.assets.uploaded);
      // Two package round trips (read, write, read again) of a full blank project: 7.7-15.3 s on CI over the last 15
      // runs, against a 15 s default. One read+write round trip in this file already passes 15_000.
    }, 30_000);
  });
});
