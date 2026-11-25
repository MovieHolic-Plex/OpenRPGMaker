import { beforeEach, describe, expect, it } from "vitest";
import { resizeMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { EXTRA_LAYER_KEYS, setLayerTileAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import type { GameMap, ChaseAcrossMaps, GameEvent, Command, Project } from "@/project/types";
import { CHASE_LEGACY_SEARCH_MIN_MS } from "@/project/chaseTempo";
import { startSession } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { carryPursuitThroughDoor, pursuitTarget, toggleHiding } from "@/player/horrorRuntime";
import { parsePursuit } from "@/editor/tools/horrorBehaviorTools";
import type { AutonomousMover } from "@/player/playSceneTypes";
import { proposalCallChangedSomething } from "@/ai/proposalCompleteness";
import { summarizeChanges } from "@/editor/tools/changeset";
import { monsterContext } from "./monsterAiFixture";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { captureSuccessRate, deterministicMonsterIvs, giveMonster } from "@/project/monsterCollection";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

// 옛 맵(2층·4층·그림자 칸 없음)은 편집해도 선택 층 키가 생기지 않는다 — 설계 §2 「옛 맵과 새 맵의 JSON 이 같다」.
describe("mapLayersOldMap", () => {
  isolateTimers();
  const id = () => store.getCurrent().startMapId;
  const map = () => store.getCurrent().maps[id()];
  function expectOldShape(m: GameMap): void {
    for (const key of EXTRA_LAYER_KEYS) expect(Object.keys(m)).not.toContain(key);
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    editorState.set({ currentMapId: null, tool: "select", layer: "lower", selection: null, clipboard: null });
    expectOldShape(map());
  });
  describe("옛 맵 — 편집해도 선택 층이 생기지 않는다", () => {
    it("크기 바꾸기", () => {
      resizeMap(id(), map().width + 3, map().height + 2);
      expectOldShape(map());
      resizeMap(id(), 4, 4);
      expectOldShape(map());
    });
    it("밀기", () => {
      expect(shiftMapContent(id(), { dx: 1, dy: -1 })).toBe(true);
      expectOldShape(map());
    });
    it("옛 맵 복사본 붙여넣기", () => {
      selectTileRegion(id(), { mapId: id(), x: 0, y: 0, width: 2, height: 2 });
      expect(copySelection(id())).toBe(true);
      expect(pasteClipboard(id(), 3, 3)).toBe(true);
      expectOldShape(map());
    });
    it("영역 지우기", () => {
      selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 2, height: 2 });
      expect(clearSelectionRegion(id())).toBe(true);
      expectOldShape(map());
    });
    it("updateMapTiles 로 1층·3층 칠하기", () => {
      store.updateMapTiles(id(), (m) => { setLayerTileAt(m, 1, 0, 3); setLayerTileAt(m, 3, 1, 4); });
      expectOldShape(map());
    });
    it("resize_map 도구", () => {
      const context: ToolContext = { project: createBlankProject() };
      expect(runTool(context, "create_map", { name: "옛 맵", width: 6, height: 5, id: "map_old_shape" }).ok).toBe(true);
      expect(runTool(context, "resize_map", { mapId: "map_old_shape", width: 9, height: 7 }).ok).toBe(true);
      expectOldShape(context.project.maps.map_old_shape);
    });
  });
});

// make_hunting_ground 가 FieldSpawnDef 의 진영·발자국·킬 필드를 드롭하지 않는지.
describe("mapToolsFieldSpawn", () => {
  isolateTimers();
  function huntingContext(): { context: ToolContext; mapId: string; troopId: string; switchId: string } {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;
    const switchId = context.project.switches[0]?.id;
    if (!troopId) throw new Error("troop missing");
    if (!switchId) throw new Error("switch missing");
    return { context, mapId, troopId, switchId };
  }
  describe("make_hunting_ground field spawn contract", () => {
    it("appends a spawn that preserves factionId, persistKill, onKillSwitchId, footprint, and passRows", () => {
      const { context, mapId, troopId, switchId } = huntingContext();
      const result = runTool(context, "make_hunting_ground", {
        mapId,
        area: { x: 1, y: 1, w: 3, h: 3 },
        troopId,
        factionId: "bandit",
        persistKill: true,
        onKillSwitchId: switchId,
        footprint: { width: 2, height: 3 },
        passRows: 1,
      });
      expect(result.ok, result.summary).toBe(true);
      const spawn = context.project.maps[mapId]?.fieldSpawns?.at(-1);
      expect(spawn).toMatchObject({
        troopId,
        factionId: "bandit",
        persistKill: true,
        onKillSwitchId: switchId,
        footprint: { width: 2, height: 3 },
        passRows: 1,
      });
    });

    it("omits the five fields when the caller does not pass them", () => {
      const { context, mapId, troopId } = huntingContext();
      const result = runTool(context, "make_hunting_ground", {
        mapId,
        area: { x: 1, y: 1, w: 3, h: 3 },
        troopId,
      });
      expect(result.ok, result.summary).toBe(true);
      const spawn = context.project.maps[mapId]?.fieldSpawns?.at(-1);
      expect(spawn).toBeDefined();
      expect(spawn).not.toHaveProperty("factionId");
      expect(spawn).not.toHaveProperty("persistKill");
      expect(spawn).not.toHaveProperty("onKillSwitchId");
      expect(spawn).not.toHaveProperty("footprint");
      expect(spawn).not.toHaveProperty("passRows");
    });
  });
});

