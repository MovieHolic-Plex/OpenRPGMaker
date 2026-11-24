import { describe, expect, it } from "vitest";
import { DEFAULT_ENEMY_FACTION_ID, factionAggression, factionColor, factionName, factionStance, isHittableByFaction, isProtectedFromNpcs, normalizeProjectFactions, PLAYER_FACTION_ID, resolveFactionTable, stanceBarColor, willAttackOnSight } from "@/project/factions";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { ProjectFactions, ItemRecord, TilesetDef } from "@/project/types";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep, resetFollowerTrailNearPlayer, charsetFollowerGraphic } from "@/project/followers";
import { startSession, changeParty } from "@/project/session";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isPassable } from "@/project/collision";
import { drawDamageTargetIndex } from "@/battle/enemyTargetDraw";
import { createBattleRuntime } from "@/battle/runtime";
import { floorActorExperience, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { itemAllowsBattle } from "@/project/itemUsage";
import { changeActorLevel } from "@/project/sessionActorCommands";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { mulberry32 } from "@/util/rng";
import { buildGameDesignExecution } from "@/project/gameDesignExecution";
import { gameDesignBriefContext, GAME_PRESET_IDS } from "@/project/gameDesignBrief";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";
import { interviewBrief } from "./helpers/gameDesignBrief";
import { readFileSync } from "node:fs";
import { gameOverOutcome, resolveGameOverSettings } from "@/project/cinematicSettings";
import { gameOverReferenceCounts } from "@/project/gameOverLibrary";
import { createInterpreter } from "@/player/interpreter";
import { createDefeatRecovery } from "@/player/defeatRecovery";
import { evaluateGenrePackReadiness, verifyGenrePackAssertionReceipts, type GenrePackAssertionReceipt } from "@/project/genrePackReadiness";
import { evaluateOfficialGenrePackReadiness, evaluateOfficialGenrePackReadinessMatrix, OFFICIAL_GENRE_PACK_IDS, OFFICIAL_GENRE_PACK_REQUIREMENTS, type OfficialGenrePackId } from "@/project/officialGenrePackRequirements";
import { verifyExactOfficialGenrePackIds } from "@/project/officialGenrePackIds";
import { graftSourceGeometry, uploadedGraftGeometryIn } from "@/assets/tileGrafts";
import { translateTiles } from "@/project/objectStamp";
import { clampAgreedBuyPrice, clampAgreedSellPrice, haggleBuyFloor, haggleSellCeiling, haggleVisitKey, hash32, normalizeHaggleConfig, proposeHaggle, resolveHaggleReserve, type HaggleSetup } from "@/project/haggle";
import { isolateTimers } from "./mergedTeardown";

describe("factionStance", () => {
  isolateTimers();
  const TWO_SIDES: ProjectFactions = {
    defs: [
      { id: "bandit", name: "산적", color: "#b3543f" },
      { id: "guard", name: "경비병", color: "#4f7fc0" },
    ],
    relations: [{ a: "bandit", b: "guard", stance: -1 }],
  };
  describe("faction stance table", () => {
    it("keeps legacy behaviour when no factions are authored", () => {
      const table = resolveFactionTable(undefined);
      expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
      expect(factionStance(table, DEFAULT_ENEMY_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
    });

    it("defaults unauthored pairs to neutral and same faction to ally", () => {
      const table = resolveFactionTable(TWO_SIDES);
      expect(factionStance(table, "bandit", "guard")).toBe(-1);
      expect(factionStance(table, "bandit", "bandit")).toBe(2);
      expect(factionStance(table, PLAYER_FACTION_ID, "bandit")).toBe(0);
      expect(factionStance(table, PLAYER_FACTION_ID, "guard")).toBe(0);
    });

    it("takes the more hostile direction when the authored pair disagrees", () => {
      const table = resolveFactionTable({
        defs: TWO_SIDES.defs,
        relations: [{ a: "bandit", b: "guard", stance: 1 }],
      });
      // 저작은 대칭으로 쓰지만, 행렬 자체는 방향성이라 한쪽만 적대로 손댄 데이터도 적대로 읽어야 한다.
      const asymmetric = resolveFactionTable(TWO_SIDES);
      asymmetric.stances[asymmetric.ids.indexOf("guard") * asymmetric.size + asymmetric.ids.indexOf("bandit")] = 2;
      expect(factionStance(table, "bandit", "guard")).toBe(1);
      expect(factionStance(asymmetric, "bandit", "guard")).toBe(-1);
      expect(factionStance(asymmetric, "guard", "bandit")).toBe(-1);
    });

    it("keeps the more hostile stance when the same pair is authored twice in either order", () => {
      const hostile = { a: "guard", b: "bandit", stance: -2 } as const;
      const allied = { a: "bandit", b: "guard", stance: 2 } as const;
      const rowOrders = [[hostile, allied], [allied, hostile]];

      expect(rowOrders.map((relations) => (
        factionStance(resolveFactionTable({ defs: TWO_SIDES.defs, relations }), "guard", "bandit")
      ))).toEqual([-2, -2]);
    });

    it("falls back to the reserved enemy faction for unknown ids", () => {
      const table = resolveFactionTable(TWO_SIDES);
      expect(factionStance(table, PLAYER_FACTION_ID, "typo_faction")).toBe(-1);
      expect(factionStance(table, "typo_faction", "other_typo")).toBe(2);
      expect(factionAggression(table, "typo_faction")).toBe(1);
    });

    it("lets authored defs override reserved faction metadata without adding a slot", () => {
      const table = resolveFactionTable({
        defs: [{ id: DEFAULT_ENEMY_FACTION_ID, name: "야수", color: "#123456", aggression: 2 }],
        relations: [],
      });
      expect(table.size).toBe(2);
      expect(factionName(table, DEFAULT_ENEMY_FACTION_ID)).toBe("야수");
      expect(factionColor(table, DEFAULT_ENEMY_FACTION_ID)).toBe("#123456");
      expect(factionAggression(table, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
      expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
    });

    it("clamps stance and aggression out of range", () => {
      const table = resolveFactionTable({
        defs: [{ id: "cult", name: "교단", aggression: 9 as never }],
        relations: [{ a: "cult", b: PLAYER_FACTION_ID, stance: -9 as never }],
      });
      expect(factionAggression(table, "cult")).toBe(3);
      expect(factionStance(table, "cult", PLAYER_FACTION_ID)).toBe(-2);
    });

    it("resolves the protectedFromNpcs flag per faction", () => {
      const table = resolveFactionTable({
        defs: [{ id: "villager", name: "주민", protectedFromNpcs: true }, ...TWO_SIDES.defs],
        relations: [],
      });
      expect(isProtectedFromNpcs(table, "villager")).toBe(true);
      expect(isProtectedFromNpcs(table, "bandit")).toBe(false);
      expect(isProtectedFromNpcs(table, undefined)).toBe(false);
    });
  });
  describe("willAttackOnSight", () => {
    it("gates each aggression level exactly", () => {
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 0))).toEqual([false, false, false, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 1))).toEqual([true, true, false, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 2))).toEqual([true, true, true, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 3))).toEqual([true, true, true, true, true]);
    });
  });
  describe("faction readability helpers", () => {
    it("splits hostile, neutral, and friendly bar colors", () => {
      const hostile = stanceBarColor(-1);
      const neutral = stanceBarColor(0);
      const friendly = stanceBarColor(2);
      expect(new Set([hostile, neutral, friendly]).size).toBe(3);
      expect(stanceBarColor(0.25)).toBe(neutral);
      expect(stanceBarColor(-0.25)).toBe(neutral);
      expect(stanceBarColor(-2)).toBe(hostile);
      expect(stanceBarColor(1)).toBe(friendly);
    });

    it("exempts friendly stances from stray projectiles", () => {
      expect([-2, -1, 0].map(isHittableByFaction as never)).toEqual([true, true, true]);
      expect([1, 2].map(isHittableByFaction as never)).toEqual([false, false]);
    });
  });
  describe("normalizeProjectFactions", () => {
    it("drops empty ids, duplicate ids, and relations to unknown factions", () => {
      const normalized = normalizeProjectFactions({
        defs: [
          { id: "", name: "빈 id" },
          { id: "guard", name: "경비병" },
          { id: "guard", name: "중복" },
        ],
        relations: [
          { a: "guard", b: PLAYER_FACTION_ID, stance: 1 },
          { a: "guard", b: "ghost", stance: -1 },
        ],
      });
      expect(normalized?.defs.map((def) => def.id)).toEqual(["guard"]);
      expect(normalized?.relations).toEqual([{ a: "guard", b: PLAYER_FACTION_ID, stance: 1 }]);
    });

    it("returns undefined for empty input so blank projects stay field-free", () => {
      expect(normalizeProjectFactions(undefined)).toBeUndefined();
      expect(normalizeProjectFactions({ defs: [], relations: [] })).toBeUndefined();
    });

    it("falls back to the id when a name is missing", () => {
      const normalized = normalizeProjectFactions({ defs: [{ id: "cult", name: "" }], relations: [] });
      expect(normalized?.defs[0]?.name).toBe("cult");
    });
  });
  describe("project persistence", () => {
    it("survives a serialize/deserialize roundtrip without a schema bump", () => {
      const project = createBlankProject();
      const version = project.version;
      project.factions = TWO_SIDES;
      const restored = deserialize(serialize(project));
      expect(restored.version).toBe(version);
      expect(restored.factions).toEqual(TWO_SIDES);
      expect(factionStance(resolveFactionTable(restored.factions), "bandit", "guard")).toBe(-1);
    });

    it("preserves an explicitly authored default aggression across normalization and persistence", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [{ id: "guard", name: "경비병", aggression: 1 }],
        relations: [],
      };
      const restored = deserialize(serialize(project));

      expect(restored.factions).toEqual(project.factions);
      expect(restored.factions?.defs[0]?.aggression).toBe(1);
    });

    it("normalizes malformed authored data on load instead of trusting it", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [{ id: "guard", name: "경비병" }],
        relations: [{ a: "guard", b: "ghost", stance: -1 }],
      };
      const restored = deserialize(serialize(project));
      expect(restored.factions?.relations).toEqual([]);
    });

    it("round-trips opt-in kill reputation while absence stays field-free", () => {
      const project = createBlankProject();
      project.factions = { ...TWO_SIDES, playerKillReputation: {} };
      expect(deserialize(serialize(project)).factions?.playerKillReputation).toEqual({});
      expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
    });

    it("rejects negative authored reputation weights", () => {
      const project = createBlankProject();
      project.factions = {
        ...TWO_SIDES,
        playerKillReputation: { weight: -0.5 },
      };
      expect(() => deserialize(serialize(project))).toThrow(/playerKillReputation\.weight/u);
    });

    it("keeps a blank project free of the field", () => {
      expect(createBlankProject().factions).toBeUndefined();
      expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
    });
  });
});

