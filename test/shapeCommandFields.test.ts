import { describe, expect, it, vi } from "vitest";
import { normalizeActionSkillProfile, resolveActionCombatConfig } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { addFieldSpawnEntry, createFieldSpawnRuntime, removeFieldSpawnEntry, resolveFieldSpawnVictory, syncFieldSpawnEventsIntoMap } from "@/player/fieldSpawns";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { validateCommandArray, validateConditionShape } from "@/project/io/shapeCommandFields";
import type { EventPage, GameEvent, Command, Condition, Project } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { deserialize, serialize } from "@/project/io";
import { commandKinds } from "@/project/io/guards";
import { CONDITION_KINDS, COMMAND_KINDS, type CommandKind, type ConditionKind } from "@/project/commandKindRegistry";
import { compileSimplePages, resolveCommandKind } from "@/editor/tools/eventCompile";
import { normalizeArgsForSchema, validateArgs } from "@/editor/tools/jsonSchema";
import { COMMAND_SCHEMA, COMMAND_SCHEMA_COMPACT, CONDITION_SCHEMA, SIMPLE_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { generateToolCatalogMarkdown } from "@/editor/tools/toolCatalog";
import { runTool } from "@/editor/tools/toolRunner";
import { getTool } from "@/editor/tools/toolRegistry";
import type { JsonSchema, SimplePage, ToolContext } from "@/editor/tools/types";
import { clampEmoteDurationMs, EMOTE_DEFAULT_DURATION_MS, EMOTE_MAX_DURATION_MS, EMOTE_MIN_DURATION_MS, friendshipDeltaEmote, giftRankEmote } from "@/project/emotes";
import { ProjectFormatError } from "@/project/io/errors";
import { isolateTimers } from "./mergedTeardown";

describe("actionSurvival", () => {
  isolateTimers();
  function blankWithMap() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    store.replace(project);
    return { project, map };
  }
  describe("탄약(itemCost) — 노비하자 블로커 1", () => {
    it("normalize keeps itemCost and clamps amount", () => {
      const profile = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "item_9mm", amount: 0 } });
      expect(profile?.itemCost).toEqual({ itemId: "item_9mm", amount: 1 });
      const over = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "item_9mm", amount: 500 } });
      expect(over?.itemCost?.amount).toBe(99);
    });

    it("normalize drops itemCost without itemId", () => {
      const profile = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "", amount: 1 } });
      expect(profile?.itemCost).toBeUndefined();
    });
  });
  describe("영구 처치(persistKill) — 노비하자 블로커 3", () => {
    it("persistKill victory skips respawn and counts persistedDead", () => {
      const { project, map } = blankWithMap();
      const troopId = project.database.troops[0]!.id;
      map.fieldSpawns = [
        { id: "spawn_persist", troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2, respawnSec: 5, chase: true, persistKill: true },
      ];
      const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
      expect(state.entries[0]?.alive.length).toBe(2);

      const firstId = state.entries[0]!.alive[0]!.eventId;
      const spawn = resolveFieldSpawnVictory(state, firstId);
      expect(spawn?.persistKill).toBe(true);
      expect(state.entries[0]?.persistedDead).toBe(1);
      expect(state.entries[0]?.respawnTimersMs.length).toBe(0);

      // 두 번째 처치로 상한 도달 → 더 이상 배치되지 않는다.
      const secondId = state.entries[0]!.alive[0]!.eventId;
      resolveFieldSpawnVictory(state, secondId);
      expect(state.entries[0]?.persistedDead).toBe(2);
    });

    it("killedCounts reduce initial placement on map re-entry", () => {
      const { project, map } = blankWithMap();
      const troopId = project.database.troops[0]!.id;
      map.fieldSpawns = [
        { id: "spawn_persist", troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2, respawnSec: 5, chase: true, persistKill: true },
      ];
      const fresh = createFieldSpawnRuntime(project, map, { x: 10, y: 10 }, { spawn_persist: 2 });
      expect(fresh.entries[0]?.alive.length).toBe(0);
      const partial = createFieldSpawnRuntime(project, map, { x: 10, y: 10 }, { spawn_persist: 1 });
      expect(partial.entries[0]?.alive.length).toBe(1);
    });

    it("killedFieldSpawns survive a save snapshot roundtrip", () => {
      const { project } = blankWithMap();
      const session = startSession(project);
      session.killedFieldSpawns = { [project.startMapId]: { spawn_persist: 2 } };
      session.m2Runtime = { ...session.m2Runtime, access: { save: false } } as never;
      const snapshot = createSaveSnapshot(project, session);
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.killedFieldSpawns?.[project.startMapId]?.spawn_persist).toBe(2);
      expect(restored.m2Runtime?.access?.save).toBe(false);
    });
  });
  describe("동적 스폰(spawnFieldEnemy/despawnFieldEnemy)", () => {
    it("adds and removes a runtime spawn entry", () => {
      const { project, map } = blankWithMap();
      const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
      expect(state.entries.length).toBe(0);
      const troopId = project.database.troops[0]!.id;
      addFieldSpawnEntry(state, project, map, { id: "spawn_ambush", troopId, area: { x: 2, y: 2, w: 3, h: 3 }, maxAlive: 1, chase: true }, { x: 10, y: 10 });
      expect(state.entries.length).toBe(1);
      expect(state.entries[0]?.alive.length).toBe(1);
      addFieldSpawnEntry(state, project, map, { id: "spawn_ambush", troopId, area: { x: 2, y: 2, w: 3, h: 3 }, maxAlive: 1, chase: true }, { x: 10, y: 10 });
      expect(state.entries.length).toBe(1);
      removeFieldSpawnEntry(state, "spawn_ambush");
      expect(state.entries.length).toBe(0);
    });

    it("validates the new command kinds", () => {
      const validate = (command: unknown) => validateCommandArray("cmd", [command]);
      expect(() =>
        validate({ kind: "spawnFieldEnemy", spawn: { id: "s1", troopId: "t1", area: { x: 0, y: 0, w: 2, h: 2 } } })
      ).not.toThrow();
      expect(() => validate({ kind: "despawnFieldEnemy", spawnId: "s1" })).not.toThrow();
      expect(() => validate({ kind: "openSaveMenu" })).not.toThrow();
      expect(() => validate({ kind: "spawnFieldEnemy", spawn: { id: "s1" } })).toThrow();
      expect(() => validate({ kind: "despawnFieldEnemy" })).toThrow();
    });
  });
  describe("타자기 세이브(Change Save Access + openSaveMenu)", () => {
    it("hides the save menu entry when access.save is false", () => {
      const { project } = blankWithMap();
      const session = startSession(project);
      expect(listStatusMenuCommandIds(project, session)).toContain("save");
      session.m2Runtime = { ...session.m2Runtime, access: { save: false } } as never;
      expect(listStatusMenuCommandIds(project, session)).not.toContain("save");
    });
  });
  describe("좀비 군집 — 노비하자 블로커 2", () => {
    function chaseScene() {
      const { project, map } = blankWithMap();
      const chasePage = (id: string): EventPage => ({
        id,
        name: id,
        conditions: [],
        graphic: {},
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: { type: "chase", speed: 5, frequency: 6, sightRange: 12, giveUpRange: 18, pathfind: true },
        commands: [],
      });
      const events: GameEvent[] = [
        { id: "z1", x: 2, y: 2, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z1_page")] },
        { id: "z2", x: 2, y: 3, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z2_page")] },
        { id: "z3", x: 3, y: 2, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z3_page")] },
      ];
      map.events = events;
      let scene: Parameters<typeof registerPageMoveRoutes>[0];
      scene = {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        autonomousNPCs: new Map(),
        registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
      };
      registerPageMoveRoutes(scene);
      const runtimeScene = {
        ...scene,
        tileX: 6,
        tileY: 2,
        moving: false,
        movingTo: { x: 6, y: 2 },
        eventSprites: new Map(),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      };
      return { scene, runtimeScene };
    }

    it("chasers never stack on one tile while converging on the player", () => {
      const { scene, runtimeScene } = chaseScene();
      for (let tick = 0; tick < 40; tick += 1) {
        updateAutonomousNPCs(runtimeScene, 100);
        const occupied = Object.entries(scene.eventPositions).map(([id, pos]) => `${pos.x},${pos.y}:${id}`);
        const tiles = occupied.map((entry) => entry.split(":")[0]);
        expect(new Set(tiles).size).toBe(tiles.length);
      }
      // 플레이어에게 수렴했는지(군집이 실제로 움직였는지) 확인.
      const positions = Object.values(scene.eventPositions);
      expect(positions.some((pos) => Math.abs(pos.x - 6) + Math.abs(pos.y - 2) <= 2)).toBe(true);
    });

    it("wires actionProfile moveIntervalMs/aggroRange into chase instances and movers", () => {
      const { project, map } = blankWithMap();
      const troop = project.database.troops[0]!;
      const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0];
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      if (!enemy) throw new Error("enemy missing");
      enemy.actionProfile = { contactDamage: 2, moveIntervalMs: 900, aggroRange: 6 };
      map.fieldSpawns = [{ id: "spawn_tuned", troopId: troop.id, area: { x: 1, y: 1, w: 3, h: 3 }, maxAlive: 1, chase: true }];
      const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
      const instance = state.entries[0]?.alive[0];
      expect(instance?.sightRange).toBe(6);
      expect(instance?.moveIntervalMs).toBe(900);

      const positions = initialRuntimeEventPositions(map.events);
      syncFieldSpawnEventsIntoMap(map, state, positions);
      let scene: Parameters<typeof registerPageMoveRoutes>[0];
      scene = {
        map,
        session: startSession(project),
        eventPositions: positions,
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        autonomousNPCs: new Map(),
        registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
      };
      registerPageMoveRoutes(scene);
      const mover = scene.autonomousNPCs.get(instance!.eventId);
      expect(mover?.moveIntervalMs).toBe(900);
      expect(mover?.sightRange).toBe(6);
    });
  });
  describe("4방향 이동 옵션", () => {
    it("resolves fourWayMovement from system config", () => {
      const { project } = blankWithMap();
      expect(resolveActionCombatConfig(project).fourWayMovement).toBe(false);
      project.system.actionCombat = { enabled: true, fourWayMovement: true };
      expect(resolveActionCombatConfig(project).fourWayMovement).toBe(true);
    });
  });
});

