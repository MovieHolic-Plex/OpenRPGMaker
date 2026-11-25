import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { deserialize } from "@/project/io";
import { battleTroopError } from "@/project/battleAdmission";
import { validateLowLevelCommandArray } from "@/editor/tools/commandArgs";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { m2CommandById, M2_COMMAND_CATALOG, createDefaultM2Fields, isM2CatalogEntrySelectableInMap } from "@/project/eventCommands/m2Catalog";
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
import type { StepResult } from "@/player/interpreter/types";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { newCommand } from "@/editor/eventCommandFactory";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isolateTimers } from "./mergedTeardown";

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
          message: "상점 아이템 'item_does_not_exist'을 찾을 수 없습니다.",
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
      // 2026-08-27 픽스: m2-055는 맵 피커에서 숨겨지므로(중복 등재 제거) 맵 노출 행은 m2-054 하나
      expect(mapVisible.map((e) => e.index)).toEqual([54]);
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