// J9: 문·계단으로 막 들어와 주인공 뒤 칸이 막혔으면 파티 동료를 주인공 앞·옆에 세우지 않는다.
// 예전에는 trailBehind 가 앞 칸으로 꺾어 세워서, 첫 걸음에 동료가 주인공을 뚫고 뒤로 튀었다.
describe("followerDoorEntry", () => {
  isolateTimers();
  function partyAtTopEdge() {
    // 고른 풀밭 위에서 본다 — 2026-10-07 정리 뒤 기본 시작 맵(beodeul_city)에는 막힌 칸이 섞여 있어 옆·뒤 칸 판정이 달라진다.
    const project = startOnRetiredCombinedTown(createBlankProject());
    // J9 는 간격 따르기(spaced)의 계약이다 — #3509 부터 기본은 고전 빵부스러기(breadcrumb)라 짧은 궤적에선 동료가 주인공 칸에 겹친다.
    project.system.companions = { ...project.system.companions, followMode: "spaced" };
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "미아" });
    // 맵 위 끝에서 아래를 본다 — 뒤(위)는 맵 밖, 계단으로 내려온 자리와 같다.
    session.x = 10;
    session.y = 0;
    return { project, session, map: project.maps[session.currentMapId]! };
  }
  describe("문으로 들어온 직후 동료 자리", () => {
    it("뒤가 막혔으면 앞·옆에 세우지 않고 숨겼다가 첫 걸음에 떠난 칸에 나타난다", () => {
      const { project, session, map } = partyAtTopEdge();
      resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
      expect(session.followerTrail).toEqual([]);
      const world = { project, map };
      expect(followerPositions(session, project.system.companions, world)[0]).toMatchObject({ hidden: true });

      // 첫 걸음: (10,0) 을 떠나 (10,1) 로 — 동료는 주인공이 떠난 칸에 선다(앞에서 뒤로 튀지 않는다).
      recordFollowerPlayerStep(session, { x: 10, y: 0, direction: "down" });
      session.y = 1;
      const placed = followerPositions(session, project.system.companions, world)[0]!;
      expect(placed.hidden).toBeFalsy();
      expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 0 });
    });

    it("도착하자마자 이야기 장면이 돌면 액터 동료는 옆 빈 칸에 선다", () => {
      const { project, session, map } = partyAtTopEdge();
      resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
      const placed = followerPositions(session, project.system.companions, { project, map, storyScene: true })[0]!;
      expect(placed.hidden).toBeFalsy();
      expect({ x: placed.x, y: placed.y }).not.toEqual({ x: session.x, y: session.y });
    });

    it("뒤가 열려 있으면 예전처럼 바로 뒤 칸에 선다", () => {
      const { project, session, map } = partyAtTopEdge();
      session.y = 5;
      resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
      const placed = followerPositions(session, project.system.companions, { project, map })[0]!;
      expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 4 });
    });
  });
});

