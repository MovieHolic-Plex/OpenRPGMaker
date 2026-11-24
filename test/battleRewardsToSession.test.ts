import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { deserialize } from "@/project/io";
import { startSession, type MonsterInstance } from "@/project/session";
import type { ActorParameterKey, Command, Project, MessageWindowSettings, MonsterSpeciesRecord, SkillRecord } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import bossFixture from "./fixtures/projects/battle-active-slots-boss-v3.json";
import battleFixture from "./fixtures/projects/battle-v3.json";
import assert from "node:assert/strict";
import { ACTOR, ROUTES, TROOP, battleCase, choice, m2, mark, pending, resume, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";
import fixture from "./fixtures/projects/battle-v3.json";
import { createBlankProject } from "@/project/defaults";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { giveMonster, applyGen1FieldPoisonStep, applyMonsterExperienceAndEvolution, evolveMonster, normalizeMonsterInstanceBattleState, rejectPendingMonsterSkill, replacePendingMonsterSkill } from "@/project/monsterCollection";
import { battlerSnapshot, monsterPartyBattlers, actorBattlers } from "@/battle/battleBattlers";
import { battleSkillUseFailure, consumeBattleSkillResource } from "@/battle/battleSkillUse";
import { recoverAll } from "@/project/sessionActorCommands";
import { resolveMonsterBattleParty } from "@/player/playSceneBattle";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { useItemFromMenu } from "@/player/playerItemUse";
import { isolateTimers } from "./mergedTeardown";

describe("battleActiveSlotsEvents", () => {
  isolateTimers();
  const PARTY4 = ["actor_warrior", "actor_mage", "actor_rogue", "actor_priest"] as const;
  function strictProject(): Project {
    return deserialize(JSON.stringify(strictFixture));
  }
  function bossProject(): Project {
    return deserialize(JSON.stringify(bossFixture));
  }
  function cloneRecord<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function fourActorProject(): Project {
    const project = strictProject();
    addActorClone(project, "actor_warrior", "class_warrior", "actor_rogue", "class_rogue", "도적");
    addActorClone(project, "actor_mage", "class_mage", "actor_priest", "class_priest", "사제");
    project.system.startActorIds = [...PARTY4];
    project.session.partyActorIds = [...PARTY4];
    const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
    if (!troop) throw new Error("missing troop_strict_training");
    troop.activeSlots = 2;
    return project;
  }
  function addActorClone(
    project: Project,
    sourceActorId: string,
    sourceClassId: string,
    actorId: string,
    classId: string,
    name: string
  ): void {
    const sourceActor = project.database.actors.find((record) => record.id === sourceActorId);
    const sourceClass = project.database.classes.find((record) => record.id === sourceClassId);
    if (!sourceActor || !sourceClass) throw new Error(`missing source actor/class: ${sourceActorId}/${sourceClassId}`);
    project.database.classes.push({ ...cloneRecord(sourceClass), id: classId, name });
    project.database.actors.push({ ...cloneRecord(sourceActor), id: actorId, name, classId });
  }
  function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`missing actor: ${actorId}`);
    actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
  }
  function setEnemyStats(project: Project, stats: { readonly maxHp?: number; readonly attack?: number; readonly defense?: number; readonly agility?: number }): void {
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy_training_slime");
    enemy.stats = {
      ...enemy.stats,
      maxHp: stats.maxHp ?? enemy.stats.maxHp,
      attack: stats.attack ?? enemy.stats.attack,
      defense: stats.defense ?? enemy.stats.defense,
      agility: stats.agility ?? enemy.stats.agility,
    };
  }
  function partyProgress(partyActorIds: readonly string[], vitals: Record<string, { hp: number; mp: number }> = {}) {
    return {
      levels: Object.fromEntries(partyActorIds.map((actorId) => [actorId, 1])),
      experience: {},
      partyActorIds: [...partyActorIds],
      vitals,
    };
  }
  describe("battle active slots, switching, and battle events", () => {
    it("keeps only the front activeSlots actors on the battlefield and tracks participants", () => {
      const project = fourActorProject();
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: partyProgress(PARTY4),
      });

      const snapshot = runtime.snapshot();
      expect(snapshot.activeSlots).toBe(2);
      expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_warrior", "actor_mage"]);
      expect(snapshot.reserveActors.map((actor) => actor.recordId)).toEqual(["actor_rogue", "actor_priest"]);
      expect(snapshot.switchCandidateActorIds).toEqual(["actor_rogue", "actor_priest"]);
      expect(snapshot.participatingActorIds).toEqual(["actor_warrior", "actor_mage"]);
    });

    it("resolves strict switch commands before faster enemies and records switched-in participants", () => {
      const project = fourActorProject();
      setActorParam(project, "actor_warrior", "agility", 1);
      setActorParam(project, "actor_mage", "agility", 2);
      setEnemyStats(project, { maxHp: 999, attack: 40, agility: 80 });
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        activeSlots: 1,
        party: partyProgress(PARTY4),
        rng: () => 0.99,
      });

      const incomingHpBefore = runtime.snapshot().reserveActors.find((actor) => actor.recordId === "actor_rogue")?.hp;

      runtime.performActorCommand({ kind: "switch", targetActorId: "actor_rogue" });

      const snapshot = runtime.snapshot();
      const firstRound = snapshot.roundLogs[0];
      expect(firstRound?.actions[0]).toMatchObject({ userRecordId: "actor_warrior", commandKind: "switch" });
      expect(firstRound?.actions.map((action) => action.userRecordId)).toEqual(["actor_warrior", "enemy_training_slime"]);
      expect(firstRound?.participatingActorIds).toEqual(["actor_warrior", "actor_rogue"]);
      expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_rogue"]);
      expect(snapshot.reserveActors.map((actor) => actor.recordId)).toEqual(["actor_warrior", "actor_mage", "actor_priest"]);
      expect(snapshot.actors.find((actor) => actor.recordId === "actor_rogue")?.hp).toBeLessThan(incomingHpBefore ?? 0);
    });

    it("requires forced switch for defeated active actors and excludes defeated reserves", () => {
      const project = fourActorProject();
      const partyActorIds = ["actor_warrior", "actor_mage", "actor_rogue"];
      setActorParam(project, "actor_warrior", "agility", 1);
      setEnemyStats(project, { maxHp: 999, attack: 999, agility: 99 });
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        activeSlots: 1,
        party: partyProgress(partyActorIds, { actor_rogue: { hp: 0, mp: 0 } }),
        rng: () => 0.99,
      });

      runtime.performActorCommand({ kind: "defend" });
      expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");
      expect(runtime.snapshot().switchCandidateActorIds).toEqual(["actor_mage"]);

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");

      runtime.performActorCommand({ kind: "switch", targetActorId: "actor_rogue" });
      expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");

      runtime.performActorCommand({ kind: "switch", targetActorId: "actor_mage" });
      const snapshot = runtime.snapshot();
      expect(snapshot.forcedSwitchActorId).toBeUndefined();
      expect(snapshot.activeActorId).toBe("actor_mage");
      expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_mage"]);
      expect(snapshot.reserveActors.find((actor) => actor.recordId === "actor_rogue")?.defeated).toBe(true);
    });

    it("handles gauge-mode switch immediately and resets active gauges", () => {
      const project = fourActorProject();
      const partyActorIds = ["actor_warrior", "actor_mage"];
      setActorParam(project, "actor_warrior", "agility", 999);
      setEnemyStats(project, { maxHp: 999, attack: 1, agility: 1 });
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "gauge",
        activeSlots: 1,
        party: partyProgress(partyActorIds),
        rng: () => 0.99,
      });

      runtime.tick(1_000);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.performActorCommand({ kind: "switch", targetActorId: "actor_mage" });

      const snapshot = runtime.snapshot();
      expect(snapshot.phase).toBe("charging");
      expect(snapshot.activeActorId).toBeUndefined();
      expect(snapshot.actors.map((actor) => [actor.recordId, actor.gauge])).toEqual([["actor_mage", 0]]);
      expect(snapshot.reserveActors.map((actor) => [actor.recordId, actor.gauge])).toEqual([["actor_warrior", 0]]);
    });

    it("fires onRound/everyRound/enemyHpBelow/switch pages, runOnce pages, and battle event UI commands", () => {
      const project = strictProject();
      project.switches.push(
        { id: "sw_gate", name: "게이트" },
        { id: "sw_round", name: "라운드" },
        { id: "sw_seen", name: "스위치 확인" },
        { id: "sw_choice", name: "선택지" },
        { id: "sw_common", name: "커먼" }
      );
      project.variables.push({ id: "var_every", name: "매 라운드" });
      project.session.switches = { sw_gate: true };
      project.commonEvents.push({
        id: "ce_battle_common",
        name: "전투 커먼",
        trigger: "none",
        commands: [
          { kind: "setSwitch", switchId: "sw_common", value: true },
          { kind: "changeActorMp", actorId: "actor_warrior", op: "-=", amount: 3 },
        ],
      });
      const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
      if (!troop) throw new Error("missing troop_strict_training");
      troop.activeSlots = 1;
      troop.battleEventPages = [
        {
          id: "page_round",
          name: "1라운드",
          conditions: [{ kind: "onRound", round: 1 }],
          span: "moment",
          runOnce: true,
          commands: [
            { kind: "setSwitch", switchId: "sw_round", value: true },
            { kind: "text", speaker: "보스", body: "전투 이벤트 대사" },
            {
              kind: "choices",
              prompt: "응답",
              options: [{ text: "계속", branch: [{ kind: "setSwitch", switchId: "sw_choice", value: true }] }],
            },
            { kind: "callCommonEvent", commonEventId: "ce_battle_common" },
            { kind: "wait", ms: 1 },
          ],
        },
        {
          id: "page_every",
          name: "매 라운드",
          conditions: [{ kind: "everyRound", start: 1, interval: 1 }],
          span: "moment",
          runOnce: false,
          commands: [{ kind: "setVariable", variableId: "var_every", op: "+=", value: 1 }],
        },
        {
          id: "page_switch",
          name: "스위치",
          conditions: [{ kind: "switch", switchId: "sw_gate", value: true }],
          span: "moment",
          runOnce: true,
          commands: [{ kind: "setSwitch", switchId: "sw_seen", value: true }],
        },
        {
          id: "page_half",
          name: "HP 절반",
          conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_training_slime", percent: 50 }],
          span: "moment",
          runOnce: true,
          commands: [{ kind: "text", speaker: "보스", body: "이제 절반이다" }],
        },
      ];
      setActorParam(project, "actor_warrior", "attack", 40);
      setActorParam(project, "actor_warrior", "agility", 99);
      setActorParam(project, "actor_warrior", "maxMp", 10);
      setEnemyStats(project, { maxHp: 100, attack: 1, defense: 0, agility: 1 });
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        activeSlots: 1,
        party: partyProgress(["actor_warrior"]),
        rng: () => 0.99,
      });

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const text = runtime.snapshot().eventPause;
      expect(text).toMatchObject({ kind: "text" });
      if (!text) throw new Error("missing opening text");
      expect(runtime.snapshot().eventState.switches.sw_choice).toBeUndefined();
      expect(runtime.resumeEventPause(text.id, { kind: "text" })).toBe(true);
      expect(runtime.snapshot().phase).toBe("eventChoice");
      const request = runtime.snapshot().eventChoice;
      if (!request) throw new Error("missing battle event choice");
      expect(runtime.resumeEventChoice(request.id, 0)).toBe(true);
      const wait = runtime.snapshot().eventPause;
      expect(wait).toMatchObject({ kind: "wait", ms: 1 });
      if (!wait) throw new Error("missing common-call wait");
      expect(runtime.snapshot().eventState.variables.var_every ?? 0).toBe(0);
      expect(runtime.resumeEventPause(wait.id, { kind: "wait" })).toBe(true);
      const half = runtime.snapshot().eventPause;
      expect(half).toMatchObject({ kind: "text" });
      if (!half) throw new Error("missing HP-half text");
      expect(runtime.resumeEventPause(half.id, { kind: "text" })).toBe(true);
      runtime.performActorCommand({ kind: "defend" });

      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.switches).toMatchObject({
        sw_round: true,
        sw_seen: true,
        sw_choice: true,
        sw_common: true,
      });
      expect(snapshot.eventState.variables.var_every).toBe(2);
      expect(snapshot.actors[0]?.mp).toBe(7);
      expect(snapshot.eventLogs.filter((log) => log.pageId === "page_switch" && log.kind === "fired")).toHaveLength(1);
      expect(snapshot.eventLogs.filter((log) => log.pageId === "page_half" && log.kind === "message")).toHaveLength(1);
      expect(snapshot.eventLogs.filter((log) => log.pageId === "page_every" && log.kind === "fired").map((log) => log.round)).toEqual([1, 2]);
      expect(snapshot.eventLogs.some((log) => log.kind === "choices" && log.detail?.includes("응답"))).toBe(true);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "wait 1ms")).toBe(true);
    });

    it("simulateBattle strict script logs active-slot boss switch participation and HP50 event", () => {
      const result = simulateBattle({
        project: bossProject(),
        troopId: "troop_active_slot_boss",
        heroLevel: 1,
        battleFlow: "strict",
        activeSlots: 2,
        partyActorIds: ["actor_a", "actor_b", "actor_c", "actor_d"],
        seed: 17,
        n: 1,
        maxSteps: 4,
        strictScript: [
          [
            { actorId: "actor_a", command: "attack", target: "enemy-1" },
            { actorId: "actor_b", command: "attack", target: "enemy-1" },
          ],
          [
            { actorId: "actor_a", command: "switch", switchActorId: "actor_c" },
            { actorId: "actor_b", command: "attack", target: "enemy-1" },
          ],
        ],
      });

      expect(result.roundLogs).toHaveLength(2);
      expect(result.roundLogs[1]?.actions[0]).toMatchObject({ userRecordId: "actor_a", commandKind: "switch" });
      expect(result.participatingActorIds).toEqual(["actor_a", "actor_b", "actor_c"]);
      expect(result.eventLogs).toContainEqual(expect.objectContaining({
        pageId: "page_boss_half",
        round: 2,
        kind: "message",
        detail: "보스: 아직 끝나지 않았다",
      }));
    });
  });
  // Step 3(2026-08-20) Tier-1 배틀 이벤트 커맨드 회귀 스펙.
  // 하네스는 battleEventsSelfSwitch.test.ts 관례(battle-v3 + troop_slime + defend 1액션)와 동일.
  describe("battle event Tier-1 commands (Step 3)", () => {
    const PAGE_ID = "page_tier1";

    function tier1Project(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }

    function runPage(project: Project, commands: readonly Command[]) {
      const troop = project.database.troops.find((record) => record.id === "troop_slime");
      if (!troop) throw new Error("missing troop_slime");
      troop.battleEventPages = [{
        id: PAGE_ID,
        name: "Tier-1",
        conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
        span: "battle",
        commands: [...commands],
      }];
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "defend" });
      return runtime;
    }

    it("gotoLabel 은 라벨까지의 명령을 건너뛰고 라벨 이후를 실행한다", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        { kind: "setSwitch", switchId: "sw_a", value: true },
        { kind: "gotoLabel", name: "skip" },
        { kind: "setSwitch", switchId: "sw_b", value: true },
        { kind: "label", name: "skip" },
        { kind: "setSwitch", switchId: "sw_c", value: true },
      ]);
      const switches = runtime.snapshot().eventState.switches;
      expect(switches.sw_a).toBe(true);
      expect(switches.sw_b).toBeUndefined();
      expect(switches.sw_c).toBe(true);
    });

    it("fork 분기 안에서 페이지 최상위 라벨로 점프한다(맵 gotoLabel 과 동형의 스택 탐색)", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        {
          kind: "fork",
          // 미설정 스위치는 false → value:false 조건은 참(분기 진입).
          condition: { kind: "switch", switchId: "sw_unset", value: false },
          then: [
            { kind: "gotoLabel", name: "out" },
            { kind: "setSwitch", switchId: "sw_skipped_inside", value: true },
          ],
        },
        { kind: "setSwitch", switchId: "sw_skipped_mid", value: true },
        { kind: "label", name: "out" },
        { kind: "setSwitch", switchId: "sw_end", value: true },
      ]);
      const switches = runtime.snapshot().eventState.switches;
      expect(switches.sw_end).toBe(true);
      expect(switches.sw_skipped_inside).toBeUndefined();
      expect(switches.sw_skipped_mid).toBeUndefined();
    });

    it("미진입 fork 분기 안의 라벨은 찾지 못하고 unsupported 로그 후 계속 진행한다(보수적 스코프)", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_unset", value: true },
          then: [{ kind: "label", name: "inner" }],
        },
        { kind: "gotoLabel", name: "inner" },
        { kind: "setSwitch", switchId: "sw_after", value: true },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.switches.sw_after).toBe(true);
      expect(snapshot.eventLogs.some((log) => log.kind === "unsupported" && log.detail === "missing label: inner")).toBe(true);
    });

    it("loop 는 breakLoop 로 탈출하고 루프 다음 명령을 이어 실행한다", () => {
      const project = tier1Project();
      project.variables.push({ id: "var_count", name: "카운트" });
      const runtime = runPage(project, [
        {
          kind: "loop",
          body: [
            { kind: "setVariable", variableId: "var_count", op: "+=", value: 1 },
            {
              kind: "fork",
              condition: { kind: "variable", variableId: "var_count", op: ">=", value: 3 },
              then: [{ kind: "breakLoop" }],
            },
          ],
        },
        { kind: "setSwitch", switchId: "sw_after_loop", value: true },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.variables.var_count).toBe(3);
      expect(snapshot.eventState.switches.sw_after_loop).toBe(true);
    });

    it("탈출 없는 loop 는 반복 상한 가드로 종료하고 unsupported 로그를 남긴다", () => {
      const project = tier1Project();
      project.variables.push({ id: "var_guard", name: "가드" });
      const runtime = runPage(project, [
        { kind: "loop", body: [{ kind: "setVariable", variableId: "var_guard", op: "+=", value: 1 }] },
        { kind: "setSwitch", switchId: "sw_after_guard", value: true },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.variables.var_guard).toBe(10_000);
      expect(snapshot.eventState.switches.sw_after_guard).toBe(true);
      expect(snapshot.eventLogs.some((log) => log.kind === "unsupported" && log.detail === "loop iteration limit reached")).toBe(true);
    });

    it("setFlag/timer 는 배틀 이벤트 state 에 기록되고 전투 종료 시 세션으로 write-back 된다", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        { kind: "setFlag", flag: "flag_boss_seen", value: true },
        { kind: "timer", action: "set", seconds: 90, timerId: "timer1" },
        { kind: "timer", action: "start", seconds: 45, timerId: "timer2" },
        { kind: "timer", action: "stop", timerId: "timer2" },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.flags?.flag_boss_seen).toBe(true);
      expect(snapshot.eventState.timers?.timer1).toBe(90);
      // stop 은 남은 초를 유지한다(진행/정지는 맵 씬 소관).
      expect(snapshot.eventState.timers?.timer2).toBe(45);

      const session = startSession(project);
      applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
        project
      );
      expect(session.flags.flag_boss_seen).toBe(true);
      expect(session.timers.timer1).toBe(90);
      expect(session.timers.timer2).toBe(45);
    });

    it("showAnimation 은 showBattleAnimation 콜백으로 라우팅되어 lastAnimation 을 세팅한다", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        { kind: "showAnimation", target: "player", animationId: "anim_hit" },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.lastAnimation?.animationId).toBe("anim_hit");
      // "player" 타깃은 행동 중 액터(방어한 영웅)의 배틀러 id 로 해석된다.
      expect(snapshot.lastAnimation?.targetId).toBe(snapshot.actors[0]?.id);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "showAnimation anim_hit")).toBe(true);
    });

    it("gameOver 는 defeat 결과로 매핑되어 전투를 즉시 종결한다(후처리는 canLose 의미론)", () => {
      const project = tier1Project();
      const runtime = runPage(project, [{ kind: "gameOver" }]);
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("defeat");
      expect(snapshot.phase).toBe("resolved");
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "gameOver→defeat")).toBe(true);
    });

    it("killPlayer 는 액터 HP 를 0 으로 만들고 defeat 로 종결한다", () => {
      const project = tier1Project();
      const runtime = runPage(project, [{ kind: "killPlayer", message: "쓰러졌다" }]);
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("defeat");
      expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "killPlayer→defeat 쓰러졌다")).toBe(true);
    });

    it("changeFace/displayTextSettings 는 메시지 스트립 프레젠테이션 로그를 남긴다", () => {
      const project = tier1Project();
      const runtime = runPage(project, [
        { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-02", position: "left", flipHorizontally: false },
        { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false },
      ]);
      const logs = runtime.snapshot().eventLogs;
      expect(logs.some((log) => log.kind === "message" && log.detail === "changeFace easyrpg-faceset-actor1-02")).toBe(true);
      expect(logs.some((log) => log.kind === "message" && log.detail === "displayTextSettings normal/bottom")).toBe(true);
    });
  });
  // Step 3d(2026-08-20) — RM2K3 배틀 허용 커맨드 changeEquipment/promoteActor 회귀 스펙.
  // 스탯 재계산은 battleBattlers 생성 산식과 공유(refreshActorBattlerDerivedStats)되고,
  // HP/MP/게이지/상태이상은 보존(새 최대치 클램프만), 전투 종료 시 세션 write-back(canLose 의미론).
  describe("battle event equipment/class commands (Step 3d)", () => {
    const EQUIP_ID = "equip_champion_sword";
    const ORB_ID = "item_orb";

    function flatCurve(value: number): number[] {
      return Array.from({ length: 99 }, () => value);
    }

    // strict 흐름 + rng()=0.5(분산 계수 정확히 1.0, 크리티컬 없음) — 데미지가 결정론 정수로 떨어진다.
    function equipProject(): Project {
      const project = strictProject();
      project.database.equipment.push(normalizeEquipmentRecord({
        id: EQUIP_ID,
        name: "챔피언 검",
        slot: "weapon",
        statBonuses: { attack: 24, defense: 0, mind: 0, agility: 0 },
        equippableClassIds: ["class_warrior"],
      }));
      project.session.inventory = { ...project.session.inventory, [EQUIP_ID]: 1 };
      const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
      if (!troop) throw new Error("missing troop_strict_training");
      troop.battleEventPages = [{
        id: "page_equip",
        name: "장비 변경",
        conditions: [{ kind: "actorCommand", actorId: "actor_warrior", commandId: "defend" }],
        span: "battle",
        commands: [{ kind: "changeEquipment", actorId: "actor_warrior", slot: "weapon", equipmentId: EQUIP_ID }],
      }];
      return project;
    }

    function runEquipBattle(project: Project) {
      return createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        activeSlots: 1,
        party: partyProgress(["actor_warrior"]),
        rng: () => 0.5,
      });
    }

    it("changeEquipment 는 배틀러 공격력을 재계산해(HP/MP 보존) 후속 공격 데미지에 반영한다", () => {
      const runtime = runEquipBattle(equipProject());
      const before = runtime.snapshot().actors[0]!;
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      // 적 반격으로 HP 가 실제로 깎인 상태를 기준선으로 잡는다. 예전에는 이 적의 공격이
      // 정확히 0 이라 "HP 보존" 단정이 우연히 성립했다 — 방어 관통 하한(MIN_DAMAGE_RATIO)
      // 도입 후에는 초반 적도 최소한 조금은 깎는다.
      const damaged = runtime.snapshot().actors[0]!;
      expect(damaged.hp).toBeLessThan(damaged.maxHp);
      runtime.performActorCommand({ kind: "defend" }); // 페이지 발화 → 장비 변경
      const mid = runtime.snapshot().actors[0]!;
      expect(mid.effectiveStats?.attack).toBe((before.effectiveStats?.attack ?? 0) + 24);
      expect(mid.maxHp).toBe(before.maxHp);
      // 이 단정의 목적은 "장비 교체가 HP/MP 를 최대치로 리셋하지 않는다" 다.
      expect(mid.hp).toBeLessThanOrEqual(damaged.hp);
      expect(mid.mp).toBe(before.mp);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const snapshot = runtime.snapshot();
      const actorDamage = snapshot.timeline
        .filter((entry) => entry.kind === "damage" && entry.side === "actor")
        .map((entry) => entry.amount ?? 0);
      expect(actorDamage).toHaveLength(2);
      // 통상공격 위력은 attackPower + floor(attackPower/2): +24 장비 → 정확히 +36 데미지.
      expect(actorDamage[1]! - actorDamage[0]!).toBe(36);
      expect(snapshot.eventState.actorEquipment?.actor_warrior?.weapon).toBe(EQUIP_ID);
      expect(snapshot.eventState.inventory[EQUIP_ID] ?? 0).toBe(0);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === `changeEquipment actor_warrior weapon=${EQUIP_ID}`)).toBe(true);
    });

    it("changeEquipment 는 승리 시 세션 장비/인벤토리로 write-back 되고 canLose=false 패배 시 미반영", () => {
      const project = equipProject();
      const runtime = runEquipBattle(project);
      runtime.performActorCommand({ kind: "defend" });
      const snapshot = runtime.snapshot();

      const session = startSession(project);
      applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
        project
      );
      expect(session.actorEquipment?.actor_warrior?.weapon).toBe(EQUIP_ID);
      expect(session.inventory[EQUIP_ID] ?? 0).toBe(0);

      const lost = startSession(project);
      applyBattleRewardsToSession(
        lost,
        { result: "defeat", canLose: false, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
        project
      );
      expect(lost.actorEquipment?.actor_warrior?.weapon).toBeUndefined();
      expect(lost.inventory[EQUIP_ID]).toBe(1);
    });

    // battle-v3(게이지 흐름) + class_champion 전직. 대조군(무전직)과 같은 명령 시퀀스를 돌려
    // "스탯 필드만 갱신"을 증명한다 — HP/MP/게이지/상태이상은 대조군과 완전 일치해야 한다.
    function promoteProject(pageCommands: readonly Command[]): Project {
      const project = deserialize(JSON.stringify(battleFixture));
      project.database.classes.push(normalizeClassRecord({
        id: "class_champion",
        name: "챔피언",
        parameterCurves: {
          maxHp: flatCurve(999),
          maxMp: flatCurve(99),
          attack: flatCurve(80),
          defense: flatCurve(30),
          mind: flatCurve(25),
          agility: flatCurve(70),
        },
        learnedSkills: [{ level: 1, skillId: "skill_claw" }],
        battleCommands: [{ id: "cmd_champion_strike", name: "강타", kind: "attack" }],
      }));
      project.database.items.push(normalizeItemRecord({ id: ORB_ID, name: "전직 보주" }));
      project.session.inventory = { ...project.session.inventory, [ORB_ID]: 1 };
      const troop = project.database.troops.find((record) => record.id === "troop_slime");
      if (!troop) throw new Error("missing troop_slime");
      troop.battleEventPages = [{
        id: "page_promote",
        name: "전직",
        conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
        span: "battle",
        commands: [...pageCommands],
      }];
      return project;
    }

    function setFighterPromotion(project: Project, requires: { itemId?: string; switchId?: string }): void {
      const fighter = project.database.classes.find((record) => record.id === "class_fighter");
      if (!fighter) throw new Error("missing class_fighter");
      fighter.promotions = [{ toClassId: "class_champion", requires }];
    }

    function runGaugeDefend(project: Project) {
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "defend" });
      return runtime;
    }

    const promoteCommand: Command = {
      kind: "promoteActor",
      actorId: "actor_hero",
      toClassId: "class_champion",
      successBranch: [{ kind: "setSwitch", switchId: "sw_promoted", value: true }],
      failureBranch: [{ kind: "setSwitch", switchId: "sw_promo_failed", value: true }],
    };

    it("promoteActor 는 전투 중 전직을 실행해 클래스/스탯/커맨드/스킬을 재계산하고 HP·MP·게이지를 보존한다", () => {
      const promotedProject = promoteProject([promoteCommand]);
      setFighterPromotion(promotedProject, { itemId: ORB_ID });
      const controlProject = promoteProject([{ kind: "setSwitch", switchId: "sw_control", value: true }]);
      setFighterPromotion(controlProject, { itemId: ORB_ID });

      const promoted = runGaugeDefend(promotedProject);
      const control = runGaugeDefend(controlProject);
      const promotedActor = promoted.snapshot().actors[0]!;
      const controlActor = control.snapshot().actors[0]!;

      expect(promotedActor.classId).toBe("class_champion");
      expect(controlActor.classId).toBe("class_fighter");
      expect(promotedActor.effectiveStats?.attack).toBe(80);
      expect(promotedActor.maxHp).toBe(999);
      // 재생성이 아니라 스탯 필드만 갱신 — 현재 HP/MP/게이지/상태이상은 대조군과 동일해야 한다.
      expect(promotedActor.hp).toBe(controlActor.hp);
      expect(promotedActor.mp).toBe(controlActor.mp);
      expect(promotedActor.gauge).toBe(controlActor.gauge);
      expect(promotedActor.stateIds).toEqual(controlActor.stateIds);
      // 클래스 스킬 즉시 학습 + 기존 습득 스킬 유지.
      expect(promotedActor.skillIds).toContain("skill_claw");
      expect(promotedActor.skillIds).toContain("skill_fire");
      // 배틀 커맨드가 새 클래스에서 온다(배틀 DOM 은 snapshot.classId 로 메뉴를 해석).
      const commands = battleCommandsForActor(promotedProject, "actor_hero", { classId: promotedActor.classId });
      expect(commands[0]?.id).toBe("cmd_champion_strike");

      const eventState = promoted.snapshot().eventState;
      expect(eventState.classOverrides?.actor_hero).toBe("class_champion");
      expect(eventState.flags?.promoteActorSuccess).toBe(true);
      expect(eventState.switches.sw_promoted).toBe(true);
      expect(eventState.switches.sw_promo_failed).toBeUndefined();
      expect(eventState.inventory[ORB_ID] ?? 0).toBe(0); // 승급 요구 아이템 소모
    });

    it("promoteActor 는 승리 시 세션 classOverrides/바이탈/스킬로 write-back 되고 canLose=false 패배 시 미반영", () => {
      const project = promoteProject([promoteCommand]);
      setFighterPromotion(project, { itemId: ORB_ID });
      const runtime = runGaugeDefend(project);
      const snapshot = runtime.snapshot();

      const session = startSession(project);
      applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
        project
      );
      expect(session.classOverrides?.actor_hero).toBe("class_champion");
      // 전직 write-back 은 바이탈보다 먼저 새 클래스 최대치를 세우고, 전투 HP 를 그 안에 클램프한다.
      expect(session.actorVitals.actor_hero?.maxHp).toBe(999);
      expect(session.actorVitals.actor_hero?.hp).toBe(snapshot.actors[0]?.hp);
      expect(session.actorSkillIds.actor_hero).toContain("skill_claw");
      expect(session.inventory[ORB_ID] ?? 0).toBe(0);

      const lost = startSession(project);
      applyBattleRewardsToSession(
        lost,
        { result: "defeat", canLose: false, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
        project
      );
      expect(lost.classOverrides?.actor_hero).toBeUndefined();
      expect(lost.inventory[ORB_ID]).toBe(1);
    });

    it("promoteActor 요건 미충족 시 failureBranch 를 실행하고 상태를 바꾸지 않는다", () => {
      const project = promoteProject([promoteCommand]);
      setFighterPromotion(project, { switchId: "sw_never" }); // 꺼진 스위치 요건 → 실패
      const runtime = runGaugeDefend(project);
      const snapshot = runtime.snapshot();

      expect(snapshot.actors[0]?.classId).toBe("class_fighter");
      expect(snapshot.eventState.classOverrides?.actor_hero).toBeUndefined();
      expect(snapshot.eventState.flags?.promoteActorSuccess).toBe(false);
      expect(snapshot.eventState.switches.sw_promo_failed).toBe(true);
      expect(snapshot.eventState.switches.sw_promoted).toBeUndefined();
      expect(snapshot.eventState.inventory[ORB_ID]).toBe(1);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "promoteActor failed: requirements-not-met")).toBe(true);
    });
  });
});

