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

function expectBranch(
  condition: Condition,
  expected: "then" | "else",
  mutateSession?: MutateSession,
  mutateProject?: (project: Project) => void,
): void {
  const result = runCommandContract(forkProgram(condition, "branch"), { mutateSession, mutateProject });

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

  // 종전 이 파일은 16종 중 10종만 덮었다. 나머지 6종(timePhase/season/npcActivity/
  // friendshipAtLeast/battleResult/run)은 evalCondition 단위로만 증명돼 있어서, 실제
  // 인터프리터 drain 을 통과하는 then/else 선택이 고정돼 있지 않았다. 조건 종류가
  // 늘어날 때 fork 분기에서만 조용히 빠지는 것을 막는다.
  const stateCases: readonly [string, Condition, MutateSession][] = [
    [
      "timePhase",
      { kind: "timePhase", phase: "day" },
      (session) => { session.gameTime = { minute: 0, hour: 12, day: 1, season: "spring", year: 1 }; },
    ],
    [
      "season",
      { kind: "season", season: "summer" },
      (session) => { session.gameTime = { minute: 0, hour: 12, day: 1, season: "summer", year: 1 }; },
    ],
    [
      "npcActivity",
      { kind: "npcActivity", activity: "work" },
      (session) => { session.npcActivities = { [CONTRACT_EVENT_ID]: "work" }; },
    ],
    [
      "friendshipAtLeast",
      { kind: "friendshipAtLeast", npcKey: "npc_fork_gate", value: 20 },
      (session) => { session.friendship = { npc_fork_gate: 20 }; },
    ],
    [
      "relationshipAtLeast",
      { kind: "relationshipAtLeast", npcKey: "npc_fork_gate", state: "dating" },
      (session) => { session.relationships = { npc_fork_gate: "engaged" }; },
    ],
    [
      "battleResult",
      { kind: "battleResult", result: "victory" },
      (session) => { session.battleResult = "victory"; },
    ],
    [
      "run",
      { kind: "run", query: "active", value: true },
      (session) => {
        session.roguelikeRun = {
          version: 1,
          runId: "fork-contract-run",
          seed: 1,
          floor: 1,
          status: "active",
          flags: {},
          roomResetCounts: {},
          roomEventGenerationKeys: {},
        };
      },
    ],
  ];

  it.each(stateCases)(
    "세션 상태 조건(true): %s 조건이 참이면 then branch 만 실행한다",
    (_label, condition, mutateSession) => {
      expectBranch(condition, "then", mutateSession);
    }
  );

  it.each(stateCases)(
    "세션 상태 조건(false): %s 조건이 상태 없이 거짓이면 else branch 만 실행한다",
    (_label, condition) => {
      expectBranch(condition, "else");
    }
  );

  // 빈 npcKey 는 호스트 이벤트의 characterId 로 해석된다(resolveSocialKey). 이 경로가
  // 끊기면 「비우면 이 이벤트」 저작이 조용히 항상 거짓이 된다.
  it("friendshipAtLeast: 빈 npcKey 는 호스트 이벤트의 characterId 로 해석된다", () => {
    expectBranch(
      { kind: "friendshipAtLeast", value: 30 },
      "then",
      (session) => { session.friendship = { character_fork_host: 30 }; },
      (project) => {
        const event = project.maps[project.startMapId].events.find((entry) => entry.id === CONTRACT_EVENT_ID);
        if (event) event.characterId = "character_fork_host";
      },
    );
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
