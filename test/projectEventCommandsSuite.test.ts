import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { deserialize } from "@/project/io";
import { battleTroopError } from "@/project/battleAdmission";
import { validateLowLevelCommandArray } from "@/editor/tools/commandArgs";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { m2CommandById, M2_COMMAND_CATALOG, createDefaultM2Fields, isM2CatalogEntrySelectableInMap, isM2CatalogEntrySelectableInBattleEvent, m2CatalogEntryRuntimeSupport } from "@/project/eventCommands/m2Catalog";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { applyBattleTimerWrites, updateRuntimeTimers } from "@/player/playSceneTimers";
import { startSession, type PlaySession } from "@/project/session";
import type { Command, M2CommandFields, Project, Condition, EventPage, GameEvent } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import fixture from "./fixtures/projects/battle-v3.json";
import { createInterpreter } from "@/player/interpreter";
import { resolveMapBgm } from "@/player/mapBgm";
import { systemAudioOverrideKey } from "@/player/systemAudioSlots";
import { createBlankProject } from "@/project/defaults";
import type { StepResult, Frame, InterpreterState } from "@/player/interpreter/types";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { newCommand, newM2Command } from "@/editor/eventCommandFactory";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isolateTimers } from "./mergedTeardown";
import { letterboxPercentFromValue, nextSpriteLook, normalizeSpriteLook, spriteLookKey } from "@/project/eventCommands/cinematicStaging";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { compileCutscene } from "@/editor/cutscene";
import { runTool } from "@/editor/tools";
import { interpolateScreenDistortion, isNeutralScreenDistortion, NEUTRAL_SCREEN_DISTORTION, nextScreenDistortion, normalizeScreenDistortion, SCREEN_DISTORTION_DEFAULTS } from "@/project/eventCommands/screenDistortion";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { deleteEventCommand, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { battleEventCommandRuntimeSupport, commandRuntimeSupport, commandRuntimeSupportDescriptor, m2CommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import type { BattleEventLogSnapshot } from "@/battle/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

describe("m2Catalog", () => {
  isolateTimers();
  describe("battleReviewIntegrity", () => {
    isolateTimers();
    type M2 = Extract<Command, { kind: "m2Command" }>;
    const hpCommand = (target: string): M2 => ({
      kind: "m2Command", commandId: "m2-098-change-enemy-hp",
      fields: { target, operation: "set", value: 0 },
    });
    function eventBattle(commands: Command[]) {
      const project = deserialize(JSON.stringify(fixture));
      const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
      troop.battleEventPages = [{
        id: "review", name: "Review", span: "battle", conditions: [], commands,
      }];
      const runtime = createBattleRuntime({
        project, troopId: troop.id, canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
      });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "defend" });
      return { project, runtime };
    }
    describe("battle review integrity boundaries", () => {
      it("resolves simultaneous troop-event knockouts as defeat without rewards", () => {
        const { runtime } = eventBattle([
          hpCommand("all"),
          { kind: "changeActorHp", actorId: "party", op: "=", amount: 0 },
        ]);
        const snapshot = runtime.snapshot();
        expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
        expect(snapshot.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
        expect(snapshot.result).toBe("defeat");
        expect(snapshot.rewards).toMatchObject({ exp: 0, gold: 0, items: [] });
        runtime.cancel();
      });

      it.each(["enemy-99", "deleted_enemy", ""])("does not redirect unknown enemy target %s", (target) => {
        const { runtime } = eventBattle([hpCommand(target)]);
        const snapshot = runtime.snapshot();
        expect(snapshot.enemies[0].hp).toBe(snapshot.enemies[0].maxHp);
        expect(snapshot.result).toBeUndefined();
        expect(snapshot.eventLogs.some((entry) => entry.kind === "unsupported")).toBe(true);
        runtime.cancel();
      });

      it.each(["enemy-1", "enemy_slime", "all"])("still applies explicit enemy target %s", (target) => {
        const { runtime } = eventBattle([hpCommand(target)]);
        expect(runtime.snapshot().enemies[0].hp).toBe(0);
        expect(runtime.snapshot().result).toBe("victory");
        runtime.cancel();
      });

      it.each([undefined, null, [], "invalid"])("rejects malformed M2 fields %s at authoring and runtime boundaries", (fields) => {
        const command = { ...hpCommand("all"), fields } as unknown as M2;
        expect(() => validateCommandArray("commands", [command])).toThrow(/fields/);
        expect(() => validateLowLevelCommandArray("commands", [command])).toThrow(/fields/);
        expect(parseM2BattleCommand(command)).toBeUndefined();
        // Nested tool branches must not bypass the same shape contract.
        expect(() => validateLowLevelCommandArray("commands", [{ kind: "loop", body: [command] }])).toThrow(/fields/);
      });

      it("uses catalog validation instead of a shadowing shallow M2 case", () => {
        expect(() => validateCommandArray("commands", [{ ...hpCommand("all"), commandId: "missing-command" }]))
          .toThrow(/commandId/);
        const command = { ...hpCommand("all"), fields: { target: { nested: true } } } as unknown as M2;
        expect(() => validateCommandArray("commands", [command])).toThrow(/fields.target/);
      });

      it("reports dangling hidden members through admission before constructing battlers", () => {
        const project = deserialize(JSON.stringify(fixture));
        const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
        troop.members = [{ enemyId: "deleted_enemy", x: 100, y: 100, hidden: true }];
        // Members take precedence over a still-valid legacy projection.
        expect(battleTroopError(project, troop.id)).toMatchObject({ code: "BATTLE_ENEMY_MISSING" });
        expect(() => createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true }))
          .toThrow(/deleted_enemy/);
        delete troop.members;
        expect(battleTroopError(project, troop.id)).toBeUndefined();
        troop.enemyIds = ["deleted_enemy"];
        expect(battleTroopError(project, troop.id)?.code).toBe("BATTLE_ENEMY_MISSING");
      });

      it.each(["rich", "legacy", "party"])("addresses actual actors for %s m2-092 targets", (mode) => {
        const project = deserialize(JSON.stringify(fixture));
        project.database.battleCommands = [
          ...(project.database.battleCommands ?? []),
          { id: "defend", name: "방어", kind: "defend" },
        ];
        const session = startSession(project);
        const actorId = session.partyActorIds[0];
        const commandId = "m2-092-change-battle-commands";
        const entry = m2CommandById(commandId)!;
        const fields: M2CommandFields = mode === "rich" ? { target: "actor", actorId }
          : { target: mode === "party" ? "party" : actorId };
        executeM2RuntimeCommand(session, entry, {
          commandId, fields: { ...fields, operation: "set", value: "defend" },
        }, { project });
        expect(session.actorBattleCommands?.[actorId]).toEqual(["defend"]);
        expect(session.actorBattleCommands?.actor).toBeUndefined();
      });

      it.each(["set", "start", "stop"] as const)("commits timer %s to the live timer owner and preserves untouched countdowns", (action) => {
        const { project, runtime } = eventBattle([
          { kind: "timer", action: "set", timerId: "timer1", seconds: 8 },
          { kind: "timer", action, timerId: "timer1", ...(action === "set" ? { seconds: 6 } : {}) },
        ]);
        const state = runtime.snapshot().eventState;
        const session = startSession(project);
        const runtimeTimers = new Map([
          ["timer1", { remaining: 100, active: true }],
          ["timer2", { remaining: 3.5, active: true }],
        ]);
        const scene = { session, runtimeTimers } as PlaySceneContext;
        applyBattleTimerWrites(scene, state);
        expect(runtimeTimers.get("timer1")).toEqual({ remaining: action === "set" ? 6 : 8, active: action === "start" });
        expect(runtimeTimers.get("timer2")).toEqual({ remaining: 3.5, active: true });
        updateRuntimeTimers(scene, 1_000);
        expect(session.timers.timer1).toBe(action === "start" ? 7 : action === "set" ? 6 : 8);
        expect(runtimeTimers.get("timer2")?.remaining).toBe(2.5);
        runtime.cancel();
      });
    });
  });
  describe("eventAudioCommandContracts", () => {
    isolateTimers();
    // 감사 U14(소리 축): G1-F2 사운드 레이어, G1-F9 BGM 기억/재생, G1-F23 BGM 페이드아웃, G4-F3 시스템 BGM/SE.
    // 네 건 모두 「저작면이 고른 값이 실행면에 도달하는가」가 쟁점이라, 저작 필드 → 인터프리터 스텝까지
    // 한 파일에서 같이 못 박는다.

    function m2Command(title: string, fields: M2CommandFields = {}): Command {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`unknown M2 command: ${title}`);
      return { kind: "m2Command", commandId: entry.id, fields };
    }
    function fieldKeys(title: string): readonly string[] {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`unknown M2 command: ${title}`);
      return entry.fields.map((field) => field.key);
    }
    function mkSession(project: Project): PlaySession {
      return startSession(project, 3);
    }
    function firstStep(commands: readonly Command[], session: PlaySession): Exclude<StepResult, { kind: "done" }> {
      const interpreter = createInterpreter([...commands], session);
      const result = interpreter.start();
      if (result.kind === "done") throw new Error("interpreter finished without pausing");
      return result;
    }
    function drain(commands: readonly Command[], session: PlaySession): void {
      const interpreter = createInterpreter([...commands], session);
      let result = interpreter.start();
      let guard = 0;
      while (result.kind !== "done") {
        if (++guard > 50) throw new Error("interpreter did not settle");
        result = interpreter.resume();
      }
    }
    describe("G1-F2 사운드 레이어는 채널을 그대로 실행에 넘긴다", () => {
      it("효과음 채널은 SE 로, 1회 재생으로 나간다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const step = firstStep([m2Command("Sound Layer", { channel: "se", resourceId: "easyrpg-sound-decision1" })], session);
        expect(step).toMatchObject({ kind: "playAudio", resourceId: "easyrpg-sound-decision1", channel: "se", loop: false });
        // main records the resolved authored values (0..100 volume, explicit fade) on the track.
        expect(session.audio.se).toEqual({ resourceId: "easyrpg-sound-decision1", loop: false, volume: 100, fadeInMs: 0 });
        expect(session.audio.bgm).toBeUndefined();
      });

      it("환경음은 BGS 로 루프 재생하고 BGM 슬롯을 빼앗지 않는다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true };
        const step = firstStep([m2Command("Sound Layer", { channel: "ambient", resourceId: "cc0-bgm-town", fadeMs: 400 })], session);
        expect(step).toMatchObject({ kind: "playAudio", resourceId: "cc0-bgm-town", channel: "ambient", loop: true, fadeInMs: 400 });
        expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true });
        expect(session.audio.ambient).toEqual({ resourceId: "cc0-bgm-town", loop: true, volume: 100, fadeInMs: 400 });
      });

      it("음악 채널은 여전히 BGM 루프다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const step = firstStep([m2Command("Sound Layer", { channel: "bgm", resourceId: "cc0-bgm-town" })], session);
        expect(step).toMatchObject({ kind: "playAudio", channel: "bgm", loop: true });
      });
    });
    describe("G1-F9 BGM 기억/재생", () => {
      it("두 명령 모두 고를 값이 없으므로 입력을 내주지 않는다", () => {
        expect(fieldKeys("Memorize Current BGM")).toEqual([]);
        expect(fieldKeys("Play Memorized BGM")).toEqual([]);
      });

      it("기억한 곡을 실제 재생 스텝으로 넘긴다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true };
        drain([m2Command("Memorize Current BGM")], session);
        session.audio.bgm = { resourceId: "cc0-bgm-battle", loop: true };

        const step = firstStep([m2Command("Play Memorized BGM")], session);
        expect(step).toMatchObject({ kind: "playAudio", resourceId: "cc0-bgm-field", channel: "bgm", loop: true });
        expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true });
      });

      it("기억한 곡의 음량과 페이드를 재생 스텝에 남긴다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true, volume: 0, fadeInMs: 0 };
        drain([m2Command("Memorize Current BGM")], session);
        session.audio.bgm = { resourceId: "cc0-bgm-battle", loop: true, volume: 100, fadeInMs: 800 };

        const step = firstStep([m2Command("Play Memorized BGM")], session);
        expect(step).toEqual({ kind: "playAudio", resourceId: "cc0-bgm-field", channel: "bgm", loop: true, volume: 0, fadeInMs: 0 });
        expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true, volume: 0, fadeInMs: 0 });
      });

      it("기억한 곡이 없으면 재생 스텝 없이 다음 명령으로 간다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        drain([m2Command("Play Memorized BGM"), { kind: "setSwitch", switchId: "after", value: true }], session);
        warn.mockRestore();
        expect(session.switches["after"]).toBe(true);
      });
    });
    describe("G1-F23 BGM 페이드아웃은 BGM 만 끊는다", () => {
      it("별칭이 채널 지정 정지를 저작한다", () => {
        const entry = m2CommandById("m2-062-fadeout-bgm");
        expect(entry?.existingKind).toBe("stopAudio");
      });

      it("채널 지정 정지 스텝은 그 채널만 실어 보낸다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const step = firstStep([{ kind: "stopAudio", channel: "bgm" }], session);
        expect(step).toEqual({ kind: "stopAudio", channel: "bgm" });
      });

      it("채널 없는 정지는 기존 계약(전부 정지) 그대로다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const step = firstStep([{ kind: "stopAudio" }], session);
        expect(step).toEqual({ kind: "stopAudio" });
      });
    });
    describe("G4-F3 시스템 BGM/SE 는 피커가 쓴 필드를 실행이 읽는다", () => {
      it("BGM 은 슬롯 + 음악 리소스를 저작한다", () => {
        expect(fieldKeys("Change System BGM")).toEqual(["slot", "resourceId"]);
        expect(fieldKeys("Change System SE")).toEqual(["slot", "resourceId"]);
      });

      it("고른 곡이 슬롯 오버라이드로 기록된다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        drain([m2Command("Change System BGM", { slot: "battle", resourceId: "cc0-bgm-battle" })], session);
        expect(session.m2Runtime?.system?.[systemAudioOverrideKey("battle")]).toBe("cc0-bgm-battle");
        expect(session.m2Runtime?.system?.["system_bgm"]).toBe("cc0-bgm-battle");
      });

      it("옛날 저장분의 value 필드도 계속 읽는다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        drain([m2Command("Change System SE", { slot: "escape", value: "easyrpg-sound-escape" })], session);
        expect(session.m2Runtime?.system?.[systemAudioOverrideKey("escape")]).toBe("easyrpg-sound-escape");
      });

      it("필드 기본곡 오버라이드가 맵 BGM 해석의 폴백을 바꾼다", () => {
        const project = createBlankProject();
        const mapId = Object.keys(project.maps)[0] ?? "";
        const authored = resolveMapBgm(project, mapId);
        const overridden = resolveMapBgm(project, mapId, { defaultBgmResourceId: "cc0-bgm-town" });
        expect(overridden).not.toEqual(authored);
        expect(overridden).toMatchObject({ kind: "play", resourceId: "cc0-bgm-town" });
      });
    });
  });
  describe("eventDraftValidator", () => {
    isolateTimers();
    function page(overrides: Partial<EventPage> = {}): EventPage {
      return {
        id: "page-1",
        name: "검사 페이지",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "hello" }],
        ...overrides,
      };
    }
    function gameEvent(eventPage: EventPage): GameEvent {
      return {
        id: "event-test",
        x: 3,
        y: 3,
        trigger: eventPage.trigger,
        commands: [],
        pages: [eventPage],
      };
    }
    describe("event draft aggregate validator", () => {
      it("warns for a native command whose map guarantee is partial", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({ commands: [newCommand("giveMonster")] }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues).toContainEqual(expect.objectContaining({
          severity: "warning",
          code: "runtime.partial",
          commandPath: [0],
        }));
      });

      it("treats an unknown faction as an error and blocks the draft", () => {
        const project = createBlankProject();
        project.factions = { defs: [{ id: "guard", name: "경비대" }], relations: [] };
        const mapId = project.startMapId;
        const event = gameEvent(page({ commands: [
          { kind: "changeFactionStance", a: "gaurd", b: "player", op: "-=", value: 0.25 },
        ] }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues).toContainEqual(expect.objectContaining({
          severity: "error",
          code: "reference.faction.missing",
          message: expect.stringContaining("gaurd"),
          commandPath: [0],
          field: { testId: "event-command-faction-a" },
        }));
        expect(result.issues.some((issue) => issue.message.includes("player"))).toBe(false);
        expect(result.canCommit).toBe(false);
      });

      it("treats every recursively nested condition leaf as an auto/parallel gate", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const condition: Condition = {
          kind: "not",
          condition: {
            kind: "any",
            conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          },
        };
        const event = gameEvent(page({ trigger: { kind: "parallel" }, conditions: [condition] }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues.some((issue) => issue.code === "page.auto-parallel-ungated")).toBe(false);
        expect(result.canCommit).toBe(true);
      });

      it("validates labels with the same active-frame scope as the interpreter", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const commands: Command[] = [
          { kind: "label", name: "outer" },
          {
            kind: "fork",
            condition: { kind: "selfSwitch", key: "A", value: true },
            then: [
              { kind: "label", name: "inner" },
              { kind: "label", name: "inner" },
              { kind: "gotoLabel", name: "outer" },
              { kind: "gotoLabel", name: "missing" },
            ],
            else: [{ kind: "label", name: "inner" }],
          },
          { kind: "gotoLabel", name: "inner" },
        ];
        const event = gameEvent(page({ commands }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const duplicate = result.issues.filter((issue) => issue.code === "label.duplicate");
        const missing = result.issues.filter((issue) => issue.code === "label.target-missing");

        expect(duplicate).toHaveLength(2);
        expect(duplicate.every((issue) => issue.commandPath !== undefined)).toBe(true);
        expect(missing).toEqual(expect.arrayContaining([
          expect.objectContaining({ commandPath: expect.arrayContaining([3]) }),
          expect.objectContaining({ commandPath: [2] }),
        ]));
        expect(missing.some((issue) => issue.message.includes("outer"))).toBe(false);
        expect(result.canCommit).toBe(false);
      });

      it("aggregates nested missing references and reports runtime-skipped commands as warnings", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "any", conditions: [{ kind: "actor", actorId: "missing-actor", present: true }] }],
          commands: [
            { kind: "transfer", mapId: "missing-map", x: 0, y: 0 },
            { kind: "battleProcessing", troopId: "missing-troop", canEscape: true, canLose: false },
            { kind: "m2Command", commandId: "m2-088-comment", fields: { text: "note" } },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const codes = result.issues.map((issue) => issue.code);

        expect(codes).toContain("reference.actor.missing");
        expect(codes).toContain("reference.map.missing");
        expect(codes).toContain("reference.troop.missing");
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: "runtime.editor-only",
          severity: "warning",
        }));
        expect(result.errorCount).toBeGreaterThanOrEqual(3);
      });

      it("honors modern M2 current-map, output-ID, optional-reference, and dynamic-ID semantics", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        if (!map) throw new Error("missing start map");
        const entry = (title: string) => {
          const found = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
          if (!found) throw new Error(`missing ${title} catalog entry`);
          return found;
        };
        const spawnEvent = entry("Spawn Event");
        const removeEvent = entry("Remove Event");
        const regionTrigger = entry("Region Trigger");
        const pathfindMove = entry("Pathfind Move");
        const cameraControl = entry("Camera Control");
        const event = gameEvent(page({
          commands: [
            { kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "author note" } },
            {
              kind: "m2Command",
              commandId: spawnEvent.id,
              fields: { ...createDefaultM2Fields(spawnEvent), prefabId: "event-test", eventId: "runtime-spawn" },
            },
            {
              kind: "m2Command",
              commandId: removeEvent.id,
              fields: { ...createDefaultM2Fields(removeEvent), eventId: "runtime-spawn" },
            },
            {
              kind: "m2Command",
              commandId: regionTrigger.id,
              fields: createDefaultM2Fields(regionTrigger),
            },
            {
              kind: "m2Command",
              commandId: pathfindMove.id,
              fields: createDefaultM2Fields(pathfindMove),
            },
            {
              kind: "m2Command",
              commandId: cameraControl.id,
              fields: createDefaultM2Fields(cameraControl),
            },
          ],
        }));
        project.maps[mapId].events = [event];

        const validResult = validateEventDraftBody(project, mapId, event);

        expect(validResult.issues.filter((issue) => issue.severity === "error")).toEqual([]);
        expect(validResult.issues).toContainEqual(expect.objectContaining({
          code: "runtime.editor-only",
          severity: "warning",
        }));
        expect(validResult.canCommit).toBe(true);

        event.pages![0]!.commands[1] = {
          kind: "m2Command",
          commandId: spawnEvent.id,
          fields: {
            ...createDefaultM2Fields(spawnEvent),
            prefabId: "event-test",
            eventId: "runtime-spawn",
            x: map.width,
          },
        };
        event.pages![0]!.commands[4] = {
          kind: "m2Command",
          commandId: pathfindMove.id,
          fields: { ...createDefaultM2Fields(pathfindMove), y: map.height },
        };
        event.pages![0]!.commands[5] = {
          kind: "m2Command",
          commandId: cameraControl.id,
          fields: {
            ...createDefaultM2Fields(cameraControl),
            target: "position",
            x: map.width,
          },
        };

        const positionResult = validateEventDraftBody(project, mapId, event);
        expect(positionResult.issues.filter((issue) => issue.code === "map.position.out-of-bounds"))
          .toEqual(expect.arrayContaining([
            expect.objectContaining({ commandPath: [1] }),
            expect.objectContaining({ commandPath: [4] }),
            expect.objectContaining({ commandPath: [5] }),
          ]));

        event.pages![0]!.commands[1] = {
          kind: "m2Command",
          commandId: spawnEvent.id,
          fields: {
            ...createDefaultM2Fields(spawnEvent),
            prefabId: "event-test",
            eventId: "runtime-spawn",
            mapId: "missing-map",
          },
        };
        const missingMapResult = validateEventDraftBody(project, mapId, event);
        expect(missingMapResult.issues).toContainEqual(expect.objectContaining({
          code: "reference.map.missing",
          commandPath: [1],
        }));

        event.pages![0]!.commands[1] = {
          kind: "m2Command",
          commandId: spawnEvent.id,
          fields: {
            ...createDefaultM2Fields(spawnEvent),
            prefabId: "missing-template",
            eventId: "runtime-spawn",
          },
        };
        const missingTemplateResult = validateEventDraftBody(project, mapId, event);
        expect(missingTemplateResult.issues).toContainEqual(expect.objectContaining({
          code: "reference.event.missing",
          commandPath: [1],
          field: { testId: "m2-command-prefabId-input" },
        }));
      });

      it("blocks empty shops and validates record references inside generic M2 fields", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const m2Entry = M2_COMMAND_CATALOG.find((entry) => entry.title === "Set Vehicle Location");
        if (!m2Entry) throw new Error("missing Set Vehicle Location catalog entry");
        const event = gameEvent(page({
          commands: [
            {
              kind: "shop",
              itemIds: [],
              allowSell: true,
              quantityMode: "single",
              shopType: "normal",
              messageType: "welcome",
              branchOnTransaction: false,
              transactionBranch: [],
            },
            {
              kind: "m2Command",
              commandId: m2Entry.id,
              fields: { ...createDefaultM2Fields(m2Entry), mapId: "missing-map" },
            },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: "shop.items.empty", commandPath: [0] }),
          expect.objectContaining({ code: "reference.map.missing", commandPath: [1] }),
        ]));
        expect(result.canCommit).toBe(false);
      });

      it("accepts shop goods that exist as equipment and still rejects unknown ids", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const equipmentId = project.database.equipment[0]?.id;
        if (!equipmentId) throw new Error("blank project has no equipment");
        const event = gameEvent(page({
          commands: [
            {
              kind: "shop",
              itemIds: [equipmentId],
              allowSell: true,
              quantityMode: "single",
              shopType: "normal",
              messageType: "welcome",
              branchOnTransaction: false,
              transactionBranch: [],
            },
            {
              kind: "shop",
              itemIds: ["item_does_not_exist"],
              allowSell: true,
              quantityMode: "single",
              shopType: "normal",
              messageType: "welcome",
              branchOnTransaction: false,
              transactionBranch: [],
            },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const missing = result.issues.filter((issue) => issue.code === "reference.item.missing");

        expect(missing).toEqual([
          expect.objectContaining({
            code: "reference.item.missing",
            commandPath: [1],
            message: "고른 상점 아이템('item_does_not_exist')을 찾을 수 없어요.",
          }),
        ]);
        expect(result.issues.some((issue) => issue.commandPath?.[0] === 0 && issue.code === "reference.item.missing")).toBe(false);
      });

      it("accepts changeItem rewards that exist as equipment and still rejects unknown ids", () => {
        // 폴른 스타 컷신(28,37)이 장비 「바람결 검」·「푸른 불꽃 창」을 changeItem 으로 준다. 런타임 인벤토리는
        // 아이템+장비를 함께 받는데 편집기만 items 를 보아 「Error 2」를 띄웠다(2026-11-19 QA).
        const project = createBlankProject();
        const mapId = project.startMapId;
        const equipmentId = project.database.equipment[0]?.id;
        if (!equipmentId) throw new Error("blank project has no equipment");
        const event = gameEvent(page({
          commands: [
            { kind: "changeItem", itemId: equipmentId, op: "+=", amount: 1 },
            { kind: "changeItem", itemId: "item_does_not_exist", op: "+=", amount: 1 },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const missing = result.issues.filter((issue) => issue.code === "reference.item.missing");

        expect(missing).toEqual([expect.objectContaining({ code: "reference.item.missing", commandPath: [1] })]);
      });

      it("accepts numeric M2 values and requires a variable reference only in variable mode", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const entries = ["Change Parameters", "Damage Processing"].map((title) => {
          const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
          if (!entry) throw new Error(`missing ${title} catalog entry`);
          return entry;
        });
        const event = gameEvent(page({
          commands: entries.map((entry) => ({
            kind: "m2Command" as const,
            commandId: entry.id,
            fields: createDefaultM2Fields(entry),
          })),
        }));
        project.maps[mapId].events = [event];

        const numericResult = validateEventDraftBody(project, mapId, event);

        expect(numericResult.issues.filter((issue) => issue.code === "reference.variable.missing")).toEqual([]);
        event.pages![0]!.commands[0] = {
          kind: "m2Command",
          commandId: entries[0]!.id,
          fields: {
            ...createDefaultM2Fields(entries[0]!),
            valueSource: "variable",
            valueVariableId: "missing-variable",
          },
        };

        const variableResult = validateEventDraftBody(project, mapId, event);

        expect(variableResult.issues).toContainEqual(expect.objectContaining({
          code: "reference.variable.missing",
          commandPath: [0],
        }));
      });

      it("checks legacy event conditions and authored positions without duplicating page logic", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          commands: [{ kind: "transfer", mapId, x: -1, y: 999 }],
        }));
        event.x = project.maps[mapId].width;
        event.condition = { kind: "switch", switchId: "missing-switch", value: true };
        event.schedule = [{ when: {}, at: { mapId: "missing-schedule-map", x: 0, y: 0 } }];
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const codes = result.issues.map((issue) => issue.code);

        expect(codes).toContain("event.position.out-of-bounds");
        expect(codes).toContain("map.position.out-of-bounds");
        expect(codes).toContain("reference.switch.missing");
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: "event.position.out-of-bounds",
          // 좌표 입력물은 죽은 identity 카드와 함께 사라졌다 — 앵커는 헤더의 보이는 좌표 표시다.
          field: { testId: "event-editor-coords" },
        }));
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: "reference.map.missing",
          field: { testId: "event-schedule-map-0" },
        }));
        expect(result.canCommit).toBe(false);
      });

      it("showEmote 대상은 없는 이벤트만 거부하고 현재 이벤트와 주인공은 허용한다", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          commands: [
            { kind: "showEmote", target: { eventId: "does-not-exist" }, emote: "heart" },
            { kind: "showEmote", target: { eventId: "" }, emote: "smile" },
            { kind: "showEmote", target: "player", emote: "question" },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const missing = result.issues.filter((issue) => issue.code === "reference.event.missing");

        expect(missing).toEqual([
          expect.objectContaining({ commandPath: [0], message: expect.stringContaining("이모트 대상 이벤트") }),
        ]);
        expect(missing.some((issue) => issue.commandPath?.[0] === 1)).toBe(false);
        expect(missing.some((issue) => issue.commandPath?.[0] === 2)).toBe(false);
      });

      it("validates every authored map position and field-spawn area family", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        if (!map) throw new Error("missing start map");
        const setVehicle = M2_COMMAND_CATALOG.find((entry) => entry.title === "Set Vehicle Location");
        const getTerrain = M2_COMMAND_CATALOG.find((entry) => entry.title === "Get Terrain ID");
        if (!setVehicle || !getTerrain) throw new Error("missing M2 coordinate commands");
        const event = gameEvent(page({
          movement: {
            type: "living",
            speed: 3,
            frequency: 3,
            route: {
              moves: [{ kind: "npcTransfer", mapId, x: map.width, y: 0 }],
              repeat: false,
            },
            living: {
              destinations: [{ mapId, x: 0, y: map.height }],
              repeat: true,
            },
          },
          commands: [
            {
              kind: "moveEvent",
              eventId: "",
              route: {
                moves: [{ kind: "npcTransfer", mapId, x: -1, y: 0 }],
                repeat: false,
              },
            },
            { kind: "addLight", source: { id: "light-1", at: { x: map.width, y: 0 }, radius: 4 } },
            {
              kind: "showAnimation",
              target: { x: 0, y: map.height },
              animationId: project.database.battleAnimations[0]?.id ?? "",
            },
            {
              kind: "spawnFieldEnemy",
              spawn: {
                id: "spawn-1",
                troopId: project.system.initialTroopId ?? project.database.troops[0]?.id ?? "",
                area: { x: map.width - 1, y: 0, w: 2, h: 1 },
              },
            },
            {
              kind: "m2Command",
              commandId: setVehicle.id,
              fields: { ...createDefaultM2Fields(setVehicle), mapId, x: map.width, y: 0 },
            },
            {
              kind: "m2Command",
              commandId: getTerrain.id,
              fields: { ...createDefaultM2Fields(getTerrain), x: 0, y: map.height },
            },
          ],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const positionIssues = result.issues.filter((issue) => issue.code === "map.position.out-of-bounds");

        expect(positionIssues).toHaveLength(6);
        expect(positionIssues).toEqual(expect.arrayContaining([
          expect.objectContaining({ commandPath: [0] }),
          expect.objectContaining({ commandPath: [1] }),
          expect.objectContaining({ commandPath: [2] }),
          expect.objectContaining({ commandPath: [4] }),
          expect.objectContaining({ commandPath: [5] }),
          expect.objectContaining({ field: { testId: "event-page-living-target-y" } }),
        ]));
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: "map.area.out-of-bounds",
          commandPath: [3],
        }));
        expect(result.canCommit).toBe(false);
      });

      it("ignores stale custom routes when another autonomous movement type is active", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const eventPage = page({
          movement: {
            type: "fixed",
            speed: 3,
            frequency: 3,
            route: {
              moves: [{ kind: "npcTransfer", mapId: "missing-map", x: 0, y: 0 }],
              repeat: false,
            },
          },
        });
        const event = gameEvent(eventPage);
        project.maps[mapId].events = [event];

        const inactiveResult = validateEventDraftBody(project, mapId, event);
        expect(inactiveResult.issues.some((issue) => issue.code === "reference.map.missing")).toBe(false);

        eventPage.movement.type = "custom";
        const customResult = validateEventDraftBody(project, mapId, event);
        expect(customResult.issues).toContainEqual(expect.objectContaining({
          code: "reference.map.missing",
          field: { testId: "event-page-move-route-npc-target-map", openTestId: "event-page-custom-route",
            scopeTestId: "event-page-move-route-dialog", selectTestId: "event-page-move-route-command-1" },
        }));
      });

      it("reports invisible collision and empty/no-op pages as nonfatal guidance", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          graphic: { transparent: true },
          priority: "same",
          overlapForbidden: true,
          commands: [],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: "page.invisible-collision", severity: "warning" }),
          expect.objectContaining({ code: "page.empty", severity: "info" }),
        ]));
        expect(result.canCommit).toBe(true);
      });
    });
    function issueOf(result: ReturnType<typeof validateEventDraftBody>, code: string) {
      const issue = result.issues.find((entry) => entry.code === code);
      expect(issue, `expected issue ${code}`).toBeDefined();
      return issue!;
    }
    describe("always-true / always-false condition traps", () => {
      it("warns when a timer threshold of 0 is always true while no timer is running", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "timer", timerId: "timer1", seconds: 0 }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const issue = issueOf(result, "condition.timer.always-true");

        expect(issue.severity).toBe("warning");
        expect(issue.pageId).toBe("page-1");
        expect(issue.field).toEqual({ testId: "event-page-timer1-condition-seconds" });
        expect(result.canCommit).toBe(true);
      });

      it("warns when an npc activity name is empty and can never match", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "npcActivity", activity: "" }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const issue = issueOf(result, "condition.npcActivity.empty");

        expect(issue.severity).toBe("warning");
        expect(issue.pageId).toBe("page-1");
        expect(issue.field).toEqual({ testId: "event-page-npc-activity-condition-input" });
        expect(result.canCommit).toBe(true);
      });

      // 페이지 조건의 battleResult 는 지속되는 세션 상태를 읽는다 — 랜덤 인카운터·필드 스폰은
      // battleProcessing 없이도 전투를 열고, 다른 이벤트·공통 이벤트가 남긴 결과도 살아남는다.
      // 명령 순서나 프로젝트 스캔으로 "항상 거짓"을 증명할 수 없어 이 추론 자체를 걷어냈다.
      it("does not warn for persistent battle results without a battleProcessing command", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "battleResult", result: "victory" }],
          commands: [{
            kind: "fork",
            condition: { kind: "battleResult", result: "defeat" },
            then: [{ kind: "text", body: "recover" }],
          }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);

        expect(result.issues.filter((issue) => issue.code === "condition.battleResult.no-preceding-battle")).toEqual([]);
      });

      it("warns when a gold comparison can never hold for the 0..GOLD_MAX range", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "gold", op: "<", amount: -1 }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const issue = issueOf(result, "condition.gold.impossible");

        expect(issue.severity).toBe("warning");
        expect(issue.pageId).toBe("page-1");
        expect(issue.field).toEqual({ testId: "event-page-advanced-condition-gold-amount-0" });
        expect(result.canCommit).toBe(true);
      });

      it("warns when a time-phase condition is authored without a time system", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "timePhase", phase: "night" }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const issue = issueOf(result, "condition.timePhase.no-time-system");

        expect(issue.severity).toBe("warning");
        expect(issue.pageId).toBe("page-1");
        expect(issue.field).toEqual({ testId: "event-page-time-phase-condition-input" });
        expect(result.canCommit).toBe(true);
      });

      it("warns when a season condition is authored without a time system", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent(page({
          conditions: [{ kind: "season", season: "winter" }],
        }));
        project.maps[mapId].events = [event];

        const result = validateEventDraftBody(project, mapId, event);
        const issue = issueOf(result, "condition.season.no-time-system");

        expect(issue.severity).toBe("warning");
        expect(issue.pageId).toBe("page-1");
        expect(issue.field).toEqual({ testId: "event-page-season-condition-input" });
        expect(result.canCommit).toBe(true);
      });

      it("does not throw when a page is missing graphic, movement, trigger, or commands", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const event = gameEvent({ id: "page-1", name: "첫 방문" } as EventPage);
        project.maps[mapId].events = [event];

        expect(() => validateEventDraftBody(project, mapId, event)).not.toThrow();
        const result = validateEventDraftBody(project, mapId, event);
        expect(result.issues.some((issue) => issue.code === "page.empty")).toBe(true);
        expect(result.canCommit).toBe(true);
      });
    });
    describe("common event call graph warnings", () => {
      function scenario(chain: string[][]) {
        const project = createBlankProject();
        project.commonEvents = chain.map((calls, index) => ({
          id: `ce-${index}`, name: `Common ${index}`, trigger: "none" as const,
          commands: calls.map((commonEventId) => ({ kind: "callCommonEvent" as const, commonEventId })),
        }));
        const event = gameEvent(page({ commands: [{ kind: "callCommonEvent", commonEventId: "ce-0" }] }));
        project.maps[project.startMapId].events = [event];
        return { project, event };
      }

      it("finds indirect cycles in common-event commands and locates the caller", () => {
        const { project, event } = scenario([["ce-1"], ["ce-0"]]);
        const result = validateEventDraftBody(project, project.startMapId, event);
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: "callCommonEvent.cycle", pageId: "page-1", commandPath: [0], severity: "warning",
        }));
      });

      it("warns only when reachable call depth exceeds eight", () => {
        const { project, event } = scenario(Array.from({ length: 9 }, (_, i) => i < 8 ? [`ce-${i + 1}`] : []));
        expect(validateEventDraftBody(project, project.startMapId, event).issues).toContainEqual(
          expect.objectContaining({ code: "callCommonEvent.recursionDepth" }),
        );
        project.commonEvents[7]!.commands = [];
        expect(validateEventDraftBody(project, project.startMapId, event).issues.some(
          (issue) => issue.code.startsWith("callCommonEvent."),
        )).toBe(false);
      });

      it("handles heavily repeated calls without expanding every execution path", () => {
        const { project, event } = scenario(Array.from({ length: 9 }, (_, i) =>
          i < 8 ? Array.from({ length: 10 }, () => `ce-${i + 1}`) : []));
        const issues = validateEventDraftBody(project, project.startMapId, event).issues;
        expect(issues.filter((issue) => issue.code === "callCommonEvent.recursionDepth")).toHaveLength(1);
      });

      it("finds calls inside nested common-event branches", () => {
        const { project, event } = scenario([[]]);
        project.commonEvents[0]!.commands = [{
          kind: "loop", body: [{ kind: "callCommonEvent", commonEventId: "ce-0" }],
        }];
        expect(validateEventDraftBody(project, project.startMapId, event).issues).toContainEqual(
          expect.objectContaining({ code: "callCommonEvent.cycle", commandPath: [0] }),
        );
      });

      it("does not warn about unrelated cycles or repeated nonrecursive calls", () => {
        const { project, event } = scenario([["ce-1", "ce-1"], [], ["ce-2"]]);
        expect(validateEventDraftBody(project, project.startMapId, event).issues.some(
          (issue) => issue.code.startsWith("callCommonEvent."),
        )).toBe(false);
      });
    });
  });
  describe("eventMapItemsBeginnerUx", () => {
    isolateTimers();
    /**
     * 지도·화면 효과 탭 초보자 UX 계약 (2026-08-27 audit-before.md 기반)
     * evidence: .omo/evidence/event-map-items/
     */

    describe("지도 탭 초보자 용어 계약", () => {
      it("피커에서 애니메이션 표시 항목들이 서로 다른 라벨을 갖는다", () => {
        const mapVisible = M2_COMMAND_CATALOG.filter(
          (e) => e.title === "Show Animation" && isM2CatalogEntrySelectableInMap(e),
        );
        // 2026-08-27 픽스: m2-055는 맵 피커에서 숨겨진다(중복 등재 제거).
        // 2026-11-26: m2-054 도 네이티브 showAnimation 으로 통합돼 맵 피커의 m2 행은 없다.
        expect(mapVisible.map((e) => e.index)).toEqual([]);
      });

      it("배틀 전용 Show Animation(m2-103)은 맵 피커에서 숨겨진다", () => {
        const battleOnly = M2_COMMAND_CATALOG.find((e) => e.index === 103);
        expect(battleOnly).toBeDefined();
        expect(isM2CatalogEntrySelectableInMap(battleOnly!)).toBe(false);
      });

      it("카탈로그 라벨에 내부 API 토큰(panTo 등)이 노출되지 않는다", () => {
        for (const entry of M2_COMMAND_CATALOG) {
          expect(entry.pickerLabel).not.toMatch(/panTo|this-event|parallax/i);
          expect(entry.label).not.toMatch(/panTo|this-event|parallax/i);
        }
      });
    });
    describe("조명 설정 초보자 표기 계약", () => {
      const source = readFileSync(
        join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
        "utf8",
      );

      it("밝기 입력은 % 스케일로 안내한다 (0.85 원문 노출 금지)", () => {
        // setLighting 입력 안내에 "0~1" 스케일 설명이 남아 있으면 실패
        expect(source).not.toContain('암전 정도(0~1)"');
      });

      it("같은 값을 세 이름으로 부르지 않는다", () => {
        // 미리보기 캡션이 AMB/주변광 대신 밝기로 통일돼야 함
        expect(source).not.toContain("`주변광 ${pct}%`");
        expect(source).not.toContain("`AMB ${pct}%`");
      });
    });
    describe("changeTile 실맵 미리보기 계약", () => {
      const source = readFileSync(
        join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
        "utf8",
      );

      it("타일 변경 폼이 맵 캔버스 미리보기를 그린다", () => {
        expect(source).toContain("drawTransferMapPreview");
      });
    });
  });
});