describe("battleEventDialoguePresentation", () => {
  isolateTimers();
  const settings = {
    format: "transparent", position: "top", preventObscuringPlayer: false,
    allowEventMovementDuringWait: true,
  } as const satisfies MessageWindowSettings;
  const changeSettings = { kind: "displayTextSettings", ...settings } as const;
  const face = { resourceId: "face-test", position: "right", flipHorizontally: true } as const;
  for (const flow of ["gauge", "strict"] as const) describe(`battle dialogue / ${flow}`, () => {
    it.each(ROUTES)("%s text suspends with authored face/settings and clears the next face", route => {
      const { runtime, tails } = battleCase({ flow, route, commands: [
        { kind: "changeFace", ...face }, changeSettings,
        { kind: "text", speaker: "Guard", body: "First\nSecond", emotion: "angry", autoAdvance: false },
        mark("afterText"), { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
        { kind: "text", body: "Face cleared", autoAdvance: true }, mark("finished"),
      ] });
      runtime.performActorCommand({ kind: "defend" });
      expect(variables(runtime).afterText ?? 0, "text must block later commands until presentation completes").toBe(0);
      const first = eventPause(runtime);
      expect(first).toMatchObject({
        kind: "text", speaker: "Guard", body: "First\nSecond", face, settings,
        emotion: "angry", autoAdvance: false,
      });
      for (const id of tails) expect(variables(runtime)[id]).toBe(0);
      acknowledge(runtime, first.id, { kind: "text" });
      const second = eventPause(runtime);
      assert.equal(second.kind, "text");
      expect(second.face).toBeUndefined();
      expect(second.settings).toEqual(settings);
      expect(second.autoAdvance).toBe(true);
      expect(variables(runtime).afterText).toBe(1);
      expect(variables(runtime).finished ?? 0).toBe(0);
      expect(acknowledge(runtime, first.id, { kind: "text" })).toBe(false);
      acknowledge(runtime, second.id, { kind: "text" });
      for (const id of tails) expect(variables(runtime)[id]).toBe(1);
      expect(variables(runtime).finished).toBe(1);
    });

    it("choices inherit settings changed inside a nested call", () => {
      const { runtime } = battleCase({ flow, route: "mixed", commands: [changeSettings, choice()] });
      runtime.performActorCommand({ kind: "defend" });
      expect(runtime.snapshot().eventChoice, "choices must use battle-local settings rather than stale session settings")
        .toMatchObject({ settings });
      resume(runtime, pending(runtime), 1);
      expect(variables(runtime)).toMatchObject({ second: 1, after: 1, later: 1 });
    });

    it("inherits the captured session settings before any local settings command", () => {
      const { project } = battleCase({ flow, commands: [{ kind: "text", body: "Inherited" }] });
      const options = {
        project, troopId: TROOP, battleFlow: flow, canEscape: false, canLose: true,
        party: { partyActorIds: [ACTOR], levels: { [ACTOR]: 1 }, experience: {} },
        sessionState: { switches: {}, variables: {}, inventory: {}, messageWindowSettings: settings },
        rng: () => 0.5,
      };
      const runtime = createBattleRuntime(options);
      if (flow === "gauge") runtime.tick(1_000_000);
      runtime.performActorCommand({ kind: "defend" });
      expect(variables(runtime).after ?? 0).toBe(0);
      expect(eventPause(runtime)).toMatchObject({ kind: "text", settings });
      runtime.cancel();
    });

    it("cancels text without executing parent tails or returning an outcome", () => {
      const { runtime } = battleCase({ flow, route: "mixed", commands: [
        { kind: "text", body: "Pending" }, mark("afterText"),
      ] });
      runtime.performActorCommand({ kind: "defend" });
      expect(variables(runtime).afterText ?? 0).toBe(0);
      const request = eventPause(runtime);
      runtime.cancel();
      expect(acknowledge(runtime, request.id, { kind: "text" })).toBe(false);
      expect(variables(runtime)).toMatchObject({ after: 0, later: 0, tail_0: 0, tail_1: 0, tail_2: 0 });
      expect(runtime.snapshot().result).toBeUndefined();
    });
  });
  describe("battle message settings return policy", () => {
    it.each([
      { result: "victory", canLose: false, returns: true },
      { result: "escape", canLose: false, returns: true },
      { result: "defeat", canLose: true, returns: true },
      { result: "defeat", canLose: false, returns: false },
    ] as const)("$result / canLose=$canLose writes settings only when returning", ({ result, canLose, returns }) => {
      const terminal: Command = result === "defeat" ? { kind: "gameOver" }
        : result === "escape" ? m2("m2-105-abort-battle")
        : m2("m2-098-change-enemy-hp", { target: "all", operation: "set", value: 0 });
      const { runtime, project } = battleCase({ flow: "strict", commands: [changeSettings, terminal] });
      const session = startSession(project, 9);
      const before = { ...session.messageWindowSettings };
      runtime.performActorCommand({ kind: "defend" });
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe(result);
      applyBattleRewardsToSession(session, {
        result, canLose, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState,
      }, project);
      expect(session.messageWindowSettings).toEqual(returns ? settings : before);
    });

    it("a battle that did not change settings preserves a newer session value", () => {
      const { runtime, project } = battleCase({ flow: "strict", commands: [m2("m2-105-abort-battle")] });
      const session = startSession(project, 9);
      runtime.performActorCommand({ kind: "defend" });
      session.messageWindowSettings = { ...settings };
      const snapshot = runtime.snapshot();
      applyBattleRewardsToSession(session, {
        result: "escape", rewards: snapshot.rewards, eventState: snapshot.eventState,
      }, project);
      expect(session.messageWindowSettings).toEqual(settings);
    });
  });
});

describe("battleEventRepairState", () => {
  isolateTimers();
  function run(commands: Command[], canLose = true) {
    const project = deserialize(JSON.stringify(fixture));
    project.database.actors = project.database.actors.map(actor => actor.id === "actor_hero" ? {
      ...actor,
      initialEquipment: {},
      parameterCurves: {
        maxHp: Array.from({ length: 99 }, (_, i) => (i + 1) * 100),
        maxMp: Array(99).fill(40),
        attack: Array.from({ length: 99 }, (_, i) => (i + 1) * 10),
        defense: Array(99).fill(10),
        mind: Array(99).fill(20),
        agility: Array(99).fill(99),
      },
    } : actor);
    const enemy = project.database.enemies.find(entry => entry.id === "enemy_slime");
    const troop = project.database.troops.find(entry => entry.id === "troop_slime");
    if (!enemy || !troop) throw new Error("Missing battle repair fixture records");
    enemy.stats = { ...enemy.stats, maxHp: 5000, maxMp: 40, attack: 1, agility: 1 };
    troop.battleEventPages = [{
      id: "repair", name: "State repair", span: "battle",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      commands,
    }];
    const session = startSession(project);
    session.friendship = { audit_npc: 37, untouched_npc: 10 };
    session.actorLevels.actor_hero = 7;
    session.actorEquipment.actor_hero = {};
    session.actorVitals.actor_hero = { hp: 300, maxHp: 700, mp: 20, maxMp: 40 };
    const runtime = createBattleRuntime({
      project, troopId: troop.id, canEscape: false, canLose, battleFlow: "gauge",
      rng: () => 0.5, sessionState: session,
      party: {
        partyActorIds: ["actor_hero"], levels: { actor_hero: 7 }, experience: {},
        equipment: session.actorEquipment, vitals: session.actorVitals,
      },
    });
    runtime.tick(1000);
    const before = runtime.snapshot();
    expect(before.phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "defend" });
    return { project, session, runtime, before, after: runtime.snapshot() };
  }
  describe("battle event state reaches battlers and the returning session", () => {
    it.each([
      ["escape", true], ["victory", true], ["defeat", true], ["defeat", false],
    ] as const)("preserves friendship for %s with canLose=%s", (outcome, canLose) => {
      // Given: actual result production, not a mocked reward outcome.
      const terminal: Command = outcome === "escape"
        ? { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} }
        : outcome === "defeat"
          ? { kind: "killPlayer" }
          : { kind: "m2Command", commandId: "m2-098-change-enemy-hp",
            fields: { target: "enemy-1", operation: "remove", value: 9999 } };
      const result = run([
        { kind: "changeFriendship", npcKey: "audit_npc", delta: 19 },
        { kind: "getFriendship", npcKey: "audit_npc", variableId: "friendship_read" },
        terminal,
      ], canLose);
      // When: the real battle snapshot is written back through the real bridge.
      expect(result.after.eventState.variables.friendship_read).toBe(56);
      expect(result.session.friendship?.audit_npc).toBe(37);
      expect(result.after.result).toBe(outcome);
      if (!result.after.result) throw new Error("Battle did not resolve");
      applyBattleRewardsToSession(result.session, {
        result: result.after.result, canLose, rewards: result.after.rewards,
        actors: result.after.actors, eventState: result.after.eventState,
      }, result.project);
      // Then: a nonreturning defeat alone does not commit play state.
      expect(result.session.friendship?.audit_npc).toBe(outcome === "defeat" && !canLose ? 37 : 56);
    });

    it("updates current battler level and derived stats without healing or changing equipment", () => {
      const result = run([{ kind: "changeLevel", actorId: "actor_hero", op: "+=", amount: 4 }]);
      const before = result.before.actors[0];
      const after = result.after.actors[0];
      if (!before || !after) throw new Error("Missing hero battler");
      expect(before.level).toBe(7);
      expect(before.maxHp).toBe(700);
      expect(before.effectiveStats?.attack).toBe(70);
      expect(after.level).toBe(11);
      expect(after.maxHp).toBe(1100);
      expect(after.effectiveStats?.attack).toBe(110);
      expect(after.hp).toBe(300);
      expect(after.mp).toBe(20);
      expect(result.after.eventState.actorEquipment).toEqual(result.before.eventState.actorEquipment);
    });

    it("clamps current HP to the lowered maximum without changing MP", () => {
      const result = run([{ kind: "changeLevel", actorId: "actor_hero", op: "-=", amount: 5 }]);
      const after = result.after.actors[0];
      if (!after) throw new Error("Missing hero battler");
      expect(after.level).toBe(2);
      expect(after.maxHp).toBe(200);
      expect(after.hp).toBe(200);
      expect(after.mp).toBe(20);
    });

    it("writes only battle-mutated friendship keys back to a live session", () => {
      const result = run([
        { kind: "changeFriendship", npcKey: "audit_npc", delta: 19 },
        { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} },
      ]);
      result.session.friendship = { ...result.session.friendship, untouched_npc: 777 };
      expect(result.after.eventState).toMatchObject({ friendship: { audit_npc: 56 } });
      if (!result.after.result) throw new Error("Battle did not resolve");
      applyBattleRewardsToSession(result.session, {
        result: result.after.result, canLose: true, rewards: result.after.rewards,
        actors: result.after.actors, eventState: result.after.eventState,
      }, result.project);
      expect(result.session.friendship).toMatchObject({ audit_npc: 56, untouched_npc: 777 });
    });

    it("returns changed maximum vitals after escape without healing", () => {
      const result = run([
        { kind: "changeLevel", actorId: "actor_hero", op: "+=", amount: 4 },
        { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} },
      ]);
      if (!result.after.result) throw new Error("Battle did not resolve");
      applyBattleRewardsToSession(result.session, {
        result: result.after.result, canLose: true, rewards: result.after.rewards,
        actors: result.after.actors, eventState: result.after.eventState,
      }, result.project);
      expect(result.session.actorLevels.actor_hero).toBe(11);
      expect(result.session.actorVitals.actor_hero).toEqual({ hp: 300, maxHp: 1100, mp: 20, maxMp: 40 });
    });
  });
});

