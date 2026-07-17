// test/commandContracts/fork.contract.test.ts
// G1 계약: fork (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - 결측 참조는 경고가 아니라 기본값 평가다. switch=false, variable=0, selfSwitch=false,
//   actor/item absent, gold=0, timer=0 이 조건 평가에 사용된다.
import { describe, expect, it } from "vitest";
import type { Command, Condition, Project } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

type MutateSession = NonNullable<Parameters<typeof runCommandContract>[1]>["mutateSession"];

function forkProgram(condition: Condition, prefix: string): Command[] {
  return [
    {
      kind: "fork",
      condition,
      then: [{ kind: "setSwitch", switchId: `${prefix}_then`, value: true }],
      else: [{ kind: "setSwitch", switchId: `${prefix}_else`, value: true }],
    },
  ];
}

function expectBranch(condition: Condition, expected: "then" | "else", mutateSession?: MutateSession): void {
  const result = runCommandContract(forkProgram(condition, "branch"), { mutateSession });

  expect(result.session.switches[`branch_${expected}`]).toBe(true);
  expect(result.session.switches[`branch_${expected === "then" ? "else" : "then"}`]).toBeUndefined();
  expect(result.warnings).toEqual([]);
  expect(result.finished).toBe(true);
}

function registerForkRoundtripRefs(project: Project): void {
  project.switches.push(
    { id: "sw_roundtrip_condition", name: "condition" },
    { id: "fork_roundtrip_then", name: "then" },
    { id: "fork_roundtrip_else", name: "else" }
  );
  project.variables.push({ id: "var_roundtrip_condition", name: "condition variable" });
}

describe("fork 계약", () => {
  const trueCases: readonly [string, Condition, MutateSession][] = [
    ["switch", { kind: "switch", switchId: "sw_gate", value: true }, (session) => { session.switches.sw_gate = true; }],
    ["variable", { kind: "variable", variableId: "var_gate", op: ">=", value: 3 }, (session) => { session.variables.var_gate = 3; }],
    ["selfSwitch", { kind: "selfSwitch", key: "A", value: true }, (session) => { session.selfSwitches = { [CONTRACT_EVENT_ID]: { A: true } }; }],
    ["actor", { kind: "actor", actorId: "actor_gate", present: true }, (session) => { session.partyActorIds = ["actor_gate"]; }],
    ["item", { kind: "item", itemId: "item_gate", present: true }, (session) => { session.inventory.item_gate = 1; }],
    ["gold", { kind: "gold", op: ">=", amount: 50 }, (session) => { session.gold = 50; }],
    ["timer", { kind: "timer", timerId: "timer1", seconds: 10 }, (session) => { session.timers.timer1 = 10; }],
  ];

  it.each(trueCases)(
    "정상 효과(true): %s 조건이 참이면 then branch 만 실행한다",
    (_label, condition, mutateSession) => {
      expectBranch(condition, "then", mutateSession);
    }
  );

  const falseCases: readonly [string, Condition][] = [
    ["switch", { kind: "switch", switchId: "sw_gate", value: true }],
    ["variable", { kind: "variable", variableId: "var_gate", op: ">", value: 3 }],
    ["selfSwitch", { kind: "selfSwitch", key: "B", value: true }],
    ["actor", { kind: "actor", actorId: "actor_gate", present: true }],
    ["item", { kind: "item", itemId: "item_gate", present: true }],
    ["gold", { kind: "gold", op: ">", amount: 0 }],
    ["timer", { kind: "timer", timerId: "timer2", seconds: -1 }],
  ];

  it.each(falseCases)(
    "정상 효과(false): %s 조건이 거짓이면 else branch 만 실행한다",
    (_label, condition) => {
      expectBranch(condition, "else");
    }
  );

  it("결측 참조: 기본값 평가를 고정한다(var==0은 참)", () => {
    const trueByDefault: readonly Condition[] = [
      { kind: "switch", switchId: "missing_switch", value: false },
      { kind: "variable", variableId: "missing_variable", op: "==", value: 0 },
      { kind: "selfSwitch", key: "C", value: false },
      { kind: "actor", actorId: "missing_actor", present: false },
      { kind: "item", itemId: "missing_item", present: false },
      { kind: "gold", op: "==", amount: 0 },
      { kind: "timer", timerId: "timer1", seconds: 0 },
    ];

    for (const condition of trueByDefault) {
      expectBranch(condition, "then");
    }
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 branch 결과가 같다", () => {
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_roundtrip_condition", value: true },
        then: [{ kind: "setSwitch", switchId: "fork_roundtrip_then", value: true }],
        else: [{ kind: "setSwitch", switchId: "fork_roundtrip_else", value: true }],
      },
    ];
    const original = runCommandContract(commands, {
      mutateSession: (session) => {
        session.switches.sw_roundtrip_condition = true;
      },
    });
    const restoredCommands = roundtripCommands(commands, registerForkRoundtripRefs);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, {
      mutateSession: (session) => {
        session.switches.sw_roundtrip_condition = true;
      },
    });

    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual([]);
  });

  it("pause 의미론: fork 자체는 non-blocking — branch 가 non-blocking 이면 pause 가 없다", () => {
    const result = runCommandContract(forkProgram({ kind: "gold", op: ">=", amount: 0 }, "pause_fork"));

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("복합 조건: all/any/not 이 then/else 분기를 올바르게 고른다", () => {
    expectBranch(
      {
        kind: "all",
        conditions: [
          { kind: "switch", switchId: "sw_gate", value: true },
          { kind: "gold", op: ">=", amount: 10 },
        ],
      },
      "then",
      (session) => {
        session.switches.sw_gate = true;
        session.gold = 10;
      },
    );
    expectBranch(
      {
        kind: "any",
        conditions: [
          { kind: "switch", switchId: "sw_gate", value: true },
          { kind: "gold", op: ">=", amount: 999 },
        ],
      },
      "then",
      (session) => {
        session.switches.sw_gate = true;
        session.gold = 0;
      },
    );
    expectBranch(
      { kind: "not", condition: { kind: "switch", switchId: "sw_gate", value: true } },
      "then",
    );
    expectBranch(
      {
        kind: "all",
        conditions: [
          { kind: "switch", switchId: "sw_gate", value: true },
          { kind: "gold", op: ">=", amount: 10 },
        ],
      },
      "else",
      (session) => {
        session.switches.sw_gate = true;
        session.gold = 0;
      },
    );
  });

});