describe("projectEventCommandsSuite", () => {
  isolateTimers();
  describe("fieldStaging", () => {
    isolateTimers();
    type M2 = Extract<Command, { kind: "m2Command" }>;
    const m2Of = (commands: readonly Command[], commandId: string): M2[] =>
      commands.filter((command): command is M2 => command.kind === "m2Command" && command.commandId === commandId);
    describe("모습 효과 모델", () => {
      it("준 칸만 바꾸고 나머지는 앞 모습을 잇는다", () => {
        const red = nextSpriteLook(undefined, { tint: "red", pose: "keep", flip: "keep" });
        expect(red).toEqual({ tint: "#ff6060" });
        const fallen = nextSpriteLook(red, { pose: "fallen", flip: "on" });
        expect(fallen).toEqual({ tint: "#ff6060", pose: "fallen", flip: true });
        expect(nextSpriteLook(fallen, { reset: true })).toEqual({});
        expect(nextSpriteLook(fallen, { reset: true, tint: "blue" })).toEqual({ tint: "#6080ff" });
      });

      it("직접 색이 선택지보다 앞서고, 흰색 곱하기는 효과가 아니다", () => {
        expect(nextSpriteLook(undefined, { tint: "red", tintHex: "#00FF88" })).toEqual({ tint: "#00ff88" });
        expect(normalizeSpriteLook({ tint: "#ffffff" })).toEqual({});
        expect(normalizeSpriteLook({ tint: "white", tintFill: true })).toEqual({ tint: "#ffffff", tintFill: true });
      });

      it("불투명도는 % 로 받아 0~1 로 저장하고, 1 이면 지운다", () => {
        expect(nextSpriteLook(undefined, { opacity: "60" })).toEqual({ alpha: 0.6 });
        expect(nextSpriteLook({ alpha: 0.6 }, { opacity: "100" })).toEqual({});
      });

      it("저장 키는 주인공 하나, 이벤트는 맵마다 따로", () => {
        expect(spriteLookKey({ kind: "player" })).toBe("player");
        expect(spriteLookKey({ kind: "event", mapId: "m1", eventId: "ev" })).toBe("m1/ev");
      });
    });
    describe("레터박스", () => {
      it("빈 값은 기본 두께, 범위 밖은 자른다, 걷기는 0", () => {
        expect(letterboxPercentFromValue("")).toBe(12);
        expect(letterboxPercentFromValue("40")).toBe(25);
        expect(planScreenEffect("letterbox", "8", 300)).toEqual({ kind: "letterbox", percent: 8, durationMs: 300 });
        expect(planScreenEffect("clearLetterbox", "", 300)).toEqual({ kind: "letterbox", percent: 0, durationMs: 300 });
      });

      it("화면 효과 선택지 전부에 렌더 경로가 있다 — 조용한 실패 없음", () => {
        // 문 열기·닫기(#3375)는 값에 문 칸(x,y,너비,높이,방식,방향)이 있어야 렌더 경로가 생긴다 — 빈 값은 unsupported 로 기록된다.
        const doorValue = "2,3,2,2,slide,left";
        for (const option of SCREEN_EFFECT_OPTIONS) {
          const value = option.value === "doorOpen" || option.value === "doorClose" ? doorValue : "";
          expect(planScreenEffect(option.value, value, 300).kind, option.value).not.toBe("unsupported");
        }
      });
    });
    describe("새 명령 카탈로그", () => {
      it("파티클·모습 효과가 카탈로그에 있고 흔들기에 방향 칸이 있다", () => {
        expect(m2CommandById("m2-224-particle-effect")?.title).toBe("Particle Effect");
        expect(m2CommandById("m2-225-sprite-look")?.title).toBe("Sprite Look");
        expect(m2CommandById("m2-048-shake-screen")?.fields.some((field) => field.key === "direction")).toBe(true);
      });
    });
    describe("컷신 연출 비트", () => {
      it("letterbox 는 정리 단계가 자동으로 걷고, keep 이면 남긴다", () => {
        const auto = compileCutscene([{ kind: "letterbox" }, { kind: "say", speaker: "A", text: "…" }]);
        const effects = m2Of(auto, "m2-202-screen-effect").map((command) => command.fields.effect);
        expect(effects).toEqual(["letterbox", "clearLetterbox"]);
        const kept = compileCutscene([{ kind: "letterbox", size: 10, keep: true }]);
        expect(m2Of(kept, "m2-202-screen-effect").map((command) => command.fields.effect)).toEqual(["letterbox", "letterbox"]);
      });

      it("look 은 대상·포즈·색을 명령 필드로 옮기고 #rrggbb 는 직접 색 칸으로 보낸다", () => {
        const commands = compileCutscene([
          { kind: "look", target: "ev_guard", pose: "fallen", tint: "#123456" },
          { kind: "look", target: "player", afterimage: true, alpha: 0.5 },
        ]);
        const looks = m2Of(commands, "m2-225-sprite-look");
        expect(looks[0]?.fields).toMatchObject({ target: "event", eventId: "ev_guard", pose: "fallen", tintHex: "#123456" });
        expect(looks[1]?.fields).toMatchObject({ target: "player", afterimage: "on", opacity: "50" });
        // 정리 단계가 같은 명령을 순서대로 다시 건다(건너뛰어도 끝 모습이 같다).
        expect(looks).toHaveLength(4);
      });

      it("particles 는 x,y 만 주면 칸 대상, emote·weather·shake axis 는 해당 명령으로", () => {
        const commands = compileCutscene([
          { kind: "particles", preset: "explosion", x: 4, y: 5 },
          { kind: "emote", target: "player", emote: "exclamation" },
          { kind: "weather", weather: "rain", intensity: 0.7 },
          { kind: "shake", intensity: 6, axis: "vertical" },
        ]);
        expect(m2Of(commands, "m2-224-particle-effect")[0]?.fields).toMatchObject({ preset: "explosion", target: "tile", x: 4, y: 5 });
        expect(commands).toContainEqual(expect.objectContaining({ kind: "showEmote", target: "player", emote: "exclamation" }));
        expect(commands).toContainEqual(expect.objectContaining({ kind: "setWeather", weather: "rain", intensity: 0.7 }));
        expect(m2Of(commands, "m2-048-shake-screen")[0]?.fields).toMatchObject({ direction: "vertical", intensity: "6" });
      });

      it("틀린 어휘는 조용히 기본값이 되지 않고 거부된다", () => {
        expect(() => compileCutscene([{ kind: "particles", preset: "confetti" as never }])).toThrow(/파티클 종류/);
        expect(() => compileCutscene([{ kind: "look", pose: "dance" as never }])).toThrow(/자세/);
      });

      it("script_cutscene 이 새 비트를 명령 형식 오류 없이 저장한다", () => {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, "script_cutscene", {
          mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
          beats: [
            { kind: "letterbox", size: 12 },
            { kind: "emote", target: "player", emote: "exclamation", wait: true },
            { kind: "parallel", beats: [
              { kind: "particles", preset: "explosion", x: 5, y: 5 },
              { kind: "shake", intensity: 6, axis: "both" },
              { kind: "flash", color: "white" },
            ] },
            { kind: "look", target: "player", pose: "fallen", tint: "gray" },
            { kind: "say", speaker: "나", text: "…" },
            { kind: "look", target: "player", reset: true },
          ],
        });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      });

      it("kind 를 빠뜨린 비트는 칸으로 종류를 짐작해 채우고 경고한다", () => {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, "script_cutscene", {
          mapId: ctx.project.startMapId, x: 3, y: 3,
          beats: [
            { speaker: "레아", text: "스승님!" },
            { target: "player", moves: [{ kind: "turn", dir: "up" }] },
            { look: "player", pose: "fallen" },
            { preset: "sparkle", target: "player" },
          ],
        });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        // 쓰기 도구의 경고는 실행기가 diff.warnings 로 옮긴다(toolRunner).
        expect(JSON.stringify(result.diff?.warnings ?? result.warnings)).toContain("kind 가 빠진 비트 4개");
      });

      it("연출 지침 도구가 등록돼 있다", () => {
        const result = runTool({ project: createBlankProject() }, "read_directing_guide", {});
        expect(result.ok).toBe(true);
        expect(JSON.stringify(result)).toContain("letterbox");
      });
    });
  });
  describe("screenDistortion", () => {
    isolateTimers();
    describe("화면 왜곡 모델", () => {
      it("빈 값은 기본 세기, 숫자는 그 세기, 0 은 그 축만 끈다", () => {
        expect(nextScreenDistortion(undefined, "wave", "")).toEqual({ ...NEUTRAL_SCREEN_DISTORTION, wave: SCREEN_DISTORTION_DEFAULTS.wave });
        const both = nextScreenDistortion(nextScreenDistortion(undefined, "wave", "6"), "mosaic", "8");
        expect(both).toEqual({ wave: 6, mosaic: 8, rotate: 0 });
        expect(nextScreenDistortion(both, "wave", "0")).toEqual({ wave: 0, mosaic: 8, rotate: 0 });
        expect(nextScreenDistortion(both, "clearDistortion", "")).toEqual(NEUTRAL_SCREEN_DISTORTION);
      });

      it("범위 밖 값은 클램프하고 숫자가 아니면 0", () => {
        expect(normalizeScreenDistortion({ wave: 99, mosaic: -3, rotate: "400" })).toEqual({ wave: 16, mosaic: 0, rotate: 180 });
        expect(normalizeScreenDistortion({ wave: "abc" })).toEqual(NEUTRAL_SCREEN_DISTORTION);
      });

      it("모자이크 1 이하는 꺼짐으로 본다", () => {
        expect(isNeutralScreenDistortion({ wave: 0, mosaic: 1, rotate: 0 })).toBe(true);
        expect(isNeutralScreenDistortion({ wave: 0, mosaic: 2, rotate: 0 })).toBe(false);
        expect(isNeutralScreenDistortion(undefined)).toBe(true);
      });

      it("전환은 끝점을 정확히 지나고 중간은 반쯤이다", () => {
        const from = NEUTRAL_SCREEN_DISTORTION;
        const to = { wave: 8, mosaic: 16, rotate: -10 };
        expect(interpolateScreenDistortion(from, to, 0)).toEqual(from);
        expect(interpolateScreenDistortion(from, to, 1)).toEqual(to);
        expect(interpolateScreenDistortion(from, to, 0.5).wave).toBeCloseTo(4, 10);
      });
    });
    describe("화면 효과 명령 → 왜곡", () => {
      it("새 옵션 넷은 전부 렌더 경로(distortion)가 있다 — 조용한 실패 없음", () => {
        for (const effect of ["wave", "mosaic", "rotate", "clearDistortion"]) {
          expect(SCREEN_EFFECT_OPTIONS.some((option) => option.value === effect)).toBe(true);
          expect(planScreenEffect(effect, "", 300).kind).toBe("distortion");
        }
      });
    });
    describe("컷신 distort 비트", () => {
      it("화면 효과 명령으로 컴파일되고, 정리 단계가 마지막 상태를 다시 건다", () => {
        const commands = compileCutscene([
          { kind: "distort", effect: "wave", amount: 5, durationMs: 400 },
          { kind: "say", speaker: "A", text: "물속이다" },
        ]);
        const effects = commands.filter((command) => command.kind === "m2Command" && command.fields.effect === "wave");
        expect(effects.length).toBeGreaterThanOrEqual(2);
        expect(effects[0]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 400 } });
        expect(effects[effects.length - 1]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 0 } });
      });
    });
  });
  describe("singleEventCommandOps", () => {
    isolateTimers();
    const text: Command = { kind: "text", body: "문을 열까?", speaker: "문지기" };
    const wait: Command = { kind: "wait", ms: 100 };
    function page(...commands: Command[]): EventPage {
      return { id: "page1", name: "입구", conditions: [], trigger: { kind: "action" }, priority: "below", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
    }
    describe("이벤트 명령 한 줄", () => {
      it("처음과 끝에서 끼워 넣고 수정하고 지운다. 원본 페이지와 입력은 보존한다", () => {
        const original = page(wait);
        const first = insertEventCommand(original, 0, text);
        const last = insertEventCommand(first, 2, text);
        const updated = updateEventCommand(last, 2, { body: "문을 열자." }, eventCommandHash(text));
        expect(updated.commands).toEqual([text, wait, { ...text, body: "문을 열자." }]);
        expect(deleteEventCommand(updated, 0, eventCommandHash(text))).toEqual(page(wait, { ...text, body: "문을 열자." }));
        expect(deleteEventCommand(updated, 2, eventCommandHash(updated.commands[2]!))).toEqual(first);
        expect(insertEventCommand(page(), 0, text).commands).toEqual([text]);
        expect(deleteEventCommand(page(text), 0, eventCommandHash(text)).commands).toEqual([]);
        expect(original.commands).toEqual([wait]);
        expect(first.commands[0]).not.toBe(text);
      });

      it("줄이 바뀌면 이전 해시를 거절하고 키 순서만 다른 해시는 받는다", () => {
        const original = page(text);
        const reordered = { speaker: "문지기", body: "문을 열까?", kind: "text" } as const;
        expect(eventCommandHash(reordered)).toBe(eventCommandHash(text));
        const changed = updateEventCommand(original, 0, { body: "수정" }, eventCommandHash(reordered));
        for (const operation of [
          () => updateEventCommand(changed, 0, { speaker: "상인" }, eventCommandHash(text)),
          () => deleteEventCommand(changed, 0, eventCommandHash(text)),
        ]) expect(operation).toThrow("내용이 바뀌었습니다");
        expect(() => insertEventCommand(original, -1, wait)).toThrow();
        expect(() => insertEventCommand(original, 2, wait)).toThrow();
        expect(() => deleteEventCommand(original, 1, eventCommandHash(text))).toThrow();
        expect(() => updateEventCommand(original, 0, { kind: "wait" }, eventCommandHash(text))).toThrow("명령 종류");
      });

      it("조건·반복·선택지 안의 한 줄을 수정하면서 분기 구조를 보존한다", () => {
        const choices: Command = { kind: "choices", options: [{ text: "첫 선택", branch: [text] }], cancelBranch: [wait] };
        const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [
          { kind: "loop", body: [choices, { kind: "breakLoop" }] },
        ], else: [wait] };
        const original = page(fork);
        const nested = [0, FORK_THEN_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX, 0, 0];
        const edited = insertEventCommand(original, [...nested, 1], wait);
        const updated = updateEventCommand(edited, [...nested, 0], { body: "분기 안의 대사" }, eventCommandHash(text));
        const deleted = deleteEventCommand(updated, [...nested, 1], eventCommandHash(wait));
        expect(deleted.commands).toEqual([{ ...fork, then: [{ kind: "loop", body: [
          { ...choices, options: [{ text: "첫 선택", branch: [{ ...text, body: "분기 안의 대사" }] }] }, { kind: "breakLoop" },
        ] }] }]);
        expect(original.commands).toEqual([fork]);
        expect(updateEventCommand(page(choices), 0, { optionLabels: ["새 문구"] }, eventCommandHash(choices)).commands).toEqual([
          { ...choices, options: [{ text: "새 문구", branch: [text] }] },
        ]);
        expect(() => deleteEventCommand(original, 0, eventCommandHash(fork))).toThrow("분기 안에 명령");
        expect(() => deleteEventCommand(page(choices), 0, eventCommandHash(choices))).toThrow("분기 안에 명령");
        expect(() => updateEventCommand(original, 0, { then: [] }, eventCommandHash(fork))).toThrow("분기 안의 명령");
        expect(() => updateEventCommand(page(choices), 0, { options: [] }, eventCommandHash(choices))).toThrow("분기 안의 명령");
        expect(() => insertEventCommand(original, [0, 99, 0], text)).toThrow();
        expect(() => insertEventCommand(original, [0, FORK_THEN_BRANCH_INDEX], text)).toThrow();
        expect(() => insertEventCommand(original, 1, { kind: "breakLoop" })).toThrow("반복 안에만");
        expect(() => insertEventCommand(original, 1, { kind: "text" } as Command)).toThrow("문구가 필요");
      });

      it("없는 조건 분기는 삽입할 때 만들고 수정과 삭제는 거절한다", () => {
        const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [wait] };
        const original = page(fork);
        const path = [0, FORK_ELSE_BRANCH_INDEX, 0];
        expect(() => updateEventCommand(original, path, { body: "분기 안의 대사" }, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
        expect(() => deleteEventCommand(original, path, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
        expect(insertEventCommand(original, path, text).commands).toEqual([{ ...fork, else: [text] }]);
        expect(original.commands[0]).not.toHaveProperty("else");
      });

      it("등록된 쓰기 도구와 get_event 해시로 실제 도구 실행 경계를 왕복한다", async () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        project.tilesets = { [map.tilesetId]: project.tilesets[map.tilesetId]! };
        map.events.push({
          id: "gate", name: "문지기", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
          pages: [page({ kind: "choices", options: [{ text: "연다", branch: [text] }] }), { ...page(wait), id: "page2" }],
        });
        const ctx: ToolContext = { project, assistantRun: true };
        const target = { mapId, eventId: "gate", pageId: "page1" };
        const getHashes = async () => {
          const read = await runToolAsync(ctx, "get_event", { mapId, eventId: "gate", includeCommandHashes: true });
          expect(read.ok, read.summary).toBe(true);
          return (read.data as { commandHashes: { commands: { index: number; branchPath: number[]; hash: string }[] }[] }).commandHashes;
        };
        for (const name of ["insert_event_command", "update_event_command", "delete_event_command"]) {
          expect(getTool(name)?.mode).toBe("write");
        }
        const initialHashes = await getHashes();
        const leaf = initialHashes[0]!.commands[1]!;
        const row = { ...target, index: leaf.index, branchPath: leaf.branchPath };
        const updated = await runToolAsync(ctx, "update_event_command", { ...row, patch: { body: "지금은 닫혔다." }, expectedHash: leaf.hash });
        expect(updated.ok, updated.summary).toBe(true);
        expect(updated.summary).toContain("『문지기』");
        const staleProject = ctx.project;
        const stale = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: leaf.hash });
        expect(stale).toMatchObject({ ok: false, issues: [{ code: "stale-event-command" }] });
        expect(ctx.project).toBe(staleProject);
        const newLeaf = (await getHashes())[0]!.commands[1]!;
        const deleted = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: newLeaf.hash });
        expect(deleted.ok, deleted.summary).toBe(true);
        const inserted = await runToolAsync(ctx, "insert_event_command", { ...row, command: { kind: "text", speaker: "문지기", body: "다음에 오세요." } });
        expect(inserted.ok, inserted.summary).toBe(true);
        expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "dialogue" }).ok).toBe(true);
        expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "eventPage" }).ok).toBe(true);

        const loop = { kind: "loop", body: [{ kind: "breakLoop" }] };
        const insertedLoop = await runToolAsync(ctx, "insert_event_command", { ...target, index: 1, command: loop });
        expect(insertedLoop.ok, insertedLoop.summary).toBe(true);
        expect(ctx.project.maps[mapId]?.events.at(-1)?.pages?.[0]?.commands[1]).toEqual(loop);
      }, 60_000);
    });
  });
});

