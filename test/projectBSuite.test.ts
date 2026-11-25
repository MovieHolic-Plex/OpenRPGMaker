import { describe, expect, it } from "vitest";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import { clampAgreedBuyPrice, clampAgreedSellPrice, haggleBuyFloor, haggleSellCeiling, haggleVisitKey, hash32, normalizeHaggleConfig, proposeHaggle, resolveHaggleReserve, type HaggleSetup } from "@/project/haggle";
import { advanceFarmAnimalProduction, assignFarmAnimalToBuilding, collectFarmAnimalProduct, feedFarmAnimal, petFarmAnimal } from "@/project/farmAnimals";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession, type FarmAnimalState, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { animalProject, feedItemId, productItemId, replaceAnimal } from "./fixtures/p1FarmAnimals";
import { isolateTimers } from "./mergedTeardown";

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