describe("followersScenesOnly", () => {
  isolateTimers();
  // FF6 식 동료 표시(companions.display = "scenesOnly") — 필드에선 숨고, 이야기 장면에서만 주인공 옆에 선다.

  function fixture() {
    const project = createBlankProject();
    project.system.companions = { display: "scenesOnly" };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("map fixture missing");
    const session = startSession(project);
    // 시작 칸 타일(통행 가능)로 맵을 덮는다 — 기본 칩셋이 바뀌어도 열린 들판이 된다.
    map.lowerTiles.fill(map.lowerTiles[session.y * map.width + session.x]!);
    map.events = [];
    session.x = 6;
    session.y = 6;
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: charsetFollowerGraphic("tex_easyrpg_charset_animal", 0), name: "야옹이" });
    for (let i = 0; i < 4; i += 1) recordFollowerPlayerStep(session, { x: 2 + i, y: 6, direction: "right" });
    if (!isPassable(project, map, 5, 6)) throw new Error("fixture: 들판이 통행 불가");
    return { project, map, session };
  }
  describe("동료 표시 scenesOnly", () => {
    it("이야기 장면이 아니면 동료는 모두 숨는다(궤적이 있어도)", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, project.system.companions, { project, map, storyScene: false });
      expect(positions).toHaveLength(2);
      expect(positions.every((entry) => entry.hidden === true)).toBe(true);
    });

    it("이야기 장면이면 주인공과 겹치지 않는 인접 칸에 나란히 선다", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, project.system.companions, { project, map, storyScene: true, playerFacing: "right" });
      expect(positions.every((entry) => entry.hidden !== true)).toBe(true);
      const cells = positions.map((entry) => `${entry.x},${entry.y}`);
      expect(new Set(cells).size).toBe(cells.length);
      expect(cells).not.toContain(`${session.x},${session.y}`);
      for (const entry of positions) {
        expect(Math.abs(entry.x - session.x) + Math.abs(entry.y - session.y)).toBeLessThanOrEqual(3);
        expect(entry.direction).toBe("right");
      }
    });

    it("follow(기본)는 기존처럼 궤적을 따라 보인다", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, { display: "follow" }, { project, map, storyScene: false });
      expect(positions.some((entry) => entry.hidden !== true)).toBe(true);
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