// test/commandKindCoverage.test.ts
//
// Phase 0-1(handoff.md): Command/Condition kind 유니온이 5곳(types/events.ts, io/guards.ts,
// io/shapeCommandFields.ts, io/commandReferenceValidation.ts, player/interpreter/commandCatalog.ts)에
// 수동 중복되어 드리프트가 반복 발생했다(loop/breakLoop/setSelfSwitch 누락 사고 3건).
// 이 테스트는 commandKindRegistry.ts(단일 소스)를 기준으로:
//   (a) registry ↔ 타입 유니온 일치(개수/중복) + guards.ts 화이트리스트 동일성
//   (b) kind별 최소 인스턴스가 shape 검증을 통과
//   (c) Condition 7종이 fork 조건 + 이벤트 페이지 조건으로 serialize→deserialize 왕복 통과
//   (d) commandCatalog(인터프리터)이 모든 kind를 명시적으로 처리(알 수 없는 kind 폴백 미발생)
// 를 강제한다. 새 kind를 types/events.ts에만 추가하면 MINIMAL_COMMANDS의 Record 타입 체크가
// 컴파일 에러를 내거나, 이 테스트가 실패한다.
describe("commandKindCoverage", () => {
  isolateTimers();
  // kind별 최소 유효 커맨드 인스턴스. Record<CommandKind, Command> 타입이므로 COMMAND_KINDS에
  // 새 kind가 추가되는데 여기 항목을 안 채우면 컴파일 에러가 난다(누락 차단).
  const MINIMAL_COMMANDS: Record<CommandKind, Command> = {
    text: { kind: "text", body: "hello" },
    changeFace: { kind: "changeFace", resourceId: "res1", position: "left", flipHorizontally: false },
    choices: { kind: "choices", options: [{ text: "a", branch: [] }] },
    presentItem: { kind: "presentItem", options: [{ itemId: "item1", branch: [] }] },
    planSchedule: { kind: "planSchedule", scheduleId: "sched1" },
    runSchedule: { kind: "runSchedule", scheduleId: "sched1" },
    fork: { kind: "fork", condition: { kind: "switch", switchId: "sw1", value: true }, then: [], else: [] },
    wait: { kind: "wait", ms: 100 },
    inputWait: { kind: "inputWait" },
    inputNumber: { kind: "inputNumber", variableId: "var1", digits: 1 },
    label: { kind: "label", name: "L1" },
    gotoLabel: { kind: "gotoLabel", name: "L1" },
    loop: { kind: "loop", body: [{ kind: "breakLoop" }] },
    breakLoop: { kind: "breakLoop" },
    setSwitch: { kind: "setSwitch", switchId: "sw1", value: true },
    setVariable: { kind: "setVariable", variableId: "var1", op: "=", value: 1 },
    timer: { kind: "timer", action: "set", seconds: 5, timerId: "timer1" },
    advanceTime: { kind: "advanceTime", minutes: 10 },
    advanceCropGrowth: { kind: "advanceCropGrowth", days: 1 },
    setTime: { kind: "setTime", hour: 6, minute: 0 },
    sleepUntilMorning: { kind: "sleepUntilMorning" },
    transfer: { kind: "transfer", mapId: "map1", x: 0, y: 0 },
    moveEvent: { kind: "moveEvent", eventId: "ev1", route: { moves: [], repeat: false } },
    setEventGraphicPattern: { kind: "setEventGraphicPattern", eventId: "ev1", pattern: 0 },
    changeTile: { kind: "changeTile", mapId: "map1", layer: "lower", x: 0, y: 0, tile: 1 },
    callCommonEvent: { kind: "callCommonEvent", commonEventId: "ce1" },
    callMapEvent: { kind: "callMapEvent", eventId: "ev1" },
    battleProcessing: { kind: "battleProcessing", troopId: "troop1", canEscape: true, canLose: false },
    learnSkill: { kind: "learnSkill", actorId: "actor1", skillId: "skill1" },
    changeExp: { kind: "changeExp", actorId: "actor1", op: "+=", amount: 10 },
    changeLevel: { kind: "changeLevel", actorId: "actor1", op: "+=", amount: 1 },
    // 아래 4종은 kind 만 추가되고 커버리지 픽스처가 누락돼 있었다(COMMAND_KINDS 70→74).
    changeLifeSkillExp: { kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount: 10 },
    openSaveMenu: { kind: "openSaveMenu" },
    spawnFieldEnemy: { kind: "spawnFieldEnemy", spawn: { id: "spawn1", troopId: "troop1", area: { x: 0, y: 0, width: 4, height: 4 } } },
    despawnFieldEnemy: { kind: "despawnFieldEnemy", spawnId: "spawn1" },
    tacticsBattle: { kind: "tacticsBattle", troopId: "troop1" },
    runControl: { kind: "runControl", action: "start", seed: 1 },
    promoteActor: { kind: "promoteActor", actorId: "actor1", toClassId: "class1", successBranch: [], failureBranch: [] },
    evolveMonster: { kind: "evolveMonster", instanceId: "monster_1", toSpeciesId: "species1", successBranch: [], failureBranch: [] },
    changeEquipment: { kind: "changeEquipment", actorId: "actor1", slot: "weapon", equipmentId: "eq1" },
    changeActorHp: { kind: "changeActorHp", actorId: "actor1", op: "+=", amount: 10 },
    changeActorMp: { kind: "changeActorMp", actorId: "actor1", op: "+=", amount: 10 },
    recoverAll: { kind: "recoverAll" },
    enterHeroName: { kind: "enterHeroName", actorId: "actor1", maxLength: 6, showInitialName: false },
    changeGold: { kind: "changeGold", op: "+=", amount: 10 },
    changeItem: { kind: "changeItem", itemId: "item1", op: "+=", amount: 1 },
    craftRecipe: { kind: "craftRecipe", recipeId: "recipe1" },
    openCraftShop: { kind: "openCraftShop", recipeIds: ["recipe1"] },
    applyItemUpgrade: { kind: "applyItemUpgrade", upgradeId: "upgrade1" },
    equipTool: { kind: "equipTool", itemId: "item1" },
    openChest: { kind: "openChest", chestId: "chest1" },
    setRelationship: { kind: "setRelationship", npcKey: "npc_a", state: "dating" },
    changeFriendship: { kind: "changeFriendship", npcKey: "ev1", delta: 10 },
    changeFactionStance: { kind: "changeFactionStance", a: "player", b: "enemy", op: "+=", value: 1 },
    getFriendship: { kind: "getFriendship", npcKey: "ev1", variableId: "var1" },
    changeParty: { kind: "changeParty", actorId: "actor1", action: "add" },
    giveMonster: { kind: "giveMonster", speciesId: "species1", level: 5 },
    moveMonster: { kind: "moveMonster", instanceId: "monster_1", to: "party" },
    addFollower: { kind: "addFollower", actorId: "actor1", name: "동행자" },
    removeFollower: { kind: "removeFollower", all: true },
    setLighting: { kind: "setLighting", ambient: 0.8, color: "#000000", transitionMs: 0 },
    addLight: { kind: "addLight", source: { id: "light1", at: "player", radius: 4, intensity: 1, flicker: true } },
    removeLight: { kind: "removeLight", all: true },
    setWeather: { kind: "setWeather", weather: "storm", intensity: 0.8, transitionMs: 120 },
    showEmote: { kind: "showEmote", target: "player", emote: "heart" },
    showAnimation: { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true },
    showPicture: { kind: "showPicture", pictureId: "pic1", resourceId: "res1", x: 0, y: 0 },
    erasePicture: { kind: "erasePicture", pictureId: "pic1" },
    playAudio: { kind: "playAudio", resourceId: "res1", loop: false },
    stopAudio: { kind: "stopAudio" },
    playMovie: { kind: "playMovie", resourceId: "video_intro" },
    cutsceneControl: { kind: "cutsceneControl", mode: "begin", skippable: true },
    displayTextSettings: {
      kind: "displayTextSettings",
      format: "normal",
      position: "bottom",
      preventObscuringPlayer: true,
      allowEventMovementDuringWait: false,
    },
    shop: { kind: "shop", itemIds: ["item1"] },
    inn: { kind: "inn", price: 10 },
    checkpointSave: { kind: "checkpointSave" },
    killPlayer: { kind: "killPlayer", message: "trap" },
    triggerEnding: { kind: "triggerEnding", endingId: "ending_true" },
    gameOver: { kind: "gameOver" },
    ending: { kind: "ending", title: "t", message: "m" },
    returnToTitle: { kind: "returnToTitle" },
    setFlag: { kind: "setFlag", flag: "flag1", value: true },
    setSelfSwitch: { kind: "setSelfSwitch", key: "A", value: true },
    // 로더가 카탈로그 id 를 검사한다(2026-09-20~) — 기준선부터 "m2_test" 는 통과할 수 없었다(2026-09-27 교정).
    m2Command: { kind: "m2Command", commandId: "m2-215-debug-log", fields: {} },
    setDifficulty: { kind: "setDifficulty", difficultyId: "normal" },
    storeParty: { kind: "storeParty", partySetId: "party_a" },
    recallParty: { kind: "recallParty", partySetId: "party_a" },
    removeMonster: { kind: "removeMonster", instanceId: "monster_1" },
    tradeMonster: { kind: "tradeMonster", fromSpeciesId: "species1", toSpeciesId: "species2" },
    fuseMonsters: { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" },
    script: { kind: "script", source: "", compiled: "" },
  };
  // kind별 최소 유효 Condition 인스턴스. 라운드트립 테스트에서는 참조 검증까지 통과해야 하므로
  // 아래 IDENTIFIER 후보 대신 실제 blank project의 id들로 다시 채워 사용한다(buildRoundtripConditions).
  function buildMinimalConditions(ids: {
    switchId: string;
    variableId: string;
    actorId: string;
    itemId: string;
    speciesId?: string;
  }): Record<ConditionKind, Condition> {
    return {
      switch: { kind: "switch", switchId: ids.switchId, value: true },
      variable: { kind: "variable", variableId: ids.variableId, op: "==", value: 1 },
      selfSwitch: { kind: "selfSwitch", key: "A", value: true },
      actor: { kind: "actor", actorId: ids.actorId, present: true },
      item: { kind: "item", itemId: ids.itemId, present: true },
      gold: { kind: "gold", op: ">=", amount: 0 },
      timer: { kind: "timer", timerId: "timer1", seconds: 10 },
      timePhase: { kind: "timePhase", phase: "day" },
      season: { kind: "season", season: "spring" },
      npcActivity: { kind: "npcActivity", activity: "work" },
      insideLocation: { kind: "insideLocation", locationId: "loc1", inside: true },
      friendshipAtLeast: { kind: "friendshipAtLeast", value: 10 },
      relationshipAtLeast: { kind: "relationshipAtLeast", state: "dating" },
      battleResult: { kind: "battleResult", result: "victory" },
      run: { kind: "run", query: "active", value: true },
      // 기준선에서 빠져 있던 kind(2026-09-27 교정).
      monsterSpecies: { kind: "monsterSpecies", speciesId: ids.speciesId ?? "species_test", present: true },
      // 명작 공백 G1 — 배우·파티·시점·회차·요일·문자열 조건.
      actorStat: { kind: "actorStat", actorId: ids.actorId, stat: "level", op: ">=", value: 1 },
      actorState: { kind: "actorState", actorId: "anyone", stateId: "state_test", present: true },
      partyLeader: { kind: "partyLeader", actorId: ids.actorId },
      partyKnowsSkill: { kind: "partyKnowsSkill", skillId: "skill_test", present: true },
      badgeCount: { kind: "badgeCount", op: ">=", value: 1 },
      partySize: { kind: "partySize", op: ">=", value: 1 },
      facing: { kind: "facing", subject: "player", dir: "up" },
      relativeFacing: { kind: "relativeFacing", relation: "playerBehindEvent" },
      hiding: { kind: "hiding", value: true },
      pursuitActive: { kind: "pursuitActive", value: true },
      // 시선 조건(dd8de6b90d #3317)이 CONDITION_KINDS 에 들어왔다.
      eventSeesPlayer: { kind: "eventSeesPlayer", eventId: "watcher", range: 5 },
      clearCount: { kind: "clearCount", op: ">=", value: 1 },
      endingSeen: { kind: "endingSeen", endingId: "ending_true", value: true },
      newGamePlus: { kind: "newGamePlus", value: true },
      weekday: { kind: "weekday", weekdays: [0, 6] },
      stringVariable: { kind: "stringVariable", stringVariableId: "prayer", op: "==", value: "빛" },
      difficulty: { kind: "difficulty", difficultyId: "normal" },
      itemUsed: { kind: "itemUsed", itemId: ids.itemId },
      all: {
        kind: "all",
        conditions: [
          { kind: "switch", switchId: ids.switchId, value: true },
          { kind: "variable", variableId: ids.variableId, op: ">=", value: 0 },
        ],
      },
      any: {
        kind: "any",
        conditions: [
          { kind: "item", itemId: ids.itemId, present: true },
          { kind: "gold", op: ">=", amount: 1 },
        ],
      },
      not: { kind: "not", condition: { kind: "switch", switchId: ids.switchId, value: false } },
    };
  }
  function mkSession(): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      classOverrides: {},
      actorExperience: {},
      actorLevels: {},
      actorEquipment: {},
      actorVitals: {},
      currentMapId: "m1",
      x: 0,
      y: 0,
      audio: {},
      pictures: {},
      lighting: { ambient: 0, sources: [] },
    };
  }
  describe("commandKindRegistry — 레지스트리 sanity", () => {
    it("COMMAND_KINDS/CONDITION_KINDS에 중복이 없다", () => {
      expect(new Set(COMMAND_KINDS).size).toBe(COMMAND_KINDS.length);
      expect(new Set(CONDITION_KINDS).size).toBe(CONDITION_KINDS.length);
    });

    it("guards.ts의 commandKinds 화이트리스트가 레지스트리와 정확히 일치한다", () => {
      expect([...commandKinds].sort()).toEqual([...COMMAND_KINDS].sort());
    });

    it("MINIMAL_COMMANDS가 COMMAND_KINDS를 빠짐없이 커버한다", () => {
      expect(Object.keys(MINIMAL_COMMANDS).sort()).toEqual([...COMMAND_KINDS].sort());
      for (const kind of COMMAND_KINDS) expect(MINIMAL_COMMANDS[kind].kind).toBe(kind);
    });
  });
  describe("command kind별 shape 검증 커버리지", () => {
    for (const kind of COMMAND_KINDS) {
      it(`${kind}: 최소 인스턴스가 validateCommandArray를 통과한다`, () => {
        expect(() => validateCommandArray("test", [MINIMAL_COMMANDS[kind]])).not.toThrow();
      });
    }
  });
  describe("condition kind별 shape 검증 커버리지", () => {
    const conditions = buildMinimalConditions({
      switchId: "sw1",
      variableId: "var1",
      actorId: "actor1",
      itemId: "item1",
    });
    for (const kind of CONDITION_KINDS) {
      it(`${kind}: 최소 인스턴스가 validateConditionShape를 통과한다`, () => {
        expect(() => validateConditionShape("test", conditions[kind])).not.toThrow();
      });
    }
  });
  describe("condition 7종 — fork/페이지 조건 serialize→deserialize 왕복", () => {
    it("모든 condition kind가 fork 커맨드 조건 + 이벤트 페이지 조건으로 왕복 보존된다", () => {
      // Start from the persisted shape: loading deliberately drops redundant text-only title graphics.
      const project = deserialize(serialize(createBlankProject()));
      const actorId = project.database.actors[0]?.id;
      const itemId = project.database.items[0]?.id;
      const switchId = project.switches[0]?.id;
      const variableId = project.variables[0]?.id;
      expect(actorId, "blank project에 actor가 있어야 함").toBeTruthy();
      expect(itemId, "blank project에 item이 있어야 함").toBeTruthy();
      expect(switchId, "blank project에 switch가 있어야 함").toBeTruthy();
      expect(variableId, "blank project에 variable이 있어야 함").toBeTruthy();

      if (!actorId || !itemId || !switchId || !variableId) {
        throw new Error("blank project reference fixtures are incomplete");
      }
      // 몬스터 보유 조건은 로더가 종 참조를 검사한다 — 기본 DB 의 첫 종을 쓴다.
      const speciesId = project.database.monsterSpecies?.[0]?.id;
      expect(speciesId, "blank project에 monster species가 있어야 함").toBeTruthy();
      const conditions = buildMinimalConditions({ switchId, variableId, actorId, itemId, speciesId });
      const conditionList: Condition[] = CONDITION_KINDS.map((kind) => conditions[kind]);

      const forkCommands: Command[] = conditionList.map((condition, index) => ({
        kind: "fork",
        condition,
        then: [{ kind: "text", body: `cond-${index}-true` }],
        else: [{ kind: "text", body: `cond-${index}-false` }],
      }));

      const page: EventPage = {
        id: "page_condition_roundtrip",
        name: "조건 왕복 테스트 페이지",
        conditions: conditionList,
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: forkCommands,
      };

      const testEvent: GameEvent = {
        id: "ev_condition_roundtrip",
        characterId: "char_condition_roundtrip",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: forkCommands,
        pages: [page],
      };

      const map = project.maps[project.startMapId];
      map.events = [...map.events, testEvent];

      const restored = deserialize(serialize(project));
      expect(restored).toEqual(project);
      expect(deserialize(serialize(restored))).toEqual(restored);
    });
  });
  describe("commandCatalog(인터프리터) — kind별 명시 처리 커버리지", () => {
    for (const kind of COMMAND_KINDS) {
      it(`${kind}: 알 수 없는 command kind 폴백으로 떨어지지 않는다`, () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
          const session = mkSession();
          const interp = createInterpreter([MINIMAL_COMMANDS[kind]], session);
          interp.start();
          const unknownKindWarned = warnSpy.mock.calls.some((args) =>
            String(args[0]).includes("알 수 없는 command kind")
          );
          expect(unknownKindWarned).toBe(false);
        } finally {
          warnSpy.mockRestore();
        }
      });
    }
  });
});

