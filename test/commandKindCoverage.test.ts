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
import { describe, expect, it, vi } from "vitest";
import type { Command, Condition, EventPage, GameEvent } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import type { PlaySessionLike } from "@/player/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { commandKinds } from "@/project/io/guards";
import { validateCommandArray, validateConditionShape } from "@/project/io/shapeCommandFields";
import {
  CONDITION_KINDS,
  COMMAND_KINDS,
  type CommandKind,
  type ConditionKind,
} from "@/project/commandKindRegistry";

// kind별 최소 유효 커맨드 인스턴스. Record<CommandKind, Command> 타입이므로 COMMAND_KINDS에
// 새 kind가 추가되는데 여기 항목을 안 채우면 컴파일 에러가 난다(누락 차단).
const MINIMAL_COMMANDS: Record<CommandKind, Command> = {
  text: { kind: "text", body: "hello" },
  changeFace: { kind: "changeFace", resourceId: "res1", faceIndex: 0, position: "left", flipHorizontally: false },
  choices: { kind: "choices", options: [{ text: "a", branch: [] }] },
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
  changeEquipment: { kind: "changeEquipment", actorId: "actor1", slot: "weapon", equipmentId: "eq1" },
  changeActorHp: { kind: "changeActorHp", actorId: "actor1", op: "+=", amount: 10 },
  changeActorMp: { kind: "changeActorMp", actorId: "actor1", op: "+=", amount: 10 },
  recoverAll: { kind: "recoverAll" },
  enterHeroName: { kind: "enterHeroName", actorId: "actor1", maxLength: 6, showInitialName: false },
  changeGold: { kind: "changeGold", op: "+=", amount: 10 },
  changeItem: { kind: "changeItem", itemId: "item1", op: "+=", amount: 1 },
  changeParty: { kind: "changeParty", actorId: "actor1", action: "add" },
  addFollower: { kind: "addFollower", actorId: "actor1", name: "동행자" },
  removeFollower: { kind: "removeFollower", all: true },
  showPicture: { kind: "showPicture", pictureId: "pic1", resourceId: "res1", x: 0, y: 0 },
  erasePicture: { kind: "erasePicture", pictureId: "pic1" },
  playAudio: { kind: "playAudio", resourceId: "res1", loop: false },
  stopAudio: { kind: "stopAudio" },
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
  m2Command: { kind: "m2Command", commandId: "m2_test", fields: {} },
};

// kind별 최소 유효 Condition 인스턴스. 라운드트립 테스트에서는 참조 검증까지 통과해야 하므로
// 아래 IDENTIFIER 후보 대신 실제 blank project의 id들로 다시 채워 사용한다(buildRoundtripConditions).
function buildMinimalConditions(ids: {
  switchId: string;
  variableId: string;
  actorId: string;
  itemId: string;
}): Record<ConditionKind, Condition> {
  return {
    switch: { kind: "switch", switchId: ids.switchId, value: true },
    variable: { kind: "variable", variableId: ids.variableId, op: "==", value: 1 },
    selfSwitch: { kind: "selfSwitch", key: "A", value: true },
    actor: { kind: "actor", actorId: ids.actorId, present: true },
    item: { kind: "item", itemId: ids.itemId, present: true },
    gold: { kind: "gold", op: ">=", amount: 0 },
    timer: { kind: "timer", timerId: "timer1", seconds: 10 },
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
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
    audio: {},
    pictures: {},
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
    const project = createBlankProject();
    const actorId = project.database.actors[0]?.id;
    const itemId = project.database.items[0]?.id;
    const switchId = project.switches[0]?.id;
    const variableId = project.variables[0]?.id;
    expect(actorId, "blank project에 actor가 있어야 함").toBeTruthy();
    expect(itemId, "blank project에 item이 있어야 함").toBeTruthy();
    expect(switchId, "blank project에 switch가 있어야 함").toBeTruthy();
    expect(variableId, "blank project에 variable이 있어야 함").toBeTruthy();

    const conditions = buildMinimalConditions({
      switchId: switchId as string,
      variableId: variableId as string,
      actorId: actorId as string,
      itemId: itemId as string,
    });
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
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: forkCommands,
      pages: [page],
    };

    const map = project.maps[project.startMapId];
    map.events = [...map.events, testEvent];

    const restored = deserialize(serialize(project));
    const restoredEvent = restored.maps[project.startMapId].events.find(
      (event) => event.id === "ev_condition_roundtrip"
    );
    expect(restoredEvent).toEqual(testEvent);
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