describe("gameDesignExecution", () => {
  isolateTimers();
  describe("internal interview execution handoff", () => {
    it("derives a complete dependency graph for every saved preset without mutating the authored brief", () => {
      for (const id of GAME_PRESET_IDS) {
        const brief = interviewBrief(id);
        const original = structuredClone(brief);
        const plan = buildGameDesignExecution(brief);
        const seen = new Set<string>();
        for (const task of plan.tasks) {
          expect(seen.has(task.id)).toBe(false);
          expect(task.dependsOn.every(id => seen.has(id))).toBe(true);
          expect(task.action.length).toBeGreaterThan(0);
          expect(task.output.length).toBeGreaterThan(0);
          expect(task.acceptance.length).toBeGreaterThan(0);
          expect(task.requirements.every(slot => brief.answers[slot])).toBe(true);
          seen.add(task.id);
        }
        expect(seen.has("F03")).toBe(true);
        expect(brief).toEqual(original);
      }
    });
    it("automatically supplies model-only tasks while keeping the human display free of the contract", () => {
      const brief = interviewBrief();
      const preset = welcomeGenrePresetById(brief.presetId)!;
      const task = buildWelcomeGenrePresetPrompt(preset, brief);
      const display = welcomeGenrePresetDisplayText(preset, brief);
      expect(task).toContain('"id":"P03"');
      expect(task).toContain("검증 증거 없이 done/pass로 처리하지 않는다");
      expect(display).not.toContain('"id":"P03"');
      expect(display).not.toContain("조수 내부 제작 계약");
      expect(gameDesignBriefContext(undefined)).toBe("");
    });
    it("rebuilds from the latest edited summary, preserves recommendation provenance and scopes execution to the current request", () => {
      const brief = interviewBrief();
      brief.answers.detail.source = "recommended";
      brief.summary = "인물의 외형은 미정. 첫 대화 한 장면만 만든다.";
      const first = buildGameDesignExecution(brief);
      brief.summary = "첫 포획까지만, 공포 연출은 빼기.";
      const next = buildGameDesignExecution(brief);
      expect(first.requirements.summary).not.toEqual(next.requirements.summary);
      expect(next.requirements.summary).toBe(brief.summary);
      expect(next.requirements.answers.detail.source).toBe("recommended");
      expect(gameDesignBriefContext(brief)).toContain("읽기 전용·기획 상담·무관한 요청에서는 제작을 시작하지 않는다");
    });
  });
});