describe("npcCommandContract", () => {
  isolateTimers();
  const graphic = { transparent: true } as const;
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function record(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) throw new Error("Expected JSON object");
    return value;
  }
  function schemaErrors(schema: JsonSchema, value: unknown): string[] {
    const errors = schema.type === "object" ? validateArgs(schema, value) : [];
    if (schema.type === "object") {
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        const field = record(value)[key];
        if (field !== undefined) errors.push(...schemaErrors(child, field));
      }
    }
    if (schema.type === "array" && schema.items && Array.isArray(value)) {
      for (const entry of value) errors.push(...schemaErrors(schema.items, entry));
    }
    return errors;
  }
  describe("NPC model-visible command contract", () => {
    it("advertises only executable command kinds, including choice commands", () => {
      const kinds = COMMAND_SCHEMA.properties?.kind?.enum;
      expect(kinds).toEqual([...COMMAND_KINDS]);
      expect(kinds?.every(kind => typeof kind === "string" && resolveCommandKind(kind) === kind)).toBe(true);
      expect(SIMPLE_PAGE_SCHEMA.properties?.commands?.items).toBe(COMMAND_SCHEMA);
      // 같은 도구 안 두 번째 Command 목록은 설명 없는 사본이다(필드·kind 목록은 같다).
      expect(SIMPLE_PAGE_SCHEMA.properties?.choices?.items?.properties?.commands?.items).toBe(COMMAND_SCHEMA_COMPACT);
      expect(COMMAND_SCHEMA_COMPACT.properties?.kind?.enum).toEqual([...COMMAND_KINDS]);
      expect(CONDITION_SCHEMA.properties?.kind?.enum).toEqual([...CONDITION_KINDS]);
    });

    it("declares the item operation and both command and condition value fields", () => {
      expect(COMMAND_SCHEMA.properties?.op?.enum).toEqual(["=", "+=", "-=", "*=", "/="]);
      expect(COMMAND_SCHEMA.properties?.value).toBeDefined();
      expect(CONDITION_SCHEMA.properties?.value).toBeDefined();
    });

    it("exposes the canonical monster grant fields used by the compiler", () => {
      const command = { kind: "giveMonster", speciesId: "species_leafling", level: 5 } satisfies Command;
      expect(COMMAND_SCHEMA.properties?.speciesId?.type).toBe("string");
      expect(COMMAND_SCHEMA.properties?.level?.type).toBe("integer");
      expect(schemaErrors(COMMAND_SCHEMA, command)).toEqual([]);
      const pages = compileSimplePages("npc", "Guide", [{ commands: [command] }], graphic);
      expect(pages[0]?.commands).toEqual([command]);
      expect(() => validateCommandArray("commands", pages[0]?.commands)).not.toThrow();
    });

    it("exposes navigation and choice operands in scene-test steps", () => {
      const step = getTool("run_scene_test")?.parameters.properties?.steps?.items;
      expect(step?.properties?.dir?.enum).toEqual(["up", "down", "left", "right"]);
      expect(step?.properties?.to?.required).toEqual(["x", "y"]);
      expect(step?.properties?.ticks?.type).toBe("integer");
      expect(step?.properties?.index?.type).toBe("integer");
    });

    it.each([
      { kind: "setSelfSwitch", key: "A", value: true },
      { kind: "setSelfSwitch", key: "D", value: false },
      { kind: "setSwitch", switchId: "s1", value: true },
      { kind: "setSwitch", switchId: "s1", value: "toggle" },
      { kind: "setSwitch", switchId: "s1", value: { kind: "var", id: "v1" } },
      { kind: "setVariable", variableId: "v1", op: "=", value: 5 },
      { kind: "setVariable", variableId: "v1", op: "+=", value: { kind: "var", id: "v2" } },
      { kind: "changeItem", itemId: "item_ball", op: "+=", amount: 5 },
      { kind: "text", body: "Hello" },
    ] satisfies Command[])("accepts and preserves $kind value=$value through schema, compiler and shape", command => {
      const normalized = normalizeArgsForSchema(COMMAND_SCHEMA, command);
      expect(schemaErrors(COMMAND_SCHEMA, normalized)).toEqual([]);
      const pages = compileSimplePages("npc", "Guide", [{ commands: [normalized] }], graphic);
      expect(pages[0]?.commands).toEqual([command]);
      expect(() => validateCommandArray("commands", pages[0]?.commands)).not.toThrow();
    });

    it.each([
      { kind: "selfSwitch", key: "A", value: true },
      { kind: "switch", switchId: "s1", value: false },
      { kind: "variable", variableId: "v1", op: ">=", value: 5 },
      { kind: "item", itemId: "item_ball", present: true },
    ])("keeps $kind available as a real page condition", condition => {
      expect(schemaErrors(CONDITION_SCHEMA, condition)).toEqual([]);
      const pages = compileSimplePages("npc", "Guide", [{ lines: ["Hello"], conditions: [condition] }], graphic);
      expect(pages[0]?.conditions).toEqual([condition]);
      expect(() => validateConditionShape("condition", pages[0]?.conditions[0])).not.toThrow();
      expect(pages[0]?.commands).toEqual([{ kind: "text", speaker: "Guide", body: "Hello" }]);
    });

    it("still rejects invalid variant values at the real shape boundary", () => {
      expect(() => validateCommandArray("commands", [{ kind: "setSelfSwitch", key: "A", value: 1 }])).toThrow();
      expect(() => compileSimplePages("npc", "Guide", [{ conditions: [{ kind: "switch", switchId: "s1", value: 1 }] }], graphic)).toThrow();
    });

    it("keeps typeless and union-valued field consumers faithful", () => {
      const schema: JsonSchema = { type: "object", properties: {
        value: {}, choice: { type: ["boolean", "number", "string", "object"], properties: { kind: { type: "string" }, id: { type: "string" } } },
      } };
      const args = { value: false, choice: { kind: "var", id: "v1" } };
      expect(normalizeArgsForSchema(schema, args)).toEqual(args);
      expect(validateArgs(schema, args)).toEqual([]);
      const catalog = generateToolCatalogMarkdown([{ name: "probe", mode: "read", description: "", parameters: schema, run: () => ({ summary: "" }) }]);
      expect(catalog).toContain("value?: any");
      expect(catalog).toContain("choice?: boolean\\|number\\|string\\|object");
    });
  });
  describe("actionable NPC command repairs", () => {
    it.each(["changeItems", "gainItem", "item"])("returns a parseable changeItem repair for %s through the real tool surface", kind => {
      const ctx: ToolContext = { project: createBlankProject() };
      const itemId = ctx.project.database.items[0]?.id;
      if (!itemId) throw new Error("Blank project needs its default item fixture");
      const args = { mapId: ctx.project.startMapId, x: 3, y: 3, id: "npc_repair", name: "Guide", graphic,
        pages: [{ choices: [{ text: "Receive", commands: [{ kind, itemId, amount: 5 }] }] }],
      };
      const result = runTool(ctx, "place_npc", args);
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
      const repairLine = result.issues?.[0]?.message.split("\n").find(line => line.startsWith("repair: "));
      expect(repairLine).toBeDefined();
      if (!repairLine) throw new Error("Missing machine-readable repair");
      const repair = record(JSON.parse(repairLine.slice("repair: ".length)));
      expect(repair.path).toBe("pages[0].choices[0].commands[0]");
      expect(repair.example).toEqual({ kind: "changeItem", itemId, op: "+=", amount: 5 });
      expect(schemaErrors(COMMAND_SCHEMA, repair.example)).toEqual([]);
      expect(() => validateCommandArray("repair", [repair.example])).not.toThrow();
      expect(resolveCommandKind(kind)).toBeNull();
      const pages: SimplePage[] = [{ choices: [{ text: "Receive", commands: [repair.example] }] }];
      const compiled = compileSimplePages("npc", "Guide", pages, graphic);
      expect(() => validateCommandArray("commands", compiled[0]?.commands)).not.toThrow();
      const retried = runTool(ctx, "place_npc", { ...args, pages });
      expect(retried.ok, JSON.stringify(retried)).toBe(true);
      const stored = ctx.project.maps[ctx.project.startMapId]?.events.find(event => event.id === "npc_repair");
      expect(stored?.pages?.[0]?.commands).toEqual(compiled[0]?.commands);
    });
  });
});