describe("battleRewardsToSession", () => {
  isolateTimers();
  describe("battle rewards to play session", () => {
    it("grows a fallen actor's maximum HP without reviving them on level-up", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      const actor = normalizeActorRecord(project.database.actors.find((entry) => entry.id === actorId)!);
      const beforeMaxHp = session.actorVitals[actorId].maxHp;
      session.actorVitals[actorId].hp = 0;
      const levelUps = applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: totalExpForLevel(actor.expCurve, 40), gold: 0, items: [] },
      }, project);
      expect(levelUps.length).toBeGreaterThan(0);
      expect(session.actorVitals[actorId].maxHp).toBeGreaterThan(beforeMaxHp);
      expect(session.actorVitals[actorId].hp).toBe(0);
    });

    it("adds victory rewards to actor experience, gold, and inventory", () => {
      // Given: a play session with one party actor and no earned battle rewards.
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      expect(actorId).toBe("actor_hero");
      expect(session.actorExperience[actorId]).toBe(0);
      expect(session.gold).toBe(0);
      expect(session.inventory.item_bomb).toBeUndefined();

      // When: a victorious battle pays out EXP, gold, and an item drop.
      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
      }, project);

      // Then: the actual playable session carries the rewards forward.
      expect(session.actorExperience[actorId]).toBe(28);
      expect(session.gold).toBe(5);
      expect(session.inventory.item_bomb).toBe(1);
      expect(session.itemUseCharges).toEqual({});
    });

    it("grants duplicate reward entries as separate copies", () => {
      const project = createBlankProject();
      const session = startSession(project);

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: ["item_bomb", "item_bomb"] },
      }, project);

      expect(session.inventory.item_bomb).toBe(2);
    });

    it("preserves the finite-use FIFO cursor when victory grants another copy", () => {
      const project = createBlankProject();
      const finiteItem = project.database.items.find((item) => item.id === "item_bomb")!;
      finiteItem.consumable = true;
      finiteItem.consumptionLimit = 3;
      const session = startSession(project);
      session.inventory[finiteItem.id] = 1;
      session.itemUseCharges = { [finiteItem.id]: 2 };

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [finiteItem.id] },
      }, project);

      expect(session.inventory[finiteItem.id]).toBe(2);
      expect(session.itemUseCharges).toEqual({ [finiteItem.id]: 2 });
    });

    it("does not pay rewards for escape or defeat", () => {
      // Given: a fresh play session.
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0];

      // When: a non-victory result reports rewards in the battle snapshot.
      applyBattleRewardsToSession(session, {
        result: "escape",
        rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
      }, project);

      // Then: no victory reward leaks into the session.
      expect(session.actorExperience[actorId]).toBe(0);
      expect(session.gold).toBe(0);
      expect(session.inventory.item_bomb).toBeUndefined();
    });

    it("auto-levels the actor and grows vitals when victory exp crosses the curve", () => {
      // Given: a fresh session at level 1.
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      const hero = normalizeActorRecord(project.database.actors.find((entry) => entry.id === actorId)!);
      // 고레벨까지 올려 능력치 곡선 성장(양수)이 실제로 반영되는지 본다.
      const expForLevel40 = totalExpForLevel(hero.expCurve, 40);
      const beforeMaxHp = session.actorVitals[actorId].maxHp;

      // When: victory pays enough EXP to reach level 40.
      const levelUps = applyBattleRewardsToSession(
        session,
        { result: "victory", rewards: { exp: expForLevel40, gold: 0, items: [] } },
        project
      );

      // Then: the level, max vitals, and current vitals all advance.
      expect(session.actorLevels[actorId]).toBe(40);
      expect(session.actorVitals[actorId].maxHp).toBeGreaterThan(beforeMaxHp);
      expect(session.actorVitals[actorId].hp).toBe(session.actorVitals[actorId].maxHp);
      expect(levelUps.length).toBeGreaterThanOrEqual(1);
      expect(levelUps.every((entry) => entry.toLevel === 40)).toBe(true);
      expect(levelUps.some((entry) => entry.actorId === actorId)).toBe(true);
    });

    it("teaches skills learned at the newly reached level", () => {
      // Given: the hero learns skill_heal at level 2.
      const project = createBlankProject();
      const heroRecord = project.database.actors.find((entry) => entry.id === "actor_hero")!;
      heroRecord.learnedSkills = [
        { level: 1, skillId: "default_skill" },
        { level: 2, skillId: "skill_heal" },
      ];
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      const expForLevel2 = totalExpForLevel(normalizeActorRecord(heroRecord).expCurve, 2);

      // When: victory triggers the level-up.
      applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: expForLevel2, gold: 0, items: [] } }, project);

      // Then: the newly learned skill is added to the session skill list.
      expect(session.actorSkillIds[actorId]).toContain("skill_heal");
    });

    it("returns battle-end state ids to the play session", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      session.actorStateIds ??= {};
      session.actorStateIds[actorId] = ["state_poison", "state_attack_up"];

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [] },
        actors: [{
          id: actorId,
          recordId: actorId,
          name: "Hero",
          hp: 10,
          maxHp: 10,
          mp: 3,
          maxMp: 3,
          gauge: 0,
          defeated: false,
          defending: false,
          stateIds: ["state_poison"],
          skillIds: [],
        }],
      }, project);

      expect(session.actorStateIds?.[actorId]).toEqual(["state_poison"]);
    });

    it("pays monster EXP only to battlers recorded as participants", () => {
      // Break caught: deriving participants from active + reserve snapshots grants
      // victory EXP to a monster that never entered the battle.
      const project = createBlankProject();
      const session = startSession(project);
      const active = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
      const reserve = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
      if (!active.ok || !reserve.ok) throw new Error("expected two party monsters");
      // 선물·포획 몬스터는 그 레벨의 누적 경험치 바닥에서 시작한다(monsterCollection.giveMonster) — 증가분만 본다.
      const floor = active.instance.exp;
      const [activeSnapshot, reserveSnapshot] = monsterPartyBattlers(
        project,
        [active.instance, reserve.instance],
      ).map((battler) => battlerSnapshot(battler));

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 100, gold: 0, items: [] },
        actors: [activeSnapshot, reserveSnapshot],
        participatingActorIds: [active.instance.instanceId],
        monsterPartyMode: true,
      }, project);

      expect(session.monsterInstances[active.instance.instanceId]?.exp).toBe(floor + 100);
      expect(session.monsterInstances[reserve.instance.instanceId]?.exp).toBe(reserve.instance.exp);
    });

    it("keeps full live-monster-party EXP when regular actors fought", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const companion = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
      if (!companion.ok) throw new Error("expected a companion monster");
      const floor = companion.instance.exp;

      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 100, gold: 0, items: [] },
        participatingActorIds: [session.partyActorIds[0]!],
        monsterPartyMode: false,
      }, project);

      expect(session.monsterInstances[companion.instance.instanceId]?.exp).toBe(floor + 100);
    });

    // 타이머의 진행(tick)은 맵 씬 소관이고 전투는 진입 시점 사본만 들고 있다. 사본 전체를
    // 되돌려 쓰면 전투 중 만료된 타이머가 진입 값으로 되살아나고, 이후 프레임도 만료된
    // 타이머를 건너뛰므로 자동 교정되지 않는다(2026-09-15 실측: 세션 1초 / 런타임 0초).
    describe("battle timer write-back", () => {
      function sessionWithTimer(seconds: number) {
        const project = createBlankProject();
        const session = startSession(project);
        session.timers.timer1 = seconds;
        return { project, session };
      }

      it("does not resurrect a timer the battle never wrote", () => {
        const { project, session } = sessionWithTimer(0);

        applyBattleRewardsToSession(session, {
          result: "victory",
          rewards: { exp: 0, gold: 0, items: [] },
          eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 1 }, timerWrites: {} },
        }, project);

        expect(session.timers.timer1).toBe(0);
      });

      it("still writes back a timer the battle set", () => {
        const { project, session } = sessionWithTimer(0);

        applyBattleRewardsToSession(session, {
          result: "victory",
          rewards: { exp: 0, gold: 0, items: [] },
          eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 7 }, timerWrites: { timer1: 7 } },
        }, project);

        expect(session.timers.timer1).toBe(7);
      });

      it("merges the whole snapshot when the writer did not report its keys", () => {
        const { project, session } = sessionWithTimer(0);

        applyBattleRewardsToSession(session, {
          result: "victory",
          rewards: { exp: 0, gold: 0, items: [] },
          eventState: { switches: {}, variables: {}, inventory: {}, timers: { timer1: 3 } },
        }, project);

        expect(session.timers.timer1).toBe(3);
      });
    });
  });
});

