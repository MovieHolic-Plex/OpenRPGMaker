import { describe, expect, it, vi, afterEach } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession, evalCondition } from "@/project/session";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { serializePretty, deserialize } from "@/project/io";
import type { Command, M2CommandFields, Project, EventPage, GameEvent } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { actorExperienceFloor, normalizeActorPatch, normalizeActorRecord } from "@/project/actorModel";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { evaluateM2Expression } from "@/player/interpreter/m2Expression";
import { gameWeekday, sessionQueryValue } from "@/project/conditionActorQueries";
import { clearCountOf, clearHistoryOf } from "@/player/clearRecord";
import { resolveDialogueText } from "@/player/dialogue";
import { pictureTransformFromState } from "@/player/pictures/pictureTween";
import assert from "node:assert/strict";
import { actorBattlers } from "@/battle/battleBattlers";
import { createBattleRuntime } from "@/battle/runtime";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { normalizeDatabaseRecords, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { ACTOR, battleCase, mark, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { eventBlocksPlayerAt, findBlockingRuntimeEventAt, findBlockingRuntimeEventAtInMap, findRuntimeEventAt, initialRuntimeEventPositions, moveRuntimeEventPosition, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { isolateTimers } from "./mergedTeardown";

describe("eventRuntimeExecution", () => {
  isolateTimers();
  const m2 = (id: string, fields: M2CommandFields = {}): Command => {
    expect(m2CommandById(id)).toBeTruthy();
    return { kind: "m2Command", commandId: id, fields };
  };
  const after: Command = { kind: "text", body: "after" };
  describe("persisted event commands execute their requested behavior", () => {
    it("preserves M2 fields through load/save/migration and emits the same movie request", () => {
      const p = createBlankProject();
      p.maps[p.startMapId]!.events = [{ id: "probe", x: 1, y: 1, trigger: { kind: "action" }, commands: [
        m2("m2-066-play-movie", { value: "intro.webm", wait: true }),
      ] }];
      for (const version of [3, p.version]) {
        const loaded = deserialize(serializePretty({ ...p, version }));
        const reloaded = deserialize(serializePretty(loaded));
        const commands = reloaded.maps[reloaded.startMapId]!.events[0]!.commands;
        expect(createInterpreter(commands, startSession(reloaded), reloaded).start()).toMatchObject({ kind: "playMovie", resourceId: "intro.webm", wait: true });
      }
    });
    it("polls indefinitely with timeout zero until a switch changes; does not burn instruction budget", () => {
      const s = startSession(createBlankProject());
      const i = createInterpreter([m2("m2-206-wait-until", { target: "ready", timeoutMs: 0 }), after], s, undefined, { maxInstructions: 3 });
      expect(i.start()).toMatchObject({ kind: "wait", ms: 50, allowParallelEvents: true });
      for (let n = 0; n < 150; n++) expect(i.resume()).toMatchObject({ kind: "wait" });
      expect(s.m2Runtime?.waits).toHaveLength(1);
      s.switches.ready = true;
      expect(i.resume()).toMatchObject({ kind: "text", body: "after" });
    });

    it("ends a finite wait at the authored timeout, including a partial polling interval", () => {
      const s = startSession(createBlankProject());
      const i = createInterpreter([m2("m2-206-wait-until", { target: "ready", timeoutMs: 75 }), after], s);
      expect(i.start()).toMatchObject({ kind: "wait", ms: 50 });
      expect(i.resume()).toMatchObject({ kind: "wait", ms: 25 });
      expect(i.resume()).toMatchObject({ kind: "text" });
      expect(s.flags["m2-wait:switchOn:ready"]).toBe(false);
    });

    it.each(["switchOff", "variable"])("rechecks %s after resuming", condition => {
      const s = startSession(createBlankProject());
      s.switches.ready = true;
      const i = createInterpreter([m2("m2-206-wait-until", { condition, target: "ready", value: "7" }), after], s);
      expect(i.start().kind).toBe("wait");
      s.switches.ready = false;
      s.variables.ready = 7;
      expect(i.resume().kind).toBe("text");
    });

    it("checks authored regions and live route completion on every poll", () => {
      const p = createBlankProject();
      const map = p.maps[p.startMapId]!;
      map.layoutPlan = { version: 1, kind: "test", regions: [{ id: "arrival", label: "arrival", role: "custom", x: 1, y: 1, w: 2, h: 2 }] };
      const s = startSession(p); s.x = 5; s.y = 5;
      let idle = false;
      const i = createInterpreter([
        m2("m2-206-wait-until", { condition: "region", target: "arrival" }),
        m2("m2-206-wait-until", { condition: "eventIdle", target: "this-event" }), after,
      ], s, p, { currentEventId: "walker", isEventIdle: target => target === "walker" && idle });
      expect(i.start().kind).toBe("wait");
      s.x = 1; s.y = 2;
      expect(i.resume().kind).toBe("wait");
      idle = true;
      expect(i.resume().kind).toBe("text");
    });

    it("skipping one wait does not carry its elapsed time to a later wait", () => {
      const s = startSession(createBlankProject());
      const cmd = m2("m2-206-wait-until", { target: "ready", timeoutMs: 100 });
      const i = createInterpreter([cmd, cmd, after], s);
      i.start(); i.resume();
      expect(i.skip().kind).toBe("wait");
      expect(i.resume().kind).toBe("wait");
      expect(i.resume().kind).toBe("text");
    });

    it.each([["m2-078-open-menu-screen", "openMenuScreen"], ["m2-093-open-load-menu", "openLoadMenu"]])("%s requests its own screen", (id, kind) => {
      const s = startSession(createBlankProject());
      expect(createInterpreter([m2(id)], s).start()).toEqual({ kind });
    });

    it("pathfinding emits a movement request and leaves coordinates unchanged until scene playback", () => {
      const s = startSession(createBlankProject());
      const before = { x: s.x, y: s.y, events: structuredClone(s.eventLocations) };
      expect(createInterpreter([m2("m2-205-pathfind-move", { target: "player", x: 6, y: 6, wait: true })], s).start())
        .toEqual({ kind: "pathfindMove", target: "player", x: 6, y: 6, speed: 4, wait: true });
      expect({ x: s.x, y: s.y, events: s.eventLocations }).toEqual(before);
    });

    it("legacy movie value and canonical resourceId use the video playback step", () => {
      const s = startSession(createBlankProject());
      expect(createInterpreter([m2("m2-066-play-movie", { value: "intro.webm" })], s).start())
        .toEqual({ kind: "playMovie", resourceId: "intro.webm", wait: true, skippable: true });
      expect(createInterpreter([m2("m2-066-play-movie", { resourceId: "finale.webm", value: "old", wait: false, skippable: false })], s).start())
        .toEqual({ kind: "playMovie", resourceId: "finale.webm", wait: false, skippable: false });
    });

    it("reads replacement runtime position maps after a wait", () => {
      const p = createBlankProject(), s = startSession(p);
      p.maps[p.startMapId]!.events = [{ id: "walker", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }];
      let positions = { walker: { x: 1, y: 1 } };
      const i = createInterpreter([
        { kind: "wait", ms: 10 },
        m2("m2-043-get-event-id", { mapId: p.startMapId, x: 3, y: 2, variableId: "result" }),
      ], s, p, { getEventPositions: () => positions });
      i.start();
      positions = { walker: { x: 3, y: 2 } };
      i.resume();
      expect(s.variables.result).toBe(1);
    });

    it("queries actual terrain and stable one-based event slots, including moved and erased events", () => {
      const p = createBlankProject();
      const map = p.maps[p.startMapId]!;
      map.events = [
        { id: "first", x: 1, y: 1, trigger: { kind: "action" }, commands: [] },
        { id: "second", x: 2, y: 2, trigger: { kind: "action" }, commands: [] },
      ];
      const tile = map.lowerTiles[2 * map.width + 2]!;
      p.tilesets[map.tilesetId]!.terrain[tile] = 9;
      p.tilesets[map.tilesetId]!.tileMeta ??= {};
      p.tilesets[map.tilesetId]!.tileMeta![tile] = { label: "probe", description: "", terrainTag: 9 };
      const s = startSession(p);
      const positions = { second: { x: 3, y: 2 } };
      const query = (id: string, x: number, y: number) => {
        createInterpreter([m2(id, { x, y, variableId: "result" })], s, p, { eventPositions: positions }).start();
        return s.variables.result;
      };
      expect(query("m2-042-get-terrain-id", 2, 2)).toBe(9);
      expect(query("m2-043-get-event-id", 2, 2)).toBe(0);
      expect(query("m2-043-get-event-id", 3, 2)).toBe(2);
      s.erasedEventIds = ["first"];
      expect(query("m2-043-get-event-id", 3, 2)).toBe(2);
      s.erasedEventIds.push("second");
      expect(query("m2-043-get-event-id", 3, 2)).toBe(0);
      expect(query("m2-042-get-terrain-id", -1, 2)).toBe(0);
      s.mapOverrides[map.id] = { lower: { [2 * map.width + 2]: -1 }, upper: {} };
      expect(query("m2-042-get-terrain-id", 2, 2)).toBe(0);
    });
  });
});

// test/interpreter.test.ts
// SIZE_OK: Shared interpreter regressions reuse one command-drain harness so
// message settings, facesets, and choices stay covered without duplicate setup.
// 인터프리터 상태머신 검증. 일시정지/재개/분기/조건/세션 반영.
describe("interpreter", () => {
  isolateTimers();
  type Interpreter = ReturnType<typeof createInterpreter>;
  type InterpreterResult = ReturnType<Interpreter["start"]>;
  type TextResult = Extract<InterpreterResult, { kind: "text" }>;
  type ChoicesResult = Extract<InterpreterResult, { kind: "choices" }>;
  type WaitResult = Extract<InterpreterResult, { kind: "wait" }>;
  type M2RuntimeTestSession = PlaySessionLike & {
    audio: Record<string, { readonly resourceId: string; readonly loop: boolean }>;
    pictures: Record<string, { readonly pictureId: string; readonly resourceId: string; readonly x: number; readonly y: number }>;
    m2Runtime?: {
      screen?: Record<string, unknown>;
      access?: Record<string, unknown>;
      audio?: Record<string, unknown>;
      actors?: Record<string, Record<string, unknown>>;
      events?: Record<string, Record<string, unknown>>;
      camera?: Record<string, unknown>;
      screenEffects?: readonly Record<string, unknown>[];
      pathfinding?: readonly Record<string, unknown>[];
      waits?: readonly Record<string, unknown>[];
      regions?: readonly Record<string, unknown>[];
      quests?: Record<string, Record<string, unknown>>;
      dialogue?: readonly Record<string, unknown>[];
      cutscene?: Record<string, unknown>;
      checkpoints?: readonly Record<string, unknown>[];
      ui?: readonly Record<string, unknown>[];
      debug?: readonly Record<string, unknown>[];
      expressions?: readonly Record<string, unknown>[];
      fallbacks?: readonly { readonly commandId: string; readonly label: string; readonly reason: string }[];
    };
  };
  function mkSession(): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      actorExperience: {},
      actorLevels: {},
      actorEquipment: {},
      actorVitals: {},
      currentMapId: "m1",
      x: 0,
      y: 0,
    };
  }
  describe("M2 interpreter control flow commands", () => {
    it("End Event Processing terminates the whole call stack", () => {
      const session = mkSession();
      session.commonEvents = [
        {
          id: "common_end",
          commands: [m2Command("End Event Processing"), { kind: "setSwitch", switchId: "after_end", value: true }],
        },
      ];
      const interpreter = createInterpreter(
        [
          { kind: "callCommonEvent", commonEventId: "common_end" },
          { kind: "setSwitch", switchId: "root_after", value: true },
        ],
        session
      );

      expect(interpreter.start()).toEqual({ kind: "done" });
      expect(session.switches.after_end).toBeUndefined();
      expect(session.switches.root_after).toBeUndefined();
    });

    it("Erase Event, Wait for All Movement, and Stop All Movement produce runtime steps", () => {
      const session = mkSession();
      const interpreter = createInterpreter(
        [
          m2Command("Erase Event"),
          m2Command("Wait for All Movement"),
          m2Command("Stop All Movement"),
        ],
        session,
        undefined,
        { currentEventId: "ev1" }
      );

      expect(interpreter.start()).toEqual({ kind: "eraseEvent", eventId: "ev1" });
      expect(interpreter.resume()).toEqual({ kind: "waitForAllMovement" });
      expect(interpreter.resume()).toEqual({ kind: "stopAllMovement" });
      expect(interpreter.resume()).toEqual({ kind: "done" });
    });
  });
  function mkM2Session(): M2RuntimeTestSession {
    return {
      ...mkSession(),
      audio: {},
      pictures: {},
    };
  }
  function m2Command(title: string, fields: M2CommandFields = {}): Command {
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title && candidate.index <= 97);
    if (!entry) throw new Error(`missing M2 catalog entry for ${title}`);
    return { kind: "m2Command", commandId: entry.id, fields };
  }
  function modernM2Command(title: string, fields: M2CommandFields = {}): Command {
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
    if (!entry) throw new Error(`missing modern M2 catalog entry for ${title}`);
    return { kind: "m2Command", commandId: entry.id, fields };
  }
  it("소지금, 아이템, 파티 명령을 세션에 반영한다", () => {
    const session = mkSession();
    const commands: Command[] = [
      { kind: "changeGold", op: "+=", amount: 50 },
      { kind: "changeGold", op: "-=", amount: 20 },
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 },
      { kind: "changeItem", itemId: "item_potion", op: "-=", amount: 1 },
      { kind: "changeParty", actorId: "actor_hero", action: "add" },
      { kind: "changeParty", actorId: "actor_hero", action: "add" },
      { kind: "changeParty", actorId: "actor_mage", action: "add" },
      { kind: "changeParty", actorId: "actor_hero", action: "remove" },
    ];

    drain(createInterpreter(commands, session));

    expect(session.gold).toBe(30);
    expect(session.inventory.item_potion).toBe(2);
    expect(session.partyActorIds).toEqual(["actor_mage"]);
  });
  it("배우 상태 명령을 세션에 반영한다", () => {
    const session = mkSession();
    session.partyActorIds = ["actor_hero", "actor_mage"];
    session.actorVitals.actor_hero = { hp: 40, mp: 5, maxHp: 80, maxMp: 20 };
    session.actorVitals.actor_mage = { hp: 10, mp: 1, maxHp: 50, maxMp: 30 };
    const commands: Command[] = [
      { kind: "changeActorHp", actorId: "actor_hero", op: "-=", amount: 15 },
      { kind: "changeActorMp", actorId: "actor_hero", op: "+=", amount: 50 },
      { kind: "changeExp", actorId: "actor_hero", op: "+=", amount: 12 },
      { kind: "changeLevel", actorId: "actor_hero", op: "=", amount: 7 },
      { kind: "changeEquipment", actorId: "actor_hero", slot: "weapon", equipmentId: "equip_sword" },
      { kind: "recoverAll", actorId: "" },
    ];

    const project = createBlankProject();
    drain(createInterpreter(commands, session, project));

    expect(session.actorVitals.actor_hero).toMatchObject({ hp: 80, mp: 20 });
    expect(session.actorVitals.actor_mage).toMatchObject({ hp: 50, mp: 30 });
    // 60dae212ea: 레벨을 올리면 EXP 도 그 레벨 바닥으로 올라간다(RPG 만들기 ChangeLevel). +12 는 바닥에 묻힌다.
    const levelSevenFloor = actorExperienceFloor(project, "actor_hero", 7);
    expect(levelSevenFloor).toBeGreaterThan(12);
    expect(session.actorExperience?.actor_hero).toBe(levelSevenFloor);
    expect(session.actorLevels?.actor_hero).toBe(7);
    expect(session.actorEquipment?.actor_hero?.weapon).toBe("equip_sword");
  });
  function expectTextResult(result: InterpreterResult): TextResult {
    if (result.kind === "text") return result;
    throw new Error(`expected interpreter result text, got ${result.kind}`);
  }
  function expectWaitResult(result: InterpreterResult): WaitResult {
    if (result.kind === "wait") return result;
    throw new Error(`expected interpreter result wait, got ${result.kind}`);
  }
  function expectChoicesResult(result: InterpreterResult): ChoicesResult {
    if (result.kind === "choices") return result;
    throw new Error(`expected interpreter result choices, got ${result.kind}`);
  }
  // 인터프리터를 끝까지 돌리며, text/choices/wait/transfer 응답을 시뮬레이션.
  // choices는 optionIndex를 인자로 받아 선택.
  function drain(
    it: ReturnType<typeof createInterpreter>,
    onChoices?: (options: { text: string }[]) => number
  ): { texts: string[]; transfers: { mapId: string; x: number; y: number; fade?: string }[]; flags: Record<string, boolean> } {
    const texts: string[] = [];
    const transfers: { mapId: string; x: number; y: number; fade?: string }[] = [];
    let r = it.start();
    let guard = 0;
    while (r.kind !== "done" && guard++ < 1000) {
      if (r.kind === "text") {
        texts.push(r.body);
        r = it.resume(undefined);
      } else if (r.kind === "choices") {
        const idx = onChoices ? onChoices(r.options) : 0;
        r = it.resume(idx);
      } else if (r.kind === "wait") {
        r = it.resume(undefined);
      } else if (r.kind === "transfer") {
        transfers.push({ mapId: r.mapId, x: r.x, y: r.y, fade: r.fade });
        r = it.resume(undefined);
      } else if (
        r.kind === "inputWait" ||
        r.kind === "timer" ||
        r.kind === "changeTile" ||
        r.kind === "moveEvent" ||
        r.kind === "pathfindMove" ||
        r.kind === "battleProcessing" ||
        r.kind === "showPicture" ||
        r.kind === "erasePicture" ||
        r.kind === "playAudio" ||
        r.kind === "stopAudio" ||
        r.kind === "shop" ||
        r.kind === "inn" ||
        r.kind === "gameOver" ||
        r.kind === "returnToTitle" ||
        r.kind === "flashScreen" ||
        r.kind === "shakeScreen" ||
        r.kind === "scrollMap" ||
        r.kind === "cameraControl" ||
        r.kind === "setWeather" ||
        r.kind === "showAnimation" ||
        r.kind === "spawnEvent" ||
        r.kind === "removeEvent"
      ) {
        r = it.resume(undefined);
      } else {
        break;
      }
    }
    return { texts, transfers, flags: {} };
  }
  describe("순차 실행", () => {
    it("text 명령들을 순서대로 반환한다", () => {
      const cmds: Command[] = [
        { kind: "text", body: "A" },
        { kind: "text", body: "B" },
        { kind: "text", body: "C" },
      ];
      const it = createInterpreter(cmds, mkSession());
      const { texts } = drain(it);
      expect(texts).toEqual(["A", "B", "C"]);
      expect(it.isDone()).toBe(true);
    });

    it("빈 명령 리스트는 즉시 done", () => {
      const it = createInterpreter([], mkSession());
      expect(it.start().kind).toBe("done");
    });
  });
  describe("setFlag — 세션 반영", () => {
    it("플래그를 세션에 기록한다", () => {
      const session = mkSession();
      const cmds: Command[] = [{ kind: "setFlag", flag: "met_king", value: true }];
      const it = createInterpreter(cmds, session);
      drain(it);
      expect(session.flags["met_king"]).toBe(true);
    });
  });
  describe("choices 분기", () => {
    it("선택한 옵션의 branch만 실행된다", () => {
      const cmds: Command[] = [
        {
          kind: "choices",
          prompt: "p",
          options: [
            {
              text: "예",
              branch: [{ kind: "text", body: "예를 선택" }],
            },
            {
              text: "아니오",
              branch: [{ kind: "text", body: "아니오를 선택" }],
            },
          ],
        },
        { kind: "text", body: "분기 후 공통" },
      ];
      const it = createInterpreter(cmds, mkSession());
      const { texts } = drain(it, () => 1); // "아니오" 선택
      expect(texts).toEqual(["아니오를 선택", "분기 후 공통"]);
    });

    it("choices 후 상위 명령이 계속 실행된다", () => {
      const cmds: Command[] = [
        { kind: "text", body: "시작" },
        {
          kind: "choices",
          options: [
            { text: "x", branch: [{ kind: "text", body: "안" }] },
          ],
        },
        { kind: "text", body: "끝" },
      ];
      const it = createInterpreter(cmds, mkSession());
      const { texts } = drain(it, () => 0);
      expect(texts).toEqual(["시작", "안", "끝"]);
    });

    it("취소를 특정 선택지로 매핑한다", () => {
      const cmds: Command[] = [
        {
          kind: "choices",
          cancelBehavior: "choice2",
          options: [
            { text: "예", branch: [{ kind: "text", body: "예" }] },
            { text: "아니오", branch: [{ kind: "text", body: "아니오" }] },
          ],
        },
      ];
      const interpreter = createInterpreter(cmds, mkSession());
      const choices = expectChoicesResult(interpreter.start());
      expect(choices.cancelBehavior).toBe("choice2");
      expect(expectTextResult(interpreter.resume(1)).body).toBe("아니오");
      expect(interpreter.resume(undefined).kind).toBe("done");
    });

    it("취소 분기를 실행한다", () => {
      const cmds: Command[] = [
        {
          kind: "choices",
          cancelBehavior: "branch",
          cancelBranch: [{ kind: "text", body: "취소" }],
          options: [{ text: "예", branch: [{ kind: "text", body: "예" }] }],
        },
        { kind: "text", body: "끝" },
      ];
      const { texts } = drain(createInterpreter(cmds, mkSession()), () => -1);
      expect(texts).toEqual(["취소", "끝"]);
    });
  });
  it("maps cancel to the fifth choice branch", () => {
    const cmds: Command[] = [
      {
        kind: "choices",
        cancelBehavior: "choice5",
        options: [
          { text: "1", branch: [{ kind: "text", body: "one" }] },
          { text: "2", branch: [{ kind: "text", body: "two" }] },
          { text: "3", branch: [{ kind: "text", body: "three" }] },
          { text: "4", branch: [{ kind: "text", body: "four" }] },
          { text: "5", branch: [{ kind: "text", body: "five" }] },
        ],
      },
    ];
    const interpreter = createInterpreter(cmds, mkSession());
    const choices = expectChoicesResult(interpreter.start());
    expect(choices.cancelBehavior).toBe("choice5");
    expect(expectTextResult(interpreter.resume(4)).body).toBe("five");
    expect(interpreter.resume(undefined).kind).toBe("done");
  });
  describe("common event recursion guard", () => {
    it("stops recursive common-event calls at the 1000-frame guard and resumes the caller", () => {
      const session = mkSession();
      session.commonEvents = [
        {
          id: "loop",
          commands: [
            { kind: "setVariable", variableId: "calls", op: "+=", value: 1 },
            { kind: "callCommonEvent", commonEventId: "loop" },
          ],
        },
      ];
      const commands: Command[] = [
        { kind: "callCommonEvent", commonEventId: "loop" },
        { kind: "text", body: "after guard" },
      ];

      const { texts } = drain(createInterpreter(commands, session));

      expect(session.variables.calls).toBe(999);
      expect(texts).toEqual(["after guard"]);
    });
  });
  describe("문장 표시 옵션과 페이스셋 상태", () => {
    it("Display Text Options는 다음 선택지에도 현재 창 설정을 전달한다", () => {
      const cmds: Command[] = [
        {
          kind: "displayTextSettings",
          format: "normal",
          position: "bottom",
          preventObscuringPlayer: true,
          allowEventMovementDuringWait: false,
        },
        {
          kind: "choices",
          prompt: "어떻게 할까?",
          options: [
            { text: "예", branch: [{ kind: "text", body: "예" }] },
            { text: "아니오", branch: [{ kind: "text", body: "아니오" }] },
          ],
        },
      ];
      const it = createInterpreter(cmds, mkSession());

      const choices = expectChoicesResult(it.start());

      expect(choices.settings).toEqual({
        format: "normal",
        position: "bottom",
        preventObscuringPlayer: true,
        allowEventMovementDuringWait: false,
      });
    });

    it("Change Faceset의 좌우 반전 옵션은 다음 텍스트 얼굴 상태에 유지된다", () => {
      const cmds: Command[] = [
        {
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-00",
          position: "left",
          flipHorizontally: true,
        },
        { kind: "text", body: "얼굴 확인" },
      ];
      const it = createInterpreter(cmds, mkSession());

      const text = expectTextResult(it.start());

      expect(text.face).toEqual({
        resourceId: "easyrpg-faceset-actor1-00",
        position: "left",
        flipHorizontally: true,
      });
    });

    it("Faceset 상태는 독립된 이벤트 실행 사이에 누수되지 않는다", () => {
      const session = mkSession();
      const first = createInterpreter([
        {
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-00",
          position: "left",
          flipHorizontally: false,
        },
        { kind: "text", body: "첫 이벤트" },
      ], session);
      expect(expectTextResult(first.start()).face?.resourceId).toBe("easyrpg-faceset-actor1-00");

      const second = createInterpreter([{ kind: "text", body: "둘째 이벤트" }], session);
      expect(expectTextResult(second.start()).face).toBeUndefined();
    });
  });
  describe("transfer — 종료", () => {
    it("transfer는 요청 후 종료(이후 명령 무시)", () => {
      const cmds: Command[] = [
        { kind: "text", body: "이동 전" },
        { kind: "transfer", mapId: "m2", x: 3, y: 4, fade: "white" },
        { kind: "text", body: "이동 후(무시되어야 함)" },
      ];
      const it = createInterpreter(cmds, mkSession());
      const { texts, transfers } = drain(it);
      expect(texts).toEqual(["이동 전"]);
      expect(transfers).toEqual([{ mapId: "m2", x: 3, y: 4, fade: "white" }]);
      expect(it.isDone()).toBe(true);
    });
  });
  describe("wait", () => {
    it("wait는 요청을 반환하고 resume 후 계속", () => {
      const cmds: Command[] = [
        { kind: "text", body: "before" },
        { kind: "wait", ms: 100 },
        { kind: "text", body: "after" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expectTextResult(r);
      r = it.resume(undefined);
      expect(expectWaitResult(r).ms).toBe(100);
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("after");
      r = it.resume(undefined);
      expect(r.kind).toBe("done");
    });
  });
  describe("중첩 choices", () => {
    it("choices 안의 choices 분기가 올바르게 실행된다", () => {
      const cmds: Command[] = [
        {
          kind: "choices",
          options: [
            {
              text: "A",
              branch: [
                {
                  kind: "choices",
                  options: [
                    { text: "A1", branch: [{ kind: "text", body: "A1결과" }] },
                    { text: "A2", branch: [{ kind: "text", body: "A2결과" }] },
                  ],
                },
              ],
            },
            { text: "B", branch: [{ kind: "text", body: "B결과" }] },
          ],
        },
      ];
      const it = createInterpreter(cmds, mkSession());
      // 첫 choices: "A"(0) → 그 안 choices: "A2"(1)
      const { texts } = drain(it, () => 0); // 매번 0번만 선택하면 A→A1
      expect(texts).toEqual(["A1결과"]);
    });
  });
  describe("일시정지/재개 상태 보존", () => {
    it("text 사이에 다른 작업을 끼워도 순서가 보존된다", () => {
      const cmds: Command[] = [
        { kind: "text", body: "1" },
        { kind: "text", body: "2" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expect(expectTextResult(r).body).toBe("1");
      // (여기서 호출자는 다른 일을 해도 됨)
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("2");
      r = it.resume(undefined);
      expect(r.kind).toBe("done");
    });
  });
  // ── v2 새 명령 세트 테스트 ──

  describe("setSwitch / setVariable — 세션 반영", () => {
    it("setSwitch로 스위치를 설정한다", () => {
      const session = mkSession();
      const cmds: Command[] = [
        { kind: "setSwitch", switchId: "s1", value: true },
      ];
      drain(createInterpreter(cmds, session));
      expect(session.switches["s1"]).toBe(true);
    });

    it("setVariable 연산이 누적된다", () => {
      const session = mkSession();
      const cmds: Command[] = [
        { kind: "setVariable", variableId: "v1", op: "=", value: 10 },
        { kind: "setVariable", variableId: "v1", op: "+=", value: 5 },
        { kind: "setVariable", variableId: "v1", op: "*=", value: 2 },
      ];
      drain(createInterpreter(cmds, session));
      // (10 + 5) * 2 = 30
      expect(session.variables["v1"]).toBe(30);
    });

    it("setVariable 값으로 다른 변수를 참조할 수 있다", () => {
      const session = mkSession();
      session.variables["src"] = 7;
      const cmds: Command[] = [
        { kind: "setVariable", variableId: "dst", op: "=", value: { kind: "var", id: "src" } },
      ];
      drain(createInterpreter(cmds, session));
      expect(session.variables["dst"]).toBe(7);
    });

    it("inputNumber 입력값을 지정한 변수에 저장하고 다음 명령으로 진행한다", () => {
      const session = mkSession();
      const interpreter = createInterpreter([
        { kind: "inputNumber", variableId: "pin", digits: 4 },
        { kind: "text", body: "done" },
      ], session);

      const input = interpreter.start();
      expect(input).toMatchObject({ kind: "inputNumber", variableId: "pin", digits: 4 });
      const next = interpreter.resume(1234);

      expect(session.variables.pin).toBe(1234);
      expect(expectTextResult(next).body).toBe("done");
    });
  });
  describe("fork — 조건 분기", () => {
    it("조건 true면 then 실행", () => {
      const session = mkSession();
      session.switches["gate"] = true;
      const cmds: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "gate", value: true },
          then: [{ kind: "text", body: "열림" }],
          else: [{ kind: "text", body: "닫힘" }],
        },
        { kind: "text", body: "공통" },
      ];
      const { texts } = drain(createInterpreter(cmds, session));
      expect(texts).toEqual(["열림", "공통"]);
    });

    it("조건 false면 else 실행", () => {
      const session = mkSession();
      const cmds: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "gate", value: true },
          then: [{ kind: "text", body: "열림" }],
          else: [{ kind: "text", body: "닫힘" }],
        },
      ];
      const { texts } = drain(createInterpreter(cmds, session));
      expect(texts).toEqual(["닫힘"]);
    });

    it("변수 조건(>=)도 평가된다", () => {
      const session = mkSession();
      session.variables["gold"] = 100;
      const cmds: Command[] = [
        {
          kind: "fork",
          condition: { kind: "variable", variableId: "gold", op: ">=", value: 50 },
          then: [{ kind: "text", body: "부자" }],
        },
      ];
      const { texts } = drain(createInterpreter(cmds, session));
      expect(texts).toEqual(["부자"]);
    });
  });
  describe("label / gotoLabel — 루프", () => {
    it("gotoLabel로 라벨로 점프한다 (유한 반복 후 EXIT)", () => {
      // 카운터 변수로 3회 반복 후 EXIT 라벨로 탈출.
      const session = mkSession();
      const cmds: Command[] = [
        { kind: "setVariable", variableId: "i", op: "=", value: 0 },
        { kind: "label", name: "LOOP" },
        {
          kind: "fork",
          condition: { kind: "variable", variableId: "i", op: ">=", value: 3 },
          then: [
            { kind: "text", body: "탈출" },
            { kind: "gotoLabel", name: "EXIT" },
          ],
        },
        { kind: "setVariable", variableId: "i", op: "+=", value: 1 },
        { kind: "gotoLabel", name: "LOOP" },
        { kind: "label", name: "EXIT" },
        { kind: "text", body: "끝" },
      ];
      const it = createInterpreter(cmds, session);
      const texts: string[] = [];
      let r = it.start();
      let guard = 0;
      while (r.kind !== "done" && guard++ < 200) {
        if (r.kind === "text") {
          texts.push(r.body);
          r = it.resume(undefined);
        } else if (r.kind === "choices") {
          r = it.resume(0);
        } else if (r.kind === "wait" || r.kind === "inputWait" || r.kind === "timer" || r.kind === "changeTile" || r.kind === "moveEvent" || r.kind === "setEventGraphicPattern") {
          r = it.resume(undefined);
        } else if (r.kind === "transfer") {
          r = it.resume(undefined);
        } else break;
      }
      expect(session.variables["i"]).toBe(3);
      expect(texts).toEqual(["탈출", "끝"]);
    });
  });
  describe("changeTile / moveEvent / setEventGraphicPattern — 요청 반환", () => {
    it("changeTile은 요청을 반환하고 resume 후 계속", () => {
      const cmds: Command[] = [
        { kind: "changeTile", mapId: "m1", layer: "lower", x: 1, y: 2, tile: 5 },
        { kind: "text", body: "바뀜" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expect(r.kind).toBe("changeTile");
      if (r.kind === "changeTile") {
        expect(r.tile).toBe(5);
      }
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("바뀜");
    });

    it("moveEvent는 요청을 반환한다", () => {
      const cmds: Command[] = [
        { kind: "moveEvent", eventId: "ev1", route: { moves: [{ kind: "move", dir: "down" }], repeat: false } },
      ];
      const it = createInterpreter(cmds, mkSession());
      const r = it.start();
      expect(r).toEqual({
        kind: "moveEvent",
        eventId: "ev1",
        moves: [{ kind: "move", dir: "down" }],
        repeat: false,
        wait: false,
      });
    });

    it("moveEvent skippable false 만 단계에 실려 막힌 걸음을 다시 시도하게 한다", () => {
      const session = mkSession();
      const held = createInterpreter(
        [{ kind: "moveEvent", eventId: "ev1", route: { moves: [{ kind: "move", dir: "right" }], repeat: false, skippable: false } }],
        session,
      ).start();
      expect(held).toEqual({
        kind: "moveEvent",
        eventId: "ev1",
        moves: [{ kind: "move", dir: "right" }],
        repeat: false,
        wait: false,
        skippable: false,
      });
      const skipped = createInterpreter(
        [{ kind: "moveEvent", eventId: "ev1", route: { moves: [{ kind: "move", dir: "right" }], repeat: false, skippable: true } }],
        session,
      ).start();
      expect(skipped).not.toMatchObject({ skippable: false });
    });

    it("setEventGraphicPattern은 프레임 변경 요청을 반환하고 resume 후 계속한다", () => {
      const cmds: Command[] = [
        { kind: "setEventGraphicPattern", eventId: "ev_door", pattern: 14 },
        { kind: "text", body: "열림" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expect(r).toEqual({ kind: "setEventGraphicPattern", eventId: "ev_door", pattern: 14 });
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("열림");
    });
  });
  describe("battleProcessing / common event guard", () => {
    it("battleProcessing returns a battle handoff step", () => {
      const cmds: Command[] = [
        { kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false },
        { kind: "text", body: "after" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expect(r.kind).toBe("battleProcessing");
      if (r.kind === "battleProcessing") {
        expect(r.troopId).toBe("troop_slime");
      }
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("after");
    });

    it("picture, audio, shop, inn, and title commands suspend as typed handoffs", () => {
      const cmds: Command[] = [
        { kind: "showPicture", pictureId: "pic1", resourceId: "tex_tiles_default", x: 1, y: 2 },
        { kind: "playAudio", resourceId: "theme", loop: true },
        { kind: "shop", itemIds: ["item_potion"] },
        { kind: "inn", price: 50 },
        { kind: "ending", title: "The End", message: "Peace returned." },
      ];
      const it = createInterpreter(cmds, mkSession());
      const kinds: string[] = [];
      let r = it.start();
      while (r.kind !== "done") {
        kinds.push(r.kind);
        r = it.resume(undefined);
      }
      expect(kinds).toEqual(["showPicture", "playAudio", "shop", "inn", "returnToTitle"]);
    });

    it.each(["gameOver", "killPlayer", "returnToTitle"] as const)("%s terminates nested events and their callers", kind => {
      const session = mkSession();
      session.commonEvents = [{ id: "terminal", commands: [
        { kind }, { kind: "setSwitch", switchId: "after_inner", value: true },
      ] }];
      const interpreter = createInterpreter([
        { kind: "callCommonEvent", commonEventId: "terminal" },
        { kind: "setSwitch", switchId: "after_outer", value: true },
      ], session);
      expect(interpreter.start().kind).toBe(kind === "returnToTitle" ? "returnToTitle" : "gameOver");
      expect(interpreter.resume(undefined).kind).toBe("done");
      expect(interpreter.isDone()).toBe(true);
      expect(interpreter.resume(undefined).kind).toBe("done");
      expect(session.switches.after_inner).not.toBe(true);
      expect(session.switches.after_outer).not.toBe(true);
    });

    it("ending returns a title handoff with ending screen copy", () => {
      const it = createInterpreter([{ kind: "ending", title: "The End", message: "Peace returned." }], mkSession());
      const result = it.start();
      expect(result).toEqual({ kind: "returnToTitle", title: "The End", message: "Peace returned." });
      expect(it.resume(undefined).kind).toBe("done");
    });

    it("bounds recursive common-event calls", () => {
      const session = mkSession();
      session.commonEvents = [{ id: "loop", commands: [{ kind: "callCommonEvent", commonEventId: "loop" }] }];
      const it = createInterpreter([{ kind: "callCommonEvent", commonEventId: "loop" }], session);
      const result = drain(it);
      expect(result.texts).toEqual([]);
      expect(it.isDone()).toBe(true);
    });
  });
  describe("callCommonEvent — 공통 이벤트 호출", () => {
    it("세션의 commonEvents에서 commands를 가져와 실행", () => {
      const session = mkSession();
      session.commonEvents = [
        { id: "ce1", commands: [{ kind: "text", body: "공통!" }] },
      ];
      const cmds: Command[] = [
        { kind: "callCommonEvent", commonEventId: "ce1" },
        { kind: "text", body: "이후" },
      ];
      const { texts } = drain(createInterpreter(cmds, session));
      expect(texts).toEqual(["공통!", "이후"]);
    });

    it("존재하지 않는 공통 이벤트는 경고 후 계속", () => {
      const cmds: Command[] = [
        { kind: "callCommonEvent", commonEventId: "nope" },
        { kind: "text", body: "진행" },
      ];
      const { texts } = drain(createInterpreter(cmds, mkSession()));
      expect(texts).toEqual(["진행"]);
    });
  });
  describe("inputWait", () => {
    it("inputWait는 요청 반환 후 resume", () => {
      const cmds: Command[] = [
        { kind: "inputWait" },
        { kind: "text", body: "after" },
      ];
      const it = createInterpreter(cmds, mkSession());
      let r = it.start();
      expect(r.kind).toBe("inputWait");
      r = it.resume(undefined);
      expect(expectTextResult(r).body).toBe("after");
    });
  });
  describe("timer", () => {
    it("timer set은 세션 타이머를 갱신", () => {
      const session = mkSession();
      const cmds: Command[] = [
        { kind: "timer", action: "set", seconds: 90 },
      ];
      drain(createInterpreter(cmds, session));
      expect(session.timers["timer1"]).toBe(90);
    });

    it("timer timerId로 타이머 1/2를 구분한다", () => {
      const session = mkSession();
      const cmds: Command[] = [
        { kind: "timer", action: "set", seconds: 30, timerId: "timer1" },
        { kind: "timer", action: "set", seconds: 60, timerId: "timer2" },
      ];
      drain(createInterpreter(cmds, session));
      expect(session.timers["timer1"]).toBe(30);
      expect(session.timers["timer2"]).toBe(60);
    });
  });
  describe("M2 generic map runtime executor", () => {
    it("does not emit catalog-disabled or missing-runtime skip warnings for non-battle rows", () => {
      const session = mkM2Session();
      const genericCommands = M2_COMMAND_CATALOG
        .filter((entry) => entry.index <= 97 && entry.bodyStrategy === "generic")
        .map((entry) => ({ kind: "m2Command", commandId: entry.id, fields: {} }) satisfies Command);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      drain(createInterpreter(genericCommands, session));

      const messages = warn.mock.calls.map((call) => String(call[0]));
      warn.mockRestore();
      expect(genericCommands.length).toBeGreaterThan(0);
      expect(messages.filter((message) => message.includes("catalog-disabled") || message.includes("missing-runtime"))).toEqual([]);
      expect(messages.filter((message) => message.includes("M2 command cannot run in map interpreter"))).toEqual([]);
    });

    it("applies representative generic M2 picture, screen, audio, access, actor, map, and event effects", () => {
      const session = mkM2Session();
      session.currentMapId = "map_intro";
      session.x = 4;
      session.y = 5;
      session.audio.bgm = { resourceId: "field-theme", loop: true };
      const commands: Command[] = [
        m2Command("Move Picture", { pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 }),
        m2Command("Tint Screen", { value: "warm", target: "screen" }),
        m2Command("Shake Screen", { value: 30 }),
        m2Command("Set Weather Effects", { value: "rain" }),
        m2Command("Memorize Current BGM"),
        m2Command("Play Memorized BGM"),
        m2Command("Change Save Access", { enabled: false }),
        m2Command("Change Menu Access", { enabled: false }),
        m2Command("Change Actor Name", { target: "actor_hero", value: "Alex" }),
        m2Command("Change Parameters", { target: "actor_hero", operation: "add", value: 3 }),
        m2Command("Change State", { target: "actor_hero", operation: "add", value: "poison" }),
        m2Command("Get Player Location", { variableId: "player" }),
        m2Command("Set Event Location", { target: "event_guard", mapId: "map_intro", x: 6, y: 7 }),
        m2Command("Break Loop"),
      ];

      drain(createInterpreter(commands, session));

      expect(session.pictures.pic1).toEqual({ pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 });
      expect(session.m2Runtime?.screen).toMatchObject({ tint: "warm", shake: 30, weather: "rain" });
      expect(session.m2Runtime?.access).toMatchObject({ save: false, menu: false });
      expect(session.m2Runtime?.actors?.actor_hero).toMatchObject({ name: "Alex", parameters: 3, states: ["poison"] });
      expect(session.actorParamBonuses?.actor_hero).toEqual({ maxHp: 3 });
      expect(session.actorStateIds?.actor_hero).toEqual(["poison"]);
      expect(session.variables.player_map).toBe(0);
      expect(session.variables.player_x).toBe(4);
      expect(session.variables.player_y).toBe(5);
      expect(session.m2Runtime?.events?.event_guard).toMatchObject({ mapId: "map_intro", x: 6, y: 7 });
      expect(session.m2Runtime?.audio).toMatchObject({ memorizedBgm: "field-theme", playedMemorizedBgm: "field-theme" });
      expect(session.audio.bgm).toEqual({ resourceId: "field-theme", loop: true });
      expect(session.m2Runtime?.fallbacks?.some((entry) => entry.commandId.includes("break-loop"))).toBe(true);
    });

    it("applies M2 damage processing and actor graphic changes to live session actor state", () => {
      const session = mkM2Session();
      session.partyActorIds = ["actor_hero"];
      session.actorVitals.actor_hero = { hp: 40, mp: 8, maxHp: 50, maxMp: 10 };
      const commands: Command[] = [
        m2Command("Damage Processing", { target: "actor_hero", operation: "add", value: 12 }),
        m2Command("Change Actor Graphic", { target: "actor_hero", value: "easyrpg-charset-actor2" }),
      ];

      drain(createInterpreter(commands, session));

      expect(session.actorVitals.actor_hero?.hp).toBe(28);
      expect(session.actorCharacterResourceIds?.actor_hero).toBe("easyrpg-charset-actor2");
      expect(session.m2Runtime?.actors?.actor_hero).toMatchObject({ damage: 12, characterGraphic: "easyrpg-charset-actor2" });
    });

    it("Change Actor Graphic keeps the sheet cell (characterIndex) for effect transformations", () => {
      const session = mkM2Session();
      drain(createInterpreter([
        m2Command("Change Actor Graphic", { target: "actor_hero", value: "charset:tex_easyrpg_charset_people1:3" }),
      ], session));
      expect(session.actorCharacterResourceIds?.actor_hero).toBe("tex_easyrpg_charset_people1#3");
      drain(createInterpreter([
        m2Command("Change Actor Graphic", { target: "actor_hero", value: "tex_easyrpg_charset_people1", characterIndex: 6 }),
      ], session));
      expect(session.actorCharacterResourceIds?.actor_hero).toBe("tex_easyrpg_charset_people1#6");
    });

    it("emits a blocking scrollMap step with direction, return, and lock options", () => {
      const session = mkM2Session();
      const interpreter = createInterpreter([
        m2Command("Scroll Map", { direction: "right", distance: 3, durationMs: 450, wait: true, mode: "return", lock: true }),
      ], session);

      expect(interpreter.start()).toEqual({
        kind: "scrollMap",
        direction: "right",
        distanceTiles: 3,
        durationMs: 450,
        wait: true,
        returnToPlayer: true,
        lock: true,
      });
    });

    it("emits a cameraControl step with pan target and wait options", () => {
      const session = mkM2Session();
      const interpreter = createInterpreter([
        modernM2Command("Camera Control", { mode: "panTo", target: "screen", x: 10, y: 12, durationMs: 450, wait: true }),
      ], session);

      expect(interpreter.start()).toMatchObject({
        kind: "cameraControl",
        mode: "pan",
        target: { kind: "position", x: 10, y: 12 },
        durationMs: 450,
        wait: true,
        returnToPlayer: false,
      });
    });

    it("records modern event commands into explicit runtime buckets without unsafe script execution", () => {
      const session = mkM2Session();
      session.gold = 25;
      session.audio = { bgm: { resourceId: "field_music", loop: true } };
      const commands: Command[] = [
        modernM2Command("Camera Control", { mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 }),
        modernM2Command("Screen Effect", { effect: "blur", value: "soft", durationMs: 300 }),
        modernM2Command("Spawn Event", { prefabId: "npc_guard", eventId: "spawn_guard", mapId: "map_intro", x: 6, y: 7 }),
        modernM2Command("Remove Event", { eventId: "spawn_guard" }),
        modernM2Command("Pathfind Move", { target: "event_guard", x: 14, y: 2, speed: 4, wait: true }),
        modernM2Command("Wait Until", { condition: "switchOn", target: "switch_gate", value: "true", timeoutMs: 1200 }),
        modernM2Command("Region Trigger", { regionId: "town_square", eventId: "event_guide", action: "enter", switchId: "switch_square" }),
        modernM2Command("Quest Objective", { questId: "quest_intro", objectiveId: "talk_to_elder", state: "complete", text: "장로와 대화" }),
        modernM2Command("Advanced Dialogue", { speaker: "미나", portraitId: "face_mina", emotion: "happy", body: "숲으로 가자.", autoAdvance: false }),
        modernM2Command("Sound Layer", { channel: "ambient", resourceId: "forest_wind", volume: 65, fadeMs: 500 }),
        modernM2Command("Weighted Branch", { table: "rare=1\ncommon=9", resultVariableId: "loot_roll" }),
        modernM2Command("Cutscene Control", { action: "lockPlayer", enabled: true }),
        modernM2Command("Checkpoint Save", { slotId: "auto", label: "숲 입구", restoreOnGameOver: true }),
        modernM2Command("UI Command", { surface: "toast", message: "지도 갱신", durationMs: 1800 }),
        modernM2Command("Debug Log", { level: "info", message: "entered forest gate" }),
        modernM2Command("Evaluate Expression", { expression: "gold + 10", resultVariableId: "calc_result" }),
        modernM2Command("Data Query", { query: "gold", target: "", variableId: "gold_value" }),
      ];

      const random = vi.spyOn(Math, "random").mockReturnValue(0);
      let texts: string[];
      try {
        ({ texts } = drain(createInterpreter(commands, session)));
      } finally {
        random.mockRestore();
      }

      expect(session.m2Runtime?.camera).toMatchObject({ mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 });
      expect(session.m2Runtime?.screenEffects).toEqual([{ effect: "blur", value: "soft", durationMs: 300 }]);
      expect(session.m2Runtime?.events?.spawn_guard).toMatchObject({ prefabId: "npc_guard", removed: true, mapId: "map_intro", x: 6, y: 7 });
      expect(session.m2Runtime?.pathfinding).toEqual([{ target: "event_guard", x: 14, y: 2, speed: 4, wait: true }]);
      expect(session.m2Runtime?.waits).toEqual([{ condition: "switchOn", target: "switch_gate", value: "true", timeoutMs: 1200 }]);
      expect(session.m2Runtime?.regions).toEqual([{ regionId: "town_square", eventId: "event_guide", action: "enter", switchId: "switch_square" }]);
      expect(session.m2Runtime?.quests?.quest_intro).toMatchObject({ talk_to_elder: { state: "complete", text: "장로와 대화" } });
      expect(session.m2Runtime?.dialogue).toEqual([{ speaker: "미나", portraitId: "face_mina", emotion: "happy", body: "숲으로 가자.", autoAdvance: false }]);
      expect(session.m2Runtime?.audio).toMatchObject({ ambient: { resourceId: "forest_wind", volume: 65, fadeMs: 500 } });
      expect(texts).toContain("숲으로 가자.");
      // main keeps ambient as its own channel (bgm/bgs untouched) and stores 0..100 volume.
      expect(session.audio?.ambient).toEqual({ resourceId: "forest_wind", loop: true, volume: 65, fadeInMs: 500 });
      expect(session.audio?.bgm).toEqual({ resourceId: "field_music", loop: true });
      expect([0, 1]).toContain(session.variables.loot_roll);
      expect(session.m2Runtime?.cutscene).toMatchObject({ lockPlayer: true });
      expect(session.m2Runtime?.checkpoints).toEqual([{ slotId: "auto", label: "숲 입구", restoreOnGameOver: true }]);
      expect(session.m2Runtime?.ui).toEqual([{ surface: "toast", message: "지도 갱신", durationMs: 1800 }]);
      expect(session.m2Runtime?.debug).toEqual([{ level: "info", message: "entered forest gate" }]);
      expect(session.flags).toMatchObject({
        "camera:panTo": true,
        "screen-effect:blur": true,
        "event-removed:spawn_guard": true,
        "m2-wait:switchOn:switch_gate": false,
        "quest:quest_intro:talk_to_elder:complete": true,
        "cutscene:lockPlayer": true,
        "checkpoint:auto": true,
        "ui:toast": true,
        "debug:info": true,
      });
      expect(session.switches.switch_square).toBe(true);
      expect(session.eventLocations?.event_guard).toBeUndefined(); // coordinates change only after scene playback
      expect(session.eventLocations?.spawn_guard).toBeUndefined();
      expect(session.m2Runtime?.expressions).toEqual([{ expression: "gold + 10", resultVariableId: "calc_result", evaluated: true }]);
      expect(session.variables.calc_result).toBe(35);
      expect(session.variables.gold_value).toBe(25);
    });

    it("records Pathfind Move runtime speed clamped to the 1–8 page scale", () => {
      const session = mkM2Session();
      const commands: Command[] = [
        modernM2Command("Pathfind Move", { target: "event_guard", x: 14, y: 2, speed: 99, wait: true }),
      ];
      const random = vi.spyOn(Math, "random").mockReturnValue(0);
      try {
        drain(createInterpreter(commands, session));
      } finally {
        random.mockRestore();
      }
      expect(session.m2Runtime?.pathfinding).toEqual([{ target: "event_guard", x: 14, y: 2, speed: 8, wait: true }]);
    });
  });
});

describe("memorizedBgmSaveRestore", () => {
  isolateTimers();
  function m2(title: string, fields: M2CommandFields = {}): Command {
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title && candidate.index <= 97);
    if (!entry) throw new Error(`missing M2 catalog entry for ${title}`);
    return { kind: "m2Command", commandId: entry.id, fields };
  }
  function drain(project: Project, session: PlaySession, commands: Command[]): void {
    const interpreter = createInterpreter(commands, session, project);
    let step = interpreter.start();
    for (let guard = 0; step.kind !== "done"; guard += 1) {
      if (guard > 8) throw new Error(`interpreter stuck at ${step.kind}`);
      step = interpreter.resume(undefined);
    }
  }
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
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
  describe("세이브/로드 — 기억한 BGM", () => {
    it("기억한 곡은 지금 나오는 곡과 따로 저장되고, 불러온 뒤 재생된다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.audio.bgm = { resourceId: "field-theme", loop: true };
      drain(project, session, [m2("Memorize Current BGM")]);
      session.audio.bgm = { resourceId: "battle-theme", loop: true };

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
      expect(saved.snapshot.session.audio.bgm).toEqual({ resourceId: "battle-theme", loop: true });

      const restored = applySaveSnapshot(project, saved.snapshot);
      expect(restored.m2Runtime?.audio?.memorizedBgm).toBe("field-theme");
      expect(restored.audio.bgm).toEqual({ resourceId: "battle-theme", loop: true });
      const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
      expect(replay).toMatchObject({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm" });
    });

    it("기억한 음량 0과 페이드 0은 세이브를 건너도 재생 스텝에 남는다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.audio.bgm = { resourceId: "field-theme", loop: true, volume: 0, fadeInMs: 0 };
      drain(project, session, [m2("Memorize Current BGM")]);
      session.audio.bgm = { resourceId: "battle-theme", loop: true, volume: 80, fadeInMs: 400 };

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
      expect(saved.snapshot.session.memorizedBgmVolume).toBe(0);
      expect(saved.snapshot.session.memorizedBgmFadeInMs).toBe(0);

      const restored = applySaveSnapshot(project, saved.snapshot);
      expect(restored.m2Runtime?.audio?.memorizedBgmVolume).toBe(0);
      expect(restored.m2Runtime?.audio?.memorizedBgmFadeInMs).toBe(0);
      const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
      expect(replay).toEqual({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm", volume: 0, fadeInMs: 0 });
      expect(restored.audio.bgm).toEqual({ resourceId: "field-theme", loop: true, volume: 0, fadeInMs: 0 });
    });

    it("깨진 기억 음량은 곡 id 를 남긴 채 그 칸만 버린다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.audio.bgm = { resourceId: "field-theme", loop: true, volume: 40, fadeInMs: 250 };
      drain(project, session, [m2("Memorize Current BGM")]);
      const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as {
        session: { memorizedBgmVolume?: unknown; memorizedBgmFadeInMs?: unknown; gold: number };
      };
      raw.session.memorizedBgmVolume = "loud";
      raw.session.memorizedBgmFadeInMs = -1;
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(raw));

      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
      expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
      expect(saved.snapshot.session.memorizedBgmVolume).toBeUndefined();
      expect(saved.snapshot.session.memorizedBgmFadeInMs).toBeUndefined();
      const restored = applySaveSnapshot(project, saved.snapshot);
      const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
      expect(replay).toEqual({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm" });
    });

    it("기억한 곡이 없으면 칸을 만들지 않고, 재생은 요청을 내지 않는다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      drain(project, session, [m2("Memorize Current BGM")]);

      const snapshot = createSaveSnapshot(project, session);
      expect(snapshot.session.memorizedBgm).toBeUndefined();
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.m2Runtime?.audio?.memorizedBgm).toBeUndefined();
      expect(createInterpreter([m2("Play Memorized BGM")], restored, project).start()).toEqual({ kind: "done" });
    });

    it.each([
      ["숫자", 12],
      ["빈 칸", "   "],
      ["너무 긴 id", "x".repeat(1025)],
    ])("깨진 기억 칸(%s)은 버리고 나머지 세이브는 읽는다", (_label, memorizedBgm) => {
      const project = createBlankProject();
      const session = startSession(project);
      session.gold = 7;
      session.audio.bgm = { resourceId: "field-theme", loop: true };
      drain(project, session, [m2("Memorize Current BGM")]);
      const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as { session: { memorizedBgm?: unknown; gold: number } };
      raw.session.memorizedBgm = memorizedBgm;
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(raw));

      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
      expect(saved.snapshot.session.memorizedBgm).toBeUndefined();
      expect(saved.snapshot.session.gold).toBe(7);
      const restored = applySaveSnapshot(project, saved.snapshot);
      expect(restored.gold).toBe(7);
      expect(restored.m2Runtime?.audio?.memorizedBgm).toBeUndefined();
      expect(createInterpreter([m2("Play Memorized BGM")], restored, project).start()).toEqual({ kind: "done" });
    });
  });
});

// 명작 공백 G1 — 배우 수치·상태·선두·방향·숨기·회차·요일·문자열 조건과 조회(2026-09-27).
describe("mgL1Conditions", () => {
  isolateTimers();
  function project(): Project {
    const p = createBlankProject();
    return p;
  }
  function session(p = project()) {
    const s = startSession(p);
    s.partyActorIds = ["hero", "mage"];
    s.actorLevels = { hero: 12, mage: 3 };
    s.actorVitals = { hero: { hp: 30, mp: 5, maxHp: 120, maxMp: 20 }, mage: { hp: 50, mp: 40, maxHp: 50, maxMp: 40 } };
    return s;
  }
  function dataQuery(s: ReturnType<typeof session>, p: Project, query: string, target = ""): number {
    const entry = m2CommandById("m2-217-data-query");
    expect(entry).toBeDefined();
    executeM2RuntimeCommand(s, entry!, { commandId: entry!.id, fields: { query, target, variableId: "out" } }, { project: p });
    return s.variables.out ?? -1;
  }
  describe("명작 공백 G1 — 배우·파티 조건", () => {
    it("선두 레벨·HP% 로 분기하고, 파티에 없는 배우는 거짓", () => {
      const s = session();
      expect(evalCondition(s, { kind: "actorStat", actorId: "leader", stat: "level", op: ">=", value: 10 })).toBe(true);
      expect(evalCondition(s, { kind: "actorStat", actorId: "hero", stat: "hpPercent", op: "<=", value: 25 })).toBe(true);
      expect(evalCondition(s, { kind: "actorStat", actorId: "mage", stat: "hpPercent", op: "<=", value: 25 })).toBe(false);
      expect(evalCondition(s, { kind: "actorStat", actorId: "ghost", stat: "level", op: ">=", value: 0 })).toBe(false);
    });

    it("상태 보유(누군가/특정)·선두·인원", () => {
      const s = session();
      s.actorStateIds = { mage: ["state_poison"] };
      expect(evalCondition(s, { kind: "actorState", actorId: "anyone", stateId: "state_poison", present: true })).toBe(true);
      expect(evalCondition(s, { kind: "actorState", actorId: "hero", stateId: "state_poison", present: true })).toBe(false);
      expect(evalCondition(s, { kind: "partyLeader", actorId: "hero" })).toBe(true);
      s.partyActorIds = [];
      expect(evalCondition(s, { kind: "partyLeader", actorId: "hero" })).toBe(false);
      expect(evalCondition(s, { kind: "partySize", op: "==", value: 0 })).toBe(true);
    });
  });
  describe("명작 공백 G1 — Data Query·식 식별자", () => {
    it("배우 레벨·HP·파티 인원·걸음·플레이 시간·클리어 수를 변수로 읽는다", () => {
      const p = project();
      const s = session(p);
      s.stepCount = 77;
      s.playTimeSeconds = 125.9;
      s.clearHistory = { count: 3, endingIds: ["a"] };
      expect(dataQuery(s, p, "actorLevel", "leader")).toBe(12);
      expect(dataQuery(s, p, "actorHp", "mage")).toBe(50);
      expect(dataQuery(s, p, "actorHpPercent", "hero")).toBe(25);
      expect(dataQuery(s, p, "partySize")).toBe(2);
      expect(dataQuery(s, p, "steps")).toBe(77);
      expect(dataQuery(s, p, "playtimeSeconds")).toBe(125);
      expect(dataQuery(s, p, "clearCount")).toBe(3);
      expect(dataQuery(s, p, "actorLevel", "nobody")).toBe(0);
    });

    it("식에서 leaderLevel·partySize 를 쓴다", () => {
      const s = session();
      expect(evaluateM2Expression("leaderLevel * 2 + partySize", s)).toBe(26);
    });
  });
  describe("명작 공백 G1 — 방향·등 뒤·숨기·추격", () => {
    it("주인공 방향과 이벤트 등 뒤 판정", () => {
      const s = session();
      s.playerFacing = "left";
      expect(evalCondition(s, { kind: "facing", subject: "player", dir: "left" })).toBe(true);
      // 이벤트(5,5) 가 오른쪽을 본다. 주인공(3,5) 은 그 등 뒤.
      s.x = 3;
      s.y = 5;
      const host = { eventId: "statue" };
      s.eventLocations.statue = { mapId: s.currentMapId, x: 5, y: 5, direction: "right" };
      expect(evalCondition(s, { kind: "relativeFacing", relation: "playerBehindEvent" }, host.eventId)).toBe(true);
      // 주인공이 왼쪽(석상 반대)을 보면 석상을 보고 있지 않다 → 안 볼 때 움직이는 조각상.
      expect(evalCondition(s, { kind: "not", condition: { kind: "relativeFacing", relation: "playerFacingEvent" } }, host.eventId)).toBe(true);
      s.playerFacing = "right";
      expect(evalCondition(s, { kind: "relativeFacing", relation: "playerFacingEvent" }, host.eventId)).toBe(true);
    });

    it("숨기·추격 중 조건", () => {
      const s = session();
      expect(evalCondition(s, { kind: "hiding", value: false })).toBe(true);
      s.horror = { pursuits: { oni: { home: { mapId: "m", x: 0, y: 0 }, active: true, searchMs: 0, doors: [] } }, hiding: { mapId: "m", eventId: "closet", witnessedBy: [] } };
      expect(evalCondition(s, { kind: "hiding", value: true })).toBe(true);
      expect(evalCondition(s, { kind: "pursuitActive", eventId: "oni", value: true })).toBe(true);
      expect(evalCondition(s, { kind: "pursuitActive", eventId: "other", value: true })).toBe(false);
    });
  });
  describe("명작 공백 G1 — 회차·요일·문자열", () => {
    it("클리어 기록: 옛 기록은 본 엔딩 수, 새 기록은 누적 횟수", () => {
      expect(clearCountOf(undefined)).toBe(0);
      expect(clearCountOf({ endingIds: ["a", "b"], clearedAt: "x", carry: {} })).toBe(2);
      expect(clearHistoryOf({ endingIds: ["a"], clearCount: 5, clearedAt: "x", carry: {} })).toEqual({ count: 5, endingIds: ["a"] });
    });

    it("회차·본 엔딩·강하게 다시 하기 조건", () => {
      const s = session();
      expect(evalCondition(s, { kind: "clearCount", op: ">=", value: 1 })).toBe(false);
      s.clearHistory = { count: 2, endingIds: ["true_end"] };
      s.flags.ngplus = true;
      expect(evalCondition(s, { kind: "clearCount", op: ">=", value: 2 })).toBe(true);
      expect(evalCondition(s, { kind: "endingSeen", endingId: "true_end", value: true })).toBe(true);
      expect(evalCondition(s, { kind: "newGamePlus", value: true })).toBe(true);
    });

    it("요일은 1년 1일 월요일 기준으로 7일마다 돈다, 시계가 없으면 거짓", () => {
      expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "spring", year: 1 }, 28)).toBe(1);
      expect(gameWeekday({ minute: 0, hour: 8, day: 7, season: "spring", year: 1 }, 28)).toBe(0);
      expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "summer", year: 1 }, 28)).toBe(1);
      expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "spring", year: 1 }, 28, 3)).toBe(3);
      const s = session();
      s.gameTime = undefined;
      expect(evalCondition(s, { kind: "weekday", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
    });

    it("문자 입력은 문자열 변수에 들어가고 \\T[id] 로 대사에 찍히며 조건이 읽는다", () => {
      const p = project();
      const s = session(p);
      const commands: Command[] = [{ kind: "enterHeroName", actorId: "", maxLength: 8, showInitialName: false, stringVariableId: "prayer", prompt: "기도문" }];
      const interpreter = createInterpreter(commands, s, p);
      const step = interpreter.start();
      expect(step).toMatchObject({ kind: "enterHeroName", prompt: "기도문" });
      interpreter.resume("빛이여 오라");
      expect(s.stringVariables?.prayer).toBe("빛이여 오라");
      expect(evalCondition(s, { kind: "stringVariable", stringVariableId: "prayer", op: "contains", value: "빛" })).toBe(true);
      expect(evalCondition(s, { kind: "stringVariable", stringVariableId: "missing", op: "empty", value: "" })).toBe(true);
      expect(sessionQueryValue(s, "stringLength", "prayer")).toBe(6);
      expect(resolveDialogueText("기도: \\T[prayer]!", { session: s, project: p })).toBe("기도: 빛이여 오라!");
    });
  });
});

