import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { preflightProjectForPlay } from "@/project/playPreflight";
import type { Project, Command, ItemRecord, LifeSkillRecord } from "@/project/types";
import { startSession, type PlaySession, changeParty } from "@/project/session";
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
import { isolateTimers } from "./mergedTeardown";

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
