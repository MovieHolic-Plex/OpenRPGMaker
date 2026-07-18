// test/commandContracts/harness.test.ts
// 계약 하네스 자체의 동작 보증 (스펙 §4.2): maxSteps 초과 실패 / answers 소진 /
// console.warn 캡처·복원 / finished 판정 / 세션·프로젝트 가공 훅.
import { describe, expect, it, vi } from "vitest";
import type { Command } from "@/project/types";
import { runCommandContract, roundtripCommands, CONTRACT_EVENT_ID } from "./harness";
import { defineCommandContract } from "./defineCommandContract";

describe("command contract definition", () => {
  it("requires and preserves the four standardized cases", () => {
    const noop = { name: "case", run: () => undefined };
    const definition = defineCommandContract({
      kind: "text",
      happy: noop,
      edge: noop,
      roundtrip: noop,
      pauseOrTermination: noop,
    });

    expect(Object.keys(definition).sort()).toEqual([
      "edge",
      "happy",
      "kind",
      "pauseOrTermination",
      "roundtrip",
    ]);
  });
});

describe("contract summaries", () => {
  it("returns sorted state entries and explicit owner handoffs", () => {
    const result = runCommandContract([
      { kind: "setSwitch", switchId: "zeta", value: true },
      { kind: "setSwitch", switchId: "alpha", value: false },
      { kind: "setVariable", variableId: "score", op: "=", value: 7 },
      { kind: "text", body: "handoff" },
      { kind: "battleProcessing", troopId: "troop_contract", canEscape: true, canLose: false },
    ]);

    expect(result.stateSummary).toEqual({
      flags: [],
      switches: [["alpha", false], ["zeta", true]],
      variables: [["score", 7]],
      timers: [],
      inventory: [],
      gold: 0,
      partyActorIds: [],
      position: { mapId: "map_blank_start", x: 10, y: 8 },
      audioIds: [],
      pictureIds: [],
    });
    expect(result.ownerHandoffs).toEqual([
      { stepKind: "text", owner: "player" },
      { stepKind: "battleProcessing", owner: "battle" },
    ]);
  });
});

describe("interpreter instruction budget", () => {
  it("stops a non-pausing label/goto cycle at the configured command count", () => {
    const result = runCommandContract(
      [
        { kind: "label", name: "cycle" },
        { kind: "gotoLabel", name: "cycle" },
      ],
      { maxInstructions: 8 }
    );

    expect(result.pauses).toEqual([]);
    expect(result.warnings).toContain(
      "[interpreter:instruction-budget-exhausted] maxInstructions=8 executed=8"
    );
    expect(result.finished).toBe(false);
  });
});

describe("commandContracts 하네스", () => {
  it("maxSteps 초과 시 무한루프로 판단하고 실패한다", () => {
    // breakLoop 없는 루프 + 매 반복 wait pause → maxSteps 안전핀이 잡아야 한다.
    const commands: Command[] = [
      { kind: "loop", body: [{ kind: "wait", ms: 1 }] },
    ];
    expect(() => runCommandContract(commands, { maxSteps: 10 })).toThrow(/maxSteps\(10\) 초과/);
  });

  it("answers를 순서대로 소비하고, 소진된 뒤에는 undefined로 자동 진행한다", () => {
    const choice = (switchPrefix: string): Command => ({
      kind: "choices",
      options: [
        { text: "A", branch: [{ kind: "setSwitch", switchId: `${switchPrefix}_a`, value: true }] },
        { text: "B", branch: [{ kind: "setSwitch", switchId: `${switchPrefix}_b`, value: true }] },
      ],
    });
    // answers=[1] → 첫 choices 는 B(1) 선택, 둘째 choices 는 소진 → undefined → 기본 0(A) 선택.
    const result = runCommandContract([choice("first"), choice("second")], { answers: [1] });

    expect(result.session.switches.first_b).toBe(true);
    expect(result.session.switches.first_a).toBeUndefined();
    expect(result.session.switches.second_a).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("console.warn을 warnings로 캡처하고, 실행 후 스파이를 복원한다", () => {
    const result = runCommandContract([
      { kind: "callCommonEvent", commonEventId: "ce_missing" },
      { kind: "text", body: "계속" },
    ]);

    expect(result.warnings.some((message) => message.includes("공통 이벤트 없음"))).toBe(true);
    expect(result.warnings.some((message) => message.includes("[interpreter]"))).toBe(true);
    // 하네스가 스파이를 복원했어야 한다.
    expect(vi.isMockFunction(console.warn)).toBe(false);
    // warn 이후에도 다음 명령이 실행된다.
    expect(result.pauses.map((pause) => pause.kind)).toEqual(["text"]);
    expect(result.finished).toBe(true);
  });

  it("finished 판정: 끝까지 도달하면 true, transfer 조기 종료면 false", () => {
    const done = runCommandContract([{ kind: "text", body: "hello" }]);
    expect(done.finished).toBe(true);
    expect(done.pauses).toHaveLength(1);
    // 센티널 플래그가 세션에 남지 않는다.
    expect(Object.keys(done.session.flags)).toEqual([]);

    const early = runCommandContract([
      { kind: "transfer", mapId: "map_blank_start", x: 2, y: 3 },
      { kind: "setSwitch", switchId: "after_transfer", value: true },
    ]);
    expect(early.pauses.map((pause) => pause.kind)).toEqual(["transfer"]);
    expect(early.session.switches.after_transfer).toBeUndefined();
    expect(early.finished).toBe(false);
  });

  it("mutateSession/mutateProject 훅이 실행 전에 적용된다", () => {
    const result = runCommandContract(
      [
        { kind: "changeGold", op: "-=", amount: 30 },
        { kind: "callCommonEvent", commonEventId: "ce_greet" },
      ],
      {
        mutateSession: (session) => {
          session.gold = 100;
          session.commonEvents = [
            { id: "ce_greet", commands: [{ kind: "setSwitch", switchId: "greeted", value: true }] },
          ];
        },
      }
    );

    expect(result.session.gold).toBe(70);
    expect(result.session.switches.greeted).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("roundtripCommands가 serialize→deserialize 후 같은 명령 배열을 돌려준다", () => {
    // deserialize 는 참조 검증을 수행하므로, 미등록 switchId 는 mutateProject 로 정의를 등록한다.
    const commands: Command[] = [
      { kind: "setSwitch", switchId: "sw_roundtrip", value: true },
      { kind: "text", body: "왕복" },
    ];
    expect(
      roundtripCommands(commands, (project) => {
        project.switches.push({ id: "sw_roundtrip", name: "왕복 테스트" });
      })
    ).toEqual(commands);
    expect(CONTRACT_EVENT_ID).toBe("ev_contract");
  });
});