describe("movePictureKeepTransform", () => {
  isolateTimers();
  const MOVE_PICTURE = m2CommandById("m2-052-move-picture")!;
  function move(fields: Record<string, string | number>): void {
    const project = createBlankProject();
    const session = startSession(project);
    session.pictures.pic1 = {
      pictureId: "pic1",
      resourceId: "title-still",
      x: 40,
      y: 24,
      scale: 180,
      opacity: 80,
      rotation: 30,
      blendMode: "add",
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    executeM2RuntimeCommand(session, MOVE_PICTURE, { commandId: MOVE_PICTURE.id, fields }, { project });
    expect(session.pictures.pic1).toMatchObject({
      pictureId: "pic1",
      resourceId: "title-still",
      blendMode: "add",
      ...expectedCarry(fields),
    });
    expect(pictureTransformFromState(session.pictures.pic1!)).toMatchObject(expectedCarry(fields));
  }
  function expectedCarry(fields: Record<string, string | number>): { x: number; y: number; scale: number; opacity: number; rotation: number } {
    return {
      x: typeof fields.x === "number" ? fields.x : 40,
      y: typeof fields.y === "number" ? fields.y : 24,
      scale: typeof fields.scale === "number" ? fields.scale : typeof fields.zoom === "number" ? fields.zoom : 180,
      opacity: typeof fields.opacity === "number" ? fields.opacity : 80,
      rotation: typeof fields.rotation === "number" ? fields.rotation : typeof fields.angle === "number" ? fields.angle : 30,
    };
  }
  describe("Move Picture keeps the still's transform", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("a position-only move does not un-rotate, resize, or fade the picture back in", () => {
      move({ pictureId: "pic1", x: 120, y: 48, durationMs: 600 });
    });

    it("an explicit rotation replaces only the angle", () => {
      move({ pictureId: "pic1", rotation: 90, durationMs: 400 });
    });

    it("zoom and angle field names override scale and rotation", () => {
      move({ pictureId: "pic1", zoom: 50, angle: -15 });
    });

    it("a new slot still omits transform fields the command did not set", () => {
      const project = createBlankProject();
      const session = startSession(project);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      executeM2RuntimeCommand(
        session,
        MOVE_PICTURE,
        { commandId: MOVE_PICTURE.id, fields: { pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 } },
        { project },
      );
      expect(session.pictures.pic1).toEqual({ pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 });
    });
  });
});