describe("runtimeSupport", () => {
  isolateTimers();
  // Step 0 회귀 스펙(2026-08-20): 배틀 이벤트 executor 는 Command 전 kind 를 무음 스킵하지 않는다.
  // 불변식 — 각 kind 는 (a) troop-full 로 선언된 실제 처리 kind 이거나,
  //          (b) 페이지 실행 시 unsupported/message 등 추적 로그를 반드시 남긴다.
  // (기존 battleEvents.ts:416 fall-through 는 스위치에 없는 16종을 로그 없이 삼켰다.)
  describe("battleEventsExhaustive", () => {
    isolateTimers();
    const PAGE_ID = "page_exhaustive";
    // battleEvents.ts:416 fall-through(return false)로 무음 스킵되던 16종 — Step 0 에서 명시적
    // logUnsupported case 로 편입했다. 이 목록은 회귀 방지용 고정 스냅샷이다.
    // Step 3d(2026-08-20): promoteActor 는 실제 실행(troop-full)으로 승격되어 목록에서 빠짐.
    const PREVIOUSLY_SILENT_KINDS = [
      "giveMonster",
      "evolveMonster",
      "openChest",
      "advanceTime",
      "setTime",
      "sleepUntilMorning",
      "craftRecipe",
      "applyItemUpgrade",
      "equipTool",
      "changeLifeSkillExp",
      "moveMonster",
      "openSaveMenu",
      "spawnFieldEnemy",
      "despawnFieldEnemy",
      "tacticsBattle",
      "advanceCropGrowth",
    ] as const satisfies readonly Command["kind"][];
    function runBattlePageWith(command: Command): readonly BattleEventLogSnapshot[] {
      const project = deserialize(JSON.stringify(battleFixture));
      const troop = project.database.troops.find((record) => record.id === "troop_slime");
      if (!troop) throw new Error("missing troop_slime");
      troop.battleEventPages.splice(0, troop.battleEventPages.length, {
        id: PAGE_ID,
        name: "전수 검증",
        conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
        span: "battle",
        commands: [command],
      });
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
      });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "defend" });
      return runtime.snapshot().eventLogs.filter((log) => log.pageId === PAGE_ID);
    }
    describe("battle event executor exhaustive command coverage", () => {
      it("Command 전 kind 무음 스킵 0건: troop-full 선언이거나 페이지에 추적 로그가 남는다", () => {
        for (const kind of COMMAND_KINDS) {
          const command = newCommand(kind);
          const logs = runBattlePageWith(command);
          expect(logs.some((log) => log.kind === "fired"), `${kind}: 배틀 페이지가 발화하지 않음`).toBe(true);
          const traced = logs.some((log) => log.kind !== "fired");
          const declaredFull = battleEventCommandRuntimeSupport(command) === "runtime-full";
          expect(
            declaredFull || traced,
            `${kind}: 무음 스킵 — troop-full 선언도 아니고 unsupported/message 로그도 없음`
          ).toBe(true);
        }
      });

      it("기존 fall-through 16종은 명시적 unsupported 로그를 남긴다", () => {
        for (const kind of PREVIOUSLY_SILENT_KINDS) {
          const logs = runBattlePageWith(newCommand(kind));
          expect(
            logs.some((log) => log.kind === "unsupported" && log.detail === kind),
            `${kind}: 명시적 unsupported 로그(detail=kind)가 없음`
          ).toBe(true);
        }
      });

      it("fall-through 16종은 troop-full 로 선언되지 않는다 (배지 정직성)", () => {
        for (const kind of PREVIOUSLY_SILENT_KINDS) {
          expect(battleEventCommandRuntimeSupport(newCommand(kind)), kind).not.toBe("runtime-full");
        }
      });
    });
  });
  describe("eventCommandCompletionSupport", () => {
    isolateTimers();
    describe("completed battle event support", () => {
      it.each(["text", "changeFace", "displayTextSettings", "wait", "inputWait"] as const)(
        "exposes verified native %s behavior without the obsolete limitation",
        (kind) => {
          expect(COMMAND_GUARANTEES[kind].supportByContext.troop).toBe("full");
          expect(commandRuntimeSupportDescriptor({ kind }, "troop")).toEqual({
            support: "runtime-full",
          });
        },
      );

      it.each([
        "m2-001-show-text",
        "m2-002-display-text-settings",
        "m2-003-change-faceset",
        "m2-060-wait",
        "m2-067-key-input-processing",
      ])("does not promote unverified persisted alias %s", (commandId) => {
        expect(m2CommandRuntimeSupport(commandId, "troop")).toBe("runtime-partial");
      });
    });
    describe.each(["map", "common"] as const)("system cue support in %s", (context) => {
      it.each([
        ["m2-027-change-system-bgm", "battle"],
        ["m2-027-change-system-bgm", "victory"],
        ["m2-028-change-system-se", "confirm"],
        ["m2-028-change-system-se", "buzzer"],
      ] as const)("classifies the explicit %s/%s cue by its actual consumer", (commandId, cue) => {
        const command: Command = {
          kind: "m2Command",
          commandId,
          fields: { cue, resourceId: "qa_audio", volume: 37 },
        };
        expect(commandRuntimeSupport(command, context)).toBe("runtime-full");
        expect(commandRuntimeSupportDescriptor(command, context)).toEqual({
          support: "runtime-full",
        });
        expect(commandRuntimeSupport(command, "troop")).toBe("runtime-partial");
      });

      it.each([
        ["m2-027-change-system-bgm", undefined],
        ["m2-028-change-system-se", undefined],
        ["m2-027-change-system-bgm", "confirm"],
        ["m2-028-change-system-se", "battle"],
      ] as const)("retains the legacy limitation for %s with cue %s", (commandId, cue) => {
        const command: Command = {
          kind: "m2Command",
          commandId,
          fields: { ...(cue === undefined ? {} : { cue }), resourceId: "qa_audio" },
        };
        expect(commandRuntimeSupportDescriptor(command, context)).toMatchObject({
          support: "runtime-partial",
          reasonCode: "system-audio-metadata-only",
        });
      });
    });
  });
  describe("m2EventCommandCatalog", () => {
    isolateTimers();
    describe("m2 event command catalog", () => {
      it("covers every non-front-matter PDF command row with stable ids", () => {
        const pdfEntries = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108);

        expect(pdfEntries).toHaveLength(108);
        // 133 → 135: m2-226 Lift Ride (#3509), m2-227 Journal Line (#3546).
        expect(M2_COMMAND_CATALOG).toHaveLength(135);
        expect(new Set(M2_COMMAND_CATALOG.map((entry) => entry.id)).size).toBe(135);
        // 주석은 탭 1 저작면의 1급 카드가 아니다 — 시스템·도구 탭으로 옮겼다.
        // 34 → 35: Journal Line(#3546)은 대화·흐름 묶음으로 탭 1 에 놓인다.
        expect(pageCount(1)).toBe(35);
        expect(pageCount(2)).toBeGreaterThan(0);
        expect(pageCount(3)).toBeGreaterThan(0);
        expect(pdfEntries.filter((entry) => entry.pickerPage === 4).length).toBeGreaterThan(0);
      });

      it("classifies the required validation commands explicitly", () => {
        expect(requireEntry("Display Text Settings").existingKind).toBe("displayTextSettings");
        expect(requireEntry("Return to Title Screen").existingKind).toBe("returnToTitle");
        expect(requireEntry("Shop Processing").existingKind).toBe("shop");
        expect(requireEntry("Inn Processing").existingKind).toBe("inn");
        expect(requireEntry("Input Number").existingKind).toBe("inputNumber");
        expect(requireEntry("Key Input Processing").existingKind).toBe("inputWait");
        expect(requireEntry("Wait").existingKind).toBe("wait");
        expect(requireEntry("Change Skills").existingKind).toBe("learnSkill");
        expect(requireEntry("Change Skills").runtimeSupport).toBe("runtime-full");
        expect(requireEntry("Change Equipment").existingKind).toBe("changeEquipment");
        expect(requireEntry("Change HP").existingKind).toBe("changeActorHp");
        expect(requireEntry("Change MP").existingKind).toBe("changeActorMp");
        expect(requireEntry("Recover All").existingKind).toBe("recoverAll");
        expect(requireEntry("Change EXP").existingKind).toBe("changeExp");
        expect(requireEntry("Change Level").existingKind).toBe("changeLevel");
        expect(M2_COMMAND_CATALOG.some((entry) => entry.title === "Ending")).toBe(false);
      });

      it("keeps the normal map picker limited to map-safe commands", () => {
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Show Text"))).toBe(true);
        expect(requireEntry("Comment").runtimeSupport).toBe("editor-only");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Comment"))).toBe(true);
        expect(requireEntry("Display Text Settings").runtimeSupport).toBe("runtime-full");
        expect(m2CommandRuntimeSupport(requireEntry("Display Text Settings").id, "troop")).toBe("runtime-partial");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Display Text Settings"))).toBe(true);
        // 배지 정직성(2026-08-20): 카탈로그의 정적 runtimeSupport 는 컨텍스트를 모르는
        // 보수 판정(세 컨텍스트 중 최저)이다. Open Load Menu(m2-093)는 검증 후
        // map/common full 이지만 troop 은 partial 이므로 정적 값은 partial 을 유지한다.
        expect(requireEntry("Open Load Menu").runtimeSupport).toBe("runtime-partial");
        expect(m2CatalogEntryRuntimeSupport(requireEntry("Open Load Menu"), "map")).toBe("runtime-full");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Open Load Menu"))).toBe(true);
        expect(requireEntry("Break Loop").runtimeSupport).toBe("runtime-full");
        expect(requireEntry("Break Loop").existingKind).toBe("breakLoop");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Break Loop"))).toBe(true);
        expect(requireEntry("Loop").existingKind).toBe("loop");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Loop"))).toBe(true);
        // Move Picture(m2-052)는 map/common full, troop partial — 정적 값은 보수 partial,
        // 실제 편집 컨텍스트(map)에서는 full 로 표시된다.
        expect(requireEntry("Move Picture").runtimeSupport).toBe("runtime-partial");
        expect(m2CatalogEntryRuntimeSupport(requireEntry("Move Picture"), "map")).toBe("runtime-full");
        expect(requireEntry("Move Picture").bodyStrategy).toBe("generic");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Move Picture"))).toBe(true);
        // Change Enemy HP(m2-098)는 troop 전용 full — 정적 보수 값은 partial.
        expect(requireEntry("Change Enemy HP").runtimeSupport).toBe("runtime-partial");
        expect(m2CatalogEntryRuntimeSupport(requireEntry("Change Enemy HP"), "troop")).toBe("runtime-full");
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Enemy HP"))).toBe(false);
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Skills"))).toBe(true);
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Equipment"))).toBe(true);
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Change HP"))).toBe(true);
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Recover All"))).toBe(true);
      });

      it("selects every non-battle PDF row in the map picker and excludes battle-only rows", () => {
        const mapRows = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108 && isM2CatalogEntrySelectableInMap(entry));

        // m2-055(Show Animation 중복 등재)는 2026-08-27 초보자 UX 픽스로 맵 피커에서 제외됐다.
        // m2-050·054·066 은 2026-11-26 네이티브(setWeather·showAnimation·playMovie)로 통합돼 제외됐다.
        // 판정 정본은 `DEPRECATED_M2_COMMAND_IDS` (은퇴 레지스트리) 다.
        expect(mapRows.map((entry) => entry.index)).toEqual(
          Array.from({ length: 97 }, (_, index) => index + 1).filter((index) => ![50, 54, 55, 66].includes(index)),
        );
        const pageOneRows = mapRows.filter((entry) => entry.pickerPage === 1);
        const pageOneGroupsByTitle = new Map(pageOneRows.map((entry) => [entry.title, entry.pickerGroup]));
        expect(pageOneRows.map((entry) => entry.title)).toEqual(
          expect.arrayContaining([
          "Show Text",
          "Display Text Settings",
          "Change Faceset",
          "Show Choices",
          "Input Number",
          "Control Switches",
          "Control Variables",
          "Change Gold",
          "Change Items",
          "Shop Processing",
          "Inn Processing",
          "Transfer Player",
          "Move Event",
          "Wait for All Movement",
          "Wait",
          "Play BGM",
          "Fadeout BGM",
          "Play SE",
          "Conditional Branch",
          "Erase Event",
          // 2026-08-26 IA 수리: 흐름·시간·입력·BGM 기억은 시스템 탭이 아니라 탭 1 저작면이다.
          "Control Timer",
          "Name Input Processing",
          "Label",
          "Jump to Label",
          "Loop",
          "Break Loop",
          "End Event Processing",
          "Memorize Current BGM",
          "Play Memorized BGM",
          ])
        );
        expect(pageOneRows).toHaveLength(29);
        // 탭 1 헤딩은 RM 분류명이 아니라 저작면이다: 말하기 / 고르기 / 옮기기 / 거래 / 흐름 / 소리.
        expect(pageOneGroupsByTitle.get("Show Text")).toBe("말하기");
        expect(pageOneGroupsByTitle.get("Show Choices")).toBe("고르기");
        expect(pageOneGroupsByTitle.get("Control Switches")).toBe("흐름");
        expect(pageOneGroupsByTitle.get("Conditional Branch")).toBe("흐름");
        expect(pageOneGroupsByTitle.get("Transfer Player")).toBe("옮기기");
        expect(pageOneGroupsByTitle.get("Erase Event")).toBe("옮기기");
        expect(pageOneGroupsByTitle.get("Change Gold")).toBe("거래");
        expect(pageOneGroupsByTitle.get("Play BGM")).toBe("소리");
        expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change EXP");
        expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change System BGM");
        expect(new Set(pageOneRows.map((entry) => entry.pickerGroup))).toEqual(
          new Set(["말하기", "고르기", "옮기기", "거래", "흐름", "소리"])
        );
        for (const page of [1, 2, 3, 4] as const) {
          expect(new Set(mapRows.filter((entry) => entry.pickerPage === page).map((entry) => entry.pickerGroup)).size).toBeGreaterThan(
            0
          );
        }
      });

      it("allows battle-only commands only in troop battle event authoring", () => {
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Enemy Encounter"))).toBe(false);
        expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Battleback"))).toBe(false);

        expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Enemy Encounter"))).toBe(true);
        expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Change Battleback"))).toBe(true);
        expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Open Load Menu"))).toBe(true);
        expect(createDefaultM2Fields(requireEntry("Enemy Encounter"))).toEqual({ target: "" });
        expect(createDefaultM2Fields(requireEntry("Change Battleback"))).toEqual({ resourceId: "" });
      });

      it("keeps duplicate Show Animation sections as separate catalog features", () => {
        const showAnimations = M2_COMMAND_CATALOG.filter((entry) => entry.title === "Show Animation");

        expect(showAnimations).toHaveLength(3);
        expect(new Set(showAnimations.map((entry) => entry.id)).size).toBe(3);
      });

      it("creates typed default fields for every generic m2 command", () => {
        const genericEntries = M2_COMMAND_CATALOG.filter((entry) => !entry.existingKind);

        expect(genericEntries.length).toBeGreaterThan(70);
        for (const entry of genericEntries) {
          const command = newM2Command(entry.id);
          expect(command).toEqual({
            kind: "m2Command",
            commandId: entry.id,
            fields: createDefaultM2Fields(entry),
          });
          expect(m2CommandById(command.commandId)).toBe(entry);
        }
      });

      it("adds a complete modern command group without hiding it behind legacy PDF-only rows", () => {
        const modernTitles = [
          "Camera Control",
          "Screen Effect",
          "Spawn Event",
          "Remove Event",
          "Pathfind Move",
          "Wait Until",
          "Region Trigger",
          "Quest Objective",
          "Advanced Dialogue",
          "Sound Layer",
          "Weighted Branch",
          "Cutscene Control",
          "Checkpoint Save",
          "UI Command",
          "Debug Log",
          "Evaluate Expression",
          "Data Query",
        ];

        // 배지 정직성(2026-08-20): 정적 runtimeSupport 는 보수 판정. 모던 커맨드 중
        // Advanced Dialogue inherits the completed native text contract, not its persisted alias.
        // map 컨텍스트 full 여부는 M2_MAP_COMMON_FULL_IDS 멤버십이 정본이다.
        // 2026-08-26 IA 수리: 모던 명령도 성격대로 탭을 받는다. 시스템·도구만 탭 4 에 남는다.
        const modernPageByTitle: Readonly<Record<string, number>> = {
          "Camera Control": 3,
          "Screen Effect": 3,
          "Spawn Event": 3,
          "Remove Event": 3,
          "Pathfind Move": 3,
          "Region Trigger": 3,
          "Cutscene Control": 3,
          "Wait Until": 1,
          "Weighted Branch": 1,
          "Quest Objective": 1,
          "Advanced Dialogue": 1,
          "Sound Layer": 1,
          "Checkpoint Save": 4,
          "UI Command": 4,
          "Debug Log": 4,
          "Evaluate Expression": 4,
          "Data Query": 4,
        };
        // Screen Effect(m2-202) joined M2_MAP_COMMON_FULL_IDS on 2026-10-02 (see m2RuntimeClassificationData.ts).
        const mapFullModernTitles = new Set(["Camera Control", "Screen Effect", "Spawn Event", "Remove Event", "Pathfind Move", "Wait Until", "Sound Layer"]);
        for (const title of modernTitles) {
          const entry = requireEntry(title);
          expect(entry.runtimeSupport).toBe(title === "Advanced Dialogue" ? "runtime-full" : "runtime-partial");
          expect(m2CatalogEntryRuntimeSupport(entry, "map")).toBe(
            title === "Advanced Dialogue" || mapFullModernTitles.has(title) ? "runtime-full" : "runtime-partial"
          );
          if (title === "Advanced Dialogue") {
            expect(entry.bodyStrategy).toBe("existing");
            expect(entry.existingKind).toBe("text");
            expect(createDefaultM2Fields(entry)).toEqual({});
            expect(m2CommandRuntimeSupport(entry.id, "troop")).toBe("runtime-partial");
          } else {
            expect(entry.bodyStrategy).toBe("generic");
            expect(createDefaultM2Fields(entry)).not.toEqual({});
          }
          expect(entry.pickerPage).toBe(modernPageByTitle[title]);
          // Advanced Dialogue 는 「문장 표시」로 통합된 은퇴 행이다 — 새로 저작하는 경로가 없어야 한다.
          expect(isM2CatalogEntrySelectableInMap(entry)).toBe(title !== "Advanced Dialogue");
          expect(entry.label).not.toBe(title);
        }
      });

      it("publishes only the three runtime support grades", () => {
        // 배지 정직성(2026-08-20): 정적 카탈로그 값은 보수 판정이므로 세 등급이 모두 나타난다.
        // (M2_MAP_COMMON_FULL_IDS 와 M2_TROOP_FULL_IDS 는 서로소라 순수 m2 행은 모두 partial.)
        const grades = new Set(M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport));
        expect(grades).toEqual(new Set(["runtime-full", "runtime-partial", "editor-only"]));
        expect(M2_COMMAND_CATALOG.map((entry) => entry.supportStatus)).toEqual(
          M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport)
        );
        expect(requireEntry("Comment").supportStatus).toBe("editor-only");
        // Native input/text now use real troop hosts; persisted M2 aliases remain conservative.
        expect(requireEntry("Key Input Processing").supportStatus).toBe("runtime-full");
        expect(m2CatalogEntryRuntimeSupport(requireEntry("Key Input Processing"), "map")).toBe("runtime-full");
        expect(m2CatalogEntryRuntimeSupport(requireEntry("Key Input Processing"), "troop")).toBe("runtime-full");
        expect(requireEntry("Show Text").supportStatus).toBe("runtime-full");
        for (const title of ["Key Input Processing", "Show Text"]) {
          expect(m2CommandRuntimeSupport(requireEntry(title).id, "troop")).toBe("runtime-partial");
        }
        // 아래 다섯 개는 M2_MAP_COMMON_FULL_IDS 멤버 — map/common 에서는 full 이지만
        // troop 에서는 partial 이므로 컨텍스트 없는 정적 값은 보수적으로 partial 이다.
        for (const title of ["Change Parameters", "Change State", "Damage Processing", "Change Actor Graphic", "Scroll Map"]) {
          expect(requireEntry(title).supportStatus).toBe("runtime-partial");
          expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "map")).toBe("runtime-full");
          expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "common")).toBe("runtime-full");
          expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "troop")).toBe("runtime-partial");
        }
      });

      it("keeps the support table aligned with implemented battle M2 ids", () => {
        // 배틀 전용 커맨드의 full 판정은 troop 컨텍스트로 확인한다(정적 값은 보수 partial).
        const fullBattleIds = M2_COMMAND_CATALOG
          .filter((entry) => entry.index >= 98 && entry.index <= 108 && m2CatalogEntryRuntimeSupport(entry, "troop") === "runtime-full")
          .map((entry) => entry.id);

        expect(fullBattleIds).toEqual([
          "m2-098-change-enemy-hp",
          "m2-099-change-enemy-mp",
          "m2-100-change-enemy-state",
          "m2-101-enemy-encounter",
          "m2-102-change-battleback",
          "m2-103-show-animation",
          "m2-104-battle-events",
          "m2-105-abort-battle",
          "m2-106-call-common-event",
          "m2-107-force-escape",
          "m2-108-action-times",
        ]);
        for (const entry of M2_COMMAND_CATALOG.filter((candidate) => !candidate.existingKind)) {
          expect(m2CommandRuntimeSupport(entry.id)).toBe(entry.runtimeSupport);
          expect(commandRuntimeSupport(newM2Command(entry.id))).toBe(entry.runtimeSupport);
        }
      });

      it("does not let generic editor-only m2 commands fall through the interpreter unknown branch", () => {
        const entry = requireEntry("Comment");
        const command = newM2Command(entry.id);
        const frame: Frame = { commands: [command], pc: 0 };
        const state: InterpreterState = {
          stack: [frame],
          session: createSession(),
          maxStackDepth: 8,
          maxLoopIterations: 8,
          instructionsExecuted: 0,
          maxInstructions: 100,
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const result = executeCommand(state, frame, command);

        expect(result).toEqual({ kind: "continue" });
        expect(frame.pc).toBe(1);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });

      it("applies display text settings in the map interpreter runtime path", () => {
        const entry = requireEntry("Display Text Settings");
        const command = newM2Command(entry.id);
        const frame: Frame = { commands: [command], pc: 0 };
        const state: InterpreterState = {
          stack: [frame],
          session: createSession(),
          maxStackDepth: 8,
          maxLoopIterations: 8,
          instructionsExecuted: 0,
          maxInstructions: 100,
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const result = executeCommand(state, frame, command);

        expect(result).toEqual({ kind: "continue" });
        expect(frame.pc).toBe(1);
        expect(warn).not.toHaveBeenCalled();
        expect(state.session.messageWindowSettings).toEqual({
          format: "normal",
          position: "bottom",
          preventObscuringPlayer: true,
          allowEventMovementDuringWait: false,
        });
        warn.mockRestore();
      });

      it("does not warn when Fallen Star camera and screen commands omit optional fields", () => {
        const cameraId = requireEntry("Camera Control").id;
        const tintId = requireEntry("Tint Screen").id;
        const effectId = requireEntry("Screen Effect").id;
        const m2 = (commandId: string, fields: Record<string, string>): Command => ({ kind: "m2Command", commandId, fields }) as Command;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const run = (command: Command) => {
          const frame: Frame = { commands: [command], pc: 0 };
          const state: InterpreterState = {
            stack: [frame],
            session: createSession(),
            maxStackDepth: 8,
            maxLoopIterations: 8,
            instructionsExecuted: 0,
            maxInstructions: 100,
          };
          return executeCommand(state, frame, command);
        };

        const follow = run(m2(cameraId, { mode: "follow", targetEventId: "ev_middle", durationMs: "900", wait: "true" }));
        const bare = run(m2(cameraId, { mode: "return", wait: "true" }));
        const back = run(m2(cameraId, { mode: "return", durationMs: "1000", wait: "true" }));
        const pan = run(m2(cameraId, { mode: "panTo", target: "screen", x: "12", y: "8", durationMs: "1400", wait: "true" }));
        const tint = run(m2(tintId, { color: "neutral", durationMs: "400" }));
        const fade = run(m2(effectId, { effect: "fadeIn", durationMs: "300" }));
        const place = run(m2(requireEntry("Set Event Location").id, { target: "ev_fs_kid", mapId: "fs_hub", x: "33", y: "24" }));

        const missing = warn.mock.calls.map((call) => String(call[0])).filter((line) => line.includes("[m2] missing field"));
        warn.mockRestore();
        expect(missing).toEqual([]);
        expect(follow).toMatchObject({
          kind: "pause",
          step: { kind: "cameraControl", mode: "follow", durationMs: 900, returnToPlayer: false, target: { kind: "event", eventId: "ev_middle" } },
        });
        expect(back).toMatchObject({
          kind: "pause",
          step: { kind: "cameraControl", mode: "return", durationMs: 1000, returnToPlayer: true, target: { kind: "player" } },
        });
        expect(bare).toMatchObject({
          kind: "pause",
          step: { kind: "cameraControl", mode: "return", durationMs: 300, returnToPlayer: true, target: { kind: "player" } },
        });
        expect(pan).toMatchObject({
          kind: "pause",
          step: { kind: "cameraControl", mode: "pan", durationMs: 1400, returnToPlayer: false, zoom: undefined, target: { kind: "position", x: 12, y: 8 } },
        });
        expect(tint).toEqual({ kind: "continue" });
        expect(fade).toEqual({ kind: "continue" });
        expect(place.kind === "pause" || place.kind === "continue").toBe(true);
      });
    });
    function pageCount(page: 1 | 2 | 3 | 4): number {
      return M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page).length;
    }
    function requireEntry(title: string) {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`Missing m2 command catalog entry: ${title}`);
      return entry;
    }
    function createSession(): PlaySessionLike {
      return {
        flags: {},
        switches: {},
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        actorVitals: {},
        currentMapId: "map_test",
        x: 0,
        y: 0,
      };
    }
  });
  describe("m2ResultSummaryClassification", () => {
    isolateTimers();
    describe("m2-109-result-summary 분류", () => {
      it("미분류 예외 없이 editor-only로 분류된다", () => {
        expect(m2CommandRuntimeSupport("m2-109-result-summary")).toBe("editor-only");
        expect(battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: "m2-109-result-summary", fields: {} })).toBe("editor-only");
      });
    });
  });
});