// 명작 공백 #28(2026-09-27) — 추격 포기·문 따라옴 훅(스위치). Ao Oni·Corpse Party 의 「따돌렸다」「문이 열린다」 연출.
describe("mgPursuitHooks", () => {
  isolateTimers();
  function fixture(pursuit: Partial<ChaseAcrossMaps> = {}) {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.width = 12; map.height = 12; map.lowerTiles = Array(144).fill(0); map.upperTiles = Array(144).fill(-1);
    project.tilesets[map.tilesetId]!.passability[0] = { up: true, down: true, left: true, right: true };
    const event = (id: string, x: number, y: number): GameEvent => ({ id, x, y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_page`, name: id, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }] });
    const monster = event("monster", 7, 5);
    monster.pages![0]!.movement = { type: "chase", speed: 4, frequency: 4, sightRange: 8,
      pursuit: { scope: "connected", doorDelayMs: 500, searchMs: 1000, onLost: "wait", lostSwitchId: "sw_lost", followSwitchId: "sw_follow", ...pursuit } };
    const closet = event("closet", 3, 4); closet.pages![0]!.interaction = { kind: "hiding" };
    const chair = event("chair", 8, 8); chair.pages![0]!.interaction = { kind: "pushable" };
    map.events = [monster, closet, chair];
    const next = structuredClone(map); next.id = "next"; next.events = []; project.maps.next = next;
    const session = startSession(project); session.x = 3; session.y = 5;
    const world = { project, map, session, positions: initialRuntimeEventPositions(map.events) };
    const view = (id: string) => runtimeEventViewsForMap(project, world.map, session, world.positions).find((v) => v.event.id === id)!;
    const mover = { timer: 0, moveIntervalMs: 80, moveDurationMs: 100, chaseActive: true } as AutonomousMover;
    return { world, view, mover, next };
  }
  describe("#28 추격 훅", () => {
    it("수색 시간이 다 되어 포기하면 포기 스위치를 켜고, 다시 발견하면 끈다", () => {
      const { world, view, mover } = fixture();
      expect(pursuitTarget(world, view("monster"), mover, 20)).toMatchObject({ searching: false });
      expect(world.session.switches.sw_lost ?? false).toBe(false);
      // 옷장에 숨는 것을 못 봤다 → 수색 → 포기.
      world.session.eventLocations.chair = { mapId: world.map.id, x: 4, y: 5 };
      toggleHiding(world, view("closet"));
      pursuitTarget(world, view("monster"), mover, 600);
      expect(world.session.switches.sw_lost ?? false).toBe(false);
      // 박자를 적지 않은 추격자의 수색은 CHASE_LEGACY_SEARCH_MIN_MS 아래로 내려가지 않는다(4127a63455) — 저작 searchMs 1000 보다 길다.
      expect(pursuitTarget(world, view("monster"), mover, CHASE_LEGACY_SEARCH_MIN_MS)).toBeNull();
      expect(world.session.switches.sw_lost).toBe(true);
      expect(world.session.horror!.pursuits.monster!.active).toBe(false);
      // 숨기를 풀고 다시 보이면 끈다.
      toggleHiding(world);
      world.session.eventLocations.chair = { mapId: world.map.id, x: 8, y: 8 };
      mover.chaseActive = true;
      expect(pursuitTarget(world, view("monster"), mover, 20)).toMatchObject({ searching: false });
      expect(world.session.switches.sw_lost).toBe(false);
    });

    it("문을 따라 다른 맵으로 넘어오기 시작하면 따라옴 스위치를 켠다", () => {
      const { world, view, mover, next } = fixture();
      world.session.x = 8; world.session.y = 5;
      pursuitTarget(world, view("monster"), mover, 20);
      carryPursuitThroughDoor(world, new Map([["monster", mover]]), { mapId: next.id, x: 2, y: 2 });
      expect(world.session.switches.sw_follow).toBe(true);
    });

    it("훅이 없는 옛 추격자는 스위치를 건드리지 않고, 저장 왕복·AI 도구가 훅을 보존한다", () => {
      const { world, view, mover, next } = fixture({ lostSwitchId: undefined, followSwitchId: undefined });
      const before = { ...world.session.switches };
      world.session.x = 8; world.session.y = 5;
      pursuitTarget(world, view("monster"), mover, 20);
      carryPursuitThroughDoor(world, new Map([["monster", mover]]), { mapId: next.id, x: 2, y: 2 });
      expect(world.session.switches).toEqual(before);
      const hooked = fixture();
      const loaded = deserialize(serialize(hooked.world.project));
      expect(loaded.maps[hooked.world.map.id]!.events[0]!.pages![0]!.movement.pursuit).toMatchObject({ lostSwitchId: "sw_lost", followSwitchId: "sw_follow" });
      expect(parsePursuit({ scope: "map", doorDelayMs: 0, searchMs: 100, onLost: "wait", lostSwitchId: "sw_lost" })).toEqual({ scope: "map", doorDelayMs: 0, searchMs: 100, onLost: "wait", lostSwitchId: "sw_lost" });
    });
  });
});

describe("monsterAiAccounting", () => {
  isolateTimers();
  it.each([undefined, 0, 1])("accounts for optional monster metadata changes when count is %j", count => {
    // Given an otherwise empty legacy-compatible change summary.
    const { project } = monsterContext();
    const diff = summarizeChanges(project, project);
    delete diff.monsterMetadataChanged;
    if (count !== undefined) diff.monsterMetadataChanged = count;
    // When the AI completeness consumer evaluates the change.
    const changed = proposalCallChangedSomething({ name: "metadata-edit", args: {}, result: { ok: true, diff } });
    // Then metadata-only changes count, while absence/zero stays compatible.
    expect(changed).toBe(count === 1);
  });
});

describe("monsterCampaignTitle", () => {
  isolateTimers();
  // 시각 QA D05: build_monster_game(create) 가 빈 프로젝트의 기본 이름 「새 프로젝트」를 meta.title·titleScreen.title 에 그대로 남겼다.
  async function create(configure: (p: ReturnType<typeof createBlankProject>) => void, args: Record<string, unknown> = {}) {
    const project = createBlankProject();
    configure(project);
    const context = { project, currentMapId: project.startMapId };
    const result = await runToolAsync(context as never, 'build_monster_game', { mode: 'create', ...args });
    expect(result.ok, result.summary).toBe(true);
    // create reuses the shared original campaign and swaps context.project for it — read the built project from the context.
    return context.project;
  }
  // build_monster_game(create) 한 번이 #4934(겹치면 다른 씨앗으로 다시 짓기·천장/테두리 칠하기) 뒤 CI 에서 약 3초 → 9초가 됐다.
  // 세 번 짓는 둘째 시험이 9.4s(04d5d878) → 28.2s(ci-vitest-files 45180506664 단독)로 기본 15s 를 넘는다. 이웃 몬스터 시험(180s)처럼 넉넉히 준다.
  describe('build_monster_game create title', { timeout: 120_000 }, () => {
    it('names the game after the campaign instead of the blank-project default', async () => {
      const project = await create(() => {});
      expect(project.meta.title).not.toBe('새 프로젝트');
      expect(project.system.titleScreen?.title).toBe(project.meta.title);
    });

    it('prefers an explicit title, then the user-set project title, then the concept title', async () => {
      expect((await create(() => {}, { title: '달빛 원정' })).meta.title).toBe('달빛 원정');
      const named = await create(p => { p.meta.title = '내 게임'; });
      expect(named.meta.title).toBe('내 게임');
      expect(named.system.titleScreen?.title).toBe('내 게임');
      const concept = await create(p => { p.gameDesignBrief = { concept: { slug: 'x', title: '별빛 수집가', hook: '훅' } } as never; });
      expect(concept.meta.title).toBe('별빛 수집가');
      expect(concept.system.titleScreen?.title).toBe('별빛 수집가');
    });
  });
});

describe("monsterCollection", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  function monsterProject(): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.session.inventory.item_capture_orb = 3;
    return project;
  }
  function captureRuntime(project: Project, rng: () => number = () => 0): ReturnType<typeof createBattleRuntime> {
    return createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 3 } },
      captureLocation: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
      rng,
    });
  }
  describe("monster collection core", () => {
    it("ships demo starter species and wild slime species fixture", () => {
      const ids = new Set((createBlankProject().database.monsterSpecies ?? []).map((species) => species.id));
      expect(ids.has("species_leafling")).toBe(true);
      expect(ids.has("species_sparkit")).toBe(true);
      expect(ids.has("species_aqualing")).toBe(true);
      expect(ids.has("species_wild_slime")).toBe(true);
    });

    it("calculates capture formula boundaries and item multiplier", () => {
      expect(captureSuccessRate(0.5, 100, 100, 1)).toBeCloseTo(0.15);
      expect(captureSuccessRate(0.5, 1, 100, 1)).toBeCloseTo(0.4965);
      expect(captureSuccessRate(0.5, 100, 100, 3)).toBeCloseTo(0.45);
      expect(captureSuccessRate(1, 1, 100, 10)).toBe(1);
    });

    it("creates deterministic IVs and routes party overflow to box", () => {
      const project = monsterProject();
      const first = startSession(project, 77);
      const second = startSession(project, 77);
      const firstResult = giveMonster(project, first, { speciesId: "species_wild_slime", level: 5 });
      const secondResult = giveMonster(project, second, { speciesId: "species_wild_slime", level: 5 });
      expect(firstResult.ok && firstResult.instance.ivs).toEqual(secondResult.ok && secondResult.instance.ivs);
      expect(deterministicMonsterIvs("fixed")).toEqual(deterministicMonsterIvs("fixed"));

      for (let index = 0; index < 6; index += 1) {
        giveMonster(project, first, { speciesId: "species_wild_slime", level: 2 });
      }
      expect(first.monsterParty).toHaveLength(6);
      expect(first.monsterBox).toHaveLength(1);
    });

    it("roundtrips saves and accepts legacy saves without monster fields", () => {
      const project = monsterProject();
      const session = startSession(project, 12);
      giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "방울" });
      const snapshot = createSaveSnapshot(project, session);
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.monsterParty).toEqual(session.monsterParty);
      expect(restored.monsterInstances[session.monsterParty[0] ?? ""]?.nickname).toBe("방울");

      const legacy = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown> & { session: Record<string, unknown> };
      delete legacy.session.monsterInstances;
      delete legacy.session.monsterParty;
      delete legacy.session.monsterBox;
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(legacy));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind === "present") {
        const legacySession = applySaveSnapshot(project, read.snapshot);
        expect(legacySession.monsterInstances).toEqual({});
        expect(legacySession.monsterParty).toEqual([]);
        expect(legacySession.monsterBox).toEqual([]);
      }
    });

    it("blocks uncapturable troops and excludes captured enemies from EXP", () => {
      const project = monsterProject();
      const blocked = captureRuntime({ ...project, database: { ...project.database, troops: project.database.troops.map((troop) => troop.id === "troop_slime" ? { ...troop, uncapturable: true } : troop) } });
      blocked.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      expect(blocked.snapshot().lastCaptureResult?.blockedReason).toBe("uncapturable");
      expect(blocked.snapshot().timeline.some((entry) => entry.kind === "capture" && entry.success === false)).toBe(true);

      const runtime = captureRuntime(project, (() => {
        const values = [0, 0.1, 0.2, 0.3, 0.4];
        return () => values.shift() ?? 0;
      })());
      runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("victory");
      expect(snapshot.capturedMonsters).toHaveLength(1);
      expect(snapshot.timeline.some((entry) => entry.kind === "capture" && entry.success === true && entry.targetId === "enemy-1")).toBe(true);
      expect(snapshot.rewards.exp).toBe(0);
    });

    it("a capture item works by its captureProfile even when saved as a normal item", () => {
      // 2026-09-24 도그푸딩: 조수가 몬스터볼을 type normalGoods 로 저장 — 메뉴엔 뜨고 던지면 missingItem 이었다.
      const project = monsterProject();
      const orb = project.database.items.find((item) => item.id === "item_capture_orb");
      if (!orb) throw new Error("missing orb");
      (orb as { type: string }).type = "normalGoods";
      const runtime = captureRuntime(project, (() => {
        const values = [0, 0.1, 0.2, 0.3, 0.4];
        return () => values.shift() ?? 0;
      })());
      runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().lastCaptureResult?.blockedReason).toBeUndefined();
      expect(runtime.snapshot().capturedMonsters).toHaveLength(1);
    });

    it("capturing one enemy does not win while another visible enemy is alive", () => {
      const project = monsterProject();
      const troop = project.database.troops.find((record) => record.id === "troop_slime");
      if (!troop) throw new Error("missing troop");
      troop.members = [
        { enemyId: "enemy_slime", x: 72, y: 88 },
        { enemyId: "enemy_slime", x: 116, y: 120 },
      ];
      const runtime = captureRuntime(project);
      runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().capturedMonsters).toHaveLength(1);
      expect(runtime.snapshot().enemies.some((enemy) => enemy.id === "enemy-2" && enemy.hp > 0)).toBe(true);
      expect(runtime.snapshot().result).toBeUndefined();
    });

    it("simulateBattle strict script captures a weakened slime and fails at full HP", () => {
      const successProject = monsterProject();
      const hero = successProject.database.actors[0];
      if (!hero) throw new Error("missing hero");
      hero.parameterCurves.attack = Array.from({ length: 99 }, () => 1);
      // Starter equipment and actor criticals can make this scripted hit lethal.
      // Control both instead of depending on a particular seeded critical roll.
      hero.initialEquipment = {};
      hero.critical = { enabled: false, chanceDenominator: 30 };
      successProject.database.skills.push(normalizeSkillRecord({
        id: "skill_leave_one",
        name: "빈사 만들기",
        power: 120,
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        hitRate: 100,
        variance: 0,
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
      }));
      hero.learnedSkills = [{ level: 1, skillId: "skill_leave_one" }];
      const enemy = successProject.database.enemies.find((record) => record.id === "enemy_slime");
      if (!enemy) throw new Error("missing slime");
      enemy.stats = { ...enemy.stats, maxHp: 130, defense: 1, attack: 1 };
      const orb = successProject.database.items.find((item) => item.id === "item_capture_orb");
      if (orb) orb.captureProfile = { multiplier: 10 };
      const success = simulateBattle({
        project: successProject,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        inventory: { item_capture_orb: 1 },
        n: 1,
        seed: 1,
        strictScript: [
          [{ actorId: hero.id, command: "skill", skillId: "skill_leave_one", target: "enemy-1" }],
          [{ actorId: hero.id, command: "capture", captureItemId: "item_capture_orb", target: "enemy-1" }],
        ],
        maxSteps: 20,
      });
      const openingHit = success.roundLogs[0]?.actions.find((action) => action.commandKind === "skill");
      expect(openingHit?.hit).toBe(true);
      expect(openingHit?.critical).toBe(false);
      expect(openingHit?.amount).toBeGreaterThan(0);
      expect(openingHit?.amount).toBeLessThan(enemy.stats.maxHp);
      expect(success.capturedCount).toBe(1);
      expect(success.capturedMonsters[0]?.speciesId).toBe("species_wild_slime");

      const failureProject = monsterProject();
      const failureSpecies = failureProject.database.monsterSpecies?.find((species) => species.id === "species_wild_slime");
      if (failureSpecies) failureSpecies.captureRate = 0;
      const failure = simulateBattle({
        project: failureProject,
        troopId: "troop_slime",
        heroLevel: 1,
        battleFlow: "strict",
        inventory: { item_capture_orb: 1 },
        n: 1,
        seed: 1,
        strictScript: [[{ actorId: failureProject.database.actors[0]?.id ?? "actor_hero", command: "capture", captureItemId: "item_capture_orb", target: "enemy-1" }]],
        maxSteps: 5,
      });
      expect(failure.capturedCount).toBe(0);
    });

    it("give_starter_monsters creates a three-choice event that gives one monster", () => {
      const project = monsterProject();
      const tool = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
      if (!tool) throw new Error("missing give_starter_monsters");
      tool.run(project, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
      const event = project.maps[project.startMapId]?.events.find((entry) => entry.id === "ev_starter_monsters");
      const page = event?.pages?.[0];
      // starterChoice.ts: a loop label precedes the species list; picking one shows its card and info pages and then
      // asks 「…첫 동료로 정할까요?」 (예 gives, 아니오 loops back to the label).
      expect(page?.commands.map((command) => command.kind)).toEqual(["label", "choices"]);
      const session = startSession(project, 5);
      const interpreter = createInterpreter(page?.commands as Command[], session, project, { currentEventId: event?.id });
      const choices = interpreter.start();
      expect(choices.kind).toBe("choices");
      let result = interpreter.resume(1);
      let confirmations = 0;
      for (let guard = 0; guard < 32 && result.kind !== "done"; guard += 1) {
        if (result.kind === "choices") {
          confirmations += 1;
          result = interpreter.resume(0);
        } else {
          result = interpreter.resume(undefined);
        }
      }
      expect(result.kind).toBe("done");
      expect(confirmations).toBe(1);
      expect(session.monsterParty).toHaveLength(1);
      expect(session.monsterInstances[session.monsterParty[0] ?? ""]?.speciesId).toBe("species_sparkit");
    });
  });
});