describe("gameOverLibrary", () => {
  isolateTimers();
  function fixture() {
    const p = deserialize(readFileSync(new URL("./fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
    p.system.gameOver = { title: "Legacy" };
    p.system.gameOvers = [
      { id: "caught", name: "Caught", settings: { presentation: "horror", outcome: "menu", title: "Caught", timing: { silenceMs: 1200 }, sequence: { enabled: false, skippable: false, scenes: [{ id: "last", kind: "text", narration: "Last light", durationMs: 0 }] } } },
      { id: "recover", name: "Defeated", settings: { presentation: "horror", outcome: "recover", recovery: { mapId: p.startMapId, x: 14, y: 20 } } },
      { id: "timeout", name: "Time is up", settings: { presentation: "blackout", outcome: "title", message: "Too late" } },
    ];
    p.system.defaultGameOverId = "caught";
    return p;
  }
  describe("authored game-over library", () => {
    it("round-trips all definitions and selects explicit IDs independently of the default", () => {
      const p = fixture(), restored = deserialize(serialize(p));
      expect(restored.system.gameOvers).toEqual(p.system.gameOvers);
      expect(resolveGameOverSettings(restored.system)?.title).toBe("Caught");
      expect(gameOverOutcome(resolveGameOverSettings(restored.system, "recover"))).toBe("recover");
      expect(gameOverOutcome(resolveGameOverSettings(restored.system, "timeout"))).toBe("title");
      expect(resolveGameOverSettings(restored.system, "missing")).toBeUndefined();
      delete restored.system.defaultGameOverId;
      expect(resolveGameOverSettings(restored.system)?.title).toBe("Legacy");
      expect(gameOverOutcome({ presentation: "blackout" })).toBe("recover");
    });
    it.each(["gameOver", "killPlayer"] as const)("hands %s's ID to the terminal and stops later commands", kind => {
      const p = fixture(), s = startSession(p);
      const interpreter = createInterpreter([{ kind, gameOverId: "recover" }, { kind: "setVariable", variableId: "var_lantern_shards", op: "=", value: 777 }], s, p);
      expect(interpreter.start()).toMatchObject({ kind: "gameOver", gameOverId: "recover" });
      expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
      expect(s.variables.var_lantern_shards).not.toBe(777);
      const recovered = createDefeatRecovery(p, s, resolveGameOverSettings(p.system, "recover"));
      expect(recovered).toMatchObject({ x: 14, y: 20 });
    });
    it("counts nested event references and rejects dangling IDs on load", () => {
      const p = fixture(), event = p.maps[p.startMapId].events[0];
      event.pages[0].commands = [{ kind: "gameOver", gameOverId: "caught" }];
      expect(gameOverReferenceCounts(p).get("caught")).toBeGreaterThan(0);
      p.system.gameOvers = p.system.gameOvers!.filter(row => row.id !== "caught");
      delete p.system.defaultGameOverId;
      expect(() => deserialize(serialize(p))).toThrow();
    });
    it.each([
      { defaultGameOverId: "missing" },
      { gameOvers: [{ id: "x", name: "X", settings: {} }, { id: "x", name: "Y", settings: {} }] },
      { gameOvers: [{ id: "x", name: "", settings: {} }] },
      { gameOvers: [{ id: "x", name: "X", settings: { timing: { fadeOutMs: -1 } } }] },
      { gameOvers: [{ id: "x", name: "X", settings: { musicResourceId: "missing" } }] },
    ])("rejects invalid library data %j", patch => {
      const p = fixture(); Object.assign(p.system, patch);
      expect(() => deserialize(JSON.stringify(p))).toThrow();
    });
  });
});

describe("genrePackReadiness", () => {
  isolateTimers();
  const PROJECT_REVISION = "a".repeat(64);
  const passingAssertions = (packId: OfficialGenrePackId): GenrePackAssertionReceipt<OfficialGenrePackId> => ({
    schemaVersion: 1,
    packId,
    projectRevision: PROJECT_REVISION,
    assertions: OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions.map((assertionId) => ({
      assertionId,
      status: "passed" as const,
      evidence: `evidence/${packId}/${assertionId}.json`,
    })),
  });
  describe("genre pack readiness receipts", () => {
    it("uses persisted genre ids in the exact official matrix", () => {
      expect(OFFICIAL_GENRE_PACK_IDS).toEqual([
        "adventure-jrpg",
        "monster-collect",
        "horror-chase",
        "story-cutscene",
        "farm-life",
        "action-rpg",
      ]);
    });

    it("BREAK: direct receipt verification fails closed when no evidence validator is supplied", () => {
      const result = verifyGenrePackAssertionReceipts(
        OFFICIAL_GENRE_PACK_REQUIREMENTS,
        OFFICIAL_GENRE_PACK_IDS.map(passingAssertions)
      );

      expect(result.ok).toBe(false);
      expect(result.receiptErrors).toHaveLength(OFFICIAL_GENRE_PACK_IDS.length * 4);
      expect(result.receiptErrors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          receiptIndex: 0,
          assertionId: "headless-journey",
          code: "evidence-validation-missing",
        }),
      ]));
    });

    it.each(OFFICIAL_GENRE_PACK_IDS)("fails the browser identity gate when %s is missing", (packId) => {
      const result = verifyExactOfficialGenrePackIds(OFFICIAL_GENRE_PACK_IDS.filter((id) => id !== packId));
      expect(result.ok).toBe(false);
      expect(result.missing).toContain(packId);
    });

    it("fails the browser identity gate on extra and duplicate variant ids", () => {
      const result = verifyExactOfficialGenrePackIds([...OFFICIAL_GENRE_PACK_IDS, "partner-raise", "farm-life"]);
      expect(result.ok).toBe(false);
      expect(result.extra).toContain("partner-raise");
      expect(result.duplicate).toContain("farm-life");
    });

    it.each(OFFICIAL_GENRE_PACK_IDS)("rejects screenshot-only evidence for %s", (packId) => {
      const receipts: GenrePackAssertionReceipt<OfficialGenrePackId>[] = OFFICIAL_GENRE_PACK_IDS.map(passingAssertions);
      const target = receipts.find((receipt) => receipt.packId === packId)!;
      const screenshotOnly = {
        ...target,
        assertions: [],
        screenshots: Array.from({ length: 50 }, (_, index) => `${packId}-${index}.png`),
      };
      receipts.splice(receipts.indexOf(target), 1, screenshotOnly);

      const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, receipts);

      expect(result.ok).toBe(false);
      expect(result.packs[packId].missingAssertions).toEqual(
        OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions
      );
    });

    it.each(OFFICIAL_GENRE_PACK_IDS)("fails %s when one semantic assertion fails", (packId) => {
      const receipts = OFFICIAL_GENRE_PACK_IDS.map(passingAssertions);
      const target = receipts.find((receipt) => receipt.packId === packId)!;
      target.assertions[0] = { ...target.assertions[0]!, status: "failed" };

      const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, receipts);

      expect(result.ok).toBe(false);
      expect(result.packs[packId].failedAssertions).toContain(target.assertions[0]!.assertionId);
    });

    it("computes readiness and cannot be promoted by a manual certified flag", () => {
      const requirement = OFFICIAL_GENRE_PACK_REQUIREMENTS["adventure-jrpg"];
      const receipt = evaluateGenrePackReadiness({
        requirement,
        resolveCommandSupport: () => "full",
        resolveAuthoredCommand: () => true,
        lintIssues: [],
        assertionReceipt: {
          ...passingAssertions("adventure-jrpg"),
          certified: true,
          assertions: [],
        } as GenrePackAssertionReceipt<OfficialGenrePackId> & { certified: boolean },
      });

      expect(receipt.status).toBe("blocked");
      expect(receipt.invalidReceiptReasons).toContain("invalid-receipt-schema");
    });

    it("keeps the broken monster pack blocked by actual command support even with passing assertions", () => {
      const requirement = OFFICIAL_GENRE_PACK_REQUIREMENTS["monster-collect"];
      const receipt = evaluateGenrePackReadiness({
        requirement,
        resolveCommandSupport: (commandId) => commandId === "giveMonster" ? "partial" : "full",
        resolveAuthoredCommand: () => true,
        lintIssues: [],
        assertionReceipt: passingAssertions("monster-collect"),
      });

      expect(receipt.status).toBe("blocked");
      expect(receipt.commandChecks).toContainEqual(expect.objectContaining({
        commandId: "giveMonster",
        actual: "partial",
        passed: false,
      }));
    });

    it("adapts the official monster pack to the real command registry instead of a fixture claim", () => {
      const receipt = evaluateOfficialGenrePackReadiness(
        createBlankProject(),
        "monster-collect",
        passingAssertions("monster-collect")
      );

      expect(receipt.status).toBe("blocked");
      expect(receipt.commandChecks).toEqual(expect.arrayContaining([
        expect.objectContaining({ commandId: "giveMonster", actual: "partial", passed: false }),
        expect.objectContaining({ commandId: "evolveMonster", actual: "partial", passed: false }),
      ]));
    });

    it("does not call a blank project ready from global command capability alone", () => {
      const receipt = evaluateOfficialGenrePackReadiness(
        createBlankProject(),
        "adventure-jrpg",
        passingAssertions("adventure-jrpg")
      );

      expect(receipt.status).not.toBe("ready");
    });

    it("blocks readiness when the real project lint reports broken references", () => {
      const project = createBlankProject();
      project.maps[project.startMapId]!.events.push({
        id: "ev_broken_reference",
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [{ kind: "changeItem", itemId: "item_missing", amount: 1 }],
      });

      const receipt = evaluateOfficialGenrePackReadiness(
        project,
        "adventure-jrpg",
        passingAssertions("adventure-jrpg")
      );

      expect(receipt.status).toBe("blocked");
      expect(receipt.blockingLintIssues).toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: "reference-validation" }),
      ]));
    });

    it("returns ready only when command, lint, and semantic assertion gates all pass", () => {
      const receipt = evaluateGenrePackReadiness({
        requirement: OFFICIAL_GENRE_PACK_REQUIREMENTS["adventure-jrpg"],
        resolveCommandSupport: () => "full",
        resolveAuthoredCommand: () => true,
        lintIssues: [],
        assertionReceipt: passingAssertions("adventure-jrpg"),
      });

      expect(receipt.status).toBe("ready");
    });

    it("binds a semantic receipt to the expected canonical project revision", () => {
      const result = verifyGenrePackAssertionReceipts(
        OFFICIAL_GENRE_PACK_REQUIREMENTS,
        OFFICIAL_GENRE_PACK_IDS.map(passingAssertions),
        { expectedProjectRevision: "b".repeat(64) }
      );

      expect(result.ok).toBe(false);
      expect(result.receiptErrors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "project-revision-mismatch" }),
      ]));
    });

    it("evaluates all five official packs as one matrix and keeps monster blocked", () => {
      const assertionReceipts = Object.fromEntries(
        OFFICIAL_GENRE_PACK_IDS.map((packId) => [packId, passingAssertions(packId)])
      ) as Record<OfficialGenrePackId, GenrePackAssertionReceipt<OfficialGenrePackId>>;

      const matrix = evaluateOfficialGenrePackReadinessMatrix(createBlankProject(), assertionReceipts);

      expect(Object.keys(matrix.packs).sort()).toEqual([...OFFICIAL_GENRE_PACK_IDS].sort());
      expect(matrix.ready).toBe(false);
      expect(matrix.packs["monster-collect"].status).toBe("blocked");
    });

    it("fails closed for malformed or unknown file-backed receipts", () => {
      const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, [
        ...OFFICIAL_GENRE_PACK_IDS.map(passingAssertions),
        { schemaVersion: 1, packId: "unknown-pack", projectRevision: PROJECT_REVISION, assertions: [] },
        { packId: "farm-life" },
      ]);

      expect(result.ok).toBe(false);
      expect(result.unknownPackIds).toEqual(["unknown-pack"]);
      expect(result.invalidReceiptIndexes).toEqual([OFFICIAL_GENRE_PACK_IDS.length + 1]);
    });
  });
});

