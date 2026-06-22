// test/interpreter.test.ts
// 인터프리터 상태머신 검증. 일시정지/재개/분기/조건/세션 반영.

import { describe, it, expect } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

type Interpreter = ReturnType<typeof createInterpreter>;
type InterpreterResult = ReturnType<Interpreter["start"]>;
type TextResult = Extract<InterpreterResult, { kind: "text" }>;
type WaitResult = Extract<InterpreterResult, { kind: "wait" }>;

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
  };
}

function expectTextResult(result: InterpreterResult): TextResult {
  if (result.kind === "text") return result;
  throw new Error(`expected interpreter result text, got ${result.kind}`);
}

function expectWaitResult(result: InterpreterResult): WaitResult {
  if (result.kind === "wait") return result;
  throw new Error(`expected interpreter result wait, got ${result.kind}`);
}

// 인터프리터를 끝까지 돌리며, text/choices/wait/transfer 응답을 시뮬레이션.
// choices는 optionIndex를 인자로 받아 선택.
function drain(
  it: ReturnType<typeof createInterpreter>,
  onChoices?: (options: { text: string }[]) => number
): { texts: string[]; transfers: { mapId: string; x: number; y: number }[]; flags: Record<string, boolean> } {
  const texts: string[] = [];
  const transfers: { mapId: string; x: number; y: number }[] = [];
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
      transfers.push({ mapId: r.mapId, x: r.x, y: r.y });
      r = it.resume(undefined);
    } else if (
      r.kind === "inputWait" ||
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
      r.kind === "returnToTitle"
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
});

describe("transfer — 종료", () => {
  it("transfer는 요청 후 종료(이후 명령 무시)", () => {
    const cmds: Command[] = [
      { kind: "text", body: "이동 전" },
      { kind: "transfer", mapId: "m2", x: 3, y: 4 },
      { kind: "text", body: "이동 후(무시되어야 함)" },
    ];
    const it = createInterpreter(cmds, mkSession());
    const { texts, transfers } = drain(it);
    expect(texts).toEqual(["이동 전"]);
    expect(transfers).toEqual([{ mapId: "m2", x: 3, y: 4 }]);
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
      } else if (r.kind === "wait" || r.kind === "inputWait" || r.kind === "changeTile" || r.kind === "moveEvent") {
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
    expect(session.timers["default"]).toBe(90);
  });
});