describe("gen1MonsterLifecycle", () => {
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
  const MOVE_IDS = ["move_1", "move_2", "move_3", "move_4", "move_5"] as const;
  function move(id: string, maxPp?: number, mpCost = 0): SkillRecord {
    return normalizeSkillRecord({
      id,
      name: id,
      scope: "enemy",
      power: 10,
      description: "",
      type: "normal",
      mpCost: { flat: mpCost, percentMax: 0 },
      successRate: 100,
      variance: 0,
      hitRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      maxPp,
    });
  }
  function lifecycleProject(): Project {
    const project = createBlankProject();
    project.database.skills = [
      ...project.database.skills,
      move(MOVE_IDS[0], 10),
      move(MOVE_IDS[1], 20),
      move(MOVE_IDS[2], 30),
      move(MOVE_IDS[3], 40),
      move(MOVE_IDS[4], 50),
      move("legacy_move", undefined, 3),
    ];
    const species: MonsterSpeciesRecord = {
      id: "species_lifecycle",
      name: "Lifecycle",
      graphic: { graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 30, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
      expCurve: { base: 30, extra: 20, acceleration: 30 },
      captureRate: 0.5,
      skillsByLevel: MOVE_IDS.map((skillId, index) => ({ level: index + 1, skillId })),
    };
    project.database.monsterSpecies = [species];
    const poison = project.database.states.find((state) => state.id === "state_poison");
    if (poison) poison.gen1MajorStatus = "poison";
    project.system.monsterCollection = true;
    return project;
  }
  function instanceAtLevel(project: Project, level: number): { instance: MonsterInstance; session: ReturnType<typeof startSession> } {
    const session = startSession(project, 7);
    const given = giveMonster(project, session, { speciesId: "species_lifecycle", level });
    if (!given.ok) throw new Error("fixture monster was not created");
    return { instance: given.instance, session };
  }
  describe("Gen1 monster lifecycle", () => {
    it("keeps persistent status turns and PP when building and snapshotting a party battler", () => {
      // Break: monsterPartyBattlers used to hard-reset stateIds/stateTurns and omitted skillPp.
      const project = lifecycleProject();
      const { instance } = instanceAtLevel(project, 4);
      const persisted: MonsterInstance = {
        ...instance,
        stateIds: ["state_poison"],
        stateTurns: { state_poison: 2 },
        skillPp: { move_1: 3, move_2: 18, move_3: 29, move_4: 40 },
      };

      const battler = monsterPartyBattlers(project, [persisted])[0]!;
      const snapshot = battlerSnapshot(battler);

      expect(battler.stateIds).toEqual(["state_poison"]);
      expect(battler.stateTurns).toEqual({ state_poison: 2 });
      expect(battler.skillPp).toEqual({ move_1: 3, move_2: 18, move_3: 29, move_4: 40 });
      expect(snapshot.stateTurns).toEqual({ state_poison: 2 });
      expect(snapshot.skillPp).toEqual({ move_1: 3, move_2: 18, move_3: 29, move_4: 40 });
    });

    it("writes monster HP status turns and PP to its instance without polluting actorStateIds", () => {
      // Break: battle reward write-back used actor.recordId for every battler, including monster instance ids.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 4);
      session.actorStateIds[instance.instanceId] = ["state_attack_up"];

      applyBattleRewardsToSession(session, {
        result: "escape",
        rewards: { exp: 0, gold: 0, items: [] },
        monsterPartyMode: true,
        actors: [{
          id: `mon:${instance.instanceId}`,
          recordId: instance.instanceId,
          monsterInstanceId: instance.instanceId,
          speciesId: instance.speciesId,
          name: "Lifecycle",
          hp: 7,
          maxHp: 30,
          mp: 0,
          maxMp: 0,
          gauge: 0,
          defeated: false,
          defending: false,
          pose: "idle",
          stateIds: ["state_poison"],
          stateTurns: { state_poison: 3 },
          skillIds: [...MOVE_IDS.slice(0, 4)],
          skillPp: { move_1: 0, move_2: 4, move_3: 5, move_4: 6 },
        }],
      }, project);

      expect(session.monsterInstances[instance.instanceId]).toMatchObject({
        currentHp: 7,
        stateIds: ["state_poison"],
        stateTurns: { state_poison: 3 },
        skillPp: { move_1: 0, move_2: 4, move_3: 5, move_4: 6 },
      });
      expect(session.actorStateIds[instance.instanceId]).toBeUndefined();
    });

    it("roundtrips status PP and pending moves through a parsed save into the next battle", () => {
      // Break: save validation did not understand the new monster maps and legacy load did not hydrate moves/PP.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 4);
      session.monsterInstances[instance.instanceId] = {
        ...instance,
        stateIds: ["state_poison"],
        stateTurns: { state_poison: 1 },
        skillPp: { move_1: 0, move_2: 2, move_3: 3, move_4: 4 },
        pendingSkillIds: ["move_5"],
      };
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));

      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      const restored = applySaveSnapshot(project, read.snapshot);
      const restoredInstance = restored.monsterInstances[instance.instanceId]!;
      const nextBattle = monsterPartyBattlers(project, [restoredInstance])[0]!;

      expect(restoredInstance.pendingSkillIds).toEqual(["move_5"]);
      expect(nextBattle.stateIds).toEqual(["state_poison"]);
      expect(nextBattle.stateTurns).toEqual({ state_poison: 1 });
      expect(nextBattle.skillPp).toEqual({ move_1: 0, move_2: 2, move_3: 3, move_4: 4 });
    });

    it("roundtrips legacy actor Gen1 PP through save parsing", () => {
      const project = lifecycleProject();
      const session = startSession(project, 19);
      const actorId = session.partyActorIds[0]!;
      session.actorSkillPp = { [actorId]: { move_1: 3 } };
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));

      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      expect(applySaveSnapshot(project, read.snapshot).actorSkillPp).toEqual({ [actorId]: { move_1: 3 } });
    });

    it("hydrates a legacy instance with the latest four level moves and their authored PP", () => {
      // Break: legacy fallback returned every species move and never persisted initialized PP.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 5);
      const legacy: MonsterInstance = { ...instance, skillIds: undefined, skillPp: undefined };
      session.monsterInstances[instance.instanceId] = legacy;

      const directBattle = monsterPartyBattlers(project, [legacy])[0]!;
      expect(directBattle.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
      expect(directBattle.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });

      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      const restored = applySaveSnapshot(project, read.snapshot);
      const hydrated = restored.monsterInstances[instance.instanceId]!;

      expect(hydrated.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
      expect(hydrated.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });
    });

    it("migrates an overfull legacy stored learnset to the latest four moves", () => {
      // Break: pre-limit saves can contain every learned move even though skillIds is present.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 5);
      session.monsterInstances[instance.instanceId] = {
        ...instance,
        skillIds: [...MOVE_IDS],
        skillPp: { move_1: 1, move_2: 2, move_3: 3, move_4: 4, move_5: 5 },
      };

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

      expect(restored.monsterInstances[instance.instanceId]!.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
      expect(restored.monsterInstances[instance.instanceId]!.skillPp).toEqual({ move_2: 2, move_3: 3, move_4: 4, move_5: 5 });
    });

    it("preserves an explicitly empty active learnset across repeated hydration", () => {
      // Break: normalization collapsed [] to undefined, so the next hydration silently restored species moves.
      const project = lifecycleProject();
      const { instance } = instanceAtLevel(project, 4);
      const empty = normalizeMonsterInstanceBattleState(project, {
        ...instance,
        skillIds: [],
        skillPp: undefined,
      });

      expect(empty.skillIds).toEqual([]);
      expect(normalizeMonsterInstanceBattleState(project, empty).skillIds).toEqual([]);
      expect(monsterPartyBattlers(project, [empty])[0]!.skillIds).toEqual([]);
    });

    it("gives a high-level monster only its latest four moves", () => {
      // Break: newly caught/given high-level monsters previously received the complete level-up learnset.
      const project = lifecycleProject();
      const { instance } = instanceAtLevel(project, 5);

      expect(instance.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
      expect(instance.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });
      expect(instance.pendingSkillIds).toBeUndefined();
    });

    it("queues a fifth learned move and supports pure replace or reject without reviving forgotten PP", () => {
      // Break: level/evolution learning unioned every move into skillIds, bypassing the four-move limit.
      const project = lifecycleProject();
      const species = project.database.monsterSpecies![0]!;
      const { instance, session } = instanceAtLevel(project, 4);
      session.monsterInstances[instance.instanceId] = {
        ...instance,
        exp: totalExpForLevel(species.expCurve!, 5) - 1,
        skillPp: { move_1: 1, move_2: 2, move_3: 3, move_4: 4 },
      };

      applyMonsterExperienceAndEvolution(project, session, 1, [instance.instanceId]);
      const learned = session.monsterInstances[instance.instanceId]!;
      expect(learned.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
      expect(learned.pendingSkillIds).toEqual(["move_5"]);

      const replaced = replacePendingMonsterSkill(project, learned, "move_5", "move_2");
      expect(replaced.ok).toBe(true);
      if (!replaced.ok) return;
      expect(replaced.instance.skillIds).toEqual(["move_1", "move_5", "move_3", "move_4"]);
      expect(replaced.instance.pendingSkillIds).toBeUndefined();
      expect(replaced.instance.skillPp).toEqual({ move_1: 1, move_5: 50, move_3: 3, move_4: 4 });

      const rejected = rejectPendingMonsterSkill(learned, "move_5");
      expect(rejected.ok).toBe(true);
      if (rejected.ok) {
        expect(rejected.instance.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
        expect(rejected.instance.pendingSkillIds).toBeUndefined();
        expect(rejected.instance.skillPp).toEqual({ move_1: 1, move_2: 2, move_3: 3, move_4: 4 });
        session.monsterInstances[instance.instanceId] = rejected.instance;
        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.monsterInstances[instance.instanceId]!.pendingSkillIds).toBeUndefined();
        expect(restored.monsterInstances[instance.instanceId]!.skillIds).not.toContain("move_5");
      }
    });

    it("queues an evolution move when the active set is already full", () => {
      // Break: evolution used the same unbounded union as level-up learning.
      const project = lifecycleProject();
      const source = project.database.monsterSpecies![0]!;
      source.evolutions = [{ toSpeciesId: "species_lifecycle_evolved", requires: { level: 4 } }];
      project.database.monsterSpecies!.push({
        ...source,
        id: "species_lifecycle_evolved",
        name: "Lifecycle Evolved",
        evolutions: undefined,
        skillsByLevel: [
          ...(source.skillsByLevel ?? []).filter((entry) => entry.skillId !== "move_5"),
          { level: 4, skillId: "move_5" },
        ],
      });
      const { instance, session } = instanceAtLevel(project, 4);

      const result = evolveMonster(project, session, { instanceId: instance.instanceId });
      const evolved = session.monsterInstances[instance.instanceId]!;

      expect(result.ok).toBe(true);
      expect(evolved.speciesId).toBe("species_lifecycle_evolved");
      expect(evolved.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
      expect(evolved.pendingSkillIds).toEqual(["move_5"]);
    });

    it("uses per-move PP for authored monster moves and preserves the legacy MP path", () => {
      // Break: skill legality and consumption only knew MP, so Gen1 PP could neither block nor decrement.
      const project = lifecycleProject();
      const ppUser = {
        monsterInstanceId: "monster_1",
        mp: 0,
        maxMp: 0,
        skillIds: ["move_1"],
        skillPp: { move_1: 1 },
      };

      expect(battleSkillUseFailure(project, ppUser, "move_1")).toBeUndefined();
      expect(consumeBattleSkillResource(project, ppUser, "move_1")).toEqual({ kind: "pp", remaining: 0 });
      expect(battleSkillUseFailure(project, ppUser, "move_1")).toBe("noPp");

      const legacyUser = {
        monsterInstanceId: "monster_1",
        mp: 3,
        maxMp: 3,
        skillIds: ["legacy_move"],
        skillPp: {},
      };
      expect(battleSkillUseFailure(project, legacyUser, "legacy_move")).toBeUndefined();
      expect(consumeBattleSkillResource(project, legacyUser, "legacy_move")).toEqual({ kind: "mp", remaining: 0 });
    });

    it("derives one monster battle mode from either compatibility selector and the actual party", () => {
      // Break: playSceneBattle built one party from battleParty and another from monsterBattleParty.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 1);
      project.system.battleParty = "monsters";
      delete project.system.monsterBattleParty;

      expect(resolveMonsterBattleParty(project, session)).toEqual({
        requested: true,
        monsterPartyMode: true,
        partyMonsters: [session.monsterInstances[instance.instanceId]],
      });

      delete project.system.battleParty;
      project.system.monsterBattleParty = true;
      expect(resolveMonsterBattleParty(project, session).monsterPartyMode).toBe(true);

      session.monsterParty = [];
      expect(resolveMonsterBattleParty(project, session)).toMatchObject({ requested: true, monsterPartyMode: false, partyMonsters: [] });
    });

    it("recoverAll restores party monster HP PP and clears persistent status", () => {
      // Break: Pokemon-center recoverAll only touched actor HP/MP.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 4);
      session.monsterInstances[instance.instanceId] = {
        ...instance,
        currentHp: 1,
        stateIds: ["state_poison"],
        stateTurns: { state_poison: 7 },
        skillPp: { move_1: 0, move_2: 1, move_3: 2, move_4: 3 },
      };

      recoverAll(session, undefined, project);

      expect(session.monsterInstances[instance.instanceId]).toMatchObject({
        stateIds: [],
        stateTurns: {},
        skillPp: { move_1: 10, move_2: 20, move_3: 30, move_4: 40 },
      });
      expect(session.monsterInstances[instance.instanceId]!.currentHp).toBeGreaterThan(1);
    });

    it("applies persistent Gen1 field poison only every fourth completed monster-party step and never faints", () => {
      // Break: field movement had no persistent poison cadence or save-carried modulo counter.
      const project = lifecycleProject();
      project.system.battleParty = "monsters";
      const { instance, session } = instanceAtLevel(project, 1);
      session.monsterInstances[instance.instanceId] = {
        ...instance,
        currentHp: 3,
        stateIds: ["state_poison"],
      };

      for (let step = 0; step < 3; step += 1) applyGen1FieldPoisonStep(project, session);
      expect(session.monsterInstances[instance.instanceId]!.currentHp).toBe(3);
      expect(session.monsterFieldPoisonSteps).toBe(3);

      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.monsterFieldPoisonSteps).toBe(3);
      expect(applyGen1FieldPoisonStep(project, restored)).toEqual({ ticked: true, damagedInstanceIds: [instance.instanceId] });
      expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(2);
      expect(restored.monsterFieldPoisonSteps).toBe(0);

      for (let step = 0; step < 8; step += 1) applyGen1FieldPoisonStep(project, restored);
      expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(1);

      delete project.system.battleParty;
      applyGen1FieldPoisonStep(project, restored);
      expect(restored.monsterFieldPoisonSteps).toBe(0);
      expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(1);
    });

    it("rejects a malformed field-poison step counter in a parsed save", () => {
      const project = lifecycleProject();
      const { session } = instanceAtLevel(project, 1);
      const malformed = structuredClone(createSaveSnapshot(project, session)) as ReturnType<typeof createSaveSnapshot>
        & { session: { monsterFieldPoisonSteps: number } };
      malformed.session.monsterFieldPoisonSteps = -1;
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(malformed));

      expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
    });

    it("rejects malformed negative monster PP and state turns in parsed saves", () => {
      // Break: new nested monster fields previously bypassed save-slot validation.
      const project = lifecycleProject();
      const { instance, session } = instanceAtLevel(project, 1);
      const snapshot = createSaveSnapshot(project, session);
      const malformed = structuredClone(snapshot) as typeof snapshot & {
        session: { monsterInstances: Record<string, Record<string, unknown>> };
      };
      malformed.session.monsterInstances[instance.instanceId]!.skillPp = { move_1: -1 };
      malformed.session.monsterInstances[instance.instanceId]!.stateTurns = { state_poison: -2 };
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(malformed));

      expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
    });
  });
});