describe("graftSourceGeometry", () => {
  isolateTimers();
  // 2026-10-08: 768px(48칸) 공용 기물 아틀라스를 번들 기본(30칸)으로 읽어 찍은 냉장고·진열대가 투명 칸으로 그려졌다.
  function tileset(id: string, image: TilesetDef["image"], tilesPerRow: number, count: number): TilesetDef {
    return { id, name: id, image, tileSize: 16, tilesPerRow, count, passability: [], priority: [], terrain: [] } as unknown as TilesetDef;
  }
  describe("graft source geometry for uploaded sheets", () => {
    it("records the uploaded source sheet's layout on new grafts", () => {
      const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
      const target = tileset("jp_city", { type: "bundled", id: "tex_jp_city" }, 48, 9168);
      translateTiles(source, target, [7165]);
      const graft = target.tileGrafts!.at(-1)!;
      expect(graft).toMatchObject({ sourceChipset: "shared_atlas", sourceTile: 7165, sourceTileSize: 16, sourceTilesPerRow: 48 });
      expect(graftSourceGeometry(graft)).toEqual({ tileSize: 16, tilesPerRow: 48 });
    });

    it("finds the layout of grafts saved before it was recorded", () => {
      const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
      expect(uploadedGraftGeometryIn({ shared: source }, "shared_atlas")).toEqual({ tileSize: 16, tilesPerRow: 48 });
      expect(uploadedGraftGeometryIn({ shared: source }, "tex_jp_city")).toBeNull();
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
