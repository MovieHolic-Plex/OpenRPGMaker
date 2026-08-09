import { describe, it, expect, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

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

// loop 는 pause 를 만들지 않고 인터프리터 내부에서 반복을 수행한다.
// 따라서 start() 한 번으로 breakLoop 또는 가드 도달까지 실행된다.
// 단 body 안에 text 가 있으면 pause 하므로 resume 이 필요하다.
function runToEnd(
  commands: Command[],
  session: PlaySessionLike,
  opts?: { maxLoopIterations?: number; onText?: () => void }
): void {
  const interp = createInterpreter(commands, session, undefined, { maxLoopIterations: opts?.maxLoopIterations });
  let r = interp.start();
  let guard = 0;
  while (r.kind !== "done" && guard++ < 5000) {
    if (r.kind === "text") {
      opts?.onText?.();
      r = interp.resume(undefined);
    } else if (r.kind === "wait") {
      r = interp.resume(undefined);
    } else {
      break;
    }
  }
}

describe("Loop / Break Loop", () => {
  it("루프 본문이 breakLoop 만날 때까지 반복된다", () => {
    const session = mkSession();
    // 변수 counter 가 3 이상이면 탈출, 매 반복마다 +1
    const commands: Command[] = [
      { kind: "setVariable", variableId: "counter", op: "=", value: 0 },
      {
        kind: "loop",
        body: [
          { kind: "setVariable", variableId: "counter", op: "+=", value: 1 },
          {
            kind: "fork",
            condition: { kind: "variable", variableId: "counter", op: ">=", value: 3 },
            then: [{ kind: "breakLoop" }],
          },
        ],
      },
      { kind: "setVariable", variableId: "after", op: "=", value: 99 },
    ];

    runToEnd(commands, session);

    expect(session.variables.counter).toBe(3);
    expect(session.variables.after).toBe(99);
  });

  it("breakLoop 없이 루프를 탈출하면 무한 반복 가드가 종료시킨다", () => {
    const session = mkSession();
    const commands: Command[] = [
      { kind: "setVariable", variableId: "counter", op: "=", value: 0 },
      {
        kind: "loop",
        body: [{ kind: "setVariable", variableId: "counter", op: "+=", value: 1 }],
      },
      { kind: "setVariable", variableId: "after", op: "=", value: 7 },
    ];

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    runToEnd(commands, session, { maxLoopIterations: 5 });
    warn.mockRestore();

    // 가드(maxLoopIterations=5) 도달 후 정상적으로 이후 명령 실행
    expect(session.variables.after).toBe(7);
    expect(session.variables.counter).toBe(5);
  });

  it("빈 루프 본문은 한 번도 실행되지 않고 건너뛴다", () => {
    const session = mkSession();
    const commands: Command[] = [
      { kind: "setVariable", variableId: "before", op: "=", value: 1 },
      { kind: "loop", body: [] },
      { kind: "setVariable", variableId: "after", op: "=", value: 2 },
    ];

    runToEnd(commands, session);

    expect(session.variables.before).toBe(1);
    expect(session.variables.after).toBe(2);
  });

  it("루프 안의 text 명령은 매 반복마다 pause/ resume 된다", () => {
    const session = mkSession();
    const commands: Command[] = [
      { kind: "setVariable", variableId: "n", op: "=", value: 0 },
      {
        kind: "loop",
        body: [
          { kind: "setVariable", variableId: "n", op: "+=", value: 1 },
          { kind: "text", body: "반복" },
          {
            kind: "fork",
            condition: { kind: "variable", variableId: "n", op: ">=", value: 2 },
            then: [{ kind: "breakLoop" }],
          },
        ],
      },
    ];

    let textCount = 0;
    runToEnd(commands, session, { onText: () => { textCount += 1; } });

    expect(session.variables.n).toBe(2);
    expect(textCount).toBe(2);
  });
});