// showEmote 명령 계약 — 저장 왕복, 표시 시간 클램프, 대상 해석, 자동 이모트 매핑.
describe("showEmoteCommand", () => {
  isolateTimers();
  function projectWithCommands(commands: readonly Command[]): Project {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "ev_emote",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "이모트",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [...commands],
        },
      ],
    };
    project.maps[mapId]!.events = [
      event,
      { id: "ev_partner", x: 2, y: 1, trigger: { kind: "action" }, commands: [] },
    ];
    return project;
  }
  function firstStep(command: Command) {
    const project = projectWithCommands([command]);
    const interpreter = createInterpreter([command], startSession(project), project, { currentEventId: "ev_emote" });
    return interpreter.start();
  }
  describe("showEmote 명령", () => {
    it("shape 검증이 어휘 밖 이모트를 거부한다", () => {
      expect(() =>
        validateCommandArray("cmds", [{ kind: "showEmote", target: "player", emote: "heart" }])
      ).not.toThrow();
      expect(() =>
        validateCommandArray("cmds", [{ kind: "showEmote", target: { eventId: "ev_a" }, emote: "heart", durationMs: 900 }])
      ).not.toThrow();
      expect(() =>
        validateCommandArray("cmds", [{ kind: "showEmote", target: "player", emote: "banana" }])
      ).toThrow(ProjectFormatError);
      expect(() =>
        validateCommandArray("cmds", [{ kind: "showEmote", target: {}, emote: "heart" }])
      ).toThrow(ProjectFormatError);
    });

    it("저장 → 불러오기 왕복에서 필드가 살아남는다", () => {
      const command: Command = {
        kind: "showEmote",
        target: { eventId: "ev_partner" },
        emote: "question",
        durationMs: 800,
      };
      const restored = deserialize(serialize(projectWithCommands([command])));
      const page = restored.maps[restored.startMapId]?.events[0]?.pages?.[0];
      expect(page?.commands[0]).toEqual(command);
    });

    it("인터프리터가 표시 시간을 클램프해서 씬 단계로 넘긴다", () => {
      expect(firstStep({ kind: "showEmote", target: "player", emote: "heart" })).toMatchObject({
        kind: "showEmote",
        target: "player",
        emote: "heart",
        durationMs: EMOTE_DEFAULT_DURATION_MS,
      });
      expect(firstStep({ kind: "showEmote", target: "player", emote: "heart", durationMs: 1 })).toMatchObject({
        durationMs: EMOTE_MIN_DURATION_MS,
      });
      expect(firstStep({ kind: "showEmote", target: "player", emote: "heart", durationMs: 999_999 })).toMatchObject({
        durationMs: EMOTE_MAX_DURATION_MS,
      });
    });

    it("빈 eventId 는 명령을 실행한 이벤트를 뜻한다(showAnimation 과 같은 규약)", () => {
      expect(firstStep({ kind: "showEmote", target: { eventId: "" }, emote: "smile" })).toMatchObject({
        target: { eventId: "" },
      });
    });

    it("표시 시간 클램프는 비정상 입력도 기본값으로 되돌린다", () => {
      expect(clampEmoteDurationMs(undefined)).toBe(EMOTE_DEFAULT_DURATION_MS);
      expect(clampEmoteDurationMs(Number.NaN)).toBe(EMOTE_DEFAULT_DURATION_MS);
      expect(clampEmoteDurationMs(1200.9)).toBe(1200);
    });

    it("선물 등급과 호감도 변화가 이모트로 매핑된다", () => {
      expect(giftRankEmote("loved")).toBe("heart");
      expect(giftRankEmote("liked")).toBe("smile");
      expect(giftRankEmote("neutral")).toBe("ellipsis");
      expect(giftRankEmote("disliked")).toBe("anger");
      expect(friendshipDeltaEmote(5)).toBe("heart");
      expect(friendshipDeltaEmote(-5)).toBe("anger");
      expect(friendshipDeltaEmote(0)).toBe("ellipsis");
    });
  });
});
