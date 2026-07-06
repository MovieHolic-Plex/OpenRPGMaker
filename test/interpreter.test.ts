// test/interpreter.test.ts
// SIZE_OK: Shared interpreter regressions reuse one command-drain harness so
// message settings, facesets, and choices stay covered without duplicate setup.
// 인터프리터 상태머신 검증. 일시정지/재개/분기/조건/세션 반영.

import { describe, it, expect, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { M2_COMMAND_CATALOG } from "@/editor/eventCommands/m2Catalog";
import type { Command, M2CommandFields } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

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

  drain(createInterpreter(commands, session));

  expect(session.actorVitals.actor_hero).toMatchObject({ hp: 80, mp: 20 });
  expect(session.actorVitals.actor_mage).toMatchObject({ hp: 50, mp: 30 });
  expect(session.actorExperience?.actor_hero).toBe(12);
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
      r.kind === "shakeScreen"
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
        resourceId: "easyrpg-faceset-actor1",
        faceIndex: 0,
        position: "left",
        flipHorizontally: true,
      },
      { kind: "text", body: "얼굴 확인" },
    ];
    const it = createInterpreter(cmds, mkSession());

    const text = expectTextResult(it.start());

    expect(text.face).toEqual({
      resourceId: "easyrpg-faceset-actor1",
      faceIndex: 0,
      position: "left",
      flipHorizontally: true,
    });
  });

  it("Faceset 상태는 독립된 이벤트 실행 사이에 누수되지 않는다", () => {
    const session = mkSession();
    const first = createInterpreter([
      {
        kind: "changeFace",
        resourceId: "easyrpg-faceset-actor1",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      },
      { kind: "text", body: "첫 이벤트" },
    ], session);
    expect(expectTextResult(first.start()).face?.resourceId).toBe("easyrpg-faceset-actor1");

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
      } else if (r.kind === "wait" || r.kind === "inputWait" || r.kind === "timer" || r.kind === "changeTile" || r.kind === "moveEvent") {
        r = it.resume(undefined);
      } else if (r.kind === "transfer") {
        r = it.resume(undefined);
      } else break;
    }
    expect(session.variables["i"]).toBe(3);
    expect(texts).toEqual(["탈출", "끝"]);
  });
});

describe("changeTile / moveEvent — 요청 반환", () => {
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
    expect(r.kind).toBe("moveEvent");
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

  it("picture, audio, shop, inn, gameOver, and title commands suspend as typed handoffs", () => {
    const cmds: Command[] = [
      { kind: "showPicture", pictureId: "pic1", resourceId: "tex_tiles_default", x: 1, y: 2 },
      { kind: "playAudio", resourceId: "theme", loop: true },
      { kind: "shop", itemIds: ["item_potion"] },
      { kind: "inn", price: 50 },
      { kind: "gameOver" },
      { kind: "ending", title: "The End", message: "Peace returned." },
      { kind: "returnToTitle" },
    ];
    const it = createInterpreter(cmds, mkSession());
    const kinds: string[] = [];
    let r = it.start();
    while (r.kind !== "done") {
      kinds.push(r.kind);
      r = it.resume(undefined);
    }
    expect(kinds).toEqual(["showPicture", "playAudio", "shop", "inn", "gameOver", "returnToTitle", "returnToTitle"]);
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
    expect(session.variables.player_map).toBe(0);
    expect(session.variables.player_x).toBe(4);
    expect(session.variables.player_y).toBe(5);
    expect(session.m2Runtime?.events?.event_guard).toMatchObject({ mapId: "map_intro", x: 6, y: 7 });
    expect(session.m2Runtime?.audio).toMatchObject({ memorizedBgm: "field-theme", playedMemorizedBgm: "field-theme" });
    expect(session.audio.bgm).toEqual({ resourceId: "field-theme", loop: true });
    expect(session.m2Runtime?.fallbacks?.some((entry) => entry.commandId.includes("break-loop"))).toBe(true);
  });

  it("records modern event commands into explicit runtime buckets without unsafe script execution", () => {
    const session = mkM2Session();
    session.gold = 25;
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
    expect(session.audio?.ambient).toEqual({ resourceId: "forest_wind", loop: true });
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
    expect(session.eventLocations?.event_guard).toEqual({ mapId: session.currentMapId, x: 14, y: 2 });
    expect(session.eventLocations?.spawn_guard).toBeUndefined();
    expect(session.m2Runtime?.expressions).toEqual([{ expression: "gold + 10", resultVariableId: "calc_result", evaluated: true }]);
    expect(session.variables.calc_result).toBe(35);
    expect(session.variables.gold_value).toBe(25);
  });
});