describe("rm2003BattleCommands", () => {
  isolateTimers();
  // RM2003 전투 세 가지(2026-10-02): 이도류 2회 공격, 공통 이벤트를 부르는 전투 명령, 배우별 명령 목록.

  function strictProject(): Project {
    return deserialize(JSON.stringify(strictFixture));
  }
  describe("배우별 전투 명령 (ActorRecord.battleCommandIds)", () => {
    function withGlobalCommands(project: Project): void {
      project.database.battleCommands = [
        { id: "cmd_steal", name: "훔치기", kind: "skill", skillId: "skill_fire" },
        { id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" },
      ];
      project.commonEvents.push({ id: "ce_pray", name: "기도", trigger: "none", commands: [] });
    }

    it("배우 목록이 직업 명령을 대신하고, 순서를 지킨다", () => {
      const project = strictProject();
      withGlobalCommands(project);
      const actor = project.database.actors.find((record) => record.id === ACTOR)!;
      expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_attack", "cmd_guard", "cmd_escape"]);
      actor.battleCommandIds = ["cmd_pray", "cmd_attack", "cmd_steal"];
      expect(battleCommandsForActor(project, ACTOR).map((command) => [command.id, command.kind])).toEqual([
        ["cmd_pray", "commonEvent"], ["cmd_attack", "attack"], ["cmd_steal", "skill"],
      ]);
    });

    it("전역·직업 어디에도 없는 id 는 「공격」으로 둔갑하지 않고 빠진다", () => {
      const project = strictProject();
      withGlobalCommands(project);
      project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_deleted", "cmd_steal"];
      expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_steal"]);
    });

    it("전투 중 이벤트로 바꾼 명령이 배우 목록보다 앞선다", () => {
      const project = strictProject();
      withGlobalCommands(project);
      project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_steal"];
      expect(battleCommandsForActor(project, ACTOR, { overrideCommandIds: ["cmd_escape"] }).map((command) => command.id)).toEqual(["cmd_escape"]);
    });

    it("공통 이벤트가 지워진 연결 명령은 메뉴에서 빠진다", () => {
      const project = strictProject();
      withGlobalCommands(project);
      project.commonEvents = project.commonEvents.filter((entry) => entry.id !== "ce_pray");
      project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_pray", "cmd_attack"];
      expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_attack"]);
    });

    it("정규화: 빈 값·중복을 걷고 7개까지, 비면 필드 자체를 뺀다", () => {
      const base = strictProject().database.actors[0]!;
      expect(normalizeActorRecord({ ...base, battleCommandIds: [" a ", "a", "", "b", "c", "d", "e", "f", "g", "h"] }).battleCommandIds)
        .toEqual(["a", "b", "c", "d", "e", "f", "g"]);
      expect("battleCommandIds" in normalizeActorRecord({ ...base, battleCommandIds: [] })).toBe(false);
      expect(normalizeActorPatch({ battleCommandIds: [] })).toEqual({ battleCommandIds: undefined });
    });

    it("정규화: 전역·직업 명령의 commonEvent 종류와 commonEventId 가 「공격」으로 떨어지지 않는다", () => {
      const project = strictProject();
      project.database.battleCommands = [{ id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" }];
      project.database.classes[0]!.battleCommands = [{ id: "cmd_x", name: "특수", kind: "commonEvent", commonEventId: "ce_pray" }];
      const normalized = normalizeDatabaseRecords(project.database);
      expect(normalized.battleCommands?.[0]).toMatchObject({ kind: "commonEvent", commonEventId: "ce_pray" });
      expect(normalized.classes[0]!.battleCommands[0]).toMatchObject({ kind: "commonEvent", commonEventId: "ce_pray" });
    });
  });
  describe("이도류 (attackHits)", () => {
    function setup(options: { readonly dualWield: boolean; readonly offTwoHanded?: boolean; readonly doubleAttackMain?: boolean }) {
      const project = strictProject();
      const sword = normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", effectFlags: { doubleAttack: options.doubleAttackMain ?? false } as never });
      const dagger = normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", twoHanded: options.offTwoHanded ?? false });
      project.database.equipment = [sword, dagger];
      const actor = project.database.actors.find((record) => record.id === ACTOR)!;
      actor.options = { ...actor.options, dualWield: options.dualWield };
      return project;
    }
    const hitsOf = (project: Project, equipment: Record<string, string>) =>
      actorBattlers(project, { partyActorIds: [ACTOR], equipment: { [ACTOR]: equipment } })[0]!.equipmentEffects?.attackHits;

    it("한손 무기 둘 = 두 번 친다", () => {
      expect(hitsOf(setup({ dualWield: true }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(2);
    });
    it("무기 하나 = 한 번, 「2회 공격」 무기를 함께 들면 그 무기만 두 번", () => {
      expect(hitsOf(setup({ dualWield: true }), { weapon: "eq_sword" })).toBe(1);
      expect(hitsOf(setup({ dualWield: true, doubleAttackMain: true }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(3);
    });
    it("이도류가 아니면 방패 칸의 무기는 무시된다(장착 규칙이 걸러 1회)", () => {
      expect(hitsOf(setup({ dualWield: false }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(1);
    });
  });
  for (const flow of ["gauge", "strict"] as const) describe(`공통 이벤트 전투 명령 / ${flow}`, () => {
    it("고르면 그 공통 이벤트가 돌고, 문장은 트룹 이벤트와 같은 정지·재개를 탄다", () => {
      const { project, runtime } = battleCase({ flow, commands: [] });
      project.commonEvents.push({
        id: "ce_pray", name: "기도", trigger: "none",
        commands: [mark("first"), { kind: "text", body: "신에게 기도했다" }, mark("second")],
      });
      runtime.performActorCommand({ kind: "commonEvent", commonEventId: "ce_pray" });
      expect(variables(runtime).first).toBe(1);
      expect(variables(runtime).second ?? 0, "문장이 끝나기 전에는 다음 명령이 돌면 안 된다").toBe(0);
      const pause = eventPause(runtime);
      assert.equal(pause.kind, "text");
      expect(pause.body).toBe("신에게 기도했다");
      acknowledge(runtime, pause.id, { kind: "text" });
      expect(variables(runtime).second).toBe(1);
      expect(runtime.snapshot().eventLogs.some((log) => log.pageId === "command-common-event:ce_pray" && log.kind === "fired")).toBe(true);
    });

    it("없는 공통 이벤트를 부르는 명령은 거부된다", () => {
      const { runtime } = battleCase({ flow, commands: [] });
      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "commonEvent", commonEventId: "ce_missing" });
      expect(runtime.snapshot().activeActorId).toBe(before.activeActorId);
      expect(runtime.snapshot().phase).toBe("actorCommand");
    });
  });
  describe("「전투 명령 변경」(m2-092) 더하기·빼기는 지금 메뉴 위에서 한다", () => {
    const run = (project: Project, session: ReturnType<typeof startSession>, fields: Record<string, string>) =>
      executeM2RuntimeCommand(session, m2CommandById("m2-092-change-battle-commands")!, {
        commandId: "m2-092-change-battle-commands", fields: { target: ACTOR, slots: "", ...fields },
      }, { project });

    it("처음 더하면 직업 명령 뒤에 붙는다(공격·방어가 사라지지 않는다)", () => {
      const project = strictProject();
      project.database.battleCommands = [{ id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" }];
      const session = startSession(project);
      run(project, session, { operation: "add", value: "cmd_pray" });
      expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_attack", "cmd_guard", "cmd_escape", "cmd_pray"]);
    });

    it("처음 빼면 직업 명령에서 그 명령만 빠진다", () => {
      const project = strictProject();
      const session = startSession(project);
      run(project, session, { operation: "remove", value: "cmd_guard" });
      expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_attack", "cmd_escape"]);
    });

    it("배우 고유 목록이 있으면 그 목록이 출발점이다", () => {
      const project = strictProject();
      project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_escape", "cmd_attack"];
      const session = startSession(project);
      run(project, session, { operation: "remove", value: "cmd_attack" });
      expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_escape"]);
    });
  });
  describe("이도류 타격은 그 무기의 공격력으로 친다", () => {
    function damageWith(equipment: Record<string, string>): number {
      const project = strictProject();
      project.database.equipment = [
        normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", statBonuses: { attack: 40 } as never }),
        normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", statBonuses: { attack: 4 } as never }),
      ];
      const actor = project.database.actors.find((record) => record.id === ACTOR)!;
      actor.options = { ...actor.options, dualWield: true };
      actor.initialEquipment = equipment;
      actor.parameterCurves.agility = Array.from({ length: 99 }, () => 99);
      const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime")!;
      enemy.stats = { ...enemy.stats, maxHp: 9000, defense: 1, agility: 1 };
      enemy.actions = [];
      enemy.skillIds = [];
      const runtime = createBattleRuntime({
        project, troopId: "troop_strict_training", battleFlow: "strict", canEscape: false, canLose: true,
        party: { partyActorIds: [ACTOR], levels: { [ACTOR]: 1 }, experience: {} },
        sessionState: { switches: {}, variables: {}, inventory: {} },
        rng: () => 0.5,
      });
      const before = runtime.snapshot().enemies.reduce((sum, entry) => sum + entry.hp, 0);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: runtime.snapshot().enemies[0]!.id });
      return before - runtime.snapshot().enemies.reduce((sum, entry) => sum + entry.hp, 0);
    }

    it("검+단검 두 타격 = 검 한 번 + 단검 한 번 (합산 공격력으로 두 번 치지 않는다)", () => {
      const sword = damageWith({ weapon: "eq_sword" });
      const dagger = damageWith({ weapon: "eq_dagger" });
      const dual = damageWith({ weapon: "eq_sword", shield: "eq_dagger" });
      expect(sword).toBeGreaterThan(dagger);
      expect(dual).toBe(sword + dagger);
    });

    it("타격별 무기 목록을 battler 에 싣는다", () => {
      const project = strictProject();
      project.database.equipment = [
        normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", statBonuses: { attack: 40 } as never, attackElementIds: ["fire"] }),
        normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", statBonuses: { attack: 4 } as never }),
      ];
      const actor = project.database.actors.find((record) => record.id === ACTOR)!;
      actor.options = { ...actor.options, dualWield: true };
      const swings = actorBattlers(project, { partyActorIds: [ACTOR], equipment: { [ACTOR]: { weapon: "eq_sword", shield: "eq_dagger" } } })[0]!.equipmentEffects?.attackSwings;
      expect(swings).toEqual([
        { weaponId: "eq_sword", attackOffset: -4, attackElementIds: ["fire"] },
        { weaponId: "eq_dagger", attackOffset: -40, attackElementIds: [] },
      ]);
    });
  });
});

describe("runtimeEventState", () => {
  isolateTimers();
  function page(id: string, priority: EventPage["priority"], trigger: EventPage["trigger"]): EventPage {
    return {
      id,
      name: id,
      conditions: [],
      graphic: {},
      trigger,
      priority,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages,
    };
  }
  function session(): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      actorVitals: {},
      currentMapId: "map_runtime",
      x: 0,
      y: 0,
    };
  }
  type MockTileImage = {
    y: number;
    setOrigin(x: number, y: number): void;
    setDepth(depth: number): void;
  };
  type MockSprite = MockTileImage & {
    play(key: string): MockSprite;
    setPosition(x: number, y: number): void;
    setFrame(frame: string | number): void;
    setScale(value: number): void;
    destroy(): void;
  };
  function mockTileImage(): MockTileImage {
    return {
      y: 0,
      setOrigin: () => undefined,
      setDepth: () => undefined,
    };
  }
  function mockSprite(): MockSprite {
    let sprite: MockSprite;
    sprite = {
      y: 0,
      play: () => sprite,
      setOrigin: () => undefined,
      setDepth: () => undefined,
      setPosition: (_x, y) => {
        sprite.y = y;
      },
      setFrame: () => undefined,
      setScale: () => undefined,
      destroy: () => undefined,
    };
    return sprite;
  }
  function sceneWithEventSprite(spriteId: string): Parameters<typeof renderTiles>[0] {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const npcPage = page("npc_page", "same", { kind: "action" });
    npcPage.graphic.sprite = { type: "bundled", id: spriteId };
    map.events = [event("npc", 1, 1, [npcPage])];
    store.replace(project);

    return {
      map,
      session: startSession(project),
      eventPositions: initialRuntimeEventPositions(map.events),
      tileLayer: {
        removeAll: () => undefined,
        add: () => undefined,
      },
      eventSprites: new Map(),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set(),
      add: {
        image: () => mockTileImage(),
        sprite: () => mockSprite(),
      },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };
  }
  function modernM2Command(title: string, fields: M2CommandFields): Command {
    const entry = M2_COMMAND_CATALOG.find((item) => item.title === title);
    if (!entry) throw new Error(`missing M2 command: ${title}`);
    return { kind: "m2Command", commandId: entry.id, fields };
  }
  function drainInterpreter(interpreter: ReturnType<typeof createInterpreter>): void {
    let result = interpreter.start();
    let guard = 0;
    while (result.kind !== "done" && guard < 20) {
      guard += 1;
      result = interpreter.resume(undefined);
    }
  }
  describe("runtime event state", () => {
    it("blocks player movement only for same-priority active events", () => {
      const events = [
        event("solid", 1, 0, [page("solid_page", "same", { kind: "action" })]),
        event("floor", 0, 1, [page("floor_page", "below", { kind: "touch" })]),
      ];
      const positions = initialRuntimeEventPositions(events);

      expect(eventBlocksPlayerAt(events, session(), positions, 1, 0)).toBe(true);
      expect(eventBlocksPlayerAt(events, session(), positions, 0, 1)).toBe(false);
      expect(findRuntimeEventAt(events, session(), positions, 0, 1, "touch")?.event.id).toBe("floor");
    });

    it("keeps RM2003 player touch triggers distinct from legacy touch aliases", () => {
      const events = [
        event("touch-npc", 1, 0, [page("touch_npc_page", "same", { kind: "playerTouch" })]),
        event("event-touch-npc", 2, 0, [page("event_touch_page", "same", { kind: "eventTouch" })]),
      ];
      const positions = initialRuntimeEventPositions(events);

      expect(findBlockingRuntimeEventAt(events, session(), positions, 1, 0)?.event.id).toBe("touch-npc");
      expect(findRuntimeEventAt(events, session(), positions, 1, 0, ["touch", "playerTouch"])?.event.id).toBe(
        "touch-npc"
      );
      expect(findRuntimeEventAt(events, session(), positions, 2, 0, ["touch", "playerTouch"])).toBeUndefined();
    });

    it("keeps moved event positions in runtime state instead of mutating authoring events", () => {
      const events = [event("mover", 0, 1, [page("mover_page", "same", { kind: "action" })])];
      const positions = initialRuntimeEventPositions(events);

      moveRuntimeEventPosition(positions, "mover", 1, 1);

      expect(events[0].x).toBe(0);
      expect(events[0].y).toBe(1);
      expect(findRuntimeEventAt(events, session(), positions, 1, 1, "action")?.event.id).toBe("mover");
    });

    it("excludes erased events from page resolution, triggers, and blocking checks", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const events = [event("erased", 1, 0, [page("erased_page", "same", { kind: "action" })])];
      map.events = events;
      const playSession = session();
      playSession.erasedEventIds = ["erased"];
      const positions = initialRuntimeEventPositions(events);

      expect(runtimeEventViewsForMap(project, map, playSession, positions)).toEqual([]);
      expect(findRuntimeEventAt(events, playSession, positions, 1, 0, "action")).toBeUndefined();
      expect(findBlockingRuntimeEventAt(events, playSession, positions, 1, 0)).toBeUndefined();
    });

    it("reports a missing event sprite when a page uses the bundled tileset texture id", () => {
      const scene = sceneWithEventSprite("tex_tiles_default");

      renderTiles(scene);

      expect(scene.missingResources.has("tex_tiles_default")).toBe(true);
    });

    it("spawns, triggers, removes, and restores runtime event instances", () => {
      const project = createBlankProject();
      project.switches = [{ id: "spawn_talked", name: "Spawn Talked" }];
      const map = project.maps[project.startMapId]!;
      const templatePage = page("template_page", "same", { kind: "action" });
      templatePage.graphic.sprite = { type: "bundled", id: "tex_easyrpg_charset_people1" };
      templatePage.commands = [{ kind: "setSwitch", switchId: "spawn_talked", value: true }];
      templatePage.movement = {
        type: "custom",
        speed: 3,
        frequency: 3,
        route: { moves: [{ kind: "turn", dir: "left" }], repeat: true },
      };
      map.events = [event("template_npc", 0, 0, [templatePage])];
      const otherMap = { ...map, id: "map_other", name: "Other", events: [] };
      project.maps[otherMap.id] = otherMap;
      store.replace(project);

      const playSession = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      drainInterpreter(createInterpreter([
        modernM2Command("Spawn Event", {
          prefabId: "template_npc",
          eventId: "spawn_npc",
          mapId: map.id,
          x: 2,
          y: 3,
        }),
      ], playSession, project));

      const spawnedView = runtimeEventViewsForMap(project, map, playSession, positions)
        .find((view) => view.event.id === "spawn_npc");
      expect(spawnedView).toMatchObject({
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        priority: "same",
      });
      expect(findBlockingRuntimeEventAtInMap(project, map, playSession, positions, 2, 3)?.event.id).toBe("spawn_npc");
      expect(runtimeEventViewsForMap(project, otherMap, playSession, {}).some((view) => view.event.id === "spawn_npc")).toBe(false);

      const renderScene = {
        map,
        session: playSession,
        eventPositions: positions,
        tileLayer: {
          removeAll: () => undefined,
          add: () => undefined,
        },
        eventSprites: new Map<string, MockSprite>(),
        runtimeDom: {
          clearEventMarkers: () => undefined,
          upsertEventMarker: () => undefined,
          syncMissingResourceError: () => undefined,
        },
        missingResources: new Set<string>(),
        add: {
          image: () => mockTileImage(),
          sprite: (x: number, y: number, texture: string, frame?: string | number) => {
            const sprite = mockSprite();
            sprite.setPosition(x, y);
            if (frame !== undefined) sprite.setFrame(frame);
            void texture;
            return sprite;
          },
        },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };
      renderTiles(renderScene);
      expect(renderScene.eventSprites.has("spawn_npc")).toBe(true);

      drainInterpreter(createInterpreter(spawnedView?.page?.commands ?? [], playSession, project, { currentEventId: "spawn_npc" }));
      expect(playSession.switches.spawn_talked).toBe(true);

      const snapshot = createSaveSnapshot(project, playSession);
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.spawnedEvents?.spawn_npc).toMatchObject({ templateEventId: "template_npc", mapId: map.id, x: 2, y: 3 });
      expect(runtimeEventViewsForMap(project, map, restored, positions).some((view) => view.event.id === "spawn_npc")).toBe(true);

      drainInterpreter(createInterpreter([
        modernM2Command("Remove Event", { eventId: "spawn_npc" }),
      ], restored, project));

      const removedSnapshot = createSaveSnapshot(project, restored);
      const restoredAfterRemove = applySaveSnapshot(project, removedSnapshot);
      expect(restoredAfterRemove.spawnedEvents?.spawn_npc).toBeUndefined();
      expect(runtimeEventViewsForMap(project, map, restoredAfterRemove, positions).some((view) => view.event.id === "spawn_npc")).toBe(false);
    });

    it("removes authored events through persistent Modern Remove Event state", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events = [event("authored_npc", 1, 1, [page("authored_page", "same", { kind: "action" })])];
      store.replace(project);
      const playSession = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);

      drainInterpreter(createInterpreter([
        modernM2Command("Remove Event", { eventId: "authored_npc" }),
      ], playSession, project));

      expect(playSession.removedEventIds?.[map.id]).toEqual(["authored_npc"]);
      expect(runtimeEventViewsForMap(project, map, playSession, positions).some((view) => view.event.id === "authored_npc")).toBe(false);

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, playSession));
      expect(restored.removedEventIds?.[map.id]).toEqual(["authored_npc"]);
      expect(runtimeEventViewsForMap(project, map, restored, positions).some((view) => view.event.id === "authored_npc")).toBe(false);
    });
  });
});