describe("itemAuthorityIntegration", () => {
  isolateTimers();
  describe("finite-use item authority integration", () => {
    it("threads a battle successful-use cursor through event snapshot and back to session", () => {
      const project = createBlankProject();
      const item = normalizeItemRecord({
        id: "finite_potion",
        name: "Finite potion",
        type: "medicine",
        scope: "ally",
        consumable: true,
        consumptionLimit: 3,
        occasion: "battle",
        hpRecovery: { flat: 10, percentMax: 0 },
      });
      project.database.items.push(item);
      const actorId = project.system.startActorIds[0]!;
      const session = startSession(project);
      session.inventory[item.id] = 1;
      session.actorVitals[actorId]!.hp = Math.max(1, session.actorVitals[actorId]!.hp - 20);
      const troopId = project.database.troops[0]!.id;
      const runtime = createBattleRuntime({
        project,
        troopId,
        canEscape: true,
        canLose: true,
        party: {
          levels: session.actorLevels,
          experience: session.actorExperience,
          vitals: session.actorVitals,
          equipment: session.actorEquipment,
          skillIds: session.actorSkillIds,
          classOverrides: session.classOverrides,
          stateIds: session.actorStateIds,
          partyActorIds: session.partyActorIds,
        },
        sessionState: {
          switches: session.switches,
          variables: session.variables,
          inventory: session.inventory,
          itemUseCharges: session.itemUseCharges,
          gold: session.gold,
          partyActorIds: session.partyActorIds,
        },
      });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "item", itemId: item.id, targetEnemyId: "" });
      const state = runtime.snapshot().eventState;
      expect(state.inventory[item.id]).toBe(1);
      expect(state.itemUseCharges?.[item.id]).toBe(1);
      applyBattleRewardsToSession(session, { result: "escape", rewards: { exp: 0, gold: 0, items: [] }, eventState: state }, project);
      expect(session.inventory[item.id]).toBe(1);
      expect(session.itemUseCharges?.[item.id]).toBe(1);
    });

    it("rejects an actor-restricted battle item without changing effects or finite-use state", () => {
      const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({ usableActorIds: ["other_actor"] });

      runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

      const snapshot = runtime.snapshot();
      expect(snapshot.actors.find((actor) => actor.recordId === actorId)?.hp).toBe(initialHp);
      expect(snapshot.eventState.inventory[itemId]).toBe(1);
      expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(1);
    });

    it("rejects a class-restricted battle item without changing effects or finite-use state", () => {
      const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({ usableClassIds: ["other_class"] });

      runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

      const snapshot = runtime.snapshot();
      expect(snapshot.actors.find((actor) => actor.recordId === actorId)?.hp).toBe(initialHp);
      expect(snapshot.eventState.inventory[itemId]).toBe(1);
      expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(1);
    });

    it("applies and advances finite-use state for an eligible restricted battle item", () => {
      const project = createBlankProject();
      const actor = project.database.actors[0]!;
      const { runtime, actorId, itemId, initialHp } = setupRestrictedBattleItem({
        project,
        usableActorIds: [actor.id],
        usableClassIds: [actor.classId],
      });

      runtime.performActorCommand({ kind: "item", itemId, targetEnemyId: "" });

      const snapshot = runtime.snapshot();
      expect(snapshot.actors.find((entry) => entry.recordId === actorId)?.hp).toBeGreaterThan(initialHp);
      expect(snapshot.eventState.inventory[itemId]).toBe(1);
      expect(snapshot.eventState.itemUseCharges?.[itemId]).toBe(2);
    });

    it("routes battle-event item changes through the finite-use transition authority", () => {
      const project = createBlankProject();
      const item = normalizeItemRecord({
        id: "finite_event_item",
        name: "Finite event item",
        consumable: true,
        consumptionLimit: 3,
      });
      project.database.items.push(item);
      const troop = project.database.troops[0]!;
      troop.battleEventPages = [{
        id: "remove_finite_item",
        name: "Remove finite item",
        conditions: [],
        span: "battle",
        commands: [{ kind: "changeItem", itemId: item.id, op: "-=", amount: 1 }],
      }];
      const originalInventory = { [item.id]: 1 };
      const originalCharges = { [item.id]: 2 };
      const state = {
        switches: {},
        variables: {},
        inventory: originalInventory,
        itemUseCharges: originalCharges,
      };

      createBattleEventRuntime({
        project,
        troopRecord: troop,
        actors: [],
        enemies: [],
        stateIds: [],
        state,
      }).applyTroopEvents({ turn: 0 });

      expect(state.inventory).not.toBe(originalInventory);
      expect(state.itemUseCharges).not.toBe(originalCharges);
      expect(state.inventory[item.id]).toBeUndefined();
      expect(state.itemUseCharges[item.id]).toBeUndefined();
    });

    it("counts mirrored two-handed equipment stats once in battle", () => {
      const project = createBlankProject();
      const actor = project.database.actors[0]!;
      const weapon = project.database.equipment.find((record) => record.slot === "weapon")!;
      weapon.twoHanded = true;
      weapon.statBonuses = { attack: 17, defense: 3, mind: 2, agility: 1 };
      const withoutEquipment = actorBattlers(project, {
        partyActorIds: [actor.id],
        equipment: { [actor.id]: {} },
      })[0]!;
      const withEquipment = actorBattlers(project, {
        partyActorIds: [actor.id],
        equipment: { [actor.id]: { weapon: weapon.id, shield: weapon.id } },
      })[0]!;

      expect(withEquipment.attackPower - withoutEquipment.attackPower).toBe(17);
      expect(withEquipment.defense - withoutEquipment.defense).toBe(3);
      expect(withEquipment.mind - withoutEquipment.mind).toBe(2);
      expect(withEquipment.agility - withoutEquipment.agility).toBe(1);
    });

    it("persists defeat-branch item consumption without granting victory rewards", () => {
      const project = createBlankProject();
      const item = normalizeItemRecord({ id: "finite_defeat_item", name: "Finite defeat item", consumable: true, consumptionLimit: 3 });
      project.database.items.push(item);
      const session = startSession(project);
      session.inventory[item.id] = 1;
      session.itemUseCharges = { [item.id]: 1 };
      const actorId = session.partyActorIds[0]!;
      const initialExperience = session.actorExperience[actorId]!;
      const initialGold = session.gold;

      const levelUps = applyBattleRewardsToSession(session, {
        result: "defeat",
        canLose: true,
        rewards: { exp: 999, gold: 999, items: ["item_bomb"] },
        eventState: {
          switches: session.switches,
          variables: session.variables,
          inventory: { [item.id]: 1 },
          itemUseCharges: { [item.id]: 2 },
        },
      }, project);

      expect(session.inventory[item.id]).toBe(1);
      expect(session.itemUseCharges?.[item.id]).toBe(2);
      expect(session.actorExperience[actorId]).toBe(initialExperience);
      expect(session.gold).toBe(initialGold);
      expect(session.inventory.item_bomb).toBeUndefined();
      expect(levelUps).toEqual([]);
    });

    it("round-trips finite-use state through a save snapshot", () => {
      const project = createBlankProject();
      const item = normalizeItemRecord({ id: "finite", name: "Finite", consumable: true, consumptionLimit: 4 });
      project.database.items.push(item);
      const session = startSession(project);
      session.inventory[item.id] = 2;
      session.itemUseCharges = { [item.id]: 3 };
      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.inventory[item.id]).toBe(2);
      expect(restored.itemUseCharges?.[item.id]).toBe(3);
    });

    it("preserves the FIFO cursor when a partially charged final care-item copy is used", () => {
      const { project, session, itemId, instanceId } = setupFiniteCareItem(1, 1);

      expect(useItemFromMenu(project, session, itemId, undefined, instanceId).kind).toBe("used");
      expect(session.inventory[itemId]).toBe(1);
      expect(session.itemUseCharges?.[itemId]).toBe(2);
    });

    it("finishes a charged FIFO care-item copy without consuming its uncharged tail", () => {
      const { project, session, itemId, instanceId } = setupFiniteCareItem(2, 2);

      expect(useItemFromMenu(project, session, itemId, undefined, instanceId).kind).toBe("used");
      expect(session.inventory[itemId]).toBe(1);
      expect(session.itemUseCharges?.[itemId]).toBeUndefined();
    });
  });
  function setupRestrictedBattleItem({
    project = createBlankProject(),
    usableActorIds = [],
    usableClassIds = [],
  }: {
    project?: ReturnType<typeof createBlankProject>;
    usableActorIds?: string[];
    usableClassIds?: string[];
  }) {
    const item = normalizeItemRecord({
      id: "restricted_finite_potion",
      name: "Restricted finite potion",
      type: "medicine",
      scope: "ally",
      consumable: true,
      consumptionLimit: 3,
      occasion: "battle",
      hpRecovery: { flat: 10, percentMax: 0 },
      usableActorIds,
      usableClassIds,
    });
    project.database.items.push(item);
    const actorId = project.system.startActorIds[0]!;
    const session = startSession(project);
    session.inventory[item.id] = 1;
    session.itemUseCharges = { [item.id]: 1 };
    session.actorVitals[actorId]!.hp = Math.max(1, session.actorVitals[actorId]!.hp - 20);
    const initialHp = session.actorVitals[actorId]!.hp;
    const runtime = createBattleRuntime({
      project,
      troopId: project.database.troops[0]!.id,
      canEscape: true,
      canLose: true,
      party: {
        levels: session.actorLevels,
        experience: session.actorExperience,
        vitals: session.actorVitals,
        equipment: session.actorEquipment,
        skillIds: session.actorSkillIds,
        classOverrides: session.classOverrides,
        stateIds: session.actorStateIds,
        partyActorIds: session.partyActorIds,
      },
      sessionState: {
        switches: session.switches,
        variables: session.variables,
        inventory: session.inventory,
        itemUseCharges: session.itemUseCharges,
        gold: session.gold,
        partyActorIds: session.partyActorIds,
      },
    });
    runtime.tick(1_000);
    return { runtime, actorId, itemId: item.id, initialHp };
  }
  function setupFiniteCareItem(count: number, charge: number) {
    const project = createBlankProject();
    const item = normalizeItemRecord({
      id: "finite_care",
      name: "Finite care",
      type: "special",
      scope: "none",
      consumable: true,
      consumptionLimit: 3,
      occasion: "field",
      careProfile: { kind: "feed", friendshipDelta: 1, expDelta: 0 },
    });
    project.database.items.push(item);
    const session = startSession(project);
    session.inventory[item.id] = count;
    session.itemUseCharges = { [item.id]: charge };
    const speciesId = project.database.monsterSpecies?.[0]?.id;
    if (!speciesId) throw new Error("Expected a default monster species");
    const gifted = giveMonster(project, session, { speciesId, level: 1 });
    if (!gifted.ok) throw new Error("Expected default monster species to be giftable");
    return { project, session, itemId: item.id, instanceId: gifted.instance.instanceId };
  }
});
